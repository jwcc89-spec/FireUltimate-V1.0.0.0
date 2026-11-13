import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getSlotCountForApparatus,
  isOverrideSupportPersonnelRow,
  isSupportPersonnelRow,
  loadPersonnelScheduleData,
  personnelMatchesShift,
  type PersonnelScheduleData,
  type PersonnelScheduleRow,
} from "./scheduleDomain";
import {
  clampDayMinutes,
  loadScheduleAssignments,
  loadScheduleOvertimeSplit,
  loadScheduleSlotSegments,
  minutesToTimeValue,
  parseAssignedNames,
  parseTimeToMinutes,
  saveScheduleAssignments,
  saveScheduleOvertimeSplit,
  saveScheduleSlotSegments,
  serializeAssignedNames,
  toScheduleStorageDateKey,
  type ScheduleAssignments,
  type ScheduleSegment,
  type ScheduleSlotSegments,
  type ScheduleOvertimeSplit,
} from "./scheduleStorage";
import {
  buildQualificationRankMap,
  comparePersonnelByQualifications,
  dayOrdinalSuffix,
  formatSchedulePersonnelDisplayName,
  formatScheduleSegmentToken,
  formatScheduleWeekNavLabel,
  formatSegmentCoverageLines,
  getHighestQualificationLabel,
  guessScheduleRowIconFromName,
  parseQualificationColorMap,
  parseScheduleRowColor,
  parseScheduleRowIcon,
  qualificationColorHex,
  qualificationColorSoftStyle,
  getBestQualificationRankForPerson,
  getDatesForMonth,
  getDatesForWeekContaining,
  getRecurrenceIntervalDays,
  hideKellyDayWhenRotationOff,
  kellyRotationEnabledFromDraft,
  parseQualificationOverrides,
  parseRecurrenceWeekdays,
  shiftOccursOnDate,
  personCanJoinApparatus,
  reorderAssignedByRequirementCoverage,
  requirementsSatisfiedByAssignedPersonnel,
  isPersonnelSchedulerRecordComplete,
  toDateKey,
  visibleAdditionalRowCount,
  withNextAdditionalRow,
  type ScheduleRowIconId,
} from "./scheduleUtils";
import { PersonnelScheduleDayBlockModal } from "./PersonnelScheduleDayBlockModal";
import { ScheduleNoticeDialog } from "./ScheduleNoticeDialog";
import { ScheduleRowLabelIcon } from "./scheduleRowLabels";

type QualificationOverrideRow = {
  id: string;
  personName: string;
  unitId: string;
  slotIndex: number;
  dateKey: string;
  status: string;
  apparatus: string;
  requiredQualification: string;
  shiftType: string;
};

function pinOverrideSeats(
  rows: QualificationOverrideRow[],
  dateKey: string,
  unitId: string,
  slots: string[],
  slotCount: number,
  preserveNames: string[] = [],
): string[] {
  const next = slots.slice(0, slotCount).map((slot) => String(slot ?? ""));
  while (next.length < slotCount) next.push("");
  const keep = new Set(preserveNames.map((name) => name.trim()).filter((name) => name.length > 0));
  const pins = rows.filter(
    (item) =>
      (item.status === "pending" || item.status === "approved") &&
      isHeldQualification(item.requiredQualification) &&
      item.dateKey === dateKey &&
      item.unitId === unitId &&
      item.slotIndex >= 0 &&
      item.slotIndex < slotCount,
  );
  const pinnedIndexes = new Set(pins.map((item) => item.slotIndex));
  for (const pin of pins) {
    const alreadySeated = next.some((slot) =>
      parseAssignedNames(slot).some((name) => name.trim() === pin.personName),
    );
    if (!alreadySeated && !keep.has(pin.personName)) continue;
    const displaced = parseAssignedNames(next[pin.slotIndex] ?? "").filter(
      (name) => name.trim() && name.trim() !== pin.personName,
    );
    for (let index = 0; index < next.length; index += 1) {
      const names = parseAssignedNames(next[index] ?? "").filter((name) => name.trim() !== pin.personName);
      next[index] = serializeAssignedNames(names);
    }
    next[pin.slotIndex] = pin.personName;
    for (const name of displaced) {
      const empty = next.findIndex(
        (value, index) =>
          !pinnedIndexes.has(index) && parseAssignedNames(value).every((entry) => !entry.trim()),
      );
      if (empty >= 0) next[empty] = name.trim();
    }
  }
  return next;
}
import { hasAtLeastRole, isAdminOrHigher } from "./roleHierarchy";
import { useMyPermissions } from "./useMyPermissions";

const SEAT_REMOVAL = "Remove from seat";
const PARTIAL_SHIFT = "Partial shift ";

function isHeldQualification(value: string): boolean {
  return value !== SEAT_REMOVAL && !value.startsWith(PARTIAL_SHIFT);
}

function isOpenOrHireToken(name: string): boolean {
  const normalized = name.trim().toUpperCase();
  return normalized === "OPEN" || normalized === "HIRE";
}

function seatNamesIncludeRealPerson(names: string[]): boolean {
  return names.some((name) => {
    const trimmed = name.trim();
    return trimmed.length > 0 && !isOpenOrHireToken(trimmed);
  });
}

function isRealPersonSegment(segment: ScheduleSegment): boolean {
  const name = segment.personnelName.trim();
  return (
    segment.assigneeType !== "hire" &&
    segment.source !== "auto_hire" &&
    name.length > 0 &&
    !isOpenOrHireToken(name) &&
    segment.endMinutes > segment.startMinutes
  );
}

/** One person covering the whole shift is a normal seat, not split pieces. */
function singleSegmentIfPersonCoversShift(
  segments: ScheduleSegment[],
  shiftStart: number,
  shiftEnd: number,
): ScheduleSegment[] | null {
  const real = segments.filter(isRealPersonSegment);
  if (real.length === 0 || !(shiftEnd > shiftStart)) return null;
  const name = real[0]!.personnelName.trim();
  if (real.some((segment) => segment.personnelName.trim().toLowerCase() !== name.toLowerCase())) {
    return null;
  }
  const sorted = [...real].sort((left, right) => left.startMinutes - right.startMinutes);
  let cursor = shiftStart;
  for (const segment of sorted) {
    if (segment.startMinutes > cursor) return null;
    cursor = Math.max(cursor, segment.endMinutes);
  }
  if (cursor < shiftEnd) return null;
  return [
    {
      id: `full-${name.toLowerCase().replace(/\s+/g, "-")}`,
      assigneeType: "personnel",
      personnelName: name,
      startMinutes: shiftStart,
      endMinutes: shiftEnd,
      source: "manual",
      overtime: false,
    },
  ];
}

function militaryToClock(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const padded = digits.length === 3 ? `0${digits}` : digits;
  if (!/^\d{4}$/.test(padded)) return null;
  const hours = Number(padded.slice(0, 2));
  const minutes = Number(padded.slice(2));
  if (hours > 23 || minutes > 59) return null;
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

function militaryRangeReady(start: string, end: string): boolean {
  const startClock = militaryToClock(start);
  const endClock = militaryToClock(end);
  return Boolean(startClock && endClock && endClock > startClock);
}

function assignmentsPreservingNames(
  ordered: string[],
  previous: string[],
  slotCount: number,
): string[] {
  const placed = [...ordered];
  while (placed.length < slotCount) placed.push("");
  const fitted = placed.slice(0, slotCount);
  const kept = new Set(
    fitted.flatMap((slotValue) =>
      parseAssignedNames(slotValue)
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    ),
  );
  const previousNames = previous.flatMap((slotValue) =>
    parseAssignedNames(slotValue)
      .map((name) => name.trim())
      .filter((name) => name.length > 0),
  );
  if (previousNames.some((name) => !kept.has(name))) {
    const restored = [...previous];
    while (restored.length < slotCount) restored.push("");
    return restored.slice(0, slotCount);
  }
  return fitted;
}

function schedulesIntervalOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

/** Block same person on two apparatus slots when time ranges overlap (cross-apparatus never auto-merges). */
function computeCrossApparatusOverlapMessage(params: {
  personName: string;
  excludeUnitId: string;
  excludeSlotIndex: number;
  proposedStart: number;
  proposedEnd: number;
  shiftWindowStart: number;
  shiftWindowEnd: number;
  scheduleRows: PersonnelScheduleRow[];
  dayData: Record<string, string[]>;
  scheduleSlotSegments: ScheduleSlotSegments;
  storageDateKey: string;
}): string | null {
  const {
    personName,
    excludeUnitId,
    excludeSlotIndex,
    proposedStart,
    proposedEnd,
    shiftWindowStart,
    shiftWindowEnd,
    scheduleRows,
    dayData,
    scheduleSlotSegments,
    storageDateKey,
  } = params;
  for (const row of scheduleRows) {
    if (row.rowType !== "apparatus") continue;
    for (let si = 0; si < row.slotCount; si += 1) {
      if (row.unitId === excludeUnitId && si === excludeSlotIndex) continue;
      const unitSegRows = scheduleSlotSegments[storageDateKey]?.[row.unitId] ?? [];
      const segsRaw = Array.isArray(unitSegRows[si]) ? unitSegRows[si]! : [];
      const personSegs = segsRaw.filter(
        (s) =>
          s.personnelName === personName &&
          s.assigneeType !== "hire" &&
          s.source !== "auto_hire",
      );
      if (personSegs.length > 0) {
        for (const seg of personSegs) {
          if (
            seg.endMinutes > seg.startMinutes &&
            schedulesIntervalOverlap(
              proposedStart,
              proposedEnd,
              seg.startMinutes,
              seg.endMinutes,
            )
          ) {
            return `${personName} already assigned to ${row.label}. Remove or segment assignments so times do not overlap.`;
          }
        }
      } else {
        const slotVal = dayData[row.unitId]?.[si] ?? "";
        if (
          parseAssignedNames(slotVal).includes(personName) &&
          schedulesIntervalOverlap(
            proposedStart,
            proposedEnd,
            shiftWindowStart,
            shiftWindowEnd,
          )
        ) {
          return `${personName} already assigned to ${row.label}. Remove or segment assignments so times do not overlap.`;
        }
      }
    }
  }
  return null;
}

type ScheduleRowLabelTone =
  | ScheduleRowIconId
  | "kelly"
  | "vacation"
  | "support";

function getScheduleRowLabelTone(row: PersonnelScheduleRow): ScheduleRowLabelTone {
  if (row.rowType === "apparatus") {
    const chosen = parseScheduleRowIcon(row.scheduleLabelIcon);
    if (chosen) return chosen;
    return guessScheduleRowIconFromName(row.label);
  }
  const id = row.id.toLowerCase();
  const label = row.label.toLowerCase();
  if (id.includes("info") || label === "info") return "info";
  if (id.includes("kelly") || label.includes("kelly")) return "kelly";
  if (id.includes("sick") || label === "sick") return "sick";
  if (id.includes("trade") || label.includes("trade")) return "trades";
  if (id.includes("vacation") || label.includes("vacation")) return "vacation";
  if (id.includes("injur") || label.includes("injur")) return "sick";
  return "support";
}

function ScheduleRowLabelIconForTone({ tone }: { tone: ScheduleRowLabelTone }) {
  if (tone === "kelly" || tone === "vacation") {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (tone === "support") {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return <ScheduleRowLabelIcon icon={tone} />;
}

interface PersonnelSchedulePageProps {
  readDepartmentDetailsDraft: () => Record<string, unknown>;
  normalizeDepartmentDraft: (raw: Record<string, unknown>) => Record<string, unknown>;
  normalizeAdditionalFields: (
    raw: unknown,
  ) => PersonnelScheduleData["additionalFields"];
}

export function PersonnelSchedulePage({
  readDepartmentDetailsDraft,
  normalizeDepartmentDraft,
  normalizeAdditionalFields,
}: PersonnelSchedulePageProps) {
  const [departmentData, setDepartmentData] = useState<PersonnelScheduleData>(() =>
    loadPersonnelScheduleData({
      readDepartmentDetailsDraft,
      normalizeDepartmentDraft,
      normalizeAdditionalFields,
    }),
  );
  const [selectedShift, setSelectedShift] = useState<string>("");
  const [highlightPersonnelName, setHighlightPersonnelName] = useState("");
  const [searchParams] = useSearchParams();
  const focusDateKey = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("date") ?? "")
    ? (searchParams.get("date") ?? "")
    : "";
  const focusShift = searchParams.get("shift") ?? "";
  const focusUnit = searchParams.get("unit") ?? "";
  const [viewDate, setViewDate] = useState(() => {
    if (!focusDateKey) return new Date();
    const [year, month, day] = focusDateKey.split("-").map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
  });
  const [calendarViewMode, setCalendarViewMode] = useState<"week" | "month">("week");
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleAssignments, setScheduleAssignments] = useState<ScheduleAssignments>(() =>
    loadScheduleAssignments(),
  );
  const [scheduleOvertimeSplit, setScheduleOvertimeSplit] = useState<ScheduleOvertimeSplit>(() =>
    loadScheduleOvertimeSplit(),
  );
  const [scheduleSlotSegments, setScheduleSlotSegments] = useState<ScheduleSlotSegments>(() =>
    loadScheduleSlotSegments(),
  );
  const [hasLoadedRemoteSchedule, setHasLoadedRemoteSchedule] = useState(false);
  const [isDemoTenant, setIsDemoTenant] = useState(() =>
    window.location.hostname.toLowerCase().includes("demo"),
  );
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
  const [noticeAction, setNoticeAction] = useState<{ label: string; run: () => void } | null>(null);
  const [selfFill, setSelfFill] = useState<{
    dateKey: string;
    unitId: string;
    slotIndex: number;
    apparatus: string;
  } | null>(null);
  const [selfFillMode, setSelfFillMode] = useState<"" | "full" | "partial">("");
  const [selfFillStart, setSelfFillStart] = useState("");
  const [selfFillEnd, setSelfFillEnd] = useState("");
  const permissionGrants = useMyPermissions();
  const canEditSchedule = permissionGrants?.["schedule.edit"] === true;
  const [viewerName, setViewerName] = useState("");
  const [viewerIsReviewer, setViewerIsReviewer] = useState(false);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const navigate = useNavigate();
  /** Day block and changing other people. Self-fill and own-name cancellation stay available without this. */
  const canManageSchedule = canEditSchedule && viewerIsReviewer;
  const limitedScheduleEditor = !canManageSchedule;
  const limitedEditorRef = useRef(false);
  limitedEditorRef.current = limitedScheduleEditor;
  const scheduleNoticeRef = useRef<(message: string) => void>(() => undefined);
  const pendingOverrideRef = useRef<QualificationOverrideRow[]>([]);
  const placeOpenTimeRef = useRef<
    | ((
        dateKey: string,
        unitId: string,
        slotIndex: number,
        startMinutes: number,
        endMinutes: number,
      ) => boolean)
    | null
  >(null);
  const assignPersonToSlotRef = useRef<
    | ((
        dateKey: string,
        unitId: string,
        slotIndex: number,
        personName: string,
        bypassQualification?: boolean,
      ) => void)
    | null
  >(null);
  const [pendingOverrides, setPendingOverrides] = useState<QualificationOverrideRow[]>([]);
  const [overridesReady, setOverridesReady] = useState(false);
  const [scheduleUndoStack, setScheduleUndoStack] = useState<
    Array<{
      assignments: ScheduleAssignments;
      overtimeSplit: ScheduleOvertimeSplit;
      slotSegments: ScheduleSlotSegments;
      message: string;
    }>
  >([]);
  const [lastScheduleAction, setLastScheduleAction] = useState("No changes yet.");
  const [editDayBlock, setEditDayBlock] = useState<{
    date: Date;
    dateKey: string;
  } | null>(null);
  const [activeInlineSlot, setActiveInlineSlot] = useState<{
    dateKey: string;
    unitId: string;
    slotIndex: number;
  } | null>(null);
  const pushUndoSnapshot = useCallback(
    (message: string) => {
      setScheduleUndoStack((previous) => [
        ...previous.slice(-49),
        {
          assignments: JSON.parse(JSON.stringify(scheduleAssignments)) as ScheduleAssignments,
          overtimeSplit: JSON.parse(JSON.stringify(scheduleOvertimeSplit)) as ScheduleOvertimeSplit,
          slotSegments: JSON.parse(JSON.stringify(scheduleSlotSegments)) as ScheduleSlotSegments,
          message,
        },
      ]);
    },
    [scheduleAssignments, scheduleOvertimeSplit, scheduleSlotSegments],
  );
  const applyOvertimeSplitChange = useCallback((next: ScheduleOvertimeSplit) => {
    setScheduleOvertimeSplit(next);
    saveScheduleOvertimeSplit(next);
  }, []);
  const undoLastScheduleChange = useCallback(() => {
    setScheduleUndoStack((previous) => {
      if (previous.length === 0) {
        return previous;
      }
      const snapshot = previous[previous.length - 1]!;
      setScheduleAssignments(snapshot.assignments);
      setScheduleOvertimeSplit(snapshot.overtimeSplit);
      setScheduleSlotSegments(snapshot.slotSegments);
      saveScheduleAssignments(snapshot.assignments);
      saveScheduleOvertimeSplit(snapshot.overtimeSplit);
      saveScheduleSlotSegments(snapshot.slotSegments);
      setLastScheduleAction(`Undid: ${snapshot.message}`);
      return previous.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const tenantContextRes = await fetch("/api/tenant/context");
        if (tenantContextRes.ok && isMounted) {
          const tenantContextJson = (await tenantContextRes.json()) as {
            ok?: boolean;
            tenant?: { slug?: string };
          };
          const slug = String(tenantContextJson?.tenant?.slug ?? "").toLowerCase();
          if (slug) {
            setIsDemoTenant(slug.includes("demo"));
          }
        }
        const res = await fetch("/api/department-details");
        if (res.ok && isMounted) {
          const json = (await res.json()) as {
            ok?: boolean;
            data?: Record<string, unknown>;
          };
          if (json?.ok && json?.data && isMounted) {
            const d = normalizeDepartmentDraft(json.data);
            const personnel = Array.isArray(d.schedulerPersonnelRecords)
              ? (d.schedulerPersonnelRecords as PersonnelScheduleData["personnel"])
              : [];
            const stations = Array.isArray(d.stationRecords)
              ? (d.stationRecords as PersonnelScheduleData["stations"])
              : [];
            const apparatus = Array.isArray(d.schedulerApparatusRecords)
              ? (d.schedulerApparatusRecords as PersonnelScheduleData["apparatus"])
              : [];
            const additionalFields = hideKellyDayWhenRotationOff(
              normalizeAdditionalFields(d.additionalFields),
              kellyRotationEnabledFromDraft(d.kellyRotationEnabled),
            );
            const standardOvertimeSlot = Math.max(
              1,
              Math.floor(Number(d.standardOvertimeSlot ?? 24) || 24),
            );
            const allowScheduledOvertime = d.allowScheduledOvertime === false ? false : true;
            const segmentSummaryTarget = d.segmentSummaryTarget === "trades" ? "trades" : "info";
            const overtimeSummaryTarget = d.overtimeSummaryTarget === "trades" ? "trades" : "info";
            const allowPartialShift = d.allowPartialShift === true;
            const personnelQualifications = Array.isArray(d.personnelQualifications)
              ? (d.personnelQualifications as string[])
              : [];
            const personnelQualificationColors = parseQualificationColorMap(
              d.personnelQualificationColors,
            );
            const personnelQualificationOverrides = parseQualificationOverrides(
              d.personnelQualificationOverrides,
            );
            const kellyRotations = Array.isArray(d.kellyRotations)
              ? (d.kellyRotations as PersonnelScheduleData["kellyRotations"])
              : [];
            const shiftEntries = Array.isArray(d.shiftInformationEntries)
              ? (d.shiftInformationEntries as PersonnelScheduleData["shiftEntries"])
              : [];
            setDepartmentData({
              stations,
              apparatus,
              additionalFields,
              standardOvertimeSlot,
              allowScheduledOvertime,
              segmentSummaryTarget,
              overtimeSummaryTarget,
              allowPartialShift,
              personnel,
              personnelQualifications,
              personnelQualificationColors,
              personnelQualificationOverrides,
              kellyRotations,
              shiftEntries,
            });
          }
        }
        const scheduleRes = await fetch("/api/schedule-assignments");
        if (scheduleRes.ok && isMounted) {
          const scheduleJson = (await scheduleRes.json()) as {
            ok?: boolean;
            assignments?: ScheduleAssignments;
            overtimeSplit?: ScheduleOvertimeSplit;
            slotSegments?: ScheduleSlotSegments;
          };
          if (scheduleJson?.ok) {
            const nextAssignments =
              scheduleJson.assignments && typeof scheduleJson.assignments === "object"
                ? scheduleJson.assignments
                : {};
            const nextOvertimeSplit =
              scheduleJson.overtimeSplit && typeof scheduleJson.overtimeSplit === "object"
                ? scheduleJson.overtimeSplit
                : {};
            const nextSlotSegments =
              scheduleJson.slotSegments && typeof scheduleJson.slotSegments === "object"
                ? scheduleJson.slotSegments
                : {};
            setScheduleAssignments(nextAssignments);
            setScheduleOvertimeSplit(nextOvertimeSplit);
            setScheduleSlotSegments(nextSlotSegments);
            // Keep local cache in sync for fast reload fallback.
            saveScheduleAssignments(nextAssignments);
            saveScheduleOvertimeSplit(nextOvertimeSplit);
            saveScheduleSlotSegments(nextSlotSegments);
          }
        }
      } catch {
        // Keep localStorage data
      } finally {
        if (isMounted) {
          setHasLoadedRemoteSchedule(true);
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [normalizeAdditionalFields, normalizeDepartmentDraft]);

  useEffect(() => {
    if (!hasLoadedRemoteSchedule) {
      return;
    }
    if (!canEditSchedule && viewerName.trim().length === 0) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void fetch("/api/schedule-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: scheduleAssignments,
          overtimeSplit: scheduleOvertimeSplit,
          slotSegments: scheduleSlotSegments,
        }),
      })
        .then(async (response) => {
          if (response.ok) return;
          const json = (await response.json().catch(() => null)) as { message?: string } | null;
          setScheduleNotice(json?.message || "That schedule change was not saved.");
        })
        .catch(() => {
          // Keep local fallback persistence if network sync fails.
        });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [scheduleAssignments, scheduleOvertimeSplit, scheduleSlotSegments, hasLoadedRemoteSchedule, canEditSchedule, viewerName]);

  const shiftOptions = useMemo(() => {
    const ordered = [...departmentData.shiftEntries].sort((a, b) => {
      const rank = (shiftType: string): number => {
        const normalized = shiftType.trim().toUpperCase();
        if (normalized.startsWith("A SHIFT")) return 1;
        if (normalized.startsWith("B SHIFT")) return 2;
        if (normalized.startsWith("C SHIFT")) return 3;
        if (normalized.startsWith("D SHIFT")) return 4;
        return 99;
      };
      return rank(a.shiftType) - rank(b.shiftType);
    });
    return ordered.length > 0 ? ordered : departmentData.shiftEntries.slice(0, 4);
  }, [departmentData.shiftEntries]);

  const effectiveShift = selectedShift || shiftOptions[0]?.shiftType || "";
  const effectiveShiftEntry = useMemo(
    () => shiftOptions.find((entry) => entry.shiftType === effectiveShift),
    [shiftOptions, effectiveShift],
  );
  const hasExplicitShiftStartTime = useMemo(
    () => /^\d{2}:\d{2}$/.test(String(effectiveShiftEntry?.startTime ?? "").trim()),
    [effectiveShiftEntry],
  );
  const shiftWindowStartMinutes = useMemo(
    () => parseTimeToMinutes(effectiveShiftEntry?.startTime ?? ""),
    [effectiveShiftEntry],
  );
  const shiftWindowDurationMinutes = useMemo(
    () =>
      Math.max(
        60,
        Math.floor(Number(effectiveShiftEntry?.shiftDuration ?? 24) || 24) * 60,
      ),
    [effectiveShiftEntry],
  );
  const shiftWindowEndMinutes = useMemo(
    () => shiftWindowStartMinutes + shiftWindowDurationMinutes,
    [shiftWindowStartMinutes, shiftWindowDurationMinutes],
  );

  const getSegmentsForSlot = useCallback(
    (dateKey: string, unitId: string, slotIndex: number): ScheduleSegment[] => {
      const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
      const rows = scheduleSlotSegments[storageDateKey]?.[unitId] ?? [];
      return Array.isArray(rows[slotIndex]) ? [...rows[slotIndex]!] : [];
    },
    [effectiveShift, scheduleSlotSegments],
  );

  const scheduleRows = useMemo((): PersonnelScheduleRow[] => {
    const rows: PersonnelScheduleRow[] = [];
    departmentData.apparatus.forEach((app, index) => {
      const label = String(app.apparatus ?? "").trim();
      if (!label) {
        return;
      }
      const slotCount = getSlotCountForApparatus(
        app.maximumPersonnel ?? app.minimumPersonnel ?? 0,
      );
      rows.push({
        id: `app-${index}-${label}`,
        label,
        rowType: "apparatus",
        unitId: label,
        unitType: "",
        slotCount,
        minimumPersonnel: Math.min(app.minimumPersonnel ?? 0, slotCount),
        requiredQualifications: Array.isArray(app.personnelRequirements)
          ? app.personnelRequirements.filter(Boolean)
          : [],
        stationName: app.station ?? "",
        scheduleLabelIcon: parseScheduleRowIcon(app.scheduleLabelIcon) || undefined,
        scheduleLabelColor: parseScheduleRowColor(app.scheduleLabelColor) || undefined,
      });
    });

    departmentData.additionalFields.forEach((row, index) => {
      if (row.hidden) return;
      const unitId = String(row.id ?? "").trim() || `support-custom-${index + 1}`;
      rows.push({
        id: unitId,
        label: row.fieldName,
        rowType: "support",
        unitId,
        unitType: "SUPPORT",
        slotCount: row.maximumRows,
        rowsVisible: row.rowsVisible,
        maximumRows: row.maximumRows,
        minimumPersonnel: 0,
        requiredQualifications: [],
        supportValueMode: row.valueMode,
        personnelOverride: row.valueMode === "personnel" ? row.personnelOverride : false,
        supportSegmentedMode:
          row.valueMode === "personnel" ? Boolean(row.segmentedModeEnabled) : false,
        segmentDisplayIn:
          row.valueMode === "personnel" && row.segmentedModeEnabled
            ? row.segmentDisplayIn
            : "none",
      });
    });

    return rows;
  }, [departmentData.apparatus, departmentData.additionalFields]);

  const dates = useMemo(
    () =>
      calendarViewMode === "week"
        ? getDatesForWeekContaining(viewDate)
        : getDatesForMonth(viewDate.getFullYear(), viewDate.getMonth()),
    [calendarViewMode, viewDate],
  );
  const calendarNavLabel =
    calendarViewMode === "week"
      ? formatScheduleWeekNavLabel(viewDate)
      : viewDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });

  const activeDateKeys = useMemo(() => {
    const set = new Set<string>();
    dates.forEach((date) => {
      if (shiftOccursOnDate(effectiveShiftEntry, date, effectiveShift)) {
        set.add(toDateKey(date));
      }
    });
    return set;
  }, [dates, effectiveShift, effectiveShiftEntry]);

  const shiftPersonnel = useMemo(
    () => departmentData.personnel.filter((p) => personnelMatchesShift(p, effectiveShift)),
    [departmentData.personnel, effectiveShift],
  );
  /** OT segment dropdown: only people with a shift set in Scheduler Personnel (excludes blank/demo shells). */
  const overtimeRosterPersonnel = useMemo(
    () => departmentData.personnel.filter((p) => isPersonnelSchedulerRecordComplete(p)),
    [departmentData.personnel],
  );
  const sortedShiftPersonnel = useMemo(
    () =>
      [...shiftPersonnel].sort((a, b) =>
        comparePersonnelByQualifications(
          a,
          b,
          departmentData.personnelQualifications,
        ),
      ),
    [shiftPersonnel, departmentData.personnelQualifications],
  );
  const personnelByName = useMemo(
    () => new Map(departmentData.personnel.map((p) => [p.name, p])),
    [departmentData.personnel],
  );
  const qualificationRankMap = useMemo(
    () => buildQualificationRankMap(departmentData.personnelQualifications),
    [departmentData.personnelQualifications],
  );
  const colorForPersonnelName = (name: string): string | undefined => {
    const person = personnelByName.get(name);
    if (!person) return undefined;
    const qualification = getHighestQualificationLabel(
      person,
      departmentData.personnelQualifications,
    );
    return qualificationColorHex(departmentData.personnelQualificationColors[qualification]);
  };
  const softStyleForPersonnelName = (name: string) => {
    const person = personnelByName.get(name);
    if (!person) return undefined;
    const qualification = getHighestQualificationLabel(
      person,
      departmentData.personnelQualifications,
    );
    return qualificationColorSoftStyle(
      departmentData.personnelQualificationColors[qualification],
    );
  };
  const displayDates = useMemo(
    () => dates.filter((date) => activeDateKeys.has(toDateKey(date))),
    [dates, activeDateKeys],
  );
  useEffect(() => {
    if (!focusDateKey) return;
    const [year, month, day] = focusDateKey.split("-").map(Number);
    setViewDate(new Date(year, (month ?? 1) - 1, day ?? 1));
    setCalendarViewMode("week");
  }, [focusDateKey]);
  useEffect(() => {
    if (!focusShift) return;
    if (shiftOptions.some((entry) => entry.shiftType === focusShift)) {
      setSelectedShift(focusShift);
    }
  }, [focusShift, shiftOptions]);
  useEffect(() => {
    if (isLoading || !focusUnit || !focusDateKey) return;
    const handle = window.setTimeout(() => {
      document.querySelector("[data-schedule-focus='1']")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }, 50);
    return () => window.clearTimeout(handle);
  }, [isLoading, focusUnit, focusDateKey, effectiveShift, displayDates]);
  const buildDefaultAssignmentsForDate = useCallback(
    (dateKey: string): Record<string, string[]> => {
      const defaults: Record<string, string[]> = {};
      const dayDate = new Date(`${dateKey}T00:00:00`);
      scheduleRows.forEach((row) => {
        if (row.rowType === "apparatus") {
          const assigned = shiftPersonnel
            .filter((p) => {
              const assignment = String(p.apparatusAssignment ?? "");
              return (
                assignment.startsWith(row.unitId) || assignment.includes(row.unitId)
              );
            })
            .map((p) => p.name)
            .filter(Boolean);
          defaults[row.unitId] = assigned.slice(0, row.slotCount);
        } else {
          defaults[row.unitId] = [];
        }
      });

      const kellyRow = scheduleRows.find(
        (row) => row.unitId === "support-kelly-day",
      );
      if (!kellyRow) {
        return defaults;
      }
      const kellyAssignments: string[] = [];
      departmentData.kellyRotations.forEach((rotation) => {
        if (!rotation.personnel || !rotation.startsOn) return;
        const startsOnDate = new Date(`${rotation.startsOn}T00:00:00`);
        if (Number.isNaN(startsOnDate.getTime()) || Number.isNaN(dayDate.getTime()))
          return;
        const dayDiff = Math.floor(
          (Date.UTC(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()) -
            Date.UTC(
              startsOnDate.getFullYear(),
              startsOnDate.getMonth(),
              startsOnDate.getDate(),
            )) /
            (24 * 60 * 60 * 1000),
        );
        if (dayDiff < 0) return;
        const interval = Math.max(1, rotation.repeatsEveryValue);
        const weekdays = parseRecurrenceWeekdays(effectiveShiftEntry);
        let isRotationDay = false;
        if (weekdays) {
          if (!weekdays.includes(dayDate.getDay())) return;
          if (rotation.repeatsEveryUnit === "Days") {
            isRotationDay = dayDiff % interval === 0;
          } else {
            let workingDays = 0;
            const cursor = new Date(startsOnDate);
            while (cursor <= dayDate) {
              if (weekdays.includes(cursor.getDay())) workingDays += 1;
              cursor.setDate(cursor.getDate() + 1);
            }
            isRotationDay = workingDays > 0 && (workingDays - 1) % interval === 0;
          }
        } else {
          const recurrenceDays = Math.max(1, getRecurrenceIntervalDays(effectiveShiftEntry));
          isRotationDay =
            rotation.repeatsEveryUnit === "Days"
              ? dayDiff % interval === 0
              : dayDiff % (interval * recurrenceDays) === 0;
        }
        if (!isRotationDay) return;
        const person = personnelByName.get(rotation.personnel);
        if (!person || !personnelMatchesShift(person, effectiveShift)) return;
        kellyAssignments.push(rotation.personnel);
      });

      if (kellyAssignments.length > 0) {
        scheduleRows
          .filter((row) => row.rowType === "apparatus")
          .forEach((row) => {
            const existing = defaults[row.unitId] ?? [];
            defaults[row.unitId] = existing.filter(
              (name) => !kellyAssignments.includes(name),
            );
          });
        const existingKelly = defaults[kellyRow.unitId] ?? [];
        defaults[kellyRow.unitId] = [...existingKelly, ...kellyAssignments].slice(
          0,
          kellyRow.slotCount,
        );
      }

      return defaults;
    },
    [
      scheduleRows,
      shiftPersonnel,
      departmentData.kellyRotations,
      effectiveShiftEntry,
      personnelByName,
      effectiveShift,
    ],
  );
  const getKellyRotationPersonnelForDate = useCallback(
    (dateKey: string): string[] => {
      const defaults = buildDefaultAssignmentsForDate(dateKey);
      return defaults["support-kelly-day"]?.filter(Boolean) ?? [];
    },
    [buildDefaultAssignmentsForDate],
  );

  const getAssignmentsForDay = useCallback(
    (dateKey: string, unitId: string, slotCount: number, keepExtraSlots = false, padToSlotCount = true): string[] => {
      const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
      const dayData = scheduleAssignments[storageDateKey];
      const unitSlots = dayData?.[unitId];
      const defaultAssignments = buildDefaultAssignmentsForDate(dateKey);
      let result =
        unitSlots && Array.isArray(unitSlots)
          ? [...unitSlots]
          : [...(defaultAssignments[unitId] ?? [])];
      const kellyNames = getKellyRotationPersonnelForDate(dateKey);
      if (kellyNames.length > 0) {
        if (unitId === "support-kelly-day") {
          const merged = [...result];
          kellyNames.forEach((name) => {
            if (!merged.includes(name)) {
              const emptySlotIndex = merged.findIndex(
                (entry) => String(entry ?? "").trim().length === 0,
              );
              if (emptySlotIndex >= 0) {
                merged[emptySlotIndex] = name;
              } else {
                merged.push(name);
              }
            }
          });
          result = merged;
        } else {
          result = result.filter((name) => !kellyNames.includes(name));
        }
      }
      if (!padToSlotCount) {
        return result.slice(0, slotCount);
      }
      while (result.length < slotCount) result.push("");
      return keepExtraSlots ? result : result.slice(0, slotCount);
    },
    [
      scheduleAssignments,
      buildDefaultAssignmentsForDate,
      getKellyRotationPersonnelForDate,
      effectiveShift,
    ],
  );
  const overtimeSplitCount = useMemo(() => {
    const slotLength = Math.max(
      1,
      Math.floor(Number(departmentData.standardOvertimeSlot) || 24),
    );
    return Math.max(1, Math.floor(24 / slotLength));
  }, [departmentData.standardOvertimeSlot]);
  const isOvertimeEnabledForSlot = useCallback(
    (dateKey: string, unitId: string, slotIndex: number): boolean => {
      const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
      return Boolean(scheduleOvertimeSplit[storageDateKey]?.[unitId]?.[slotIndex]);
    },
    [effectiveShift, scheduleOvertimeSplit],
  );
  const toggleOvertimeForSlot = useCallback(
    (dateKey: string, unitId: string, slotIndex: number, enabled: boolean) => {
      if (limitedEditorRef.current) {
        return;
      }
      pushUndoSnapshot("Toggle segment mode");
      const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
      const nextSplit: ScheduleOvertimeSplit = {
        ...scheduleOvertimeSplit,
        [storageDateKey]: { ...(scheduleOvertimeSplit[storageDateKey] ?? {}) },
      };
      const unitFlags = [...(nextSplit[storageDateKey]?.[unitId] ?? [])];
      while (unitFlags.length <= slotIndex) {
        unitFlags.push(false);
      }
      unitFlags[slotIndex] = enabled;
      nextSplit[storageDateKey] = {
        ...(nextSplit[storageDateKey] ?? {}),
        [unitId]: unitFlags,
      };
      applyOvertimeSplitChange(nextSplit);
      const targetRow = scheduleRows.find((row) => row.unitId === unitId);

          if (!enabled) {
        setScheduleAssignments((previous) => {
          const next = { ...previous };
          const dayData = { ...(next[storageDateKey] ?? {}) } as Record<
            string,
            string[]
          >;
          const unitSlots = [...(dayData[unitId] ?? [])];
          while (unitSlots.length <= slotIndex) unitSlots.push("");
          const firstName = parseAssignedNames(unitSlots[slotIndex] ?? "")[0] ?? "";
          unitSlots[slotIndex] = firstName;
          dayData[unitId] = unitSlots;
          next[storageDateKey] = dayData;
          saveScheduleAssignments(next);
          return next;
        });
        setScheduleSlotSegments((previous) => {
          const day = { ...(previous[storageDateKey] ?? {}) };
          const unitRows = Array.isArray(day[unitId]) ? [...day[unitId]!] : [];
          while (unitRows.length <= slotIndex) unitRows.push([]);
          unitRows[slotIndex] = [];
          const next = {
            ...previous,
            [storageDateKey]: {
              ...day,
              [unitId]: unitRows,
            },
          };
          saveScheduleSlotSegments(next);
          return next;
        });
      } else {
        const segmentCount =
          targetRow?.rowType === "apparatus" ? Math.max(1, overtimeSplitCount) : 1;
        const totalWindow = Math.max(15, shiftWindowEndMinutes - shiftWindowStartMinutes);
        const segmentLength = Math.max(15, Math.floor(totalWindow / segmentCount));
        const defaults: ScheduleSegment[] = Array.from({ length: segmentCount }, (_, index) => {
          const startMinutes = shiftWindowStartMinutes + index * segmentLength;
          const endMinutes =
            index === segmentCount - 1
              ? shiftWindowEndMinutes
              : shiftWindowStartMinutes + (index + 1) * segmentLength;
          return {
            id: `${dateKey}-${unitId}-${slotIndex}-default-${index}`,
            assigneeType: "personnel",
            personnelName: "",
            startMinutes,
            endMinutes,
            source: "manual",
            overtime: false,
          };
        });
        setScheduleSlotSegments((previous) => {
          const day = { ...(previous[storageDateKey] ?? {}) };
          const unitRows = Array.isArray(day[unitId]) ? [...day[unitId]!] : [];
          while (unitRows.length <= slotIndex) unitRows.push([]);
          unitRows[slotIndex] = defaults;
          const next = {
            ...previous,
            [storageDateKey]: {
              ...day,
              [unitId]: unitRows,
            },
          };
          saveScheduleSlotSegments(next);
          return next;
        });
      }
      setLastScheduleAction("Updated segment mode.");
    },
    [
      effectiveShift,
      overtimeSplitCount,
      scheduleOvertimeSplit,
      shiftWindowEndMinutes,
      shiftWindowStartMinutes,
      scheduleRows,
      applyOvertimeSplitChange,
      pushUndoSnapshot,
    ],
  );

  const sortSegments = useCallback((segments: ScheduleSegment[]): ScheduleSegment[] => {
    return [...segments]
      .map((segment) => ({
        ...segment,
        startMinutes: clampDayMinutes(segment.startMinutes),
        endMinutes: clampDayMinutes(segment.endMinutes),
      }))
      .filter((segment) => segment.endMinutes > segment.startMinutes)
      .sort((a, b) => a.startMinutes - b.startMinutes);
  }, []);

  const withDynamicHireSegments = useCallback(
    (segments: ScheduleSegment[]): ScheduleSegment[] => {
      const manualSegments = sortSegments(segments.filter(isRealPersonSegment));
      const effectiveEnd = clampDayMinutes(shiftWindowEndMinutes);
      const effectiveStart = clampDayMinutes(shiftWindowStartMinutes);
      const coveredByOnePerson = singleSegmentIfPersonCoversShift(
        manualSegments,
        effectiveStart,
        effectiveEnd,
      );
      if (coveredByOnePerson) return coveredByOnePerson;
      const all: ScheduleSegment[] = [...manualSegments];
      let cursor = effectiveStart;
      manualSegments.forEach((segment, index) => {
        if (segment.startMinutes > cursor) {
          all.push({
            id: `open-${index}-${cursor}`,
            assigneeType: "personnel",
            personnelName: "",
            startMinutes: cursor,
            endMinutes: segment.startMinutes,
            source: "manual",
            overtime: false,
          });
        }
        cursor = Math.max(cursor, segment.endMinutes);
      });
      if (cursor < effectiveEnd) {
        all.push({
          id: `open-end-${cursor}`,
          assigneeType: "personnel",
          personnelName: "",
          startMinutes: cursor,
          endMinutes: effectiveEnd,
          source: "manual",
          overtime: false,
        });
      }
      return sortSegments(all);
    },
    [sortSegments, shiftWindowEndMinutes, shiftWindowStartMinutes],
  );

  const setSegmentsForSlot = useCallback(
    (
      dateKey: string,
      unitId: string,
      slotIndex: number,
      segments: ScheduleSegment[],
      actionLabel: string,
    ) => {
      if (limitedEditorRef.current) {
        return;
      }
      pushUndoSnapshot(actionLabel);
      const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
      const nextRows = scheduleSlotSegments[storageDateKey]
        ? { ...scheduleSlotSegments[storageDateKey] }
        : {};
      const unitRows = Array.isArray(nextRows[unitId]) ? [...nextRows[unitId]!] : [];
      while (unitRows.length <= slotIndex) {
        unitRows.push([]);
      }
      unitRows[slotIndex] = sortSegments(segments);
      const next: ScheduleSlotSegments = {
        ...scheduleSlotSegments,
        [storageDateKey]: {
          ...nextRows,
          [unitId]: unitRows,
        },
      };
      setScheduleSlotSegments(next);
      saveScheduleSlotSegments(next);
      setLastScheduleAction(actionLabel);
    },
    [effectiveShift, pushUndoSnapshot, scheduleSlotSegments, sortSegments],
  );

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((json: { ok?: boolean; user?: { name?: string; role?: string } } | null) => {
        if (!active || !json?.ok || !json.user) return;
        setViewerName(String(json.user.name ?? "").trim());
        setViewerIsReviewer(hasAtLeastRole(json.user.role, "subadmin"));
        setViewerIsAdmin(isAdminOrHigher(json.user.role));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => {
      void fetch("/api/qualification-overrides")
        .then(async (response) => (response.ok ? response.json() : null))
        .then((json: { ok?: boolean; requests?: QualificationOverrideRow[] } | null) => {
          if (!active || !json?.ok || !Array.isArray(json.requests)) return;
          const kept = json.requests.filter(
          (row) => row.status === "pending" || row.status === "approved",
        );
          pendingOverrideRef.current = kept;
          setPendingOverrides(kept);
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setOverridesReady(true);
        });
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, []);

  const rememberPending = useCallback((row: QualificationOverrideRow) => {
    const next = [...pendingOverrideRef.current.filter((item) => item.id !== row.id), row];
    pendingOverrideRef.current = next;
    setPendingOverrides(next);
  }, []);

  const overrideDraftFor = useCallback(
    (personName: string, unitId: string, slotIndex: number) => {
      const row = scheduleRows.find((entry) => entry.unitId === unitId && entry.rowType === "apparatus");
      const requiredQualification = row?.requiredQualifications[slotIndex]?.trim() ?? "";
      const rule = departmentData.personnelQualificationOverrides[requiredQualification];
      const person = personnelByName.get(personName.trim());
      const hasLower = Boolean(
        rule?.enabled &&
          rule.lowerQualification &&
          person?.qualifications?.includes(rule.lowerQualification),
      );
      if (!requiredQualification || !hasLower) return null;
      return {
        personName: personName.trim(),
        unitId,
        slotIndex,
        apparatus: row?.label ?? unitId,
        requiredQualification,
        lowerQualification: rule?.lowerQualification ?? "",
        shiftType: effectiveShift,
      };
    },
    [departmentData.personnelQualificationOverrides, effectiveShift, personnelByName, scheduleRows],
  );

  const requestQualificationOverride = useCallback(
    async (
      dateKey: string,
      personName: string,
      unitId: string,
      slotIndex: number,
      placeNow = false,
    ) => {
      const draft = overrideDraftFor(personName, unitId, slotIndex);
      if (!draft) return;
      const response = await fetch("/api/qualification-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, dateKey, placeNow }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        request?: QualificationOverrideRow;
      } | null;
      if (!response.ok || !json?.ok || !json.request) {
        setNoticeAction(null);
        setScheduleNotice(json?.message || "The permission request could not be sent.");
        return;
      }
      const approvedNow = placeNow && json.request.status === "approved";
      rememberPending({ ...json.request, status: approvedNow ? "approved" : "pending" });
      assignPersonToSlotRef.current?.(dateKey, unitId, slotIndex, draft.personName, true);
      setNoticeAction(null);
      setScheduleNotice(
        approvedNow
          ? `${draft.personName} is placed in that seat.`
          : `${draft.personName} is in the seat as Pending until a sub admin approves.`,
      );
    },
    [overrideDraftFor, rememberPending],
  );

  const requestOpenTimeQualificationOverride = useCallback(
    async (
      dateKey: string,
      personName: string,
      unitId: string,
      slotIndex: number,
      startMinutes: number,
      endMinutes: number,
      placeNow = false,
    ) => {
      const draft = overrideDraftFor(personName, unitId, slotIndex);
      if (!draft) return;
      const response = await fetch("/api/qualification-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, dateKey, placeNow }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        request?: QualificationOverrideRow;
      } | null;
      if (!response.ok || !json?.ok || !json.request) {
        setNoticeAction(null);
        setScheduleNotice(json?.message || "The permission request could not be sent.");
        return;
      }
      const approvedNow = placeNow && json.request.status === "approved";
      rememberPending({ ...json.request, status: approvedNow ? "approved" : "pending" });
      const placed = placeOpenTimeRef.current?.(dateKey, unitId, slotIndex, startMinutes, endMinutes) === true;
      if (!placed) return;
      const timeLabel = `${minutesToTimeValue(startMinutes)}–${minutesToTimeValue(endMinutes)}`;
      setNoticeAction(null);
      setScheduleNotice(
        approvedNow
          ? `${draft.personName} is placed on ${timeLabel}.`
          : `${draft.personName} is on ${timeLabel} as Pending until a sub admin approves.`,
      );
    },
    [overrideDraftFor, rememberPending],
  );

  const requestSeatRemoval = useCallback(
    async (dateKey: string, unitId: string, slotIndex: number, personName: string) => {
      const row = scheduleRows.find((entry) => entry.unitId === unitId);
      const response = await fetch("/api/qualification-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName,
          dateKey,
          unitId,
          slotIndex,
          apparatus: row?.label ?? unitId,
          shiftType: effectiveShift,
          requiredQualification: SEAT_REMOVAL,
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        request?: QualificationOverrideRow;
      } | null;
      if (response.ok && json?.ok && json.request) {
        rememberPending({ ...json.request, status: "pending" });
      }
      setNoticeAction(null);
      setScheduleNotice(
        response.ok && json?.ok
          ? `${personName} stays in the seat until a sub admin approves the cancellation.`
          : json?.message || "The cancellation request could not be sent.",
      );
    },
    [effectiveShift, rememberPending, scheduleRows],
  );

  const openSelfFill = useCallback((dateKey: string, unitId: string, slotIndex: number, apparatus: string) => {
    setSelfFill({ dateKey, unitId, slotIndex, apparatus });
    setSelfFillMode(departmentData.allowPartialShift ? "" : "full");
    setSelfFillStart("");
    setSelfFillEnd("");
  }, [departmentData.allowPartialShift]);

  const requestPartialShift = useCallback(
    async (dateKey: string, unitId: string, slotIndex: number, start: string, end: string) => {
      const personName = viewerName.trim();
      if (!personName) return;
      const row = scheduleRows.find((entry) => entry.unitId === unitId);
      const response = await fetch("/api/qualification-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName,
          dateKey,
          unitId,
          slotIndex,
          apparatus: row?.label ?? unitId,
          shiftType: effectiveShift,
          requiredQualification: `${PARTIAL_SHIFT}${start}-${end}`,
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        request?: QualificationOverrideRow;
      } | null;
      if (response.ok && json?.ok && json.request) rememberPending(json.request);
      setSelfFill(null);
      setScheduleNotice(
        response.ok && json?.ok
          ? `${personName} asked to work ${start} to ${end}. A sub admin must approve it before those hours are on the schedule.`
          : json?.message || "The partial shift could not be sent.",
      );
    },
    [effectiveShift, rememberPending, scheduleRows, viewerName],
  );

  const openScheduleNotice = useCallback(
    (
      message: string,
      blocked?: {
        dateKey: string;
        personName: string;
        unitId: string;
        slotIndex: number;
        startMinutes?: number;
        endMinutes?: number;
      } | null,
    ) => {
      const draft = blocked
        ? overrideDraftFor(blocked.personName, blocked.unitId, blocked.slotIndex)
        : null;
      const openTime =
        blocked &&
        typeof blocked.startMinutes === "number" &&
        typeof blocked.endMinutes === "number" &&
        blocked.endMinutes > blocked.startMinutes
          ? { startMinutes: blocked.startMinutes, endMinutes: blocked.endMinutes }
          : null;
      if (draft && blocked && message === "You do not meet the minimum qualifications.") {
        if (viewerIsReviewer) {
          const qualification = draft.lowerQualification.trim() || "that qualification";
          const article = /^[aeiou]/i.test(qualification) ? "an" : "a";
          setNoticeAction({
            label: "Place in seat",
            run: () => {
              if (openTime) {
                void requestOpenTimeQualificationOverride(
                  blocked.dateKey,
                  blocked.personName,
                  blocked.unitId,
                  blocked.slotIndex,
                  openTime.startMinutes,
                  openTime.endMinutes,
                  true,
                );
                return;
              }
              void requestQualificationOverride(
                blocked.dateKey,
                blocked.personName,
                blocked.unitId,
                blocked.slotIndex,
                true,
              );
            },
          });
          setScheduleNotice(
            `${draft.personName} does not meet the minimum qualifications. Are you sure you want to place ${article} ${qualification} in this seat?`,
          );
          return;
        }
        setNoticeAction({
          label: "Request Admin Permission",
          run: () => {
            if (openTime) {
              void requestOpenTimeQualificationOverride(
                blocked.dateKey,
                blocked.personName,
                blocked.unitId,
                blocked.slotIndex,
                openTime.startMinutes,
                openTime.endMinutes,
              );
              return;
            }
            void requestQualificationOverride(
              blocked.dateKey,
              blocked.personName,
              blocked.unitId,
              blocked.slotIndex,
            );
          },
        });
      } else {
        setNoticeAction(null);
      }
      setScheduleNotice(message);
    },
    [overrideDraftFor, requestOpenTimeQualificationOverride, requestQualificationOverride, viewerIsReviewer],
  );
  scheduleNoticeRef.current = (message) => openScheduleNotice(message);

  const assignPersonToSlot = useCallback(
    (dateKey: string, unitId: string, slotIndex: number, personName: string, bypassQualification = false) => {
      const targetRowForMode = scheduleRows.find((row) => row.unitId === unitId);
      if (
        limitedScheduleEditor &&
        !bypassQualification &&
        personName.trim().toLowerCase() !== viewerName.trim().toLowerCase()
      ) {
        openScheduleNotice("You can only add yourself to an open seat.");
        return;
      }
      const partialHold = pendingOverrides.find(
        (item) =>
          item.status === "pending" &&
          item.requiredQualification.startsWith(PARTIAL_SHIFT) &&
          item.dateKey === dateKey &&
          item.unitId === unitId &&
          item.slotIndex === slotIndex &&
          item.personName.trim().toLowerCase() !== personName.trim().toLowerCase(),
      );
      if (partialHold) {
        openScheduleNotice(`${partialHold.personName} has a partial shift waiting for approval on this seat.`);
        return;
      }
      if (limitedScheduleEditor && !bypassQualification && targetRowForMode) {
        const occupants = parseAssignedNames(
          getAssignmentsForDay(dateKey, unitId, targetRowForMode.slotCount)[slotIndex] ?? "",
        ).filter((name) => name.trim() && name.trim() !== personName.trim());
        if (occupants.length > 0) {
          openScheduleNotice(
            "That seat is filled. You can fill an open seat, but you cannot remove someone who is already there.",
          );
          return;
        }
      }
      const targetAlreadySplit =
        targetRowForMode?.rowType === "apparatus" &&
        slotIndex < (targetRowForMode.minimumPersonnel ?? 0) &&
        isOvertimeEnabledForSlot(dateKey, unitId, slotIndex);
      if (
        targetRowForMode?.rowType === "apparatus" &&
        !targetAlreadySplit &&
        (targetRowForMode.minimumPersonnel ?? 0) > 0
      ) {
        const currentNames = Array.from(
          new Set(
            getAssignmentsForDay(dateKey, unitId, targetRowForMode.slotCount)
              .flatMap((slotValue) => parseAssignedNames(slotValue))
              .map((name) => name.trim())
              .filter((name) => name.length > 0),
          ),
        );
        if (
          !bypassQualification &&
          !currentNames.includes(personName) &&
          !personCanJoinApparatus(
            personName,
            targetRowForMode.requiredQualifications,
            targetRowForMode.minimumPersonnel,
            currentNames,
            personnelByName,
            qualificationRankMap,
          )
        ) {
          const message = "You do not meet the minimum qualifications.";
          openScheduleNotice(message, { dateKey, personName, unitId, slotIndex });
          setLastScheduleAction(message);
          return;
        }
      }
      pushUndoSnapshot("Assign personnel to slot");
      let blockedAssignmentReason = "";
      const targetSegmentModeEnabled = targetAlreadySplit;
      setScheduleAssignments((prev) => {
        const next = { ...prev };
        const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
        const dayData = { ...(next[storageDateKey] ?? {}) } as Record<
          string,
          string[]
        >;
        const dayDefaults = buildDefaultAssignmentsForDate(dateKey);
        scheduleRows.forEach((row) => {
          if (!dayData[row.unitId]) {
            const defaults = dayDefaults[row.unitId] ?? [];
            dayData[row.unitId] = defaults.slice(0, row.slotCount);
          }
        });
        const targetRow = scheduleRows.find((row) => row.unitId === unitId);
        const isTargetSupportPersonnelRow = targetRow
          ? isSupportPersonnelRow(targetRow)
          : false;
        const isTargetOverrideSupportPersonnelRow = targetRow
          ? isOverrideSupportPersonnelRow(targetRow)
          : false;
        const isTargetApparatusRow = targetRow?.rowType === "apparatus";
        const targetOvertimeEnabled =
          targetRow?.rowType === "apparatus" &&
          slotIndex < (targetRow.minimumPersonnel ?? 0) &&
          isOvertimeEnabledForSlot(dateKey, unitId, slotIndex);
        if (isTargetApparatusRow) {
          const existsInOverrideSupport = scheduleRows.some((row) => {
            if (!isOverrideSupportPersonnelRow(row)) return false;
            const rowSlots = dayData[row.unitId] ?? [];
            return rowSlots.some((slotValue) => parseAssignedNames(slotValue).includes(personName));
          });
          const existsInOverrideSupportSegments = scheduleRows.some((row) => {
            if (!isOverrideSupportPersonnelRow(row)) return false;
            const rowSlots = scheduleSlotSegments[storageDateKey]?.[row.unitId] ?? [];
            return rowSlots.some((segments) =>
              Array.isArray(segments)
                ? segments.some((segment) => segment.personnelName === personName)
                : false,
            );
          });
          if (existsInOverrideSupport || existsInOverrideSupportSegments) {
            const overrideRow = scheduleRows.find((row) => {
              if (!isOverrideSupportPersonnelRow(row)) return false;
              const rowSlots = dayData[row.unitId] ?? [];
              const onRow = rowSlots.some((slotValue) =>
                parseAssignedNames(slotValue).includes(personName),
              );
              const segRows = scheduleSlotSegments[storageDateKey]?.[row.unitId] ?? [];
              const onSeg = segRows.some((segments) =>
                Array.isArray(segments)
                  ? segments.some((segment) => segment.personnelName === personName)
                  : false,
              );
              return onRow || onSeg;
            });
            blockedAssignmentReason = overrideRow
              ? `${personName} is on ${overrideRow.label}. Remove them from ${overrideRow.label} before scheduling them on apparatus.`
              : `${personName} is on an Apparatus override row. Remove them from that row before scheduling them on apparatus.`;
            return prev;
          }
          const overlapMsg = computeCrossApparatusOverlapMessage({
            personName,
            excludeUnitId: unitId,
            excludeSlotIndex: slotIndex,
            proposedStart: shiftWindowStartMinutes,
            proposedEnd: shiftWindowEndMinutes,
            shiftWindowStart: shiftWindowStartMinutes,
            shiftWindowEnd: shiftWindowEndMinutes,
            scheduleRows,
            dayData,
            scheduleSlotSegments,
            storageDateKey,
          });
          if (overlapMsg) {
            blockedAssignmentReason = overlapMsg;
            return prev;
          }
        }
        for (const [uid, slots] of Object.entries(dayData)) {
          const row = scheduleRows.find((candidate) => candidate.unitId === uid);
          if (!row) {
            continue;
          }
          const shouldClear = targetOvertimeEnabled
            ? isOverrideSupportPersonnelRow(row)
            : isTargetOverrideSupportPersonnelRow
              ? row.rowType === "apparatus" || isSupportPersonnelRow(row)
              : isTargetApparatusRow
                ? false
                : !isTargetSupportPersonnelRow
                  ? row.rowType === "apparatus" || isOverrideSupportPersonnelRow(row)
                  : false;
          dayData[uid] = shouldClear
            ? slots.map((slotValue) => {
                const remaining = parseAssignedNames(slotValue).filter(
                  (name) => name !== personName,
                );
                return serializeAssignedNames(remaining);
              })
            : [...slots];
        }
        const unitSlots = [...(dayData[unitId] ?? [])];
        while (unitSlots.length <= slotIndex) unitSlots.push("");
        const maxNamesInSlot = targetOvertimeEnabled ? overtimeSplitCount : 1;
        const existingNames = parseAssignedNames(unitSlots[slotIndex] ?? "");
        if (targetOvertimeEnabled && !existingNames.includes(personName)) {
          const requiredQualification =
            targetRow?.requiredQualifications?.[slotIndex]?.trim() ?? "";
          if (requiredQualification) {
            const requiredRank =
              qualificationRankMap.get(requiredQualification) ??
              Number.POSITIVE_INFINITY;
            const personBestRank = getBestQualificationRankForPerson(
              personnelByName.get(personName),
              qualificationRankMap,
            );
            if (!(Number.isFinite(personBestRank) && personBestRank <= requiredRank)) {
              blockedAssignmentReason = `Cannot assign ${personName}: does not meet required qualification for that segmented slot.`;
              return prev;
            }
          }

          const assignedInNonOtRequiredSlot = scheduleRows.some((row) => {
            if (row.rowType !== "apparatus" || row.minimumPersonnel <= 0) {
              return false;
            }
            for (
              let requiredSlotIndex = 0;
              requiredSlotIndex < row.minimumPersonnel;
              requiredSlotIndex += 1
            ) {
              if (row.unitId === unitId && requiredSlotIndex === slotIndex) {
                continue;
              }
              if (isOvertimeEnabledForSlot(dateKey, row.unitId, requiredSlotIndex)) {
                continue;
              }
              const rowSlots = dayData[row.unitId] ?? [];
              const slotValue = rowSlots[requiredSlotIndex] ?? "";
              if (parseAssignedNames(slotValue).includes(personName)) {
                return true;
              }
            }
            return false;
          });
          if (assignedInNonOtRequiredSlot) {
            blockedAssignmentReason = `Cannot assign ${personName}: already assigned to a full-shift required slot on this day.`;
            return prev;
          }
        }
        if (bypassQualification && isTargetApparatusRow && !targetOvertimeEnabled && targetRow) {
          const occupant = parseAssignedNames(unitSlots[slotIndex] ?? "").filter(
            (name) => name.trim() && name.trim() !== personName,
          );
          if (occupant.length > 0) {
            blockedAssignmentReason = "That seat is already filled.";
            return prev;
          }
          unitSlots[slotIndex] = personName;
          while (unitSlots.length < targetRow.slotCount) unitSlots.push("");
          dayData[unitId] = unitSlots.slice(0, targetRow.slotCount);
          next[storageDateKey] = dayData;
          saveScheduleAssignments(next);
          return next;
        }
        const withoutDuplicates = existingNames.filter((name) => name !== personName);
        let writeIndex = slotIndex;
        if (
          isTargetApparatusRow &&
          targetRow &&
          !targetOvertimeEnabled &&
          targetRow.minimumPersonnel > 0
        ) {
          const currentNames = Array.from(
            new Set(
              unitSlots
                .flatMap((slotValue) => parseAssignedNames(slotValue))
                .map((name) => name.trim())
                .filter((name) => name.length > 0),
            ),
          );
          if (!currentNames.includes(personName)) {
            const canJoin = personCanJoinApparatus(
              personName,
              targetRow.requiredQualifications,
              targetRow.minimumPersonnel,
              currentNames,
              personnelByName,
              qualificationRankMap,
            );
            if (!canJoin && !bypassQualification) {
              blockedAssignmentReason = "You do not meet the minimum qualifications.";
              return prev;
            }
            if (currentNames.length >= targetRow.slotCount) {
              blockedAssignmentReason = `Cannot assign ${personName}: there is no open seat.`;
              return prev;
            }
          }
          if (withoutDuplicates.length > 0) {
            let emptyIndex = unitSlots.findIndex((slotValue) =>
              parseAssignedNames(slotValue).every((name) => name.trim().length === 0),
            );
            if (emptyIndex < 0 && unitSlots.length < targetRow.slotCount) {
              emptyIndex = unitSlots.length;
            }
            if (emptyIndex < 0) {
              blockedAssignmentReason = `Cannot assign ${personName}: there is no open seat.`;
              return prev;
            }
            writeIndex = emptyIndex;
          }
        }
        const nextNames = targetOvertimeEnabled
          ? [...withoutDuplicates, personName].slice(0, maxNamesInSlot)
          : [personName];
        while (unitSlots.length <= writeIndex) unitSlots.push("");
        unitSlots[writeIndex] = serializeAssignedNames(nextNames);
        if (
          isTargetApparatusRow &&
          targetRow &&
          !targetOvertimeEnabled &&
          targetRow.minimumPersonnel > 0
        ) {
          const ordered = reorderAssignedByRequirementCoverage(
            targetRow.requiredQualifications.slice(0, targetRow.minimumPersonnel),
            targetRow.minimumPersonnel,
            unitSlots.flatMap((slotValue) => parseAssignedNames(slotValue)),
            personnelByName,
            qualificationRankMap,
          );
          const placed = [...ordered];
          while (placed.length < targetRow.slotCount) placed.push("");
          const fitted = placed.slice(0, targetRow.slotCount);
          const namesBefore = unitSlots.flatMap((slotValue) =>
            parseAssignedNames(slotValue)
              .map((name) => name.trim())
              .filter((name) => name.length > 0),
          );
          const pinned = pinOverrideSeats(
            pendingOverrideRef.current,
            dateKey,
            unitId,
            fitted,
            targetRow.slotCount,
            namesBefore,
          );
          const keptNames = new Set(
            pinned.flatMap((slotValue) => parseAssignedNames(slotValue).map((name) => name.trim())),
          );
          const lostSomeone = namesBefore.some((name) => !keptNames.has(name));
          if (lostSomeone && !bypassQualification) {
            blockedAssignmentReason = "You do not meet the minimum qualifications.";
            return prev;
          }
          dayData[unitId] = pinned;
        } else if (
          targetRow?.rowType === "support" &&
          targetRow.supportValueMode === "personnel"
        ) {
          dayData[unitId] = withNextAdditionalRow(
            unitSlots,
            targetRow.rowsVisible ?? 1,
            targetRow.maximumRows ?? targetRow.slotCount,
          );
        } else {
          dayData[unitId] = unitSlots;
        }
        next[storageDateKey] = dayData;
        saveScheduleAssignments(next);
        return next;
      });
      if (blockedAssignmentReason) {
        if (
          blockedAssignmentReason === "You do not meet the minimum qualifications." ||
          blockedAssignmentReason.includes("no open seat") ||
          blockedAssignmentReason.includes("already assigned to")
        ) {
          openScheduleNotice(
            blockedAssignmentReason,
            blockedAssignmentReason === "You do not meet the minimum qualifications."
              ? { dateKey, personName, unitId, slotIndex }
              : null,
          );
        }
        setLastScheduleAction(blockedAssignmentReason);
        return;
      }
      if (targetSegmentModeEnabled) {
        const targetSegments = getSegmentsForSlot(dateKey, unitId, slotIndex).filter(
          (segment) => segment.source === "trade",
        );
        targetSegments.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          assigneeType: "personnel",
          personnelName: personName,
          startMinutes: shiftWindowStartMinutes,
          endMinutes: clampDayMinutes(shiftWindowEndMinutes),
          source: "manual",
          overtime: false,
        });
        setSegmentsForSlot(
          dateKey,
          unitId,
          slotIndex,
          targetSegments,
          "Assigned personnel.",
        );
      } else {
        setSegmentsForSlot(dateKey, unitId, slotIndex, [], "Assigned personnel.");
      }
      setLastScheduleAction("Assigned personnel.");
    },
    [
      scheduleRows,
      buildDefaultAssignmentsForDate,
      effectiveShift,
      getSegmentsForSlot,
      isOvertimeEnabledForSlot,
      overtimeSplitCount,
      personnelByName,
      setSegmentsForSlot,
      shiftWindowStartMinutes,
      shiftWindowEndMinutes,
      qualificationRankMap,
      pushUndoSnapshot,
      scheduleSlotSegments,
      getAssignmentsForDay,
      openScheduleNotice,
      limitedScheduleEditor,
      viewerName,
      pendingOverrides,
    ],
  );
  assignPersonToSlotRef.current = assignPersonToSlot;

  const apparatusOverrideBlockMessage = useCallback(
    (dateKey: string, personName: string): string | null => {
      const trimmed = personName.trim();
      if (!trimmed) return null;
      const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
      const dayData = scheduleAssignments[storageDateKey] ?? {};
      const overrideRow = scheduleRows.find((row) => {
        if (!isOverrideSupportPersonnelRow(row)) return false;
        const slots = dayData[row.unitId] ?? [];
        const onRow = slots.some((slotValue) => parseAssignedNames(slotValue).includes(trimmed));
        const segRows = scheduleSlotSegments[storageDateKey]?.[row.unitId] ?? [];
        const onSeg = segRows.some((segments) =>
          Array.isArray(segments)
            ? segments.some((segment) => segment.personnelName.trim() === trimmed)
            : false,
        );
        return onRow || onSeg;
      });
      if (!overrideRow) return null;
      return `${trimmed} is on ${overrideRow.label}. Remove them from ${overrideRow.label} before scheduling them on apparatus.`;
    },
    [effectiveShift, scheduleAssignments, scheduleRows, scheduleSlotSegments],
  );

  const apparatusSeatQualificationMessage = useCallback(
    (unitId: string, slotIndex: number, personName: string): string | null => {
      const trimmed = personName.trim();
      if (!trimmed) return null;
      const row = scheduleRows.find(
        (entry) => entry.unitId === unitId && entry.rowType === "apparatus",
      );
      if (!row || slotIndex >= row.minimumPersonnel) return null;
      const requiredQualification = row.requiredQualifications[slotIndex]?.trim() ?? "";
      if (!requiredQualification) return null;
      const requiredRank =
        qualificationRankMap.get(requiredQualification) ?? Number.POSITIVE_INFINITY;
      const personBestRank = getBestQualificationRankForPerson(
        personnelByName.get(trimmed),
        qualificationRankMap,
      );
      if (Number.isFinite(personBestRank) && personBestRank <= requiredRank) return null;
      return "You do not meet the minimum qualifications.";
    },
    [personnelByName, qualificationRankMap, scheduleRows],
  );

  const assertApparatusTimeOverlap = useCallback(
    (
      dateKey: string,
      personName: string,
      excludeUnitId: string,
      excludeSlotIndex: number,
      proposedStart: number,
      proposedEnd: number,
    ): string | null => {
      const trimmed = personName.trim();
      if (!trimmed) return null;
      const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
      const dayData = { ...(scheduleAssignments[storageDateKey] ?? {}) } as Record<
        string,
        string[]
      >;
      const dayDefaults = buildDefaultAssignmentsForDate(dateKey);
      scheduleRows.forEach((row) => {
        if (!dayData[row.unitId]) {
          dayData[row.unitId] = (dayDefaults[row.unitId] ?? []).slice(0, row.slotCount);
        }
      });
      return computeCrossApparatusOverlapMessage({
        personName: trimmed,
        excludeUnitId,
        excludeSlotIndex,
        proposedStart,
        proposedEnd,
        shiftWindowStart: shiftWindowStartMinutes,
        shiftWindowEnd: shiftWindowEndMinutes,
        scheduleRows,
        dayData,
        scheduleSlotSegments,
        storageDateKey,
      });
    },
    [
      effectiveShift,
      scheduleAssignments,
      scheduleSlotSegments,
      scheduleRows,
      buildDefaultAssignmentsForDate,
      shiftWindowStartMinutes,
      shiftWindowEndMinutes,
    ],
  );

  /** Limited user takes one already-open time block on a split seat without changing the other person. */
  const claimOpenTimeBlock = useCallback(
    (
      dateKey: string,
      unitId: string,
      slotIndex: number,
      startMinutes: number,
      endMinutes: number,
      bypassQualification = false,
    ) => {
      const personName = viewerName.trim();
      if (!limitedScheduleEditor || !personName) return;
      if (!(endMinutes > startMinutes)) return;
      const targetRow = scheduleRows.find((row) => row.unitId === unitId);
      if (!targetRow || targetRow.rowType !== "apparatus") return;
      if (!isOvertimeEnabledForSlot(dateKey, unitId, slotIndex)) return;
      const heldPartial = pendingOverrides.find(
        (item) =>
          item.status === "pending" &&
          item.requiredQualification.startsWith(PARTIAL_SHIFT) &&
          item.dateKey === dateKey &&
          item.unitId === unitId &&
          item.slotIndex === slotIndex,
      );
      if (heldPartial) {
        openScheduleNotice(
          `${heldPartial.personName} has a partial shift waiting for approval on this seat.`,
        );
        return;
      }
      const qualificationMessage = apparatusSeatQualificationMessage(unitId, slotIndex, personName);
      if (qualificationMessage && !bypassQualification) {
        openScheduleNotice("You do not meet the minimum qualifications.", {
          dateKey,
          personName,
          unitId,
          slotIndex,
          startMinutes,
          endMinutes,
        });
        return;
      }
      const overrideMessage = apparatusOverrideBlockMessage(dateKey, personName);
      if (overrideMessage) {
        openScheduleNotice(overrideMessage);
        return;
      }
      const stored = getSegmentsForSlot(dateKey, unitId, slotIndex).filter(
        (segment) =>
          segment.source !== "auto_hire" &&
          segment.assigneeType !== "hire" &&
          segment.personnelName.trim().length > 0 &&
          !isOpenOrHireToken(segment.personnelName) &&
          segment.endMinutes > segment.startMinutes,
      );
      if (
        stored.some((segment) =>
          schedulesIntervalOverlap(startMinutes, endMinutes, segment.startMinutes, segment.endMinutes),
        )
      ) {
        openScheduleNotice("That time is already filled.");
        return;
      }
      const overlapMessage = assertApparatusTimeOverlap(
        dateKey,
        personName,
        unitId,
        slotIndex,
        startMinutes,
        endMinutes,
      );
      if (overlapMessage) {
        openScheduleNotice(overlapMessage);
        return;
      }
      const assignedOnFullShift = scheduleRows.some((row) => {
        if (row.rowType !== "apparatus" || row.minimumPersonnel <= 0) return false;
        for (let requiredSlotIndex = 0; requiredSlotIndex < row.minimumPersonnel; requiredSlotIndex += 1) {
          if (row.unitId === unitId && requiredSlotIndex === slotIndex) continue;
          if (isOvertimeEnabledForSlot(dateKey, row.unitId, requiredSlotIndex)) continue;
          const slots = getAssignmentsForDay(dateKey, row.unitId, row.slotCount);
          if (parseAssignedNames(slots[requiredSlotIndex] ?? "").includes(personName)) return true;
        }
        return false;
      });
      if (assignedOnFullShift) {
        openScheduleNotice(
          `Cannot assign ${personName}: already assigned to a full-shift required slot on this day.`,
        );
        return;
      }
      pushUndoSnapshot("Add yourself to open time");
      const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
      setScheduleAssignments((previous) => {
        const next = { ...previous };
        const dayData = { ...(next[storageDateKey] ?? {}) } as Record<string, string[]>;
        const current = getAssignmentsForDay(dateKey, unitId, targetRow.slotCount);
        const unitSlots = [...(dayData[unitId] ?? current)];
        while (unitSlots.length <= slotIndex) unitSlots.push("");
        const names = parseAssignedNames(unitSlots[slotIndex] ?? "").filter(
          (entry) => entry.trim() && !isOpenOrHireToken(entry),
        );
        if (!names.some((entry) => entry.toLowerCase() === personName.toLowerCase())) {
          names.push(personName);
        }
        const drafted = sortSegments([
          ...getSegmentsForSlot(dateKey, unitId, slotIndex).filter(isRealPersonSegment),
          {
            id: `self-${Date.now()}`,
            assigneeType: "personnel" as const,
            personnelName: personName,
            startMinutes,
            endMinutes,
            source: "manual" as const,
            overtime: false,
          },
        ]);
        const covered = singleSegmentIfPersonCoversShift(
          drafted,
          shiftWindowStartMinutes,
          shiftWindowEndMinutes,
        );
        unitSlots[slotIndex] = covered ? personName : serializeAssignedNames(names);
        dayData[unitId] = unitSlots;
        next[storageDateKey] = dayData;
        saveScheduleAssignments(next);
        return next;
      });
      setScheduleSlotSegments((previous) => {
        const day = { ...(previous[storageDateKey] ?? {}) };
        const unitRows = Array.isArray(day[unitId]) ? [...day[unitId]!] : [];
        while (unitRows.length <= slotIndex) unitRows.push([]);
        const existing = Array.isArray(unitRows[slotIndex]) ? unitRows[slotIndex]! : [];
        const drafted = sortSegments([
          ...existing.filter(isRealPersonSegment),
          {
            id: `self-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            assigneeType: "personnel",
            personnelName: personName,
            startMinutes,
            endMinutes,
            source: "manual",
            overtime: false,
          },
        ]);
        const covered = singleSegmentIfPersonCoversShift(
          drafted,
          shiftWindowStartMinutes,
          shiftWindowEndMinutes,
        );
        unitRows[slotIndex] = covered ?? drafted;
        const next = { ...previous, [storageDateKey]: { ...day, [unitId]: unitRows } };
        saveScheduleSlotSegments(next);
        return next;
      });
      setLastScheduleAction(`Added ${personName} to the open time.`);
      return true;
    },
    [
      apparatusOverrideBlockMessage,
      apparatusSeatQualificationMessage,
      assertApparatusTimeOverlap,
      effectiveShift,
      getAssignmentsForDay,
      getSegmentsForSlot,
      isOvertimeEnabledForSlot,
      limitedScheduleEditor,
      openScheduleNotice,
      pendingOverrides,
      pushUndoSnapshot,
      scheduleRows,
      shiftWindowEndMinutes,
      shiftWindowStartMinutes,
      sortSegments,
      viewerName,
    ],
  );
  placeOpenTimeRef.current = (dateKey, unitId, slotIndex, startMinutes, endMinutes) =>
    claimOpenTimeBlock(dateKey, unitId, slotIndex, startMinutes, endMinutes, true) === true;

  /** When only one segment remains (e.g. user deleted others), exit segment mode: one 24h slot + clear segment data. */
  const collapseSegmentModeToSingleSlot = useCallback(
    (dateKey: string, unitId: string, slotIndex: number, remainingPersonName: string) => {
      pushUndoSnapshot("Collapse segment mode to single 24h slot");
      const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
      setScheduleAssignments((prev) => {
        const next = { ...prev };
        const dayData = { ...(next[storageDateKey] ?? {}) } as Record<string, string[]>;
        const row = scheduleRows.find((r) => r.unitId === unitId);
        if (!row) return prev;
        const unitSlots = [...(dayData[unitId] ?? [])];
        while (unitSlots.length <= slotIndex) unitSlots.push("");
        unitSlots[slotIndex] = remainingPersonName.trim();
        dayData[unitId] = unitSlots;
        next[storageDateKey] = dayData;
        saveScheduleAssignments(next);
        return next;
      });
      setScheduleSlotSegments((previous) => {
        const day = { ...(previous[storageDateKey] ?? {}) };
        const unitRows = Array.isArray(day[unitId]) ? [...day[unitId]!] : [];
        while (unitRows.length <= slotIndex) unitRows.push([]);
        unitRows[slotIndex] = [];
        const next = { ...previous, [storageDateKey]: { ...day, [unitId]: unitRows } };
        saveScheduleSlotSegments(next);
        return next;
      });
      applyOvertimeSplitChange({
        ...scheduleOvertimeSplit,
        [storageDateKey]: {
          ...(scheduleOvertimeSplit[storageDateKey] ?? {}),
          [unitId]: (() => {
            const unitFlags = [...(scheduleOvertimeSplit[storageDateKey]?.[unitId] ?? [])];
            while (unitFlags.length <= slotIndex) unitFlags.push(false);
            unitFlags[slotIndex] = false;
            return unitFlags;
          })(),
        },
      });
      setLastScheduleAction("Returned to single 24-hour slot.");
    },
    [
      applyOvertimeSplitChange,
      effectiveShift,
      pushUndoSnapshot,
      scheduleOvertimeSplit,
      scheduleRows,
    ],
  );

  const promptSelfCancellation = useCallback(
    (dateKey: string, unitId: string, slotIndex: number) => {
      const personName = viewerName.trim();
      if (!personName) return;
      const alreadyPending = pendingOverrides.some(
        (item) =>
          item.status === "pending" &&
          item.requiredQualification === SEAT_REMOVAL &&
          item.dateKey === dateKey &&
          item.unitId === unitId &&
          item.slotIndex === slotIndex &&
          item.personName.trim().toLowerCase() === personName.toLowerCase(),
      );
      if (alreadyPending) {
        openScheduleNotice("Your cancellation is already waiting for a sub admin.");
        return;
      }
      setNoticeAction({
        label: "Request cancellation",
        run: () => {
          void requestSeatRemoval(dateKey, unitId, slotIndex, personName);
        },
      });
      setScheduleNotice(
        "Taking yourself off this seat needs a sub admin to approve. You stay on the schedule until then.",
      );
    },
    [openScheduleNotice, pendingOverrides, requestSeatRemoval, viewerName],
  );

  const clearSlotValue = useCallback(
    (dateKey: string, unitId: string, slotIndex: number) => {
      if (limitedScheduleEditor) {
        const row = scheduleRows.find((entry) => entry.unitId === unitId);
        const names = parseAssignedNames(
          getAssignmentsForDay(dateKey, unitId, row?.slotCount ?? slotIndex + 1)[slotIndex] ?? "",
        ).filter((name) => name.trim());
        if (names.length === 0) return;
        const self = viewerName.trim().toLowerCase();
        if (!self || names.some((name) => name.trim().toLowerCase() !== self)) {
          openScheduleNotice("You cannot remove someone else from the schedule.");
          return;
        }
        promptSelfCancellation(dateKey, unitId, slotIndex);
        return;
      }
      pushUndoSnapshot("Clear slot");
      setScheduleAssignments((prev) => {
        const next = { ...prev };
        const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
        const dayData = { ...(next[storageDateKey] ?? {}) } as Record<
          string,
          string[]
        >;
        const dayDefaults = buildDefaultAssignmentsForDate(dateKey);
        const row = scheduleRows.find((entry) => entry.unitId === unitId);
        if (!row) {
          return prev;
        }
        if (!dayData[unitId]) {
          const defaults = dayDefaults[unitId] ?? [];
          dayData[unitId] = defaults.slice(0, row.slotCount);
        }
        const unitSlots = [...(dayData[unitId] ?? [])];
        while (unitSlots.length <= slotIndex) unitSlots.push("");
        unitSlots[slotIndex] = "";
        dayData[unitId] = unitSlots;
        next[storageDateKey] = dayData;
        saveScheduleAssignments(next);
        return next;
      });
      setSegmentsForSlot(dateKey, unitId, slotIndex, [], "Cleared slot.");
      setLastScheduleAction("Cleared slot.");
    },
    [
      scheduleRows,
      buildDefaultAssignmentsForDate,
      effectiveShift,
      pushUndoSnapshot,
      setSegmentsForSlot,
      limitedScheduleEditor,
      viewerName,
      getAssignmentsForDay,
      openScheduleNotice,
      promptSelfCancellation,
    ],
  );

  const updateTextSlotValue = useCallback(
    (dateKey: string, unitId: string, slotIndex: number, textValue: string) => {
      setScheduleAssignments((prev) => {
        const next = { ...prev };
        const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
        const dayData = { ...(next[storageDateKey] ?? {}) } as Record<
          string,
          string[]
        >;
        const row = scheduleRows.find((entry) => entry.unitId === unitId);
        if (!row) return prev;
        if (!dayData[unitId]) {
          dayData[unitId] = getAssignmentsForDay(dateKey, unitId, row.slotCount);
        }
        const unitSlots = [...(dayData[unitId] ?? [])];
        while (unitSlots.length <= slotIndex) unitSlots.push("");
        unitSlots[slotIndex] = textValue.slice(0, 25);
        dayData[unitId] = unitSlots;
        next[storageDateKey] = dayData;
        saveScheduleAssignments(next);
        return next;
      });
    },
    [effectiveShift, scheduleRows, getAssignmentsForDay],
  );

  const revealNextSupportRow = useCallback(
    (dateKey: string, unitId: string) => {
      const row = scheduleRows.find((entry) => entry.unitId === unitId);
      if (!row || row.rowType !== "support") return;
      const rowsVisible = row.rowsVisible ?? 1;
      const maximumRows = row.maximumRows ?? row.slotCount;
      setScheduleAssignments((prev) => {
        const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
        const dayData = { ...(prev[storageDateKey] ?? {}) } as Record<string, string[]>;
        const current = [...(dayData[unitId] ?? [])];
        const nextSlots = withNextAdditionalRow(current, rowsVisible, maximumRows);
        if (
          nextSlots.length === current.length &&
          nextSlots.every((value, index) => value === current[index])
        ) {
          return prev;
        }
        dayData[unitId] = nextSlots;
        const next = { ...prev, [storageDateKey]: dayData };
        saveScheduleAssignments(next);
        return next;
      });
    },
    [effectiveShift, scheduleRows],
  );

  const assignedOnDay = useCallback(
    (dateKey: string): Set<string> => {
      const names = new Set<string>();
      for (const row of scheduleRows) {
        const isNameSlot =
          row.rowType === "apparatus" || isSupportPersonnelRow(row);
        if (!isNameSlot) {
          continue;
        }
        const slots = getAssignmentsForDay(dateKey, row.unitId, row.slotCount);
        for (const n of slots) {
          parseAssignedNames(n).forEach((name) => names.add(name));
        }
      }
      return names;
    },
    [scheduleRows, getAssignmentsForDay],
  );

  const isAllShiftPersonnelAssignedOnDay = useCallback(
    (dateKey: string): boolean => {
      if (shiftPersonnel.length === 0) {
        return false;
      }
      const assignedNames = assignedOnDay(dateKey);
      return shiftPersonnel.every((person) => assignedNames.has(person.name));
    },
    [assignedOnDay, shiftPersonnel],
  );

  const getEligibleShiftPersonnelForSlot = useCallback(
    (
      dateKey: string,
      row: PersonnelScheduleRow,
      slotIndex: number,
      currentName: string,
    ): PersonnelScheduleData["personnel"] => {
      const targetOvertimeEnabled =
        row.rowType === "apparatus" &&
        slotIndex < row.minimumPersonnel &&
        isOvertimeEnabledForSlot(dateKey, row.unitId, slotIndex);
      const assignedInBlockingRows = new Set<string>();
      for (const scheduleRow of scheduleRows) {
        const isBlockingRow =
          targetOvertimeEnabled
            ? isOverrideSupportPersonnelRow(scheduleRow)
            : scheduleRow.rowType === "apparatus" ||
              isOverrideSupportPersonnelRow(scheduleRow);
        if (!isBlockingRow) {
          continue;
        }
        const slots = getAssignmentsForDay(
          dateKey,
          scheduleRow.unitId,
          scheduleRow.slotCount,
        );
        slots.forEach((slotValue) => {
          parseAssignedNames(slotValue).forEach((name) =>
            assignedInBlockingRows.add(name),
          );
        });
      }
      if (targetOvertimeEnabled) {
        // OT-enabled target slots allow cross-slot OT coverage without blocking by other OT slots.
      }
      if (currentName.trim()) {
        parseAssignedNames(currentName).forEach((name) =>
          assignedInBlockingRows.delete(name),
        );
      }
      const requiredRanks = row.requiredQualifications
        .map((qualification) => qualificationRankMap.get(qualification))
        .filter((rank): rank is number => rank !== undefined);
      const worstRequiredRank =
        requiredRanks.length > 0
          ? Math.max(...requiredRanks)
          : Number.POSITIVE_INFINITY;
      const requiresQualificationGate =
        row.rowType === "apparatus" &&
        row.minimumPersonnel > 0 &&
        requiredRanks.length > 0;

      if (isSupportPersonnelRow(row)) {
        return [...shiftPersonnel].sort((a, b) =>
          comparePersonnelByQualifications(
            a,
            b,
            departmentData.personnelQualifications,
          ),
        );
      }

      return shiftPersonnel
        .filter((person) => !assignedInBlockingRows.has(person.name))
        .filter((person) => {
          if (targetOvertimeEnabled) {
            const requiredQualification =
              row.requiredQualifications[slotIndex]?.trim() ?? "";
            if (requiredQualification) {
              const requiredRank =
                qualificationRankMap.get(requiredQualification) ??
                Number.POSITIVE_INFINITY;
              const personBestRank = getBestQualificationRankForPerson(
                person,
                qualificationRankMap,
              );
              if (!(Number.isFinite(personBestRank) && personBestRank <= requiredRank)) {
                return false;
              }
            }
            const assignedInNonOtRequiredSlot = scheduleRows.some((scheduleRow) => {
              if (
                scheduleRow.rowType !== "apparatus" ||
                scheduleRow.minimumPersonnel <= 0
              ) {
                return false;
              }
              for (
                let requiredSlotIndex = 0;
                requiredSlotIndex < scheduleRow.minimumPersonnel;
                requiredSlotIndex += 1
              ) {
                if (
                  scheduleRow.unitId === row.unitId &&
                  requiredSlotIndex === slotIndex
                ) {
                  continue;
                }
                if (
                  isOvertimeEnabledForSlot(
                    dateKey,
                    scheduleRow.unitId,
                    requiredSlotIndex,
                  )
                ) {
                  continue;
                }
                const slots = getAssignmentsForDay(
                  dateKey,
                  scheduleRow.unitId,
                  scheduleRow.slotCount,
                );
                const slotValue = slots[requiredSlotIndex] ?? "";
                if (parseAssignedNames(slotValue).includes(person.name)) {
                  return true;
                }
              }
              return false;
            });
            if (assignedInNonOtRequiredSlot) {
              return false;
            }
          }
          if (!requiresQualificationGate) return true;
          const bestRank = getBestQualificationRankForPerson(
            person,
            qualificationRankMap,
          );
          return Number.isFinite(bestRank) && bestRank <= worstRequiredRank;
        })
        .sort((a, b) =>
          comparePersonnelByQualifications(
            a,
            b,
            departmentData.personnelQualifications,
          ),
        );
    },
    [
      qualificationRankMap,
      scheduleRows,
      getAssignmentsForDay,
      shiftPersonnel,
      departmentData.personnelQualifications,
      isOvertimeEnabledForSlot,
    ],
  );

  const normalizeDayAssignmentsForRequirements = useCallback(
    (dateKey: string) => {
      setScheduleAssignments((prev) => {
        const next = { ...prev };
        const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
        const dayData = { ...(next[storageDateKey] ?? {}) } as Record<
          string,
          string[]
        >;
        const dayDefaults = buildDefaultAssignmentsForDate(dateKey);
        scheduleRows.forEach((row) => {
          if (!dayData[row.unitId]) {
            dayData[row.unitId] = (dayDefaults[row.unitId] ?? []).slice(
              0,
              row.slotCount,
            );
          }
          if (row.rowType === "support") {
            dayData[row.unitId] = getAssignmentsForDay(
              dateKey,
              row.unitId,
              row.maximumRows ?? row.slotCount,
              true,
              false,
            ).slice(0, row.maximumRows ?? row.slotCount);
            return;
          }
          const current = getAssignmentsForDay(
            dateKey,
            row.unitId,
            row.slotCount,
          ).filter((name) => name.trim());
          if (row.rowType !== "apparatus" || row.minimumPersonnel <= 0) {
            const padded = [...current];
            while (padded.length < row.slotCount) padded.push("");
            dayData[row.unitId] = padded.slice(0, row.slotCount);
            return;
          }
          const ordered = reorderAssignedByRequirementCoverage(
            row.requiredQualifications.slice(0, row.minimumPersonnel),
            row.minimumPersonnel,
            current,
            personnelByName,
            qualificationRankMap,
          );
          const preserved = assignmentsPreservingNames(ordered, current, row.slotCount);
          dayData[row.unitId] = pinOverrideSeats(
            pendingOverrideRef.current,
            dateKey,
            row.unitId,
            preserved,
            row.slotCount,
            current,
          );
        });
        next[storageDateKey] = dayData;
        saveScheduleAssignments(next);
        return next;
      });
    },
    [
      scheduleRows,
      getAssignmentsForDay,
      personnelByName,
      qualificationRankMap,
      buildDefaultAssignmentsForDate,
      effectiveShift,
    ],
  );

  const didPlaceQualifications = useRef(false);
  useEffect(() => {
    if (!hasLoadedRemoteSchedule || !overridesReady || didPlaceQualifications.current || scheduleRows.length === 0) {
      return;
    }
    didPlaceQualifications.current = true;
    setScheduleAssignments((previous) => {
      let changed = false;
      const next: ScheduleAssignments = { ...previous };
      Object.entries(previous).forEach(([storageDateKey, dayRaw]) => {
        if (!dayRaw || typeof dayRaw !== "object") return;
        const day = { ...(dayRaw as Record<string, string[]>) };
        scheduleRows.forEach((row) => {
          if (row.rowType !== "apparatus" || row.minimumPersonnel <= 0) return;
          const segmentRows = scheduleSlotSegments[storageDateKey]?.[row.unitId] ?? [];
          const hasSegments = segmentRows.some(
            (segments) => Array.isArray(segments) && segments.length > 0,
          );
          if (hasSegments) return;
          const current = Array.isArray(day[row.unitId]) ? day[row.unitId] : [];
          const ordered = reorderAssignedByRequirementCoverage(
            row.requiredQualifications.slice(0, row.minimumPersonnel),
            row.minimumPersonnel,
            current.flatMap((slotValue) => parseAssignedNames(slotValue)),
            personnelByName,
            qualificationRankMap,
          );
          const calendarDate = storageDateKey.split("::")[1] ?? storageDateKey;
          const namesBefore = current.flatMap((slotValue) =>
            parseAssignedNames(slotValue)
              .map((name) => name.trim())
              .filter((name) => name.length > 0),
          );
          const nextSlots = pinOverrideSeats(
            pendingOverrideRef.current,
            calendarDate,
            row.unitId,
            assignmentsPreservingNames(ordered, current, row.slotCount),
            row.slotCount,
            namesBefore,
          );
          if (JSON.stringify(nextSlots) !== JSON.stringify(current)) {
            changed = true;
            day[row.unitId] = nextSlots;
          }
        });
        next[storageDateKey] = day;
      });
      if (!changed) return previous;
      saveScheduleAssignments(next);
      return next;
    });
  }, [
    hasLoadedRemoteSchedule,
    overridesReady,
    scheduleRows,
    scheduleSlotSegments,
    personnelByName,
    qualificationRankMap,
  ]);

  const importAssignmentsForDay = useCallback(
    (dateKey: string) => {
      if (limitedEditorRef.current) {
        scheduleNoticeRef.current("You can fill an open seat. You cannot replace the day's assignments.");
        return;
      }
      pushUndoSnapshot("Import assignments for day");
      setScheduleAssignments((previous) => {
        const next = { ...previous };
        const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
        const existingDay = { ...(next[storageDateKey] ?? {}) };
        const defaults = buildDefaultAssignmentsForDate(dateKey);

        scheduleRows.forEach((row) => {
          // Restore staffing-focused rows from current shift/day defaults.
          if (row.rowType !== "apparatus" && row.unitId !== "support-kelly-day") {
            return;
          }
          const defaultSlots = (defaults[row.unitId] ?? []).slice(0, row.slotCount);
          while (defaultSlots.length < row.slotCount) defaultSlots.push("");
          existingDay[row.unitId] = defaultSlots;
        });

        next[storageDateKey] = existingDay;
        saveScheduleAssignments(next);
        return next;
      });
      setScheduleSlotSegments((previous) => {
        const storageDateKey = toScheduleStorageDateKey(effectiveShift, dateKey);
        const daySegments = previous[storageDateKey];
        if (!daySegments) {
          return previous;
        }
        const nextDaySegments = { ...daySegments };
        scheduleRows.forEach((row) => {
          if (row.rowType === "apparatus" || row.unitId === "support-kelly-day") {
            delete nextDaySegments[row.unitId];
          }
        });
        const nextSegments = { ...previous, [storageDateKey]: nextDaySegments };
        saveScheduleSlotSegments(nextSegments);
        return nextSegments;
      });
      setLastScheduleAction("Imported assignments for day.");
    },
    [
      scheduleRows,
      buildDefaultAssignmentsForDate,
      effectiveShift,
      pushUndoSnapshot,
    ],
  );

  const getCoverageLines = useCallback(
    (dateKey: string, rowId: string) => {
      const target = rowId === "support-info" ? "info" : rowId === "support-trade" ? "trades" : null;
      if (!target) return [];
      const segments: Array<{
        personnelName?: string;
        startMinutes?: number;
        endMinutes?: number;
        source?: string;
        overtime?: boolean;
      }> = [];
      scheduleRows
        .filter((entry) => entry.rowType === "apparatus")
        .forEach((entry) => {
          for (let slotIndex = 0; slotIndex < entry.slotCount; slotIndex += 1) {
            getSegmentsForSlot(dateKey, entry.unitId, slotIndex).forEach((segment) => {
              if (segment.source === "trade") {
                if (target === "trades") segments.push(segment);
                return;
              }
              if (!isOvertimeEnabledForSlot(dateKey, entry.unitId, slotIndex)) return;
              const destination = segment.overtime
                ? departmentData.overtimeSummaryTarget
                : departmentData.segmentSummaryTarget;
              if (destination === target) segments.push(segment);
            });
          }
        });
      scheduleRows
        .filter((entry) => entry.segmentDisplayIn === target)
        .forEach((entry) => {
          for (let slotIndex = 0; slotIndex < entry.slotCount; slotIndex += 1) {
            if (!isOvertimeEnabledForSlot(dateKey, entry.unitId, slotIndex)) continue;
            getSegmentsForSlot(dateKey, entry.unitId, slotIndex).forEach((segment) => {
              segments.push(segment);
            });
          }
        });
      return formatSegmentCoverageLines(segments);
    },
    [departmentData.overtimeSummaryTarget, departmentData.segmentSummaryTarget, getSegmentsForSlot, isOvertimeEnabledForSlot, scheduleRows],
  );

  /** Step 17 KPIs — all counts use the dates currently on screen (week or month). */
  const scheduleKpis = useMemo(() => {
    const visibleDateKeys = new Set(displayDates.map((date) => toDateKey(date)));
    let requiredSeats = 0;
    let openSeats = 0;
    let kellyOn = 0;

    for (const date of displayDates) {
      const dateKey = toDateKey(date);
      for (const row of scheduleRows) {
        if (row.rowType === "apparatus" && row.minimumPersonnel > 0) {
          const slots = getAssignmentsForDay(dateKey, row.unitId, row.slotCount);
          for (let slotIdx = 0; slotIdx < row.minimumPersonnel; slotIdx += 1) {
            requiredSeats += 1;
            const name = slots[slotIdx] ?? "";
            const segmentModeEnabled = isOvertimeEnabledForSlot(
              dateKey,
              row.unitId,
              slotIdx,
            );
            const storedSegments = getSegmentsForSlot(dateKey, row.unitId, slotIdx);
            const hasSegmentPersonnel =
              segmentModeEnabled &&
              storedSegments.some(
                (segment) =>
                  segment.source !== "auto_hire" &&
                  seatNamesIncludeRealPerson([segment.personnelName]),
              );
            const pendingPartialNames = pendingOverrides
              .filter(
                (item) =>
                  item.status === "pending" &&
                  item.requiredQualification.startsWith(PARTIAL_SHIFT) &&
                  item.dateKey === dateKey &&
                  item.unitId === row.unitId &&
                  item.slotIndex === slotIdx,
              )
              .map((item) => item.personName.trim())
              .filter(Boolean);
            const slotNames = parseAssignedNames(name);
            const hasRealPerson =
              seatNamesIncludeRealPerson(slotNames) ||
              hasSegmentPersonnel ||
              seatNamesIncludeRealPerson(pendingPartialNames);
            if (!hasRealPerson) {
              openSeats += 1;
            }
          }
        }

        if (row.unitId === "support-kelly-day") {
          const slots = getAssignmentsForDay(
            dateKey,
            row.unitId,
            row.maximumRows ?? row.slotCount,
            true,
            false,
          );
          const visibleCount = visibleAdditionalRowCount(
            slots,
            row.rowsVisible ?? 1,
            row.maximumRows ?? row.slotCount,
          );
          for (const slotValue of slots.slice(0, visibleCount)) {
            parseAssignedNames(slotValue).forEach((personName) => {
              if (personName.trim() && !isOpenOrHireToken(personName)) {
                kellyOn += 1;
              }
            });
          }
        }
      }
    }

    const filledSeats = Math.max(0, requiredSeats - openSeats);
    const coveragePercent =
      requiredSeats === 0 ? 100 : Math.round((filledSeats / requiredSeats) * 100);
    const pendingOverrideCount = pendingOverrides.filter(
      (item) =>
        item.status === "pending" &&
        visibleDateKeys.has(item.dateKey) &&
        (!item.shiftType || item.shiftType === effectiveShift),
    ).length;

    const kellyRowVisible = scheduleRows.some((row) => row.unitId === "support-kelly-day");

    return {
      openSeats,
      coveragePercent,
      pendingOverrideCount,
      kellyOn,
      kellyRowVisible,
    };
  }, [
    displayDates,
    effectiveShift,
    getAssignmentsForDay,
    getSegmentsForSlot,
    isOvertimeEnabledForSlot,
    pendingOverrides,
    scheduleRows,
  ]);

  if (isLoading && departmentData.personnel.length === 0) {
    return (
      <section className="page-section">
        <header className="page-header">
          <h1>Personnel Schedule</h1>
          <p>Loading department details…</p>
        </header>
      </section>
    );
  }

  if (!hasExplicitShiftStartTime) {
    return (
      <section className="page-section">
        <header className="page-header">
          <h1>Personnel Schedule</h1>
          <p>
            Schedule calculations are blocked until this shift has a Start Time.
            Go to Admin Functions {"->"} Schedule Settings {"->"} Shift Information and set
            a 24-hour Start Time for <strong>{effectiveShift || "the active shift"}</strong>.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="page-section personnel-schedule-page">
      <header className="page-header">
        <div className="personnel-schedule-header-lead">
          <h1>Personnel Schedule</h1>
          {isDemoTenant ? (
            <p className="demo-helper-text">
              Double click day column to open day block.
            </p>
          ) : null}
        </div>
        <div className="personnel-schedule-header-trail">
          <div className="header-actions personnel-schedule-header-actions">
            <div className="personnel-schedule-month-nav">
              <button
                type="button"
                className="secondary-button compact-button"
                aria-label={
                  calendarViewMode === "week" ? "Previous week" : "Previous month"
                }
                onClick={() =>
                  setViewDate((d) =>
                    calendarViewMode === "week"
                      ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7)
                      : new Date(d.getFullYear(), d.getMonth() - 1),
                  )
                }
              >
                {"<"}
              </button>
              <button
                type="button"
                className="personnel-schedule-calendar-toggle"
                aria-label={
                  calendarViewMode === "week"
                    ? "Switch to month view"
                    : "Switch to week view"
                }
                title={
                  calendarViewMode === "week"
                    ? "Switch to month view"
                    : "Switch to week view"
                }
                onClick={() =>
                  setCalendarViewMode((mode) => (mode === "week" ? "month" : "week"))
                }
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <rect
                    x="2"
                    y="3"
                    width="12"
                    height="11"
                    rx="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="5.5" cy="10" r="0.8" fill="currentColor" />
                  <circle cx="8" cy="10" r="0.8" fill="currentColor" />
                  <circle cx="10.5" cy="10" r="0.8" fill="currentColor" />
                </svg>
              </button>
              <span className="personnel-schedule-month-label">{calendarNavLabel}</span>
              <button
                type="button"
                className="secondary-button compact-button"
                aria-label={calendarViewMode === "week" ? "Next week" : "Next month"}
                onClick={() =>
                  setViewDate((d) =>
                    calendarViewMode === "week"
                      ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
                      : new Date(d.getFullYear(), d.getMonth() + 1),
                  )
                }
              >
                {">"}
              </button>
            </div>
            <select
              id="personnel-schedule-shift"
              value={effectiveShift}
              onChange={(e) => setSelectedShift(e.target.value)}
            >
              {shiftOptions.map((opt) => (
                <option key={opt.shiftType} value={opt.shiftType}>
                  {opt.shiftType}
                </option>
              ))}
            </select>
            <div className="personnel-schedule-highlight-row">
              <select
                id="personnel-schedule-highlight"
                value={highlightPersonnelName}
                onChange={(e) => setHighlightPersonnelName(e.target.value)}
              >
                <option value="">Highlight Personnel</option>
                {sortedShiftPersonnel.map((person) => (
                  <option key={person.name} value={person.name}>
                    {person.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => setHighlightPersonnelName("")}
                aria-label="Clear highlighted personnel"
              >
                X
              </button>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={undoLastScheduleChange}
                disabled={scheduleUndoStack.length === 0}
              >
                Undo
              </button>
            </div>
          </div>
          <small
            className={
              lastScheduleAction.startsWith("Cannot assign")
                ? "auth-error personnel-schedule-header-hint"
                : "field-hint personnel-schedule-header-hint"
            }
          >
            Last action: {lastScheduleAction}
          </small>
        </div>
      </header>

      <section
        className={`personnel-schedule-kpi-grid${
          scheduleKpis.kellyRowVisible ? "" : " personnel-schedule-kpi-grid--three"
        }`}
        aria-label="Schedule summary"
      >
        <article className="personnel-schedule-kpi-card personnel-schedule-kpi-open">
          <div>
            <p>Open Seats</p>
            <strong>{scheduleKpis.openSeats}</strong>
          </div>
          <span
            className={`personnel-schedule-kpi-tone ${
              scheduleKpis.openSeats === 0
                ? "personnel-schedule-kpi-tone-warning"
                : "personnel-schedule-kpi-tone-critical"
            }`}
          >
            {scheduleKpis.openSeats === 0 ? "Staffed" : "Open"}
          </span>
        </article>
        <article className="personnel-schedule-kpi-card personnel-schedule-kpi-coverage">
          <div>
            <p>Coverage</p>
            <strong>{scheduleKpis.coveragePercent}%</strong>
          </div>
          <span
            className={`personnel-schedule-kpi-tone ${
              scheduleKpis.coveragePercent >= 100
                ? "personnel-schedule-kpi-tone-positive"
                : "personnel-schedule-kpi-tone-warning"
            }`}
          >
            {scheduleKpis.coveragePercent >= 100 ? "Good" : "Watch"}
          </span>
        </article>
        {viewerIsAdmin ? (
          <button
            type="button"
            className="personnel-schedule-kpi-card personnel-schedule-kpi-override personnel-schedule-kpi-card-action"
            onClick={() => navigate("/personnel/trades#active-requests")}
          >
            <div>
              <p>Pending Overrides</p>
              <strong>{scheduleKpis.pendingOverrideCount}</strong>
            </div>
            <span
              className={`personnel-schedule-kpi-tone ${
                scheduleKpis.pendingOverrideCount === 0
                  ? "personnel-schedule-kpi-tone-critical"
                  : "personnel-schedule-kpi-tone-warning"
              }`}
            >
              {scheduleKpis.pendingOverrideCount === 0 ? "None" : "Review"}
            </span>
          </button>
        ) : (
          <article className="personnel-schedule-kpi-card personnel-schedule-kpi-override">
            <div>
              <p>Pending Overrides</p>
              <strong>{scheduleKpis.pendingOverrideCount}</strong>
            </div>
            <span
              className={`personnel-schedule-kpi-tone ${
                scheduleKpis.pendingOverrideCount === 0
                  ? "personnel-schedule-kpi-tone-critical"
                  : "personnel-schedule-kpi-tone-warning"
              }`}
            >
              {scheduleKpis.pendingOverrideCount === 0 ? "None" : "Review"}
            </span>
          </article>
        )}
        {scheduleKpis.kellyRowVisible ? (
          <article className="personnel-schedule-kpi-card">
            <div>
              <p>On Kelly Day</p>
              <strong>{scheduleKpis.kellyOn}</strong>
            </div>
            <span className="personnel-schedule-kpi-tone personnel-schedule-kpi-tone-neutral">
              In view
            </span>
          </article>
        ) : null}
      </section>

      <div className="personnel-schedule-grid-wrapper">
        <table className="personnel-schedule-grid">
          <thead>
            <tr className="personnel-schedule-header-row-dates">
              <th className="personnel-schedule-col-day" aria-hidden="true" />
              {displayDates.map((d) => {
                const isToday = toDateKey(d) === toDateKey(new Date());
                return (
                  <th
                    key={d.toISOString()}
                    className="personnel-schedule-date-col"
                    role="button"
                    tabIndex={0}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={d.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                    onClick={() => {
                      if (!canEditSchedule) return;
                      setEditDayBlock({ date: d, dateKey: toDateKey(d) });
                    }}
                    onKeyDown={(e) => {
                      if (!canEditSchedule) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setEditDayBlock({ date: d, dateKey: toDateKey(d) });
                      }
                    }}
                  >
                    <div
                      className={`personnel-schedule-date-chip${
                        isToday ? " personnel-schedule-date-chip-today" : ""
                      }`}
                    >
                      <span className="personnel-schedule-date-chip-label">
                        {`${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.toLocaleDateString("en-US", { month: "short" })} ${d.getDate()}`}
                        <sup className="personnel-schedule-date-chip-ordinal">
                          {dayOrdinalSuffix(d.getDate())}
                        </sup>
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {scheduleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={(displayDates.length + 1) as number}
                  className="personnel-schedule-empty"
                >
                  No apparatus. Add them in Admin Functions → Department Details.
                </td>
              </tr>
            ) : (
              scheduleRows.map((row) => {
                const rowLabelTone = getScheduleRowLabelTone(row);
                const customLabelColor =
                  row.rowType === "apparatus"
                    ? qualificationColorSoftStyle(parseScheduleRowColor(row.scheduleLabelColor))
                    : undefined;
                return (
                <tr
                  key={row.id}
                  className={
                    row.rowType === "support"
                      ? `personnel-schedule-support-row${
                          row.id === "support-info"
                            ? " personnel-schedule-support-start"
                            : ""
                        }`
                      : "personnel-schedule-apparatus-row"
                  }
                >
                  <td
                    className={`personnel-schedule-row-label${
                      customLabelColor ? "" : ` personnel-schedule-row-label--${rowLabelTone}`
                    }`}
                  >
                    <span
                      className="personnel-schedule-row-label-pill"
                      style={
                        customLabelColor
                          ? {
                              backgroundColor: customLabelColor.backgroundColor,
                              color: customLabelColor.color,
                            }
                          : undefined
                      }
                    >
                      <span className="personnel-schedule-row-label-icon">
                        <ScheduleRowLabelIconForTone tone={rowLabelTone} />
                      </span>
                      <span className="personnel-schedule-row-label-text">{row.label}</span>
                    </span>
                  </td>
                  {displayDates.map((date) => {
                    const dateKey = toDateKey(date);
                    const slots = getAssignmentsForDay(
                      dateKey,
                      row.unitId,
                      row.rowType === "support" ? (row.maximumRows ?? row.slotCount) : row.slotCount,
                      row.rowType === "support",
                      row.rowType !== "support",
                    );
                    const assignedNames = slots.filter((name) => name.trim().length > 0);
                    const displaySlots =
                      row.rowType === "support"
                        ? (() => {
                            const count = visibleAdditionalRowCount(
                              slots,
                              row.rowsVisible ?? 1,
                              row.maximumRows ?? row.slotCount,
                            );
                            const next = slots.slice(0, count);
                            while (next.length < count) next.push("");
                            return next;
                          })()
                        : row.rowType === "apparatus"
                        ? (() => {
                            // Keep explicit slot order so reserved/min slots can remain empty when unmet.
                            const visibleSlotCount = Math.max(
                              row.minimumPersonnel,
                              assignedNames.length,
                            );
                            const orderedSlots = [...slots];
                            while (orderedSlots.length < visibleSlotCount) orderedSlots.push("");
                            return orderedSlots.slice(0, visibleSlotCount);
                          })()
                        : slots;
                    const effectiveSlotsForQual =
                      row.rowType === "apparatus" && row.minimumPersonnel > 0
                        ? slots.map((slotVal, slotIdx) => {
                            if (
                              slotIdx < row.minimumPersonnel &&
                              isOvertimeEnabledForSlot(dateKey, row.unitId, slotIdx)
                            ) {
                              const segs = getSegmentsForSlot(
                                dateKey,
                                row.unitId,
                                slotIdx,
                              ).filter(
                                (s) =>
                                  s.source !== "auto_hire" &&
                                  s.personnelName.trim() &&
                                  s.personnelName !== "HIRE",
                              );
                              if (segs.length > 0) {
                                return serializeAssignedNames(
                                  segs.map((s) => s.personnelName.trim()),
                                );
                              }
                            }
                            return slotVal;
                          })
                        : slots;
                    const blockHasQualificationGap =
                      row.rowType === "apparatus" &&
                      row.minimumPersonnel > 0 &&
                      !requirementsSatisfiedByAssignedPersonnel(
                        row.requiredQualifications.slice(0, row.minimumPersonnel),
                        effectiveSlotsForQual.slice(0, row.minimumPersonnel),
                        personnelByName,
                        qualificationRankMap,
                      );
                    const coverageLines = getCoverageLines(dateKey, row.id);
                    const isTodayColumn = dateKey === toDateKey(new Date());
                    const isFocusedSeat = Boolean(
                      focusDateKey &&
                        focusUnit &&
                        dateKey === focusDateKey &&
                        row.unitId === focusUnit,
                    );
                    return (
                      <td
                        key={date.toISOString()}
                        data-schedule-focus={isFocusedSeat ? "1" : undefined}
                        className={`personnel-schedule-day-block${
                          isTodayColumn ? " personnel-schedule-day-block-today" : ""
                        }${
                          blockHasQualificationGap
                            ? " personnel-schedule-day-block-invalid"
                            : ""
                        }${isFocusedSeat ? " personnel-schedule-day-block-focus" : ""}`}
                        onDoubleClick={() => {
                          if (!canEditSchedule) return;
                          setEditDayBlock({ date, dateKey });
                        }}
                      >
                        {(row.id === "support-info" || row.id === "support-trade") &&
                        coverageLines.length > 0 ? (
                          <div className="personnel-schedule-coverage-info">
                            {coverageLines.map((line) => (
                              <div
                                key={`${line.personnelName}-${line.text}-${line.overtime ? "ot" : "shift"}`}
                                className={
                                  line.overtime ? "personnel-schedule-overtime-name" : undefined
                                }
                                style={
                                  line.overtime
                                    ? undefined
                                    : { color: colorForPersonnelName(line.personnelName) }
                                }
                              >
                                {line.text}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="personnel-schedule-slots">
                          {displaySlots.map((name, slotIdx) => {
                            const storedSegments = getSegmentsForSlot(
                              dateKey,
                              row.unitId,
                              slotIdx,
                            );
                            const segmentModeEnabled =
                              ((row.rowType === "apparatus" &&
                                slotIdx < row.minimumPersonnel) ||
                                (row.rowType === "support" &&
                                  row.supportValueMode === "personnel" &&
                                  Boolean(row.supportSegmentedMode))) &&
                              isOvertimeEnabledForSlot(dateKey, row.unitId, slotIdx);
                            const shouldShowFallbackHire =
                              !segmentModeEnabled &&
                              row.rowType === "apparatus" &&
                              slotIdx < row.minimumPersonnel &&
                              name.trim().length === 0 &&
                              isAllShiftPersonnelAssignedOnDay(dateKey);
                            const shouldShowDynamicHire =
                              segmentModeEnabled &&
                              row.rowType === "apparatus" &&
                              slotIdx < row.minimumPersonnel;
                            const displaySegmentsForUi: ScheduleSegment[] = shouldShowDynamicHire
                              ? withDynamicHireSegments(storedSegments)
                              : segmentModeEnabled
                                ? storedSegments.filter((segment) => segment.source !== "auto_hire")
                                : [];
                            const slotNames =
                              displaySegmentsForUi.length > 0
                                ? displaySegmentsForUi.map((segment) => segment.personnelName)
                                : segmentModeEnabled
                                  ? getSegmentsForSlot(dateKey, row.unitId, slotIdx)
                                      .filter((segment) => segment.source !== "auto_hire")
                                      .map((segment) => segment.personnelName)
                                      .filter((value) => value.trim().length > 0)
                                  : shouldShowFallbackHire
                                    ? Array.from(
                                        {
                                          length: Math.max(1, overtimeSplitCount),
                                        },
                                        () => "HIRE",
                                      )
                                  : parseAssignedNames(name);
                            const pendingPartialNames = pendingOverrides
                              .filter(
                                (item) =>
                                  item.status === "pending" &&
                                  item.requiredQualification.startsWith(PARTIAL_SHIFT) &&
                                  item.dateKey === dateKey &&
                                  item.unitId === row.unitId &&
                                  item.slotIndex === slotIdx,
                              )
                              .map((item) => item.personName.trim())
                              .filter(
                                (personName) =>
                                  personName &&
                                  !slotNames.some((entry) => entry.trim().toLowerCase() === personName.toLowerCase()),
                              );
                            const shownSlotNames = [...slotNames, ...pendingPartialNames];
                            const isRequired = slotIdx < row.minimumPersonnel;
                            const hasSegmentPersonnel =
                              segmentModeEnabled &&
                              storedSegments.some(
                                (s) =>
                                  s.source !== "auto_hire" &&
                                  s.personnelName.trim() &&
                                  s.personnelName !== "HIRE",
                              );
                            const isEmpty =
                              isRequired &&
                              !name.trim() &&
                              pendingPartialNames.length === 0 &&
                              (!segmentModeEnabled || !hasSegmentPersonnel);
                            const isRed = isRequired && isEmpty;
                            const requiredQualification = isRequired
                              ? row.requiredQualifications[slotIdx]?.trim() ?? ""
                              : "";
                            const requiredRank = requiredQualification
                              ? (qualificationRankMap.get(requiredQualification) ??
                                Number.POSITIVE_INFINITY)
                              : Number.POSITIVE_INFINITY;
                            const targetSlotOvertimeEnabled =
                              row.rowType === "apparatus" &&
                              slotIdx < row.minimumPersonnel &&
                              isOvertimeEnabledForSlot(dateKey, row.unitId, slotIdx);
                            const unqualifiedNames = new Set<string>();
                            const isRequiredInvalid =
                              isRequired &&
                              requiredQualification.length > 0 &&
                              (() => {
                                if (row.rowType !== "apparatus" || !segmentModeEnabled) {
                                  const fails = slotNames.some((slotName) => {
                                    if (pendingOverrides.some(
                                      (item) =>
                                        item.status === "approved" &&
                                        isHeldQualification(item.requiredQualification) &&
                                        item.dateKey === dateKey &&
                                        item.unitId === row.unitId &&
                                        item.slotIndex === slotIdx &&
                                        item.personName.trim() === slotName.trim(),
                                    )) {
                                      return false;
                                    }
                                    const person = personnelByName.get(slotName);
                                    const pr = getBestQualificationRankForPerson(person, qualificationRankMap);
                                    if (!(Number.isFinite(pr) && pr <= requiredRank)) {
                                      unqualifiedNames.add(slotName.trim());
                                      return true;
                                    }
                                    return false;
                                  });
                                  return fails && !targetSlotOvertimeEnabled;
                                }
                                const segs = storedSegments.filter((s) => s.source !== "auto_hire");
                                if (segs.length === 0) return false;
                                let failed = false;
                                for (const seg of segs) {
                                  if (!seg.personnelName.trim() || seg.personnelName === "HIRE") {
                                    continue;
                                  }
                                  if (seg.overtime) continue;
                                  if (
                                    pendingOverrides.some(
                                      (item) =>
                                        item.status === "approved" &&
                                        isHeldQualification(item.requiredQualification) &&
                                        item.dateKey === dateKey &&
                                        item.unitId === row.unitId &&
                                        item.slotIndex === slotIdx &&
                                        item.personName.trim() === seg.personnelName.trim(),
                                    )
                                  ) {
                                    continue;
                                  }
                                  const person = personnelByName.get(seg.personnelName);
                                  const pr = getBestQualificationRankForPerson(
                                    person,
                                    qualificationRankMap,
                                  );
                                  if (!(Number.isFinite(pr) && pr <= requiredRank)) {
                                    unqualifiedNames.add(seg.personnelName.trim());
                                    failed = true;
                                  }
                                }
                                return failed;
                              })();
                            const isTextRow =
                              row.rowType === "support" &&
                              row.supportValueMode === "text";
                            const isActiveInlineSelect =
                              activeInlineSlot?.dateKey === dateKey &&
                              activeInlineSlot?.unitId === row.unitId &&
                              activeInlineSlot?.slotIndex === slotIdx;
                            const isHighlighted =
                              Boolean(highlightPersonnelName) &&
                              slotNames.includes(highlightPersonnelName);
                            const fillPersonName = shownSlotNames.find((entry) => {
                              const normalized = entry.trim().toUpperCase();
                              return (
                                normalized.length > 0 &&
                                normalized !== "HIRE" &&
                                normalized !== "OPEN" &&
                                !unqualifiedNames.has(entry.trim())
                              );
                            });
                            const leaveRowOverridesPersonColor =
                              row.rowType === "support" && rowLabelTone === "sick";
                            const isSplitSeatDisplay = displaySegmentsForUi.length > 1;
                            const softPillStyle =
                              !isTextRow &&
                              !isSplitSeatDisplay &&
                              !isActiveInlineSelect &&
                              !isRed &&
                              !isHighlighted &&
                              !isRequiredInvalid &&
                              fillPersonName
                                ? leaveRowOverridesPersonColor
                                  ? {
                                      backgroundColor: "#fee2e2",
                                      borderColor: "#fecaca",
                                      color: "#991b1b",
                                    }
                                  : softStyleForPersonnelName(fillPersonName)
                                : undefined;
                            const eligiblePeople = getEligibleShiftPersonnelForSlot(
                              dateKey,
                              row,
                              slotIdx,
                              name,
                            );
                            return (
                              <div
                                key={slotIdx}
                                className={`personnel-schedule-slot${
                                  isTextRow ? " personnel-schedule-slot-text" : ""
                                }${
                                  isSplitSeatDisplay ? " personnel-schedule-slot-split" : ""
                                }${
                                  isRed
                                    ? " personnel-schedule-slot-required-empty"
                                    : ""
                                }${
                                  isHighlighted
                                    ? " personnel-schedule-slot-highlighted"
                                    : ""
                                }${
                                  isRequiredInvalid
                                    ? " personnel-schedule-slot-required-invalid"
                                    : ""
                                }${
                                  leaveRowOverridesPersonColor && softPillStyle
                                    ? " personnel-schedule-slot-leave-red"
                                    : ""
                                }`}
                                style={softPillStyle}
                                onClick={(event) => {
                                  if (isTextRow) return;
                                  event.stopPropagation();
                                  const heldPartial = pendingOverrides.find(
                                    (item) =>
                                      item.status === "pending" &&
                                      item.requiredQualification.startsWith(PARTIAL_SHIFT) &&
                                      item.dateKey === dateKey &&
                                      item.unitId === row.unitId &&
                                      item.slotIndex === slotIdx,
                                  );
                                  if (heldPartial) {
                                    openScheduleNotice(
                                      `${heldPartial.personName} has a partial shift waiting for approval on this seat.`,
                                    );
                                    return;
                                  }
                                  if (limitedScheduleEditor) {
                                    const occupied = slotNames
                                      .map((entry) => entry.trim())
                                      .filter((entry) => entry && entry.toUpperCase() !== "HIRE" && entry.toUpperCase() !== "OPEN");
                                    if (row.rowType === "apparatus" && occupied.length === 0) {
                                      const held = pendingOverrides.find(
                                        (item) =>
                                          item.status === "pending" &&
                                          item.requiredQualification.startsWith(PARTIAL_SHIFT) &&
                                          item.dateKey === dateKey &&
                                          item.unitId === row.unitId &&
                                          item.slotIndex === slotIdx,
                                      );
                                      if (held) {
                                        openScheduleNotice(
                                          `${held.personName} has a partial shift waiting for approval on this seat.`,
                                        );
                                        return;
                                      }
                                      openSelfFill(dateKey, row.unitId, slotIdx, row.label);
                                      return;
                                    }
                                    const self = viewerName.trim().toLowerCase();
                                    if (occupied.length === 1 && occupied[0]?.toLowerCase() === self) {
                                      clearSlotValue(dateKey, row.unitId, slotIdx);
                                      return;
                                    }
                                    if (
                                      isSplitSeatDisplay &&
                                      self &&
                                      occupied.some((entryName) => entryName.toLowerCase() === self)
                                    ) {
                                      promptSelfCancellation(dateKey, row.unitId, slotIdx);
                                      return;
                                    }
                                    openScheduleNotice("You can only add yourself to an open seat.");
                                    return;
                                  }
                                  setActiveInlineSlot({
                                    dateKey,
                                    unitId: row.unitId,
                                    slotIndex: slotIdx,
                                  });
                                }}
                              >
                                {isTextRow ? (
                                  <input
                                    type="text"
                                    maxLength={25}
                                    value={name}
                                    className="personnel-schedule-info-input"
                                    placeholder="Type info..."
                                    readOnly={!canEditSchedule}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) =>
                                      updateTextSlotValue(
                                        dateKey,
                                        row.unitId,
                                        slotIdx,
                                        event.target.value,
                                      )
                                    }
                                    onBlur={() => revealNextSupportRow(dateKey, row.unitId)}
                                    onKeyDown={(event) => {
                                      if (event.key !== "Enter") return;
                                      event.preventDefault();
                                      revealNextSupportRow(dateKey, row.unitId);
                                    }}
                                  />
                                ) : isActiveInlineSelect ? (
                                  <select
                                    className="personnel-schedule-inline-select"
                                    autoFocus
                                    value={name}
                                    onClick={(event) => event.stopPropagation()}
                                    onBlur={() => setActiveInlineSlot(null)}
                                    onChange={(event) => {
                                      const nextName = event.target.value;
                                      if (!nextName) {
                                        if (name.trim()) {
                                          clearSlotValue(dateKey, row.unitId, slotIdx);
                                        }
                                      } else {
                                        assignPersonToSlot(
                                          dateKey,
                                          row.unitId,
                                          slotIdx,
                                          nextName,
                                        );
                                      }
                                      setActiveInlineSlot(null);
                                    }}
                                  >
                                    <option value="">Select personnel</option>
                                    {eligiblePeople.map((person) => (
                                      <option key={person.name} value={person.name}>
                                        {person.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : shownSlotNames.length > 0 ? (
                                  <span
                                    className={
                                      isSplitSeatDisplay
                                        ? "personnel-schedule-split-row"
                                        : "personnel-schedule-slot-name-list"
                                    }
                                  >
                                    {(displaySegmentsForUi.length > 0
                                      ? displaySegmentsForUi
                                      : shownSlotNames.map((n) => ({
                                          id: `legacy-${n}`,
                                          assigneeType: "personnel" as const,
                                          personnelName: n,
                                          startMinutes: 0,
                                          endMinutes: 0,
                                          source: "manual" as const,
                                          overtime: false,
                                        }))
                                    ).map((seg, nameIndex) => {
                                      const entry = seg.personnelName;
                                      const person = personnelByName.get(entry);
                                      const overtimeChecked = Boolean(seg.overtime);
                                      const normalizedEntry = entry.trim().toUpperCase();
                                      const isUnfilledSegment =
                                        normalizedEntry.length === 0 ||
                                        normalizedEntry === "HIRE" ||
                                        normalizedEntry === "OPEN" ||
                                        seg.assigneeType === "hire" ||
                                        seg.source === "auto_hire";
                                      const isOffShiftInOtSlot =
                                        row.rowType === "apparatus" &&
                                        overtimeChecked &&
                                        !isUnfilledSegment &&
                                        person !== undefined &&
                                        !personnelMatchesShift(person, effectiveShift);
                                      const isPendingSeat = pendingOverrides.some(
                                        (item) =>
                                          item.status === "pending" &&
                                          isHeldQualification(item.requiredQualification) &&
                                          item.dateKey === dateKey &&
                                          item.unitId === row.unitId &&
                                          item.slotIndex === slotIdx &&
                                          item.personName.trim() === entry.trim(),
                                      );
                                      const isCancelPending = pendingOverrides.some(
                                        (item) =>
                                          item.status === "pending" &&
                                          item.requiredQualification === SEAT_REMOVAL &&
                                          item.dateKey === dateKey &&
                                          item.unitId === row.unitId &&
                                          item.slotIndex === slotIdx &&
                                          item.personName.trim() === entry.trim(),
                                      );
                                      const isPartialPending = pendingOverrides.some(
                                        (item) =>
                                          item.status === "pending" &&
                                          item.requiredQualification.startsWith(PARTIAL_SHIFT) &&
                                          item.dateKey === dateKey &&
                                          item.unitId === row.unitId &&
                                          item.slotIndex === slotIdx &&
                                          item.personName.trim() === entry.trim(),
                                      );
                                      const shownName = isUnfilledSegment
                                        ? overtimeChecked
                                          ? "HIRE"
                                          : "OPEN"
                                        : isSplitSeatDisplay
                                          ? formatSchedulePersonnelDisplayName(entry)
                                          : slotNames.length > 1
                                            ? formatScheduleSegmentToken(entry)
                                            : formatSchedulePersonnelDisplayName(entry);
                                      const timeLabel =
                                        isSplitSeatDisplay && seg.endMinutes > seg.startMinutes
                                          ? `${minutesToTimeValue(seg.startMinutes)}–${minutesToTimeValue(seg.endMinutes)}`
                                          : "";
                                      const statusSuffix =
                                        isPendingSeat || isPartialPending
                                          ? " (Pending)"
                                          : isCancelPending
                                            ? " (Cancel pending)"
                                            : "";
                                      const isUnqualified = unqualifiedNames.has(entry.trim());
                                      const openBlockHasSomeoneElse = displaySegmentsForUi.some((other) => {
                                        const otherName = other.personnelName.trim();
                                        return (
                                          otherName.length > 0 &&
                                          !isOpenOrHireToken(otherName) &&
                                          other.assigneeType !== "hire" &&
                                          other.source !== "auto_hire"
                                        );
                                      });
                                      const canClaimOpenBlock =
                                        limitedScheduleEditor &&
                                        isUnfilledSegment &&
                                        !overtimeChecked &&
                                        seg.endMinutes > seg.startMinutes &&
                                        openBlockHasSomeoneElse;
                                      const segmentSoftStyle =
                                        isSplitSeatDisplay &&
                                        !isUnfilledSegment &&
                                        !isUnqualified &&
                                        !isHighlighted &&
                                        !isRequiredInvalid
                                          ? leaveRowOverridesPersonColor
                                            ? {
                                                backgroundColor: "#fee2e2",
                                                borderColor: "#fecaca",
                                                color: "#991b1b",
                                              }
                                            : softStyleForPersonnelName(entry)
                                          : undefined;
                                      if (isSplitSeatDisplay) {
                                        const splitClassName = [
                                          "personnel-schedule-segment-pill",
                                          isUnfilledSegment && overtimeChecked
                                            ? "personnel-schedule-segment-pill-hire"
                                            : "",
                                          isUnfilledSegment && !overtimeChecked
                                            ? "personnel-schedule-segment-pill-open"
                                            : "",
                                          isUnqualified ? "personnel-schedule-segment-pill-unqualified" : "",
                                          isOffShiftInOtSlot ? "personnel-schedule-segment-pill-off-shift" : "",
                                          canClaimOpenBlock ? "personnel-schedule-segment-pill-claim" : "",
                                        ]
                                          .filter(Boolean)
                                          .join(" ");
                                        const splitBody = (
                                          <>
                                            <span className="personnel-schedule-segment-pill-name">
                                              {`${shownName}${statusSuffix}`}
                                            </span>
                                            {timeLabel ? (
                                              <span className="personnel-schedule-segment-pill-time">
                                                {timeLabel}
                                              </span>
                                            ) : null}
                                          </>
                                        );
                                        const selfName = viewerName.trim().toLowerCase();
                                        const isOwnSegment =
                                          !isUnfilledSegment &&
                                          selfName.length > 0 &&
                                          entry.trim().toLowerCase() === selfName;
                                        return canClaimOpenBlock ? (
                                          <button
                                            type="button"
                                            key={`${entry}-${nameIndex}-${seg.id ?? nameIndex}`}
                                            className={splitClassName}
                                            style={segmentSoftStyle}
                                            title="Add yourself to this open time"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              claimOpenTimeBlock(
                                                dateKey,
                                                row.unitId,
                                                slotIdx,
                                                seg.startMinutes,
                                                seg.endMinutes,
                                              );
                                            }}
                                          >
                                            {splitBody}
                                          </button>
                                        ) : (
                                          <span
                                            key={`${entry}-${nameIndex}-${seg.id ?? nameIndex}`}
                                            className={`${splitClassName}${
                                              limitedScheduleEditor && isOwnSegment
                                                ? " personnel-schedule-segment-pill-self"
                                                : ""
                                            }`}
                                            style={segmentSoftStyle}
                                            onClick={
                                              limitedScheduleEditor && !isUnfilledSegment
                                                ? (event) => {
                                                    event.stopPropagation();
                                                    if (isOwnSegment) {
                                                      promptSelfCancellation(
                                                        dateKey,
                                                        row.unitId,
                                                        slotIdx,
                                                      );
                                                      return;
                                                    }
                                                    openScheduleNotice(
                                                      "You cannot remove someone else from the schedule.",
                                                    );
                                                  }
                                                : undefined
                                            }
                                          >
                                            {splitBody}
                                          </span>
                                        );
                                      }
                                      return canClaimOpenBlock ? (
                                        <button
                                          type="button"
                                          key={`${entry}-${nameIndex}-${seg.id ?? nameIndex}`}
                                          className="personnel-schedule-open-token personnel-schedule-open-token-claim"
                                          title="Add yourself to this open time"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            claimOpenTimeBlock(
                                              dateKey,
                                              row.unitId,
                                              slotIdx,
                                              seg.startMinutes,
                                              seg.endMinutes,
                                            );
                                          }}
                                        >
                                          {shownName}
                                          {nameIndex < slotNames.length - 1 ? " / " : ""}
                                        </button>
                                      ) : (
                                        <span
                                          key={`${entry}-${nameIndex}-${seg.id ?? nameIndex}`}
                                          className={
                                            isUnfilledSegment && overtimeChecked
                                              ? "personnel-schedule-hire-token"
                                              : isUnfilledSegment
                                                ? "personnel-schedule-open-token"
                                                : isUnqualified
                                                  ? "personnel-schedule-slot-name-unqualified"
                                                  : isOffShiftInOtSlot
                                                    ? "personnel-schedule-slot-name-off-shift"
                                                    : undefined
                                          }
                                          style={
                                            softPillStyle
                                              ? undefined
                                              : !isUnfilledSegment &&
                                                  !isUnqualified &&
                                                  colorForPersonnelName(entry)
                                                ? { color: colorForPersonnelName(entry) }
                                                : undefined
                                          }
                                        >
                                          {`${shownName}${statusSuffix}`}
                                          {nameIndex < slotNames.length - 1 ? " / " : ""}
                                        </span>
                                      );
                                    })}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editDayBlock ? (
        <PersonnelScheduleDayBlockModal
          date={editDayBlock.date}
          dateKey={editDayBlock.dateKey}
          scheduleRows={scheduleRows}
          shiftPersonnel={shiftPersonnel}
          effectiveShift={effectiveShift}
          getAssignmentsForDay={getAssignmentsForDay}
          assignPersonToSlot={assignPersonToSlot}
          clearSlotValue={clearSlotValue}
          canChangeSegments={!limitedScheduleEditor}
          selfFillOnly={limitedScheduleEditor}
          pendingHolds={pendingOverrides
            .filter(
              (item) =>
                item.status === "pending" &&
                item.requiredQualification.startsWith(PARTIAL_SHIFT) &&
                item.dateKey === editDayBlock.dateKey,
            )
            .map((item) => ({
              unitId: item.unitId,
              slotIndex: item.slotIndex,
              personName: item.personName,
            }))}
          onOpenSelfFill={(unitId, slotIndex) => {
            const held = pendingOverrides.find(
              (item) =>
                item.status === "pending" &&
                item.requiredQualification.startsWith(PARTIAL_SHIFT) &&
                item.dateKey === editDayBlock.dateKey &&
                item.unitId === unitId &&
                item.slotIndex === slotIndex,
            );
            if (held) {
              openScheduleNotice(`${held.personName} has a partial shift waiting for approval on this seat.`);
              return;
            }
            const row = scheduleRows.find((entry) => entry.unitId === unitId);
            openSelfFill(editDayBlock.dateKey, unitId, slotIndex, row?.label ?? unitId);
          }}
          updateTextSlotValue={updateTextSlotValue}
          revealNextSupportRow={revealNextSupportRow}
          getCoverageLines={getCoverageLines}
          importAssignmentsForDay={importAssignmentsForDay}
          assignedOnDay={assignedOnDay}
          isOvertimeEnabledForSlot={isOvertimeEnabledForSlot}
          toggleOvertimeForSlot={toggleOvertimeForSlot}
          overtimeSplitCount={overtimeSplitCount}
          allowScheduledOvertime={departmentData.allowScheduledOvertime}
          lastScheduleAction={lastScheduleAction}
          onUndo={undoLastScheduleChange}
          canUndo={scheduleUndoStack.length > 0}
          allPersonnel={departmentData.personnel}
          overtimeRosterPersonnel={overtimeRosterPersonnel}
          personnelQualificationOrder={departmentData.personnelQualifications}
          personnelQualificationColors={departmentData.personnelQualificationColors}
          sortPersonnel={comparePersonnelByQualifications}
          getHighestQualificationLabel={getHighestQualificationLabel}
          shiftWindowStartMinutes={shiftWindowStartMinutes}
          shiftWindowEndMinutes={shiftWindowEndMinutes}
          getSegmentsForSlot={getSegmentsForSlot}
          setSegmentsForSlot={setSegmentsForSlot}
          assertApparatusTimeOverlap={assertApparatusTimeOverlap}
          apparatusOverrideBlockMessage={apparatusOverrideBlockMessage}
          apparatusSeatQualificationMessage={apparatusSeatQualificationMessage}
          onScheduleNotice={(message, blocked) =>
            openScheduleNotice(
              message,
              blocked ? { ...blocked, dateKey: editDayBlock.dateKey } : null,
            )
          }
          collapseSegmentModeToSingleSlot={collapseSegmentModeToSingleSlot}
          onClose={() => {
            normalizeDayAssignmentsForRequirements(editDayBlock.dateKey);
            setEditDayBlock(null);
          }}
        />
      ) : null}
      {selfFill ? (
        <div className="schedule-notice-backdrop" role="dialog" aria-modal="true" aria-labelledby="self-fill-title">
          <div className="schedule-notice">
            <p id="self-fill-title">
              {`Add yourself to ${selfFill.apparatus} on ${selfFill.dateKey}.`}
            </p>
            <label className="additional-field-check">
              <input
                type="checkbox"
                checked={selfFillMode === "full"}
                onChange={() => setSelfFillMode((current) => (current === "full" ? "" : "full"))}
              />
              Fill entire shift
            </label>
            {departmentData.allowPartialShift ? (
              <label className="additional-field-check">
                <input
                  type="checkbox"
                  checked={selfFillMode === "partial"}
                  onChange={() => setSelfFillMode((current) => (current === "partial" ? "" : "partial"))}
                />
                Take partial shift
              </label>
            ) : null}
            {selfFillMode === "partial" ? (
              <div className="self-fill-times">
                <label>
                  Start
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0900"
                    maxLength={4}
                    value={selfFillStart}
                    onChange={(event) => setSelfFillStart(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </label>
                <label>
                  End
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="2000"
                    maxLength={4}
                    value={selfFillEnd}
                    onChange={(event) => setSelfFillEnd(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </label>
              </div>
            ) : null}
            <div className="schedule-notice-actions">
              {selfFillMode === "partial" ? (
                <button
                  type="button"
                  className="primary-button compact-button"
                  disabled={!militaryRangeReady(selfFillStart, selfFillEnd)}
                  onClick={() =>
                    void requestPartialShift(
                      selfFill.dateKey,
                      selfFill.unitId,
                      selfFill.slotIndex,
                      militaryToClock(selfFillStart) ?? "",
                      militaryToClock(selfFillEnd) ?? "",
                    )
                  }
                >
                  Send to admin for approval
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button compact-button"
                  disabled={selfFillMode !== "full"}
                  onClick={() => {
                    const personName = viewerName.trim();
                    const target = selfFill;
                    setSelfFill(null);
                    if (!personName) return;
                    assignPersonToSlot(target.dateKey, target.unitId, target.slotIndex, personName);
                  }}
                >
                  Save
                </button>
              )}
              <button type="button" className="secondary-button compact-button" onClick={() => setSelfFill(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ScheduleNoticeDialog
        message={scheduleNotice}
        actionLabel={noticeAction?.label ?? null}
        onAction={noticeAction?.run}
        onClose={() => {
          setNoticeAction(null);
          setScheduleNotice(null);
        }}
      />
    </section>
  );
}
