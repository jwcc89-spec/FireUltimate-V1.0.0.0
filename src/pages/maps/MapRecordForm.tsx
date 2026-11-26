import { useState } from "react";
import { GEOFENCE_KINDS, type Geofence, type MapDocument, type MapMarkerType } from "../../api/maps";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { formatTimestamp24, readFileAsDataUrl } from "../maintenance/maintenanceUtils";
import { kindLabel, type GeofenceDraft, type MapPopup, type MarkerDraft } from "./mapUtils";

export function MapRecordForm({
  popup,
  types,
  geofences,
  editable,
  saving,
  error,
  onPopup,
  onSave,
  onDelete,
  onClose,
}: {
  popup: Exclude<MapPopup, { kind: "place" }>;
  types: MapMarkerType[];
  geofences: Geofence[];
  editable: boolean;
  saving: boolean;
  error: string;
  onPopup: (next: Exclude<MapPopup, { kind: "place" }>) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const tab = popup.tab;
  const setTab = (next: "info" | "docs") => {
    if (popup.kind === "marker") onPopup({ kind: "marker", tab: next, draft: popup.draft });
    else onPopup({ kind: "geofence", tab: next, draft: popup.draft });
  };
  const withDocuments = (documents: MapDocument[]) => {
    if (popup.kind === "marker") onPopup({ kind: "marker", tab: popup.tab, draft: { ...popup.draft, documents } });
    else onPopup({ kind: "geofence", tab: popup.tab, draft: { ...popup.draft, documents } });
  };
  const savedId = popup.draft.id;
  const [fileError, setFileError] = useState("");
  const kicker = popup.kind === "geofence" ? "GEOFENCES" : (types.find((type) => type.id === popup.draft.markerTypeId)?.name ?? "MARKER").toUpperCase();

  const addDocument = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_500_000) {
      setFileError("Each document must be smaller than about 1.5 MB for now.");
      return;
    }
    setFileError("");
    const dataUrl = await readFileAsDataUrl(file);
    const document: MapDocument = { id: "", name: file.name, type: file.type, size: file.size, dataUrl, addedBy: "", addedAt: "" };
    withDocuments([...popup.draft.documents, document]);
  };

  return (
    <div className="map-popup">
      <p className="field-hint map-kicker">{kicker}</p>
      <div className="map-popup-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "info"} onClick={() => setTab("info")}>
          Marker Information
        </button>
        <button type="button" role="tab" aria-selected={tab === "docs"} onClick={() => setTab("docs")}>
          Documents
        </button>
      </div>
      {tab === "info" ? (
        popup.kind === "marker" ? (
          <MarkerFields popup={popup} types={types} editable={editable} onPopup={onPopup} />
        ) : (
          <GeofenceFields popup={popup} geofences={geofences} editable={editable} onPopup={onPopup} />
        )
      ) : (
        <DocumentFields
          documents={popup.draft.documents}
          editable={editable}
          onAdd={(file) => void addDocument(file)}
          onRemove={(index) => withDocuments(popup.draft.documents.filter((_, item) => item !== index))}
        />
      )}
      {savedId ? <UpdatedLine draft={popup.draft} /> : null}
      {fileError || error ? <p className="field-error">{fileError || error}</p> : null}
      <div className="header-actions">
        {editable ? (
          <button type="button" className="primary-button compact-button" disabled={saving} onClick={onSave}>
            {saving ? "Saving..." : "Save"}
          </button>
        ) : null}
        <button type="button" className="secondary-button compact-button" onClick={onClose}>
          {editable ? "Cancel" : "Close"}
        </button>
      </div>
      {editable && savedId ? (
        <button type="button" className="secondary-button compact-button map-delete" disabled={saving} onClick={onDelete}>
          Delete
        </button>
      ) : null}
    </div>
  );
}

function UpdatedLine({ draft }: { draft: MarkerDraft | GeofenceDraft }) {
  const who = draft.updatedByName
    ? `${draft.updatedByName}${draft.departmentName ? `[${draft.departmentName}]` : ""}`
    : "";
  if (!who && !draft.updatedAt) return null;
  return (
    <p className="map-updated">
      <strong>Last Updated By:</strong>
      <br />
      {who}
      {draft.updatedAt ? <span className="field-hint">{formatTimestamp24(draft.updatedAt)}</span> : null}
    </p>
  );
}

function MarkerFields({
  popup,
  types,
  editable,
  onPopup,
}: {
  popup: Extract<MapPopup, { kind: "marker" }>;
  types: MapMarkerType[];
  editable: boolean;
  onPopup: (next: Extract<MapPopup, { kind: "marker" }>) => void;
}) {
  const draft = popup.draft;
  const set = (patch: Partial<MarkerDraft>) => onPopup({ ...popup, draft: { ...draft, ...patch } });
  const icon = types.find((type) => type.id === draft.markerTypeId)?.icon ?? "";
  if (!editable) {
    return (
      <div className="map-read">
        <p><strong>{draft.label}</strong></p>
        <p>{types.find((type) => type.id === draft.markerTypeId)?.name || "Marker"}</p>
        {draft.notes ? <p>{draft.notes}</p> : null}
        {draft.address ? <p>{draft.address}</p> : null}
        {icon === "hydrant" && draft.flowGpm ? <p>Flow {draft.flowGpm} GPM</p> : null}
      </div>
    );
  }
  return (
    <div className="department-edit-grid map-form-grid">
      <label className="map-span">
        Name
        <input type="text" value={draft.label} onChange={(event) => set({ label: event.target.value })} />
      </label>
      <label className="map-span">
        Type
        <NerisFlatSingleOptionSelect
          inputId="map-marker-type"
          value={draft.markerTypeId}
          options={types.map((type) => ({ value: type.id, label: type.name }))}
          usePortal
          placeholder="Marker type"
          onChange={(value) => set({ markerTypeId: value })}
        />
      </label>
      <label className="map-span">
        Notes
        <textarea rows={3} value={draft.notes} onChange={(event) => set({ notes: event.target.value })} />
      </label>
      <label className="map-span">
        Address
        <input type="text" value={draft.address} onChange={(event) => set({ address: event.target.value })} />
      </label>
      {icon === "hydrant" ? (
        <label className="map-span">
          Flow (GPM)
          <input
            type="text"
            inputMode="numeric"
            value={draft.flowGpm}
            placeholder="Blank uses the type color. Under 500 draws blue."
            onChange={(event) => set({ flowGpm: event.target.value })}
          />
        </label>
      ) : null}
      <label>
        Latitude
        <input type="text" inputMode="decimal" value={draft.latitude} onChange={(event) => set({ latitude: event.target.value })} />
      </label>
      <label>
        Longitude
        <input type="text" inputMode="decimal" value={draft.longitude} onChange={(event) => set({ longitude: event.target.value })} />
      </label>
    </div>
  );
}

function GeofenceFields({
  popup,
  geofences,
  editable,
  onPopup,
}: {
  popup: Extract<MapPopup, { kind: "geofence" }>;
  geofences: Geofence[];
  editable: boolean;
  onPopup: (next: Extract<MapPopup, { kind: "geofence" }>) => void;
}) {
  const draft = popup.draft;
  const set = (patch: Partial<GeofenceDraft>) => onPopup({ ...popup, draft: { ...draft, ...patch } });
  const parents = geofences.filter((area) => area.id !== draft.id);
  if (!editable) {
    return (
      <div className="map-read">
        <p><strong>{draft.name}</strong></p>
        <p><strong>Geofence description</strong></p>
        <p>{draft.description || "—"}</p>
        <p>{kindLabel(draft.kind)}{draft.parentId ? ` · inside ${parents.find((area) => area.id === draft.parentId)?.name ?? "another area"}` : ""}</p>
      </div>
    );
  }
  return (
    <div className="department-edit-grid map-form-grid">
      <label className="map-span">
        Name
        <input type="text" value={draft.name} onChange={(event) => set({ name: event.target.value })} />
      </label>
      <label className="map-span">
        Geofence description
        <textarea rows={3} value={draft.description} onChange={(event) => set({ description: event.target.value })} />
      </label>
      <label>
        Kind
        <NerisFlatSingleOptionSelect
          inputId="map-geofence-kind"
          value={draft.kind}
          options={GEOFENCE_KINDS}
          usePortal
          onChange={(value) => set({ kind: value || "custom" })}
        />
      </label>
      <label>
        Color
        <input type="color" value={draft.color} onChange={(event) => set({ color: event.target.value })} />
      </label>
      <label className="map-span">
        Inside
        <NerisFlatSingleOptionSelect
          inputId="map-geofence-parent"
          value={draft.parentId}
          options={parents.map((area) => ({ value: area.id, label: area.name }))}
          usePortal
          allowClear
          placeholder="No parent area"
          onChange={(value) => set({ parentId: value })}
        />
      </label>
      <p className="field-hint map-span">To change the outline, delete this area and draw it again.</p>
      <label className="map-span">
        Linked property
        <input
          type="text"
          value={draft.linkedPropertyId}
          placeholder="Optional until Fire Prevention is built"
          onChange={(event) => set({ linkedPropertyId: event.target.value })}
        />
      </label>
      <label className="map-span">
        Linked pre-plan
        <input
          type="text"
          value={draft.linkedPrePlanId}
          placeholder="Optional until Fire Prevention is built"
          onChange={(event) => set({ linkedPrePlanId: event.target.value })}
        />
      </label>
    </div>
  );
}

function DocumentFields({
  documents,
  editable,
  onAdd,
  onRemove,
}: {
  documents: MapDocument[];
  editable: boolean;
  onAdd: (file: File | undefined) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="map-docs">
      {documents.length === 0 ? <p className="field-hint">No documents yet. A pre-plan PDF or a lot layout can be attached here.</p> : null}
      <ul>
        {documents.map((document, index) => (
          <li key={`${document.id || document.name}-${index}`}>
            <a href={document.dataUrl} download={document.name}>{document.name}</a>
            {editable ? (
              <button type="button" className="secondary-button compact-button" onClick={() => onRemove(index)}>
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {editable ? (
        <label className="field-hint">
          Add a PDF or picture
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(event) => {
              onAdd(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      ) : null}
    </div>
  );
}
