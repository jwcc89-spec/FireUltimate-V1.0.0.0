import { useEffect, useRef, useState } from "react";
import { Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Camera, ExternalLink, Eye, Map as MapIcon } from "lucide-react";
import { HtmlMarker } from "../maps/HtmlMarker";
import { DEFAULT_CENTER, HIDE_GOOGLE_PLACES, type LatLng } from "../maps/mapUtils";
import { mapsLink, type StreetViewCamera } from "./preventionUtils";

interface Panorama {
  addListener(event: string, handler: () => void): unknown;
  getStatus(): string;
  getPosition(): { lat(): number; lng(): number } | null;
  getPano(): string;
  setPano(pano: string): void;
  getPov(): { heading: number; pitch: number };
  setPov(pov: { heading: number; pitch: number }): void;
  getZoom(): number;
  setZoom(zoom: number): void;
}

interface StreetViewRuntime {
  StreetViewPanorama: new (element: HTMLElement, options: Record<string, unknown>) => Panorama;
  StreetViewService: new () => {
    getPanorama(request: Record<string, unknown>): Promise<{ data: { location?: { pano?: string } | null } }>;
  };
  StreetViewSource: { OUTDOOR: unknown };
}

function headingBetween(from: LatLng, to: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Live Street View at the pin. With a saved camera it opens on that view; otherwise it faces the pin.
 * When onUseView is given, "Use this view as thumbnail" hands back the current camera position.
 * Must sit inside APIProvider.
 */
export function StreetViewPanel({
  point,
  saved,
  onUseView,
}: {
  point: LatLng | null;
  saved: StreetViewCamera;
  onUseView?: (camera: StreetViewCamera) => void;
}) {
  const library = useMapsLibrary("streetView") as unknown as StreetViewRuntime | null;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoramaRef = useRef<Panorama | null>(null);
  const savedRef = useRef(saved);
  const pointRef = useRef(point);
  const pointKey = point ? `${point.lat},${point.lng}` : "";
  const pointKeyRef = useRef(pointKey);
  const [found, setFound] = useState<{ key: string; ok: boolean } | null>(null);
  const [usedNote, setUsedNote] = useState("");
  const status: "loading" | "ok" | "none" = !point
    ? "none"
    : found?.key === pointKey
      ? found.ok
        ? "ok"
        : "none"
      : "loading";

  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  useEffect(() => {
    pointRef.current = point;
    pointKeyRef.current = pointKey;
  }, [point, pointKey]);

  useEffect(() => {
    if (!library || !containerRef.current || panoramaRef.current) return;
    const panorama = new library.StreetViewPanorama(containerRef.current, {
      addressControl: false,
      fullscreenControl: true,
      motionTracking: false,
      motionTrackingControl: false,
      showRoadLabels: true,
      visible: true,
    });
    panoramaRef.current = panorama;
    panorama.addListener("status_changed", () => {
      setFound({ key: pointKeyRef.current, ok: panorama.getStatus() === "OK" });
    });
    panorama.addListener("position_changed", () => {
      const at = panorama.getPosition();
      const target = pointRef.current;
      if (!at || !target || panorama.getPano() === savedRef.current.panoId) return;
      panorama.setPov({ heading: headingBetween({ lat: at.lat(), lng: at.lng() }, target), pitch: 0 });
    });
  }, [library]);

  const { lat, lng } = point ?? { lat: null, lng: null };
  useEffect(() => {
    const panorama = panoramaRef.current;
    if (!panorama || !library || lat == null || lng == null) return;
    const key = `${lat},${lng}`;
    const camera = savedRef.current;
    if (camera.panoId) {
      panorama.setPano(camera.panoId);
      panorama.setPov({ heading: camera.heading ?? 0, pitch: camera.pitch ?? 0 });
      panorama.setZoom(camera.zoom ?? 1);
      return;
    }
    const service = new library.StreetViewService();
    void service
      .getPanorama({ location: { lat, lng }, radius: 80, source: library.StreetViewSource.OUTDOOR })
      .then(({ data }) => {
        const panoId = data.location?.pano;
        if (panoId) panorama.setPano(panoId);
        else setFound({ key, ok: false });
      })
      .catch(() => setFound({ key, ok: false }));
  }, [lat, lng, library]);

  const applyView = () => {
    const panorama = panoramaRef.current;
    if (!panorama || !onUseView) return;
    const pov = panorama.getPov();
    onUseView({ panoId: panorama.getPano(), heading: pov.heading, pitch: pov.pitch, zoom: panorama.getZoom() });
    setUsedNote("This view will be the thumbnail when you save.");
  };

  return (
    <article className="panel property-map-panel">
      <header className="property-map-panel-header">
        <span>
          <Eye size={15} aria-hidden="true" /> Street View
        </span>
        {onUseView && status !== "none" ? (
          <button type="button" className="secondary-button compact-button maintenance-icon-button" onClick={applyView}>
            <Camera size={14} aria-hidden="true" /> Use this view as thumbnail
          </button>
        ) : null}
      </header>
      <div className="property-map-panel-body">
        <div ref={containerRef} className="property-street-view" hidden={status === "none"} />
        {status === "none" ? (
          <p className="property-map-panel-note">
            {point ? "No Street View picture near this pin." : "Place the pin to see Street View."}
          </p>
        ) : null}
      </div>
      {usedNote ? <p className="field-hint">{usedNote}</p> : null}
    </article>
  );
}

function Recenter({ point }: { point: LatLng | null }) {
  const map = useMap();
  const { lat, lng } = point ?? { lat: null, lng: null };
  useEffect(() => {
    if (map && lat != null && lng != null) map.panTo({ lat, lng });
  }, [lat, lng, map]);
  return null;
}

/**
 * Satellite view with the property pin. When onPlace is given the pin can be dragged, or the map clicked,
 * to set the exact building. Must sit inside APIProvider.
 */
export function AerialPanel({
  point,
  address,
  fallbackCenter,
  onPlace,
}: {
  point: LatLng | null;
  address: string;
  fallbackCenter?: LatLng | null;
  onPlace?: (point: LatLng) => void;
}) {
  return (
    <article className="panel property-map-panel">
      <header className="property-map-panel-header">
        <span>
          <MapIcon size={15} aria-hidden="true" /> Aerial View
        </span>
        <a href={mapsLink(point, address)} target="_blank" rel="noreferrer" className="call-map-link">
          <ExternalLink size={13} aria-hidden="true" /> Open in Maps
        </a>
      </header>
      <div className="property-map-panel-body">
        <Map
          defaultCenter={point ?? fallbackCenter ?? DEFAULT_CENTER}
          defaultZoom={point ? 19 : 14}
          mapTypeId="hybrid"
          styles={HIDE_GOOGLE_PLACES}
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl
          gestureHandling="cooperative"
          tilt={0}
          style={{ width: "100%", height: "100%" }}
          onClick={(event) => {
            const latLng = event.detail.latLng;
            if (onPlace && latLng) onPlace({ lat: latLng.lat, lng: latLng.lng });
          }}
        >
          <Recenter point={point} />
          {point ? (
            <HtmlMarker position={point} title={address} zIndex={10} draggable={Boolean(onPlace)} onDragEnd={onPlace}>
              <span className="property-pin" />
            </HtmlMarker>
          ) : null}
        </Map>
      </div>
      {onPlace ? (
        <p className="field-hint">Drag the pin, or click the map, to mark the exact building. That pin is saved with the property.</p>
      ) : null}
    </article>
  );
}
