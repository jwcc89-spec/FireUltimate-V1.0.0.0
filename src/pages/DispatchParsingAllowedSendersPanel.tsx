import { useEffect, useState } from "react";
import {
  getCadAllowlist,
  patchCadAllowlist,
  type CadAllowlistEntry,
} from "../api/cadDispatchConfig.ts";

type SenderKind = "exact_email" | "domain_suffix" | "regex";

type SenderRow = {
  key: string;
  pattern: string;
  patternType: SenderKind;
  enabled: boolean;
};

const KIND_OPTIONS: { value: SenderKind; label: string }[] = [
  { value: "exact_email", label: "Exact email address" },
  { value: "domain_suffix", label: "Whole domain" },
  { value: "regex", label: "Advanced pattern" },
];

function newKey(): string {
  return `sender-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function asKind(value: string): SenderKind {
  if (value === "exact_email" || value === "regex") return value;
  return "domain_suffix";
}

function rowFromEntry(entry: CadAllowlistEntry): SenderRow {
  return {
    key: entry.id || newKey(),
    pattern: entry.pattern,
    patternType: asKind(entry.patternType),
    enabled: entry.enabled,
  };
}

function blankRow(): SenderRow {
  return { key: newKey(), pattern: "", patternType: "exact_email", enabled: true };
}

function rowError(row: SenderRow, index: number): string | null {
  const pattern = row.pattern.trim();
  const place = `Row ${index + 1}`;
  if (!pattern) return `${place} is empty. Enter an address or remove the row.`;
  if (row.patternType === "exact_email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pattern)) {
      return `${place} needs a full email address, such as dispatch@co.iroquois.il.us.`;
    }
  } else if (row.patternType === "domain_suffix") {
    const domain = pattern.replace(/^@/, "");
    if (!domain || domain.includes("@") || domain.includes(" ") || !domain.includes(".")) {
      return `${place} needs a domain, such as co.iroquois.il.us.`;
    }
  } else {
    try {
      new RegExp(pattern);
    } catch {
      return `${place} is not a valid advanced pattern.`;
    }
  }
  return null;
}

function patternToSave(row: SenderRow): string {
  const pattern = row.pattern.trim();
  if (row.patternType === "domain_suffix") return pattern.replace(/^@/, "").toLowerCase();
  if (row.patternType === "exact_email") return pattern.toLowerCase();
  return pattern;
}

export function DispatchParsingAllowedSendersPanel() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<SenderRow[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getCadAllowlist()
      .then((entries) => {
        if (!cancelled) setRows(entries.map(rowFromEntry));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load allowed senders.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateRow(key: string, patch: Partial<SenderRow>) {
    setSaved(false);
    setSaveError(null);
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function handleSave() {
    const problems = rows.map((row, index) => rowError(row, index)).filter((message): message is string => Boolean(message));
    if (problems.length > 0) {
      setSaveError(problems[0]);
      setSaved(false);
      return;
    }
    setSaveBusy(true);
    setSaveError(null);
    try {
      const savedEntries = await patchCadAllowlist(
        rows.map((row, index) => ({
          pattern: patternToSave(row),
          patternType: row.patternType,
          enabled: row.enabled,
          sortOrder: index,
        })),
      );
      setRows(savedEntries.map(rowFromEntry));
      setSaved(true);
    } catch (error: unknown) {
      setSaved(false);
      setSaveError(error instanceof Error ? error.message : "Could not save allowed senders.");
    } finally {
      setSaveBusy(false);
    }
  }

  const enabledCount = rows.filter((row) => row.enabled && row.pattern.trim()).length;

  return (
    <>
      <header className="page-header dispatch-parsing-module-header">
        <div>
          <h1>Allowed Senders</h1>
          <p>
            County dispatch email is accepted only when the From address matches a row here. An empty
            list accepts no one. Use <strong>Exact email address</strong> for one mailbox, such as{" "}
            <strong>dispatch@co.iroquois.il.us</strong>.
          </p>
        </div>
      </header>

      {loading ? <p className="panel-description">Loading…</p> : null}
      {loadError ? <p className="field-error">{loadError}</p> : null}

      {!loading && !loadError ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Senders for this department</h2>
          </div>
          {enabledCount === 0 ? (
            <p className="field-error" role="status">
              Dispatch email is not accepted until at least one sender is turned on and saved.
            </p>
          ) : null}
          {rows.length === 0 ? (
            <p className="panel-description">No senders yet. Add the county dispatch address, then save.</p>
          ) : (
            <div className="cad-allowlist-rows">
              {rows.map((row, index) => (
                <div key={row.key} className="cad-allowlist-row">
                  <label className="cad-allowlist-field">
                    <span>Sender {index + 1}</span>
                    <input
                      className="cad-dispatch-merge-key-input"
                      type="text"
                      value={row.pattern}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => updateRow(row.key, { pattern: event.target.value })}
                    />
                  </label>
                  <label className="cad-allowlist-field">
                    <span>Match</span>
                    <select
                      className="cad-dispatch-merge-key-input"
                      value={row.patternType}
                      onChange={(event) =>
                        updateRow(row.key, { patternType: asKind(event.target.value) })
                      }
                    >
                      {KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="cad-allowlist-enabled">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(event) => updateRow(row.key, { enabled: event.target.checked })}
                    />
                    On
                  </label>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setSaved(false);
                      setRows((current) => current.filter((item) => item.key !== row.key));
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="cad-dispatch-incident-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setSaved(false);
                setRows((current) => [...current, blankRow()]);
              }}
            >
              Add sender
            </button>
            <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={saveBusy}>
              {saveBusy ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="panel-description">
            Saving an empty list, or turning every sender off, stops dispatch email for this department.
          </p>
          {saveError ? <p className="field-error">{saveError}</p> : null}
          {saved && !saveError ? (
            <p className="cad-dispatch-save-ok" role="status">
              Saved.
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
