import type { LatLng } from "./mapUtils";

export interface DrivingRoute {
  path: LatLng[];
  meters: number;
  seconds: number;
  steps: { text: string; meters: number }[];
}

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.polyline.encodedPolyline",
  "routes.legs.steps.navigationInstruction.instructions",
  "routes.legs.steps.distanceMeters",
].join(",");

/** Google's encoded polyline format (5 decimal places). */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/**
 * Driving route from Google's Routes API with the browser key. The route is only drawn on this map; it is not saved.
 * The key needs "Routes API" turned on in Google Cloud.
 */
export async function computeRoute(apiKey: string, from: LatLng, to: LatLng): Promise<DrivingRoute> {
  const waypoint = (point: LatLng) => ({ location: { latLng: { latitude: point.lat, longitude: point.lng } } });
  const response = await fetch(ROUTES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
    body: JSON.stringify({ origin: waypoint(from), destination: waypoint(to), travelMode: "DRIVE" }),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? "Directions need the Routes API turned on for the Google key."
        : "Google could not find a route. Try Open in Google Maps.",
    );
  }
  const body = (await response.json()) as {
    routes?: {
      duration?: string;
      distanceMeters?: number;
      polyline?: { encodedPolyline?: string };
      legs?: { steps?: { navigationInstruction?: { instructions?: string }; distanceMeters?: number }[] }[];
    }[];
  };
  const route = body.routes?.[0];
  if (!route?.polyline?.encodedPolyline) throw new Error("Google could not find a driving route to this call.");
  return {
    path: decodePolyline(route.polyline.encodedPolyline),
    meters: route.distanceMeters ?? 0,
    seconds: Number.parseInt(route.duration ?? "0", 10) || 0,
    steps: (route.legs ?? [])
      .flatMap((leg) => leg.steps ?? [])
      .map((step) => ({ text: step.navigationInstruction?.instructions ?? "", meters: step.distanceMeters ?? 0 }))
      .filter((step) => step.text),
  };
}

/** This device's location. Browsers ask the user the first time. */
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This device cannot share its location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error("Location is blocked. Allow location for this site, or use Open in Google Maps.")),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

export function routeSummary(route: DrivingRoute): string {
  const miles = route.meters / 1609.344;
  const minutes = Math.max(1, Math.round(route.seconds / 60));
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi · about ${minutes} min`;
}

export function stepDistance(meters: number): string {
  const feet = meters * 3.28084;
  return feet < 1000 ? `${Math.round(feet / 10) * 10} ft` : `${(meters / 1609.344).toFixed(1)} mi`;
}
