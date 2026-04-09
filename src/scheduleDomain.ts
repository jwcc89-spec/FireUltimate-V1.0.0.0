export type ScheduleSupportValueMode = "text" | "personnel";

export interface PersonnelScheduleRow {
  id: string;
  label: string;
  rowType: "apparatus" | "support";
  unitId: string;
  unitType: string;
  slotCount: number;
  minimumPersonnel: number;
  requiredQualifications: string[];
  stationName?: string;
  supportValueMode?: ScheduleSupportValueMode;
  /** When true (UI: "Apparatus override"), support row removes/conflicts with apparatus coverage for that person. */
  personnelOverride?: boolean;
  supportSegmentedMode?: boolean;
}

export interface PersonnelScheduleData {
  stations: Array<{
    name: string;
    address: string;
    city: string;
    state: string;
    phone: string;
    mobilePhone: string;
  }>;
  apparatus: Array<{
    apparatus: string;
    minimumPersonnel: number;
    maximumPersonnel: number;
    personnelRequirements: string[];
    station: string;
  }>;
  additionalFields: Array<{
    id: string;
    fieldName: string;
    numberOfSlots: number;
    valueMode: ScheduleSupportValueMode;
    /** Stored as personnelOverride; admin UI label: Apparatus override. */
    personnelOverride: boolean;
    segmentedModeEnabled: boolean;
  }>;
  standardOvertimeSlot: number;
  personnel: Array<{
    name: string;
    shift: string;
    apparatusAssignment: string;
    station: string;
    userType: string;
    qualifications: string[];
  }>;
  personnelQualifications: string[];
  kellyRotations: Array<{
    personnel: string;
    repeatsEveryValue: number;
    repeatsEveryUnit: "Days" | "Shifts";
    startsOn: string;
  }>;
  shiftEntries: Array<{
    shiftType: string;
    shiftDuration: number;
    recurrence: string;
    recurrenceCustomValue?: string;
    startTime?: string;
  }>;
}

interface LoadScheduleDeps {
  readDepartmentDetailsDraft: () => Record<string, unknown>;
  normalizeDepartmentDraft: (raw: Record<string, unknown>) => Record<string, unknown>;
  normalizeAdditionalFields: (
    raw: unknown,
  ) => PersonnelScheduleData["additionalFields"];
}

export function loadPersonnelScheduleData({
  readDepartmentDetailsDraft,
  normalizeDepartmentDraft,
  normalizeAdditionalFields,
}: LoadScheduleDeps): PersonnelScheduleData {
  const raw = readDepartmentDetailsDraft();
  const d = normalizeDepartmentDraft(raw && typeof raw === "object" ? raw : {});
  const personnel = Array.isArray(d.schedulerPersonnelRecords)
    ? (d.schedulerPersonnelRecords as PersonnelScheduleData["personnel"])
    : [];
  const stations = Array.isArray(d.stationRecords)
    ? (d.stationRecords as PersonnelScheduleData["stations"])
    : [];
  const apparatus = Array.isArray(d.schedulerApparatusRecords)
    ? (d.schedulerApparatusRecords as PersonnelScheduleData["apparatus"])
    : [];
  const additionalFields = normalizeAdditionalFields(d.additionalFields);
  const standardOvertimeSlot = Math.max(
    1,
    Math.floor(Number(d.standardOvertimeSlot ?? 24) || 24),
  );
  const personnelQualifications = Array.isArray(d.personnelQualifications)
    ? (d.personnelQualifications as string[])
    : [];
  const kellyRotations = Array.isArray(d.kellyRotations)
    ? (d.kellyRotations as PersonnelScheduleData["kellyRotations"])
    : [];
  const shiftEntries = Array.isArray(d.shiftInformationEntries)
    ? (d.shiftInformationEntries as Array<Record<string, unknown>>).map((entry) => ({
        shiftType: String(entry.shiftType ?? ""),
        shiftDuration: Number(entry.shiftDuration ?? 0) || 0,
        recurrence: String(entry.recurrence ?? "Daily"),
        recurrenceCustomValue: String(entry.recurrenceCustomValue ?? ""),
        startTime: String(entry.startTime ?? ""),
      }))
    : [];
  return {
    stations,
    apparatus,
    additionalFields,
    standardOvertimeSlot,
    personnel,
    personnelQualifications,
    kellyRotations,
    shiftEntries,
  };
}

export function getSlotCountForApparatus(minimumPersonnel: number): number {
  return Math.max(1, Math.max(0, Math.floor(minimumPersonnel || 0)));
}

export function isSupportPersonnelRow(row: PersonnelScheduleRow): boolean {
  return row.rowType === "support" && row.supportValueMode === "personnel";
}

export function isOverrideSupportPersonnelRow(row: PersonnelScheduleRow): boolean {
  return isSupportPersonnelRow(row) && Boolean(row.personnelOverride);
}

export function personnelMatchesShift(
  personnel: { shift?: string },
  shiftType: string,
): boolean {
  return personnel.shift?.includes(shiftType) ?? false;
}
