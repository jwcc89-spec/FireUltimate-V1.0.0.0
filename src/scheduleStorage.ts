export type ScheduleAssignments = Record<string, Record<string, string[]>>;
export type ScheduleOvertimeSplit = Record<string, Record<string, boolean[]>>;

const SCHEDULE_ASSIGNMENTS_STORAGE_KEY = "fire-ultimate-schedule-assignments";
const SCHEDULE_OVERTIME_SPLIT_STORAGE_KEY = "fire-ultimate-schedule-overtime-split";
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
