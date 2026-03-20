import { useCallback, useEffect, useMemo, useState } from "react";
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
  formatSchedulePersonnelDisplayName,
  formatScheduleSegmentToken,
  getBestQualificationRankForPerson,
  getDatesForMonth,
  getHighestQualificationLabel,
  getRecurrenceIntervalDays,
  getShiftStartOffsetDays,
  reorderAssignedByRequirementCoverage,
  requirementsSatisfiedByAssignedPersonnel,
  toDateKey,
} from "./scheduleUtils";
import { PersonnelScheduleDayBlockModal } from "./PersonnelScheduleDayBlockModal";

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
  const [viewDate, setViewDate] = useState(() => new Date());
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
              ? (d.shiftInformationEntries as PersonnelScheduleData["shiftEntries"])
              : [];
            setDepartmentData({
              stations,
              apparatus,
              additionalFields,
              standardOvertimeSlot,
              personnel,
              personnelQualifications,
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
    const timeout = window.setTimeout(() => {
      fetch("/api/schedule-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: scheduleAssignments,
          overtimeSplit: scheduleOvertimeSplit,
          slotSegments: scheduleSlotSegments,
        }),
      }).catch(() => {
        // Keep local fallback persistence if network sync fails.
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [scheduleAssignments, scheduleOvertimeSplit, scheduleSlotSegments, hasLoadedRemoteSchedule]);

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
      });
    });

    departmentData.additionalFields.forEach((row, index) => {
      const unitId = String(row.id ?? "").trim() || `support-custom-${index + 1}`;
      rows.push({
        id: unitId,
        label: row.fieldName,
        rowType: "support",
        unitId,
        unitType: "SUPPORT",
        slotCount: row.numberOfSlots,
        minimumPersonnel: 0,
        requiredQualifications: [],
        supportValueMode: row.valueMode,
        personnelOverride: row.valueMode === "personnel" ? row.personnelOverride : false,
      });
    });

    return rows;
  }, [departmentData.apparatus, departmentData.additionalFields]);

  const dates = useMemo(
    () => getDatesForMonth(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate],
  );

  const activeDateKeys = useMemo(() => {
    const set = new Set<string>();
    const intervalDays = getRecurrenceIntervalDays(effectiveShiftEntry);
    const shiftOffset = getShiftStartOffsetDays(effectiveShift);
    const anchorUtc = Date.UTC(2026, 0, 1 + shiftOffset);
    dates.forEach((date) => {
      if (intervalDays <= 1) {
        set.add(toDateKey(date));
        return;
      }
      const dateUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
      const dayDiff = Math.floor((dateUtc - anchorUtc) / (24 * 60 * 60 * 1000));
      if (dayDiff >= 0 && dayDiff % intervalDays === 0) {
        set.add(toDateKey(date));
      }
    });
    return set;
  }, [dates, effectiveShift, effectiveShiftEntry]);

  const shiftPersonnel = useMemo(
    () => departmentData.personnel.filter((p) => personnelMatchesShift(p, effectiveShift)),
    [departmentData.personnel, effectiveShift],
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
  const displayDates = useMemo(
    () => dates.filter((date) => activeDateKeys.has(toDateKey(date))),
    [dates, activeDateKeys],
  );
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
        const recurrenceDays = Math.max(
          1,
          getRecurrenceIntervalDays(effectiveShiftEntry),
        );
        const isRotationDay =
          rotation.repeatsEveryUnit === "Days"
            ? dayDiff % interval === 0
            : dayDiff % (interval * recurrenceDays) === 0;
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
    (dateKey: string, unitId: string, slotCount: number): string[] => {
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
      while (result.length < slotCount) result.push("");
      return result.slice(0, slotCount);
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
      pushUndoSnapshot("Toggle overtime split");
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
      } else {
        const existingSegments = getSegmentsForSlot(dateKey, unitId, slotIndex).filter(
          (segment) => segment.source !== "auto_hire",
        );
        if (existingSegments.length === 0) {
          const segmentCount = Math.max(1, overtimeSplitCount);
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
      }
      setLastScheduleAction("Updated overtime split.");
    },
    [
      effectiveShift,
      getSegmentsForSlot,
      overtimeSplitCount,
      scheduleOvertimeSplit,
      shiftWindowEndMinutes,
      shiftWindowStartMinutes,
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
      const manualSegments = sortSegments(
        segments.filter((segment) => segment.assigneeType !== "hire"),
      );
      const effectiveEnd = clampDayMinutes(shiftWindowEndMinutes);
      const effectiveStart = clampDayMinutes(shiftWindowStartMinutes);
      const all: ScheduleSegment[] = [...manualSegments];
      let cursor = effectiveStart;
      manualSegments.forEach((segment, index) => {
        if (segment.startMinutes > cursor) {
          all.push({
            id: `hire-${index}-${cursor}`,
            assigneeType: "hire",
            personnelName: "HIRE",
            startMinutes: cursor,
            endMinutes: segment.startMinutes,
            source: "auto_hire",
          });
        }
        cursor = Math.max(cursor, segment.endMinutes);
      });
      if (cursor < effectiveEnd) {
        all.push({
          id: `hire-end-${cursor}`,
          assigneeType: "hire",
          personnelName: "HIRE",
          startMinutes: cursor,
          endMinutes: effectiveEnd,
          source: "auto_hire",
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

  const assignPersonToSlot = useCallback(
    (dateKey: string, unitId: string, slotIndex: number, personName: string) => {
      pushUndoSnapshot("Assign personnel to slot");
      let blockedAssignmentReason = "";
      const targetRowForMode = scheduleRows.find((row) => row.unitId === unitId);
      const targetSegmentModeEnabled =
        targetRowForMode?.rowType === "apparatus" &&
        slotIndex < (targetRowForMode.minimumPersonnel ?? 0) &&
        isOvertimeEnabledForSlot(dateKey, unitId, slotIndex);
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
                ? row.rowType === "apparatus" || isOverrideSupportPersonnelRow(row)
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
              blockedAssignmentReason = `Cannot assign ${personName}: does not meet required qualification for that OT slot.`;
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
        const withoutDuplicates = existingNames.filter((name) => name !== personName);
        const nextNames = [...withoutDuplicates, personName].slice(0, maxNamesInSlot);
        unitSlots[slotIndex] = serializeAssignedNames(nextNames);
        dayData[unitId] = unitSlots;
        next[storageDateKey] = dayData;
        saveScheduleAssignments(next);
        return next;
      });
      if (blockedAssignmentReason) {
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
    ],
  );

  const clearSlotValue = useCallback(
    (dateKey: string, unitId: string, slotIndex: number) => {
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
          while (ordered.length < row.slotCount) ordered.push("");
          dayData[row.unitId] = ordered.slice(0, row.slotCount);
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

  const importAssignmentsForDay = useCallback(
    (dateKey: string) => {
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

  if (isLoading && departmentData.personnel.length === 0) {
    return (
      <section className="page-section">
        <header className="page-header">
          <h1>Schedule (Personnel)</h1>
          <p>Loading department details…</p>
        </header>
      </section>
    );
  }

  if (!hasExplicitShiftStartTime) {
    return (
      <section className="page-section">
        <header className="page-header">
          <h1>Schedule (Personnel)</h1>
          <p>
            Schedule calculations are blocked until this shift has a Start Time.
            Go to Admin Functions {"->"} Scheduler Settings {"->"} Shift Information and set
            a 24-hour Start Time for <strong>{effectiveShift || "the active shift"}</strong>.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="page-section personnel-schedule-page">
      <header className="page-header">
        <div>
          <div className="personnel-schedule-title-row">
            <h1>Schedule (Personnel)</h1>
            <div className="personnel-schedule-month-nav">
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() =>
                  setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
                }
              >
                ← Prev
              </button>
              <span className="personnel-schedule-month-label">
                {viewDate.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() =>
                  setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))
                }
              >
                Next →
              </button>
            </div>
          </div>
          {isDemoTenant ? (
            <p className="demo-helper-text">
              Double click day column to open day block.
            </p>
          ) : null}
          <div className="personnel-schedule-shift-select">
            <div className="personnel-schedule-controls">
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
              <small
                className={
                  lastScheduleAction.startsWith("Cannot assign")
                    ? "auth-error"
                    : "field-hint"
                }
              >
                Last action: {lastScheduleAction}
              </small>
            </div>
          </div>
        </div>
      </header>

      <div className="personnel-schedule-grid-wrapper">
        <table className="personnel-schedule-grid">
          <thead>
            <tr className="personnel-schedule-header-row-day">
              <th className="personnel-schedule-col-day">DAY</th>
              {displayDates.map((d) => (
                <th
                  key={d.toISOString()}
                  className="personnel-schedule-date-col"
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditDayBlock({ date: d, dateKey: toDateKey(d) })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditDayBlock({ date: d, dateKey: toDateKey(d) });
                    }
                  }}
                >
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                </th>
              ))}
            </tr>
            <tr className="personnel-schedule-header-row-date">
              <th className="personnel-schedule-col-date">DATE</th>
              {displayDates.map((d) => (
                <th
                  key={d.toISOString()}
                  className="personnel-schedule-date-col"
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditDayBlock({ date: d, dateKey: toDateKey(d) })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditDayBlock({ date: d, dateKey: toDateKey(d) });
                    }
                  }}
                >
                  {d.getMonth() + 1}/{d.getDate()}
                </th>
              ))}
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
              scheduleRows.map((row) => (
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
                  <td className="personnel-schedule-row-label">{row.label}</td>
                  {displayDates.map((date) => {
                    const dateKey = toDateKey(date);
                    const slots = getAssignmentsForDay(
                      dateKey,
                      row.unitId,
                      row.slotCount,
                    );
                    const assignedNames = slots.filter((name) => name.trim().length > 0);
                    const displaySlots =
                      row.rowType === "apparatus"
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
                    const blockHasQualificationGap =
                      row.rowType === "apparatus" &&
                      row.minimumPersonnel > 0 &&
                      !requirementsSatisfiedByAssignedPersonnel(
                        row.requiredQualifications.slice(0, row.minimumPersonnel),
                        slots.filter((name) => name.trim()),
                        personnelByName,
                        qualificationRankMap,
                      );
                    return (
                      <td
                        key={date.toISOString()}
                        className={`personnel-schedule-day-block ${
                          blockHasQualificationGap
                            ? "personnel-schedule-day-block-invalid"
                            : ""
                        }`}
                        onDoubleClick={() => setEditDayBlock({ date, dateKey })}
                      >
                        <div className="personnel-schedule-slots">
                          {displaySlots.map((name, slotIdx) => {
                            const storedSegments = getSegmentsForSlot(
                              dateKey,
                              row.unitId,
                              slotIdx,
                            );
                            const segmentModeEnabled =
                              row.rowType === "apparatus" &&
                              slotIdx < row.minimumPersonnel &&
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
                            const displaySegments = shouldShowDynamicHire
                              ? withDynamicHireSegments(storedSegments)
                              : [];
                            const slotNames =
                              displaySegments.length > 0
                                ? displaySegments.map((segment) => segment.personnelName)
                                : shouldShowFallbackHire
                                  ? Array.from(
                                      {
                                        length: Math.max(1, overtimeSplitCount),
                                      },
                                      () => "HIRE",
                                    )
                                : parseAssignedNames(name);
                            const isRequired = slotIdx < row.minimumPersonnel;
                            const isEmpty = !name.trim();
                            const isRed = isRequired && isEmpty;
                            const requiredQualification = isRequired
                              ? row.requiredQualifications[slotIdx]?.trim() ?? ""
                              : "";
                            const requiredRank = requiredQualification
                              ? (qualificationRankMap.get(requiredQualification) ??
                                Number.POSITIVE_INFINITY)
                              : Number.POSITIVE_INFINITY;
                            const slotBestRank = slotNames.reduce((bestRank, slotName) => {
                              const person = personnelByName.get(slotName);
                              if (!person) {
                                return bestRank;
                              }
                              const personRank = getBestQualificationRankForPerson(
                                person,
                                qualificationRankMap,
                              );
                              return Math.min(bestRank, personRank);
                            }, Number.POSITIVE_INFINITY);
                            const targetSlotOvertimeEnabled =
                              row.rowType === "apparatus" &&
                              slotIdx < row.minimumPersonnel &&
                              isOvertimeEnabledForSlot(dateKey, row.unitId, slotIdx);
                            const isRequiredInvalid =
                              isRequired &&
                              requiredQualification.length > 0 &&
                              slotNames.length > 0 &&
                              !targetSlotOvertimeEnabled &&
                              !(slotBestRank <= requiredRank);
                            const isTextRow =
                              row.rowType === "support" &&
                              row.supportValueMode === "text";
                            const isActiveInlineSelect =
                              activeInlineSlot?.dateKey === dateKey &&
                              activeInlineSlot?.unitId === row.unitId &&
                              activeInlineSlot?.slotIndex === slotIdx;
                            const eligiblePeople = getEligibleShiftPersonnelForSlot(
                              dateKey,
                              row,
                              slotIdx,
                              name,
                            );
                            return (
                              <div
                                key={slotIdx}
                                className={`personnel-schedule-slot ${
                                  isRed
                                    ? "personnel-schedule-slot-required-empty"
                                    : ""
                                } ${
                                  highlightPersonnelName &&
                                  slotNames.includes(highlightPersonnelName)
                                    ? "personnel-schedule-slot-highlighted"
                                    : ""
                                } ${
                                  isRequiredInvalid
                                    ? "personnel-schedule-slot-required-invalid"
                                    : ""
                                }`}
                                onClick={(event) => {
                                  if (isTextRow) return;
                                  event.stopPropagation();
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
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) =>
                                      updateTextSlotValue(
                                        dateKey,
                                        row.unitId,
                                        slotIdx,
                                        event.target.value,
                                      )
                                    }
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
                                ) : slotNames.length > 0 ? (
                                  <span className="personnel-schedule-slot-name-list">
                                    {slotNames.map((entry, nameIndex) => {
                                      const person = personnelByName.get(entry);
                                      const isOffShiftInOtSlot =
                                        targetSlotOvertimeEnabled &&
                                        !personnelMatchesShift(
                                          person ?? {},
                                          effectiveShift,
                                        );
                                      return (
                                        <span
                                          key={`${entry}-${nameIndex}`}
                                          className={
                                            isOffShiftInOtSlot
                                              ? "personnel-schedule-slot-name-off-shift"
                                              : undefined
                                          }
                                        >
                                          {slotNames.length > 1
                                            ? formatScheduleSegmentToken(entry)
                                            : formatSchedulePersonnelDisplayName(entry)}
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
              ))
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
          updateTextSlotValue={updateTextSlotValue}
          importAssignmentsForDay={importAssignmentsForDay}
          assignedOnDay={assignedOnDay}
          isOvertimeEnabledForSlot={isOvertimeEnabledForSlot}
          toggleOvertimeForSlot={toggleOvertimeForSlot}
          overtimeSplitCount={overtimeSplitCount}
          lastScheduleAction={lastScheduleAction}
          onUndo={undoLastScheduleChange}
          canUndo={scheduleUndoStack.length > 0}
          allPersonnel={departmentData.personnel}
          personnelQualificationOrder={departmentData.personnelQualifications}
          sortPersonnel={comparePersonnelByQualifications}
          getHighestQualificationLabel={getHighestQualificationLabel}
          shiftWindowStartMinutes={shiftWindowStartMinutes}
          shiftWindowEndMinutes={shiftWindowEndMinutes}
          getSegmentsForSlot={getSegmentsForSlot}
          setSegmentsForSlot={setSegmentsForSlot}
          onClose={() => {
            normalizeDayAssignmentsForRequirements(editDayBlock.dateKey);
            setEditDayBlock(null);
          }}
        />
      ) : null}
    </section>
  );
}
