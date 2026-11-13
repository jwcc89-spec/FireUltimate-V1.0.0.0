import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  clampDayMinutes,
  minutesToTimeValue,
  parseAssignedNames,
  parseTimeToMinutes,
  type ScheduleSegment,
} from "./scheduleStorage";
import { formatScheduleSegmentToken, qualificationColorHex, visibleAdditionalRowCount } from "./scheduleUtils";

type ModalRowType = "apparatus" | "support";
type ModalSupportValueMode = "text" | "personnel";

interface ModalScheduleRow {
  id: string;
  label: string;
  rowType: ModalRowType;
  unitId: string;
  slotCount: number;
  rowsVisible?: number;
  maximumRows?: number;
  minimumPersonnel: number;
  supportValueMode?: ModalSupportValueMode;
  supportSegmentedMode?: boolean;
}

interface ModalPersonnel {
  name: string;
  shift: string;
  apparatusAssignment: string;
  station: string;
  userType: string;
  qualifications: string[];
}

interface PersonnelScheduleDayBlockModalProps {
  date: Date;
  dateKey: string;
  scheduleRows: ModalScheduleRow[];
  shiftPersonnel: ModalPersonnel[];
  allPersonnel: ModalPersonnel[];
  /** OT segment dropdown: personnel with shift set in Schedule Settings (excludes incomplete records). */
  overtimeRosterPersonnel: ModalPersonnel[];
  personnelQualificationOrder: string[];
  personnelQualificationColors: Record<string, string>;
  effectiveShift: string;
  getAssignmentsForDay: (
    dateKey: string,
    unitId: string,
    slotCount: number,
    keepExtraSlots?: boolean,
    padToSlotCount?: boolean,
  ) => string[];
  assignPersonToSlot: (dateKey: string, unitId: string, slotIndex: number, personName: string) => void;
  clearSlotValue: (dateKey: string, unitId: string, slotIndex: number) => void;
  /** Sub admin and above can split seats. A regular user cannot. */
  canChangeSegments?: boolean;
  /** A regular user adds only themselves, through the fill dialog. */
  selfFillOnly?: boolean;
  onOpenSelfFill?: (unitId: string, slotIndex: number) => void;
  /** Names waiting on a partial-shift approval. The seat stays closed until an admin answers. */
  pendingHolds?: Array<{ unitId: string; slotIndex: number; personName: string }>;
  updateTextSlotValue: (dateKey: string, unitId: string, slotIndex: number, textValue: string) => void;
  revealNextSupportRow: (dateKey: string, unitId: string) => void;
  getCoverageLines: (
    dateKey: string,
    rowId: string,
  ) => Array<{ personnelName: string; text: string; overtime?: boolean }>;
  importAssignmentsForDay: (dateKey: string) => void;
  assignedOnDay: (dateKey: string) => Set<string>;
  isOvertimeEnabledForSlot: (dateKey: string, unitId: string, slotIndex: number) => boolean;
  toggleOvertimeForSlot: (
    dateKey: string,
    unitId: string,
    slotIndex: number,
    enabled: boolean,
  ) => void;
  overtimeSplitCount: number;
  allowScheduledOvertime: boolean;
  lastScheduleAction: string;
  onUndo: () => void;
  canUndo: boolean;
  sortPersonnel: (a: ModalPersonnel, b: ModalPersonnel, order: string[]) => number;
  getHighestQualificationLabel: (person: ModalPersonnel, order: string[]) => string;
  shiftWindowStartMinutes: number;
  shiftWindowEndMinutes: number;
  getSegmentsForSlot: (dateKey: string, unitId: string, slotIndex: number) => ScheduleSegment[];
  setSegmentsForSlot: (
    dateKey: string,
    unitId: string,
    slotIndex: number,
    segments: ScheduleSegment[],
    actionLabel: string,
  ) => void;
  /** When set, blocks same person on overlapping apparatus times (shows browser alert). */
  assertApparatusTimeOverlap?: (
    dateKey: string,
    personName: string,
    excludeUnitId: string,
    excludeSlotIndex: number,
    proposedStart: number,
    proposedEnd: number,
  ) => string | null;
  apparatusOverrideBlockMessage?: (dateKey: string, personName: string) => string | null;
  apparatusSeatQualificationMessage?: (
    unitId: string,
    slotIndex: number,
    personName: string,
  ) => string | null;
  onScheduleNotice: (
    message: string,
    blocked?: { personName: string; unitId: string; slotIndex: number } | null,
  ) => void;
  /** When segment count becomes 1, exit segment mode and store a single 24h assignment. */
  collapseSegmentModeToSingleSlot: (
    dateKey: string,
    unitId: string,
    slotIndex: number,
    remainingPersonName: string,
  ) => void;
  onClose: () => void;
}

export function PersonnelScheduleDayBlockModal({
  date,
  dateKey,
  scheduleRows,
  shiftPersonnel,
  allPersonnel,
  overtimeRosterPersonnel,
  personnelQualificationOrder,
  personnelQualificationColors,
  effectiveShift,
  getAssignmentsForDay,
  assignPersonToSlot,
  clearSlotValue,
  canChangeSegments = true,
  selfFillOnly = false,
  onOpenSelfFill,
  pendingHolds = [],
  updateTextSlotValue,
  revealNextSupportRow,
  getCoverageLines,
  importAssignmentsForDay,
  assignedOnDay,
  isOvertimeEnabledForSlot,
  toggleOvertimeForSlot,
  overtimeSplitCount,
  allowScheduledOvertime,
  lastScheduleAction,
  onUndo,
  canUndo,
  sortPersonnel,
  getHighestQualificationLabel,
  shiftWindowStartMinutes,
  shiftWindowEndMinutes,
  getSegmentsForSlot,
  setSegmentsForSlot,
  assertApparatusTimeOverlap,
  apparatusOverrideBlockMessage,
  apparatusSeatQualificationMessage,
  onScheduleNotice,
  collapseSegmentModeToSingleSlot,
  onClose,
}: PersonnelScheduleDayBlockModalProps) {
  const [draggedPerson, setDraggedPerson] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ unitId: string; slotIndex: number } | null>(
    null,
  );
  const [showAllPersonnel, setShowAllPersonnel] = useState(false);
  /** Phase 1: edit segment count/times before Apply (per-slot structure). */
  const [segmentLayoutEditor, setSegmentLayoutEditor] = useState<{
    unitId: string;
    slotIndex: number;
    draft: ScheduleSegment[];
  } | null>(null);
  const assigned = assignedOnDay(dateKey);
  const visiblePersonnel = useMemo(() => {
    const base = showAllPersonnel ? allPersonnel : shiftPersonnel;
    return [...base].sort((a, b) => sortPersonnel(a, b, personnelQualificationOrder));
  }, [
    showAllPersonnel,
    allPersonnel,
    shiftPersonnel,
    personnelQualificationOrder,
    sortPersonnel,
  ]);

  const handleDrop = useCallback(
    (unitId: string, slotIndex: number) => {
      if (!draggedPerson) return;
      if (selfFillOnly) {
        setDraggedPerson(null);
        setDragOverSlot(null);
        const row = scheduleRows.find((r) => r.unitId === unitId);
        const current = (getAssignmentsForDay(dateKey, unitId, row?.slotCount ?? slotIndex + 1)[slotIndex] ?? "").trim();
        if (!current && onOpenSelfFill) onOpenSelfFill(unitId, slotIndex);
        return;
      }
      if (pendingHolds.some((item) => item.unitId === unitId && item.slotIndex === slotIndex)) {
        const held = pendingHolds.find((item) => item.unitId === unitId && item.slotIndex === slotIndex);
        setDraggedPerson(null);
        setDragOverSlot(null);
        if (held) {
          onScheduleNotice(`${held.personName} has a partial shift waiting for approval on this seat.`);
        }
        return;
      }
      const row = scheduleRows.find((r) => r.unitId === unitId);
      if (!row) return;
      const currentSlots = getAssignmentsForDay(dateKey, unitId, row.slotCount);
      const currentInSlot = currentSlots[slotIndex] ?? "";
      if (currentInSlot === draggedPerson) {
        setDraggedPerson(null);
        setDragOverSlot(null);
        return;
      }
      assignPersonToSlot(dateKey, unitId, slotIndex, draggedPerson);
      setDraggedPerson(null);
      setDragOverSlot(null);
    },
    [draggedPerson, dateKey, scheduleRows, getAssignmentsForDay, assignPersonToSlot, selfFillOnly, onOpenSelfFill, pendingHolds, onScheduleNotice],
  );

  const handleRemoveFromSlot = useCallback(
    (unitId: string, slotIndex: number) => {
      const row = scheduleRows.find((r) => r.unitId === unitId);
      if (!row) return;
      const slots = getAssignmentsForDay(dateKey, unitId, row.slotCount);
      const name = slots[slotIndex] ?? "";
      if (name) {
        clearSlotValue(dateKey, unitId, slotIndex);
      }
    },
    [dateKey, scheduleRows, getAssignmentsForDay, clearSlotValue],
  );
  const buildDefaultSegments = useCallback(
    (unitId: string, slotIndex: number): ScheduleSegment[] => {
      const row = scheduleRows.find((entry) => entry.unitId === unitId);
      const segmentCount = row?.rowType === "apparatus" ? Math.max(1, overtimeSplitCount) : 1;
      const totalWindow = Math.max(15, shiftWindowEndMinutes - shiftWindowStartMinutes);
      const segmentLength = Math.max(15, Math.floor(totalWindow / segmentCount));
      const segments: ScheduleSegment[] = [];
      for (let index = 0; index < segmentCount; index += 1) {
        const startMinutes = shiftWindowStartMinutes + index * segmentLength;
        const endMinutes =
          index === segmentCount - 1
            ? shiftWindowEndMinutes
            : shiftWindowStartMinutes + (index + 1) * segmentLength;
        segments.push({
          id: `${dateKey}-${unitId}-${slotIndex}-default-${index}`,
          assigneeType: "personnel",
          personnelName: "",
          startMinutes,
          endMinutes,
          source: "manual",
          overtime: false,
        });
      }
      return segments;
    },
    [dateKey, overtimeSplitCount, scheduleRows, shiftWindowEndMinutes, shiftWindowStartMinutes],
  );
  const ensureSegmentRows = useCallback(
    (unitId: string, slotIndex: number): ScheduleSegment[] => {
      const existing = getSegmentsForSlot(dateKey, unitId, slotIndex).filter(
        (segment) => segment.source !== "auto_hire",
      );
      return existing.length > 0 ? existing : buildDefaultSegments(unitId, slotIndex);
    },
    [buildDefaultSegments, dateKey, getSegmentsForSlot],
  );
  const updateSegmentCollection = useCallback(
    (
      unitId: string,
      slotIndex: number,
      mutate: (segments: ScheduleSegment[]) => ScheduleSegment[],
      actionLabel: string,
    ) => {
      const base = ensureSegmentRows(unitId, slotIndex).map((segment) => ({ ...segment }));
      const next = mutate(base);
      if (next.length <= 1) {
        const p =
          next.length === 1 ? (next[0]?.personnelName?.trim() ?? "") : "";
        collapseSegmentModeToSingleSlot(dateKey, unitId, slotIndex, p);
        return;
      }
      setSegmentsForSlot(dateKey, unitId, slotIndex, next, actionLabel);
    },
    [collapseSegmentModeToSingleSlot, dateKey, ensureSegmentRows, setSegmentsForSlot],
  );
  const normalizeTypedTime = useCallback((value: string): string => {
    const raw = value.trim();
    if (/^\d{2}:\d{2}$/.test(raw)) return raw;
    if (/^\d{4}$/.test(raw)) return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
    return "";
  }, []);
  const rebalanceApparatusForSupportSegment = useCallback(
    (personName: string, supportStart: number, supportEnd: number) => {
      scheduleRows
        .filter((row) => row.rowType === "apparatus")
        .forEach((row) => {
          const slots = getAssignmentsForDay(dateKey, row.unitId, row.slotCount);
          slots.forEach((slotValue, slotIndex) => {
            if (!parseAssignedNames(slotValue).includes(personName)) return;
            if (!isOvertimeEnabledForSlot(dateKey, row.unitId, slotIndex)) {
              toggleOvertimeForSlot(dateKey, row.unitId, slotIndex, true);
            }
            const nextSegments: ScheduleSegment[] = [];
            if (supportStart > shiftWindowStartMinutes) {
              nextSegments.push({
                id: `${Date.now()}-${row.unitId}-${slotIndex}-pre`,
                assigneeType: "personnel",
                personnelName: personName,
                startMinutes: shiftWindowStartMinutes,
                endMinutes: supportStart,
                source: "manual",
                overtime: false,
              });
            }
            if (supportEnd < shiftWindowEndMinutes) {
              nextSegments.push({
                id: `${Date.now()}-${row.unitId}-${slotIndex}-post`,
                assigneeType: "personnel",
                personnelName: personName,
                startMinutes: supportEnd,
                endMinutes: shiftWindowEndMinutes,
                source: "manual",
                overtime: false,
              });
            }
            setSegmentsForSlot(
              dateKey,
              row.unitId,
              slotIndex,
              nextSegments,
              "Adjusted apparatus for segmented support assignment.",
            );
          });
        });
    },
    [
      dateKey,
      getAssignmentsForDay,
      isOvertimeEnabledForSlot,
      scheduleRows,
      setSegmentsForSlot,
      shiftWindowEndMinutes,
      shiftWindowStartMinutes,
      toggleOvertimeForSlot,
    ],
  );
  const assignDraggedPersonToSegment = useCallback(
    (
      unitId: string,
      slotIndex: number,
      targetSegmentId: string,
      supportRowType: ModalRowType,
      supportValueMode?: ModalSupportValueMode,
    ) => {
      if (!draggedPerson) return;
      const segmentRows = ensureSegmentRows(unitId, slotIndex);
      const targetSeg = segmentRows.find((s) => s.id === targetSegmentId);
      if (!targetSeg) return;
      if (supportRowType === "apparatus" && apparatusSeatQualificationMessage) {
        const qualificationMsg = apparatusSeatQualificationMessage(
          unitId,
          slotIndex,
          draggedPerson,
        );
        if (qualificationMsg) {
          onScheduleNotice(qualificationMsg, {
            personName: draggedPerson,
            unitId,
            slotIndex,
          });
          setDraggedPerson(null);
          setDragOverSlot(null);
          return;
        }
      }
      if (supportRowType === "apparatus" && apparatusOverrideBlockMessage) {
        const overrideMsg = apparatusOverrideBlockMessage(dateKey, draggedPerson);
        if (overrideMsg) {
          onScheduleNotice(overrideMsg);
          setDraggedPerson(null);
          setDragOverSlot(null);
          return;
        }
      }
      if (
        supportRowType === "apparatus" &&
        assertApparatusTimeOverlap &&
        !targetSeg.overtime
      ) {
        const msg = assertApparatusTimeOverlap(
          dateKey,
          draggedPerson,
          unitId,
          slotIndex,
          targetSeg.startMinutes,
          targetSeg.endMinutes,
        );
        if (msg) {
          onScheduleNotice(msg);
          setDraggedPerson(null);
          setDragOverSlot(null);
          return;
        }
      }
      const trimmedDrag = draggedPerson.trim();
      const assignedOnAnotherSegment =
        trimmedDrag.length > 0 &&
        trimmedDrag !== "HIRE" &&
        segmentRows.some(
          (s) =>
            s.id !== targetSegmentId &&
            s.personnelName.trim() === trimmedDrag,
        );
      if (!targetSeg.overtime && assignedOnAnotherSegment) {
        onScheduleNotice(
          "That person is already assigned in another segment of this slot. Enable OT on this segment to pick from the full roster, or choose someone else.",
        );
        setDraggedPerson(null);
        setDragOverSlot(null);
        return;
      }
      const targetSupportStart = targetSeg.startMinutes;
      const targetSupportEnd = targetSeg.endMinutes;
      updateSegmentCollection(
        unitId,
        slotIndex,
        (segments) =>
          segments.map((segment) =>
            segment.id === targetSegmentId
              ? {
                  ...segment,
                  personnelName: draggedPerson,
                  assigneeType: "personnel" as const,
                }
              : segment,
          ),
        "Assigned segment personnel.",
      );
      if (supportRowType === "support" && supportValueMode === "personnel") {
        rebalanceApparatusForSupportSegment(
          draggedPerson,
          targetSupportStart,
          targetSupportEnd,
        );
      }
      setDraggedPerson(null);
      setDragOverSlot(null);
    },
    [
      apparatusOverrideBlockMessage,
      apparatusSeatQualificationMessage,
      assertApparatusTimeOverlap,
      dateKey,
      draggedPerson,
      ensureSegmentRows,
      onScheduleNotice,
      rebalanceApparatusForSupportSegment,
      updateSegmentCollection,
    ],
  );

  const openSegmentLayoutEditor = useCallback(
    (unitId: string, slotIndex: number) => {
      const draft = ensureSegmentRows(unitId, slotIndex).map((s) => ({ ...s }));
      setSegmentLayoutEditor({ unitId, slotIndex, draft });
    },
    [ensureSegmentRows],
  );

  const applySegmentLayoutEditor = useCallback(() => {
    if (!segmentLayoutEditor) return;
    const sorted = [...segmentLayoutEditor.draft]
      .map((s) => ({ ...s }))
      .filter((s) => s.endMinutes > s.startMinutes)
      .sort((a, b) => a.startMinutes - b.startMinutes);
    if (sorted.length === 0) {
      onScheduleNotice("Add at least one valid segment (end time after start time).");
      return;
    }
    if (sorted.length === 1) {
      collapseSegmentModeToSingleSlot(
        dateKey,
        segmentLayoutEditor.unitId,
        segmentLayoutEditor.slotIndex,
        sorted[0]?.personnelName?.trim() ?? "",
      );
      setSegmentLayoutEditor(null);
      return;
    }
    setSegmentsForSlot(
      dateKey,
      segmentLayoutEditor.unitId,
      segmentLayoutEditor.slotIndex,
      sorted,
      "Applied segment layout.",
    );
    setSegmentLayoutEditor(null);
  }, [collapseSegmentModeToSingleSlot, segmentLayoutEditor, dateKey, setSegmentsForSlot, onScheduleNotice]);

  const addSegmentLayoutDraftRow = useCallback(() => {
    setSegmentLayoutEditor((prev) => {
      if (!prev) return prev;
      const last = prev.draft[prev.draft.length - 1];
      const start = last ? last.endMinutes : shiftWindowStartMinutes;
      let end = shiftWindowEndMinutes;
      if (start >= end) {
        end = Math.min(shiftWindowEndMinutes, start + 60);
      }
      return {
        ...prev,
        draft: [
          ...prev.draft,
          {
            id: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            assigneeType: "personnel" as const,
            personnelName: "",
            startMinutes: clampDayMinutes(start),
            endMinutes: clampDayMinutes(end),
            source: "manual" as const,
            overtime: false,
          },
        ],
      };
    });
  }, [shiftWindowStartMinutes, shiftWindowEndMinutes]);

  const removeSegmentLayoutDraftRow = useCallback((segmentId: string) => {
    setSegmentLayoutEditor((prev) => {
      if (!prev || prev.draft.length <= 1) return prev;
      return { ...prev, draft: prev.draft.filter((s) => s.id !== segmentId) };
    });
  }, []);

  const updateSegmentLayoutDraft = useCallback(
    (segmentId: string, patch: Partial<ScheduleSegment>) => {
      setSegmentLayoutEditor((prev) =>
        prev
          ? {
              ...prev,
              draft: prev.draft.map((s) => (s.id === segmentId ? { ...s, ...patch } : s)),
            }
          : null,
      );
    },
    [],
  );

  const segmentLayoutEditorPortal =
    segmentLayoutEditor === null ? null : (
      <div
        className="personnel-schedule-segment-builder-backdrop"
        role="presentation"
        onClick={() => setSegmentLayoutEditor(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setSegmentLayoutEditor(null);
        }}
      >
        <div
          className="personnel-schedule-segment-builder"
          role="dialog"
          aria-modal="true"
          aria-labelledby="segment-builder-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h4 id="segment-builder-title">Segment layout</h4>
          <p className="field-hint">
            Set start/end for each slice (24-hour HH:MM). Apply saves this structure; assign people in
            the main day block.
          </p>
          <div className="personnel-schedule-segment-builder-rows">
            {segmentLayoutEditor.draft.map((seg, idx) => (
              <div key={seg.id} className="personnel-schedule-segment-builder-row">
                <span className="field-hint">#{idx + 1}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="personnel-schedule-segment-builder-time"
                  defaultValue={minutesToTimeValue(seg.startMinutes)}
                  placeholder="HH:MM"
                  aria-label={`Segment ${idx + 1} start`}
                  onBlur={(event) => {
                    const nextStart = normalizeTypedTime(event.currentTarget.value);
                    if (!nextStart) return;
                    updateSegmentLayoutDraft(seg.id, {
                      startMinutes: clampDayMinutes(parseTimeToMinutes(nextStart)),
                    });
                  }}
                />
                <span className="field-hint">→</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="personnel-schedule-segment-builder-time"
                  defaultValue={minutesToTimeValue(seg.endMinutes)}
                  placeholder="HH:MM"
                  aria-label={`Segment ${idx + 1} end`}
                  onBlur={(event) => {
                    const nextEnd = normalizeTypedTime(event.currentTarget.value);
                    if (!nextEnd) return;
                    const parsedEnd = clampDayMinutes(parseTimeToMinutes(nextEnd));
                    const startM = seg.startMinutes;
                    updateSegmentLayoutDraft(seg.id, {
                      endMinutes: parsedEnd <= startM ? parsedEnd + 1440 : parsedEnd,
                    });
                  }}
                />
                <button
                  type="button"
                  className="personnel-schedule-segment-builder-remove"
                  disabled={segmentLayoutEditor.draft.length <= 1}
                  title="Remove this segment"
                  aria-label="Remove this segment"
                  onClick={() => removeSegmentLayoutDraftRow(seg.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="personnel-schedule-segment-builder-toolbar">
            <button type="button" className="secondary-button compact-button" onClick={addSegmentLayoutDraftRow}>
              Add segment
            </button>
          </div>
          <div className="personnel-schedule-segment-builder-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={() => setSegmentLayoutEditor(null)}
            >
              Cancel
            </button>
            <button type="button" className="primary-button compact-button" onClick={applySegmentLayoutEditor}>
              Apply
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <>
      {createPortal(
    <div
      className="personnel-schedule-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="personnel-schedule-modal">
        <div className="personnel-schedule-modal-header">
          <div className="personnel-schedule-modal-title-row">
            <h2>Assign Personnel</h2>
            <div className="personnel-schedule-modal-date-chip" aria-label={date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}>
              <span className="personnel-schedule-modal-date-dow">
                {date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
              </span>
              <span className="personnel-schedule-modal-date-md">
                {`${date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()} ${date.getDate()}`}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="personnel-schedule-modal-body">
          <div className="personnel-schedule-modal-day-block">
            <div className="personnel-schedule-modal-day-block-header">
              <h3>Day Block</h3>
              <div className="personnel-schedule-modal-day-block-actions">
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={onUndo}
                  disabled={!canUndo}
                >
                  Undo
                </button>
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => importAssignmentsForDay(dateKey)}
                >
                  Import Assignments
                </button>
              </div>
            </div>
            <p
              className={
                lastScheduleAction.startsWith("Cannot assign")
                  ? "auth-error"
                  : "field-hint"
              }
              style={{ margin: "-0.35rem 0 0.5rem" }}
            >
              Previous action: {lastScheduleAction}
            </p>
            {scheduleRows.map((row) => {
              const storedSlots =
                row.rowType === "support"
                  ? getAssignmentsForDay(
                      dateKey,
                      row.unitId,
                      row.maximumRows ?? row.slotCount,
                      true,
                      false,
                    )
                  : getAssignmentsForDay(dateKey, row.unitId, row.slotCount);
              const visibleCount =
                row.rowType === "support"
                  ? visibleAdditionalRowCount(
                      storedSlots,
                      row.rowsVisible ?? 1,
                      row.maximumRows ?? row.slotCount,
                    )
                  : storedSlots.length;
              const slots =
                row.rowType === "support"
                  ? Array.from({ length: visibleCount }, (_, index) => storedSlots[index] ?? "")
                  : storedSlots;
              const coverageLines = getCoverageLines(dateKey, row.id);
              const colorForPersonnelName = (name: string): string | undefined => {
                const person = allPersonnel.find((entry) => entry.name === name);
                if (!person) return undefined;
                const qualification = getHighestQualificationLabel(person, personnelQualificationOrder);
                return qualificationColorHex(personnelQualificationColors[qualification]);
              };
              return (
                <div key={row.id} className="personnel-schedule-modal-apparatus">
                  <strong>{row.label}</strong>
                  {(row.id === "support-info" || row.id === "support-trade") &&
                  coverageLines.length > 0 ? (
                    <div className="personnel-schedule-coverage-info">
                      {coverageLines.map((line) => (
                        <div
                          key={`${line.personnelName}-${line.text}-${line.overtime ? "ot" : "shift"}`}
                          className={line.overtime ? "personnel-schedule-overtime-name" : undefined}
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
                  <div className="personnel-schedule-modal-slots">
                    {slots.map((name, slotIdx) => {
                      const heldName =
                        pendingHolds.find((item) => item.unitId === row.unitId && item.slotIndex === slotIdx)
                          ?.personName ?? "";
                      const isRequired = slotIdx < row.minimumPersonnel;
                      const isEmpty = !name.trim() && !heldName;
                      const isRed = isRequired && isEmpty;
                      const isTextRow =
                        row.rowType === "support" && row.supportValueMode === "text";
                      const isAdditionalSegmentCapable =
                        row.rowType === "support" &&
                        row.supportValueMode === "personnel" &&
                        Boolean(row.supportSegmentedMode);
                      const isSegmentModeAtSlot =
                        row.rowType === "apparatus" &&
                        slotIdx < row.minimumPersonnel &&
                        isOvertimeEnabledForSlot(dateKey, row.unitId, slotIdx) ||
                        (isAdditionalSegmentCapable &&
                          isOvertimeEnabledForSlot(dateKey, row.unitId, slotIdx));
                      return (
                        <div key={slotIdx} className="personnel-schedule-modal-slot-row">
                          {(canChangeSegments &&
                            ((row.rowType === "apparatus" && slotIdx < row.minimumPersonnel) ||
                              isAdditionalSegmentCapable)) ? (
                            <label
                              className="field-hint personnel-schedule-modal-ot-toggle"
                              title={
                                row.rowType === "apparatus"
                                  ? `Split this slot into timed segments (default count from shift length ÷ standard OT slot, e.g. ${overtimeSplitCount}). Mark OT per segment when hiring back.`
                                  : "Enable segmented entry for this additional field slot"
                              }
                            >
                              <input
                                type="checkbox"
                                aria-label={
                                  row.rowType === "apparatus"
                                    ? "Enable timed segments for this slot"
                                    : "Enable segmented entry for this additional field slot"
                                }
                                checked={isOvertimeEnabledForSlot(dateKey, row.unitId, slotIdx)}
                                onChange={(event) =>
                                  toggleOvertimeForSlot(
                                    dateKey,
                                    row.unitId,
                                    slotIdx,
                                    event.target.checked,
                                  )
                                }
                              />
                            </label>
                          ) : (
                            <span className="personnel-schedule-modal-ot-spacer" />
                          )}
                          <div
                            className={`personnel-schedule-modal-slot${
                              isTextRow ? " personnel-schedule-modal-slot-text" : ""
                            }${
                              isSegmentModeAtSlot ? " personnel-schedule-modal-slot-segmented" : ""
                            }${isRed ? " personnel-schedule-slot-required-empty" : ""}${
                              dragOverSlot?.unitId === row.unitId &&
                              dragOverSlot?.slotIndex === slotIdx
                                ? " personnel-schedule-slot-drag-over"
                                : ""
                            }`}
                            onDragOver={
                              isTextRow || isSegmentModeAtSlot
                                ? undefined
                                : (e) => {
                                    e.preventDefault();
                                    setDragOverSlot({ unitId: row.unitId, slotIndex: slotIdx });
                                  }
                            }
                            onDragLeave={
                              isTextRow || isSegmentModeAtSlot
                                ? undefined
                                : () => setDragOverSlot(null)
                            }
                            onDrop={
                              isTextRow || isSegmentModeAtSlot
                                ? undefined
                                : () => handleDrop(row.unitId, slotIdx)
                            }
                            onClick={
                              isTextRow || isSegmentModeAtSlot
                                ? undefined
                                : () => {
                                    if (heldName && !name.trim()) return;
                                    if (selfFillOnly && !name.trim()) {
                                      onOpenSelfFill?.(row.unitId, slotIdx);
                                      return;
                                    }
                                    if (name) handleRemoveFromSlot(row.unitId, slotIdx);
                                  }
                            }
                            title={
                              isTextRow
                                ? "Type note (max 25 chars)"
                                : selfFillOnly && !name.trim()
                                  ? "Add yourself to this open seat"
                                  : name
                                    ? `Click to remove ${name}`
                                    : "Drag personnel here"
                            }
                          >
                            {isTextRow ? (
                              <>
                                <input
                                  type="text"
                                  maxLength={25}
                                  value={name}
                                  className="personnel-schedule-info-input"
                                  placeholder="Type info..."
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
                              </>
                            ) : (() => {
                              const names = parseAssignedNames(name);
                              const isSegmentMode = isSegmentModeAtSlot;
                              const segmentRowsForSlot = ensureSegmentRows(row.unitId, slotIdx);
                              return (
                                <div>
                                  {isSegmentMode ? (
                                    <div className="personnel-schedule-modal-segments-wrap">
                                      <div className="personnel-schedule-modal-segments personnel-schedule-modal-segments--horizontal">
                                        {segmentRowsForSlot.map((segment) => {
                                          const dropdownPersonnel =
                                            row.rowType === "apparatus" && segment.overtime
                                              ? overtimeRosterPersonnel
                                              : shiftPersonnel;
                                          const isAssignedOnOtherSegment = (personName: string) =>
                                            segmentRowsForSlot.some(
                                              (s) =>
                                                s.id !== segment.id &&
                                                s.personnelName.trim() === personName.trim() &&
                                                personName.trim() !== "" &&
                                                personName.trim() !== "HIRE",
                                            );
                                          return (
                                            <div
                                              key={segment.id}
                                              className={`personnel-schedule-modal-segment-card ${
                                                segment.overtime
                                                  ? "personnel-schedule-modal-segment-card--ot"
                                                  : ""
                                              }`}
                                              onDragOver={(event) => {
                                                event.preventDefault();
                                                setDragOverSlot({
                                                  unitId: row.unitId,
                                                  slotIndex: slotIdx,
                                                });
                                              }}
                                              onDrop={(event) => {
                                                event.preventDefault();
                                                assignDraggedPersonToSegment(
                                                  row.unitId,
                                                  slotIdx,
                                                  segment.id,
                                                  row.rowType,
                                                  row.supportValueMode,
                                                );
                                              }}
                                            >
                                              <button
                                                type="button"
                                                className="personnel-schedule-segment-trash"
                                                title="Remove segment"
                                                aria-label="Remove segment"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  updateSegmentCollection(
                                                    row.unitId,
                                                    slotIdx,
                                                    (existing) =>
                                                      existing.filter((entry) => entry.id !== segment.id),
                                                    "Removed timed segment.",
                                                  );
                                                }}
                                              >
                                                <span
                                                  className="personnel-schedule-segment-trash-icon"
                                                  aria-hidden
                                                >
                                                  ×
                                                </span>
                                              </button>
                                              {row.rowType === "apparatus" && allowScheduledOvertime ? (
                                                <label className="personnel-schedule-modal-segment-ot field-hint">
                                                  <input
                                                    type="checkbox"
                                                    checked={Boolean(segment.overtime)}
                                                    onChange={(event) =>
                                                      updateSegmentCollection(
                                                        row.unitId,
                                                        slotIdx,
                                                        (existing) =>
                                                          existing.map((entry) =>
                                                            entry.id === segment.id
                                                              ? {
                                                                  ...entry,
                                                                  overtime: event.target.checked,
                                                                }
                                                              : entry,
                                                          ),
                                                        "Updated segment OT flag.",
                                                      )
                                                    }
                                                  />
                                                  OT
                                                </label>
                                              ) : null}
                                              <div className="personnel-schedule-modal-segment-assignee">
                                                <select
                                                  className="personnel-schedule-modal-segment-select"
                                                  value={segment.personnelName}
                                                  onChange={(event) => {
                                                    const nextName = event.target.value;
                                                    if (
                                                      row.rowType === "apparatus" &&
                                                      nextName.trim() &&
                                                      apparatusSeatQualificationMessage
                                                    ) {
                                                      const qualificationMsg = apparatusSeatQualificationMessage(
                                                        row.unitId,
                                                        slotIdx,
                                                        nextName,
                                                      );
                                                      if (qualificationMsg) {
                                                        onScheduleNotice(qualificationMsg, {
                                                          personName: nextName,
                                                          unitId: row.unitId,
                                                          slotIndex: slotIdx,
                                                        });
                                                        return;
                                                      }
                                                    }
                                                    if (
                                                      row.rowType === "apparatus" &&
                                                      nextName.trim() &&
                                                      apparatusOverrideBlockMessage
                                                    ) {
                                                      const overrideMsg = apparatusOverrideBlockMessage(
                                                        dateKey,
                                                        nextName,
                                                      );
                                                      if (overrideMsg) {
                                                        onScheduleNotice(overrideMsg);
                                                        return;
                                                      }
                                                    }
                                                    if (
                                                      row.rowType === "apparatus" &&
                                                      assertApparatusTimeOverlap &&
                                                      nextName.trim() &&
                                                      !segment.overtime
                                                    ) {
                                                      const msg = assertApparatusTimeOverlap(
                                                        dateKey,
                                                        nextName,
                                                        row.unitId,
                                                        slotIdx,
                                                        segment.startMinutes,
                                                        segment.endMinutes,
                                                      );
                                                      if (msg) {
                                                        onScheduleNotice(msg);
                                                        return;
                                                      }
                                                    }
                                                    updateSegmentCollection(
                                                      row.unitId,
                                                      slotIdx,
                                                      (existing) =>
                                                        existing.map((entry) =>
                                                          entry.id === segment.id
                                                            ? {
                                                                ...entry,
                                                                personnelName: nextName,
                                                                assigneeType: "personnel",
                                                              }
                                                            : entry,
                                                        ),
                                                      "Updated timed segment.",
                                                    );
                                                  }}
                                                  onBlur={() => {
                                                    if (
                                                      row.rowType === "support" &&
                                                      row.supportValueMode === "personnel" &&
                                                      segment.personnelName.trim().length > 0
                                                    ) {
                                                      rebalanceApparatusForSupportSegment(
                                                        segment.personnelName,
                                                        segment.startMinutes,
                                                        segment.endMinutes,
                                                      );
                                                    }
                                                  }}
                                                >
                                                  <option value="">Select personnel</option>
                                                  {dropdownPersonnel.map((person) => {
                                                    const greyOutInShiftList =
                                                      !segment.overtime &&
                                                      isAssignedOnOtherSegment(person.name);
                                                    return (
                                                      <option
                                                        key={`${segment.id}-${person.name}`}
                                                        value={person.name}
                                                        disabled={greyOutInShiftList}
                                                        title={
                                                          greyOutInShiftList
                                                            ? row.rowType === "apparatus"
                                                              ? "Already assigned in another segment of this slot. Enable OT on this segment to use the full roster."
                                                              : "Already assigned in another segment of this slot."
                                                            : undefined
                                                        }
                                                      >
                                                        {person.name}
                                                      </option>
                                                    );
                                                  })}
                                                </select>
                                                <div className="personnel-schedule-modal-segment-time-display">
                                                  {minutesToTimeValue(segment.startMinutes)}
                                                  {"–"}
                                                  {minutesToTimeValue(segment.endMinutes)}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <button
                                        type="button"
                                        className="personnel-schedule-segment-layout-add"
                                        title="Edit segment count and times (Apply in popup)"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openSegmentLayoutEditor(row.unitId, slotIdx);
                                        }}
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : heldName && names.length === 0 ? (
                                    `${heldName} (Pending)`
                                  ) : names.length > 0 ? (
                                    names.map((personName, personIndex) => (
                                      <span key={`${personName}-${personIndex}`}>
                                        {names.length > 1
                                          ? formatScheduleSegmentToken(personName)
                                          : personName}
                                        {personIndex < names.length - 1 ? " / " : ""}
                                      </span>
                                    ))
                                  ) : (
                                    "—"
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="personnel-schedule-modal-personnel">
            <h3>Personnel ({effectiveShift})</h3>
            <button
              type="button"
              className="neris-link-button"
              onClick={() => setShowAllPersonnel((previous) => !previous)}
            >
              {showAllPersonnel ? "Hide All Personnel" : "Show All Personnel -> RL"}
            </button>
            <ul className="personnel-schedule-modal-personnel-list">
              {visiblePersonnel.map((p) => (
                <li
                  key={p.name}
                  className={`personnel-schedule-modal-personnel-item ${
                    assigned.has(p.name) ? "personnel-schedule-personnel-assigned" : ""
                  }`}
                  draggable={!selfFillOnly}
                  onDragStart={() => {
                    if (!selfFillOnly) setDraggedPerson(p.name);
                  }}
                  onDragEnd={() => {
                    setDraggedPerson(null);
                    setDragOverSlot(null);
                  }}
                >
                  <span>{p.name}</span>
                  <small className="personnel-schedule-modal-personnel-qualification">
                    {getHighestQualificationLabel(p, personnelQualificationOrder) ||
                      "No qualification"}
                  </small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>,
        document.body,
      )}
      {segmentLayoutEditor
        ? createPortal(segmentLayoutEditorPortal, document.body)
        : null}
    </>
  );
}
