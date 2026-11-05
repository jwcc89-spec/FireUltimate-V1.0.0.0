import { parseAssignedNames } from "./scheduleStorage";

export interface ScheduleShiftEntryLike {
  recurrence?: string;
  recurrenceCustomValue?: string;
  recurrenceCustomMode?: string;
  recurrenceWeekdays?: number[];
  /** YYYY-MM-DD. Blank keeps the January 2026 A/B/C start. */
  rotationStartsOn?: string;
}

/** Monday-first labels. Day numbers match JavaScript: 0 is Sunday. */
export const WEEKDAY_CHOICES: Array<{ day: number; label: string }> = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 0, label: "Sun" },
];

export interface SchedulePersonLike {
  name: string;
  qualifications: string[];
}

/** True if the person has enough Scheduler Personnel data to appear in OT/full-roster pickers. */
export function isPersonnelSchedulerRecordComplete(person: {
  name?: string;
  shift?: string;
}): boolean {
  const name = String(person.name ?? "").trim();
  if (!name) return false;
  const shift = String(person.shift ?? "").trim();
  if (!shift) return false;
  return true;
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Ordinal suffix for a calendar day (1st, 2nd, 3rd, 4th, …). */
export function dayOrdinalSuffix(day: number): string {
  const n = Math.trunc(day);
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function getDatesForMonth(year: number, month: number): Date[] {
  const dates: Date[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(new Date(year, month, d));
  }
  return dates;
}

/** Sunday-start week containing the given local date. */
export function startOfWeekSunday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  date.setDate(date.getDate() - date.getDay());
  return date;
}

/** Seven local dates Sunday through Saturday for the week containing d. */
export function getDatesForWeekContaining(d: Date): Date[] {
  const start = startOfWeekSunday(d);
  return Array.from(
    { length: 7 },
    (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}

/** Example: Week of Nov 3–9 2026 */
export function formatScheduleWeekNavLabel(d: Date): string {
  const days = getDatesForWeekContaining(d);
  const start = days[0]!;
  const end = days[6]!;
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `Week of ${startMonth} ${start.getDate()}–${end.getDate()} ${end.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `Week of ${startMonth} ${start.getDate()}–${endMonth} ${end.getDate()} ${end.getFullYear()}`;
  }
  return `Week of ${startMonth} ${start.getDate()} ${start.getFullYear()}–${endMonth} ${end.getDate()} ${end.getFullYear()}`;
}

export function getShiftStartOffsetDays(shiftType: string): number {
  const normalized = shiftType.trim().toUpperCase();
  if (normalized.startsWith("C SHIFT")) return 0;
  if (normalized.startsWith("A SHIFT")) return 1;
  if (normalized.startsWith("B SHIFT")) return 2;
  return 0;
}

/** A real calendar date, or null when the shift should keep the A/B/C start. */
export function parseRotationStartDate(
  value: string | undefined,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function formatMonthDayYear(value: string | undefined): string {
  const parsed = parseRotationStartDate(value);
  if (!parsed) return "";
  return `${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}-${String(parsed.year).slice(2)}`;
}

function rotationAnchorUtc(entry: ScheduleShiftEntryLike | undefined, shiftType: string): number {
  const explicit = parseRotationStartDate(entry?.rotationStartsOn);
  if (explicit) return Date.UTC(explicit.year, explicit.month - 1, explicit.day);
  return Date.UTC(2026, 0, 1 + getShiftStartOffsetDays(shiftType));
}

/** Selected weekdays for a Custom shift, or null when the shift uses an every-N-days rule. */
export function parseRecurrenceWeekdays(entry: ScheduleShiftEntryLike | undefined): number[] | null {
  const recurrence = (entry?.recurrence ?? "").trim().toLowerCase();
  if (!recurrence.includes("custom")) return null;
  if ((entry?.recurrenceCustomMode ?? "").trim().toLowerCase() !== "weekdays") return null;
  const days = [
    ...new Set(
      (Array.isArray(entry?.recurrenceWeekdays) ? entry.recurrenceWeekdays : [])
        .map((day) => Math.floor(Number(day)))
        .filter((day) => day >= 0 && day <= 6),
    ),
  ].sort((left, right) => left - right);
  return days.length > 0 ? days : null;
}

export function formatWeekdayList(days: number[]): string {
  return WEEKDAY_CHOICES.filter((choice) => days.includes(choice.day))
    .map((choice) => choice.label)
    .join(", ");
}

export function recurrenceDisplayLabel(entry: ScheduleShiftEntryLike | undefined): string {
  const weekdays = parseRecurrenceWeekdays(entry);
  if (weekdays) return formatWeekdayList(weekdays);
  const custom = (entry?.recurrenceCustomValue ?? "").trim();
  if ((entry?.recurrence ?? "").trim() === "Custom" && custom) return custom;
  return (entry?.recurrence ?? "").trim() || "Daily";
}

/** True when this shift works on that calendar day. Shifts without weekday mode keep today's every-N-days rule. */
export function shiftOccursOnDate(
  entry: ScheduleShiftEntryLike | undefined,
  date: Date,
  shiftType: string,
): boolean {
  const weekdays = parseRecurrenceWeekdays(entry);
  if (weekdays) return weekdays.includes(date.getDay());
  const intervalDays = getRecurrenceIntervalDays(entry);
  if (intervalDays <= 1) return true;
  const anchorUtc = rotationAnchorUtc(entry, shiftType);
  const dateUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.floor((dateUtc - anchorUtc) / (24 * 60 * 60 * 1000));
  return dayDiff >= 0 && dayDiff % intervalDays === 0;
}

export function getRecurrenceIntervalDays(entry: ScheduleShiftEntryLike | undefined): number {
  const recurrence = (entry?.recurrence ?? "").trim().toLowerCase();
  if (!recurrence || recurrence === "daily") return 1;
  if (recurrence.includes("every other")) return 2;
  if (recurrence.includes("every 2")) return 2;
  if (recurrence.includes("every 3")) return 3;
  if (recurrence.includes("custom")) {
    const raw = Number((entry?.recurrenceCustomValue ?? "").trim());
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }
  return 1;
}

export function comparePersonnelByQualifications(
  a: SchedulePersonLike,
  b: SchedulePersonLike,
  qualificationOrder: string[],
): number {
  const rankFor = (person: SchedulePersonLike): number => {
    if (!Array.isArray(person.qualifications) || person.qualifications.length === 0) return 999;
    const ranks = person.qualifications
      .map((q) => qualificationOrder.findIndex((entry) => entry === q))
      .filter((rank) => rank >= 0);
    if (ranks.length === 0) return 999;
    return Math.min(...ranks);
  };
  const aRank = rankFor(a);
  const bRank = rankFor(b);
  if (aRank !== bRank) return aRank - bRank;
  if (a.qualifications.length !== b.qualifications.length) {
    return b.qualifications.length - a.qualifications.length;
  }
  return a.name.localeCompare(b.name);
}

export function getBestQualificationRankForPerson(
  person: SchedulePersonLike | undefined,
  qualificationRankMap: Map<string, number>,
): number {
  if (!person || !Array.isArray(person.qualifications) || person.qualifications.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const ranks = person.qualifications
    .map((qualification) => qualificationRankMap.get(qualification))
    .filter((rank): rank is number => rank !== undefined);
  return ranks.length > 0 ? Math.min(...ranks) : Number.POSITIVE_INFINITY;
}

export function formatSchedulePersonnelDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.toUpperCase() === "HIRE") return "HIRE";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const initial = parts[0]?.charAt(0).toUpperCase() ?? "";
  const lastName = parts.length > 1 ? parts[parts.length - 1]! : parts[0]!;
  return initial ? `${initial}.${lastName}` : lastName;
}

export function formatScheduleSegmentToken(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.toUpperCase() === "HIRE") return "HIRE";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.length > 1 ? parts[parts.length - 1]! : firstName;
  return `${lastName.slice(0, 3)}${firstName.slice(0, 1)}`.toUpperCase();
}

/** Info row only. 8:00 a.m. is "8A". 8:30 a.m. is "8:30A". 8:00 p.m. is "8P". */
export function formatInfoClock(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(2880, Math.floor(Number(totalMinutes) || 0)));
  const hour24 = Math.floor(clamped / 60) % 24;
  const minutes = clamped % 60;
  const suffix = hour24 >= 12 ? "P" : "A";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minutePart = minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`;
  return `${hour12}${minutePart}${suffix}`;
}

export interface SegmentCoverageLine {
  personnelName: string;
  text: string;
  overtime: boolean;
}

/** One line per timed piece, such as "KELL: 8A-10A". Apparatus names are left off. */
export function formatSegmentCoverageLines(
  segments: Array<{
    personnelName?: string;
    startMinutes?: number;
    endMinutes?: number;
    source?: string;
    overtime?: boolean;
  }>,
): SegmentCoverageLine[] {
  return segments
    .filter((segment) => {
      const name = String(segment.personnelName ?? "").trim();
      const start = Number(segment.startMinutes);
      const end = Number(segment.endMinutes);
      return (
        name.length > 0 &&
        name.toUpperCase() !== "HIRE" &&
        segment.source !== "auto_hire" &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        end > start
      );
    })
    .sort((left, right) => {
      const startDiff = Number(left.startMinutes) - Number(right.startMinutes);
      if (startDiff !== 0) return startDiff;
      return String(left.personnelName).localeCompare(String(right.personnelName));
    })
    .map((segment) => {
      const personnelName = String(segment.personnelName).trim();
      const range = `${formatInfoClock(Number(segment.startMinutes))}-${formatInfoClock(Number(segment.endMinutes))}`;
      return {
        personnelName,
        text: `${formatScheduleSegmentToken(personnelName)}: ${range}`,
        overtime: Boolean(segment.overtime),
      };
    });
}

export const QUALIFICATION_COLOR_OPTIONS = [
  { id: "red", label: "Red", hex: "#b91c1c" },
  { id: "orange", label: "Orange", hex: "#c2410c" },
  { id: "gold", label: "Gold", hex: "#a16207" },
  { id: "green", label: "Green", hex: "#15803d" },
  { id: "teal", label: "Teal", hex: "#0f766e" },
  { id: "blue", label: "Blue", hex: "#1d4ed8" },
  { id: "purple", label: "Purple", hex: "#7e22ce" },
  { id: "gray", label: "Gray", hex: "#475569" },
] as const;

export type ScheduleRowIconId = "engine" | "ambulance" | "maltese" | "medic" | "info" | "trades" | "sick";

export const SCHEDULE_ROW_ICON_OPTIONS: Array<{ id: ScheduleRowIconId; label: string }> = [
  { id: "engine", label: "Fire truck" },
  { id: "ambulance", label: "Ambulance" },
  { id: "maltese", label: "Fire" },
  { id: "medic", label: "Medic" },
  { id: "info", label: "Info" },
  { id: "trades", label: "Trades" },
  { id: "sick", label: "Injury / Sick" },
];

const SCHEDULE_ROW_ICON_IDS = new Set<string>(SCHEDULE_ROW_ICON_OPTIONS.map((choice) => choice.id));
const SCHEDULE_ROW_COLOR_IDS = new Set<string>(QUALIFICATION_COLOR_OPTIONS.map((choice) => choice.id));

export function parseScheduleRowIcon(raw: unknown): ScheduleRowIconId | "" {
  const value = String(raw ?? "").trim();
  return SCHEDULE_ROW_ICON_IDS.has(value) ? (value as ScheduleRowIconId) : "";
}

export function parseScheduleRowColor(raw: unknown): string {
  const value = String(raw ?? "").trim();
  return SCHEDULE_ROW_COLOR_IDS.has(value) ? value : "";
}

/** Name-only guess used when Admin has not picked an icon yet. */
export function guessScheduleRowIconFromName(label: string): ScheduleRowIconId {
  const normalized = label.toLowerCase();
  if (normalized.includes("ambulance")) return "ambulance";
  if (normalized.includes("medic") || normalized.includes("ems")) return "medic";
  if (normalized.includes("info")) return "info";
  if (normalized.includes("trade")) return "trades";
  if (normalized.includes("sick") || normalized.includes("injur")) return "sick";
  return "engine";
}

/** Soft pill fills for schedule seats (strong hex stays for Admin swatches / text accents). */
export const QUALIFICATION_COLOR_SOFT: Record<
  (typeof QUALIFICATION_COLOR_OPTIONS)[number]["id"],
  { backgroundColor: string; borderColor: string; color: string }
> = {
  red: { backgroundColor: "#fee2e2", borderColor: "#fecaca", color: "#991b1b" },
  orange: { backgroundColor: "#ffedd5", borderColor: "#fed7aa", color: "#c2410c" },
  gold: { backgroundColor: "#fef3c7", borderColor: "#fde68a", color: "#a16207" },
  green: { backgroundColor: "#dcfce7", borderColor: "#bbf7d0", color: "#15803d" },
  teal: { backgroundColor: "#ccfbf1", borderColor: "#99f6e4", color: "#0f766e" },
  blue: { backgroundColor: "#dbeafe", borderColor: "#bfdbfe", color: "#1d4ed8" },
  purple: { backgroundColor: "#f3e8ff", borderColor: "#e9d5ff", color: "#7e22ce" },
  gray: { backgroundColor: "#e2e8f0", borderColor: "#cbd5e1", color: "#334155" },
};

export interface QualificationOverrideRule {
  enabled: boolean;
  lowerQualification: string;
}

export function parseQualificationOverrides(raw: unknown): Record<string, QualificationOverrideRule> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const next: Record<string, QualificationOverrideRule> = {};
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = name.trim();
    if (!key || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    const lower = String(record.lowerQualification ?? "").trim();
    if (record.enabled === true) {
      next[key] = { enabled: true, lowerQualification: lower };
    }
  }
  return next;
}

export function parseQualificationColorMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allowed = new Set<string>(QUALIFICATION_COLOR_OPTIONS.map((choice) => choice.id));
  const next: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = name.trim();
    const id = String(value ?? "").trim();
    if (key && allowed.has(id)) next[key] = id;
  }
  return next;
}

export function qualificationColorHex(colorId: string | undefined): string | undefined {
  return QUALIFICATION_COLOR_OPTIONS.find((choice) => choice.id === colorId)?.hex;
}

export function qualificationColorSoftStyle(
  colorId: string | undefined,
): { backgroundColor: string; borderColor: string; color: string } | undefined {
  if (!colorId) return undefined;
  return QUALIFICATION_COLOR_SOFT[colorId as keyof typeof QUALIFICATION_COLOR_SOFT];
}

export function buildQualificationRankMap(qualificationOrder: string[]): Map<string, number> {
  const map = new Map<string, number>();
  qualificationOrder.forEach((qualification, index) => {
    map.set(qualification, index);
  });
  return map;
}

export function getHighestQualificationLabel(
  person: SchedulePersonLike,
  qualificationOrder: string[],
): string {
  const rankMap = buildQualificationRankMap(qualificationOrder);
  let bestRank = Number.POSITIVE_INFINITY;
  let bestLabel = "";
  person.qualifications.forEach((qualification) => {
    const rank = rankMap.get(qualification);
    if (rank !== undefined && rank < bestRank) {
      bestRank = rank;
      bestLabel = qualification;
    }
  });
  return bestLabel || person.qualifications[0] || "";
}

export function requirementsSatisfiedByAssignedPersonnel(
  requiredQualifications: string[],
  assignedNames: string[],
  personnelByName: Map<string, SchedulePersonLike>,
  qualificationRankMap: Map<string, number>,
): boolean {
  const requirements = requiredQualifications.filter(Boolean);
  if (requirements.length === 0) {
    return true;
  }
  const assigned = Array.from(
    new Set(
      assignedNames.flatMap((slotValue) =>
        parseAssignedNames(slotValue).filter((name) => name.trim().length > 0),
      ),
    ),
  )
    .map((name) => personnelByName.get(name))
    .filter((entry): entry is SchedulePersonLike => Boolean(entry));
  if (assigned.length < requirements.length) {
    return false;
  }
  const requirementRanks = requirements.map(
    (qualification) => qualificationRankMap.get(qualification) ?? Number.POSITIVE_INFINITY,
  );
  const assignedBestRanks = assigned.map((person) => {
    const ranks = person.qualifications
      .map((qualification) => qualificationRankMap.get(qualification))
      .filter((rank): rank is number => rank !== undefined);
    return ranks.length > 0 ? Math.min(...ranks) : Number.POSITIVE_INFINITY;
  });

  const usedAssigned = new Set<number>();
  const sortedRequirementIndices = requirementRanks
    .map((rank, index) => ({ rank, index }))
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.index);

  for (const reqIndex of sortedRequirementIndices) {
    const reqRank = requirementRanks[reqIndex]!;
    let selectedAssignedIndex: number | null = null;
    let selectedAssignedRank = Number.POSITIVE_INFINITY;
    assignedBestRanks.forEach((assignedRank, assignedIndex) => {
      if (usedAssigned.has(assignedIndex)) return;
      if (assignedRank <= reqRank && assignedRank < selectedAssignedRank) {
        selectedAssignedIndex = assignedIndex;
        selectedAssignedRank = assignedRank;
      }
    });
    if (selectedAssignedIndex === null) {
      return false;
    }
    usedAssigned.add(selectedAssignedIndex);
  }
  return true;
}

export function reorderAssignedByRequirementCoverage(
  requiredQualifications: string[],
  minimumPersonnel: number,
  assignedNames: string[],
  personnelByName: Map<string, SchedulePersonLike>,
  qualificationRankMap: Map<string, number>,
): string[] {
  const sanitizedSlots = Array.from(
    new Set(assignedNames.map((name) => name.trim()).filter((name) => name.length > 0)),
  );
  if (sanitizedSlots.length === 0 || minimumPersonnel <= 0) {
    return sanitizedSlots;
  }

  const required = requiredQualifications.slice(0, minimumPersonnel);
  const hasRequiredQualifications = required.some((qualification) => qualification.trim().length > 0);
  if (!hasRequiredQualifications) {
    return sanitizedSlots;
  }

  const selectedNames: string[] = Array.from({ length: minimumPersonnel }, () => "");
  const selectedSet = new Set<string>();
  const requirementSlots = required
    .map((requiredQualification, slotIndex) => {
      const normalizedRequirement = requiredQualification.trim();
      return {
        slotIndex,
        requiredRank: normalizedRequirement
          ? (qualificationRankMap.get(normalizedRequirement) ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY,
        hasRequirement: normalizedRequirement.length > 0,
      };
    })
    .filter((slot) => slot.hasRequirement)
    .sort((left, right) => left.requiredRank - right.requiredRank);

  requirementSlots.forEach((slot) => {
    let bestCandidate: string | null = null;
    let bestRank = -1;
    sanitizedSlots.forEach((slotValue) => {
      if (selectedSet.has(slotValue)) return;
      const representedNames = parseAssignedNames(slotValue).filter(
        (name) => name.trim().length > 0,
      );
      if (representedNames.length === 0) return;
      const slotBestRank = representedNames.reduce((lowestRank, representedName) => {
        const person = personnelByName.get(representedName);
        if (!person) return lowestRank;
        return Math.min(
          lowestRank,
          getBestQualificationRankForPerson(person, qualificationRankMap),
        );
      }, Number.POSITIVE_INFINITY);
      const meetsRequirement = slotBestRank <= slot.requiredRank;
      const isLessOverqualified = bestCandidate === null || slotBestRank > bestRank;
      if (meetsRequirement && isLessOverqualified) {
        bestCandidate = slotValue;
        bestRank = slotBestRank;
      }
    });
    if (bestCandidate) {
      selectedNames[slot.slotIndex] = bestCandidate;
      selectedSet.add(bestCandidate);
    }
  });

  const remaining = sanitizedSlots.filter((slotValue) => !selectedSet.has(slotValue));
  return [...selectedNames, ...remaining];
}

/** How many additional-field rows to show. One blank row can follow the last filled row. */
export function visibleAdditionalRowCount(
  stored: string[],
  rowsVisible: number,
  maximumRows: number,
): number {
  const max = Math.max(0, Math.floor(Number(maximumRows)) || 0);
  if (max === 0) return 0;
  const min = Math.min(max, Math.max(0, Math.floor(Number(rowsVisible)) || 0));
  const limited = stored.slice(0, max);
  let lastFilled = -1;
  for (let index = 0; index < limited.length; index += 1) {
    if (String(limited[index] ?? "").trim()) lastFilled = index;
  }
  if (min === 0) return Math.min(max, Math.max(0, lastFilled + 1));
  let count = Math.max(min, lastFilled + 1);
  const trailingEmpties = limited.length - (lastFilled + 1);
  if (trailingEmpties === 1 && count < max) count += 1;
  return Math.min(max, count);
}

/** After a row is filled, keep one empty row below it until the maximum is reached. */
export function withNextAdditionalRow(
  stored: string[],
  rowsVisible: number,
  maximumRows: number,
): string[] {
  const max = Math.max(0, Math.floor(Number(maximumRows)) || 0);
  if (max === 0) return [];
  const limited = stored.slice(0, max).map((value) => String(value ?? ""));
  let lastFilled = -1;
  for (let index = 0; index < limited.length; index += 1) {
    if (limited[index].trim()) lastFilled = index;
  }
  if (Math.max(0, Math.floor(Number(rowsVisible)) || 0) === 0) {
    return limited.slice(0, Math.max(0, lastFilled + 1));
  }
  const visible = visibleAdditionalRowCount(limited, rowsVisible, max);
  if (lastFilled < 0 || visible > lastFilled + 1 || visible >= max) {
    return limited.slice(0, visible);
  }
  const next = limited.slice(0, lastFilled + 1);
  next.push("");
  return next;
}

/** True when this person fills a required seat that is still open. */
export function personCanJoinApparatus(
  personName: string,
  requiredQualifications: string[],
  minimumPersonnel: number,
  assignedNames: string[],
  personnelByName: Map<string, SchedulePersonLike>,
  qualificationRankMap: Map<string, number>,
): boolean {
  const existing = assignedNames
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name !== personName.trim());
  const ordered = reorderAssignedByRequirementCoverage(
    requiredQualifications,
    minimumPersonnel,
    existing,
    personnelByName,
    qualificationRankMap,
  );
  const required = requiredQualifications.slice(0, minimumPersonnel);
  const unmetRanks: number[] = [];
  for (let index = 0; index < required.length; index += 1) {
    const qualification = required[index]?.trim() ?? "";
    if (!qualification) continue;
    const occupant = (ordered[index] ?? "").trim();
    const requiredRank =
      qualificationRankMap.get(qualification) ?? Number.POSITIVE_INFINITY;
    const occupantRank = occupant
      ? getBestQualificationRankForPerson(personnelByName.get(occupant), qualificationRankMap)
      : Number.POSITIVE_INFINITY;
    if (!(occupantRank <= requiredRank)) {
      unmetRanks.push(requiredRank);
    }
  }
  if (unmetRanks.length === 0) return true;
  const personRank = getBestQualificationRankForPerson(
    personnelByName.get(personName.trim()),
    qualificationRankMap,
  );
  return unmetRanks.some((requiredRank) => personRank <= requiredRank);
}
