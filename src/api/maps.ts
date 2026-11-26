/** Map markers, marker types and geofences. */
import { apiJson, send } from "./maintenance";

export const MARKER_ICONS: { value: string; label: string }[] = [
  { value: "hydrant", label: "Hydrant" },
  { value: "fdc", label: "FDC" },
  { value: "knox", label: "Knox box" },
  { value: "hazard", label: "Hazard" },
  { value: "firehouse", label: "Fire house" },
  { value: "preplan", label: "Pre-plan" },
  { value: "landing", label: "Landing zone" },
  { value: "shutoff", label: "Shut-off" },
  { value: "standpipe", label: "Standpipe" },
  { value: "donotenter", label: "Do not enter" },
  { value: "marker", label: "Marker" },
];

export const GEOFENCE_KINDS: { value: string; label: string }[] = [
  { value: "district", label: "District" },
  { value: "station", label: "Station area" },
  { value: "subsection", label: "Subsection" },
  { value: "mutualAid", label: "Mutual aid" },
  { value: "hazard", label: "Hazard" },
  { value: "custom", label: "Custom" },
];

export interface MapDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  addedBy: string;
  addedAt: string;
}

export interface MapMarkerType {
  id: string;
  name: string;
  icon: string;
  color: string;
  isSystem: boolean;
}

export interface MapMarker {
  id: string;
  markerTypeId: string;
  typeName: string;
  icon: string;
  color: string;
  latitude: number;
  longitude: number;
  label: string;
  notes: string;
  address: string;
  flowGpm: number | null;
  documents: MapDocument[];
  updatedAt: string;
  updatedByName: string;
  departmentName: string;
}

export type GeoGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export interface Geofence {
  id: string;
  name: string;
  description: string;
  kind: string;
  color: string;
  parentId: string;
  parentName: string;
  geometry: GeoGeometry;
  linkedPropertyId: string;
  linkedPrePlanId: string;
  documents: MapDocument[];
  updatedAt: string;
  updatedByName: string;
  departmentName: string;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  matchedAddress: string;
  source: string;
}

export interface DistrictMatch {
  id: string;
  name: string;
  kind: string;
  color: string;
}

export interface DistrictResult {
  latitude: number | null;
  longitude: number | null;
  matchedAddress: string;
  source: string;
  matches: DistrictMatch[];
  districts: DistrictMatch[];
}

export interface MarkerInput {
  markerTypeId: string;
  latitude: number;
  longitude: number;
  label: string;
  notes: string;
  address: string;
  flowGpm: number | null;
  documents: MapDocument[];
}

export interface GeofenceInput {
  name: string;
  description: string;
  kind: string;
  color: string;
  parentId: string;
  geometry: GeoGeometry;
  linkedPropertyId: string;
  linkedPrePlanId: string;
  documents: MapDocument[];
}

export const getMarkerTypes = () => apiJson<MapMarkerType[]>("/api/maps/marker-types");
export const createMarkerType = (input: { name: string; icon: string; color: string }) =>
  apiJson<MapMarkerType>("/api/maps/marker-types", send("POST", input));
export const updateMarkerType = (id: string, input: { name: string; icon: string; color: string }) =>
  apiJson<MapMarkerType>(`/api/maps/marker-types/${encodeURIComponent(id)}`, send("PATCH", input));
export const deleteMarkerType = (id: string) =>
  apiJson<void>(`/api/maps/marker-types/${encodeURIComponent(id)}`, send("DELETE"));

export const getMarkers = () => apiJson<MapMarker[]>("/api/maps/markers");
export const createMarker = (input: MarkerInput) => apiJson<MapMarker>("/api/maps/markers", send("POST", input));
export const updateMarker = (id: string, input: Partial<MarkerInput>) =>
  apiJson<MapMarker>(`/api/maps/markers/${encodeURIComponent(id)}`, send("PATCH", input));
export const deleteMarker = (id: string) =>
  apiJson<void>(`/api/maps/markers/${encodeURIComponent(id)}`, send("DELETE"));

export const getGeofences = () => apiJson<Geofence[]>("/api/geofences");
export const createGeofence = (input: GeofenceInput) => apiJson<Geofence>("/api/geofences", send("POST", input));
export const updateGeofence = (id: string, input: Partial<GeofenceInput>) =>
  apiJson<Geofence>(`/api/geofences/${encodeURIComponent(id)}`, send("PATCH", input));
export const deleteGeofence = (id: string) =>
  apiJson<void>(`/api/geofences/${encodeURIComponent(id)}`, send("DELETE"));

export const geocodeAddress = (address: string) =>
  apiJson<GeocodeResult>("/api/maps/geocode", send("POST", { address }));
export const lookupDistrict = (input: { address?: string; latitude?: number; longitude?: number }) =>
  apiJson<DistrictResult>("/api/maps/district", send("POST", input));
