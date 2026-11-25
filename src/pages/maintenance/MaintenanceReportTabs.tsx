import { type ReactNode, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, DollarSign, Wrench } from "lucide-react";
import {
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_STATUSES,
  type MaintenanceRecordSummary,
  type MaintenanceType,
} from "../../api/maintenance";
import {
  NFPA_STANDARD_NAMES,
  addDaysKey,
  formatDateKey,
  formatMoney,
  isOpenStatus,
  isOverdue,
  priorityTone,
  todayKey,
} from "./maintenanceUtils";

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

function BarRow({ label, count, total }: { label: ReactNode; count: number; total: number }) {
  return (
    <li>
      <div className="progress-label-row">
        <span>{label}</span>
        <strong>{count}</strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent(count, total)}%` }} />
      </div>
    </li>
  );
}

// ----- Compliance -----

type ComplianceView = "overview" | "regulation" | "asset" | "overdue";

export function MaintenanceComplianceTab({
  records,
  types,
}: {
  records: MaintenanceRecordSummary[];
  types: MaintenanceType[];
}) {
  const [view, setView] = useState<ComplianceView>("overview");
  const today = todayKey();
  const soon = addDaysKey(today, 30);

  const summary = useMemo(() => {
    const tracked = records.filter((record) => record.nfpaStandard && record.status !== "Cancelled");
    const compliant = tracked.filter((record) => record.status === "Completed");
    const overdue = tracked.filter((record) => isOverdue(record, today));
    const dueSoon = tracked.filter(
      (record) => isOpenStatus(record.status) && record.dueDate >= today && record.dueDate <= soon,
    );
    const assets = new Set(tracked.flatMap((record) => record.assets.map((asset) => asset.ref)));
    const standards = Array.from(new Set(types.map((type) => type.nfpaStandard).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    const byStandard = standards.map((standard) => {
      const rows = tracked.filter((record) => record.nfpaStandard === standard);
      return {
        standard,
        name: NFPA_STANDARD_NAMES[standard] ?? "",
        total: rows.length,
        done: rows.filter((record) => record.status === "Completed").length,
      };
    });
    const byAsset = Array.from(assets)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((ref) => {
        const rows = tracked.filter((record) => record.assets.some((asset) => asset.ref === ref));
        const label = rows[0]?.assets.find((asset) => asset.ref === ref)?.label ?? ref;
        return { ref, label, total: rows.length, done: rows.filter((record) => record.status === "Completed").length };
      });
    const rate = compliant.length + overdue.length > 0 ? percent(compliant.length, compliant.length + overdue.length) : 100;
    return { tracked, compliant, overdue, dueSoon, assets, byStandard, byAsset, rate };
  }, [records, soon, today, types]);

  const views: { id: ComplianceView; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "regulation", label: "By Regulation" },
    { id: "asset", label: "By Asset" },
    { id: "overdue", label: `Overdue (${summary.overdue.length})` },
  ];

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Compliance Dashboard</h1>
          <p>NFPA and regulatory compliance tracking from the maintenance records.</p>
        </div>
      </header>
      <div className="stat-grid">
        <article className="stat-card">
          <p>Total Assets</p>
          <strong>{summary.assets.size}</strong>
          <p>Tracked for compliance</p>
        </article>
        <article className="stat-card">
          <p>
            <CheckCircle2 size={14} aria-hidden="true" /> Compliant
          </p>
          <strong>{summary.compliant.length}</strong>
          <p>Completed NFPA records</p>
        </article>
        <article className="stat-card">
          <p>
            <Clock size={14} aria-hidden="true" /> Due Soon
          </p>
          <strong>{summary.dueSoon.length}</strong>
          <p>Within 30 days</p>
        </article>
        <article className="stat-card">
          <p>
            <AlertTriangle size={14} aria-hidden="true" /> Overdue
          </p>
          <strong className={summary.overdue.length > 0 ? "maintenance-critical-text" : undefined}>
            {summary.overdue.length}
          </strong>
          <p>Immediate attention</p>
        </article>
        <article className="stat-card">
          <p>Compliance Rate</p>
          <strong>{summary.rate}%</strong>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${summary.rate}%` }} />
          </div>
        </article>
      </div>
      <div className="department-editor-toolbar-actions">
        {views.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`secondary-button compact-button ${view === entry.id ? "department-toggle-active" : ""}`}
            onClick={() => setView(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <article className="panel">
        {view === "overview" || view === "regulation" ? (
          <>
            <h3>{view === "overview" ? "Compliance Status Overview" : "By Regulation"}</h3>
            <ul className="progress-list">
              {summary.byStandard
                .filter((row) => view === "overview" || row.total > 0)
                .map((row) => (
                  <BarRow
                    key={row.standard}
                    label={
                      <>
                        <strong>{row.standard}</strong> {row.name ? <span className="field-hint">{row.name}</span> : null}
                        <span className="field-hint">
                          {" "}
                          {row.done}/{row.total} ({percent(row.done, row.total)}%)
                        </span>
                      </>
                    }
                    count={row.done}
                    total={row.total}
                  />
                ))}
            </ul>
            {view === "regulation" && summary.byStandard.every((row) => row.total === 0) ? (
              <p className="field-hint">No records use an NFPA type yet.</p>
            ) : null}
          </>
        ) : null}
        {view === "asset" ? (
          <>
            <h3>By Asset</h3>
            {summary.byAsset.length === 0 ? <p className="field-hint">No assets have NFPA records yet.</p> : null}
            <ul className="progress-list">
              {summary.byAsset.map((row) => (
                <BarRow
                  key={row.ref}
                  label={
                    <>
                      <strong>{row.label}</strong>
                      <span className="field-hint">
                        {" "}
                        {row.done}/{row.total} completed
                      </span>
                    </>
                  }
                  count={row.done}
                  total={row.total}
                />
              ))}
            </ul>
          </>
        ) : null}
        {view === "overdue" ? (
          <>
            <h3>Overdue</h3>
            {summary.overdue.length === 0 ? <p className="field-hint">Nothing is overdue.</p> : null}
            <ul className="list-card">
              {summary.overdue.map((record) => (
                <li key={record.id}>
                  <div>
                    <strong>
                      {record.recordNumber} · {record.typeName}
                    </strong>
                    <p>{record.assets.map((asset) => asset.label).join(", ") || "No asset"}</p>
                  </div>
                  <span className="tone tone-critical">Due {formatDateKey(record.dueDate)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </article>
    </section>
  );
}

// ----- Analytics -----

export function MaintenanceAnalyticsTab({ records }: { records: MaintenanceRecordSummary[] }) {
  const stats = useMemo(() => {
    const today = todayKey();
    const monthPrefix = today.slice(0, 7);
    const yearPrefix = today.slice(0, 4);
    const last30 = addDaysKey(today, -30);
    const prior30 = addDaysKey(today, -60);
    const completed = records.filter((record) => record.status === "Completed");
    const costDate = (record: MaintenanceRecordSummary) => record.completedDate || record.createdAt.slice(0, 10);
    const byStatus = MAINTENANCE_STATUSES.map((status) => ({
      status,
      count: records.filter((record) => record.status === status).length,
    }));
    const byPriority = MAINTENANCE_PRIORITIES.slice()
      .reverse()
      .map((priority) => ({ priority, count: records.filter((record) => record.priority === priority).length }));
    const categoryCounts = new Map<string, number>();
    for (const record of records) {
      const name = record.typeName || "No category";
      categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
    }
    const completedLast30 = completed.filter((record) => record.completedDate >= last30).length;
    const completedPrior30 = completed.filter(
      (record) => record.completedDate >= prior30 && record.completedDate < last30,
    ).length;
    return {
      total: records.length,
      open: records.filter((record) => isOpenStatus(record.status)).length,
      completedMonth: completed.filter((record) => record.completedDate.startsWith(monthPrefix)).length,
      completedYear: completed.filter((record) => record.completedDate.startsWith(yearPrefix)).length,
      costMonth: records
        .filter((record) => costDate(record).startsWith(monthPrefix))
        .reduce((sum, record) => sum + record.costTotal, 0),
      costYear: records
        .filter((record) => costDate(record).startsWith(yearPrefix))
        .reduce((sum, record) => sum + record.costTotal, 0),
      byStatus,
      byPriority,
      byCategory: Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]),
      completionRate: percent(completed.length, records.filter((record) => record.status !== "Cancelled").length),
      completedLast30,
      completedPrior30,
      createdLast30: records.filter((record) => record.createdAt.slice(0, 10) >= last30).length,
    };
  }, [records]);

  const trendText =
    stats.completedLast30 === stats.completedPrior30
      ? "Same as the 30 days before"
      : stats.completedLast30 > stats.completedPrior30
        ? `${stats.completedLast30 - stats.completedPrior30} more than the 30 days before`
        : `${stats.completedPrior30 - stats.completedLast30} fewer than the 30 days before`;

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Maintenance Analytics</h1>
          <p>Key counts and trends from the maintenance records.</p>
        </div>
      </header>
      <div className="stat-grid">
        <article className="stat-card">
          <p>
            <Wrench size={14} aria-hidden="true" /> Total Records
          </p>
          <strong>{stats.total}</strong>
          <p>All time</p>
        </article>
        <article className="stat-card">
          <p>
            <Clock size={14} aria-hidden="true" /> Open Work Orders
          </p>
          <strong>{stats.open}</strong>
          <p>Currently active</p>
        </article>
        <article className="stat-card">
          <p>
            <CheckCircle2 size={14} aria-hidden="true" /> Completed This Month
          </p>
          <strong>{stats.completedMonth}</strong>
          <p>{stats.completedYear} this year, by Completed Date</p>
        </article>
        <article className="stat-card">
          <p>
            <DollarSign size={14} aria-hidden="true" /> Cost This Month
          </p>
          <strong>{formatMoney(stats.costMonth)}</strong>
          <p>{formatMoney(stats.costYear)} this year, by Completed Date or entry date</p>
        </article>
      </div>
      <section className="panel-grid two-column">
        <article className="panel">
          <h3>Status Breakdown</h3>
          <ul className="progress-list">
            {stats.byStatus.map((row) => (
              <BarRow key={row.status} label={row.status} count={row.count} total={stats.total} />
            ))}
          </ul>
          <div className="progress-label-row maintenance-total-row">
            <strong>Completion Rate</strong>
            <strong>{stats.completionRate}%</strong>
          </div>
        </article>
        <article className="panel">
          <h3>Priority Distribution</h3>
          <ul className="progress-list">
            {stats.byPriority.map((row) => (
              <BarRow
                key={row.priority}
                label={<span className={`tone tone-${priorityTone(row.priority)}`}>{row.priority}</span>}
                count={row.count}
                total={stats.total}
              />
            ))}
          </ul>
        </article>
        <article className="panel">
          <h3>Category Distribution</h3>
          {stats.byCategory.length === 0 ? <p className="field-hint">No records yet.</p> : null}
          <ul className="progress-list">
            {stats.byCategory.map(([name, count]) => (
              <BarRow key={name} label={name} count={count} total={stats.total} />
            ))}
          </ul>
        </article>
        <article className="panel">
          <h3>Activity Trends (Last 30 Days)</h3>
          <ul className="progress-list">
            <li>
              <div className="progress-label-row">
                <span>Completed</span>
                <strong>{stats.completedLast30}</strong>
              </div>
              <p className="field-hint">{trendText}</p>
            </li>
            <li>
              <div className="progress-label-row">
                <span>New records</span>
                <strong>{stats.createdLast30}</strong>
              </div>
            </li>
          </ul>
        </article>
      </section>
    </section>
  );
}
