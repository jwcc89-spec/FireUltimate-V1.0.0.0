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
  fieldIdForSection,
  followUpCallNumber,
  labelsFromSavedRules,
  normalizeSectionSeparator,
  previewIncidentFromLabels,
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
        const loaded = labelsFromSavedRules(parsedRules, savedSeparator);
        const normalized = emptyIncidentLabels();
        for (const field of INCIDENT_LABEL_FIELDS) {
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
    return previewIncidentFromLabels(sampleText, choices, activeSeparator);
  }, [sampleText, choices, activeSeparator]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveOkAt(null);
    const built = buildIncidentLabelConfig(choices, separator);
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
  }, [enableIncidentCreation, choices, separator]);

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
          <p className="panel-description">
            Enter one character. Crescent’s emails use a semicolon. Set the sections from the new-call email, the
            one that starts with the call number. A follow-up email that contains <strong>CAD CFS:</strong> uses that
            number and updates the same incident. It adds its text to the notes and leaves the address and type
            already saved.
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
                      {INCIDENT_LABEL_FIELDS.map((field) => {
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
          <p className="panel-description">Status is not taken from the email. A new CAD incident starts as Draft.</p>
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
