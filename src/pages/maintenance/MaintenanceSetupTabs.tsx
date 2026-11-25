import { type ReactNode, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Clock, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import {
  MAINTENANCE_FREQUENCIES,
  createMaintenanceType,
  createPmSchedule,
  createVendor,
  deleteMaintenanceType,
  deletePmSchedule,
  deleteVendor,
  updateMaintenanceType,
  updatePmSchedule,
  updateVendor,
  type MaintenanceAssetKind,
  type MaintenanceType,
  type PmSchedule,
  type Vendor,
} from "../../api/maintenance";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import type { NerisValueOption } from "../../nerisMetadata";
import { addDaysKey, errorText, formatDateKey, toOptions, todayKey } from "./maintenanceUtils";

interface EditDialogProps {
  title: string;
  error: string;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
  children: ReactNode;
}

function EditDialog({ title, error, saving, onSave, onCancel, onDelete, readOnly, children }: EditDialogProps) {
  return (
    <div className="schedule-notice-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="schedule-notice maintenance-dialog">
        <h3>{title}</h3>
        <fieldset className="maintenance-fieldset" disabled={readOnly}>
          <div className="department-edit-grid">{children}</div>
        </fieldset>
        {error ? <p className="field-error">{error}</p> : null}
        <div className="header-actions">
          {readOnly ? null : (
            <button type="button" className="primary-button compact-button" disabled={saving} onClick={onSave}>
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          <button type="button" className="secondary-button compact-button" onClick={onCancel}>
            {readOnly ? "Close" : "Cancel"}
          </button>
          {onDelete && !readOnly ? (
            <button type="button" className="secondary-button compact-button" disabled={saving} onClick={onDelete}>
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function useDialogSave() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const run = async (work: () => Promise<void>, fallback: string) => {
    setSaving(true);
    setError("");
    try {
      await work();
      return true;
    } catch (saveError) {
      setError(errorText(saveError, fallback));
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, setError, run };
}

// ----- Types -----

interface TypeDraft {
  id: string | null;
  isSystem: boolean;
  name: string;
  category: string;
  nfpaStandard: string;
  defaultFrequency: string;
  description: string;
}

export function MaintenanceTypesTab({
  types,
  canManage,
  onChanged,
}: {
  types: MaintenanceType[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<TypeDraft | null>(null);
  const [rowError, setRowError] = useState("");
  const dialog = useDialogSave();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return types;
    return types.filter((type) =>
      [type.name, type.nfpaStandard, type.description].some((value) => value.toLowerCase().includes(term)),
    );
  }, [search, types]);
  const groups = useMemo(() => {
    const byCategory = new Map<string, MaintenanceType[]>();
    for (const type of filtered) {
      byCategory.set(type.category, [...(byCategory.get(type.category) ?? []), type]);
    }
    return Array.from(byCategory.entries());
  }, [filtered]);
  const enabledCount = types.filter((type) => type.enabled).length;
  const systemCount = types.filter((type) => type.isSystem).length;

  const toggle = async (type: MaintenanceType) => {
    setRowError("");
    try {
      await updateMaintenanceType(type.id, { enabled: !type.enabled });
      onChanged();
    } catch (toggleError) {
      setRowError(errorText(toggleError, "Could not change the type."));
    }
  };

  const remove = async (type: MaintenanceType) => {
    setRowError("");
    try {
      await deleteMaintenanceType(type.id);
      onChanged();
    } catch (deleteError) {
      setRowError(errorText(deleteError, "Could not delete the type."));
    }
  };

  const save = async () => {
    if (!draft) return;
    const ok = await dialog.run(async () => {
      const input = {
        name: draft.name,
        category: draft.category,
        nfpaStandard: draft.nfpaStandard,
        defaultFrequency: draft.defaultFrequency,
        description: draft.description,
      };
      if (draft.id) await updateMaintenanceType(draft.id, input);
      else await createMaintenanceType(input);
    }, "Could not save the type.");
    if (ok) {
      setDraft(null);
      onChanged();
    }
  };

  return (
    <section className="page-section">
      <div className="department-editor-toolbar">
        <p className="field-hint">
          {enabledCount} of {types.length} enabled ({systemCount} system defaults)
        </p>
        {canManage ? (
          <button
            type="button"
            className="primary-button compact-button maintenance-icon-button"
            onClick={() =>
              setDraft({
                id: null,
                isSystem: false,
                name: "",
                category: "Preventive",
                nfpaStandard: "",
                defaultFrequency: "",
                description: "",
              })
            }
          >
            <Plus size={14} aria-hidden="true" /> Add Type
          </button>
        ) : null}
      </div>
      <input
        type="search"
        className="maintenance-search"
        placeholder="Search by name or NFPA standard..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {rowError ? <p className="field-error">{rowError}</p> : null}
      {groups.map(([category, rows]) => (
        <article key={category} className="panel">
          <h3>
            {category} <span className="workflow-chip">{rows.length}</span>
          </h3>
          <ul className="maintenance-type-list">
            {rows.map((type) => (
              <li key={type.id}>
                <div className="maintenance-type-name">
                  {type.isSystem ? <Lock size={14} aria-label="System default" /> : null}
                  <strong>{type.name}</strong>
                  {type.nfpaStandard ? <span className="workflow-chip">{type.nfpaStandard}</span> : null}
                  {type.defaultFrequency ? <span className="tone tone-neutral">{type.defaultFrequency}</span> : null}
                  {type.description ? <p className="field-hint">{type.description}</p> : null}
                </div>
                <div className="header-actions">
                  <label className="maintenance-checkbox-row">
                    <input
                      type="checkbox"
                      checked={type.enabled}
                      disabled={!canManage}
                      onChange={() => void toggle(type)}
                    />
                    {type.enabled ? "On" : "Off"}
                  </label>
                  {canManage ? (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Edit ${type.name}`}
                      onClick={() => {
                        dialog.setError("");
                        setDraft({ ...type });
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                  ) : null}
                  {canManage && !type.isSystem ? (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Delete ${type.name}`}
                      onClick={() => void remove(type)}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </article>
      ))}
      {draft ? (
        <EditDialog
          title={draft.id ? "Edit Type" : "Add Type"}
          error={dialog.error}
          saving={dialog.saving}
          onSave={() => void save()}
          onCancel={() => setDraft(null)}
        >
          <label>
            Name
            <input
              type="text"
              value={draft.name}
              disabled={draft.isSystem}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label>
            Category
            <NerisFlatSingleOptionSelect
              inputId="maintenance-type-category"
              value={draft.category}
              options={toOptions(["Preventive", "Corrective"])}
              usePortal
              onChange={(value) => setDraft({ ...draft, category: value || "Preventive" })}
            />
          </label>
          <label>
            NFPA Standard
            <input
              type="text"
              placeholder="For example NFPA 1911"
              value={draft.nfpaStandard}
              onChange={(event) => setDraft({ ...draft, nfpaStandard: event.target.value })}
            />
          </label>
          <label>
            Default Frequency
            <NerisFlatSingleOptionSelect
              inputId="maintenance-type-frequency"
              value={draft.defaultFrequency}
              options={toOptions(MAINTENANCE_FREQUENCIES)}
              usePortal
              allowClear
              placeholder="None"
              onChange={(value) => setDraft({ ...draft, defaultFrequency: value })}
            />
          </label>
          <label className="maintenance-span-2">
            Description
            <input
              type="text"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </label>
        </EditDialog>
      ) : null}
    </section>
  );
}

// ----- Vendors -----

const EMPTY_VENDOR: Omit<Vendor, "id"> = { name: "", contact: "", phone: "", email: "", website: "", services: "" };

export function MaintenanceVendorsTab({
  vendors,
  canManage,
  onChanged,
}: {
  vendors: Vendor[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<(Omit<Vendor, "id"> & { id: string | null }) | null>(null);
  const dialog = useDialogSave();

  const columns: ModuleTableColumn<Vendor>[] = [
    { id: "name", label: "Name", width: 180, value: (row) => row.name, render: (row) => <strong>{row.name}</strong> },
    { id: "contact", label: "Contact Name", value: (row) => row.contact, render: (row) => row.contact || "—" },
    { id: "phone", label: "Phone", width: 130, value: (row) => row.phone, render: (row) => row.phone || "—" },
    { id: "email", label: "Email", width: 190, value: (row) => row.email, render: (row) => row.email || "—" },
    { id: "website", label: "Website", value: (row) => row.website, render: (row) => row.website || "—" },
    { id: "services", label: "Services", width: 220, value: (row) => row.services, render: (row) => row.services || "—" },
  ];

  const save = async () => {
    if (!draft) return;
    const { id, ...input } = draft;
    const ok = await dialog.run(async () => {
      if (id) await updateVendor(id, input);
      else await createVendor(input);
    }, "Could not save the vendor.");
    if (ok) {
      setDraft(null);
      onChanged();
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    const id = draft.id;
    const ok = await dialog.run(() => deleteVendor(id), "Could not delete the vendor.");
    if (ok) {
      setDraft(null);
      onChanged();
    }
  };

  const fields: { key: keyof Omit<Vendor, "id">; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "contact", label: "Contact Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "website", label: "Website" },
    { key: "services", label: "Services" },
  ];

  return (
    <section className="page-section">
      <div className="department-editor-toolbar">
        <p className="field-hint">Vendors are shared by Apparatus and Equipment maintenance.</p>
        {canManage ? (
          <button
            type="button"
            className="primary-button compact-button maintenance-icon-button"
            onClick={() => {
              dialog.setError("");
              setDraft({ id: null, ...EMPTY_VENDOR });
            }}
          >
            <Plus size={14} aria-hidden="true" /> Add Vendor
          </button>
        ) : null}
      </div>
      <article className="panel">
        <ModuleTable
          tableId="maintenance-vendors"
          columns={columns}
          rows={vendors}
          rowKey={(row) => row.id}
          emptyText="No vendors configured"
          defaultSort={{ id: "name", direction: "asc" }}
          onRowClick={(row) => {
            dialog.setError("");
            setDraft({ ...row });
          }}
        />
      </article>
      {draft ? (
        <EditDialog
          title={draft.id ? (canManage ? "Edit Vendor" : "Vendor") : "Add Vendor"}
          error={dialog.error}
          saving={dialog.saving}
          readOnly={!canManage}
          onSave={() => void save()}
          onCancel={() => setDraft(null)}
          onDelete={draft.id ? () => void remove() : undefined}
        >
          {fields.map((field) => (
            <label key={field.key}>
              {field.label}
              <input
                type="text"
                value={draft[field.key]}
                onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
              />
            </label>
          ))}
        </EditDialog>
      ) : null}
    </section>
  );
}

// ----- PM Schedules -----

type ScheduleDraft = Omit<PmSchedule, "id"> & { id: string | null };

export function MaintenanceSchedulesTab({
  schedules,
  types,
  assetKind,
  assetOptions,
  canManage,
  onChanged,
}: {
  schedules: PmSchedule[];
  types: MaintenanceType[];
  assetKind: MaintenanceAssetKind;
  assetOptions: NerisValueOption[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const dialog = useDialogSave();
  const today = todayKey();
  const weekEnd = addDaysKey(today, 7);
  const kindSchedules = schedules.filter((schedule) => schedule.assetKind === assetKind);
  const active = kindSchedules.filter((schedule) => schedule.active);
  const dueThisWeek = active.filter((schedule) => schedule.nextDueAt >= today && schedule.nextDueAt <= weekEnd);
  const overdue = active.filter((schedule) => schedule.nextDueAt && schedule.nextDueAt < today);
  const typeNameById = new Map(types.map((type) => [type.id, type.name]));
  const assetLabelByRef = new Map(assetOptions.map((option) => [option.value, option.label]));

  const columns: ModuleTableColumn<PmSchedule>[] = [
    { id: "name", label: "Schedule Name", width: 190, value: (row) => row.name, render: (row) => <strong>{row.name}</strong> },
    {
      id: "task",
      label: "Maintenance Task",
      width: 200,
      value: (row) => typeNameById.get(row.typeId) ?? "",
      render: (row) => typeNameById.get(row.typeId) ?? "—",
    },
    {
      id: "asset",
      label: "Asset",
      value: (row) => assetLabelByRef.get(row.assetRef) ?? row.assetRef,
      render: (row) => assetLabelByRef.get(row.assetRef) ?? (row.assetRef || "All"),
    },
    { id: "frequency", label: "Frequency", width: 120, value: (row) => row.frequency, render: (row) => row.frequency },
    {
      id: "nextDue",
      label: "Next Due",
      width: 120,
      value: (row) => row.nextDueAt,
      render: (row) =>
        row.nextDueAt ? (
          <span className={row.active && row.nextDueAt < today ? "tone tone-critical" : undefined}>
            {formatDateKey(row.nextDueAt)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "status",
      label: "Status",
      width: 100,
      value: (row) => (row.active ? "Active" : "Paused"),
      render: (row) => (
        <span className={`tone ${row.active ? "tone-positive" : "tone-neutral"}`}>{row.active ? "Active" : "Paused"}</span>
      ),
    },
  ];

  const save = async () => {
    if (!draft) return;
    const { id, ...input } = draft;
    const ok = await dialog.run(async () => {
      if (id) await updatePmSchedule(id, input);
      else await createPmSchedule(input);
    }, "Could not save the schedule.");
    if (ok) {
      setDraft(null);
      onChanged();
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    const id = draft.id;
    const ok = await dialog.run(() => deletePmSchedule(id), "Could not delete the schedule.");
    if (ok) {
      setDraft(null);
      onChanged();
    }
  };

  const typeOptions = types.filter((type) => type.enabled).map((type) => ({ value: type.id, label: type.name }));

  return (
    <section className="page-section">
      <p className="field-hint">Manage preventive maintenance schedules.</p>
      <div className="stat-grid">
        <article className="stat-card">
          <p>
            <CalendarDays size={14} aria-hidden="true" /> Active Schedules
          </p>
          <strong>{active.length}</strong>
        </article>
        <article className="stat-card">
          <p>
            <Clock size={14} aria-hidden="true" /> Due This Week
          </p>
          <strong>{dueThisWeek.length}</strong>
        </article>
        <article className="stat-card">
          <p>
            <AlertTriangle size={14} aria-hidden="true" /> Overdue
          </p>
          <strong className={overdue.length > 0 ? "maintenance-critical-text" : undefined}>{overdue.length}</strong>
        </article>
      </div>
      <div className="department-editor-toolbar">
        <p className="field-hint">Records are not created from schedules automatically yet.</p>
        {canManage ? (
          <button
            type="button"
            className="primary-button compact-button maintenance-icon-button"
            onClick={() => {
              dialog.setError("");
              setDraft({
                id: null,
                name: "",
                typeId: "",
                assetKind,
                assetRef: "",
                frequency: "Annual",
                nextDueAt: "",
                active: true,
              });
            }}
          >
            <Plus size={14} aria-hidden="true" /> New PM Schedule
          </button>
        ) : null}
      </div>
      <article className="panel">
        <ModuleTable
          tableId={`maintenance-schedules-${assetKind}`}
          columns={columns}
          rows={kindSchedules}
          rowKey={(row) => row.id}
          emptyText="No PM schedules found. Create your first preventive maintenance schedule."
          defaultSort={{ id: "nextDue", direction: "asc" }}
          onRowClick={(row) => {
            dialog.setError("");
            setDraft({ ...row });
          }}
        />
      </article>
      {draft ? (
        <EditDialog
          title={draft.id ? (canManage ? "Edit PM Schedule" : "PM Schedule") : "New PM Schedule"}
          error={dialog.error}
          saving={dialog.saving}
          readOnly={!canManage}
          onSave={() => void save()}
          onCancel={() => setDraft(null)}
          onDelete={draft.id ? () => void remove() : undefined}
        >
          <label>
            Schedule Name
            <input type="text" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            Maintenance Task
            <NerisFlatSingleOptionSelect
              inputId="pm-schedule-type"
              value={draft.typeId}
              options={typeOptions}
              usePortal
              allowClear
              disabled={!canManage}
              placeholder="Select type..."
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
            Asset
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
            Next Due
            <input type="date" value={draft.nextDueAt} onChange={(event) => setDraft({ ...draft, nextDueAt: event.target.value })} />
          </label>
          <label className="maintenance-checkbox-label">
            <span>Status</span>
            <span className="maintenance-checkbox-row">
              <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
              Active
            </span>
          </label>
        </EditDialog>
      ) : null}
    </section>
  );
}
