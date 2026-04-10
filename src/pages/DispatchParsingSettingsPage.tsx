import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getCadEmails, type CadEmailIngestRow } from "../api/cadEmails";
import {
  getDispatchPlainTextFromRawBody,
  tryDecodeRawBody,
} from "../cadDispatch/extractDispatchPlainText.ts";
import { DispatchParsingIncidentPanel } from "./DispatchParsingIncidentPanel.tsx";
import { DispatchParsingMessagePanel } from "./DispatchParsingMessagePanel.tsx";

export const DISPATCH_PARSING_ADMIN_MODULES = [
  {
    id: "message-parsing",
    label: "Message Parsing",
    path: "/admin-functions/dispatch-parsing-settings/message-parsing",
  },
  {
    id: "incident-parsing",
    label: "Incident Parsing",
    path: "/admin-functions/dispatch-parsing-settings/incident-parsing",
  },
  {
    id: "raw-email",
    label: "Raw Email",
    path: "/admin-functions/dispatch-parsing-settings/raw-email",
  },
] as const;

export type DispatchParsingModuleId = (typeof DISPATCH_PARSING_ADMIN_MODULES)[number]["id"];

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

function DispatchParsingRawEmailPanel() {
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
    <>
      <header className="page-header dispatch-parsing-module-header">
        <div>
          <h1>Raw Email</h1>
          <p>
            View incoming CAD dispatch emails sent to your department address (e.g.
            cifpdil@cad.fireultimate.app). Expand a row for dispatch content, MIME source, and raw
            base64 for troubleshooting. Parsing rules are configured under Message Parsing and
            Incident Parsing.
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
                          const plainText = getDispatchPlainTextFromRawBody(row.rawBody ?? "");
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
    </>
  );
}

function normalizePath(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/**
 * Dispatch Parsing Settings: sidebar (Raw Email, Message Parsing, Incident Parsing) + content.
 * Routed paths: …/raw-email, …/message-parsing, …/incident-parsing.
 */
export function DispatchParsingAdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = normalizePath(location.pathname);

  const activeModuleId: DispatchParsingModuleId =
    path === "/admin-functions/dispatch-parsing-settings/message-parsing"
      ? "message-parsing"
      : path === "/admin-functions/dispatch-parsing-settings/incident-parsing"
        ? "incident-parsing"
        : "raw-email";

  return (
    <section className="page-section reporting-admin-root">
      <section className="neris-report-layout reporting-admin-layout">
        <aside className="panel neris-sidebar reporting-admin-sidebar">
          <div className="neris-sidebar-header">
            <h2>Dispatch Parsing</h2>
            <p>Admin modules</p>
          </div>
          <nav className="neris-section-nav" aria-label="Dispatch parsing module navigation">
            {DISPATCH_PARSING_ADMIN_MODULES.map((mod) => (
              <button
                key={mod.id}
                type="button"
                className={mod.id === activeModuleId ? "active" : ""}
                onClick={() => navigate(mod.path)}
              >
                {mod.label}
              </button>
            ))}
          </nav>
        </aside>
        <article className="panel neris-form-panel reporting-admin-content">
          {activeModuleId === "raw-email" ? <DispatchParsingRawEmailPanel /> : null}
          {activeModuleId === "message-parsing" ? <DispatchParsingMessagePanel /> : null}
          {activeModuleId === "incident-parsing" ? <DispatchParsingIncidentPanel /> : null}
        </article>
      </section>
    </section>
  );
}
