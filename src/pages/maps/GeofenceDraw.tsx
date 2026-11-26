import { useEffect, useRef } from "react";
import { useApiIsLoaded, useMap } from "@vis.gl/react-google-maps";
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
} from "terra-draw";
import { TerraDrawGoogleMapsAdapter } from "terra-draw-google-maps-adapter";
import type { GeoGeometry } from "../../api/maps";

type DrawShape = "polygon" | "rectangle" | "circle";

function hex(color: string): `#${string}` {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? (color as `#${string}`) : "#dc2626";
}

/** Terra Draw on the Google map. It only runs while the pencil is on, so normal clicks still select markers. */
export function GeofenceDraw({
  active,
  shape,
  color,
  onDrawn,
  onFail,
}: {
  active: boolean;
  shape: DrawShape;
  color: string;
  onDrawn: (geometry: GeoGeometry) => void;
  onFail: (message: string) => void;
}) {
  const map = useMap();
  const loaded = useApiIsLoaded();
  const onDrawnRef = useRef(onDrawn);
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onDrawnRef.current = onDrawn;
    onFailRef.current = onFail;
  }, [onDrawn, onFail]);

  useEffect(() => {
    const mapsLib = (globalThis as { google?: { maps: ConstructorParameters<typeof TerraDrawGoogleMapsAdapter>[0]["lib"] } }).google?.maps;
    if (!active || !loaded || !map || !mapsLib) return;
    const outline = hex(color);
    const draw = new TerraDraw({
      adapter: new TerraDrawGoogleMapsAdapter({ lib: mapsLib, map }),
      modes: [
        new TerraDrawPolygonMode({
          styles: {
            fillColor: outline,
            fillOpacity: 0.2,
            outlineColor: outline,
            outlineOpacity: 1,
            outlineWidth: 2,
            closingPointWidth: 8,
            closingPointColor: outline,
            closingPointOpacity: 1,
            closingPointOutlineWidth: 2,
            closingPointOutlineColor: "#ffffff",
            closingPointOutlineOpacity: 1,
            snappingPointWidth: 6,
            snappingPointColor: outline,
            snappingPointOpacity: 1,
            snappingPointOutlineWidth: 1,
            snappingPointOutlineColor: "#ffffff",
            snappingPointOutlineOpacity: 1,
            editedPointWidth: 8,
            editedPointColor: outline,
            editedPointOpacity: 1,
            editedPointOutlineWidth: 2,
            editedPointOutlineColor: "#ffffff",
            editedPointOutlineOpacity: 1,
            coordinatePointWidth: 6,
            coordinatePointColor: outline,
            coordinatePointOpacity: 1,
            coordinatePointOutlineWidth: 1,
            coordinatePointOutlineColor: "#ffffff",
            coordinatePointOutlineOpacity: 1,
          },
        }),
        new TerraDrawRectangleMode({
          styles: {
            fillColor: outline,
            fillOpacity: 0.2,
            outlineColor: outline,
            outlineOpacity: 1,
            outlineWidth: 2,
            coordinatePointWidth: 6,
            coordinatePointColor: outline,
            coordinatePointOpacity: 1,
            coordinatePointOutlineWidth: 1,
            coordinatePointOutlineColor: "#ffffff",
            coordinatePointOutlineOpacity: 1,
          },
        }),
        new TerraDrawCircleMode({
          styles: {
            fillColor: outline,
            fillOpacity: 0.2,
            outlineColor: outline,
            outlineWidth: 2,
            outlineOpacity: 1,
            coordinatePointWidth: 6,
            coordinatePointColor: outline,
            coordinatePointOpacity: 1,
            coordinatePointOutlineWidth: 1,
            coordinatePointOutlineColor: "#ffffff",
            coordinatePointOutlineOpacity: 1,
            snappingPointColor: outline,
            snappingPointWidth: 6,
            snappingPointOpacity: 1,
            snappingPointOutlineColor: "#ffffff",
            snappingPointOutlineWidth: 1,
            snappingPointOutlineOpacity: 1,
          },
        }),
      ],
    });
    try {
      draw.start();
      draw.setMode(shape);
    } catch {
      onFailRef.current("Drawing could not start. Reload the page and try again.");
      return;
    }
    draw.on("finish", (id) => {
      const geometry = draw.getSnapshotFeature(id)?.geometry;
      const type = String(geometry?.type ?? "");
      if (geometry && (type === "Polygon" || type === "MultiPolygon")) {
        onDrawnRef.current({ type, coordinates: geometry.coordinates } as GeoGeometry);
        return;
      }
      onFailRef.current("That shape could not be saved. Draw an area instead.");
    });
    return () => {
      try {
        if (draw.enabled) draw.stop();
      } catch {
        // The map may already have been removed.
      }
    };
  }, [active, color, loaded, map, shape]);

  return null;
}
