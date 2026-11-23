import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCadParsingConfig,
  patchCadParsingConfig,
} from "../api/cadDispatchConfig.ts";
import { getCadEmails, type CadEmailIngestRow } from "../api/cadEmails.ts";
import { getDispatchPlainTextFromRawBody } from "../cadDispatch/extractDispatchPlainText.ts";
import {
  INCIDENT_LABEL_FIELDS,
  buildIncidentLabelConfig,
  emptyIncidentLabels,
  labelOnLineOfSelection,
  labelsFromSavedRules,
  previewIncidentFromLabels,
  type IncidentLabelFieldId,
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
  const [labels, setLabels] = useState(emptyIncidentLabels);
  const [customRulesPresent, setCustomRulesPresent] = useState(false);

  const [emails, setEmails] = useState<CadEmailIngestRow[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [emailsError, setEmailsError] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string>("");

  const [highlightError, setHighlightError] = useState<string | null>(null);
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
        const loaded = labelsFromSavedRules(parsedRules);
        setLabels(loaded.labels);
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

  const preview = useMemo(() => {
    if (!sampleText) return null;
    return previewIncidentFromLabels(sampleText, labels);
  }, [sampleText, labels]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveOkAt(null);
    const built = buildIncidentLabelConfig(labels);
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
  }, [enableIncidentCreation, labels]);

  const applyHighlightedText = useCallback(
    (fieldId: IncidentLabelFieldId) => {
      const selected = window.getSelection?.()?.toString() ?? "";
      const label = labelOnLineOfSelection(sampleText, selected);
      if (!label) {
        setHighlightError(
          "Highlight the value in the email first. The line needs a label, such as Address: 123 Main St. If the value is on the next line, type the label in the box.",
        );
        return;
      }
      setHighlightError(null);
      setLabels((current) => ({ ...current, [fieldId]: label }));
    },
    [sampleText],
  );

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
            Older custom extraction rules are still saved. The labels below are what Preview and Save use. Save
            replaces those older rules.
          </p>
        ) : null}

        <article className="panel cad-dispatch-incident-card">
          <div className="panel-header">
            <h2>Match the email to incident fields</h2>
          </div>
          <p className="panel-description">
            Pick a sample email. For each field, type the label that appears in the email, such as{" "}
            <strong>Address</strong> or <strong>CFS</strong>. You can also highlight the value in the email, then
            click <strong>Use highlighted text</strong>.
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
                onChange={(event) => {
                  setSelectedEmailId(event.target.value);
                  setHighlightError(null);
                }}
              >
                {emails.map((row) => (
                  <option key={row.id} value={row.id}>
                    {formatRowDate(row.createdAt)} — {row.fromAddress || "Unknown sender"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="cad-incident-label-layout">
            <div>
              <h3 className="cad-dispatch-message-row-h">Original text</h3>
              {sampleText ? (
                <pre className="cad-dispatch-preview-pre cad-incident-sample-text">{sampleText}</pre>
              ) : (
                <p className="panel-description">No dispatch text in this email.</p>
              )}
            </div>
            <div>
              <h3 className="cad-dispatch-message-row-h">Incident fields</h3>
              {highlightError ? <p className="field-error">{highlightError}</p> : null}
              <div className="cad-incident-label-list">
                {INCIDENT_LABEL_FIELDS.map((field) => (
                  <div key={field.id} className="cad-incident-label-row">
                    <label className="cad-allowlist-field">
                      {field.label}
                      <input
                        type="text"
                        className="cad-dispatch-merge-key-input"
                        value={labels[field.id]}
                        placeholder="Label in the email"
                        aria-label={`${field.label} label in the email`}
                        onChange={(event) =>
                          setLabels((current) => ({ ...current, [field.id]: event.target.value }))
                        }
                      />
                    </label>
                    <p className="panel-description">{field.hint}</p>
                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() => applyHighlightedText(field.id)}
                      disabled={!sampleText}
                    >
                      Use highlighted text
                    </button>
                  </div>
                ))}
                <div className="cad-incident-label-row">
                  <p className="cad-allowlist-field">Status</p>
                  <p className="panel-description">New incidents from CAD start as Draft.</p>
                </div>
              </div>
            </div>
          </div>
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
              Saved. The next dispatch email uses these labels.
            </p>
          ) : null}
        </article>
      </section>
    </>
  );
}
