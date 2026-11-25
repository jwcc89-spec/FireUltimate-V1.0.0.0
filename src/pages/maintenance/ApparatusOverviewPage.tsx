import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getInspections, type InspectionSummary } from "../../api/inspections";
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
  pmStatus,
  statusTone,
  todayKey,
} from "./maintenanceUtils";

const MAINTENANCE_PATH = "/apparatus/maintenance-logs";
const INSPECTIONS_PATH = "/apparatus/inspections";
const DEFICIENCY = "Deficiency";

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
  const [inspections, setInspections] = useState<InspectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getMaintenanceRecords("apparatus"), getApparatusStatus(), getPmSchedules(), getInspections()])
      .then(([nextRecords, nextStatuses, nextSchedules, nextInspections]) => {
        if (!active) return;
        setRecords(nextRecords);
        setStatuses(nextStatuses);
        setSchedules(nextSchedules);
        setInspections(nextInspections);
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
    const open = records.filter((record) => isOpenStatus(record.status));
    const openDeficiencies = open.filter((record) => record.typeName === DEFICIENCY);
    const readingsByUnit = new Map(statuses.map((unit) => [unit.unitId, unit.readings]));
    const pmDue = schedules.filter((schedule) => {
      if (!schedule.active || schedule.assetKind !== "apparatus") return false;
      const status = pmStatus(schedule, readingsByUnit.get(schedule.assetRef) ?? null, today).status;
      return status === "Overdue" || status === "Approaching";
    });
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

  const recentInspections = inspections.slice(0, 10);
  const unitLabel = (ref: string) => lookups.apparatus.find((unit) => unit.unitId === ref)?.label ?? ref;
  const openReport = (id: string) => navigate(`${INSPECTIONS_PATH}?report=${encodeURIComponent(id)}`);

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
    { label: "PM Approaching / Overdue", value: summary.pmDue, to: recordLink({ tab: "schedules" }) },
    { label: "Completed This Month", value: summary.completedMonth, to: recordLink({ filter: "complete" }) },
  ];

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Fleet Overview</h1>
          <p>Apparatus status, open work and recent inspections. Pick a submenu on the left to go further.</p>
        </div>
        {canSubmit ? (
          <div className="header-actions">
            <button
              type="button"
              className="primary-button maintenance-icon-button"
              onClick={() => navigate(recordLink({ new: "1" }))}
            >
              <Plus size={15} aria-hidden="true" /> New Maintenance
            </button>
            <button
              type="button"
              className="primary-button maintenance-icon-button"
              onClick={() => navigate(`${INSPECTIONS_PATH}?new=1`)}
            >
              <ClipboardCheck size={15} aria-hidden="true" /> New Inspection
            </button>
          </div>
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
          <p className="field-hint">No maintenance records yet.</p>
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
          <div className="panel-header">
            <h3>Inspections</h3>
            <button type="button" className="secondary-button compact-button" onClick={() => navigate(INSPECTIONS_PATH)}>
              All Inspections
            </button>
          </div>
          {recentInspections.length === 0 ? (
            <p className="field-hint">No inspections yet. Click New Inspection to start one.</p>
          ) : (
            <div className="table-wrapper">
              <table className="module-table-grid">
                <thead>
                  <tr>
                    <th>Apparatus</th>
                    <th>Date</th>
                    <th># Repair Issues</th>
                    <th aria-label="Report" />
                  </tr>
                </thead>
                <tbody>
                  {recentInspections.map((inspection) => (
                    <tr key={inspection.id}>
                      <td>
                        <strong>{unitLabel(inspection.subjectRef)}</strong>
                      </td>
                      <td>{formatDateKey(inspection.completedOn)}</td>
                      <td>
                        <span className={`tone tone-${inspection.repairCount > 0 ? "critical" : "positive"}`}>
                          {inspection.repairCount}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="secondary-button compact-button" onClick={() => openReport(inspection.id)}>
                          Open Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
