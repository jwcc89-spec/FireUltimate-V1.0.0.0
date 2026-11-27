import { useRef, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { Camera, ImageUp, LocateFixed, Trash2 } from "lucide-react";
import { geocodeAddress } from "../../api/maps";
import {
  OCCUPANCY_TYPES,
  PROPERTY_TYPES,
  createProperty,
  updateProperty,
  type PropertyDetail,
  type PropertyInput,
} from "../../api/prevention";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { distanceFeet, mapsApiKey, type LatLng } from "../maps/mapUtils";
import { errorText, toOptions } from "../maintenance/maintenanceUtils";
import { useDialogSave } from "../maintenance/useDialogSave";
import { AerialPanel, StreetViewPanel } from "./PropertyMapPanels";
import { EMPTY_PROPERTY, inputFromDetail, shrinkPhoto, type StreetViewCamera } from "./preventionUtils";

const CAMERA_RESET_FEET = 150;

/** Create or edit a property: the form on the left, live Street View and Aerial View on the right. */
export function PropertyForm({
  existing,
  fallbackCenter,
  onSaved,
  onCancel,
}: {
  existing: PropertyDetail | null;
  fallbackCenter: LatLng | null;
  onSaved: (property: PropertyDetail) => void;
  onCancel: () => void;
}) {
  const apiKey = mapsApiKey();
  const [draft, setDraft] = useState<PropertyInput>(() => (existing ? inputFromDetail(existing) : { ...EMPTY_PROPERTY }));
  const [lookup, setLookup] = useState<{ state: "idle" | "busy" | "missed"; key: string }>({ state: "idle", key: "" });
  const [photoError, setPhotoError] = useState("");
  const { saving, error, run } = useDialogSave();
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const point: LatLng | null =
    draft.latitude != null && draft.longitude != null ? { lat: draft.latitude, lng: draft.longitude } : null;
  const camera: StreetViewCamera = {
    panoId: draft.streetViewPanoId,
    heading: draft.streetViewHeading,
    pitch: draft.streetViewPitch,
    zoom: draft.streetViewZoom,
  };
  const searchText = [draft.address, draft.city, draft.state, draft.postalCode].filter((part) => part.trim()).join(", ");

  const update = (patch: Partial<PropertyInput>) => setDraft((previous) => ({ ...previous, ...patch }));

  const placePin = (next: LatLng) =>
    setDraft((previous) => {
      const before =
        previous.latitude != null && previous.longitude != null ? { lat: previous.latitude, lng: previous.longitude } : null;
      const movedFar = !before || distanceFeet(before, next) > CAMERA_RESET_FEET;
      return {
        ...previous,
        latitude: Math.round(next.lat * 1e6) / 1e6,
        longitude: Math.round(next.lng * 1e6) / 1e6,
        ...(movedFar
          ? { streetViewPanoId: "", streetViewHeading: null, streetViewPitch: null, streetViewZoom: null }
          : {}),
      };
    });

  const findOnMap = async (automatic: boolean) => {
    if (!draft.address.trim()) return;
    if (automatic && (point || lookup.key === searchText)) return;
    setLookup({ state: "busy", key: searchText });
    try {
      const found = await geocodeAddress(searchText);
      placePin({ lat: found.latitude, lng: found.longitude });
      setLookup({ state: "idle", key: searchText });
    } catch {
      setLookup({ state: "missed", key: searchText });
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError("");
    try {
      update({ photo: await shrinkPhoto(file) });
    } catch (photoFailure) {
      setPhotoError(errorText(photoFailure, "Could not use that picture."));
    }
  };

  const save = () =>
    void run(async () => {
      const saved = existing ? await updateProperty(existing.id, draft) : await createProperty(draft);
      onSaved(saved);
    }, "Could not save the property.");

  const coordinateField = (key: "latitude" | "longitude", label: string) => (
    <label>
      {label}
      <input
        type="number"
        step="0.000001"
        value={draft[key] ?? ""}
        onChange={(event) => {
          const raw = event.target.value;
          update({ [key]: raw === "" ? null : Number(raw) });
        }}
      />
    </label>
  );

  const textField = (key: "name" | "unit" | "city" | "state" | "postalCode", label: string, placeholder = "") => (
    <label>
      {label}
      <input
        type="text"
        value={draft[key]}
        placeholder={placeholder}
        onChange={(event) => update({ [key]: event.target.value })}
        onBlur={key === "name" || key === "unit" ? undefined : () => void findOnMap(true)}
      />
    </label>
  );

  return (
    <section className="page-section">
      <div className="maintenance-breadcrumb">
        <button type="button" className="edit-display-link" onClick={onCancel}>
          Properties
        </button>
        <span>&gt; {existing ? existing.address : "Create"}</span>
      </div>
      <div className="header-actions">
        <button type="button" className="primary-button compact-button" disabled={saving} onClick={save}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" className="secondary-button compact-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error ? <p className="field-error">{error}</p> : null}

      <div className="property-layout">
        <article className="panel property-form">
          <div className="property-form-grid">
            <label className="property-form-wide">
              Occupant or Business Name
              <input
                type="text"
                value={draft.name}
                placeholder="Optional, for example Meadowview Theatre"
                onChange={(event) => update({ name: event.target.value })}
              />
            </label>
            <label className="property-form-wide">
              Address *
              <div className="property-address-row">
                <input
                  type="text"
                  value={draft.address}
                  placeholder="Street address"
                  onChange={(event) => update({ address: event.target.value })}
                  onBlur={() => void findOnMap(true)}
                />
                <button
                  type="button"
                  className="secondary-button compact-button maintenance-icon-button"
                  disabled={!draft.address.trim() || lookup.state === "busy"}
                  onClick={() => void findOnMap(false)}
                >
                  <LocateFixed size={14} aria-hidden="true" /> {lookup.state === "busy" ? "Finding..." : "Find on map"}
                </button>
              </div>
            </label>
            {textField("unit", "Suite / Unit / Lot")}
            {textField("city", "City")}
            {textField("state", "State", "IL")}
            {textField("postalCode", "Postal Code")}
            <label>
              Property Type
              <NerisFlatSingleOptionSelect
                inputId="property-type"
                value={draft.propertyType}
                options={PROPERTY_TYPES.map((entry) => ({ value: entry.value, label: entry.label }))}
                usePortal
                onChange={(value) => update({ propertyType: value || "residential" })}
              />
            </label>
            <label>
              Occupancy Type
              <NerisFlatSingleOptionSelect
                inputId="property-occupancy"
                value={draft.occupancyType}
                options={toOptions(OCCUPANCY_TYPES)}
                usePortal
                allowClear
                placeholder="Select occupancy type"
                onChange={(value) => update({ occupancyType: value })}
              />
            </label>
            <label>
              Square Footage
              <input
                type="number"
                min={0}
                value={draft.squareFeet}
                onChange={(event) => update({ squareFeet: event.target.value })}
              />
            </label>
            <label>
              Year Built
              <input
                type="number"
                min={1600}
                value={draft.yearBuilt}
                onChange={(event) => update({ yearBuilt: event.target.value })}
              />
            </label>
            {coordinateField("latitude", "Latitude")}
            {coordinateField("longitude", "Longitude")}
            <label className="property-form-wide">
              Notes
              <textarea rows={4} value={draft.notes} onChange={(event) => update({ notes: event.target.value })} />
            </label>
          </div>
          {lookup.state === "missed" ? (
            <p className="field-hint">
              The address lookup could not place this address. Click the Aerial View map to drop the pin on the building.
            </p>
          ) : null}

          <div className="property-photo-section">
            <h3>Building Photo</h3>
            <p className="field-hint">
              A photo you take or upload replaces the Street View thumbnail. Pictures are shrunk before saving.
            </p>
            {draft.photo ? <img className="property-photo-preview" src={draft.photo} alt="Building" /> : null}
            <div className="header-actions">
              <button
                type="button"
                className="secondary-button compact-button maintenance-icon-button"
                onClick={() => cameraInput.current?.click()}
              >
                <Camera size={14} aria-hidden="true" /> Take Photo
              </button>
              <button
                type="button"
                className="secondary-button compact-button maintenance-icon-button"
                onClick={() => fileInput.current?.click()}
              >
                <ImageUp size={14} aria-hidden="true" /> Upload Photo
              </button>
              {draft.photo ? (
                <button
                  type="button"
                  className="secondary-button compact-button maintenance-icon-button"
                  onClick={() => update({ photo: "" })}
                >
                  <Trash2 size={14} aria-hidden="true" /> Remove Photo
                </button>
              ) : null}
            </div>
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(event) => {
                void pickPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => {
                void pickPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {photoError ? <p className="field-error">{photoError}</p> : null}
          </div>
        </article>

        <aside className="property-side">
          {apiKey ? (
            <APIProvider apiKey={apiKey}>
              <StreetViewPanel
                point={point}
                saved={camera}
                onUseView={(next) =>
                  update({
                    streetViewPanoId: next.panoId,
                    streetViewHeading: next.heading,
                    streetViewPitch: next.pitch,
                    streetViewZoom: next.zoom,
                  })
                }
              />
              <AerialPanel point={point} address={searchText} fallbackCenter={fallbackCenter} onPlace={placePin} />
            </APIProvider>
          ) : (
            <p className="field-hint">The Street View and Aerial panels need the Google Maps browser key.</p>
          )}
          {draft.streetViewPanoId ? <p className="field-hint">A Street View thumbnail is set.</p> : null}
        </aside>
      </div>
    </section>
  );
}
