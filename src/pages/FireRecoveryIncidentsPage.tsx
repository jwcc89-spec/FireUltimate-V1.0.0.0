import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  getFireRecoveryIncidents,
  type FireRecoveryIncidentApi,
} from "../api/fireRecovery";
import {
  getIncidentDisplayNumber,
  type IncidentCallSummary,
} from "../appData";

export interface FireRecoveryIncidentsPageProps {
  incidentCalls: IncidentCallSummary[];
}

/** Live tenants: hide soft-deleted incidents from queue (same as NERIS exports). */
function isIncidentHiddenFromQueue(entry: IncidentCallSummary): boolean {
  return Boolean(entry.deletedAt);
}

export function FireRecoveryIncidentsPage({ incidentCalls }: FireRecoveryIncidentsPageProps) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<FireRecoveryIncidentApi[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const queueCalls = useMemo(
    () => incidentCalls.filter((entry) => !isIncidentHiddenFromQueue(entry)),
    [incidentCalls],
  );

  const refresh = () => {
    setLoadError(null);
    getFireRecoveryIncidents()
      .then(setRows)
      .catch((e: Error) => {
        setRows([]);
        setLoadError(e.message ?? "Failed to load Fire Recovery incidents.");
      });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getFireRecoveryIncidents();
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setLoadError(e instanceof Error ? e.message : "Failed to load Fire Recovery incidents.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openDetail = (callNumber: string) => {
    navigate(`/reporting/neris/fire-recovery/${encodeURIComponent(callNumber)}`);
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Reporting | NERIS | Fire Recovery Incidents for Billing</h1>
          <p>
            Incidents submitted to Fire Recovery USA for billing. Values below are cached from{" "}
            <strong>Get Incident Billing Status</strong> after you use <strong>Update</strong> on the
            detail view. Click a row for details.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button compact-button" onClick={() => refresh()}>
            Refresh
          </button>
          <NavLink className="secondary-button button-link compact-button" to="/reporting/neris">
            Back to NERIS Queue
          </NavLink>
        </div>
      </header>

      {loadError ? (
        <p className="panel-description" role="alert">
          {loadError}
        </p>
      ) : null}

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Fire Recovery Incidents for Billing</h2>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Incident #</th>
                  <th>Incident Date</th>
                  <th>Export Date</th>
                  <th>Invoice Status</th>
                  <th>Invoice Amount</th>
                  <th>Invoice Amount Due</th>
                  <th>Invoice Submit Date</th>
                  <th>Last Payment Date</th>
                  <th>Last Payment Amount</th>
                  <th>Payment Plan</th>
                  <th>Invoice ID</th>
                  <th>Tracking ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const call = queueCalls.find((c) => c.callNumber === r.callNumber);
                  return (
                    <tr
                      key={`fr-${r.callNumber}`}
                      className="clickable-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => openDetail(r.callNumber)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openDetail(r.callNumber);
                        }
                      }}
                    >
                      <td>
                        <strong className="call-number-text">
                          {call ? getIncidentDisplayNumber(call) : r.callNumber}
                        </strong>
                      </td>
                      <td>{r.incidentDateLabel || "—"}</td>
                      <td>{r.exportDateLabel || "—"}</td>
                      <td>{r.invoiceStatus || "—"}</td>
                      <td>{r.invoiceAmount || "—"}</td>
                      <td>{r.invoiceAmountDue || r.amountDue || "—"}</td>
                      <td>{r.invoiceSubmitDate || "—"}</td>
                      <td>{r.lastPaymentDate || "—"}</td>
                      <td>{r.amountPaid || "—"}</td>
                      <td>{r.paymentPlan || "—"}</td>
                      <td style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.9em" }}>
                        {r.invoiceId || "—"}
                      </td>
                      <td style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.9em" }}>
                        {r.trackingId || "—"}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={12}>
                      <div className="empty-message">
                        No Fire Recovery billing rows yet. Open an incident from the NERIS Export Queue,
                        then use <strong>Send to Fire Recovery</strong> on the export detail view after
                        a successful NERIS export.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  );
}
