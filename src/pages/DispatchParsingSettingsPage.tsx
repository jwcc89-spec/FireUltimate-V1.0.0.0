import { useEffect, useState } from "react";
import { getCadEmails, type CadEmailIngestRow } from "../api/cadEmails";

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

/** Try to decode base64 raw body from the ingest worker; returns decoded string or null if not base64. */
function tryDecodeRawBody(rawBody: string): string | null {
  if (!rawBody || typeof rawBody !== "string") return null;
  const trimmed = rawBody.trim();
  const withoutSuffix = trimmed.endsWith("[TRUNCATED]")
    ? trimmed.slice(0, -"[TRUNCATED]".length).trim()
    : trimmed;
  if (!withoutSuffix.length) return null;
  try {
    const decoded = atob(withoutSuffix);
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract the first base64-encoded text/plain part from decoded MIME (e.g. CAD dispatch body).
 * Returns decoded plain text suitable for parsing, or null if none found.
 */
function extractPlainTextFromMime(decodedMime: string): string | null {
  if (!decodedMime || typeof decodedMime !== "string") return null;
  const idx = decodedMime.search(/Content-Transfer-Encoding:\s*base64/i);
  if (idx === -1) return null;
  const afterHeader = decodedMime.slice(idx);
  const blankMatch = afterHeader.match(/\n\s*\n/);
  const bodyStart = blankMatch ? afterHeader.indexOf(blankMatch[0]) + blankMatch[0].length : 0;
  let block = afterHeader.slice(bodyStart);
  const boundaryIdx = block.search(/\n--/);
  if (boundaryIdx !== -1) block = block.slice(0, boundaryIdx);
  const base64Only = block.replace(/\s/g, "").replace(/\[TRUNCATED\]/gi, "");
  if (!base64Only.length || !/^[A-Za-z0-9+/=]*$/.test(base64Only)) return null;
  try {
    return atob(base64Only);
  } catch {
    return null;
  }
}

export function DispatchParsingSettingsPage() {
  const [emails, setEmails] = useState<CadEmailIngestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCadEmails(100, 0)
      .then((list) => {
        if (!cancelled) setEmails(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load emails.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Admin Functions | Dispatch Parsing Settings</h1>
          <p>
            View incoming CAD dispatch emails sent to your department address (e.g.
            cifpdil@cad.fireultimate.app). Parsing rules and auto-create incidents
            will be added in a later update.
          </p>
        </div>
      </header>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Incoming emails</h2>
          </div>
          {error ? (
            <p className="field-error">{error}</p>
          ) : loading ? (
            <p>Loading…</p>
          ) : emails.length === 0 ? (
            <p className="panel-description">
              No CAD emails have been received yet. Once you give your CAD address
              (e.g. <strong>cifpdil@cad.fireultimate.app</strong>) to dispatch and
              they send test emails, they will appear here.
            </p>
          ) : (
            <div className="cad-email-list">
              {emails.map((row) => (
                <div
                  key={row.id}
                  className="cad-email-item"
                  data-expanded={expandedId === row.id || undefined}
                >
                  <button
                    type="button"
                    className="cad-email-summary"
                    onClick={() =>
                      setExpandedId((id) => (id === row.id ? null : row.id))
                    }
                    aria-expanded={expandedId === row.id}
                  >
                    <span className="cad-email-from">{row.fromAddress || "—"}</span>
                    <span className="cad-email-to">{row.toAddress || "—"}</span>
                    <span className="cad-email-date">
                      {formatDate(row.createdAt)}
                    </span>
                  </button>
                  {expandedId === row.id ? (
                    <div className="cad-email-body-panel">
                      <div className="cad-email-meta">
                        <div>
                          <strong>From:</strong> {row.fromAddress || "—"}
                        </div>
                        <div>
                          <strong>To:</strong> {row.toAddress || "—"}
                        </div>
                        <div>
                          <strong>Received:</strong> {formatDate(row.createdAt)}
                        </div>
                      </div>
                      {(() => {
                        const decoded = tryDecodeRawBody(row.rawBody ?? "");
                        if (decoded !== null) {
                          const plainText = extractPlainTextFromMime(decoded);
                          return (
                            <>
                              {plainText ? (
                                <>
                                  <label className="cad-email-raw-label">
                                    Dispatch content (for parsing)
                                  </label>
                                  <pre className="cad-email-raw-body cad-email-dispatch-content">
                                    {plainText}
                                  </pre>
                                </>
                              ) : null}
                              <details className="cad-email-raw-details">
                                <summary>
                                  {plainText ? "Show full MIME source" : "Show decoded MIME body"}
                                </summary>
                                <pre className="cad-email-raw-body cad-email-decoded">
                                  {decoded}
                                </pre>
                              </details>
                              <details className="cad-email-raw-details">
                                <summary>Show raw base64</summary>
                                <pre className="cad-email-raw-body">
                                  {row.rawBody || "(empty)"}
                                </pre>
                              </details>
                            </>
                          );
                        }
                        return (
                          <>
                            <label className="cad-email-raw-label">Raw body (for parsing)</label>
                            <pre className="cad-email-raw-body">
                              {row.rawBody || "(empty)"}
                            </pre>
                          </>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </section>
  );
}
