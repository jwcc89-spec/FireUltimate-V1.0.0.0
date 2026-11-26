import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMap } from "@vis.gl/react-google-maps";
import type { LatLng } from "./mapUtils";

interface Projection {
  fromLatLngToDivPixel(point: unknown): { x: number; y: number } | null;
  fromDivPixelToLatLng(point: unknown): { lat(): number; lng(): number } | null;
}

interface Overlay {
  setMap(map: unknown): void;
  getProjection(): Projection | null;
  getPanes(): { overlayMouseTarget: HTMLElement } | null;
  draw(): void;
}

interface MapsRuntime {
  OverlayView: (new () => Overlay) & { preventMapHitsAndGesturesFrom(element: HTMLElement): void };
  LatLng: new (lat: number, lng: number) => unknown;
  Point: new (x: number, y: number) => unknown;
}

function mapsRuntime(): MapsRuntime | null {
  return (globalThis as { google?: { maps?: MapsRuntime } }).google?.maps ?? null;
}

type PinOverlayClass = new (container: HTMLElement, position: { current: LatLng }) => Overlay;
let pinOverlayClass: PinOverlayClass | null = null;

/** Built once, after the Google script has loaded, because it extends Google's OverlayView. */
function pinOverlay(maps: MapsRuntime): PinOverlayClass {
  if (pinOverlayClass) return pinOverlayClass;
  class PinOverlay extends maps.OverlayView {
    container: HTMLElement;
    position: { current: LatLng };
    constructor(container: HTMLElement, position: { current: LatLng }) {
      super();
      this.container = container;
      this.position = position;
    }
    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.container);
    }
    draw() {
      const pixel = this.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(this.position.current.lat, this.position.current.lng));
      if (!pixel) return;
      this.container.style.left = `${pixel.x}px`;
      this.container.style.top = `${pixel.y}px`;
    }
    onRemove() {
      this.container.remove();
    }
  }
  pinOverlayClass = PinOverlay;
  return PinOverlay;
}

/**
 * A pin drawn as plain HTML on the map. Advanced markers need a Google map ID, and a map ID makes Google
 * ignore the style that hides its own places (the "Google Layer"), so the department's pins use this instead.
 * Clicks and drags are native listeners: the map stops these events before React would see them.
 */
export function HtmlMarker({
  position,
  title,
  zIndex = 1,
  draggable = false,
  onClick,
  onDragEnd,
  children,
}: {
  position: LatLng;
  title?: string;
  zIndex?: number;
  draggable?: boolean;
  onClick?: () => void;
  onDragEnd?: (point: LatLng) => void;
  children: ReactNode;
}) {
  const map = useMap();
  const [container] = useState(() => {
    const element = document.createElement("div");
    element.className = "map-html-marker";
    return element;
  });
  const overlayRef = useRef<Overlay | null>(null);
  const positionRef = useRef(position);
  const handlers = useRef({ onClick, onDragEnd, draggable });

  useEffect(() => {
    handlers.current = { onClick, onDragEnd, draggable };
    container.classList.toggle("map-html-marker-draggable", draggable);
  }, [container, draggable, onClick, onDragEnd]);

  useEffect(() => {
    container.setAttribute("title", title ?? "");
    container.style.setProperty("z-index", String(zIndex));
  }, [container, title, zIndex]);

  useEffect(() => {
    const maps = mapsRuntime();
    if (!map || !maps) return;
    const PinOverlay = pinOverlay(maps);
    const overlay = new PinOverlay(container, positionRef);
    maps.OverlayView.preventMapHitsAndGesturesFrom(container);
    overlay.setMap(map);
    overlayRef.current = overlay;
    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [container, map]);

  const { lat, lng } = position;
  useEffect(() => {
    positionRef.current = { lat, lng };
    overlayRef.current?.draw();
  }, [lat, lng]);

  useEffect(() => {
    let start: { x: number; y: number; left: number; top: number } | null = null;
    let moved = false;
    let skipClick = false;
    const onDown = (event: PointerEvent) => {
      if (!handlers.current.draggable) return;
      start = {
        x: event.clientX,
        y: event.clientY,
        left: Number.parseFloat(container.style.left) || 0,
        top: Number.parseFloat(container.style.top) || 0,
      };
      moved = false;
      container.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      container.style.left = `${start.left + dx}px`;
      container.style.top = `${start.top + dy}px`;
    };
    const onUp = () => {
      if (!start) return;
      start = null;
      if (!moved) return;
      skipClick = true;
      const maps = mapsRuntime();
      const point = maps
        ? overlayRef.current
            ?.getProjection()
            ?.fromDivPixelToLatLng(
              new maps.Point(Number.parseFloat(container.style.left) || 0, Number.parseFloat(container.style.top) || 0),
            )
        : null;
      if (point) handlers.current.onDragEnd?.({ lat: point.lat(), lng: point.lng() });
    };
    const onTap = () => {
      if (skipClick) {
        skipClick = false;
        return;
      }
      handlers.current.onClick?.();
    };
    container.addEventListener("pointerdown", onDown);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerup", onUp);
    container.addEventListener("click", onTap);
    return () => {
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("click", onTap);
    };
  }, [container]);

  return createPortal(children, container);
}
