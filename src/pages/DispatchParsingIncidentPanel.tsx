import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCadParsingConfig,
  patchCadParsingConfig,
} from "../api/cadDispatchConfig.ts";
import { getCadEmails, type CadEmailIngestRow } from "../api/cadEmails.ts";
import { CadRulePipelineEditor } from "../components/CadRulePipelineEditor.tsx";
import {
  CAD_INCIDENT_FIELD_OPTIONS,
  buildMappedIncidentFieldsPreview,
  extractMergeKeyFromSlots,
} from "../cadDispatch/incidentMappingPreview.ts";
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

type FieldMapRow = { slotKey: string; targetField: string };

function fieldMapToRows(map: Record<string, unknown> | undefined): FieldMapRow[] {
  if (!map || typeof map !== "object") return [{ slotKey: "", targetField: "" }];
  const entries = Object.entries(map).filter(
    ([k, v]) => k.trim() && typeof v === "string" && String(v).trim(),
  ) as [string, string][];
  if (entries.length === 0) return [{ slotKey: "", targetField: "" }];
  return entries.map(([slotKey, targetField]) => ({ slotKey, targetField }));
}

function rowsToFieldMap(rows: FieldMapRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.slotKey.trim();
    const v = r.targetField.trim();
    if (k && v) out[k] = v;
  }
  return out;
}

export function DispatchParsingIncidentPanel() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [enableIncidentCreation, setEnableIncidentCreation] = useState(false);
  const [rules, setRules] = useState<CadRule[]>([]);
  const rulesRef = useRef<CadRule[]>(rules);
  rulesRef.current = rules;

  const [fieldMapRows, setFieldMapRows] = useState<FieldMapRow[]>([{ slotKey: "", targetField: "" }]);
  const [mergeKeySlot, setMergeKeySlot] = useState("");

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
            return;
          }
          setFieldMapRows(fieldMapToRows(cfg.incidentFieldMap as Record<string, unknown> | undefined));
          const ext = cfg.incidentNumberExtract as { slot?: string } | null | undefined;
          setMergeKeySlot(
            ext && typeof ext === "object" && typeof ext.slot === "string" ? ext.slot : "",
          );
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

  const slotNameSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const row of fieldMapRows) {
      if (row.slotKey.trim()) s.add(row.slotKey.trim());
    }
    if (mergeKeySlot.trim()) s.add(mergeKeySlot.trim());
    for (const pv of Object.values(rowPreviews)) {
      if (pv.kind === "ok") {
        Object.keys(pv.slots).forEach((k) => s.add(k));
      }
    }
    return Array.from(s).sort();
  }, [fieldMapRows, mergeKeySlot, rowPreviews]);

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

  const fieldMapObject = useMemo(() => rowsToFieldMap(fieldMapRows), [fieldMapRows]);

  const mergeKeyExtract = useMemo(
    () => (mergeKeySlot.trim() ? { slot: mergeKeySlot.trim() } : null),
    [mergeKeySlot],
  );

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
        incidentFieldMap: fieldMapObject,
        incidentNumberExtract: mergeKeyExtract,
      });
      setSaveOkAt(Date.now());
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }, [enableIncidentCreation, rules, fieldMapObject, mergeKeyExtract]);

  const handlePreviewClick = useCallback(() => {
    runAllPreviews();
  }, [runAllPreviews]);

  const addFieldMapRow = useCallback(() => {
    setFieldMapRows((rows) => [...rows, { slotKey: "", targetField: "" }]);
  }, []);

  const updateFieldMapRow = useCallback((index: number, patch: Partial<FieldMapRow>) => {
    setFieldMapRows((rows) => {
      const next = rows.slice();
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const removeFieldMapRow = useCallback((index: number) => {
    setFieldMapRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  }, []);

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
            <p>Extract slots from dispatch text, map them to incident fields, set merge key.</p>
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
            <strong>Message Parsing</strong> controls how text is shown to members. <strong>Incident Parsing</strong>{" "}
            is different: rules extract <strong>named slots</strong> from the email, then you map those slots to{" "}
            <strong>incident fields</strong> and choose which slot holds the CAD / merge number. Preview shows what
            would be written to a draft incident — not a reformatted message.
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
            <h2>Extraction rules (named slots)</h2>
          </div>
          <p className="panel-description">
            These rules run on the same dispatch plain text as Raw Email. Use <strong>Extract</strong> steps to fill
            slot names (e.g. <code>cfs</code>, <code>address</code>). Those names are used in the mapping below — not
            for changing display text like Message Parsing.
          </p>
          <CadRulePipelineEditor
            rules={rules}
            onChange={setRules}
            presetCatalog={INCIDENT_RULE_PACKS}
            presetCatalogLabel="Insert extraction preset"
          />
        </article>

        <article className="panel cad-dispatch-incident-card">
          <div className="panel-header">
            <h2>Merge key (incident / CAD number)</h2>
          </div>
          <p className="panel-description">
            Which <strong>slot</strong> contains the unique call number used to match updates to the same incident? If
            empty, ingest falls back to slots named <code>cfs</code> or <code>incidentNumber</code>.
          </p>
          <label className="cad-dispatch-merge-key-label">
            <span>Slot name for merge key</span>
            <input
              type="text"
              className="cad-dispatch-merge-key-input"
              list="cad-incident-slot-suggestions"
              value={mergeKeySlot}
              onChange={(e) => setMergeKeySlot(e.target.value)}
              placeholder="e.g. cfs"
              aria-label="Slot name for incident merge key"
            />
          </label>
          <datalist id="cad-incident-slot-suggestions">
            {slotNameSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </article>

        <article className="panel cad-dispatch-incident-card">
          <div className="panel-header cad-dispatch-field-map-header">
            <h2>Map slots → incident fields</h2>
            <button type="button" className="secondary-button small-button" onClick={addFieldMapRow}>
              Add mapping
            </button>
          </div>
          <p className="panel-description">
            For each row, the <strong>slot name</strong> must match a slot produced by your extraction rules. The{" "}
            <strong>incident field</strong> is the column on the incident record in FireUltimate (same as server ingest).
          </p>
          <div className="cad-incident-field-map-table-wrap">
            <table className="cad-incident-field-map-table">
              <thead>
                <tr>
                  <th scope="col">Slot name</th>
                  <th scope="col">Incident field</th>
                  <th scope="col" aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {fieldMapRows.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="text"
                        className="cad-dispatch-merge-key-input"
                        list="cad-incident-slot-suggestions"
                        value={row.slotKey}
                        onChange={(e) => updateFieldMapRow(index, { slotKey: e.target.value })}
                        placeholder="slot from rules"
                        aria-label={`Slot name ${index + 1}`}
                      />
                    </td>
                    <td>
                      <select
                        className="cad-dispatch-merge-key-input"
                        value={row.targetField}
                        onChange={(e) => updateFieldMapRow(index, { targetField: e.target.value })}
                        aria-label={`Incident field for ${index + 1}`}
                      >
                        <option value="">— Select field —</option>
                        {CAD_INCIDENT_FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cad-rule-pipeline-icon-btn cad-rule-pipeline-remove"
                        aria-label="Remove mapping row"
                        disabled={fieldMapRows.length <= 1}
                        onClick={() => removeFieldMapRow(index)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel cad-dispatch-incident-card">
          <div className="cad-dispatch-incident-actions cad-dispatch-incident-save-row">
            <button
              type="button"
              className="secondary-button"
              onClick={handlePreviewClick}
              disabled={previewBusy || emailsLoading}
            >
              {previewBusy ? "Updating preview…" : "Preview"}
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
          <h2>Incident preview (from recent emails)</h2>
          <p className="panel-description cad-dispatch-email-rail-sub">
            After extraction rules run, values below show <strong>slots</strong>, the <strong>merge key</strong>, and{" "}
            <strong>mapped incident fields</strong> as ingest would apply them (draft create/update — not message
            display).
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
              return (
                <article key={row.id} className="panel cad-dispatch-incident-preview-card">
                  <div className="cad-dispatch-message-row-meta">
                    <span className="cad-dispatch-message-row-date">{formatRowDate(row.createdAt)}</span>
                    <span className="cad-dispatch-message-row-from">{row.fromAddress || "—"}</span>
                  </div>
                  {!pv ? (
                    <p className="panel-description">—</p>
                  ) : pv.kind === "error" ? (
                    <p className="field-error">{pv.message}</p>
                  ) : (
                    <IncidentEmailPreviewBody
                      slots={pv.slots}
                      pipelineText={pv.text}
                      fieldMap={fieldMapObject}
                      mergeKeyExtract={mergeKeyExtract}
                    />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function IncidentEmailPreviewBody({
  slots,
  pipelineText,
  fieldMap,
  mergeKeyExtract,
}: {
  slots: Record<string, string>;
  pipelineText: string;
  fieldMap: Record<string, string>;
  mergeKeyExtract: { slot: string } | null;
}) {
  const mergeKey = extractMergeKeyFromSlots(slots, mergeKeyExtract);
  const mapped = buildMappedIncidentFieldsPreview(slots, fieldMap, pipelineText);

  return (
    <div className="cad-incident-preview-body">
      <div className="cad-incident-preview-block">
        <h3 className="cad-dispatch-message-row-h">Extracted slots</h3>
        {Object.keys(slots).length === 0 ? (
          <p className="panel-description">No slots yet — add extract rules above.</p>
        ) : (
          <table className="cad-incident-slot-table">
            <tbody>
              {Object.entries(slots).map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{v || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="cad-incident-preview-block">
        <h3 className="cad-dispatch-message-row-h">Merge key (incident number)</h3>
        {mergeKey ? (
          <p className="cad-incident-merge-key-value">{mergeKey}</p>
        ) : (
          <p className="field-error">
            Missing — set a merge key slot or extract <code>cfs</code> / <code>incidentNumber</code>.
          </p>
        )}
      </div>
      <div className="cad-incident-preview-block">
        <h3 className="cad-dispatch-message-row-h">Would apply to incident</h3>
        {Object.keys(mapped).length === 0 ? (
          <p className="panel-description">No mapped fields yet — add slot → field rows above.</p>
        ) : (
          <table className="cad-incident-slot-table">
            <tbody>
              {Object.entries(mapped).map(([field, val]) => (
                <tr key={field}>
                  <th scope="row">{field}</th>
                  <td>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
