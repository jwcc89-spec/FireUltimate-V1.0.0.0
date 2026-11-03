import { parseAssignedNames } from "./scheduleStorage";

export interface ScheduleShiftEntryLike {
  recurrence?: string;
  recurrenceCustomValue?: string;
}

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

export function getDatesForMonth(year: number, month: number): Date[] {
  const dates: Date[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(new Date(year, month, d));
  }
  return dates;
}

export function getShiftStartOffsetDays(shiftType: string): number {
  const normalized = shiftType.trim().toUpperCase();
  if (normalized.startsWith("C SHIFT")) return 0;
  if (normalized.startsWith("A SHIFT")) return 1;
  if (normalized.startsWith("B SHIFT")) return 2;
  return 0;
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
  const max = Math.max(1, Math.floor(maximumRows) || 1);
  const min = Math.min(max, Math.max(1, Math.floor(rowsVisible) || 1));
  const limited = stored.slice(0, max);
  let lastFilled = -1;
  for (let index = 0; index < limited.length; index += 1) {
    if (String(limited[index] ?? "").trim()) lastFilled = index;
  }
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
  const max = Math.max(1, Math.floor(maximumRows) || 1);
  const limited = stored.slice(0, max).map((value) => String(value ?? ""));
  let lastFilled = -1;
  for (let index = 0; index < limited.length; index += 1) {
    if (limited[index].trim()) lastFilled = index;
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
