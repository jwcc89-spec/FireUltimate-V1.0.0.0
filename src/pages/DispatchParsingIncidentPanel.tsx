import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCadParsingConfig,
  patchCadParsingConfig,
} from "../api/cadDispatchConfig.ts";
import { getCadEmails, type CadEmailIngestRow } from "../api/cadEmails.ts";
import { getDispatchPlainTextFromRawBody } from "../cadDispatch/extractDispatchPlainText.ts";
import {
  INCIDENT_LABEL_FIELDS,
  assignSectionToField,
  buildIncidentLabelConfig,
  emptyIncidentLabels,
  DEFAULT_INCIDENT_NUMBER_FORMAT,
  DEFAULT_RESET_DAY,
  DEFAULT_RESET_MONTH,
  DEFAULT_RESET_TIME,
  fieldIdForSection,
  followUpCallNumber,
  incidentNumberFormatFromExtract,
  incidentNumberSeriesExample,
  labelsFromSavedRules,
  linesToPhrases,
  normalizeSectionSeparator,
  parseResetTime,
  phraseListFromExtract,
  phrasesToLines,
  previewIncidentFromLabels,
  resetFromExtract,
  separatorFromExtract,
  splitDispatchParts,
} from "../cadDispatch/incidentLabelMap.ts";
import { parseCadRulesJson } from "../cadDispatch/ruleEngine.ts";

const EMAIL_LIST_LIMIT = 20;

function formatRowDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

export function DispatchParsingIncidentPanel() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [enableIncidentCreation, setEnableIncidentCreation] = useState(false);
  const [choices, setChoices] = useState(emptyIncidentLabels);
  const [separator, setSeparator] = useState(";");
  const [incidentNumberFormat, setIncidentNumberFormat] = useState(DEFAULT_INCIDENT_NUMBER_FORMAT);
  const [resetMonth, setResetMonth] = useState(DEFAULT_RESET_MONTH);
  const [resetDay, setResetDay] = useState(DEFAULT_RESET_DAY);
  const [resetTime, setResetTime] = useState(DEFAULT_RESET_TIME);
  const [excludeText, setExcludeText] = useState("");
  const [exceptionText, setExceptionText] = useState("");
  const [apparatusNames, setApparatusNames] = useState<string[] | null>(null);
  const [customRulesPresent, setCustomRulesPresent] = useState(false);

  const [emails, setEmails] = useState<CadEmailIngestRow[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [emailsError, setEmailsError] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string>("");

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveOkAt, setSaveOkAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getCadParsingConfig()
      .then((cfg) => {
        if (cancelled) return;
        setEnableIncidentCreation(cfg.enableIncidentCreation);
        let parsedRules: unknown = cfg.incidentRules ?? [];
        try {
          parsedRules = parseCadRulesJson(JSON.parse(JSON.stringify(cfg.incidentRules ?? [])));
        } catch (e) {
          setLoadError(e instanceof Error ? e.message : "Invalid saved incident rules.");
          return;
        }
        const savedSeparator = separatorFromExtract(cfg.incidentNumberExtract);
        setSeparator(savedSeparator);
        setIncidentNumberFormat(incidentNumberFormatFromExtract(cfg.incidentNumberExtract));
        const savedReset = resetFromExtract(cfg.incidentNumberExtract);
        setResetMonth(savedReset.month);
        setResetDay(savedReset.day);
        setResetTime(savedReset.time);
        setExcludeText(phrasesToLines(phraseListFromExtract(cfg.incidentNumberExtract, "excludeContains")));
        setExceptionText(phrasesToLines(phraseListFromExtract(cfg.incidentNumberExtract, "excludeExceptions")));
        const loaded = labelsFromSavedRules(parsedRules, savedSeparator);
        const normalized = emptyIncidentLabels();
        for (const field of INCIDENT_LABEL_FIELDS) {
          if (field.id === "incidentNumber") continue;
          const choice = loaded.labels[field.id];
          if (choice) normalized[field.id] = { index: choice.index, afterLabel: false };
        }
        setChoices(normalized);
        setCustomRulesPresent(!loaded.recognized);
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load parsing config.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/department-details")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        const data = json.data && typeof json.data === "object" ? json.data : {};
        const records = Array.isArray(data.masterApparatusRecords)
          ? data.masterApparatusRecords
          : Array.isArray(data.apparatusRecords)
            ? data.apparatusRecords
            : [];
        const names: string[] = [];
        for (const record of records) {
          if (!record || typeof record !== "object") continue;
          const entry = record as { unitId?: unknown; commonName?: unknown };
          for (const value of [entry.unitId, entry.commonName]) {
            const name = String(value ?? "").trim();
            if (name) names.push(name);
          }
        }
        setApparatusNames(names);
      })
      .catch(() => {
        if (!cancelled) setApparatusNames(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setEmailsLoading(true);
    setEmailsError(null);
    getCadEmails(EMAIL_LIST_LIMIT, 0)
      .then((list) => {
        if (cancelled) return;
        setEmails(list);
        setSelectedEmailId((current) => current || list[0]?.id || "");
      })
      .catch((e) => {
        if (!cancelled) {
          setEmailsError(e instanceof Error ? e.message : "Failed to load emails.");
        }
      })
      .finally(() => {
        if (!cancelled) setEmailsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [saveOkAt]);

  const selectedEmail = emails.find((row) => row.id === selectedEmailId) ?? emails[0] ?? null;
  const sampleText = selectedEmail
    ? (getDispatchPlainTextFromRawBody(selectedEmail.rawBody ?? "") ?? "")
    : "";

  const activeSeparator = normalizeSectionSeparator(separator);

  const preview = useMemo(() => {
    if (!sampleText) return null;
    return previewIncidentFromLabels(
      sampleText,
      choices,
      activeSeparator,
      incidentNumberFormat,
      { month: resetMonth, day: resetDay, time: resetTime },
      new Date(),
      {
        excludeContains: linesToPhrases(excludeText),
        excludeExceptions: linesToPhrases(exceptionText),
        apparatusNames,
      },
    );
  }, [
    sampleText,
    choices,
    activeSeparator,
    incidentNumberFormat,
    resetMonth,
    resetDay,
    resetTime,
    excludeText,
    exceptionText,
    apparatusNames,
  ]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveOkAt(null);
    if (!parseResetTime(resetTime)) {
      setSaveError("Enter the reset time in 24-hour format, such as 00:00.");
      return;
    }
    const built = buildIncidentLabelConfig(
      choices,
      separator,
      incidentNumberFormat,
      { month: resetMonth, day: resetDay, time: resetTime },
      {
        excludeContains: linesToPhrases(excludeText),
        excludeExceptions: linesToPhrases(exceptionText),
      },
    );
    setSaveBusy(true);
    try {
      await patchCadParsingConfig({
        enableIncidentCreation,
        incidentRules: built.rules,
        incidentFieldMap: built.fieldMap,
        incidentNumberExtract: built.incidentNumberExtract,
      });
      setCustomRulesPresent(false);
      setSaveOkAt(Date.now());
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }, [
    enableIncidentCreation,
    choices,
    separator,
    incidentNumberFormat,
    resetMonth,
    resetDay,
    resetTime,
    excludeText,
    exceptionText,
  ]);

  const sections = splitDispatchParts(sampleText, activeSeparator);

  if (loading) {
    return (
      <header className="page-header dispatch-parsing-module-header">
        <div>
          <h1>Incident Parsing</h1>
          <p>Loading configuration…</p>
        </div>
      </header>
    );
  }

  if (loadError) {
    return (
      <>
        <header className="page-header dispatch-parsing-module-header">
          <div>
            <h1>Incident Parsing</h1>
            <p>
              Pulls values out of the dispatch email and writes them into a new incident. Message Parsing is the
              separate dashboard text.
            </p>
          </div>
        </header>
        <p className="field-error">{loadError}</p>
      </>
    );
  }

  return (
    <>
      <header className="page-header dispatch-parsing-module-header">
        <div>
          <h1>Incident Parsing</h1>
          <p>
            This page is where extracted email text goes into the incident: incident number, dispatch number, incident
            type, initial dispatch code, priority, still district, reported by, assigned units, address, callback
            number, and dispatch notes. <strong>Message Parsing</strong> is separate. That text is what will show on
            the dashboard, and later on the incident widget. It does not fill these fields. New CAD incidents start
            with status <strong>Draft</strong>.
          </p>
        </div>
      </header>

      <section className="cad-dispatch-h-top">
        <article className="panel cad-dispatch-incident-card">
          <div className="panel-header">
            <h2>Incident number setup</h2>
          </div>
          <label className="cad-allowlist-field">
            How are sections or fields separated from CAD?
            <input
              className="cad-dispatch-merge-key-input cad-incident-separator-input"
              type="text"
              maxLength={1}
              value={separator}
              aria-label="Character that separates CAD sections"
              onChange={(event) => setSeparator(event.target.value)}
            />
          </label>
          <p className="panel-description">Enter one character. Crescent’s emails use a semicolon.</p>
          <label className="cad-allowlist-field">
            Date calls reset each year
            <input
              className="cad-dispatch-merge-key-input"
              type="date"
              value={`2026-${String(resetMonth).padStart(2, "0")}-${String(resetDay).padStart(2, "0")}`}
              aria-label="Date calls reset each year"
              onChange={(event) => {
                const match = event.target.value.match(/^\d{4}-(\d{2})-(\d{2})$/);
                if (!match) return;
                setResetMonth(Number(match[1]));
                setResetDay(Number(match[2]));
              }}
            />
          </label>
          <label className="cad-allowlist-field">
            Time calls reset (24-hour)
            <input
              className="cad-dispatch-merge-key-input cad-incident-separator-input"
              type="text"
              inputMode="numeric"
              placeholder="00:00"
              value={resetTime}
              aria-label="Time calls reset in 24-hour format"
              onChange={(event) => setResetTime(event.target.value)}
            />
          </label>
          <label className="cad-allowlist-field">
            Incident number format
            <input
              className="cad-dispatch-merge-key-input"
              type="text"
              value={incidentNumberFormat}
              aria-label="Incident number format"
              onChange={(event) => setIncidentNumberFormat(event.target.value)}
            />
          </label>
          <p className="panel-description">
            The year in the date box is only there so you can pick the month and day. That month, day, and time repeat
            every year. Enter the time in 24-hour form, such as 00:00. The CAD number, such as 26018313, is saved as
            the dispatch number. A later email uses that number to find the same call. This app assigns the incident
            number. With the reset above, the first new call in the current period is{" "}
            {incidentNumberSeriesExample(
              new Date(),
              {
                month: resetMonth,
                day: resetDay,
                time: parseResetTime(resetTime) ? resetTime : DEFAULT_RESET_TIME,
              },
              incidentNumberFormat,
            )}
            . Each later new call takes the next number. A follow-up email keeps the number already given to that
            dispatch number. Numbers are assigned when a new dispatch number is processed after you save. A call that
            arrived before the reset keeps the number it already has.
          </p>
        </article>

        <article className="panel cad-dispatch-incident-card">
          <div className="panel-header">
            <h2>Exclude emails that contain</h2>
          </div>
          <label className="cad-allowlist-field">
            Phrases
            <textarea
              className="cad-dispatch-merge-key-input"
              rows={3}
              value={excludeText}
              aria-label="Phrases that exclude an email"
              onChange={(event) => setExcludeText(event.target.value)}
            />
          </label>
          <p className="panel-description">
            One phrase per line. An email that contains any of these phrases is stored, but it does not create or
            update an incident. Leave this blank for a department that wants EMS calls included, such as Kankakee or
            Watseka.
          </p>
          <label className="cad-allowlist-field">
            Exceptions
            <textarea
              className="cad-dispatch-merge-key-input"
              rows={3}
              value={exceptionText}
              aria-label="Phrases that keep an excluded email"
              onChange={(event) => setExceptionText(event.target.value)}
            />
          </label>
          <p className="panel-description">
            One phrase per line. If the email also contains an exception, it is kept and can still become an incident.
          </p>
        </article>

        <article className="panel cad-dispatch-incident-card">
          <div className="panel-header">
            <h2>Automatic incident creation</h2>
          </div>
          <label className="cad-dispatch-checkbox-label">
            <input
              type="checkbox"
              checked={enableIncidentCreation}
              onChange={(e) => setEnableIncidentCreation(e.target.checked)}
            />
            <span>Create or update a draft incident when a dispatch email arrives</span>
          </label>
        </article>

        {customRulesPresent ? (
          <p className="field-error">
            Older extraction rules are still saved. The parts below are what Preview and Save use. Save replaces
            those older rules.
          </p>
        ) : null}

        <article className="panel cad-dispatch-incident-card">
          <div className="panel-header">
            <h2>Match the email to incident fields</h2>
          </div>
          <p className="panel-description">
            Set the address, type, and notes from the new-call email, the one that starts with the CAD number.
          </p>
          {emailsError ? <p className="field-error">{emailsError}</p> : null}
          {emailsLoading ? <p className="panel-description">Loading emails…</p> : null}
          {!emailsLoading && emails.length === 0 ? (
            <p className="panel-description">
              No stored CAD emails yet. You can still type labels and save. Send a dispatch email to see a live
              preview.
            </p>
          ) : null}
          {emails.length > 0 ? (
            <label className="cad-allowlist-field">
              Sample email
              <select
                className="cad-dispatch-merge-key-input"
                value={selectedEmail?.id ?? ""}
                onChange={(event) => setSelectedEmailId(event.target.value)}
              >
                {emails.map((row) => (
                  <option key={row.id} value={row.id}>
                    {formatRowDate(row.createdAt)} — {row.fromAddress || "Unknown sender"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {followUpCallNumber(sampleText) ? (
            <p className="panel-description">
              This sample is a follow-up. It updates call <strong>{followUpCallNumber(sampleText)}</strong>. The
              section list is locked so it does not replace the new-call mapping. Choose the email that starts with
              the call number to set those sections.
            </p>
          ) : null}
          {sections.length > 0 ? (
            <div className="cad-incident-section-list">
              {sections.map((part, index) => (
                <div key={index} className="cad-incident-section-row">
                  <div>
                    <p className="cad-incident-section-label">Section {index + 1}</p>
                    <p className="cad-incident-section-text">{part || "(empty)"}</p>
                  </div>
                  <label className="cad-allowlist-field">
                    Incident field
                    <select
                      className="cad-dispatch-merge-key-input"
                      value={fieldIdForSection(choices, index)}
                      disabled={Boolean(followUpCallNumber(sampleText))}
                      aria-label={`Incident field for section ${index + 1}`}
                      onChange={(event) =>
                        setChoices((current) => assignSectionToField(current, index, event.target.value))
                      }
                    >
                      <option value="">Do not use</option>
                      {INCIDENT_LABEL_FIELDS.filter((field) => field.id !== "incidentNumber").map((field) => {
                        const taken = choices[field.id];
                        const usedOnAnotherSection = Boolean(taken && taken.index !== index);
                        return (
                          <option key={field.id} value={field.id} disabled={usedOnAnotherSection}>
                            {field.label}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-description">This email has no semicolon-separated sections.</p>
          )}
          <p className="panel-description">
            Status is not taken from the email. A new CAD incident starts as Draft. Assigned units are saved only when
            the name matches Admin Functions → Setup/Configuration → Operational Details → Department Apparatus.
          </p>
          {sampleText ? (
            <details className="cad-incident-original-details">
              <summary>Original text</summary>
              <pre className="cad-dispatch-preview-pre cad-incident-sample-text">{sampleText}</pre>
            </details>
          ) : null}
        </article>

        <article className="panel cad-dispatch-incident-card">
          <div className="panel-header">
            <h2>Preview from the sample email</h2>
          </div>
          {!sampleText ? (
            <p className="panel-description">Choose an email with dispatch text to see the filled incident.</p>
          ) : preview && !preview.ok ? (
            <p className="field-error">{preview.error}</p>
          ) : preview && preview.ok ? (
            <>
              {preview.excluded ? (
                <p className="panel-description">
                  This email matches an exclude phrase and would not create or update an incident.
                </p>
              ) : null}
              {preview.followUp ? (
                <p className="panel-description">
                  Follow-up email. Rows marked Unchanged stay as they were saved from the new-call email. The notes
                  from this email are added under the notes already saved.
                </p>
              ) : null}
              <table className="cad-incident-slot-table">
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.label}</th>
                    <td>{row.value || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          ) : null}
          <div className="cad-dispatch-incident-actions cad-dispatch-incident-save-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSave()}
              disabled={saveBusy}
            >
              {saveBusy ? "Saving…" : "Save"}
            </button>
          </div>
          {saveError ? <p className="field-error">{saveError}</p> : null}
          {saveOkAt !== null && !saveError ? (
            <p className="cad-dispatch-save-ok" role="status">
              Saved. The next dispatch email uses these sections.
            </p>
          ) : null}
        </article>
      </section>
    </>
  );
}
