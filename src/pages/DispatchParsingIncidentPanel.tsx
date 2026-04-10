import { useCallback, useEffect, useState } from "react";
import {
  getCadParsingConfig,
  patchCadParsingConfig,
} from "../api/cadDispatchConfig.ts";
import { getCadEmails } from "../api/cadEmails.ts";
import { getDispatchPlainTextFromRawBody } from "../cadDispatch/extractDispatchPlainText.ts";
import { ICOMM_FIXTURE_INITIAL_DISPATCH } from "../cadDispatch/icommFixtures.ts";
import {
  parseCadRulesJson,
  runCadRulePipeline,
  type CadRule,
  type CadRuleEngineResult,
} from "../cadDispatch/ruleEngine.ts";

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

export function DispatchParsingIncidentPanel() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [enableIncidentCreation, setEnableIncidentCreation] = useState(false);
  const [rulesJson, setRulesJson] = useState<string>("[]");
  const [sampleText, setSampleText] = useState(ICOMM_FIXTURE_INITIAL_DISPATCH);

  const [previewResult, setPreviewResult] = useState<CadRuleEngineResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveOkAt, setSaveOkAt] = useState<number | null>(null);

  const [loadFromEmailBusy, setLoadFromEmailBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getCadParsingConfig()
      .then((cfg) => {
        if (cancelled) return;
        setEnableIncidentCreation(cfg.enableIncidentCreation);
        setRulesJson(JSON.stringify(cfg.incidentRules ?? [], null, 2));
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
      const result = runCadRulePipeline(sampleText, rules);
      setPreviewResult(result);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : String(e));
    }
  }, [parseRulesFromEditor, sampleText]);

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
      await patchCadParsingConfig({
        enableIncidentCreation,
        incidentRules: rules,
      });
      setSaveOkAt(Date.now());
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }, [enableIncidentCreation, parseRulesFromEditor]);

  const loadFromLatestEmail = useCallback(async () => {
    setLoadFromEmailBusy(true);
    setPreviewError(null);
    try {
      const list = await getCadEmails(1, 0);
      const row = list[0];
      if (!row) {
        setPreviewError("No CAD emails in storage yet. Send a test email or use the sample text.");
        return;
      }
      const plain = getDispatchPlainTextFromRawBody(row.rawBody ?? "");
      if (!plain) {
        setPreviewError("Could not extract plain text from the latest email. Paste text manually.");
        return;
      }
      setSampleText(plain);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Failed to load latest email.");
    } finally {
      setLoadFromEmailBusy(false);
    }
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
            <p>Map dispatch text into incident fields using ordered rules. Preview runs in the browser only until ingest is wired (later batch).</p>
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
            Define <strong>incident rules</strong> as a JSON array (see <code>src/cadDispatch/ruleEngine.ts</code>{" "}
            for rule types). Use <strong>Preview</strong> to test against sample dispatch text. <strong>Save</strong>{" "}
            stores config for this tenant; ingest will use it in a later batch.
          </p>
        </div>
      </header>

      <section className="cad-dispatch-incident-layout">
        <div className="cad-dispatch-incident-column">
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
              <h2>Incident rules (JSON array)</h2>
            </div>
            <textarea
              className="cad-dispatch-rules-textarea"
              spellCheck={false}
              value={rulesJson}
              onChange={(e) => setRulesJson(e.target.value)}
              rows={14}
              aria-label="Incident rules JSON"
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
        </div>

        <div className="cad-dispatch-incident-column">
          <article className="panel cad-dispatch-incident-card">
            <div className="panel-header">
              <h2>Sample dispatch text</h2>
            </div>
            <p className="panel-description">
              Paste dispatch body text or load the built-in sample / latest stored email.
            </p>
            <div className="cad-dispatch-incident-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSampleText(ICOMM_FIXTURE_INITIAL_DISPATCH)}
              >
                Load ICOMM sample
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void loadFromLatestEmail()}
                disabled={loadFromEmailBusy}
              >
                {loadFromEmailBusy ? "Loading…" : "Load from latest email"}
              </button>
            </div>
            <textarea
              className="cad-dispatch-rules-textarea"
              spellCheck={false}
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              rows={12}
              aria-label="Sample dispatch text for preview"
            />
          </article>

          <article className="panel cad-dispatch-incident-card">
            <div className="panel-header">
              <h2>Preview output</h2>
            </div>
            {previewError ? <p className="field-error">{previewError}</p> : null}
            {previewResult ? (
              <pre className="cad-dispatch-preview-pre">{formatPreviewJson(previewResult)}</pre>
            ) : !previewError ? (
              <p className="panel-description">Click Preview to run the rule pipeline on the sample text.</p>
            ) : null}
          </article>
        </div>
      </section>
    </>
  );
}
