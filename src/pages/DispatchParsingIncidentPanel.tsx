import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  getCadParsingConfig,
  patchCadParsingConfig,
} from "../api/cadDispatchConfig.ts";
import { getCadEmails, type CadEmailIngestRow } from "../api/cadEmails.ts";
import { applyIncidentNumberChart, deleteIncident, getIncidentList } from "../api/incidents.ts";
import { getDispatchPlainTextFromRawBody } from "../cadDispatch/extractDispatchPlainText.ts";
import {
  INCIDENT_LABEL_FIELDS,
  assignIncidentNumberChart,
  assignSectionToField,
  cadDispatchNumber,
  departmentCfsDigits,
  emailExcludedBySetup,
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

const CHART_EMAIL_PAGE = 200;
const CHART_EMAIL_CAP = 1000;

async function loadStoredCadEmails(): Promise<CadEmailIngestRow[]> {
  const all: CadEmailIngestRow[] = [];
  for (let offset = 0; offset < CHART_EMAIL_CAP; offset += CHART_EMAIL_PAGE) {
    const page = await getCadEmails(CHART_EMAIL_PAGE, offset);
    all.push(...page);
    if (page.length < CHART_EMAIL_PAGE) break;
  }
  return all;
}

type SaveSection = "setup" | "exclude" | "fields";

function CollapsibleSetupSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <article className="panel cad-dispatch-incident-card">
      <div className="panel-header collapsible-panel-header">
        <button
          type="button"
          className="collapsible-toggle"
          onClick={() => setIsOpen((previous) => !previous)}
          aria-expanded={isOpen}
        >
          <h2>{title}</h2>
          <ChevronDown size={16} className={`collapsible-icon ${isOpen ? "open" : ""}`} />
        </button>
      </div>
      {isOpen ? <div className="collapsible-panel-body">{children}</div> : null}
    </article>
  );
}

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
  const [savedSection, setSavedSection] = useState<SaveSection | null>(null);
  const [chartIncidents, setChartIncidents] = useState<Awaited<ReturnType<typeof getIncidentList>>>([]);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartBusy, setChartBusy] = useState(false);
  const [chartMessage, setChartMessage] = useState<string | null>(null);
  const [chartReload, setChartReload] = useState(0);

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
    loadStoredCadEmails()
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
  }, [saveOkAt, chartReload]);

  useEffect(() => {
    let cancelled = false;
    getIncidentList(true)
      .then((list) => {
        if (!cancelled) setChartIncidents(list);
      })
      .catch((e) => {
        if (!cancelled) setChartError(e instanceof Error ? e.message : "Failed to load incidents.");
      });
    return () => {
      cancelled = true;
    };
  }, [chartReload]);

  const selectedEmail = emails.find((row) => row.id === selectedEmailId) ?? emails[0] ?? null;
  const sampleText = selectedEmail
    ? (getDispatchPlainTextFromRawBody(selectedEmail.rawBody ?? "") ?? "")
    : "";
  const excludeSearchText = selectedEmail
    ? `${sampleText}\n${(selectedEmail.rawBody ?? "").replace(/<[^>]+>/g, " ")}`
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

  const sampleExcluded = useMemo(
    () =>
      emailExcludedBySetup(
        excludeSearchText,
        linesToPhrases(excludeText),
        linesToPhrases(exceptionText),
      ),
    [excludeSearchText, excludeText, exceptionText],
  );

  const chartRows = useMemo(() => {
    const exclude = linesToPhrases(excludeText);
    const exceptions = linesToPhrases(exceptionText);
    const calls = new Map<
      string,
      {
        dispatchNumber: string;
        cfs: string;
        incidentId: string;
        currentIncidentNumber: string;
        deleted: boolean;
        reportStatus: string;
      }
    >();
    for (const email of emails) {
      const plain = getDispatchPlainTextFromRawBody(email.rawBody ?? "") ?? "";
      const search = `${plain}\n${(email.rawBody ?? "").replace(/<[^>]+>/g, " ")}`;
      if (emailExcludedBySetup(search, exclude, exceptions)) continue;
      const dispatchNumber = cadDispatchNumber(plain, activeSeparator);
      if (!dispatchNumber) continue;
      const existing = calls.get(dispatchNumber);
      calls.set(dispatchNumber, {
        dispatchNumber,
        cfs: existing?.cfs || departmentCfsDigits(plain),
        incidentId: existing?.incidentId ?? "",
        currentIncidentNumber: existing?.currentIncidentNumber ?? "",
        deleted: existing?.deleted ?? false,
        reportStatus: existing?.reportStatus ?? "Draft",
      });
    }
    for (const incident of chartIncidents) {
      const dispatchNumber = incident.dispatchNumber?.trim() ?? "";
      if (!dispatchNumber) continue;
      const existing = calls.get(dispatchNumber);
      calls.set(dispatchNumber, {
        dispatchNumber,
        cfs: existing?.cfs ?? "",
        incidentId: incident.callNumber,
        currentIncidentNumber: incident.incidentNumber || "",
        deleted: Boolean(incident.deletedAt),
        reportStatus: incident.nerisReportStatus || "Draft",
      });
    }
    return assignIncidentNumberChart(
      [...calls.values()],
      new Date(),
      {
        month: resetMonth,
        day: resetDay,
        time: parseResetTime(resetTime) ? resetTime : DEFAULT_RESET_TIME,
      },
      incidentNumberFormat,
    );
  }, [
    emails,
    chartIncidents,
    excludeText,
    exceptionText,
    activeSeparator,
    resetMonth,
    resetDay,
    resetTime,
    incidentNumberFormat,
  ]);

  const handleDeleteChartRow = useCallback(async (incidentId: string) => {
    if (
      !window.confirm(
        "Delete this call? It will no longer use an incident number. Use Force update to renumber the remaining calls.",
      )
    ) {
      return;
    }
    setChartBusy(true);
    setChartError(null);
    setChartMessage(null);
    try {
      await deleteIncident(incidentId, { deletedReason: "Removed from the incident number table." });
      setChartReload((current) => current + 1);
    } catch (e) {
      setChartError(e instanceof Error ? e.message : "Could not delete that call.");
    } finally {
      setChartBusy(false);
    }
  }, []);

  const handleForceUpdate = useCallback(async () => {
    const updates = chartRows
      .filter(
        (row) =>
          row.incidentId &&
          !row.deleted &&
          row.proposedIncidentNumber &&
          row.proposedIncidentNumber !== row.currentIncidentNumber,
      )
      .map((row) => ({ incidentId: row.incidentId, incidentNumber: row.proposedIncidentNumber }));
    setChartBusy(true);
    setChartError(null);
    setChartMessage(null);
    try {
      const result = await applyIncidentNumberChart(updates);
      setChartMessage(
        `Updated ${result.updated} incident number${result.updated === 1 ? "" : "s"}. ${result.skipped} report${
          result.skipped === 1 ? "" : "s"
        } left unchanged because they are In Review or Exported.`,
      );
      setChartReload((current) => current + 1);
    } catch (e) {
      setChartError(e instanceof Error ? e.message : "Force update failed.");
    } finally {
      setChartBusy(false);
    }
  }, [chartRows]);

  const handleSave = useCallback(async (section: SaveSection) => {
    setSaveError(null);
    setSaveOkAt(null);
    setSavedSection(section);
    if (section === "setup" && !parseResetTime(resetTime)) {
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
        <CollapsibleSetupSection title="Incident number setup">
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
          <div className="cad-dispatch-incident-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSave("setup")}
              disabled={saveBusy}
            >
              {saveBusy && savedSection === "setup" ? "Saving…" : "Save"}
            </button>
          </div>
          {savedSection === "setup" && saveError ? <p className="field-error">{saveError}</p> : null}
          {savedSection === "setup" && saveOkAt !== null && !saveError ? (
            <p className="cad-dispatch-save-ok" role="status">
              Saved. The next dispatch email uses this incident number setup.
            </p>
          ) : null}
        </CollapsibleSetupSection>

        <CollapsibleSetupSection title="Exclude emails that contain">
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
          <div className="cad-dispatch-incident-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSave("exclude")}
              disabled={saveBusy}
            >
              {saveBusy && savedSection === "exclude" ? "Saving…" : "Save"}
            </button>
          </div>
          {savedSection === "exclude" && saveError ? <p className="field-error">{saveError}</p> : null}
          {savedSection === "exclude" && saveOkAt !== null && !saveError ? (
            <p className="cad-dispatch-save-ok" role="status">
              Saved. The next dispatch email uses this exclude list.
            </p>
          ) : null}
        </CollapsibleSetupSection>

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

        <CollapsibleSetupSection title="Match the email to incident fields">
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
          <div className="cad-dispatch-incident-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSave("fields")}
              disabled={saveBusy}
            >
              {saveBusy && savedSection === "fields" ? "Saving…" : "Save"}
            </button>
          </div>
          {savedSection === "fields" && saveError ? <p className="field-error">{saveError}</p> : null}
          {savedSection === "fields" && saveOkAt !== null && !saveError ? (
            <p className="cad-dispatch-save-ok" role="status">
              Saved. The next dispatch email uses these sections.
            </p>
          ) : null}
        </CollapsibleSetupSection>

        <CollapsibleSetupSection title="Preview from the sample email" defaultOpen>
          {!sampleText ? (
            <p className="panel-description">Choose an email with dispatch text to see the filled incident.</p>
          ) : sampleExcluded ? (
            <p className="panel-description">
              This email is excluded. It does not create or update an incident, and it is left out of the incident
              number table.
            </p>
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
        </CollapsibleSetupSection>

        <CollapsibleSetupSection title="Incident number table">
          <p className="panel-description">
            Calls are sorted by dispatch number. Deleted calls stay on the list with a blank incident number. Emails
            that match an exclude phrase are left out. Force update writes these incident numbers onto Draft incidents
            and Draft NERIS reports. In Review and Exported reports stay as they are.
          </p>
          {chartError ? <p className="field-error">{chartError}</p> : null}
          {chartRows.length === 0 ? (
            <p className="panel-description">No calls to number yet.</p>
          ) : (
            <table className="cad-incident-slot-table">
              <thead>
                <tr>
                  <th>Dispatch number</th>
                  <th>CFS</th>
                  <th>Incident number</th>
                  <th>Report</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {chartRows.map((row) => (
                  <tr key={row.dispatchNumber}>
                    <td>{row.dispatchNumber}</td>
                    <td>{row.cfs || "Not provided"}</td>
                    <td>
                      {row.deleted
                        ? "Deleted"
                        : row.proposedIncidentNumber}
                      {!row.deleted &&
                      row.currentIncidentNumber &&
                      row.currentIncidentNumber !== row.proposedIncidentNumber
                        ? ` (currently ${row.currentIncidentNumber})`
                        : ""}
                    </td>
                    <td>{row.incidentId ? row.reportStatus : "No incident yet"}</td>
                    <td>
                      {row.incidentId && !row.deleted ? (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={chartBusy}
                          onClick={() => void handleDeleteChartRow(row.incidentId)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="cad-dispatch-incident-actions">
            <button
              type="button"
              className="primary-button"
              disabled={chartBusy || chartRows.length === 0}
              onClick={() => void handleForceUpdate()}
            >
              {chartBusy ? "Updating…" : "Force update"}
            </button>
          </div>
          {chartMessage ? (
            <p className="cad-dispatch-save-ok" role="status">
              {chartMessage}
            </p>
          ) : null}
        </CollapsibleSetupSection>
      </section>
    </>
  );
}
