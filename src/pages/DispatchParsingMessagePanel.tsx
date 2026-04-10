import { useCallback, useEffect, useState } from "react";
import {
  getCadParsingConfig,
  patchCadParsingConfig,
} from "../api/cadDispatchConfig.ts";
import { getCadEmails, type CadEmailIngestRow } from "../api/cadEmails.ts";
import { getDispatchPlainTextFromRawBody } from "../cadDispatch/extractDispatchPlainText.ts";
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

function formatPreviewJson(result: CadRuleEngineResult): string {
  if (result.ok) {
    return JSON.stringify(
      { ok: true, text: result.text, slots: result.slots },
      null,
      2,
    );
  }
  return JSON.stringify(result, null, 2);
}

export function DispatchParsingMessagePanel() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rulesJson, setRulesJson] = useState<string>("[]");

  const [emails, setEmails] = useState<CadEmailIngestRow[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [emailsError, setEmailsError] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const [plainText, setPlainText] = useState("");
  const [previewResult, setPreviewResult] = useState<CadRuleEngineResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

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
        if (!cancelled) {
          setEmails(list);
          setSelectedEmailId((prev) => {
            if (prev && list.some((r) => r.id === prev)) return prev;
            return list[0]?.id ?? null;
          });
        }
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
  }, []);

  const selectedRow = emails.find((r) => r.id === selectedEmailId) ?? null;

  useEffect(() => {
    if (!selectedRow) {
      setPlainText("");
      setPreviewResult(null);
      setPreviewError(null);
      return;
    }
    const plain = getDispatchPlainTextFromRawBody(selectedRow.rawBody ?? "");
    setPlainText(plain ?? "");
    setPreviewResult(null);
    setPreviewError(null);
  }, [selectedRow]);

  const parseRulesFromEditor = useCallback((): CadRule[] => {
    const trimmed = rulesJson.trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed) as unknown;
    return parseCadRulesJson(parsed);
  }, [rulesJson]);

  const runPreview = useCallback(() => {
    setPreviewError(null);
    setPreviewResult(null);
    try {
      const rules = parseRulesFromEditor();
      const result = runCadRulePipeline(plainText, rules);
      setPreviewResult(result);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : String(e));
    }
  }, [parseRulesFromEditor, plainText]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveOkAt(null);
    let rules: CadRule[];
    try {
      rules = parseRulesFromEditor();
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
  }, [parseRulesFromEditor]);

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
            <p>Rules for the parsed dispatch string used for future member notifications and stored on each ingest.</p>
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
            Define <strong>message rules</strong> as a JSON array (same types as incident rules; see{" "}
            <code>src/cadDispatch/ruleEngine.ts</code>). On each CAD email ingest, the server runs these rules on
            extracted plain text and saves the result on the email row. Use <strong>Preview</strong> with a recent
            email below. <strong>Save</strong> persists config for this tenant.
          </p>
        </div>
      </header>

      <section className="cad-dispatch-h-top">
        <article className="panel cad-dispatch-incident-card">
          <div className="panel-header">
            <h2>Message rules (JSON array)</h2>
          </div>
          <textarea
            className="cad-dispatch-rules-textarea"
            spellCheck={false}
            value={rulesJson}
            onChange={(e) => setRulesJson(e.target.value)}
            rows={12}
            aria-label="Message rules JSON"
          />
          <div className="cad-dispatch-incident-actions">
            <button type="button" className="secondary-button" onClick={runPreview}>
              Preview
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
          {saveError ? <p className="field-error">{saveError}</p> : null}
          {saveOkAt !== null && !saveError ? (
            <p className="cad-dispatch-save-ok" role="status">
              Saved.
            </p>
          ) : null}
        </article>
      </section>

      <section className="cad-dispatch-h-lower">
        <div className="cad-dispatch-email-rail">
          <div className="panel-header cad-dispatch-email-rail-header">
            <h2>Recent emails</h2>
            <p className="panel-description cad-dispatch-email-rail-sub">
              Up to {EMAIL_LIST_LIMIT} newest (tenant-scoped).
            </p>
          </div>
          {emailsError ? <p className="field-error">{emailsError}</p> : null}
          {emailsLoading ? (
            <p className="panel-description">Loading…</p>
          ) : emails.length === 0 ? (
            <p className="panel-description">No stored CAD emails yet. Send a test message to your CAD address.</p>
          ) : (
            <ul className="cad-dispatch-email-rail-list">
              {emails.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={
                      row.id === selectedEmailId
                        ? "cad-dispatch-email-rail-item active"
                        : "cad-dispatch-email-rail-item"
                    }
                    onClick={() => setSelectedEmailId(row.id)}
                  >
                    <span className="cad-dispatch-email-rail-date">{formatRowDate(row.createdAt)}</span>
                    <span className="cad-dispatch-email-rail-from">{row.fromAddress || "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cad-dispatch-h-right">
          <div className="cad-dispatch-h-split">
            <article className="panel cad-dispatch-incident-card">
              <div className="panel-header">
                <h2>Dispatch plain text</h2>
              </div>
              <p className="panel-description">
                From the selected email (extracted MIME → plain). You can edit before preview.
              </p>
              <textarea
                className="cad-dispatch-rules-textarea"
                spellCheck={false}
                value={plainText}
                onChange={(e) => setPlainText(e.target.value)}
                rows={14}
                aria-label="Dispatch plain text for message preview"
              />
            </article>

            <div className="cad-dispatch-h-preview-stack">
              <article className="panel cad-dispatch-incident-card">
                <div className="panel-header">
                  <h2>Preview output</h2>
                </div>
                {previewError ? <p className="field-error">{previewError}</p> : null}
                {previewResult ? (
                  <pre className="cad-dispatch-preview-pre">{formatPreviewJson(previewResult)}</pre>
                ) : !previewError ? (
                  <p className="panel-description">Click Preview to run the message rule pipeline.</p>
                ) : null}
              </article>

              <article className="panel cad-dispatch-incident-card cad-dispatch-stored-ingest">
                <div className="panel-header">
                  <h2>Stored at ingest</h2>
                </div>
                <p className="panel-description">
                  Read-only: value saved when this email was received (current saved message rules).
                </p>
                {selectedRow?.parsedMessageText ? (
                  <pre className="cad-dispatch-preview-pre cad-dispatch-stored-pre">{selectedRow.parsedMessageText}</pre>
                ) : (
                  <p className="panel-description">Empty (no rules at ingest, or plain text could not be extracted).</p>
                )}
              </article>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
