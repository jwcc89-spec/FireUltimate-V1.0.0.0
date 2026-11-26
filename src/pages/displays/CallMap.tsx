import { useEffect, useState } from "react";
import { APIProvider, AdvancedMarker, Map, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Flame, Navigation } from "lucide-react";
import { directionsUrl, locateIncident } from "../../api/displays";
import { getMarkers, type MapMarker } from "../../api/maps";
import { MapPin } from "../maps/MapPin";
import { distanceFeet, mapsApiKey, markerColor, type LatLng } from "../maps/mapUtils";

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

type Lookup = "saved" | "server" | "google" | "failed";

/**
 * Map of one call with the department's markers within about 1,500 feet, and a Directions button.
 * The point comes from the call (Census, cached 30 days). If Census cannot place it, the browser asks
 * Google only to draw this map; that point is never saved or used for district checks.
 */
export function CallMap({
  incidentId,
  address,
  latitude,
  longitude,
}: {
  incidentId: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const apiKey = mapsApiKey();
  const [point, setPoint] = useState<LatLng | null>(latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null);
  const [lookup, setLookup] = useState<Lookup>(point ? "saved" : "server");
  const [markers, setMarkers] = useState<MapMarker[]>([]);

  useEffect(() => {
    if (lookup !== "server") return;
    let active = true;
    void locateIncident(incidentId)
      .then((found) => {
        if (!active) return;
        if (found.latitude != null && found.longitude != null) {
          setPoint({ lat: found.latitude, lng: found.longitude });
          setLookup("saved");
        } else {
          setLookup("google");
        }
      })
      .catch(() => {
        if (active) setLookup("google");
      });
    return () => {
      active = false;
    };
  }, [incidentId, lookup]);

  useEffect(() => {
    if (lookup !== "google") return;
    const timer = window.setTimeout(() => setLookup((current) => (current === "google" ? "failed" : current)), 8000);
    return () => window.clearTimeout(timer);
  }, [lookup]);

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
  const directions = directionsUrl({ address, latitude: point?.lat ?? null, longitude: point?.lng ?? null });
  const waiting = lookup === "server" || (lookup === "google" && Boolean(apiKey));
  const note = !apiKey
    ? "The map needs the Google Maps browser key. Directions still work."
    : waiting
      ? "Placing the call on the map..."
      : "This address could not be placed on the map. Directions use the address.";

  return (
    <div className="call-map">
      <div className="call-map-canvas">
        {apiKey ? (
          <APIProvider apiKey={apiKey}>
            {lookup === "google" ? <GoogleLookup address={address} onFound={setPoint} onDone={setLookup} /> : null}
            {point ? (
              <Map
                defaultCenter={point}
                defaultZoom={17}
                mapId="DEMO_MAP_ID"
                mapTypeId="hybrid"
                disableDefaultUI
                gestureHandling="cooperative"
                style={{ width: "100%", height: "100%" }}
              >
                {nearby.map((marker) => (
                  <AdvancedMarker
                    key={marker.id}
                    position={{ lat: marker.latitude, lng: marker.longitude }}
                    anchorLeft="-50%"
                    anchorTop="-50%"
                    title={marker.label}
                  >
                    <MapPin icon={marker.icon} color={markerColor(marker)} />
                  </AdvancedMarker>
                ))}
                <AdvancedMarker position={point} anchorLeft="-50%" anchorTop="-50%" title={address} zIndex={10}>
                  <span className="call-map-pin">
                    <Flame size={18} aria-hidden="true" />
                  </span>
                </AdvancedMarker>
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
        <span>{point ? `${nearby.length} marker${nearby.length === 1 ? "" : "s"} within 1,500 ft` : address}</span>
        <a className="primary-button compact-button maintenance-icon-button" href={directions} target="_blank" rel="noreferrer">
          <Navigation size={15} aria-hidden="true" /> Directions
        </a>
      </div>
    </div>
  );
}

function GoogleLookup({
  address,
  onFound,
  onDone,
}: {
  address: string;
  onFound: (point: LatLng) => void;
  onDone: (lookup: Lookup) => void;
}) {
  const geocoding = useMapsLibrary("geocoding");
  useEffect(() => {
    if (!geocoding) return;
    let active = true;
    void new geocoding.Geocoder()
      .geocode({ address })
      .then(({ results }: { results: { geometry: { location: { lat: () => number; lng: () => number } } }[] }) => {
        if (!active) return;
        const location = results[0]?.geometry.location;
        if (location) {
          onFound({ lat: location.lat(), lng: location.lng() });
          onDone("saved");
        } else {
          onDone("failed");
        }
      })
      .catch(() => {
        if (active) onDone("failed");
      });
    return () => {
      active = false;
    };
  }, [address, geocoding, onDone, onFound]);
  return null;
}
