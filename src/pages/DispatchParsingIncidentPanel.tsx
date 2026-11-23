import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  getCadParsingConfig,
  patchCadParsingConfig,
} from "../api/cadDispatchConfig.ts";
import { getCadEmails, type CadEmailIngestRow } from "../api/cadEmails.ts";
import { applyIncidentNumberChart, deleteIncident, getIncidentList, importIncidentNumberChart } from "../api/incidents.ts";
import { getDispatchPlainTextFromRawBody } from "../cadDispatch/extractDispatchPlainText.ts";
import {
  INCIDENT_LABEL_FIELDS,
  assignIncidentNumberChart,
  assignSectionToField,
  chartRowsNewestFirst,
  cadDispatchNumber,
  departmentCfsDigits,
  emailExcludedBySetup,
  buildIncidentLabelConfig,
  emptyIncidentLabels,
  DEFAULT_CAD_TIME_MAP,
  DEFAULT_INCIDENT_NUMBER_FORMAT,
  DEFAULT_RESET_DAY,
  DEFAULT_RESET_MONTH,
  DEFAULT_RESET_TIME,
  fieldIdForSection,
  followUpCallNumber,
  incidentNumberFormatFromExtract,
  incidentNumberOverridesFromExtract,
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
  timeMapFromExtract,
  type CadTimeMap,
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

type SaveSection = "setup" | "exclude" | "times" | "automation" | "fields";

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
  const [enableIncidentUpdate, setEnableIncidentUpdate] = useState(false);
  const [timeMap, setTimeMap] = useState<CadTimeMap>({ ...DEFAULT_CAD_TIME_MAP });
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
  const [numberEdits, setNumberEdits] = useState<Record<string, string>>({});
  const [savedOverrides, setSavedOverrides] = useState<Record<string, string>>({});
  const chartFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getCadParsingConfig()
      .then((cfg) => {
        if (cancelled) return;
        setEnableIncidentCreation(cfg.enableIncidentCreation);
        setEnableIncidentUpdate(
          typeof cfg.enableIncidentUpdate === "boolean" ? cfg.enableIncidentUpdate : cfg.enableIncidentCreation,
        );
        setTimeMap(timeMapFromExtract(cfg.incidentNumberExtract));
        setSavedOverrides(incidentNumberOverridesFromExtract(cfg.incidentNumberExtract));
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

  const tableRows = useMemo(() => chartRowsNewestFirst(chartRows), [chartRows]);

  const numberInBox = useCallback(
    (row: (typeof chartRows)[number]) => {
      if (row.deleted) return "";
      if (Object.prototype.hasOwnProperty.call(numberEdits, row.dispatchNumber)) {
        return numberEdits[row.dispatchNumber];
      }
      return savedOverrides[row.dispatchNumber] || row.proposedIncidentNumber;
    },
    [numberEdits, savedOverrides],
  );

  const overridesFromBoxes = useCallback(
    (exceptDispatchNumber = "") =>
      chartRows.flatMap((row) => {
        if (row.deleted || row.dispatchNumber === exceptDispatchNumber) return [];
        const typed = numberInBox(row).trim();
        if (!typed || typed === row.proposedIncidentNumber) return [];
        return [{ dispatchNumber: row.dispatchNumber, incidentNumber: typed }];
      }),
    [chartRows, numberInBox],
  );

  const handleDeleteChartRow = useCallback(async (incidentId: string, dispatchNumber: string) => {
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
      const overrides = overridesFromBoxes(dispatchNumber);
      await applyIncidentNumberChart([], overrides);
      setSavedOverrides(Object.fromEntries(overrides.map((item) => [item.dispatchNumber, item.incidentNumber])));
      setNumberEdits({});
      setChartReload((current) => current + 1);
    } catch (e) {
      setChartError(e instanceof Error ? e.message : "Could not delete that call.");
    } finally {
      setChartBusy(false);
    }
  }, [overridesFromBoxes]);

  const handleForceUpdate = useCallback(async () => {
    const updates = chartRows.flatMap((row) => {
      if (!row.incidentId || row.deleted) return [];
      if (row.reportStatus === "In Review" || row.reportStatus === "Exported") return [];
      const typed = numberInBox(row).trim();
      if (!typed || typed === row.currentIncidentNumber) return [];
      return [{ incidentId: row.incidentId, incidentNumber: typed }];
    });
    const overrides = overridesFromBoxes();
    setChartBusy(true);
    setChartError(null);
    setChartMessage(null);
    try {
      const result = await applyIncidentNumberChart(updates, overrides);
      setSavedOverrides(Object.fromEntries(overrides.map((item) => [item.dispatchNumber, item.incidentNumber])));
      setNumberEdits({});
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
  }, [chartRows, numberInBox, overridesFromBoxes]);

  const handleExportChart = useCallback(() => {
    const payload = {
      version: 1,
      rows: tableRows.map((row) => ({
        dispatchNumber: row.dispatchNumber,
        cfs: row.cfs,
        incidentNumber: row.deleted ? "" : numberInBox(row).trim(),
        deleted: row.deleted,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "incident-number-chart.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [tableRows, numberInBox]);

  const handleImportChart = useCallback(async (file: File) => {
    setChartBusy(true);
    setChartError(null);
    setChartMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as { rows?: unknown };
      if (!Array.isArray(parsed.rows)) {
        throw new Error("That file is not an incident number chart.");
      }
      const result = await importIncidentNumberChart(parsed.rows);
      const imported: Record<string, string> = {};
      for (const item of parsed.rows) {
        if (!item || typeof item !== "object") continue;
        const row = item as { dispatchNumber?: unknown; incidentNumber?: unknown; deleted?: unknown };
        const dispatchNumber = String(row.dispatchNumber ?? "").trim();
        const incidentNumber = String(row.incidentNumber ?? "").trim();
        if (!dispatchNumber || !incidentNumber || row.deleted) continue;
        imported[dispatchNumber] = incidentNumber;
      }
      setSavedOverrides(imported);
      setNumberEdits({});
      setChartMessage(
        `Imported ${result.created} new call${result.created === 1 ? "" : "s"}, updated ${result.updated}, removed ${
          result.removed
        }. ${result.skipped} report${result.skipped === 1 ? "" : "s"} left unchanged because they are In Review or Exported.`,
      );
      setChartReload((current) => current + 1);
    } catch (e) {
      setChartError(e instanceof Error ? e.message : "Could not import that chart.");
    } finally {
      setChartBusy(false);
    }
  }, []);

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
        timeMap,
        incidentNumberOverrides: savedOverrides,
      },
    );
    setSaveBusy(true);
    try {
      await patchCadParsingConfig({
        enableIncidentCreation,
        enableIncidentUpdate,
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
    enableIncidentUpdate,
    timeMap,
    savedOverrides,
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
          <div className="cad-setup-field-row">
            <label className="cad-allowlist-field">
              How are sections or fields separated from CAD?
              <input
                className="cad-dispatch-merge-key-input"
                type="text"
                maxLength={1}
                value={separator}
                aria-label="Character that separates CAD sections"
                onChange={(event) => setSeparator(event.target.value)}
              />
            </label>
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
                className="cad-dispatch-merge-key-input"
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
          </div>
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
          <p className="panel-description">One phrase per line.</p>
          <div className="cad-exclude-field-row">
            <label className="cad-allowlist-field">
              Exclude emails that contain the phrases
              <textarea
                className="cad-dispatch-merge-key-input"
                rows={3}
                value={excludeText}
                aria-label="Phrases that exclude an email"
                onChange={(event) => setExcludeText(event.target.value)}
              />
            </label>
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
          </div>
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

        <CollapsibleSetupSection title="Call times">
          <p className="panel-description">
            Type the label exactly as it appears before the date in the email. Leave a box blank to skip that time.
            Blank times on a Draft report are filled. Times someone already entered stay as they are. Only units in
            Department Apparatus are added.
          </p>
          <div className="cad-exclude-field-row">
            {(
              [
                ["callCreated", "Call created"],
                ["callClosed", "Call closed"],
                ["unitDispatch", "Unit dispatch"],
                ["unitEnroute", "Unit en route"],
                ["unitOnScene", "Unit on scene"],
                ["unitClear", "Unit clear"],
              ] as const
            ).map(([key, label]) => (
              <label className="cad-allowlist-field" key={key}>
                {label}
                <input
                  className="cad-dispatch-merge-key-input"
                  type="text"
                  value={timeMap[key]}
                  aria-label={label}
                  onChange={(event) =>
                    setTimeMap((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="cad-dispatch-incident-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSave("times")}
              disabled={saveBusy}
            >
              {saveBusy && savedSection === "times" ? "Saving…" : "Save"}
            </button>
          </div>
          {savedSection === "times" && saveError ? <p className="field-error">{saveError}</p> : null}
          {savedSection === "times" && saveOkAt !== null && !saveError ? (
            <p className="cad-dispatch-save-ok" role="status">
              Saved. The next dispatch email fills blank call times from these labels.
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
            <span>Create a draft incident when a new dispatch email arrives</span>
          </label>
          <label className="cad-dispatch-checkbox-label">
            <input
              type="checkbox"
              checked={enableIncidentUpdate}
              onChange={(e) => setEnableIncidentUpdate(e.target.checked)}
            />
            <span>Update the matching draft incident when a follow-up email arrives</span>
          </label>
          <div className="cad-dispatch-incident-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSave("automation")}
              disabled={saveBusy}
            >
              {saveBusy && savedSection === "automation" ? "Saving…" : "Save"}
            </button>
          </div>
          {savedSection === "automation" && saveError ? <p className="field-error">{saveError}</p> : null}
          {savedSection === "automation" && saveOkAt !== null && !saveError ? (
            <p className="cad-dispatch-save-ok" role="status">
              Saved. The next dispatch email uses these create and update switches.
            </p>
          ) : null}
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
            The newest dispatch number is at the top. The first incident number of the year still belongs to the
            earliest call. Type the incident number you want, then Force update. That writes the box onto Draft
            incidents and Draft NERIS reports. In Review and Exported reports stay as they are. A number you type is
            kept when the next email arrives.
          </p>
          <p className="panel-description">
            Export saves this table only: dispatch number, CFS, the incident number in the box, and whether the call
            was deleted. It does not include the email, address, notes, or NERIS report. Importing that file on
            production reserves those incident numbers. The call details appear there when production receives its own
            CAD email. Mail stays pointed at staging.
          </p>
          {chartError ? <p className="field-error">{chartError}</p> : null}
          {tableRows.length === 0 ? (
            <p className="panel-description">No calls to number yet.</p>
          ) : (
            <table className="cad-incident-slot-table cad-incident-number-table">
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
                {tableRows.map((row) => {
                  const locked = row.reportStatus === "In Review" || row.reportStatus === "Exported";
                  const typed = numberInBox(row);
                  return (
                    <tr key={row.dispatchNumber}>
                      <td>{row.dispatchNumber}</td>
                      <td>{row.cfs || "Not provided"}</td>
                      <td>
                        {row.deleted ? (
                          "Deleted"
                        ) : (
                          <input
                            className="cad-dispatch-merge-key-input cad-incident-number-input"
                            type="text"
                            value={typed}
                            aria-label={`Incident number for dispatch ${row.dispatchNumber}`}
                            disabled={chartBusy || locked}
                            onChange={(event) =>
                              setNumberEdits((current) => ({
                                ...current,
                                [row.dispatchNumber]: event.target.value,
                              }))
                            }
                          />
                        )}
                        {!row.deleted && row.currentIncidentNumber && row.currentIncidentNumber !== typed
                          ? ` Saved as ${row.currentIncidentNumber}`
                          : ""}
                      </td>
                      <td>{row.incidentId ? row.reportStatus : "No incident yet"}</td>
                      <td>
                        {row.incidentId && !row.deleted ? (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={chartBusy}
                            onClick={() => void handleDeleteChartRow(row.incidentId, row.dispatchNumber)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="cad-dispatch-incident-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={chartBusy || chartRows.length === 0}
              onClick={handleExportChart}
            >
              Export
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={chartBusy}
              onClick={() => chartFileRef.current?.click()}
            >
              Import
            </button>
            <input
              ref={chartFileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleImportChart(file);
              }}
            />
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
