import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCadParsingConfig,
  patchCadParsingConfig,
} from "../api/cadDispatchConfig.ts";
import { getCadEmails, type CadEmailIngestRow } from "../api/cadEmails.ts";
import { CadDispatchRulePacksSection } from "../components/CadDispatchRulePacksSection.tsx";
import { getDispatchPlainTextFromRawBody } from "../cadDispatch/extractDispatchPlainText.ts";
import { MESSAGE_RULE_PACKS } from "../cadDispatch/rulePresets.ts";
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

export function DispatchParsingMessagePanel() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rulesJson, setRulesJson] = useState<string>("[]");
  const rulesJsonRef = useRef(rulesJson);
  rulesJsonRef.current = rulesJson;

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
          setRulesJson(JSON.stringify(cfg.messageRules ?? [], null, 2));
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

  const parseRulesFromRef = useCallback((): CadRule[] => {
    const trimmed = rulesJsonRef.current.trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed) as unknown;
    return parseCadRulesJson(parsed);
  }, []);

  const runAllPreviews = useCallback(() => {
    setBatchError(null);
    setPreviewBusy(true);
    let rules: CadRule[];
    try {
      rules = parseRulesFromRef();
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
      const result: CadRuleEngineResult = runCadRulePipeline(plain, rules);
      if (result.ok) {
        next[row.id] = { kind: "ok", text: result.text, slots: result.slots };
      } else {
        next[row.id] = { kind: "error", message: result.error ?? "Rule pipeline failed." };
      }
    }
    setRowPreviews(next);
    setPreviewBusy(false);
  }, [emails, parseRulesFromRef]);

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
    let rules: CadRule[];
    try {
      const trimmed = rulesJson.trim();
      const parsed = JSON.parse(trimmed || "[]") as unknown;
      rules = parseCadRulesJson(parsed);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      return;
    }
    setSaveBusy(true);
    try {
      await patchCadParsingConfig({ messageRules: rules });
      setSaveOkAt(Date.now());
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }, [rulesJson]);

  const handlePreviewClick = useCallback(() => {
    runAllPreviews();
  }, [runAllPreviews]);

  if (loading) {
    return (
      <header className="page-header dispatch-parsing-module-header">
        <div>
          <h1>Message Parsing</h1>
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
            <h1>Message Parsing</h1>
            <p>Rules for the parsed dispatch string used for member notifications and stored on each ingest.</p>
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
          <h1>Message Parsing</h1>
          <p>
            Select <strong>rule packs</strong> we ship with the product, then <strong>Apply selected packs</strong>.{" "}
            <strong>Preview</strong> runs those rules on up to {EMAIL_LIST_LIMIT} recent emails:{" "}
            <strong>Dispatch content</strong> (same as Raw Email) on the left, <strong>After rules</strong> on the right.{" "}
            <strong>Save</strong> persists rules for this tenant. Ingest stores the message result on each email row.
          </p>
        </div>
      </header>

      <section className="cad-dispatch-h-top">
        <article className="panel cad-dispatch-incident-card">
          <div className="panel-header">
            <h2>Message rules</h2>
          </div>
          <CadDispatchRulePacksSection
            packs={MESSAGE_RULE_PACKS}
            rulesJson={rulesJson}
            onRulesJsonChange={setRulesJson}
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
          <h2>Recent emails</h2>
          <p className="panel-description cad-dispatch-email-rail-sub">
            Up to {EMAIL_LIST_LIMIT} newest. Left column matches <strong>Raw Email → Dispatch content (for parsing)</strong>
            . Right column is the pipeline output after your rules. Previews refresh when the list loads and when you
            click Preview.
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
                      <h3 className="cad-dispatch-message-row-h">Dispatch content (for parsing)</h3>
                      {dispatchPlain ? (
                        <pre className="cad-dispatch-preview-plain">{dispatchPlain}</pre>
                      ) : (
                        <p className="panel-description">Could not extract plain text (see Raw Email for MIME).</p>
                      )}
                    </div>
                    <div className="cad-dispatch-message-row-col">
                      <h3 className="cad-dispatch-message-row-h">After rules (preview)</h3>
                      {!pv ? (
                        <p className="panel-description">—</p>
                      ) : pv.kind === "error" ? (
                        <p className="field-error">{pv.message}</p>
                      ) : (
                        <>
                          <pre className="cad-dispatch-preview-plain">{pv.text}</pre>
                          {formatSlotsPlain(pv.slots) ? (
                            <div className="cad-dispatch-slots-plain" aria-label="Extracted slots">
                              <div className="cad-dispatch-message-row-h-sub">Extracted</div>
                              <pre className="cad-dispatch-preview-plain cad-dispatch-slots-pre">
                                {formatSlotsPlain(pv.slots)}
                              </pre>
                            </div>
                          ) : null}
                        </>
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
