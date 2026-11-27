import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileDown, Paperclip, Pencil, Printer, Users } from "lucide-react";
import {
  acknowledgePolicy,
  getPolicy,
  getPolicyAckStatus,
  getPolicyAttachment,
  type PolicyAckStatusRow,
  type PolicyDetail,
} from "../../api/policies";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { errorText, formatDateKey, formatTimestamp24 } from "../maintenance/maintenanceUtils";
import { PolicyContentView } from "./PolicyContent";
import { issuedText, openPdfDataUrl, printPolicy } from "./policyUtils";

const STATUS_COLUMNS: ModuleTableColumn<PolicyAckStatusRow>[] = [
  { id: "name", label: "Member", width: 220, render: (row) => row.name, value: (row) => row.name.toLowerCase() },
  { id: "status", label: "Status", width: 150, render: (row) => row.status, value: (row) => row.status },
  {
    id: "when",
    label: "Acknowledged",
    width: 170,
    render: (row) => (row.acknowledgedAt ? formatTimestamp24(row.acknowledgedAt) : ""),
    value: (row) => row.acknowledgedAt,
  },
  {
    id: "version",
    label: "Version Acknowledged",
    width: 170,
    render: (row) => (row.acknowledgedVersion ? `v${row.acknowledgedVersion}` : ""),
    value: (row) => row.acknowledgedVersion,
  },
];

function AckStatusPanel({ policyId }: { policyId: string }) {
  const [rows, setRows] = useState<PolicyAckStatusRow[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getPolicyAckStatus(policyId)
      .then(setRows)
      .catch((loadError) => setError(errorText(loadError, "Could not load who has acknowledged.")));
  }, [policyId]);
  if (error) return <p className="field-error">{error}</p>;
  if (!rows) return <p className="field-hint">Loading...</p>;
  const done = rows.filter((row) => row.status === "Acknowledged").length;
  const pending = rows.filter((row) => row.status === "Pending").length;
  return (
    <div className="policy-status-panel">
      <p className="field-hint">
        {done} acknowledged · {pending} pending · {rows.length - done - pending} not assigned
      </p>
      <ModuleTable
        tableId="policy-ack-status"
        columns={STATUS_COLUMNS}
        rows={rows}
        rowKey={(row) => row.userId}
        emptyText="No members yet."
        defaultSort={{ id: "status", direction: "desc" }}
      />
    </div>
  );
}

interface PolicyViewProps {
  policyId: string;
  /** Called after an acknowledgment so lists can refresh their warning icons. */
  onChanged?: () => void;
}

/** Mount with key={policyId} so switching policies starts fresh. */
export function PolicyView({ policyId, onChanged }: PolicyViewProps) {
  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  const load = useCallback(() => {
    getPolicy(policyId)
      .then(setPolicy)
      .catch((loadError) => setError(errorText(loadError, "Could not load the policy.")));
  }, [policyId]);

  useEffect(load, [load]);

  if (error) return <p className="field-error">{error}</p>;
  if (!policy) return <p className="field-hint">Loading...</p>;

  const published = policy.published;
  const acknowledge = () => {
    setBusy(true);
    acknowledgePolicy(policy.id)
      .then(() => {
        load();
        onChanged?.();
      })
      .catch((ackError) => setError(errorText(ackError, "Could not save the acknowledgment.")))
      .finally(() => setBusy(false));
  };
  const openAttachment = () => {
    getPolicyAttachment(policy.id)
      .then((file) => openPdfDataUrl(file.dataUrl))
      .catch((openError) => setError(errorText(openError, "Could not open the PDF.")));
  };

  return (
    <article className="panel policy-view">
      <div className="policy-view-actions">
        {policy.myAck === "needed" ? (
          <button type="button" className="primary-button maintenance-icon-button" disabled={busy} onClick={acknowledge}>
            <CheckCircle2 size={15} aria-hidden="true" /> {busy ? "Saving..." : "Acknowledge"}
          </button>
        ) : null}
        {published?.content ? (
          <button type="button" className="secondary-button maintenance-icon-button" onClick={printPolicy}>
            <Printer size={15} aria-hidden="true" /> Print / PDF
          </button>
        ) : null}
        {published?.attachment ? (
          <button type="button" className="secondary-button maintenance-icon-button" onClick={openAttachment}>
            <FileDown size={15} aria-hidden="true" /> Open PDF
          </button>
        ) : null}
        {policy.canManage ? (
          <>
            <Link className="secondary-button maintenance-icon-button" to={`/policies/builder?policy=${encodeURIComponent(policy.id)}`}>
              <Pencil size={15} aria-hidden="true" /> Edit
            </Link>
            {policy.requiresAck && policy.ackVersion > 0 ? (
              <button
                type="button"
                className={`secondary-button maintenance-icon-button ${showStatus ? "department-toggle-active" : ""}`}
                onClick={() => setShowStatus((value) => !value)}
              >
                <Users size={15} aria-hidden="true" /> Who Acknowledged
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {policy.myAck === "needed" ? (
        <p className="policy-ack-banner policy-ack-needed">
          <AlertTriangle size={16} aria-hidden="true" /> Read this {policy.kind === "dtb" ? "DTB" : "policy"} and click Acknowledge.
          {policy.dueDate ? ` Due ${formatDateKey(policy.dueDate)}.` : ""}
        </p>
      ) : null}
      {policy.myAck === "acknowledged" ? (
        <p className="policy-ack-banner policy-ack-done">
          <CheckCircle2 size={16} aria-hidden="true" /> You acknowledged this on {formatTimestamp24(policy.acknowledgedAt)}.
        </p>
      ) : null}

      {showStatus ? <AckStatusPanel policyId={policy.id} /> : null}

      <div className="policy-print-area">
        <header className="policy-view-header">
          {policy.number ? <span className="policy-number-badge">{policy.number}</span> : null}
          <div>
            <h2>{policy.title}</h2>
            <p className="field-hint">
              {published ? `Issued ${issuedText(published.publishedAt)} · Version ${published.version}` : "Not published yet"}
              {policy.effectiveDate ? ` · Effective ${formatDateKey(policy.effectiveDate)}` : ""}
              {published?.publishedBy ? ` · ${published.publishedBy}` : ""}
            </p>
            {published?.changeNote ? <p className="field-hint">What changed: {published.changeNote}</p> : null}
          </div>
        </header>
        {published?.content ? <PolicyContentView content={published.content} policyNumber={policy.number} /> : null}
        {published && !published.content && published.attachment ? (
          <p className="field-hint">
            <Paperclip size={14} aria-hidden="true" /> This {policy.kind === "dtb" ? "DTB" : "policy"} is a PDF. Click Open PDF to read it.
          </p>
        ) : null}
        {!published ? <p className="field-hint">This has not been published. Open it in the Policy Builder to finish and publish it.</p> : null}
      </div>

      {policy.history.length > 1 ? (
        <details className="policy-history">
          <summary>Version history ({policy.history.length})</summary>
          <ul>
            {policy.history.map((entry) => (
              <li key={entry.version}>
                v{entry.version} · {formatTimestamp24(entry.publishedAt)} · {entry.publishedBy}
                {entry.requireReack ? " · acknowledgment required" : " · minor edit"}
                {entry.changeNote ? ` · ${entry.changeNote}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}
