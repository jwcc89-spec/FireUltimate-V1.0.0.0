import { useEffect, useState } from "react";
import { APIProvider, Map } from "@vis.gl/react-google-maps";
import { Flame, Navigation } from "lucide-react";
import { directionsUrl } from "../../api/displays";
import { getMarkers, type MapMarker } from "../../api/maps";
import { CallLocator } from "../maps/CallLocator";
import { HtmlMarker } from "../maps/HtmlMarker";
import { MapPin } from "../maps/MapPin";
import { distanceFeet, HIDE_GOOGLE_PLACES, mapsApiKey, markerColor, type LatLng } from "../maps/mapUtils";

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

/** Map of one call with the department's markers within about 1,500 feet, and a Directions button. */
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
  const [lookup, setLookup] = useState<"pending" | "done">(point ? "done" : "pending");
  const [markers, setMarkers] = useState<MapMarker[]>([]);

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
  const note = !apiKey
    ? "The map needs the Google Maps browser key. Directions still work."
    : lookup === "pending"
      ? "Placing the call on the map..."
      : "This address could not be placed on the map. Directions use the address.";

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
                mapTypeId="hybrid"
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
        <span>{point ? `${nearby.length} marker${nearby.length === 1 ? "" : "s"} within 1,500 ft` : address}</span>
        <a className="primary-button compact-button maintenance-icon-button" href={directions} target="_blank" rel="noreferrer">
          <Navigation size={15} aria-hidden="true" /> Directions
        </a>
      </div>
    </div>
  );
}
