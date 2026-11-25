import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  EQUIPMENT_STATUSES,
  createEquipment,
  deleteEquipment,
  getEquipment,
  updateEquipment,
  type EquipmentItem,
} from "../../api/maintenance";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { useModuleLookups } from "../../moduleLookups";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { useMyPermissions } from "../../useMyPermissions";
import { errorText, toOptions } from "./maintenanceUtils";

type EquipmentDraft = Omit<EquipmentItem, "id"> & { id: string | null };

const EMPTY_DRAFT: EquipmentDraft = {
  id: null,
  name: "",
  equipmentType: "",
  serialNumber: "",
  locationRef: "",
  status: "In Service",
};

function statusClass(status: string): string {
  if (status === "In Service") return "tone tone-positive";
  if (status === "Out of Service") return "tone tone-critical";
  return "tone tone-neutral";
}

export function EquipmentListPage() {
  const grants = useMyPermissions();
  const canManage = grants?.["maintenance.manage"] === true;
  const lookups = useModuleLookups();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<EquipmentDraft | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      getEquipment()
        .then(setItems)
        .catch((loadError) => setError(errorText(loadError, "Could not load equipment.")))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const locationOptions = useMemo(
    () =>
      toOptions(
        Array.from(new Set([...lookups.apparatus.map((unit) => unit.unitId), ...lookups.stations])).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true }),
        ),
      ),
    [lookups.apparatus, lookups.stations],
  );

  const columns: ModuleTableColumn<EquipmentItem>[] = [
    { id: "name", label: "Name", width: 200, value: (row) => row.name, render: (row) => <strong>{row.name}</strong> },
    { id: "type", label: "Type", width: 150, value: (row) => row.equipmentType, render: (row) => row.equipmentType || "—" },
    { id: "serial", label: "Serial Number", width: 160, value: (row) => row.serialNumber, render: (row) => row.serialNumber || "—" },
    { id: "location", label: "Location", width: 160, value: (row) => row.locationRef, render: (row) => row.locationRef || "—" },
    {
      id: "status",
      label: "Status",
      width: 130,
      value: (row) => row.status,
      render: (row) => <span className={statusClass(row.status)}>{row.status}</span>,
    },
  ];

  const save = async () => {
    if (!draft) return;
    const { id, ...input } = draft;
    setSaving(true);
    setDialogError("");
    try {
      if (id) await updateEquipment(id, input);
      else await createEquipment(input);
      setDraft(null);
      await load();
    } catch (saveError) {
      setDialogError(errorText(saveError, "Could not save the equipment."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    setSaving(true);
    try {
      await deleteEquipment(draft.id);
      setDraft(null);
      await load();
    } catch (deleteError) {
      setDialogError(errorText(deleteError, "Could not delete the equipment."));
    } finally {
      setSaving(false);
    }
  };

  const textField = (key: "name" | "equipmentType" | "serialNumber", label: string, placeholder = "") =>
    draft ? (
      <label>
        {label}
        <input
          type="text"
          placeholder={placeholder}
          value={draft[key]}
          onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
        />
      </label>
    ) : null;

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Equipment List</h1>
          <p>SCBA, hose, ladders, extinguishers and other equipment. These items can be picked in Equipment Maintenance.</p>
        </div>
        {canManage ? (
          <button
            type="button"
            className="primary-button maintenance-icon-button"
            onClick={() => {
              setDialogError("");
              setDraft({ ...EMPTY_DRAFT });
            }}
          >
            <Plus size={15} aria-hidden="true" /> Add Equipment
          </button>
        ) : null}
      </header>
      {error ? <p className="field-error">{error}</p> : null}
      <article className="panel">
        {loading ? (
          <p className="field-hint">Loading...</p>
        ) : (
          <ModuleTable
            tableId="equipment-list"
            columns={columns}
            rows={items}
            rowKey={(row) => row.id}
            emptyText="No equipment added yet."
            defaultSort={{ id: "name", direction: "asc" }}
            onRowClick={(row) => {
              setDialogError("");
              setDraft({ ...row });
            }}
          />
        )}
      </article>
      {draft ? (
        <div className="schedule-notice-backdrop" role="dialog" aria-modal="true" aria-label="Equipment">
          <div className="schedule-notice maintenance-dialog">
            <h3>{draft.id ? (canManage ? "Edit Equipment" : "Equipment") : "Add Equipment"}</h3>
            <fieldset className="maintenance-fieldset" disabled={!canManage}>
              <div className="department-edit-grid">
                {textField("name", "Name", "For example SCBA Pack 12")}
                {textField("equipmentType", "Type", "SCBA, Hose, Ladder...")}
                {textField("serialNumber", "Serial Number")}
                <label>
                  Location
                  <NerisFlatSingleOptionSelect
                    inputId="equipment-location"
                    value={draft.locationRef}
                    options={locationOptions}
                    usePortal
                    allowClear
                    disabled={!canManage}
                    placeholder="Unit or station"
                    onChange={(value) => setDraft({ ...draft, locationRef: value })}
                  />
                </label>
                <label>
                  Status
                  <NerisFlatSingleOptionSelect
                    inputId="equipment-status"
                    value={draft.status}
                    options={toOptions(EQUIPMENT_STATUSES)}
                    usePortal
                    disabled={!canManage}
                    onChange={(value) => setDraft({ ...draft, status: value || "In Service" })}
                  />
                </label>
              </div>
            </fieldset>
            {dialogError ? <p className="field-error">{dialogError}</p> : null}
            <div className="header-actions">
              {canManage ? (
                <button type="button" className="primary-button compact-button" disabled={saving} onClick={() => void save()}>
                  {saving ? "Saving..." : "Save"}
                </button>
              ) : null}
              <button type="button" className="secondary-button compact-button" onClick={() => setDraft(null)}>
                {canManage ? "Cancel" : "Close"}
              </button>
              {canManage && draft.id ? (
                <button type="button" className="secondary-button compact-button" disabled={saving} onClick={() => void remove()}>
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
