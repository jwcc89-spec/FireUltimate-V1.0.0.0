import { useState } from "react";
import { AlertTriangle, CalendarDays, Clock, Droplet, History, Plus } from "lucide-react";
import {
  MAINTENANCE_FREQUENCIES,
  PM_TRACKING_BASES,
  createPmSchedule,
  deletePmSchedule,
  updatePmSchedule,
  type MaintenanceAssetKind,
  type MaintenanceReadings,
  type MaintenanceRecordSummary,
  type MaintenanceType,
  type PmPerformedEntry,
  type PmSchedule,
  type PmTrackingBasis,
} from "../../api/maintenance";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import type { NerisValueOption } from "../../nerisMetadata";
import { EditDialog } from "./MaintenanceSetupTabs";
import { useDialogSave } from "./useDialogSave";
import { formatDateKey, formatReading, isOilChangeType, pmStatus, toOptions, type PmStatusInfo } from "./maintenanceUtils";

type ScheduleDraft = Omit<PmSchedule, "id"> & { id: string | null };

interface PmRow {
  schedule: PmSchedule;
  info: PmStatusInfo;
  assetName: string;
}

const STATUS_ORDER: Record<string, number> = { Overdue: 0, Approaching: 1, "Not Set": 2, Current: 3 };

function numberOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function PmStatusBadge({ info, paused }: { info: PmStatusInfo; paused?: boolean }) {
  if (paused) return <span className="tone tone-neutral">Paused</span>;
  return (
    <span className="pm-status">
      <span className={`tone tone-${info.tone}`}>{info.status}</span>
      <span className="field-hint">{info.detail}</span>
    </span>
  );
}

export function MaintenancePmTab({
  schedules,
  types,
  records,
  readingsByUnit,
  assetKind,
  assetOptions,
  canManage,
  canSubmit,
  onChanged,
  onCreateWorkOrder,
  onOpenRecord,
}: {
  schedules: PmSchedule[];
  types: MaintenanceType[];
  records: MaintenanceRecordSummary[];
  readingsByUnit: Map<string, MaintenanceReadings>;
  assetKind: MaintenanceAssetKind;
  assetOptions: NerisValueOption[];
  canManage: boolean;
  canSubmit: boolean;
  onChanged: () => void;
  onCreateWorkOrder: (schedule: PmSchedule) => void;
  onOpenRecord: (recordId: string) => void;
}) {
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [historyFor, setHistoryFor] = useState<PmSchedule | null>(null);
  const dialog = useDialogSave();
  const assetLabel = assetKind === "apparatus" ? "Apparatus" : "Equipment";
  const assetLabelByRef = new Map(assetOptions.map((option) => [option.value, option.label]));
  const typeNameById = new Map(types.map((type) => [type.id, type.name]));

  const rows: PmRow[] = schedules
    .filter((schedule) => schedule.assetKind === assetKind)
    .map((schedule) => ({
      schedule,
      info: pmStatus(schedule, readingsByUnit.get(schedule.assetRef) ?? null),
      assetName: schedule.assetRef ? (assetLabelByRef.get(schedule.assetRef) ?? schedule.assetRef) : "All",
    }));
  const activeRows = rows.filter((row) => row.schedule.active);
  const approaching = activeRows.filter((row) => row.info.status === "Approaching").length;
  const overdue = activeRows.filter((row) => row.info.status === "Overdue").length;

  const openDraft = (schedule: PmSchedule | null) => {
    dialog.setError("");
    setDraft(
      schedule
        ? { ...schedule }
        : {
            id: null,
            name: "",
            typeId: "",
            assetKind,
            assetRef: "",
            frequency: "Annual",
            nextDueAt: "",
            trackingBasis: assetKind === "apparatus" ? "engineHours" : "date",
            intervalValue: null,
            lastServiceReading: null,
            lastServiceDate: "",
            earlyWarning: null,
            active: true,
          },
    );
  };

  const columns: ModuleTableColumn<PmRow>[] = [
    { id: "asset", label: assetLabel, width: 110, value: (row) => row.assetName, render: (row) => <strong>{row.assetName}</strong> },
    {
      id: "service",
      label: "Service",
      width: 200,
      value: (row) => row.schedule.name,
      render: (row) => (
        <span className="pm-service">
          {row.schedule.name}
          {row.schedule.typeId ? <span className="field-hint">{typeNameById.get(row.schedule.typeId) ?? ""}</span> : null}
        </span>
      ),
    },
    {
      id: "basis",
      label: "Basis",
      width: 120,
      value: (row) => row.info.basisLabel,
      render: (row) =>
        row.schedule.trackingBasis === "date"
          ? row.schedule.frequency
          : `Every ${formatReading(row.schedule.intervalValue)} ${row.info.unit}`,
    },
    { id: "lastService", label: "Last Service", width: 110, value: (row) => row.info.lastService, render: (row) => row.info.lastService || "—" },
    { id: "nextDue", label: "Next Due", width: 110, value: (row) => row.info.nextDue, render: (row) => row.info.nextDue || "—" },
    { id: "current", label: "Current", width: 100, value: (row) => row.info.current, render: (row) => row.info.current || "—" },
    {
      id: "status",
      label: "Status",
      width: 170,
      value: (row) => (row.schedule.active ? STATUS_ORDER[row.info.status] : 9),
      render: (row) => <PmStatusBadge info={row.info} paused={!row.schedule.active} />,
    },
    {
      id: "actions",
      label: "Actions",
      width: 190,
      render: (row) => (
        <span className="header-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="secondary-button compact-button maintenance-icon-button" onClick={() => setHistoryFor(row.schedule)}>
            <History size={13} aria-hidden="true" /> History
          </button>
          {canSubmit ? (
            <button
              type="button"
              className="primary-button compact-button maintenance-icon-button"
              onClick={() => onCreateWorkOrder(row.schedule)}
            >
              {isOilChangeType(typeNameById.get(row.schedule.typeId)) ? (
                <>
                  <Droplet size={13} aria-hidden="true" /> Log Oil Change
                </>
              ) : (
                <>
                  <Plus size={13} aria-hidden="true" /> Work Order
                </>
              )}
            </button>
          ) : null}
        </span>
      ),
    },
  ];

  const save = async () => {
    if (!draft) return;
    const { id, ...input } = draft;
    const ok = await dialog.run(async () => {
      if (id) await updatePmSchedule(id, input);
      else await createPmSchedule(input);
    }, "Could not save the PM task.");
    if (ok) {
      setDraft(null);
      onChanged();
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    const id = draft.id;
    const ok = await dialog.run(() => deletePmSchedule(id), "Could not delete the PM task.");
    if (ok) {
      setDraft(null);
      onChanged();
    }
  };

  const typeOptions = types.filter((type) => type.enabled).map((type) => ({ value: type.id, label: type.name }));
  const basisOptions = PM_TRACKING_BASES.filter((basis) => assetKind === "apparatus" || basis.value === "date").map(
    (basis) => ({ value: basis.value, label: basis.label }),
  );
  const draftBasis = PM_TRACKING_BASES.find((basis) => basis.value === draft?.trackingBasis) ?? PM_TRACKING_BASES[3];
  const draftCurrent =
    draft && draft.trackingBasis !== "date" ? (readingsByUnit.get(draft.assetRef)?.[draft.trackingBasis] ?? null) : null;
  const historyRecords = historyFor
    ? records
        .filter((record) => record.status === "Completed" && record.pmPerformed?.some((entry) => entry.scheduleId === historyFor.id))
        .sort((a, b) => b.completedDate.localeCompare(a.completedDate))
    : [];

  return (
    <section className="page-section">
      <div className="stat-grid">
        <article className="stat-card">
          <p>
            <CalendarDays size={14} aria-hidden="true" /> Active PM Tasks
          </p>
          <strong>{activeRows.length}</strong>
        </article>
        <article className="stat-card">
          <p>
            <Clock size={14} aria-hidden="true" /> Approaching
          </p>
          <strong className={approaching > 0 ? "maintenance-warning-text" : undefined}>{approaching}</strong>
        </article>
        <article className="stat-card">
          <p>
            <AlertTriangle size={14} aria-hidden="true" /> Overdue
          </p>
          <strong className={overdue > 0 ? "maintenance-critical-text" : undefined}>{overdue}</strong>
        </article>
      </div>
      <div className="department-editor-toolbar">
        <p className="field-hint">
          Hours and miles come from the latest maintenance record or inspection for each {assetLabel.toLowerCase()}. Check a
          task under Preventive Maintenance Performed on a ticket to reset it when the ticket is completed.
        </p>
        {canManage ? (
          <button type="button" className="primary-button compact-button maintenance-icon-button" onClick={() => openDraft(null)}>
            <Plus size={14} aria-hidden="true" /> Add PM Task
          </button>
        ) : null}
      </div>
      <article className="panel">
        <h3>PM Schedule</h3>
        <ModuleTable
          tableId={`maintenance-pm-${assetKind}`}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.schedule.id}
          emptyText="No PM tasks yet. Click Add PM Task to track service by hours, miles or date."
          defaultSort={{ id: "status", direction: "asc" }}
          onRowClick={(row) => openDraft(row.schedule)}
        />
      </article>

      {draft ? (
        <EditDialog
          title={draft.id ? (canManage ? "Edit PM Task" : "PM Task") : "Add Preventive Maintenance Task"}
          error={dialog.error}
          saving={dialog.saving}
          readOnly={!canManage}
          onSave={() => void save()}
          onCancel={() => setDraft(null)}
          onDelete={draft.id ? () => void remove() : undefined}
        >
          <label>
            {assetLabel}
            <NerisFlatSingleOptionSelect
              inputId="pm-schedule-asset"
              value={draft.assetRef}
              options={assetOptions}
              usePortal
              allowClear
              disabled={!canManage}
              placeholder="All"
              onChange={(value) => setDraft({ ...draft, assetRef: value })}
            />
          </label>
          <label>
            Service Type
            <input
              type="text"
              placeholder="e.g. Engine oil and filter"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label>
            Category
            <NerisFlatSingleOptionSelect
              inputId="pm-schedule-type"
              value={draft.typeId}
              options={typeOptions}
              usePortal
              allowClear
              disabled={!canManage}
              placeholder="Select category..."
              onChange={(value) => {
                const type = types.find((entry) => entry.id === value);
                setDraft({
                  ...draft,
                  typeId: value,
                  frequency: type?.defaultFrequency || draft.frequency,
                  name: draft.name || type?.name || "",
                });
              }}
            />
          </label>
          <label>
            Tracked By
            <NerisFlatSingleOptionSelect
              inputId="pm-schedule-basis"
              value={draft.trackingBasis}
              options={basisOptions}
              usePortal
              disabled={!canManage}
              onChange={(value) => setDraft({ ...draft, trackingBasis: (value || "date") as PmTrackingBasis })}
            />
          </label>
          {draft.trackingBasis === "date" ? (
            <>
              <label>
                Frequency
                <NerisFlatSingleOptionSelect
                  inputId="pm-schedule-frequency"
                  value={draft.frequency}
                  options={toOptions(MAINTENANCE_FREQUENCIES)}
                  usePortal
                  disabled={!canManage}
                  onChange={(value) => setDraft({ ...draft, frequency: value || "Annual" })}
                />
              </label>
              <label>
                Last Service Date
                <input
                  type="date"
                  value={draft.lastServiceDate}
                  onChange={(event) => setDraft({ ...draft, lastServiceDate: event.target.value })}
                />
              </label>
              <label>
                Next Due
                <input type="date" value={draft.nextDueAt} onChange={(event) => setDraft({ ...draft, nextDueAt: event.target.value })} />
              </label>
              <label>
                Early Warning (days before due)
                <input
                  type="number"
                  min={0}
                  placeholder="30"
                  value={draft.earlyWarning ?? ""}
                  onChange={(event) => setDraft({ ...draft, earlyWarning: numberOrNull(event.target.value) })}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Interval ({draftBasis.unit} between services)
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder={draft.trackingBasis === "mileage" ? "e.g. 5000" : "e.g. 250"}
                  value={draft.intervalValue ?? ""}
                  onChange={(event) => setDraft({ ...draft, intervalValue: numberOrNull(event.target.value) })}
                />
              </label>
              <label>
                Last Service Reading ({draftBasis.unit})
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={draft.lastServiceReading ?? ""}
                  onChange={(event) => setDraft({ ...draft, lastServiceReading: numberOrNull(event.target.value) })}
                />
              </label>
              <label>
                Last Service Date
                <input
                  type="date"
                  value={draft.lastServiceDate}
                  onChange={(event) => setDraft({ ...draft, lastServiceDate: event.target.value })}
                />
              </label>
              <label>
                Early Warning ({draftBasis.unit} before due)
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder={draft.intervalValue ? String(Math.round(draft.intervalValue * 0.1)) : "10% of interval"}
                  value={draft.earlyWarning ?? ""}
                  onChange={(event) => setDraft({ ...draft, earlyWarning: numberOrNull(event.target.value) })}
                />
              </label>
              <div className="maintenance-field">
                <span className="maintenance-field-label">Current Reading</span>
                <span className="field-hint">
                  {!draft.assetRef
                    ? `Pick ${assetLabel.toLowerCase()} to see its latest reading`
                    : draftCurrent === null
                      ? "No reading recorded yet"
                      : `${formatReading(draftCurrent)} ${draftBasis.unit}`}
                  {draftCurrent !== null && draft.lastServiceReading !== null && draft.intervalValue
                    ? ` · next due at ${formatReading(draft.lastServiceReading + draft.intervalValue)}`
                    : ""}
                </span>
              </div>
            </>
          )}
          {isOilChangeType(typeNameById.get(draft.typeId)) ? (
            <div className="maintenance-field oil-change-note">
              <span className="maintenance-field-label">
                <Droplet size={14} aria-hidden="true" /> Oil Change
              </span>
              <span className="field-hint">
                Log Oil Change opens a new Oil and Filter Change ticket with this task checked. Completing it resets this task and
                fills Last Service Mileage and Engine Hours on the next inspection.
              </span>
              {draft.id && canSubmit ? (
                <button
                  type="button"
                  className="primary-button compact-button maintenance-icon-button"
                  onClick={() => {
                    const schedule = schedules.find((entry) => entry.id === draft.id);
                    if (!schedule) return;
                    setDraft(null);
                    onCreateWorkOrder(schedule);
                  }}
                >
                  <Droplet size={13} aria-hidden="true" /> Log Oil Change
                </button>
              ) : null}
            </div>
          ) : null}
          <label className="maintenance-checkbox-label">
            <span>Status</span>
            <span className="maintenance-checkbox-row">
              <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
              Active
            </span>
          </label>
        </EditDialog>
      ) : null}

      {historyFor ? (
        <div className="schedule-notice-backdrop" role="dialog" aria-modal="true" aria-label="PM history">
          <div className="schedule-notice maintenance-dialog">
            <h3>History: {historyFor.name}</h3>
            <p className="field-hint">
              Last service:{" "}
              {[
                historyFor.lastServiceDate ? formatDateKey(historyFor.lastServiceDate) : "",
                historyFor.lastServiceReading !== null ? formatReading(historyFor.lastServiceReading) : "",
              ]
                .filter(Boolean)
                .join(" at ") || "not recorded"}
            </p>
            {historyRecords.length === 0 ? (
              <p className="field-hint">No completed tickets have marked this task as performed yet.</p>
            ) : (
              <ul className="list-card">
                {historyRecords.map((record) => {
                  const entry = record.pmPerformed.find((item) => item.scheduleId === historyFor.id);
                  return (
                    <li key={record.id}>
                      <div>
                        <button type="button" className="edit-display-link" onClick={() => onOpenRecord(record.id)}>
                          {record.recordNumber}
                        </button>
                        <p>{record.description || record.typeName}</p>
                      </div>
                      <span className="field-hint">
                        {formatDateKey(record.completedDate)}
                        {entry?.reading !== null && entry?.reading !== undefined ? ` · ${formatReading(entry.reading)}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="header-actions">
              <button type="button" className="secondary-button compact-button" onClick={() => setHistoryFor(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** "Preventive Maintenance Performed" at the bottom of a ticket: the unit's PM tasks, so whoever does the work sees what's coming due. */
export function PmPerformedPanel({
  schedules,
  assetRef,
  readings,
  value,
  completed,
  disabled,
  onChange,
}: {
  schedules: PmSchedule[];
  assetRef: string;
  readings: MaintenanceReadings | null;
  value: PmPerformedEntry[];
  completed: boolean;
  disabled: boolean;
  onChange: (next: PmPerformedEntry[]) => void;
}) {
  const checkedIds = new Set(value.map((entry) => entry.scheduleId));
  const tasks = schedules
    .filter((schedule) => (schedule.active || checkedIds.has(schedule.id)) && (schedule.assetRef === assetRef || !schedule.assetRef))
    .map((schedule) => ({ schedule, info: pmStatus(schedule, readings) }))
    .sort((a, b) => STATUS_ORDER[a.info.status] - STATUS_ORDER[b.info.status] || a.schedule.name.localeCompare(b.schedule.name));

  const setEntry = (scheduleId: string, entry: PmPerformedEntry | null) => {
    const others = value.filter((item) => item.scheduleId !== scheduleId);
    onChange(entry ? [...others, entry] : others);
  };

  return (
    <article className="panel">
      <h3>Preventive Maintenance Performed</h3>
      {!assetRef ? (
        <p className="field-hint">Pick an apparatus to see its upcoming preventive maintenance.</p>
      ) : tasks.length === 0 ? (
        <p className="field-hint">No PM tasks set up for this apparatus. Add them under the Preventive Maintenance tab.</p>
      ) : (
        <>
          <p className="field-hint">
            {completed
              ? "Tasks checked when this ticket was completed."
              : "Check each task done on this ticket. They reset (new last service and next due) when the ticket is saved as Completed. A blank reading uses the ticket's mileage or hours."}
          </p>
          <div className="pm-performed-list">
            {tasks.map(({ schedule, info }) => {
              const entry = value.find((item) => item.scheduleId === schedule.id);
              const isDate = schedule.trackingBasis === "date";
              return (
                <div key={schedule.id} className={`pm-performed-row ${entry ? "pm-performed-row-checked" : ""}`}>
                  <label className="maintenance-checkbox-row">
                    <input
                      type="checkbox"
                      checked={Boolean(entry)}
                      disabled={disabled || completed}
                      onChange={(event) => setEntry(schedule.id, event.target.checked ? { scheduleId: schedule.id, reading: null } : null)}
                    />
                    <span className="pm-service">
                      <strong>{schedule.name}</strong>
                      <span className="field-hint">
                        {isDate ? schedule.frequency : `Every ${formatReading(schedule.intervalValue)} ${info.unit}`}
                        {info.lastService ? ` · Last ${info.lastService}` : ""}
                        {info.nextDue ? ` · Due ${info.nextDue}` : ""}
                      </span>
                    </span>
                  </label>
                  {isDate ? (
                    <span />
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      aria-label={`${schedule.name} actual ${info.basisLabel.toLowerCase()}`}
                      placeholder={`Actual ${info.basisLabel.toLowerCase()}`}
                      disabled={disabled || completed || !entry}
                      value={entry?.reading ?? ""}
                      onChange={(event) => setEntry(schedule.id, { scheduleId: schedule.id, reading: numberOrNull(event.target.value) })}
                    />
                  )}
                  <PmStatusBadge info={info} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}
