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

  required.forEach((requiredQualification, slotIndex) => {
    const normalizedRequirement = requiredQualification.trim();
    if (!normalizedRequirement) {
      return;
    }
    const requiredRank =
      qualificationRankMap.get(normalizedRequirement) ?? Number.POSITIVE_INFINITY;
    let bestCandidate: string | null = null;
    let bestRank = Number.POSITIVE_INFINITY;
    sanitizedSlots.forEach((slotValue) => {
      if (selectedSet.has(slotValue)) return;
      const representedNames = parseAssignedNames(slotValue).filter(
        (name) => name.trim().length > 0,
      );
      if (representedNames.length === 0) return;
      const slotBestRank = representedNames.reduce((lowestRank, representedName) => {
        const person = personnelByName.get(representedName);
        if (!person) {
          return lowestRank;
        }
        const personBestRank = getBestQualificationRankForPerson(
          person,
          qualificationRankMap,
        );
        return Math.min(lowestRank, personBestRank);
      }, Number.POSITIVE_INFINITY);
      if (slotBestRank <= requiredRank && slotBestRank < bestRank) {
        bestCandidate = slotValue;
        bestRank = slotBestRank;
      }
    });
    if (bestCandidate) {
      selectedNames[slotIndex] = bestCandidate;
      selectedSet.add(bestCandidate);
    }
  });

  const remaining = sanitizedSlots.filter((slotValue) => !selectedSet.has(slotValue));
  return [...selectedNames, ...remaining];
}
