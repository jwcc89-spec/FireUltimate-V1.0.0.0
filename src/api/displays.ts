/** Station display boards, board messages and board events. */
import { apiJson, send } from "./maintenance";

export const BOARD_PANELS: { value: BoardPanel; label: string }[] = [
  { value: "apparatus", label: "Apparatus" },
  { value: "onDuty", label: "On Duty" },
  { value: "incidents", label: "Incidents" },
  { value: "events", label: "Events" },
  { value: "messages", label: "Messages" },
];

export type BoardPanel = "apparatus" | "onDuty" | "incidents" | "events" | "messages";

/** Position on the board's 8 by 8 grid, in squares. */
export interface GridBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BoardLayout = Partial<Record<BoardPanel, GridBox>>;

export interface DisplayBoard {
  id: string;
  name: string;
  stationName: string;
  callFilter: "all" | "districts";
  filterGeofenceIds: string[];
  takeoverSeconds: number;
  soundOn: boolean;
  panels: Record<BoardPanel, boolean>;
  layout: BoardLayout;
  updatedAt: string;
  updatedBy: string;
}

export type DisplayBoardInput = Omit<DisplayBoard, "id" | "updatedAt" | "updatedBy">;

export interface BoardDepartment {
  name: string;
  logoDataUrl: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  important: boolean;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  updatedBy: string;
}

export type AnnouncementInput = Pick<Announcement, "title" | "body" | "important" | "startsAt" | "endsAt">;

export interface DisplayEvent {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  notes: string;
  updatedAt: string;
  updatedBy: string;
}

export type DisplayEventInput = Pick<DisplayEvent, "title" | "startsAt" | "location" | "notes">;

export interface BoardApparatus {
  unitId: string;
  label: string;
  station: string;
  status: string;
  outOfServiceSince: string;
  outOfServiceReason: string;
}

export interface BoardIncident {
  id: string;
  incidentNumber: string;
  incidentType: string;
  priority: string;
  address: string;
  stillDistrict: string;
  assignedUnits: string;
  receivedAt: string;
  currentState: string;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  districtUnknown: boolean;
}

export interface BoardFeed {
  serverTime: string;
  apparatus: BoardApparatus[];
  onDuty: { shifts: string[]; units: { unit: string; station: string; people: string[] }[] };
  incidents: BoardIncident[];
  events: DisplayEvent[];
  announcements: Announcement[];
}

export interface IncidentLocation {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

const boardPath = (id: string) => `/api/displays/boards/${encodeURIComponent(id)}`;

export const getBoards = () => apiJson<DisplayBoard[]>("/api/displays/boards");
export const getBoard = (id: string) =>
  apiJson<{ board: DisplayBoard; department: BoardDepartment; stationAddress: string }>(boardPath(id));
export const getBoardPulse = (id: string) => apiJson<{ latest: BoardIncident[] }>(`${boardPath(id)}/pulse`);
export const createBoard = (input: DisplayBoardInput) => apiJson<DisplayBoard>("/api/displays/boards", send("POST", input));
export const updateBoard = (id: string, input: DisplayBoardInput) => apiJson<DisplayBoard>(boardPath(id), send("PATCH", input));
export const deleteBoard = (id: string) => apiJson<void>(boardPath(id), send("DELETE"));

/** The board's local date and minute of the day, so "on duty now" follows the station's clock. */
export function getBoardFeed(id: string, now: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const minute = now.getHours() * 60 + now.getMinutes();
  return apiJson<BoardFeed>(`${boardPath(id)}/feed?date=${date}&minute=${minute}`);
}

export const getAnnouncements = () => apiJson<Announcement[]>("/api/displays/announcements");
export const createAnnouncement = (input: AnnouncementInput) =>
  apiJson<Announcement>("/api/displays/announcements", send("POST", input));
export const updateAnnouncement = (id: string, input: AnnouncementInput) =>
  apiJson<Announcement>(`/api/displays/announcements/${encodeURIComponent(id)}`, send("PATCH", input));
export const deleteAnnouncement = (id: string) =>
  apiJson<void>(`/api/displays/announcements/${encodeURIComponent(id)}`, send("DELETE"));

export const getDisplayEvents = () => apiJson<DisplayEvent[]>("/api/displays/events");
export const createDisplayEvent = (input: DisplayEventInput) =>
  apiJson<DisplayEvent>("/api/displays/events", send("POST", input));
export const updateDisplayEvent = (id: string, input: DisplayEventInput) =>
  apiJson<DisplayEvent>(`/api/displays/events/${encodeURIComponent(id)}`, send("PATCH", input));
export const deleteDisplayEvent = (id: string) => apiJson<void>(`/api/displays/events/${encodeURIComponent(id)}`, send("DELETE"));

export const locateIncident = (incidentId: string) =>
  apiJson<IncidentLocation>("/api/maps/incident-location", send("POST", { incidentId }));

export function directionsUrl(location: { address: string; latitude: number | null; longitude: number | null }): string {
  const destination =
    location.latitude != null && location.longitude != null ? `${location.latitude},${location.longitude}` : location.address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
