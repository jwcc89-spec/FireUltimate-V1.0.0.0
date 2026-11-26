import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  Polygon,
  Polyline,
  useMap,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";
import { Maximize2, Pencil, Plus, Ruler, Satellite } from "lucide-react";
import { getIncidentList } from "../../api/incidents";
import {
  createGeofence,
  createMarker,
  deleteGeofence,
  deleteMarker,
  geocodeAddress,
  updateGeofence,
  updateMarker,
  type Geofence,
  type GeoGeometry,
  type MapMarker,
  type MapMarkerType,
} from "../../api/maps";
import { useModuleLookups } from "../../moduleLookups";
import { errorText, formatTimestamp24 } from "../maintenance/maintenanceUtils";
import { GeofenceDraw } from "./GeofenceDraw";
import { MapPin } from "./MapPin";
import { MapRecordForm } from "./MapRecordForm";
import {
  cachedGeocode,
  DEFAULT_CENTER,
  distanceLabel,
  DRAW_COLORS,
  firstPoint,
  geofenceDraftFrom,
  mapsApiKey,
  markerColor,
  markerDraftFrom,
  markerLayer,
  polygonPaths,
  type GeofenceDraft,
  type LatLng,
  type MapPopup,
  type MarkerDraft,
} from "./mapUtils";

interface Layers {
  hydrants: boolean;
  markers: boolean;
  apparatus: boolean;
  geofences: boolean;
  individuals: boolean;
  residential: boolean;
  incidents: boolean;
}

const SHOWING: { id: keyof Layers; label: string }[] = [
  { id: "hydrants", label: "Our Hydrants" },
  { id: "markers", label: "Our Markers" },
  { id: "apparatus", label: "Our Apparatus" },
  { id: "geofences", label: "Our Geofences" },
  { id: "individuals", label: "Our Individuals" },
  { id: "residential", label: "Our Residential Plans" },
  { id: "incidents", label: "Incidents" },
];

export interface MapFocus {
  token: number;
  kind: "marker" | "geofence";
  id: string;
}

type GoogleMap = NonNullable<ReturnType<typeof useMap>>;

function fromLatLng(value: { lat: number | (() => number); lng: number | (() => number) } | null | undefined): LatLng | null {
  if (!value) return null;
  const lat = typeof value.lat === "function" ? value.lat() : value.lat;
  const lng = typeof value.lng === "function" ? value.lng() : value.lng;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function blankMarker(latitude: number, longitude: number, typeId: string): MarkerDraft {
  return {
    id: null,
    markerTypeId: typeId,
    latitude: String(latitude),
    longitude: String(longitude),
    label: "",
    notes: "",
    address: "",
    flowGpm: "",
    documents: [],
    updatedAt: "",
    updatedByName: "",
    departmentName: "",
  };
}

function blankGeofence(geometry: GeoGeometry, color: string): GeofenceDraft {
  return {
    id: null,
    name: "",
    description: "",
    kind: "district",
    color,
    parentId: "",
    geometry,
    linkedPropertyId: "",
    linkedPrePlanId: "",
    documents: [],
    updatedAt: "",
    updatedByName: "",
    departmentName: "",
  };
}

function popupPosition(popup: MapPopup): LatLng | null {
  if (popup.kind === "place") return popup.position;
  if (popup.kind === "marker") {
    const lat = Number(popup.draft.latitude);
    const lng = Number(popup.draft.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  return firstPoint(popup.draft.geometry);
}

/** The shared department map: layers, search, markers, geofences and the two-tab popup. */
export function MapCanvas({
  mode,
  markers,
  types,
  geofences,
  canManage,
  focus,
  onReload,
}: {
  mode: "view" | "edit";
  markers: MapMarker[];
  types: MapMarkerType[];
  geofences: Geofence[];
  canManage: boolean;
  focus: MapFocus | null;
  onReload: () => void;
}) {
  const apiKey = mapsApiKey();
  const lookups = useModuleLookups();
  const editable = mode === "edit" && canManage;
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const skipClick = useRef(false);
  const fitted = useRef(false);
  const [map, setMap] = useState<GoogleMap | null>(null);
  const [satellite, setSatellite] = useState(true);
  const [tool, setTool] = useState<"none" | "measure" | "draw">("none");
  const [shape, setShape] = useState<"polygon" | "rectangle" | "circle">("polygon");
  const [drawColor, setDrawColor] = useState("#dc2626");
  const [showColors, setShowColors] = useState(false);
  const [layers, setLayers] = useState<Layers>({
    hydrants: true,
    markers: true,
    apparatus: true,
    geofences: true,
    individuals: false,
    residential: false,
    incidents: mode === "view",
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [popup, setPopup] = useState<MapPopup | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [measurePoints, setMeasurePoints] = useState<LatLng[]>([]);
  const [stationPins, setStationPins] = useState<{ name: string; address: string; position: LatLng }[]>([]);
  const [incidentPins, setIncidentPins] = useState<{ id: string; title: string; lines: string[]; href: string; position: LatLng }[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const markersRef = useRef(markers);
  const geofencesRef = useRef(geofences);
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);
  useEffect(() => {
    geofencesRef.current = geofences;
  }, [geofences]);

  useEffect(() => {
    map?.setMapTypeId(satellite ? "hybrid" : "roadmap");
  }, [map, satellite]);

  useEffect(() => {
    if (!map || fitted.current) return;
    const points: LatLng[] = markers.map((marker) => ({ lat: marker.latitude, lng: marker.longitude }));
    for (const area of geofences) {
      const point = firstPoint(area.geometry);
      if (point) points.push(point);
    }
    if (points.length === 0) return;
    fitted.current = true;
    const only = points[0];
    if (points.length === 1 && only) {
      map.panTo(only);
      map.setZoom(16);
      return;
    }
    map.fitBounds(
      {
        north: Math.max(...points.map((point) => point.lat)),
        south: Math.min(...points.map((point) => point.lat)),
        east: Math.max(...points.map((point) => point.lng)),
        west: Math.min(...points.map((point) => point.lng)),
      },
      48,
    );
  }, [geofences, map, markers]);

  useEffect(() => {
    if (!focus) return;
    if (focus.kind === "marker") {
      const marker = markersRef.current.find((item) => item.id === focus.id);
      if (!marker) return;
      map?.panTo({ lat: marker.latitude, lng: marker.longitude });
      map?.setZoom(17);
      setSelectedId(marker.id);
      setPopup({ kind: "marker", tab: "info", draft: markerDraftFrom(marker) });
      return;
    }
    const area = geofencesRef.current.find((item) => item.id === focus.id);
    if (!area) return;
    const point = firstPoint(area.geometry);
    if (point) {
      map?.panTo(point);
      map?.setZoom(16);
    }
    setPopup({ kind: "geofence", tab: "info", draft: geofenceDraftFrom(area) });
  }, [focus, map]);

  useEffect(() => {
    if (tool === "none") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTool("none");
        setMeasurePoints([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool]);

  useEffect(() => {
    if (!layers.apparatus) return;
    let active = true;
    const stations = lookups.stationRecords
      .map((station) => ({ station, address: [station.address, station.city, station.state].filter(Boolean).join(", ") }))
      .filter((entry) => entry.address.length > 4);
    void (async () => {
      const pins: { name: string; address: string; position: LatLng }[] = [];
      for (const entry of stations) {
        if (!active) return;
        const point = await cachedGeocode(entry.address, geocodeAddress);
        if (point) pins.push({ name: entry.station.name, address: entry.address, position: point });
      }
      if (active) setStationPins(pins);
    })();
    return () => {
      active = false;
    };
  }, [layers.apparatus, lookups.stationRecords]);

  useEffect(() => {
    if (!layers.incidents) return;
    let active = true;
    setStatus("Looking up call addresses…");
    void getIncidentList()
      .then(async (list) => {
        const pins: { id: string; title: string; lines: string[]; href: string; position: LatLng }[] = [];
        const pending = list.filter((incident) => incident.address && incident.address !== "Unknown").slice(0, 12);
        for (const incident of pending) {
          if (!active) return;
          const point = await cachedGeocode(incident.address, geocodeAddress);
          if (!point) continue;
          const received = formatTimestamp24(incident.receivedAt) || incident.receivedAt;
          pins.push({
            id: incident.callNumber,
            title: incident.incidentType || "Incident",
            lines: [incident.address, incident.stillDistrict ? `District ${incident.stillDistrict}` : "", received].filter(Boolean),
            href: `/incidents-mapping/incidents/${encodeURIComponent(incident.callNumber)}`,
            position: point,
          });
        }
        if (!active) return;
        setIncidentPins(pins);
        setStatus(pins.length === 0 && pending.length > 0 ? "No call addresses could be placed. Pick a district by hand below." : "");
      })
      .catch(() => {
        if (active) setStatus("Could not load incidents.");
      });
    return () => {
      active = false;
    };
  }, [layers.incidents]);

  const defaultTypeId = types.find((type) => type.icon === "hydrant")?.id ?? types[0]?.id ?? "";
  const visibleMarkers = markers.filter((marker) => layers[markerLayer(marker)]);

  const openNewMarker = (latitude: number, longitude: number) => {
    setSelectedId(null);
    setFormError("");
    setPopup({ kind: "marker", tab: "info", draft: blankMarker(latitude, longitude, defaultTypeId) });
  };

  const onContext = (event: MapMouseEvent) => {
    if (!editable || tool !== "none") return;
    const point = event.detail.latLng;
    if (!point) return;
    openNewMarker(point.lat, point.lng);
  };

  const onMapClick = (event: MapMouseEvent) => {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    if (tool !== "measure") return;
    const point = event.detail.latLng;
    if (!point) return;
    setMeasurePoints((current) => (current.length >= 2 ? [point] : [...current, point]));
  };

  const onSearch = async (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim().toLowerCase();
    if (!term) return;
    const marker = markers.find((item) =>
      [item.label, item.address, item.notes, item.typeName].some((value) => value.toLowerCase().includes(term)),
    );
    if (marker) {
      map?.panTo({ lat: marker.latitude, lng: marker.longitude });
      map?.setZoom(17);
      setSelectedId(marker.id);
      setPopup({ kind: "marker", tab: "info", draft: markerDraftFrom(marker) });
      setStatus("");
      return;
    }
    const area = geofences.find((item) => item.name.toLowerCase().includes(term) || item.description.toLowerCase().includes(term));
    if (area) {
      const point = firstPoint(area.geometry);
      if (point) {
        map?.panTo(point);
        map?.setZoom(16);
      }
      setPopup({ kind: "geofence", tab: "info", draft: geofenceDraftFrom(area) });
      setStatus("");
      return;
    }
    try {
      const result = await geocodeAddress(query.trim());
      map?.panTo({ lat: result.latitude, lng: result.longitude });
      map?.setZoom(17);
      setStatus(result.matchedAddress);
    } catch (searchError) {
      setStatus(errorText(searchError, "No marker or address matched."));
    }
  };

  const save = async () => {
    if (!popup || popup.kind === "place") return;
    setSaving(true);
    setFormError("");
    try {
      if (popup.kind === "marker") {
        const latitude = Number(popup.draft.latitude);
        const longitude = Number(popup.draft.longitude);
        if (!popup.draft.label.trim()) throw new Error("Enter a name for the marker.");
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Enter a latitude and longitude.");
        const input = {
          markerTypeId: popup.draft.markerTypeId,
          latitude,
          longitude,
          label: popup.draft.label.trim(),
          notes: popup.draft.notes,
          address: popup.draft.address,
          flowGpm: popup.draft.flowGpm.trim() === "" ? null : Number(popup.draft.flowGpm),
          documents: popup.draft.documents,
        };
        if (popup.draft.id) await updateMarker(popup.draft.id, input);
        else await createMarker(input);
      } else {
        if (!popup.draft.name.trim()) throw new Error("Enter a name for the area.");
        if (!popup.draft.geometry) throw new Error("Draw an area before saving.");
        const input = {
          name: popup.draft.name.trim(),
          description: popup.draft.description,
          kind: popup.draft.kind,
          color: popup.draft.color,
          parentId: popup.draft.parentId,
          geometry: popup.draft.geometry,
          linkedPropertyId: popup.draft.linkedPropertyId,
          linkedPrePlanId: popup.draft.linkedPrePlanId,
          documents: popup.draft.documents,
        };
        if (popup.draft.id) await updateGeofence(popup.draft.id, input);
        else await createGeofence(input);
      }
      setPopup(null);
      await onReload();
    } catch (saveError) {
      setFormError(errorText(saveError, "Could not save."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!popup || popup.kind === "place" || !popup.draft.id) return;
    setSaving(true);
    setFormError("");
    try {
      if (popup.kind === "marker") await deleteMarker(popup.draft.id);
      else await deleteGeofence(popup.draft.id);
      setPopup(null);
      setSelectedId(null);
      await onReload();
    } catch (deleteError) {
      setFormError(errorText(deleteError, "Could not delete."));
    } finally {
      setSaving(false);
    }
  };

  const toggleLayer = (id: keyof Layers) => {
    const turningOn = !layers[id];
    setLayers((current) => ({ ...current, [id]: !current[id] }));
    if (turningOn && id === "individuals") setStatus("Personnel home addresses come after the demo.");
    else if (turningOn && id === "residential") setStatus("Residential plans come with Fire Prevention.");
    else if (!turningOn && (id === "individuals" || id === "residential")) setStatus("");
  };

  const position = popup ? popupPosition(popup) : null;
  const recordPopup = popup && popup.kind !== "place" ? popup : null;

  return (
    <article className="panel map-panel">
      {apiKey ? (
        <div className="map-canvas" ref={canvasRef}>
          <APIProvider apiKey={apiKey}>
            <Map
              defaultCenter={DEFAULT_CENTER}
              defaultZoom={15}
              mapId="DEMO_MAP_ID"
              mapTypeId={satellite ? "hybrid" : "roadmap"}
              gestureHandling="greedy"
              disableDoubleClickZoom={mode === "edit"}
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={false}
              style={{ width: "100%", height: "100%" }}
              onClick={onMapClick}
              onContextmenu={onContext}
            >
              <MapReady onReady={setMap} />
              <GeofenceDraw
                active={tool === "draw"}
                shape={shape}
                color={drawColor}
                onDrawn={(geometry) => {
                  setTool("none");
                  setFormError("");
                  setPopup({ kind: "geofence", tab: "info", draft: blankGeofence(geometry, drawColor) });
                }}
                onFail={setStatus}
              />
              {layers.geofences && tool !== "draw"
                ? geofences.flatMap((area) =>
                    polygonPaths(area.geometry).map((paths, index) => (
                      <Polygon
                        key={`${area.id}-${index}`}
                        paths={paths}
                        strokeColor={area.color}
                        strokeWeight={2}
                        fillColor={area.color}
                        fillOpacity={0.18}
                        clickable
                        onClick={() => {
                          skipClick.current = true;
                          setFormError("");
                          setPopup({ kind: "geofence", tab: "info", draft: geofenceDraftFrom(area) });
                        }}
                      />
                    )),
                  )
                : null}
              {visibleMarkers.map((marker) => (
                <AdvancedMarker
                  key={marker.id}
                  position={{ lat: marker.latitude, lng: marker.longitude }}
                  anchorLeft="-50%"
                  anchorTop="-50%"
                  title={marker.label}
                  zIndex={selectedId === marker.id ? 5 : 1}
                  draggable={editable && selectedId === marker.id && tool === "none"}
                  onClick={() => {
                    skipClick.current = true;
                    setFormError("");
                    if (!editable) {
                      setSelectedId(marker.id);
                      setPopup({ kind: "marker", tab: "info", draft: markerDraftFrom(marker) });
                      return;
                    }
                    if (selectedId === marker.id) {
                      setPopup({ kind: "marker", tab: "info", draft: markerDraftFrom(marker) });
                    } else {
                      setSelectedId(marker.id);
                      setPopup(null);
                    }
                  }}
                  onDragEnd={(event) => {
                    const point = fromLatLng(event.latLng);
                    if (!point) return;
                    void updateMarker(marker.id, { latitude: point.lat, longitude: point.lng })
                      .then(() => onReload())
                      .catch((moveError) => setStatus(errorText(moveError, "Could not move the marker.")));
                  }}
                >
                  <MapPin icon={marker.icon} color={markerColor(marker)} selected={selectedId === marker.id} />
                </AdvancedMarker>
              ))}
              {layers.apparatus
                ? stationPins.map((pin) => (
                    <AdvancedMarker
                      key={pin.name}
                      position={pin.position}
                      anchorLeft="-50%"
                      anchorTop="-50%"
                      title={pin.name}
                      onClick={() => {
                        skipClick.current = true;
                        setPopup({
                          kind: "place",
                          title: pin.name,
                          lines: [pin.address, "This pin is an address lookup. Add a Fire House marker to save the exact spot."],
                          position: pin.position,
                        });
                      }}
                    >
                      <MapPin icon="firehouse" color="#b45309" />
                    </AdvancedMarker>
                  ))
                : null}
              {layers.incidents
                ? incidentPins.map((pin) => (
                    <AdvancedMarker
                      key={pin.id}
                      position={pin.position}
                      anchorLeft="-50%"
                      anchorTop="-50%"
                      title={pin.title}
                      onClick={() => {
                        skipClick.current = true;
                        setPopup({ kind: "place", title: pin.title, lines: pin.lines, href: pin.href, hrefLabel: "Open incident", position: pin.position });
                      }}
                    >
                      <MapPin icon="hazard" color="#dc2626" />
                    </AdvancedMarker>
                  ))
                : null}
              {measurePoints.length === 2 ? (
                <>
                  <Polyline path={measurePoints} strokeColor="#0f172a" strokeWeight={3} />
                  <AdvancedMarker
                    position={{
                      lat: (measurePoints[0].lat + measurePoints[1].lat) / 2,
                      lng: (measurePoints[0].lng + measurePoints[1].lng) / 2,
                    }}
                  >
                    <span className="map-measure-label">{distanceLabel(measurePoints[0], measurePoints[1])}</span>
                  </AdvancedMarker>
                </>
              ) : null}
              {recordPopup && position ? (
                <InfoWindow position={position} onCloseClick={() => setPopup(null)} headerContent={<span>{recordPopup.kind === "marker" ? recordPopup.draft.label || "New marker" : recordPopup.draft.name || "New area"}</span>}>
                  <MapRecordForm
                    popup={recordPopup}
                    types={types}
                    geofences={geofences}
                    editable={editable}
                    saving={saving}
                    error={formError}
                    onPopup={(next) => setPopup(next)}
                    onSave={() => void save()}
                    onDelete={() => void remove()}
                    onClose={() => setPopup(null)}
                  />
                </InfoWindow>
              ) : null}
              {popup?.kind === "place" ? (
                <InfoWindow position={popup.position} onCloseClick={() => setPopup(null)} headerContent={<span>{popup.title}</span>}>
                  <div className="map-popup map-read">
                    {popup.lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {popup.href ? <Link to={popup.href}>{popup.hrefLabel ?? "Open"}</Link> : null}
                  </div>
                </InfoWindow>
              ) : null}
            </Map>
          </APIProvider>
          <form className="map-search" onSubmit={(event) => void onSearch(event)}>
            <input
              type="text"
              className="maintenance-search"
              value={query}
              placeholder="Search a marker name or an address"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className="secondary-button compact-button">Search</button>
          </form>
        </div>
      ) : (
        <p className="field-hint">
          The map needs a Google Maps browser key named VITE_GOOGLE_MAPS_API_KEY. Marker and area lists below still work.
          Add a marker with latitude and longitude until the key is set.
        </p>
      )}

      <div className="map-toolbar">
        <div className="map-toolbar-group">
          <button type="button" className="secondary-button compact-button" onClick={() => setStatus("USNG is coming soon.")}>USNG</button>
          <button type="button" className="secondary-button compact-button" onClick={() => setStatus("Transfer Hydrants is coming soon.")}>
            Transfer Hydrants
          </button>
        </div>
        <div className="map-toolbar-group">
          {editable ? (
            <button type="button" className="primary-button compact-button maintenance-icon-button" onClick={() => {
              const center = map?.getCenter();
              openNewMarker(center ? center.lat() : DEFAULT_CENTER.lat, center ? center.lng() : DEFAULT_CENTER.lng);
            }}>
              <Plus size={15} aria-hidden="true" /> Add marker
            </button>
          ) : null}
          {editable ? (
            <button type="button" className={showColors ? "secondary-button compact-button map-tool-active" : "secondary-button compact-button"} aria-label="Area color" onClick={() => setShowColors((current) => !current)}>
              <span className="map-color" style={{ background: drawColor }} />
            </button>
          ) : null}
          {editable ? (
            <button
              type="button"
              className={tool === "draw" ? "secondary-button compact-button map-tool-active maintenance-icon-button" : "secondary-button compact-button maintenance-icon-button"}
              onClick={() => {
                setTool((current) => (current === "draw" ? "none" : "draw"));
                setMeasurePoints([]);
                setStatus("");
              }}
            >
              <Pencil size={15} aria-hidden="true" /> Draw area
            </button>
          ) : null}
          <button
            type="button"
            className={tool === "measure" ? "secondary-button compact-button map-tool-active maintenance-icon-button" : "secondary-button compact-button maintenance-icon-button"}
            onClick={() => {
              setTool((current) => (current === "measure" ? "none" : "measure"));
              setMeasurePoints([]);
            }}
          >
            <Ruler size={15} aria-hidden="true" /> Measure
          </button>
          <button type="button" className="secondary-button compact-button maintenance-icon-button" onClick={() => setSatellite((current) => !current)}>
            <Satellite size={15} aria-hidden="true" /> {satellite ? "Road" : "Satellite"}
          </button>
          <button type="button" className="secondary-button compact-button" aria-label="Full screen" onClick={() => {
            const node = canvasRef.current;
            if (!node) return;
            if (document.fullscreenElement) void document.exitFullscreen();
            else void node.requestFullscreen();
          }}>
            <Maximize2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      {showColors && editable ? (
        <div className="map-toolbar-group">
          {DRAW_COLORS.map((color) => (
            <button key={color} type="button" className="map-color" style={{ background: color }} aria-label={color} onClick={() => setDrawColor(color)} />
          ))}
        </div>
      ) : null}
      {tool === "draw" ? (
        <div className="map-toolbar-group">
          {(["polygon", "rectangle", "circle"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={shape === option ? "secondary-button compact-button map-tool-active" : "secondary-button compact-button"}
              onClick={() => setShape(option)}
            >
              {option === "polygon" ? "Area" : option === "rectangle" ? "Rectangle" : "Circle"}
            </button>
          ))}
          <p className="field-hint">Click to add corners. Click the first corner again to finish. Esc cancels. Pick the color before you start, or the outline starts over.</p>
        </div>
      ) : null}
      {tool === "measure" ? <p className="field-hint">Click two points. The distance is in feet, then miles.</p> : null}
      <div className="map-showing">
        <span>Showing:</span>
        {SHOWING.map((item) => (
          <button key={item.id} type="button" aria-pressed={layers[item.id]} onClick={() => toggleLayer(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {status ? <p className="field-hint">{status}</p> : null}
      {!canManage && mode === "edit" ? <p className="field-hint">You can look at the map. Changing markers and areas needs the map permission.</p> : null}
      {!apiKey && recordPopup ? (
        <div className="schedule-notice-backdrop" role="dialog" aria-modal="true" aria-label="Map record">
          <div className="schedule-notice maintenance-dialog">
            <MapRecordForm
              popup={recordPopup}
              types={types}
              geofences={geofences}
              editable={editable}
              saving={saving}
              error={formError}
              onPopup={(next) => setPopup(next)}
              onSave={() => void save()}
              onDelete={() => void remove()}
              onClose={() => setPopup(null)}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function MapReady({ onReady }: { onReady: (map: GoogleMap | null) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
    return () => onReady(null);
  }, [map, onReady]);
  return null;
}
