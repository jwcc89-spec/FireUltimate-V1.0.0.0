import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFireRecoveryIncident,
  postFireRecoveryBillingStatus,
  type FireRecoveryIncidentApi,
} from "../api/fireRecovery";
import { getIncidentDisplayNumber, type IncidentCallSummary } from "../appData";

export interface FireRecoveryIncidentDetailPageProps {
  callNumber: string;
  incidentCalls: IncidentCallSummary[];
}

export function FireRecoveryIncidentDetailPage({
  callNumber,
  incidentCalls,
}: FireRecoveryIncidentDetailPageProps) {
  const navigate = useNavigate();
  const [row, setRow] = useState<FireRecoveryIncidentApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const incident = incidentCalls.find((c) => c.callNumber === callNumber) ?? null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getFireRecoveryIncident(callNumber);
        if (!cancelled) {
          setRow(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setRow(null);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callNumber]);

  const handleUpdateBilling = () => {
    setUpdating(true);
    setActionError(null);
    postFireRecoveryBillingStatus(callNumber)
      .then((data) => {
        setRow(data);
      })
      .catch((e: Error) => {
        setActionError(e.message ?? "Update failed.");
      })
      .finally(() => setUpdating(false));
  };

  if (!loading && !row) {
    return (
      <section className="page-section">
        <header className="page-header">
          <div>
            <h1>Fire Recovery — not found</h1>
            <p>No Fire Recovery billing record for this incident yet.</p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/reporting/neris/fire-recovery")}
            >
              Back to Fire Recovery Incidents
            </button>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Fire Recovery | {incident ? getIncidentDisplayNumber(incident) : callNumber}</h1>
          <p>
            Billing data from Fire Recovery USA. Use Update to refresh from the vendor (Get Incident
            Billing Status).
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="primary-button compact-button"
            disabled={updating || !row?.trackingId}
            onClick={handleUpdateBilling}
          >
            {updating ? "Updating…" : "Update"}
          </button>
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => navigate("/reporting/neris/fire-recovery")}
          >
            Back to Fire Recovery Incidents
          </button>
        </div>
      </header>

      {actionError ? (
        <p className="panel-description" role="alert">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <p className="panel-description">Loading…</p>
      ) : row ? (
        <section className="panel-grid">
          <article className="panel">
            <div className="panel-header">
              <h2>Billing snapshot</h2>
            </div>
            <div className="table-wrapper">
              <table>
                <tbody>
                  <tr>
                    <th scope="row">Tracking ID</th>
                    <td style={{ fontFamily: "ui-monospace, monospace" }}>{row.trackingId || "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Last submit</th>
                    <td>
                      {row.lastSubmitAt ?? "—"}{" "}
                      {row.lastSubmitOk ? (
                        <span className="tone tone-positive">success</span>
                      ) : (
                        <span className="tone tone-neutral">not successful</span>
                      )}
                    </td>
                  </tr>
                  {row.lastSubmitError ? (
                    <tr>
                      <th scope="row">Last error</th>
                      <td>{row.lastSubmitError}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <th scope="row">Incident type</th>
                    <td>{row.incidentType || "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Incident date</th>
                    <td>{row.incidentDateLabel || "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Export date</th>
                    <td>{row.exportDateLabel || "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Invoice ID</th>
                    <td>{row.invoiceId || "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Invoice status</th>
                    <td>{row.invoiceStatus || "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Invoice amount</th>
                    <td>{row.invoiceAmount || "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Amount due</th>
                    <td>{row.amountDue || "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Amount paid (last)</th>
                    <td>{row.amountPaid || "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">Billing last fetched</th>
                    <td>{row.billingFetchedAt ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
}
