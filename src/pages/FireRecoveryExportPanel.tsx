import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  fireRecoveryStatusLabel,
  fireRecoveryStatusTone,
  getFireRecoveryIncident,
  postFireRecoveryBillingStatus,
  postFireRecoveryPreview,
  postFireRecoveryResolveReview,
  postFireRecoverySubmit,
  type FireRecoveryIncidentApi,
  type FireRecoveryPreviewApi,
} from "../api/fireRecovery";
import type { UserRole } from "../appData";
import { isAdminOrHigher } from "../roleHierarchy";
import { useMyPermissions } from "../useMyPermissions";

function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error && error.message ? error.message : fallback;
  if (message === "Not found.") {
    return "This incident has not been exported to NERIS, so there is no bill to preview. Export the report first, then open it from View Exports. If it was already exported, close the API window and start it again with npm run proxy.";
  }
  return message;
}

function PreviewModal({
  preview,
  sending,
  error,
  onCancel,
  onConfirm,
}: {
  preview: FireRecoveryPreviewApi;
  sending: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const incident = preview.payload.IncidentToBillPayload?.IncidentsToBill?.incident;
  const recovery = incident?.CostRecovery;
  const location = incident?.Location;
  const parties = recovery?.Parties ?? [];
  const blocked = preview.missingRequired.length > 0 || preview.mode === "off";
  const bannerClass =
    preview.mode === "live" ? "is-live" : preview.mode === "sandbox" ? "is-sandbox" : "is-off";
  return (
    <div className="validation-modal-backdrop" role="presentation">
      <div className="panel validation-modal fr-preview-modal" role="dialog" aria-modal="true" aria-labelledby="fr-preview-title">
        <h2 id="fr-preview-title">Preview Fire Recovery bill</h2>
        <p className={`fr-preview-banner ${bannerClass}`}>{preview.banner}</p>
        <p>
          Department ID that will be sent: <strong>{preview.departmentId || "None"}</strong>
        </p>
        <dl className="detail-grid">
          <div>
            <dt>Run number</dt>
            <dd>{recovery?.IncidentNumber || "—"}</dd>
          </div>
          <div>
            <dt>Incident type</dt>
            <dd>{incident?.IncidentType || "—"}</dd>
          </div>
          <div>
            <dt>Alarm</dt>
            <dd>{incident?.AlarmDateTime || "—"}</dd>
          </div>
          <div>
            <dt>Cleared</dt>
            <dd>{incident?.ClearedDateTime || "—"}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>
              {[location?.Address, location?.City, location?.State, location?.Zip].filter(Boolean).join(", ") || "—"}
            </dd>
          </div>
          <div>
            <dt>Personnel</dt>
            <dd>{recovery?.TotalPersonnelOnScene ?? "—"}</dd>
          </div>
          <div>
            <dt>Law enforcement number</dt>
            <dd>{recovery?.LawEnforcementNumber || "—"}</dd>
          </div>
        </dl>
        <div className="fr-preview-parties">
          {parties.length === 0 ? <p>No parties on this bill.</p> : null}
          {parties.map((entry, index) => {
            const party = entry.Party;
            const vehicle = party?.Vehicle;
            return (
              <article key={`fr-preview-party-${index}`} className="fr-preview-party">
                <h3>
                  Party {index + 1}: {[party?.First, party?.Last].filter(Boolean).join(" ") || "No name"}
                </h3>
                <p>
                  {[party?.Address, party?.City, party?.State, party?.Zip].filter(Boolean).join(", ") || "No address"}
                </p>
                <p>
                  {[vehicle?.VehicleYear, vehicle?.VehicleMake, vehicle?.VehicleModel].filter(Boolean).join(" ") ||
                    "No vehicle"}
                  {vehicle?.InsuranceCompanyName ? ` · ${vehicle.InsuranceCompanyName}` : ""}
                </p>
              </article>
            );
          })}
        </div>
        {preview.missingRequired.length > 0 ? (
          <div>
            <p>Required, missing:</p>
            <ul>
              {preview.missingRequired.map((label) => (
                <li key={`fr-required-${label}`}>{label}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {preview.missingRecommended.length > 0 ? (
          <div>
            <p>Recommended, missing:</p>
            <ul>
              {preview.missingRecommended.map((label) => (
                <li key={`fr-recommended-${label}`}>{label}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? (
          <p role="alert">{error}</p>
        ) : null}
        <div className="validation-modal-actions">
          <button type="button" className="secondary-button compact-button" disabled={sending} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary-button compact-button" disabled={sending || blocked} onClick={onConfirm}>
            {sending ? "Sending…" : "Confirm and send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FireRecoveryResolveModal({
  runNumber,
  sending,
  error,
  onClose,
  onNotReceived,
  onReceived,
}: {
  runNumber: string;
  sending: boolean;
  error: string;
  onClose: () => void;
  onNotReceived: () => void;
  onReceived: (trackingId: string) => void;
}) {
  const [trackingId, setTrackingId] = useState("");
  return (
    <div className="validation-modal-backdrop" role="presentation">
      <div className="panel validation-modal" role="dialog" aria-modal="true" aria-labelledby="fr-resolve-title">
        <h2 id="fr-resolve-title">Check Recovery Hub</h2>
        <p>Log in to Recovery Hub and search for run number {runNumber}.</p>
        <div className="validation-modal-form">
          <label htmlFor="fr-resolve-tracking">Tracking ID from Recovery Hub</label>
          <input
            id="fr-resolve-tracking"
            value={trackingId}
            onChange={(event) => setTrackingId(event.target.value)}
          />
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <div className="fr-resolve-actions">
          <button type="button" className="secondary-button compact-button" disabled={sending} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="secondary-button compact-button" disabled={sending} onClick={onNotReceived}>
            {sending ? "Saving…" : "Fire Recovery does not have it"}
          </button>
          <button
            type="button"
            className="primary-button compact-button"
            disabled={sending}
            onClick={() => onReceived(trackingId.trim())}
          >
            {sending ? "Saving…" : "Fire Recovery has it"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FireRecoveryExportPanel({
  callNumber,
  runNumber,
  role,
  hasNerisExport,
}: {
  callNumber: string;
  runNumber: string;
  role: UserRole;
  hasNerisExport: boolean;
}) {
  const permissionGrants = useMyPermissions();
  const canViewBilling = permissionGrants?.["billing.view"] === true;
  const canSubmitBilling = canViewBilling && permissionGrants?.["billing.submit"] === true;
  const [row, setRow] = useState<FireRecoveryIncidentApi | null>(null);
  const [preview, setPreview] = useState<FireRecoveryPreviewApi | null>(null);
  const [message, setMessage] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const sendingRef = useRef(false);
  const statusLabel = fireRecoveryStatusLabel(row);

  useEffect(() => {
    if (!canViewBilling) return;
    let cancelled = false;
    getFireRecoveryIncident(callNumber)
      .then((data) => {
        if (!cancelled) setRow(data);
      })
      .catch(() => {
        if (!cancelled) setRow(null);
      });
    return () => {
      cancelled = true;
    };
  }, [callNumber, canViewBilling]);

  if (!canViewBilling) return null;

  const openPreview = () => {
    setMessage("");
    setPreviewError("");
    if (!hasNerisExport) {
      setMessage(
        "This incident has not been exported to NERIS, so there is no bill to preview. Export the report, then open it from View Exports.",
      );
      return;
    }
    setSending(true);
    postFireRecoveryPreview(callNumber)
      .then((data) => setPreview(data))
      .catch((error: unknown) => setMessage(errorMessage(error, "Preview failed.")))
      .finally(() => setSending(false));
  };

  const confirmSend = () => {
    if (!preview || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setPreviewError("");
    postFireRecoverySubmit(callNumber, preview.previewHash)
      .then((data) => {
        setRow(data);
        setPreview(null);
        setMessage("Fire Recovery accepted this bill.");
      })
      .catch((error: unknown) => setPreviewError(errorMessage(error, "Fire Recovery did not accept this bill.")))
      .finally(() => {
        sendingRef.current = false;
        setSending(false);
      });
  };

  const updateStatus = () => {
    if (updating) return;
    setUpdating(true);
    setMessage("");
    postFireRecoveryBillingStatus(callNumber)
      .then((data) => {
        setRow(data);
        setMessage("Billing status updated.");
      })
      .catch((error: unknown) => setMessage(errorMessage(error, "Fire Recovery did not answer in time.")))
      .finally(() => setUpdating(false));
  };

  const resolve = (outcome: "not_received" | "received", trackingId?: string) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setResolving(true);
    setResolveError("");
    postFireRecoveryResolveReview({ callNumber, outcome, trackingId })
      .then((data) => {
        setRow(data);
        setResolveOpen(false);
        setMessage(outcome === "received" ? "Marked as sent." : "Marked as failed. You can send it again.");
      })
      .catch((error: unknown) => setResolveError(errorMessage(error, "Could not save the Recovery Hub check.")))
      .finally(() => {
        sendingRef.current = false;
        setResolving(false);
      });
  };

  return (
    <article className="panel">
      <div className="panel-header">
        <h2>Fire Recovery</h2>
      </div>
      <p>
        <span className={`neris-status-pill ${fireRecoveryStatusTone(statusLabel)}`}>{statusLabel}</span>
      </p>
      <dl className="detail-grid">
        <div>
          <dt>Tracking ID</dt>
          <dd>{row?.trackingId || "—"}</dd>
        </div>
        <div>
          <dt>Invoice status</dt>
          <dd>{row?.invoiceStatus || "—"}</dd>
        </div>
        <div>
          <dt>Amount due</dt>
          <dd>{row?.invoiceAmountDue || row?.amountDue || "—"}</dd>
        </div>
        <div>
          <dt>Amount paid</dt>
          <dd>{row?.amountPaid || "—"}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{row?.billingFetchedAt || row?.lastSubmitAt || "—"}</dd>
        </div>
      </dl>
      {row?.lastSubmitError ? <p>{row.lastSubmitError}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <div className="header-actions">
        {canSubmitBilling ? (
          <button type="button" className="primary-button compact-button" disabled={sending} onClick={openPreview}>
            {sending && !preview ? "Preparing…" : "Preview & Send"}
          </button>
        ) : null}
        {canSubmitBilling ? (
          <button type="button" className="secondary-button compact-button" disabled={updating || !row?.trackingId} onClick={updateStatus}>
            {updating ? "Updating…" : "Update billing status"}
          </button>
        ) : null}
        {isAdminOrHigher(role) && row?.submitStatus === "needs_review" ? (
          <button type="button" className="secondary-button compact-button" onClick={() => setResolveOpen(true)}>
            Resolve review
          </button>
        ) : null}
        <Link className="secondary-button button-link compact-button" to={`/reporting/neris/${encodeURIComponent(callNumber)}?section=fireRecoveryBilling`}>
          Open Motor Vehicle Collision
        </Link>
      </div>
      {preview ? (
        <PreviewModal
          preview={preview}
          sending={sending}
          error={previewError}
          onCancel={() => {
            if (sending) return;
            setPreview(null);
          }}
          onConfirm={confirmSend}
        />
      ) : null}
      {resolveOpen ? (
        <FireRecoveryResolveModal
          runNumber={runNumber}
          sending={resolving}
          error={resolveError}
          onClose={() => {
            if (resolving) return;
            setResolveOpen(false);
          }}
          onNotReceived={() => resolve("not_received")}
          onReceived={(trackingId) => resolve("received", trackingId)}
        />
      ) : null}
    </article>
  );
}
