import { useEffect, useState } from "react";
import { APIProvider, Map, Polyline, useMap } from "@vis.gl/react-google-maps";
import { ExternalLink, Flame, Navigation } from "lucide-react";
import { directionsUrl } from "../../api/displays";
import { geocodeAddress, getMarkers, type MapMarker } from "../../api/maps";
import { CallLocator } from "../maps/CallLocator";
import { computeRoute, currentPosition, routeSummary, stepDistance, type DrivingRoute } from "../maps/directions";
import { HtmlMarker } from "../maps/HtmlMarker";
import { MapPin } from "../maps/MapPin";
import { distanceFeet, HIDE_GOOGLE_PLACES, mapsApiKey, markerColor, type LatLng } from "../maps/mapUtils";
import { errorText } from "../maintenance/maintenanceUtils";

const NEARBY_FEET = 1500;
const MARKER_CACHE_MS = 10 * 60 * 1000;
let markerRequest: Promise<MapMarker[]> | null = null;
let markerRequestAt = 0;

function loadMarkers(): Promise<MapMarker[]> {
  if (!markerRequest || Date.now() - markerRequestAt > MARKER_CACHE_MS) {
    markerRequestAt = Date.now();
    markerRequest = getMarkers().catch(() => {
      markerRequest = null;
      return [];
    });
  }
  return markerRequest;
}

type RouteState = { kind: "idle" } | { kind: "loading" } | { kind: "shown"; route: DrivingRoute; from: LatLng } | { kind: "error"; message: string };

/**
 * Map of one call with the department's markers within about 1,500 feet, and Directions drawn on the same map.
 * Directions start from the station address when one is given (a station TV), otherwise from this device's location.
 */
export function CallMap({
  incidentId,
  address,
  latitude,
  longitude,
  originAddress = "",
  originLabel = "",
}: {
  incidentId: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  originAddress?: string;
  originLabel?: string;
}) {
  const apiKey = mapsApiKey();
  const [point, setPoint] = useState<LatLng | null>(latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null);
  const [lookup, setLookup] = useState<"pending" | "done">(point ? "done" : "pending");
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [route, setRoute] = useState<RouteState>({ kind: "idle" });

  useEffect(() => {
    if (!apiKey) return;
    let active = true;
    void loadMarkers().then((rows) => {
      if (active) setMarkers(rows);
    });
    return () => {
      active = false;
    };
  }, [apiKey]);

  const nearby = point
    ? markers.filter((marker) => distanceFeet(point, { lat: marker.latitude, lng: marker.longitude }) <= NEARBY_FEET)
    : [];
  const googleLink = directionsUrl({ address, latitude: point?.lat ?? null, longitude: point?.lng ?? null });
  const note = !apiKey
    ? "The map needs the Google Maps browser key. Directions still work."
    : lookup === "pending"
      ? "Placing the call on the map..."
      : "This address could not be placed on the map. Directions use the address.";

  const showDirections = async () => {
    if (!point || !apiKey) return;
    setRoute({ kind: "loading" });
    try {
      let from: LatLng;
      if (originAddress) {
        const found = await geocodeAddress(originAddress);
        from = { lat: found.latitude, lng: found.longitude };
      } else {
        from = await currentPosition();
      }
      const next = await computeRoute(apiKey, from, point);
      setRoute({ kind: "shown", route: next, from });
    } catch (routeError) {
      setRoute({ kind: "error", message: errorText(routeError, "Directions could not be loaded.") });
    }
  };

  const fromText = originAddress ? `from ${originLabel || originAddress}` : "from this device";

  return (
    <div className="call-map">
      <div className="call-map-canvas">
        {apiKey ? (
          <APIProvider apiKey={apiKey}>
            {lookup === "pending" ? (
              <CallLocator
                incidentId={incidentId}
                address={address}
                onDone={(found) => {
                  setPoint(found);
                  setLookup("done");
                }}
              />
            ) : null}
            {point ? (
              <Map
                defaultCenter={point}
                defaultZoom={17}
                mapTypeId="roadmap"
                styles={HIDE_GOOGLE_PLACES}
                disableDefaultUI
                gestureHandling="cooperative"
                style={{ width: "100%", height: "100%" }}
              >
                {nearby.map((marker) => (
                  <HtmlMarker key={marker.id} position={{ lat: marker.latitude, lng: marker.longitude }} title={marker.label}>
                    <MapPin icon={marker.icon} color={markerColor(marker)} />
                  </HtmlMarker>
                ))}
                {route.kind === "shown" ? (
                  <>
                    <Polyline path={route.route.path} strokeColor="#2563eb" strokeOpacity={0.9} strokeWeight={6} />
                    <HtmlMarker position={route.from} title="Start" zIndex={9}>
                      <span className="map-search-pin" />
                    </HtmlMarker>
                    <FitRoute path={route.route.path} />
                  </>
                ) : null}
                <HtmlMarker position={point} title={address} zIndex={10}>
                  <span className="call-map-pin">
                    <Flame size={18} aria-hidden="true" />
                  </span>
                </HtmlMarker>
              </Map>
            ) : (
              <p className="call-map-note">{note}</p>
            )}
          </APIProvider>
        ) : (
          <p className="call-map-note">{note}</p>
        )}
      </div>
      <div className="call-map-footer">
        <span>
          {route.kind === "shown"
            ? `${routeSummary(route.route)} ${fromText}`
            : point
              ? `${nearby.length} marker${nearby.length === 1 ? "" : "s"} within 1,500 ft`
              : address}
        </span>
        <span className="call-map-actions">
          <a href={googleLink} target="_blank" rel="noreferrer" className="call-map-link">
            <ExternalLink size={13} aria-hidden="true" /> Open in Google Maps
          </a>
          {point && apiKey ? (
            <button
              type="button"
              className="primary-button compact-button maintenance-icon-button"
              disabled={route.kind === "loading"}
              onClick={() => (route.kind === "shown" ? setRoute({ kind: "idle" }) : void showDirections())}
            >
              <Navigation size={15} aria-hidden="true" />{" "}
              {route.kind === "loading" ? "Finding route..." : route.kind === "shown" ? "Hide directions" : "Directions"}
            </button>
          ) : null}
        </span>
      </div>
      {route.kind === "error" ? <p className="field-error">{route.message}</p> : null}
      {route.kind === "shown" && route.route.steps.length > 0 ? (
        <ol className="call-map-steps">
          {route.route.steps.map((step, index) => (
            <li key={`${index}-${step.text}`}>
              <span>{step.text}</span>
              <span>{stepDistance(step.meters)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function FitRoute({ path }: { path: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || path.length === 0) return;
    map.fitBounds(
      {
        north: Math.max(...path.map((item) => item.lat)),
        south: Math.min(...path.map((item) => item.lat)),
        east: Math.max(...path.map((item) => item.lng)),
        west: Math.min(...path.map((item) => item.lng)),
      },
      40,
    );
  }, [map, path]);
  return null;
}
