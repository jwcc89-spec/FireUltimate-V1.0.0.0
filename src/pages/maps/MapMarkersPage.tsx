import { useState } from "react";
import { Plus } from "lucide-react";
import {
  createMarkerType,
  deleteMarkerType,
  updateMarkerType,
  MARKER_ICONS,
  type MapMarkerType,
} from "../../api/maps";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { useMyPermissions } from "../../useMyPermissions";
import { EditDialog } from "../maintenance/MaintenanceSetupTabs";
import { useDialogSave } from "../maintenance/useDialogSave";
import { kindLabel } from "./mapUtils";
import { MapCanvas, type MapFocus } from "./MapCanvas";
import { MapPin } from "./MapPin";
import { useMapLibrary } from "./useMapLibrary";

interface TypeDraft {
  id: string | null;
  name: string;
  icon: string;
  color: string;
}

const EMPTY_TYPE: TypeDraft = { id: null, name: "", icon: "marker", color: "#2563eb" };

/** Map Markers: right-click to add, click to edit, drag to move. Same screen as the current marker editor. */
export function MapMarkersPage() {
  const grants = useMyPermissions();
  const canManage = grants?.["maps.manage"] === true;
  const library = useMapLibrary();
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [draft, setDraft] = useState<TypeDraft | null>(null);
  const dialog = useDialogSave();

  const typeColumns: ModuleTableColumn<MapMarkerType>[] = [
    {
      id: "color",
      label: "Icon",
      width: 90,
      value: (row) => row.name,
      render: (row) => <MapPin icon={row.icon} color={row.color} />,
    },
    { id: "name", label: "Name", width: 220, value: (row) => row.name, render: (row) => <strong>{row.name}</strong> },
    {
      id: "icon",
      label: "Symbol",
      width: 160,
      value: (row) => row.icon,
      render: (row) => MARKER_ICONS.find((icon) => icon.value === row.icon)?.label ?? row.icon,
    },
  ];

  const saveType = () => {
    if (!draft) return;
    void dialog.run(async () => {
      if (!draft.name.trim()) throw new Error("Enter a name for the marker type.");
      const input = { name: draft.name.trim(), icon: draft.icon, color: draft.color };
      if (draft.id) await updateMarkerType(draft.id, input);
      else await createMarkerType(input);
      setDraft(null);
      library.reload();
    }, "Could not save the marker type.");
  };

  const removeType = () => {
    if (!draft?.id) return;
    void dialog.run(async () => {
      await deleteMarkerType(draft.id!);
      setDraft(null);
      library.reload();
    }, "Could not delete the marker type.");
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Map Markers</h1>
          <p>Right-click the map to add a marker. Click once to select it, then click again to edit. Drag a selected marker to move it.</p>
        </div>
      </header>
      {library.error ? <p className="field-error">{library.error}</p> : null}
      {library.loading ? <p className="field-hint">Loading...</p> : null}
      <ul className="map-help">
        <li><strong>Add a marker:</strong> right-click the spot, or use Add marker.</li>
        <li><strong>Edit a marker:</strong> click once to select it, then click again.</li>
        <li><strong>Move a marker:</strong> select it, then drag it.</li>
        <li><strong>Delete a marker:</strong> open it and use Delete at the bottom. This needs the map permission.</li>
        <li><strong>Search:</strong> type a marker name or an address, then Search.</li>
        <li><strong>Draw an area:</strong> pick a color, choose Draw area, and close the shape. Click the area to name it and attach a document.</li>
      </ul>
      <MapCanvas
        mode="edit"
        markers={library.markers}
        types={library.types}
        geofences={library.geofences}
        canManage={canManage}
        focus={focus}
        onReload={library.reload}
      />

      <article className="panel">
        <div className="panel-header">
          <h3>Marker types</h3>
          {canManage ? (
            <button
              type="button"
              className="primary-button compact-button maintenance-icon-button"
              onClick={() => {
                dialog.setError("");
                setDraft({ ...EMPTY_TYPE });
              }}
            >
              <Plus size={15} aria-hidden="true" /> Add type
            </button>
          ) : null}
        </div>
        <ModuleTable
          tableId="map-marker-types"
          columns={typeColumns}
          rows={library.types}
          rowKey={(row) => row.id}
          emptyText="No marker types yet."
          defaultSort={{ id: "name", direction: "asc" }}
          onRowClick={(row) => {
            dialog.setError("");
            setDraft({ id: row.id, name: row.name, icon: row.icon, color: row.color });
          }}
        />
      </article>

      <article className="panel">
        <div className="panel-header">
          <h3>Geofences</h3>
        </div>
        <ModuleTable
          tableId="map-geofences"
          columns={[
            { id: "name", label: "Name", width: 220, value: (row) => row.name, render: (row) => <strong>{row.name}</strong> },
            { id: "kind", label: "Kind", width: 140, value: (row) => kindLabel(row.kind), render: (row) => kindLabel(row.kind) },
            { id: "updated", label: "Last updated", width: 180, value: (row) => row.updatedAt, render: (row) => row.updatedByName || "—" },
          ]}
          rows={library.geofences}
          rowKey={(row) => row.id}
          emptyText="No areas drawn yet. Use Draw area on the map."
          defaultSort={{ id: "name", direction: "asc" }}
          onRowClick={(row) => setFocus({ token: Date.now(), kind: "geofence", id: row.id })}
        />
      </article>

      {draft ? (
        <EditDialog
          title={draft.id ? (canManage ? "Edit marker type" : "Marker type") : "Add marker type"}
          error={dialog.error}
          saving={dialog.saving}
          readOnly={!canManage}
          onSave={saveType}
          onCancel={() => setDraft(null)}
          onDelete={draft.id && canManage ? removeType : undefined}
        >
          <label>
            Name
            <input type="text" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            Symbol
            <NerisFlatSingleOptionSelect
              inputId="marker-type-icon"
              value={draft.icon}
              options={MARKER_ICONS}
              usePortal
              disabled={!canManage}
              onChange={(value) => setDraft({ ...draft, icon: value || "marker" })}
            />
          </label>
          <label>
            Color
            <input type="color" value={draft.color} disabled={!canManage} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
          </label>
        </EditDialog>
      ) : null}
    </section>
  );
}
