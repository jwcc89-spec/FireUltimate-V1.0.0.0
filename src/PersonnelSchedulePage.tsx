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
  loadScheduleAssignments,
  loadScheduleOvertimeSplit,
  parseAssignedNames,
  saveScheduleAssignments,
  saveScheduleOvertimeSplit,
  serializeAssignedNames,
  toScheduleStorageDateKey,
  type ScheduleAssignments,
  type ScheduleOvertimeSplit,
} from "./scheduleStorage";
import {
  buildQualificationRankMap,
  comparePersonnelByQualifications,
  formatSchedulePersonnelDisplayName,
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
  const [scheduleUndoStack, setScheduleUndoStack] = useState<
    Array<{
      assignments: ScheduleAssignments;
      overtimeSplit: ScheduleOvertimeSplit;
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
          message,
        },
      ]);
    },
    [scheduleAssignments, scheduleOvertimeSplit],
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
      saveScheduleAssignments(snapshot.assignments);
      saveScheduleOvertimeSplit(snapshot.overtimeSplit);
      setLastScheduleAction(`Undid: ${snapshot.message}`);
      return previous.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
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
      } catch {
        // Keep localStorage data
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [normalizeAdditionalFields, normalizeDepartmentDraft]);

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
              merged.push(name);
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
      }
      setLastScheduleAction("Updated overtime split.");
    },
    [
      effectiveShift,
      scheduleOvertimeSplit,
      applyOvertimeSplitChange,
      pushUndoSnapshot,
    ],
  );

  const assignPersonToSlot = useCallback(
    (dateKey: string, unitId: string, slotIndex: number, personName: string) => {
      pushUndoSnapshot("Assign personnel to slot");
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
        for (const [uid, slots] of Object.entries(dayData)) {
          const row = scheduleRows.find((candidate) => candidate.unitId === uid);
          if (!row) {
            continue;
          }
          const shouldClear = isTargetOverrideSupportPersonnelRow
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
        const targetOvertimeEnabled =
          targetRow?.rowType === "apparatus" &&
          slotIndex < (targetRow.minimumPersonnel ?? 0) &&
          isOvertimeEnabledForSlot(dateKey, unitId, slotIndex);
        const maxNamesInSlot = targetOvertimeEnabled ? overtimeSplitCount : 1;
        const existingNames = parseAssignedNames(unitSlots[slotIndex] ?? "");
        const withoutDuplicates = existingNames.filter((name) => name !== personName);
        const nextNames = [...withoutDuplicates, personName].slice(0, maxNamesInSlot);
        unitSlots[slotIndex] = serializeAssignedNames(nextNames);
        dayData[unitId] = unitSlots;
        next[storageDateKey] = dayData;
        saveScheduleAssignments(next);
        return next;
      });
      setLastScheduleAction("Assigned personnel.");
    },
    [
      scheduleRows,
      buildDefaultAssignmentsForDate,
      effectiveShift,
      isOvertimeEnabledForSlot,
      overtimeSplitCount,
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
      setLastScheduleAction("Cleared slot.");
    },
    [scheduleRows, buildDefaultAssignmentsForDate, effectiveShift, pushUndoSnapshot],
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
          row.rowType === "apparatus" || isOverrideSupportPersonnelRow(row);
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

  const getEligibleShiftPersonnelForSlot = useCallback(
    (
      dateKey: string,
      row: PersonnelScheduleRow,
      currentName: string,
    ): PersonnelScheduleData["personnel"] => {
      const assignedInBlockingRows = new Set<string>();
      for (const scheduleRow of scheduleRows) {
        const isBlockingRow =
          scheduleRow.rowType === "apparatus" ||
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
      setLastScheduleAction("Imported assignments for day.");
    },
    [scheduleRows, buildDefaultAssignmentsForDate, effectiveShift, pushUndoSnapshot],
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
              <small className="field-hint">Last action: {lastScheduleAction}</small>
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
                        ? [
                            ...assignedNames.sort((aName, bName) => {
                              const aRank = getBestQualificationRankForPerson(
                                personnelByName.get(aName),
                                qualificationRankMap,
                              );
                              const bRank = getBestQualificationRankForPerson(
                                personnelByName.get(bName),
                                qualificationRankMap,
                              );
                              if (aRank !== bRank) return aRank - bRank;
                              return aName.localeCompare(bName);
                            }),
                            ...Array.from(
                              {
                                // Month/default view shows min slots unless extra personnel are assigned.
                                length: Math.max(
                                  0,
                                  Math.max(row.minimumPersonnel, assignedNames.length) -
                                    assignedNames.length,
                                ),
                              },
                              () => "",
                            ),
                          ]
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
                            const slotNames = parseAssignedNames(name);
                            const isRequired = slotIdx < row.minimumPersonnel;
                            const isEmpty = !name.trim();
                            const isRed = isRequired && isEmpty;
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
                                  slotNames
                                    .map((entry) =>
                                      formatSchedulePersonnelDisplayName(entry),
                                    )
                                    .join(" / ")
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
          onClose={() => {
            normalizeDayAssignmentsForRequirements(editDayBlock.dateKey);
            setEditDayBlock(null);
          }}
        />
      ) : null}
    </section>
  );
}
