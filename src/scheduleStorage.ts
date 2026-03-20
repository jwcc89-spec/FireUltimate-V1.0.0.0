export type ScheduleAssignments = Record<string, Record<string, string[]>>;
export type ScheduleOvertimeSplit = Record<string, Record<string, boolean[]>>;
export type ScheduleSegmentSource = "manual" | "trade" | "auto_hire";
export type ScheduleSegmentAssigneeType = "personnel" | "hire";
export interface ScheduleSegment {
  id: string;
  assigneeType: ScheduleSegmentAssigneeType;
  personnelName: string;
  startMinutes: number;
  endMinutes: number;
  source: ScheduleSegmentSource;
  tradeRef?: string;
}
export type ScheduleSlotSegments = Record<string, Record<string, ScheduleSegment[][]>>;

const SCHEDULE_ASSIGNMENTS_STORAGE_KEY = "fire-ultimate-schedule-assignments";
const SCHEDULE_OVERTIME_SPLIT_STORAGE_KEY = "fire-ultimate-schedule-overtime-split";
const SCHEDULE_SLOT_SEGMENTS_STORAGE_KEY = "fire-ultimate-schedule-slot-segments";
const OVERTIME_SLOT_DELIMITER = "||OT||";

export function loadScheduleAssignments(): ScheduleAssignments {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SCHEDULE_ASSIGNMENTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ScheduleAssignments;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveScheduleAssignments(data: ScheduleAssignments): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SCHEDULE_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(data));
}

export function loadScheduleOvertimeSplit(): ScheduleOvertimeSplit {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SCHEDULE_OVERTIME_SPLIT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ScheduleOvertimeSplit;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveScheduleOvertimeSplit(data: ScheduleOvertimeSplit): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SCHEDULE_OVERTIME_SPLIT_STORAGE_KEY, JSON.stringify(data));
}

export function loadScheduleSlotSegments(): ScheduleSlotSegments {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SCHEDULE_SLOT_SEGMENTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ScheduleSlotSegments;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveScheduleSlotSegments(data: ScheduleSlotSegments): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SCHEDULE_SLOT_SEGMENTS_STORAGE_KEY, JSON.stringify(data));
}

export function parseAssignedNames(slotValue: string): string[] {
  return String(slotValue ?? "")
    .split(OVERTIME_SLOT_DELIMITER)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function serializeAssignedNames(names: string[]): string {
  return names
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(OVERTIME_SLOT_DELIMITER);
}

export function toScheduleStorageDateKey(shiftType: string, dateKey: string): string {
  return `${shiftType}::${dateKey}`;
}

export function clampDayMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1440, Math.floor(value)));
}

export function parseTimeToMinutes(value: string): number {
  const trimmed = String(value ?? "").trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return 0;
  const hours = Math.max(0, Math.min(23, Number.parseInt(match[1] ?? "0", 10) || 0));
  const minutes = Math.max(0, Math.min(59, Number.parseInt(match[2] ?? "0", 10) || 0));
  return hours * 60 + minutes;
}

export function minutesToTimeValue(totalMinutes: number): string {
  const clamped = clampDayMinutes(totalMinutes);
  const hours = Math.floor(clamped / 60) % 24;
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
