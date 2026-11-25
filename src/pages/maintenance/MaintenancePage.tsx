import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CircleCheck, Plus, RefreshCw, Store, Tag, Wrench } from "lucide-react";
import {
  getEquipment,
  getMaintenanceRecords,
  getMaintenanceTypes,
  getPmSchedules,
  getVendors,
  type EquipmentItem,
  type MaintenanceAssetKind,
  type MaintenanceRecordSummary,
  type MaintenanceType,
  type PmSchedule,
  type Vendor,
} from "../../api/maintenance";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { fullNameForUsername, useModuleLookups } from "../../moduleLookups";
import type { NerisValueOption } from "../../nerisMetadata";
import { useMyPermissions } from "../../useMyPermissions";
import { MaintenanceRecordForm } from "./MaintenanceRecordForm";
import { MaintenanceAnalyticsTab, MaintenanceComplianceTab } from "./MaintenanceReportTabs";
import { MaintenanceSchedulesTab, MaintenanceTypesTab, MaintenanceVendorsTab } from "./MaintenanceSetupTabs";
import {
  assetsText,
  errorText,
  formatDateKey,
  isOpenStatus,
  isOverdue,
  priorityTone,
  statusTone,
  todayKey,
} from "./maintenanceUtils";

type PageTab = "records" | "types" | "vendors" | "schedules" | "compliance" | "analytics";
type RecordFilter = "myOpen" | "open" | "overdue" | "complete" | "all";

const PAGE_TABS: { id: PageTab; label: string; Icon: typeof Wrench }[] = [
  { id: "records", label: "Maintenance", Icon: Wrench },
  { id: "types", label: "Types", Icon: Tag },
  { id: "vendors", label: "Vendors", Icon: Store },
  { id: "schedules", label: "Schedules", Icon: RefreshCw },
  { id: "compliance", label: "Compliance", Icon: CircleCheck },
  { id: "analytics", label: "Analytics", Icon: BarChart3 },
];

const RECORD_FILTERS: { id: RecordFilter; label: string }[] = [
  { id: "myOpen", label: "My Open" },
  { id: "open", label: "Open" },
  { id: "overdue", label: "Overdue" },
  { id: "complete", label: "Complete" },
  { id: "all", label: "All" },
];

const ALL_TYPES = "__all__";
const NO_TYPE = "__none__";

interface MaintenancePageProps {
  assetKind: MaintenanceAssetKind;
  username: string;
}

export function MaintenancePage({ assetKind, username }: MaintenancePageProps) {
  const grants = useMyPermissions();
  const canManage = grants?.["maintenance.manage"] === true;
  const canSubmit = grants ? grants["maintenance.submit"] !== false : false;
  const lookups = useModuleLookups();
  const myName = fullNameForUsername(lookups, username);

  const [tab, setTab] = useState<PageTab>("records");
  const [filter, setFilter] = useState<RecordFilter>("open");
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [records, setRecords] = useState<MaintenanceRecordSummary[]>([]);
  const [types, setTypes] = useState<MaintenanceType[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [schedules, setSchedules] = useState<PmSchedule[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecords = useCallback(
    () => getMaintenanceRecords(assetKind).then(setRecords),
    [assetKind],
  );
  const loadTypes = useCallback(() => getMaintenanceTypes().then(setTypes), []);
  const loadVendors = useCallback(() => getVendors().then(setVendors), []);
  const loadSchedules = useCallback(() => getPmSchedules().then(setSchedules), []);

  const reload = useCallback(
    (work: () => Promise<unknown>) => {
      setError("");
      work().catch((loadError) => setError(errorText(loadError, "Could not load maintenance data.")));
    },
    [],
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      loadRecords(),
      loadTypes(),
      loadVendors(),
      loadSchedules(),
      assetKind === "equipment" ? getEquipment().then(setEquipment) : Promise.resolve(),
    ])
      .catch((loadError) => {
        if (active) setError(errorText(loadError, "Could not load maintenance data."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [assetKind, loadRecords, loadSchedules, loadTypes, loadVendors]);

  const assetOptions: NerisValueOption[] = useMemo(
    () =>
      assetKind === "apparatus"
        ? lookups.apparatus.map((unit) => ({ value: unit.unitId, label: unit.label }))
        : equipment
            .filter((item) => item.status !== "Retired")
            .map((item) => ({
              value: item.id,
              label: item.serialNumber ? `${item.name} (${item.serialNumber})` : item.name,
            })),
    [assetKind, equipment, lookups.apparatus],
  );

  const today = todayKey();
  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        if (typeFilter === NO_TYPE && record.typeId) return false;
        if (typeFilter !== ALL_TYPES && typeFilter !== NO_TYPE && record.typeId !== typeFilter) return false;
        if (filter === "myOpen") {
          return (
            isOpenStatus(record.status) &&
            (record.createdBy === username || (myName !== "" && record.performedByName === myName))
          );
        }
        if (filter === "open") return isOpenStatus(record.status);
        if (filter === "overdue") return isOverdue(record, today);
        if (filter === "complete") return record.status === "Completed";
        return true;
      }),
    [filter, myName, records, today, typeFilter, username],
  );

  const typeTree = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const record of records) {
      const key = record.typeId || NO_TYPE;
      const entry = counts.get(key) ?? { name: record.typeName || "No category", count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    return Array.from(counts.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [records]);

  const columns: ModuleTableColumn<MaintenanceRecordSummary>[] = [
    {
      id: "recordNumber",
      label: "Record #",
      width: 140,
      value: (row) => row.recordNumber,
      render: (row) => <span className="call-number-text">{row.recordNumber}</span>,
    },
    {
      id: "description",
      label: "Description",
      width: 260,
      value: (row) => row.description,
      render: (row) => (
        <span className="dispatch-field" title={row.description}>
          {row.outOfService && isOpenStatus(row.status) ? (
            <span className="tone tone-critical maintenance-inline-badge">Out of Service</span>
          ) : null}
          {row.description || "—"}
        </span>
      ),
    },
    { id: "category", label: "Category", width: 190, value: (row) => row.typeName, render: (row) => row.typeName || "—" },
    { id: "assets", label: "Assets", width: 180, value: assetsText, render: (row) => assetsText(row) || "—" },
    {
      id: "status",
      label: "Status",
      width: 120,
      value: (row) => row.status,
      render: (row) => <span className={`tone tone-${statusTone(row.status)}`}>{row.status}</span>,
    },
    {
      id: "priority",
      label: "Priority",
      width: 100,
      value: (row) => ["Low", "Medium", "High", "Urgent"].indexOf(row.priority),
      render: (row) => <span className={`tone tone-${priorityTone(row.priority)}`}>{row.priority}</span>,
    },
    {
      id: "dueDate",
      label: "Due Date",
      width: 110,
      value: (row) => row.dueDate,
      render: (row) =>
        row.dueDate ? (
          <span className={isOverdue(row, today) ? "maintenance-critical-text" : undefined}>{formatDateKey(row.dueDate)}</span>
        ) : (
          "—"
        ),
    },
  ];

  const title = assetKind === "apparatus" ? "Apparatus Maintenance" : "Equipment Maintenance";

  if (editing) {
    return (
      <MaintenanceRecordForm
        key={editing.id ?? "new"}
        recordId={editing.id}
        assetKind={assetKind}
        username={username}
        canManage={canManage}
        types={types}
        vendors={vendors}
        assetOptions={assetOptions}
        stations={lookups.stations}
        personnel={lookups.personnel}
        onClose={(changed) => {
          setEditing(null);
          if (changed) reload(loadRecords);
        }}
      />
    );
  }

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p>
            {assetKind === "apparatus"
              ? "Report problems, track repairs and keep NFPA testing up to date for every unit."
              : "Track maintenance and NFPA testing for SCBA, hose, ladders and other equipment."}
          </p>
        </div>
        {canSubmit ? (
          <button type="button" className="primary-button maintenance-icon-button" onClick={() => setEditing({ id: null })}>
            <Plus size={15} aria-hidden="true" /> New Maintenance
          </button>
        ) : null}
      </header>

      <nav className="department-editor-toolbar-actions maintenance-tabs" aria-label={`${title} sections`}>
        {PAGE_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`secondary-button compact-button ${tab === id ? "department-toggle-active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={14} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      {error ? <p className="field-error">{error}</p> : null}
      {loading ? <p className="field-hint">Loading...</p> : null}

      {!loading && tab === "records" ? (
        <section className="neris-report-layout">
          <aside className="panel neris-sidebar">
            <div className="neris-sidebar-header">
              <h2>Types</h2>
              <p>Filter by category</p>
            </div>
            <nav className="neris-section-nav" aria-label="Maintenance types">
              <button
                type="button"
                className={typeFilter === ALL_TYPES ? "active" : ""}
                onClick={() => setTypeFilter(ALL_TYPES)}
              >
                All Maintenance ({records.length})
              </button>
              {typeTree.map(([id, entry]) => (
                <button
                  key={id}
                  type="button"
                  className={typeFilter === id ? "active" : ""}
                  onClick={() => setTypeFilter(id)}
                >
                  {entry.name} ({entry.count})
                </button>
              ))}
            </nav>
          </aside>
          <article className="panel maintenance-records-panel">
            <div className="department-editor-toolbar-actions">
              {RECORD_FILTERS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`secondary-button compact-button ${filter === entry.id ? "department-toggle-active" : ""}`}
                  onClick={() => setFilter(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <ModuleTable
              tableId={`maintenance-records-${assetKind}`}
              columns={columns}
              rows={filteredRecords}
              rowKey={(row) => row.id}
              onRowClick={(row) => setEditing({ id: row.id })}
              emptyText="No maintenance records match this filter."
              defaultSort={{ id: "recordNumber", direction: "desc" }}
            />
          </article>
        </section>
      ) : null}

      {!loading && tab === "types" ? (
        <MaintenanceTypesTab types={types} canManage={canManage} onChanged={() => reload(loadTypes)} />
      ) : null}
      {!loading && tab === "vendors" ? (
        <MaintenanceVendorsTab vendors={vendors} canManage={canManage} onChanged={() => reload(loadVendors)} />
      ) : null}
      {!loading && tab === "schedules" ? (
        <MaintenanceSchedulesTab
          schedules={schedules}
          types={types}
          assetKind={assetKind}
          assetOptions={assetOptions}
          canManage={canManage}
          onChanged={() => reload(loadSchedules)}
        />
      ) : null}
      {!loading && tab === "compliance" ? <MaintenanceComplianceTab records={records} types={types} /> : null}
      {!loading && tab === "analytics" ? <MaintenanceAnalyticsTab records={records} /> : null}
    </section>
  );
}
