import type { PropertyDetail, PropertyInput } from "../../api/prevention";
import type { LatLng } from "../maps/mapUtils";
import { formatTimestamp24 } from "../maintenance/maintenanceUtils";

export interface StreetViewCamera {
  panoId: string;
  heading: number | null;
  pitch: number | null;
  zoom: number | null;
}

export function mapsLink(point: LatLng | null, address: string): string {
  const query = point ? `${point.lat},${point.lng}` : address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Live Street View picture for a saved camera position. Loaded from Google each time; never stored. */
export function streetViewImageUrl(apiKey: string, camera: StreetViewCamera, width = 640, height = 360): string {
  if (!apiKey || !camera.panoId) return "";
  const fov = Math.round(Math.min(120, Math.max(10, 180 / 2 ** (camera.zoom ?? 1))));
  const params = new URLSearchParams({
    size: `${width}x${height}`,
    pano: camera.panoId,
    heading: String(Math.round(camera.heading ?? 0)),
    pitch: String(Math.round(camera.pitch ?? 0)),
    fov: String(fov),
    key: apiKey,
  });
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

const MAX_PHOTO_SIDE = 1280;
const MAX_PHOTO_CHARS = 650_000;

/** Shrinks a camera or file picture to a JPEG small enough to store with the property until R2 exists. */
export function shrinkPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("This browser cannot resize pictures."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.7, 0.55, 0.4]) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length <= MAX_PHOTO_CHARS) {
          resolve(dataUrl);
          return;
        }
      }
      reject(new Error("That picture is too large. Try a smaller one."));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not a picture this browser can open."));
    };
    image.src = url;
  });
}

export const EMPTY_PROPERTY: PropertyInput = {
  name: "",
  address: "",
  unit: "",
  city: "",
  state: "",
  postalCode: "",
  propertyType: "residential",
  occupancyType: "",
  squareFeet: "",
  yearBuilt: "",
  latitude: null,
  longitude: null,
  streetViewPanoId: "",
  streetViewHeading: null,
  streetViewPitch: null,
  streetViewZoom: null,
  photo: "",
  notes: "",
};

export function inputFromDetail(detail: PropertyDetail): PropertyInput {
  return {
    name: detail.name,
    address: detail.address,
    unit: detail.unit,
    city: detail.city,
    state: detail.state,
    postalCode: detail.postalCode,
    propertyType: detail.propertyType,
    occupancyType: detail.occupancyType,
    squareFeet: detail.squareFeet == null ? "" : String(detail.squareFeet),
    yearBuilt: detail.yearBuilt == null ? "" : String(detail.yearBuilt),
    latitude: detail.latitude,
    longitude: detail.longitude,
    streetViewPanoId: detail.streetViewPanoId,
    streetViewHeading: detail.streetViewHeading,
    streetViewPitch: detail.streetViewPitch,
    streetViewZoom: detail.streetViewZoom,
    photo: detail.photo,
    notes: detail.notes,
  };
}

export function formatSquareFeet(value: number | null): string {
  return value == null ? "" : value.toLocaleString("en-US");
}

/** ISO timestamp to MM/DD/YYYY (local date). */
export function formatDayOf(iso: string): string {
  return formatTimestamp24(iso).slice(0, 10);
}
