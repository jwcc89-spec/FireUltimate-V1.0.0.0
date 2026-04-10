import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCadParsingConfig,
  patchCadParsingConfig,
} from "../api/cadDispatchConfig.ts";
import { getCadEmails, type CadEmailIngestRow } from "../api/cadEmails.ts";
import { CadRulePipelineEditor } from "../components/CadRulePipelineEditor.tsx";
import { getDispatchPlainTextFromRawBody } from "../cadDispatch/extractDispatchPlainText.ts";
import { INCIDENT_RULE_PACKS } from "../cadDispatch/rulePresets.ts";
import {
  parseCadRulesJson,
  runCadRulePipeline,
  type CadRule,
  type CadRuleEngineResult,
} from "../cadDispatch/ruleEngine.ts";

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

type RowPreviewState =
  | { kind: "ok"; text: string; slots: Record<string, string> }
  | { kind: "error"; message: string };

function formatSlotsPlain(slots: Record<string, string>): string {
  const keys = Object.keys(slots);
  if (keys.length === 0) return "";
  return keys.map((k) => `${k}: ${slots[k] ?? ""}`).join("\n");
}

function formatParsedOutput(text: string, slots: Record<string, string>): string {
  const slotLines = formatSlotsPlain(slots);
  if (!slotLines) return text;
  return `${text}\n\n${slotLines}`;
}

export function DispatchParsingIncidentPanel() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [enableIncidentCreation, setEnableIncidentCreation] = useState(false);
  const [rules, setRules] = useState<CadRule[]>([]);
  const rulesRef = useRef<CadRule[]>(rules);
  rulesRef.current = rules;

  const [emails, setEmails] = useState<CadEmailIngestRow[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [emailsError, setEmailsError] = useState<string | null>(null);

  const [rowPreviews, setRowPreviews] = useState<Record<string, RowPreviewState>>({});
  const [batchError, setBatchError] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveOkAt, setSaveOkAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getCadParsingConfig()
      .then((cfg) => {
        if (!cancelled) {
          setEnableIncidentCreation(cfg.enableIncidentCreation);
          try {
            setRules(parseCadRulesJson(JSON.parse(JSON.stringify(cfg.incidentRules ?? []))));
          } catch (e) {
            setLoadError(e instanceof Error ? e.message : "Invalid saved incident rules.");
          }
        }
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
        if (!cancelled) setEmails(list);
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

  const runAllPreviews = useCallback(() => {
    setBatchError(null);
    setPreviewBusy(true);
    let pipeline: CadRule[];
    try {
      pipeline = parseCadRulesJson(JSON.parse(JSON.stringify(rulesRef.current)));
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : String(e));
      setPreviewBusy(false);
      return;
    }

    const next: Record<string, RowPreviewState> = {};
    for (const row of emails) {
      const plain = getDispatchPlainTextFromRawBody(row.rawBody ?? "");
      if (!plain) {
        next[row.id] = {
          kind: "error",
          message: "Could not extract dispatch plain text from this email.",
        };
        continue;
      }
      const result: CadRuleEngineResult = runCadRulePipeline(plain, pipeline);
      if (result.ok) {
        next[row.id] = { kind: "ok", text: result.text, slots: result.slots };
      } else {
        next[row.id] = { kind: "error", message: result.error ?? "Rule pipeline failed." };
      }
    }
    setRowPreviews(next);
    setPreviewBusy(false);
  }, [emails]);

  useEffect(() => {
    if (emailsLoading || loading) return;
    if (emails.length === 0) {
      setRowPreviews({});
      return;
    }
    runAllPreviews();
  }, [emailsLoading, loading, emails, runAllPreviews]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveOkAt(null);
    let normalized: CadRule[];
    try {
      normalized = parseCadRulesJson(JSON.parse(JSON.stringify(rules)));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      return;
    }
    setSaveBusy(true);
    try {
      await patchCadParsingConfig({
        enableIncidentCreation,
        incidentRules: normalized,
      });
      setSaveOkAt(Date.now());
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }, [enableIncidentCreation, rules]);

  const handlePreviewClick = useCallback(() => {
    runAllPreviews();
  }, [runAllPreviews]);

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
            <p>Map dispatch text into incident fields using ordered rules.</p>
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
            Build the <strong>incident</strong> rule pipeline with the dropdown (add, reorder, delete). Preview shows{" "}
            <strong>Original text</strong> vs one <strong>Parsed text</strong> box. <strong>Save</strong> persists
            config; ingest uses it when automatic incident creation is on.
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
            <span>Enable automatic incident creation from CAD dispatch (when ingest applies rules)</span>
          </label>
        </article>

        <article className="panel cad-dispatch-incident-card">
          <div className="panel-header">
            <h2>Incident rules</h2>
          </div>
          <CadRulePipelineEditor
            rules={rules}
            onChange={setRules}
            presetCatalog={INCIDENT_RULE_PACKS}
            presetCatalogLabel="Insert preset pack"
          />
          <div className="cad-dispatch-incident-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handlePreviewClick}
              disabled={previewBusy || emailsLoading}
            >
              {previewBusy ? "Updating previews…" : "Preview"}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSave()}
              disabled={saveBusy}
            >
              {saveBusy ? "Saving…" : "Save"}
            </button>
          </div>
          {batchError ? <p className="field-error">{batchError}</p> : null}
          {saveError ? <p className="field-error">{saveError}</p> : null}
          {saveOkAt !== null && !saveError ? (
            <p className="cad-dispatch-save-ok" role="status">
              Saved.
            </p>
          ) : null}
        </article>
      </section>

      <section className="cad-dispatch-message-batch-section">
        <div className="panel-header cad-dispatch-message-batch-header">
          <h2>Live preview</h2>
          <p className="panel-description cad-dispatch-email-rail-sub">
            Original = dispatch plain text. Parsed = one box (result + extracted slot lines).
          </p>
        </div>
        {emailsError ? <p className="field-error">{emailsError}</p> : null}
        {emailsLoading ? (
          <p className="panel-description">Loading…</p>
        ) : emails.length === 0 ? (
          <p className="panel-description">No stored CAD emails yet. Send a test message to your CAD address.</p>
        ) : (
          <div className="cad-dispatch-message-batch-list">
            {emails.map((row) => {
              const pv = rowPreviews[row.id];
              const dispatchPlain = getDispatchPlainTextFromRawBody(row.rawBody ?? "");
              return (
                <article key={row.id} className="panel cad-dispatch-message-row-card">
                  <div className="cad-dispatch-message-row-meta">
                    <span className="cad-dispatch-message-row-date">{formatRowDate(row.createdAt)}</span>
                    <span className="cad-dispatch-message-row-from">{row.fromAddress || "—"}</span>
                  </div>
                  <div className="cad-dispatch-message-row-columns">
                    <div className="cad-dispatch-message-row-col">
                      <h3 className="cad-dispatch-message-row-h">Original text</h3>
                      {dispatchPlain ? (
                        <pre className="cad-dispatch-preview-plain">{dispatchPlain}</pre>
                      ) : (
                        <p className="panel-description">Could not extract plain text (see Raw Email for MIME).</p>
                      )}
                    </div>
                    <div className="cad-dispatch-message-row-col">
                      <h3 className="cad-dispatch-message-row-h">Parsed text</h3>
                      {!pv ? (
                        <p className="panel-description">—</p>
                      ) : pv.kind === "error" ? (
                        <p className="field-error">{pv.message}</p>
                      ) : (
                        <pre className="cad-dispatch-preview-plain cad-dispatch-preview-single-box">
                          {formatParsedOutput(pv.text, pv.slots)}
                        </pre>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
