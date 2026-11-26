import type { Geofence, GeoGeometry, MapDocument, MapMarker } from "../../api/maps";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Downtown Kankakee. The map moves to the department's markers once they exist. */
export const DEFAULT_CENTER: LatLng = { lat: 41.12, lng: -87.861 };

export const DRAW_COLORS = ["#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#7c3aed", "#db2777"];

export function markerColor(marker: MapMarker): string {
  if (marker.icon === "hydrant" && marker.flowGpm != null) {
    return marker.flowGpm < 500 ? "#2563eb" : "#16a34a";
  }
  return marker.color || "#2563eb";
}

export function markerLayer(marker: MapMarker): "hydrants" | "apparatus" | "markers" {
  if (marker.icon === "hydrant") return "hydrants";
  if (marker.icon === "firehouse") return "apparatus";
  return "markers";
}

export function kindLabel(kind: string): string {
  if (kind === "district") return "District";
  if (kind === "station") return "Station area";
  if (kind === "subsection") return "Subsection";
  if (kind === "mutualAid") return "Mutual aid";
  if (kind === "hazard") return "Hazard";
  return "Custom";
}

export function firstPoint(geometry: GeoGeometry | null | undefined): LatLng | null {
  if (!geometry) return null;
  const ring = geometry.type === "Polygon" ? geometry.coordinates[0] : geometry.coordinates[0]?.[0];
  const pair = ring?.[0];
  if (!pair || pair.length < 2) return null;
  return { lng: Number(pair[0]), lat: Number(pair[1]) };
}

/** One Google Polygon paths value per saved area (outer ring, then holes). */
export function polygonPaths(geometry: GeoGeometry): LatLng[][][] {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map((rings) => rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng }))));
}

/** Browser map key from the build. It is a public, domain-restricted key, never a server secret. */
export function mapsApiKey(): string {
  const env = import.meta.env as { VITE_GOOGLE_MAPS_API_KEY?: string };
  return env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

/** Hides Google's own places (restaurants, hospitals, bus stops). Only works on a map without a map ID. */
export const HIDE_GOOGLE_PLACES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

export const SHOW_GOOGLE_PLACES: typeof HIDE_GOOGLE_PLACES = [];

export const RADIUS_OPTIONS: { feet: number | null; label: string }[] = [
  { feet: 500, label: "500 ft" },
  { feet: 1000, label: "1,000 ft" },
  { feet: 1500, label: "1,500 ft" },
  { feet: 2500, label: "2,500 ft" },
  { feet: 5280, label: "1 mile" },
  { feet: null, label: "All" },
];

const FEET_PER_DEGREE_LAT = 364000;

/** Box around a point, for fitting the map to a "show only within" circle. */
export function boundsAround(center: LatLng, feet: number) {
  const dLat = feet / FEET_PER_DEGREE_LAT;
  const dLng = dLat / Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01);
  return { north: center.lat + dLat, south: center.lat - dLat, east: center.lng + dLng, west: center.lng - dLng };
}

/** Outline of a circle as map points, drawn as a polygon. */
export function circlePath(center: LatLng, feet: number, steps = 64): LatLng[] {
  const dLat = feet / FEET_PER_DEGREE_LAT;
  const dLng = dLat / Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01);
  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * 2 * Math.PI;
    return { lat: center.lat + dLat * Math.sin(angle), lng: center.lng + dLng * Math.cos(angle) };
  });
}

export function distanceFeet(from: LatLng, to: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(a)) * 3.28084;
}

export function distanceLabel(from: LatLng, to: LatLng): string {
  const feet = distanceFeet(from, to);
  if (feet < 1000) return `${Math.round(feet)} ft`;
  return `${(feet / 5280).toFixed(2)} mi`;
}

const geocodeCache = new Map<string, LatLng | null>();

/** Census lookup, remembered for this browser tab. Failures are remembered too, so a miss is not retried on every toggle. */
export async function cachedGeocode(address: string, lookup: (address: string) => Promise<{ latitude: number; longitude: number }>): Promise<LatLng | null> {
  const key = address.trim().toLowerCase();
  if (!key) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;
  try {
    const result = await lookup(address);
    const point = { lat: result.latitude, lng: result.longitude };
    geocodeCache.set(key, point);
    return point;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

export interface MarkerDraft {
  id: string | null;
  markerTypeId: string;
  latitude: string;
  longitude: string;
  label: string;
  notes: string;
  address: string;
  flowGpm: string;
  documents: MapDocument[];
  updatedAt: string;
  updatedByName: string;
  departmentName: string;
}

export interface GeofenceDraft {
  id: string | null;
  name: string;
  description: string;
  kind: string;
  color: string;
  parentId: string;
  geometry: GeoGeometry | null;
  linkedPropertyId: string;
  linkedPrePlanId: string;
  documents: MapDocument[];
  updatedAt: string;
  updatedByName: string;
  departmentName: string;
}

export type MapPopup =
  | { kind: "marker"; tab: "info" | "docs"; draft: MarkerDraft }
  | { kind: "geofence"; tab: "info" | "docs"; draft: GeofenceDraft }
  | { kind: "place"; title: string; lines: string[]; href?: string; hrefLabel?: string; position: LatLng };

export function markerDraftFrom(marker: MapMarker): MarkerDraft {
  return {
    id: marker.id,
    markerTypeId: marker.markerTypeId,
    latitude: String(marker.latitude),
    longitude: String(marker.longitude),
    label: marker.label,
    notes: marker.notes,
    address: marker.address,
    flowGpm: marker.flowGpm == null ? "" : String(marker.flowGpm),
    documents: marker.documents,
    updatedAt: marker.updatedAt,
    updatedByName: marker.updatedByName,
    departmentName: marker.departmentName,
  };
}

export function geofenceDraftFrom(area: Geofence): GeofenceDraft {
  return {
    id: area.id,
    name: area.name,
    description: area.description,
    kind: area.kind,
    color: area.color,
    parentId: area.parentId,
    geometry: area.geometry,
    linkedPropertyId: area.linkedPropertyId,
    linkedPrePlanId: area.linkedPrePlanId,
    documents: area.documents,
    updatedAt: area.updatedAt,
    updatedByName: area.updatedByName,
    departmentName: area.departmentName,
  };
}
