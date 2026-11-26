import { useCallback, useEffect, useState } from "react";
import { getGeofences, getMarkerTypes, getMarkers, type Geofence, type MapMarker, type MapMarkerType } from "../../api/maps";
import { errorText } from "../maintenance/maintenanceUtils";

/** Loads this department's marker types, markers and geofences. */
export function useMapLibrary() {
  const [types, setTypes] = useState<MapMarkerType[]>([]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    return Promise.all([getMarkerTypes(), getMarkers(), getGeofences()])
      .then(([nextTypes, nextMarkers, nextGeofences]) => {
        setTypes(nextTypes);
        setMarkers(nextMarkers);
        setGeofences(nextGeofences);
        setError("");
      })
      .catch((loadError) => setError(errorText(loadError, "Could not load the map.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([getMarkerTypes(), getMarkers(), getGeofences()])
      .then(([nextTypes, nextMarkers, nextGeofences]) => {
        if (!active) return;
        setTypes(nextTypes);
        setMarkers(nextMarkers);
        setGeofences(nextGeofences);
      })
      .catch((loadError) => {
        if (active) setError(errorText(loadError, "Could not load the map."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { types, markers, geofences, loading, error, reload };
}
