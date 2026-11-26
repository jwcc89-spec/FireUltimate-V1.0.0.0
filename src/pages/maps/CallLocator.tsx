import { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { locateIncident } from "../../api/displays";
import type { LatLng } from "./mapUtils";

const GOOGLE_WAIT_MS = 8000;

/**
 * Finds where a call is: the saved Census point first (cached 30 days on the server). If Census cannot place it,
 * the browser asks Google only to draw the map; that point is never saved or used for district checks.
 * Must sit inside APIProvider. Calls onDone once, with null when the address cannot be placed.
 */
export function CallLocator({
  incidentId,
  address,
  onDone,
}: {
  incidentId: string;
  address: string;
  onDone: (point: LatLng | null) => void;
}) {
  const geocoding = useMapsLibrary("geocoding");
  const [needsGoogle, setNeedsGoogle] = useState(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    let active = true;
    void locateIncident(incidentId)
      .then((found) => {
        if (!active) return;
        if (found.latitude != null && found.longitude != null) onDoneRef.current({ lat: found.latitude, lng: found.longitude });
        else setNeedsGoogle(true);
      })
      .catch(() => {
        if (active) setNeedsGoogle(true);
      });
    return () => {
      active = false;
    };
  }, [incidentId]);

  useEffect(() => {
    if (!needsGoogle) return;
    let active = true;
    const finish = (point: LatLng | null) => {
      if (!active) return;
      active = false;
      window.clearTimeout(timer);
      onDoneRef.current(point);
    };
    const timer = window.setTimeout(() => finish(null), GOOGLE_WAIT_MS);
    if (geocoding) {
      void new geocoding.Geocoder()
        .geocode({ address })
        .then(({ results }: { results: { geometry: { location: { lat: () => number; lng: () => number } } }[] }) => {
          const location = results[0]?.geometry.location;
          finish(location ? { lat: location.lat(), lng: location.lng() } : null);
        })
        .catch(() => finish(null));
    }
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [address, geocoding, needsGoogle]);

  return null;
}
