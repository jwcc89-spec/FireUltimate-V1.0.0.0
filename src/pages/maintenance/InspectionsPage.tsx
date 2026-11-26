import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ClipboardCheck, Plus } from "lucide-react";
import {
  INSPECTION_RESULTS,
  createInspection,
  getInspection,
  getInspectionTemplate,
  getInspections,
  getOpenDeficiencies,
  type InspectionDetail,
  type InspectionDetails,
  type InspectionItemResult,
  type InspectionResult,
  type InspectionSection,
  type InspectionSummary,
  type InspectionTemplate,
  type OpenDeficiency,
} from "../../api/inspections";
import {
  getApparatusStatus,
  getMaintenanceRecords,
  getMaintenanceTypes,
  getPmSchedules,
  getVendors,
  type MaintenanceReadings,
  type MaintenanceRecordSummary,
  type MaintenanceType,
  type PmSchedule,
  type Vendor,
} from "../../api/maintenance";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { fullNameForUsername, useModuleLookups } from "../../moduleLookups";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { useMyPermissions } from "../../useMyPermissions";
import { MaintenanceRecordForm } from "./MaintenanceRecordForm";
import { errorText, formatDateKey, formatReading, toOptions, todayKey } from "./maintenanceUtils";

const MAINTENANCE_PATH = "/apparatus/maintenance-logs";

type View = { kind: "list" } | { kind: "new" } | { kind: "report"; id: string };

function readView(): View {
  const params = new URLSearchParams(window.location.search);
  const report = params.get("report");
  if (report) return { kind: "report", id: report };
  if (params.get("new") === "1") return { kind: "new" };
  return { kind: "list" };
}

function emptyDetails(): InspectionDetails {
  return {
    officer: "",
    station: "",
    vehicleMake: "",
    readings: { mileage: null, engineHours: null, pumpHours: null, generatorHours: null },
    lastServiceMileage: null,
    lastServiceEngineHours: null,
    comments: "",
  };
}

function defaultResults(sections: InspectionSection[]): Record<string, InspectionItemResult> {
  const results: Record<string, InspectionItemResult> = {};
  for (const section of sections) {
    if (!section.defaultNa) continue;
    for (const item of section.items) results[item.id] = { result: "NA", note: "", recordId: "" };
  }
  return results;
}

const RESULT_TONE: Record<InspectionResult, string> = { OK: "positive", X: "critical", O: "warning", NA: "neutral" };

function numberOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

const OIL_CHANGE = /\boil\b/i;

/**
 * Last oil change for a unit: the newest completed maintenance record whose category or description
 * mentions oil, then any "oil" PM task's last service reading for whichever meter is still missing.
 */
function lastOilService(unitId: string, records: MaintenanceRecordSummary[], schedules: PmSchedule[]) {
  const result: { mileage: number | null; engineHours: number | null; source: string } = { mileage: null, engineHours: null, source: "" };
  const record = records
    .filter(
      (entry) =>
        entry.status === "Completed" &&
        (entry.assetRef === unitId || entry.assets.some((asset) => asset.ref === unitId)) &&
        (OIL_CHANGE.test(entry.typeName) || OIL_CHANGE.test(entry.description)),
    )
    .sort((a, b) => (b.completedAt || b.completedDate).localeCompare(a.completedAt || a.completedDate))[0];
  if (record) {
    result.mileage = record.readings.mileage;
    result.engineHours = record.readings.engineHours;
    result.source = `${record.recordNumber}${record.completedDate ? ` on ${formatDateKey(record.completedDate)}` : ""}`;
  }
  for (const schedule of schedules) {
    if (schedule.assetRef !== unitId || !OIL_CHANGE.test(schedule.name) || schedule.lastServiceReading === null) continue;
    if (schedule.trackingBasis === "mileage" && result.mileage === null) result.mileage = schedule.lastServiceReading;
    if (schedule.trackingBasis === "engineHours" && result.engineHours === null) result.engineHours = schedule.lastServiceReading;
    if (!result.source && (result.mileage !== null || result.engineHours !== null)) result.source = `PM task "${schedule.name}"`;
  }
  return result;
}

function InspectionSectionPanel({
  section,
  summary,
  collapsed,
  onToggle,
  children,
}: {
  section: InspectionSection;
  summary: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <article className="panel inspection-section">
      <button type="button" className="inspection-section-toggle" aria-expanded={!collapsed} onClick={onToggle}>
        {collapsed ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        <h3>{section.title}</h3>
        <span className="field-hint">{summary}</span>
      </button>
      {collapsed ? null : children}
    </article>
  );
}

function sectionSummary(section: InspectionSection, results: Record<string, InspectionItemResult>, showProgress: boolean): string {
  const entries = section.items.map((item) => results[item.id]);
  const repairs = entries.filter((entry) => entry?.result === "X").length;
  const parts = [];
  if (showProgress) parts.push(`${entries.filter(Boolean).length} of ${section.items.length} answered`);
  if (repairs > 0) parts.push(`${repairs} repair needed`);
  else if (!showProgress) parts.push("No repairs needed");
  return parts.join(" · ");
}

function SectionToggleAll({ ids, sections }: { ids: string[]; sections: ReturnType<typeof useCollapsedSections> }) {
  const allCollapsed = ids.length > 0 && ids.every((id) => sections.collapsed.has(id));
  return (
    <button type="button" className="secondary-button compact-button" onClick={() => sections.setAll(ids, !allCollapsed)}>
      {allCollapsed ? "Expand All" : "Collapse All"}
    </button>
  );
}

function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setAll = (ids: string[], value: boolean) => setCollapsed(value ? new Set(ids) : new Set());
  return { collapsed, toggle, setAll };
}

/** Apparatus > Inspections: completed inspections, newest first, plus the inspection form and report. */
export function InspectionsPage({ username }: { username: string }) {
  const [view, setView] = useState<View>(readView);
  const lookups = useModuleLookups();
  const grants = useMyPermissions();
  const canSubmit = grants ? grants["maintenance.submit"] !== false : false;
  const [inspections, setInspections] = useState<InspectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const unitLabel = useCallback(
    (ref: string) => lookups.apparatus.find((unit) => unit.unitId === ref)?.label ?? ref,
    [lookups.apparatus],
  );

  const load = useCallback(
    () =>
      getInspections()
        .then((rows) => {
          setInspections(rows);
          setError("");
        })
        .catch((loadError) => setError(errorText(loadError, "Could not load inspections.")))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const go = (next: View) => {
    const params = next.kind === "new" ? "?new=1" : next.kind === "report" ? `?report=${encodeURIComponent(next.id)}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${params}`);
    setView(next);
  };

  if (view.kind === "new") {
    return (
      <InspectionForm
        username={username}
        unitLabel={unitLabel}
        onClose={(savedId) => {
          void load();
          go(savedId ? { kind: "report", id: savedId } : { kind: "list" });
        }}
      />
    );
  }
  if (view.kind === "report") {
    return <InspectionReport id={view.id} unitLabel={unitLabel} onBack={() => go({ kind: "list" })} />;
  }

  const columns: ModuleTableColumn<InspectionSummary>[] = [
    {
      id: "number",
      label: "Inspection #",
      width: 110,
      value: (row) => row.createdAt,
      render: (row) => <span className="call-number-text">{row.submissionNumber}</span>,
    },
    { id: "apparatus", label: "Apparatus", width: 120, value: (row) => unitLabel(row.subjectRef), render: (row) => <strong>{unitLabel(row.subjectRef)}</strong> },
    { id: "date", label: "Date", width: 100, value: (row) => row.completedOn, render: (row) => formatDateKey(row.completedOn) },
    { id: "by", label: "Firefighter / Driver", width: 160, value: (row) => row.completedByName, render: (row) => row.completedByName || "—" },
    {
      id: "repairs",
      label: "Repair Issues",
      width: 110,
      value: (row) => row.repairCount,
      render: (row) =>
        row.repairCount > 0 ? <span className="tone tone-critical">{row.repairCount}</span> : <span className="tone tone-positive">0</span>,
    },
    { id: "mileage", label: "Mileage", width: 100, value: (row) => row.readings.mileage ?? -1, render: (row) => formatReading(row.readings.mileage) || "—" },
    {
      id: "engineHours",
      label: "Engine Hours",
      width: 110,
      value: (row) => row.readings.engineHours ?? -1,
      render: (row) => formatReading(row.readings.engineHours) || "—",
    },
    {
      id: "open",
      label: "",
      width: 120,
      render: (row) => (
        <button type="button" className="secondary-button compact-button" onClick={() => go({ kind: "report", id: row.id })}>
          Open Report
        </button>
      ),
    },
  ];

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Apparatus Inspections</h1>
          <p>Completed inspections, newest first. A Repair Needed result opens a maintenance record for the unit.</p>
        </div>
        {canSubmit ? (
          <button type="button" className="primary-button maintenance-icon-button" onClick={() => go({ kind: "new" })}>
            <Plus size={15} aria-hidden="true" /> New Inspection
          </button>
        ) : null}
      </header>
      {error ? <p className="field-error">{error}</p> : null}
      {loading ? <p className="field-hint">Loading...</p> : null}
      <article className="panel">
        <ModuleTable
          tableId="apparatus-inspections"
          columns={columns}
          rows={inspections}
          rowKey={(row) => row.id}
          onRowClick={(row) => go({ kind: "report", id: row.id })}
          emptyText="No inspections yet. Click New Inspection to start one."
          defaultSort={{ id: "date", direction: "desc" }}
        />
      </article>
    </section>
  );
}

function ResultButtons({
  value,
  disabled,
  onChange,
}: {
  value: InspectionResult | "";
  disabled?: boolean;
  onChange: (result: InspectionResult) => void;
}) {
  return (
    <span className="inspection-result-buttons" role="radiogroup">
      {INSPECTION_RESULTS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.title}
          disabled={disabled}
          className={`inspection-result-button ${value === option.value ? `inspection-result-active tone-${RESULT_TONE[option.value]}` : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}

function InspectionLegend() {
  return (
    <span className="field-hint inspection-legend">
      <strong>OK</strong> = OK · <strong>X</strong> = Repair Needed · <strong>O</strong> = Repair Made · <strong>N/A</strong> = Not
      Applicable
    </span>
  );
}

function InspectionForm({
  username,
  unitLabel,
  onClose,
}: {
  username: string;
  unitLabel: (ref: string) => string;
  onClose: (savedId: string | null) => void;
}) {
  const lookups = useModuleLookups();
  const grants = useMyPermissions();
  const canManage = grants?.["maintenance.manage"] === true;
  const [template, setTemplate] = useState<InspectionTemplate | null>(null);
  const [types, setTypes] = useState<MaintenanceType[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [schedules, setSchedules] = useState<PmSchedule[]>([]);
  const [readingsByUnit, setReadingsByUnit] = useState<Map<string, MaintenanceReadings>>(new Map());
  const [records, setRecords] = useState<MaintenanceRecordSummary[]>([]);
  const [lastServiceSource, setLastServiceSource] = useState("");
  const [subjectRef, setSubjectRef] = useState("");
  const sections = useCollapsedSections();
  const [completedOn, setCompletedOn] = useState(todayKey());
  const [chosenDriver, setCompletedByName] = useState<string | null>(null);
  const completedByName = chosenDriver ?? fullNameForUsername(lookups, username);
  const [details, setDetails] = useState<InspectionDetails>(emptyDetails);
  const [results, setResults] = useState<Record<string, InspectionItemResult>>({});
  const [openForUnit, setOpenForUnit] = useState<{
    unit: string;
    byItem: Record<string, OpenDeficiency>;
    deficiencies: OpenDeficiency[];
  } | null>(null);
  const openByItem = openForUnit && openForUnit.unit === subjectRef ? openForUnit.byItem : {};
  const openDeficiencies = openForUnit && openForUnit.unit === subjectRef ? openForUnit.deficiencies : [];
  const [repairFor, setRepairFor] = useState<{ itemId: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      getInspectionTemplate(),
      getMaintenanceTypes(),
      getVendors(),
      getPmSchedules(),
      getApparatusStatus(),
      getMaintenanceRecords("apparatus"),
    ])
      .then(([nextTemplate, nextTypes, nextVendors, nextSchedules, statuses, nextRecords]) => {
        if (!active) return;
        setTemplate(nextTemplate);
        setResults(defaultResults(nextTemplate.sections));
        setTypes(nextTypes);
        setVendors(nextVendors);
        setSchedules(nextSchedules);
        setReadingsByUnit(new Map(statuses.map((unit) => [unit.unitId, unit.readings])));
        setRecords(nextRecords);
      })
      .catch((loadError) => {
        if (active) setError(errorText(loadError, "Could not load the inspection checklist."));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!subjectRef) return;
    let active = true;
    getOpenDeficiencies(subjectRef)
      .then((data) => {
        if (active) setOpenForUnit({ unit: subjectRef, ...data });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [subjectRef]);

  const apparatusOptions = useMemo(
    () => lookups.apparatus.map((unit) => ({ value: unit.unitId, label: unit.label })),
    [lookups.apparatus],
  );
  const personnelOptions = useMemo(() => toOptions(lookups.personnel), [lookups.personnel]);
  const stationOptions = useMemo(() => toOptions(lookups.stations), [lookups.stations]);
  const deficiencyTypeId = types.find((type) => type.name === "Deficiency")?.id ?? "";
  const allItems = template?.sections.flatMap((section) => section.items) ?? [];
  const unanswered = allItems.filter((item) => !results[item.id]).length;
  const latest = subjectRef ? readingsByUnit.get(subjectRef) : undefined;
  const linkedDeficiencyIds = new Set(Object.values(openByItem).map((entry) => entry.recordId));
  const looseDeficiencies = openDeficiencies.filter((entry) => !linkedDeficiencyIds.has(entry.recordId));

  const setResult = (itemId: string, label: string, result: InspectionResult) => {
    setResults((previous) => ({
      ...previous,
      [itemId]: { result, note: previous[itemId]?.note ?? "", recordId: result === "X" ? (previous[itemId]?.recordId ?? "") : "" },
    }));
    if (result === "X" && !results[itemId]?.recordId && !openByItem[itemId]) {
      if (!subjectRef) {
        setError("Pick the apparatus first so the repair can be logged against it.");
        return;
      }
      setRepairFor({ itemId, label });
    }
  };

  const selectApparatus = (ref: string) => {
    setSubjectRef(ref);
    const unit = lookups.apparatus.find((entry) => entry.unitId === ref);
    const oil = ref ? lastOilService(ref, records, schedules) : { mileage: null, engineHours: null, source: "" };
    setLastServiceSource(oil.source);
    setDetails((previous) => ({
      ...previous,
      vehicleMake: unit ? [unit.year, unit.make, unit.model].filter(Boolean).join(" ") : "",
      station: unit?.station && lookups.stations.includes(unit.station) ? unit.station : previous.station,
      lastServiceMileage: oil.mileage,
      lastServiceEngineHours: oil.engineHours,
    }));
  };

  const setNote = (itemId: string, note: string) =>
    setResults((previous) => (previous[itemId] ? { ...previous, [itemId]: { ...previous[itemId], note } } : previous));

  const markUncheckedOk = () =>
    setResults((previous) => {
      const next = { ...previous };
      for (const item of allItems) if (!next[item.id]) next[item.id] = { result: "OK", note: "", recordId: "" };
      return next;
    });

  const setReading = (key: keyof InspectionDetails["readings"], raw: string) =>
    setDetails((previous) => ({ ...previous, readings: { ...previous.readings, [key]: numberOrNull(raw) } }));

  const submit = async () => {
    setError("");
    const missing = [
      !subjectRef && "Apparatus",
      !completedOn && "Inspection Date",
      !completedByName.trim() && "Firefighter / Driver",
      !details.officer && "Officer / OOR",
      !details.station && "Station",
      details.readings.mileage === null && "Mileage",
      details.readings.engineHours === null && "Engine Hours",
      details.readings.pumpHours === null && "Pump Hours",
    ].filter(Boolean);
    if (missing.length > 0) return setError(`Fill in the required fields: ${missing.join(", ")}.`);
    if (unanswered > 0) return setError(`${unanswered} items have no result yet. Use Mark Unchecked as OK if they are all OK.`);
    setSaving(true);
    try {
      const saved = await createInspection({ subjectRef, completedOn, completedByName, results, details });
      onClose(saved.id);
    } catch (saveError) {
      setError(errorText(saveError, "Could not save the inspection."));
      setSaving(false);
    }
  };

  if (!template) {
    return error ? <p className="field-error">{error}</p> : <p className="field-hint">Loading checklist...</p>;
  }

  const readingField = (key: keyof InspectionDetails["readings"], label: string, required: boolean) => (
    <label key={key}>
      {label}
      {required ? <span className="required-mark"> *</span> : null}
      <input
        type="number"
        min={0}
        step="0.1"
        placeholder={latest && key !== "generatorHours" && latest[key] !== null ? `Last ${formatReading(latest[key])}` : ""}
        value={details.readings[key] ?? ""}
        onChange={(event) => setReading(key, event.target.value)}
      />
    </label>
  );

  return (
    <section className="page-section">
      <div className="maintenance-breadcrumb">
        <button type="button" className="edit-display-link" onClick={() => onClose(null)}>
          Inspections
        </button>
        <span>&gt; New</span>
      </div>
      <header className="page-header">
        <div>
          <h1 className="page-title-keep">{template.name}</h1>
          <InspectionLegend />
        </div>
        <div className="header-actions">
          <button type="button" className="primary-button compact-button" disabled={saving} onClick={() => void submit()}>
            {saving ? "Saving..." : "Submit Inspection"}
          </button>
          <button type="button" className="secondary-button compact-button" onClick={() => onClose(null)}>
            Cancel
          </button>
        </div>
      </header>
      {error ? <p className="field-error">{error}</p> : null}

      <article className="panel">
        <h3>Inspection Information</h3>
        <div className="department-edit-grid inspection-info-grid">
          <label>
            <span>Apparatus<span className="required-mark"> *</span></span>
            <NerisFlatSingleOptionSelect
              inputId="inspection-apparatus"
              usePortal
              value={subjectRef}
              options={apparatusOptions}
              placeholder={apparatusOptions.length ? "Select apparatus..." : "No apparatus in Department Details"}
              onChange={selectApparatus}
            />
          </label>
          <label>
            <span>Inspection Date<span className="required-mark"> *</span></span>
            <input type="date" value={completedOn} onChange={(event) => setCompletedOn(event.target.value)} />
          </label>
          <label>
            <span>Firefighter / Driver<span className="required-mark"> *</span></span>
            <NerisFlatSingleOptionSelect
              inputId="inspection-driver"
              usePortal
              value={completedByName}
              options={completedByName && !lookups.personnel.includes(completedByName) ? [{ value: completedByName, label: completedByName }, ...personnelOptions] : personnelOptions}
              placeholder="Select personnel..."
              onChange={setCompletedByName}
            />
          </label>
          <label>
            <span>Officer / OOR<span className="required-mark"> *</span></span>
            <NerisFlatSingleOptionSelect
              inputId="inspection-officer"
              usePortal
              allowClear
              value={details.officer}
              options={personnelOptions}
              placeholder="Select personnel..."
              onChange={(value) => setDetails({ ...details, officer: value })}
            />
          </label>
          <label>
            <span>Station<span className="required-mark"> *</span></span>
            <NerisFlatSingleOptionSelect
              inputId="inspection-station"
              usePortal
              allowClear
              value={details.station}
              options={stationOptions}
              placeholder="Select station..."
              onChange={(value) => setDetails({ ...details, station: value })}
            />
          </label>
          <label>
            Vehicle (Year / Make / Model)
            <input
              type="text"
              placeholder={subjectRef ? "Not set in Admin Functions > Apparatus" : ""} value={details.vehicleMake} onChange={(event) => setDetails({ ...details, vehicleMake: event.target.value })} />
          </label>
          {readingField("mileage", "Mileage", true)}
          {readingField("engineHours", "Engine Hours", true)}
          {readingField("pumpHours", "Pump Hours", true)}
          {readingField("generatorHours", "Generator Hours", false)}
          <label>
            Last Service Mileage
            <input
              type="number"
              min={0}
              value={details.lastServiceMileage ?? ""}
              onChange={(event) => setDetails({ ...details, lastServiceMileage: numberOrNull(event.target.value) })}
            />
          </label>
          <label>
            Last Service Engine Hours
            <input
              type="number"
              min={0}
              step="0.1"
              value={details.lastServiceEngineHours ?? ""}
              onChange={(event) => setDetails({ ...details, lastServiceEngineHours: numberOrNull(event.target.value) })}
            />
          </label>
        </div>
        {subjectRef ? (
          <p className="field-hint">
            {lastServiceSource
              ? `Last Service is the last oil change, filled from ${lastServiceSource}.`
              : "No oil change logged for this apparatus yet. Last Service fills in from a completed Maintenance Log or PM task with \"oil\" in its category, description or name."}
          </p>
        ) : null}
      </article>

      {looseDeficiencies.length > 0 ? (
        <article className="panel">
          <h3>Open Deficiencies on {unitLabel(subjectRef)}</h3>
          <ul className="list-card">
            {looseDeficiencies.map((entry) => (
              <li key={entry.recordId}>
                <a className="edit-display-link" href={`${MAINTENANCE_PATH}?record=${encodeURIComponent(entry.recordId)}`} target="_blank" rel="noreferrer">
                  {entry.recordNumber}
                </a>
                <span>{entry.description}</span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <div className="department-editor-toolbar">
        <p className="field-hint">
          {unanswered === 0 ? "Every item has a result." : `${unanswered} of ${allItems.length} items still need a result.`}
        </p>
        <button type="button" className="secondary-button compact-button maintenance-icon-button" onClick={markUncheckedOk}>
          <ClipboardCheck size={14} aria-hidden="true" /> Mark Unchecked as OK
        </button>
        <SectionToggleAll ids={template.sections.map((section) => section.id)} sections={sections} />
      </div>

      {template.sections.map((section) => (
        <InspectionSectionPanel
          key={section.id}
          section={section}
          summary={sectionSummary(section, results, true)}
          collapsed={sections.collapsed.has(section.id)}
          onToggle={() => sections.toggle(section.id)}
        >
          <div className="inspection-items">
            {section.items.map((item) => {
              const entry = results[item.id];
              const open = openByItem[item.id];
              return (
                <div key={item.id} className={`inspection-item ${entry?.result === "X" ? "inspection-item-repair" : ""}`}>
                  <span className="inspection-item-label">{item.label}</span>
                  <ResultButtons value={entry?.result ?? ""} onChange={(result) => setResult(item.id, item.label, result)} />
                  <span className="inspection-item-note">
                    {open ? (
                      <span className="tone tone-critical inspection-open-note" title={open.description}>
                        Not corrected: {open.recordNumber} {open.description}
                      </span>
                    ) : null}
                    {entry?.result === "X" && entry.recordId ? (
                      <span className="field-hint">Work order opened</span>
                    ) : entry?.result === "X" && !open ? (
                      <button type="button" className="edit-display-link" onClick={() => setRepairFor({ itemId: item.id, label: item.label })}>
                        Open work order
                      </button>
                    ) : null}
                    {entry ? (
                      <input
                        type="text"
                        placeholder="Note (optional)"
                        value={entry.note}
                        onChange={(event) => setNote(item.id, event.target.value)}
                      />
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </InspectionSectionPanel>
      ))}

      <article className="panel">
        <label className="maintenance-textarea-label">
          Additional Comments
          <textarea rows={4} value={details.comments} onChange={(event) => setDetails({ ...details, comments: event.target.value })} />
        </label>
      </article>

      {error ? <p className="field-error">{error}</p> : null}
      <div className="header-actions">
        <button type="button" className="primary-button compact-button" disabled={saving} onClick={() => void submit()}>
          {saving ? "Saving..." : "Submit Inspection"}
        </button>
        <button type="button" className="secondary-button compact-button" onClick={() => onClose(null)}>
          Cancel
        </button>
      </div>

      {repairFor ? (
        <div className="schedule-notice-backdrop" role="dialog" aria-modal="true" aria-label="New maintenance">
          <div className="schedule-notice maintenance-record-modal">
            <MaintenanceRecordForm
              recordId={null}
              prefill={{
                assets: [{ kind: "apparatus", ref: subjectRef, label: unitLabel(subjectRef) }],
                typeId: deficiencyTypeId,
                description: `Inspection: ${repairFor.label}${results[repairFor.itemId]?.note ? ` - ${results[repairFor.itemId].note}` : ""}`,
                readings: {
                  mileage: details.readings.mileage,
                  engineHours: details.readings.engineHours,
                  pumpHours: details.readings.pumpHours,
                },
              }}
              schedules={schedules}
              readingsByUnit={readingsByUnit}
              assetKind="apparatus"
              username={username}
              canManage={canManage}
              types={types}
              vendors={vendors}
              assetOptions={apparatusOptions}
              stations={lookups.stations}
              personnel={lookups.personnel}
              onVendorCreated={(vendor) => setVendors((previous) => [...previous, vendor])}
              onSaved={(record) => {
                const itemId = repairFor.itemId;
                setResults((previous) => ({
                  ...previous,
                  [itemId]: { result: "X", note: previous[itemId]?.note ?? "", recordId: record.id },
                }));
                setRepairFor(null);
              }}
              onClose={() => setRepairFor(null)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InspectionReport({ id, unitLabel, onBack }: { id: string; unitLabel: (ref: string) => string; onBack: () => void }) {
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [error, setError] = useState("");
  const sections = useCollapsedSections();

  useEffect(() => {
    let active = true;
    getInspection(id)
      .then((data) => {
        if (active) setInspection(data);
      })
      .catch((loadError) => {
        if (active) setError(errorText(loadError, "Could not load the inspection."));
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <section className="page-section">
        <p className="field-error">{error}</p>
        <button type="button" className="secondary-button compact-button" onClick={onBack}>
          Back to Inspections
        </button>
      </section>
    );
  }
  if (!inspection) return <p className="field-hint">Loading inspection...</p>;

  const { details } = inspection;
  const info: [string, string][] = [
    ["Apparatus", unitLabel(inspection.subjectRef)],
    ["Inspection Date", formatDateKey(inspection.completedOn)],
    ["Firefighter / Driver", inspection.completedByName],
    ["Officer / OOR", details.officer],
    ["Station", details.station],
    ["Vehicle", details.vehicleMake],
    ["Mileage", formatReading(details.readings.mileage)],
    ["Engine Hours", formatReading(details.readings.engineHours)],
    ["Pump Hours", formatReading(details.readings.pumpHours)],
    ["Generator Hours", formatReading(details.readings.generatorHours)],
    ["Last Service Mileage", formatReading(details.lastServiceMileage)],
    ["Last Service Engine Hours", formatReading(details.lastServiceEngineHours)],
  ];

  return (
    <section className="page-section">
      <div className="maintenance-breadcrumb">
        <button type="button" className="edit-display-link" onClick={onBack}>
          Inspections
        </button>
        <span>&gt; {inspection.submissionNumber}</span>
      </div>
      <header className="page-header">
        <div>
          <h1 className="page-title-keep">
            {inspection.submissionNumber} · {unitLabel(inspection.subjectRef)}
          </h1>
          <p>
            {inspection.repairCount > 0 ? `${inspection.repairCount} repair issues found` : "No repair issues found"} ·{" "}
            <InspectionLegend />
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button compact-button" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="secondary-button compact-button" onClick={onBack}>
            Back
          </button>
        </div>
      </header>
      <article className="panel">
        <h3>Inspection Information</h3>
        <dl className="inspection-info-list">
          {info.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </article>
      <div className="department-editor-toolbar">
        <SectionToggleAll ids={(inspection.sections ?? []).map((section) => section.id)} sections={sections} />
      </div>
      {(inspection.sections ?? []).map((section) => (
        <InspectionSectionPanel
          key={section.id}
          section={section}
          summary={sectionSummary(section, inspection.results, false)}
          collapsed={sections.collapsed.has(section.id)}
          onToggle={() => sections.toggle(section.id)}
        >
          <div className="inspection-items">
            {section.items.map((item) => {
              const entry = inspection.results[item.id];
              const option = INSPECTION_RESULTS.find((result) => result.value === entry?.result);
              return (
                <div key={item.id} className={`inspection-item ${entry?.result === "X" ? "inspection-item-repair" : ""}`}>
                  <span className="inspection-item-label">{item.label}</span>
                  <span>
                    {option ? (
                      <span className={`tone tone-${RESULT_TONE[option.value]}`} title={option.title}>
                        {option.label} {option.value === "X" || option.value === "O" ? `· ${option.title}` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="inspection-item-note">
                    {entry?.recordId ? (
                      <a className="edit-display-link" href={`${MAINTENANCE_PATH}?record=${encodeURIComponent(entry.recordId)}`}>
                        View work order
                      </a>
                    ) : null}
                    {entry?.note ? <span className="field-hint">{entry.note}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </InspectionSectionPanel>
      ))}
      <article className="panel">
        <h3>Additional Comments</h3>
        <p>{details.comments || "None"}</p>
      </article>
    </section>
  );
}
