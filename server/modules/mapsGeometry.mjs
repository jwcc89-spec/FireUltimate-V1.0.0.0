/**
 * GeoJSON cleanup, Census address lookup, and "which geofence is this point in?".
 * District checks use these coordinates only. They never use a Google geocode result.
 */
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import { PublicError } from "../http/publicError.mjs";

const MAX_POSITIONS = 5000;

export function parseCoordinate(value, label, min, max) {
  const number = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new PublicError(`${label} is not a valid map position.`);
  }
  return Math.round(number * 1e6) / 1e6;
}

function round6(number) {
  return Math.round(number * 1e6) / 1e6;
}

function cleanRing(ring, counter) {
  if (!Array.isArray(ring) || ring.length < 3) {
    throw new PublicError("Each outline needs at least 3 corners.");
  }
  const cleaned = ring.map((pair) => {
    if (!Array.isArray(pair) || pair.length < 2) {
      throw new PublicError("A map outline has a corner that is not a position.");
    }
    const longitude = Number(pair[0]);
    const latitude = Number(pair[1]);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new PublicError("A map outline has a corner outside the map.");
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new PublicError("A map outline has a corner outside the map.");
    }
    counter.count += 1;
    if (counter.count > MAX_POSITIONS) {
      throw new PublicError("That area has too many corners.");
    }
    return [round6(longitude), round6(latitude)];
  });
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) cleaned.push([first[0], first[1]]);
  if (cleaned.length < 4) throw new PublicError("Each outline needs at least 3 corners.");
  return cleaned;
}

function cleanPolygon(coordinates, counter) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new PublicError("Draw an area before saving.");
  }
  return coordinates.map((ring) => cleanRing(ring, counter));
}

function unwrap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new PublicError("Draw an area before saving.");
  }
  if (raw.type === "Feature") return unwrap(raw.geometry);
  if (raw.type === "FeatureCollection") {
    const first = Array.isArray(raw.features) ? raw.features.find((feature) => feature && feature.geometry) : null;
    if (!first) throw new PublicError("Draw an area before saving.");
    return unwrap(first);
  }
  return raw;
}

/** Returns a GeoJSON Feature with a Polygon or MultiPolygon. Closes rings that were left open. */
export function normalizeGeometry(raw) {
  const geometry = unwrap(raw);
  const counter = { count: 0 };
  if (geometry.type === "Polygon") {
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: cleanPolygon(geometry.coordinates, counter) },
    };
  }
  if (geometry.type === "MultiPolygon") {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      throw new PublicError("Draw an area before saving.");
    }
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: geometry.coordinates.map((polygon) => cleanPolygon(polygon, counter)),
      },
    };
  }
  throw new PublicError("Geofences must be an area.");
}

export function asFeature(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "Feature" && raw.geometry && (raw.geometry.type === "Polygon" || raw.geometry.type === "MultiPolygon")) {
    return raw;
  }
  if (raw.type === "Polygon" || raw.type === "MultiPolygon") {
    return { type: "Feature", properties: {}, geometry: raw };
  }
  return null;
}

/** Geofence rows whose saved area contains this point. The point must come from Census or a pin someone placed. */
export function pointInGeofences(latitude, longitude, rows) {
  const here = point([longitude, latitude]);
  return rows.filter((row) => {
    const feature = asFeature(row.geometryJson);
    if (!feature) return false;
    try {
      return booleanPointInPolygon(here, feature);
    } catch {
      return false;
    }
  });
}

/**
 * US Census one-line address lookup. Free, no key, and the coordinates may be stored.
 * fetchImpl is injectable so tests do not call the network.
 */
export async function censusGeocode(address, fetchImpl = fetch) {
  const query = String(address ?? "").trim();
  if (query.length < 5) throw new PublicError("Enter a street address to look up.");
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
  } catch {
    throw new PublicError("The address lookup is unavailable. Pick the district by hand.");
  }
  if (!response.ok) throw new PublicError("The address lookup is unavailable. Pick the district by hand.");
  const json = await response.json().catch(() => null);
  const match = json?.result?.addressMatches?.[0];
  const longitude = Number(match?.coordinates?.x);
  const latitude = Number(match?.coordinates?.y);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new PublicError("No map point was found for that address. Pick the district by hand.");
  }
  return {
    longitude: round6(longitude),
    latitude: round6(latitude),
    matchedAddress: String(match.matchedAddress ?? query),
    source: "census",
  };
}
