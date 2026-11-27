import { useEffect } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { Building2, House } from "lucide-react";
import { fullAddress, type PropertySummary } from "../../api/prevention";
import { HtmlMarker } from "../maps/HtmlMarker";
import { DEFAULT_CENTER, HIDE_GOOGLE_PLACES, mapsApiKey } from "../maps/mapUtils";

type Pinned = PropertySummary & { latitude: number; longitude: number };

function FitProperties({ rows }: { rows: Pinned[] }) {
  const map = useMap();
  const key = rows.map((row) => row.id).join(",");
  useEffect(() => {
    if (!map || rows.length === 0) return;
    if (rows.length === 1) {
      map.panTo({ lat: rows[0].latitude, lng: rows[0].longitude });
      map.setZoom(17);
      return;
    }
    map.fitBounds(
      {
        north: Math.max(...rows.map((row) => row.latitude)),
        south: Math.min(...rows.map((row) => row.latitude)),
        east: Math.max(...rows.map((row) => row.longitude)),
        west: Math.min(...rows.map((row) => row.longitude)),
      },
      48,
    );
    // Refit only when the set of properties changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/** Map of the listed properties that have a pin. Clicking a pin opens the property. */
export function PropertiesMap({ rows, onOpen }: { rows: PropertySummary[]; onOpen: (row: PropertySummary) => void }) {
  const apiKey = mapsApiKey();
  const pinned = rows.filter((row): row is Pinned => row.latitude != null && row.longitude != null);
  const missing = rows.length - pinned.length;

  if (!apiKey) return <p className="field-hint">The map needs the Google Maps browser key.</p>;

  return (
    <div className="properties-map">
      <div className="properties-map-canvas">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={pinned[0] ? { lat: pinned[0].latitude, lng: pinned[0].longitude } : DEFAULT_CENTER}
            defaultZoom={13}
            mapTypeId="roadmap"
            styles={HIDE_GOOGLE_PLACES}
            streetViewControl={false}
            gestureHandling="greedy"
            style={{ width: "100%", height: "100%" }}
          >
            <FitProperties rows={pinned} />
            {pinned.map((row) => (
              <HtmlMarker
                key={row.id}
                position={{ lat: row.latitude, lng: row.longitude }}
                title={[row.name, fullAddress(row)].filter(Boolean).join(" - ")}
                onClick={() => onOpen(row)}
              >
                <span className={`map-pin property-map-pin property-map-pin-${row.propertyType}`}>
                  {row.propertyType === "commercial" ? (
                    <Building2 size={14} aria-hidden="true" />
                  ) : (
                    <House size={14} aria-hidden="true" />
                  )}
                </span>
              </HtmlMarker>
            ))}
          </Map>
        </APIProvider>
      </div>
      <p className="field-hint">
        Blue pins are residential, orange pins are commercial.
        {missing > 0 ? ` ${missing} ${missing === 1 ? "property has" : "properties have"} no pin yet; open one and place its pin.` : ""}
      </p>
    </div>
  );
}
