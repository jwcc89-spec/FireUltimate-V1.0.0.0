import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getApparatusStatus,
  getMaintenanceRecords,
  getPmSchedules,
  type ApparatusStatus,
  type MaintenanceRecordSummary,
  type PmSchedule,
} from "../../api/maintenance";
import { useModuleLookups } from "../../moduleLookups";
import { useMyPermissions } from "../../useMyPermissions";
import {
  addDaysKey,
  assetsText,
  errorText,
  formatDateKey,
  formatTimestamp24,
  isOpenStatus,
  statusTone,
  todayKey,
} from "./maintenanceUtils";

const MAINTENANCE_PATH = "/apparatus/maintenance-logs";
const DEFICIENCY = "Deficiency";

interface ActivityItem {
  key: string;
  at: string;
  text: string;
  recordId: string;
}

function recordLink(params: Record<string, string>): string {
  return `${MAINTENANCE_PATH}?${new URLSearchParams(params).toString()}`;
}

/** Apparatus menu landing page: fleet status, open work and recent activity from maintenance records. */
export function ApparatusOverviewPage() {
  const navigate = useNavigate();
  const grants = useMyPermissions();
  const canSubmit = grants ? grants["maintenance.submit"] !== false : false;
  const lookups = useModuleLookups();
  const [records, setRecords] = useState<MaintenanceRecordSummary[]>([]);
  const [statuses, setStatuses] = useState<ApparatusStatus[]>([]);
  const [schedules, setSchedules] = useState<PmSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getMaintenanceRecords("apparatus"), getApparatusStatus(), getPmSchedules()])
      .then(([nextRecords, nextStatuses, nextSchedules]) => {
        if (!active) return;
        setRecords(nextRecords);
        setStatuses(nextStatuses);
        setSchedules(nextSchedules);
      })
      .catch((loadError) => {
        if (active) setError(errorText(loadError, "Could not load apparatus data."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const today = todayKey();
  const summary = useMemo(() => {
    const weekAgo = addDaysKey(today, -7);
    const soon = addDaysKey(today, 30);
    const open = records.filter((record) => isOpenStatus(record.status));
    const openDeficiencies = open.filter((record) => record.typeName === DEFICIENCY);
    const pmDue = schedules.filter(
      (schedule) => schedule.active && schedule.assetKind === "apparatus" && schedule.nextDueAt && schedule.nextDueAt <= soon,
    );
    return {
      newDeficiencies: openDeficiencies.filter((record) => record.createdAt.slice(0, 10) >= weekAgo).length,
      openDeficiencies: openDeficiencies.length,
      openWorkOrders: open.length,
      outOfService: statuses.filter((unit) => unit.status === "Out of Service").length,
      pmDue: pmDue.length,
      completedMonth: records.filter(
        (record) => record.status === "Completed" && record.completedDate.startsWith(today.slice(0, 7)),
      ).length,
    };
  }, [records, schedules, statuses, today]);

  const recent = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
    [records],
  );

  const activity = useMemo(() => {
    const items: ActivityItem[] = [];
    for (const record of records) {
      const unit = assetsText(record) || "Apparatus";
      const what = record.description || record.typeName || "maintenance";
      items.push({ key: `${record.id}-new`, at: record.createdAt, text: `${unit}: ${what} reported (${record.recordNumber})`, recordId: record.id });
      if (record.outOfServiceAt) {
        items.push({ key: `${record.id}-oos`, at: record.outOfServiceAt, text: `${unit} placed Out of Service`, recordId: record.id });
      }
      if (record.completedAt) {
        items.push({ key: `${record.id}-done`, at: record.completedAt, text: `${record.recordNumber} completed on ${unit}`, recordId: record.id });
      }
    }
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  }, [records]);

  const fleet = useMemo(() => {
    const byUnit = new Map(statuses.map((unit) => [unit.unitId, unit]));
    const rows = lookups.apparatus.map((unit) => ({ unitId: unit.unitId, label: unit.label, status: byUnit.get(unit.unitId) }));
    for (const unit of statuses) {
      if (!rows.some((row) => row.unitId === unit.unitId)) rows.push({ unitId: unit.unitId, label: unit.unitId, status: unit });
    }
    const rank = (row: (typeof rows)[number]) =>
      row.status?.status === "Out of Service" ? 0 : (row.status?.openDeficiencies ?? 0) > 0 ? 1 : (row.status?.openRecords ?? 0) > 0 ? 2 : 3;
    return rows.sort((a, b) => rank(a) - rank(b) || a.unitId.localeCompare(b.unitId, undefined, { numeric: true }));
  }, [lookups.apparatus, statuses]);

  const cards: { label: string; value: number; to: string }[] = [
    { label: "New Deficiencies (7 days)", value: summary.newDeficiencies, to: recordLink({ filter: "open", category: DEFICIENCY }) },
    { label: "Open Deficiencies", value: summary.openDeficiencies, to: recordLink({ filter: "open", category: DEFICIENCY }) },
    { label: "Open Work Orders", value: summary.openWorkOrders, to: recordLink({ filter: "open" }) },
    { label: "Out of Service", value: summary.outOfService, to: recordLink({ filter: "outOfService" }) },
    { label: "PM Approaching / Due (30 days)", value: summary.pmDue, to: recordLink({ tab: "schedules" }) },
    { label: "Completed This Month", value: summary.completedMonth, to: recordLink({ filter: "complete" }) },
  ];

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Fleet Overview</h1>
          <p>Apparatus status, open work and recent activity. Pick a submenu on the left to go further.</p>
        </div>
        {canSubmit ? (
          <button
            type="button"
            className="primary-button maintenance-icon-button"
            onClick={() => navigate(recordLink({ new: "1" }))}
          >
            <Plus size={15} aria-hidden="true" /> New Maintenance
          </button>
        ) : null}
      </header>
      {error ? <p className="field-error">{error}</p> : null}
      {loading ? <p className="field-hint">Loading...</p> : null}

      <div className="stat-grid apparatus-overview-cards">
        {cards.map((card) => (
          <button key={card.label} type="button" className="stat-card maintenance-cost-summary" onClick={() => navigate(card.to)}>
            <p>{card.label}</p>
            <strong className={card.label === "Out of Service" && card.value > 0 ? "maintenance-critical-text" : undefined}>
              {card.value}
            </strong>
            <p>View details →</p>
          </button>
        ))}
      </div>

      <article className="panel">
        <div className="panel-header">
          <h3>Recent Maintenance</h3>
          <button type="button" className="secondary-button compact-button" onClick={() => navigate(MAINTENANCE_PATH)}>
            All Maintenance
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="field-hint">No maintenance records yet. Apparatus inspections will also show here once they are built.</p>
        ) : (
          <div className="table-wrapper">
            <table className="module-table-grid">
              <thead>
                <tr>
                  <th>Record #</th>
                  <th>Apparatus</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((record) => (
                  <tr
                    key={record.id}
                    className="clickable-row"
                    tabIndex={0}
                    onClick={() => navigate(recordLink({ record: record.id }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") navigate(recordLink({ record: record.id }));
                    }}
                  >
                    <td className="call-number-text">{record.recordNumber}</td>
                    <td>{assetsText(record) || "—"}</td>
                    <td>{formatDateKey(record.createdAt.slice(0, 10))}</td>
                    <td>{record.typeName || "—"}</td>
                    <td>{record.description || "—"}</td>
                    <td>
                      <span className={`tone tone-${statusTone(record.status)}`}>{record.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <section className="panel-grid two-column">
        <article className="panel">
          <h3>Recent Activity</h3>
          {activity.length === 0 ? <p className="field-hint">No activity yet.</p> : null}
          <ul className="list-card">
            {activity.map((item) => (
              <li key={item.key}>
                <div>
                  <span className="field-hint">{formatTimestamp24(item.at)}</span>
                  <button
                    type="button"
                    className="edit-display-link"
                    onClick={() => navigate(recordLink({ record: item.recordId }))}
                  >
                    {item.text}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <h3>Apparatus Status</h3>
          {fleet.length === 0 ? <p className="field-hint">No apparatus in Department Details yet.</p> : null}
          <ul className="list-card">
            {fleet.map((row) => {
              const outOfService = row.status?.status === "Out of Service";
              return (
                <li key={row.unitId}>
                  <div>
                    <strong>{row.label}</strong>
                    <p>
                      {row.status?.openDeficiencies ?? 0} open deficiencies · {row.status?.openRecords ?? 0} open records
                      {outOfService && row.status?.outOfServiceSince
                        ? ` · out since ${formatTimestamp24(row.status.outOfServiceSince)}`
                        : ""}
                    </p>
                  </div>
                  {outOfService && row.status ? (
                    <button
                      type="button"
                      className="tone tone-critical apparatus-status-link"
                      title={row.status.outOfServiceReason || row.status.outOfServiceRecordNumber}
                      onClick={() => navigate(recordLink({ record: row.status!.outOfServiceRecordId }))}
                    >
                      Out of Service
                    </button>
                  ) : (
                    <span className="tone tone-positive">In Service</span>
                  )}
                </li>
              );
            })}
          </ul>
        </article>
      </section>
    </section>
  );
}
