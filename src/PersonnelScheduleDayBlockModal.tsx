import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { parseAssignedNames } from "./scheduleStorage";

type ModalRowType = "apparatus" | "support";
type ModalSupportValueMode = "text" | "personnel";

interface ModalScheduleRow {
  id: string;
  label: string;
  rowType: ModalRowType;
  unitId: string;
  slotCount: number;
  minimumPersonnel: number;
  supportValueMode?: ModalSupportValueMode;
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
  personnelQualificationOrder: string[];
  effectiveShift: string;
  getAssignmentsForDay: (dateKey: string, unitId: string, slotCount: number) => string[];
  assignPersonToSlot: (dateKey: string, unitId: string, slotIndex: number, personName: string) => void;
  clearSlotValue: (dateKey: string, unitId: string, slotIndex: number) => void;
  updateTextSlotValue: (dateKey: string, unitId: string, slotIndex: number, textValue: string) => void;
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
  lastScheduleAction: string;
  onUndo: () => void;
  canUndo: boolean;
  sortPersonnel: (a: ModalPersonnel, b: ModalPersonnel, order: string[]) => number;
  getHighestQualificationLabel: (person: ModalPersonnel, order: string[]) => string;
  onClose: () => void;
}

export function PersonnelScheduleDayBlockModal({
  date,
  dateKey,
  scheduleRows,
  shiftPersonnel,
  allPersonnel,
  personnelQualificationOrder,
  effectiveShift,
  getAssignmentsForDay,
  assignPersonToSlot,
  clearSlotValue,
  updateTextSlotValue,
  importAssignmentsForDay,
  assignedOnDay,
  isOvertimeEnabledForSlot,
  toggleOvertimeForSlot,
  overtimeSplitCount,
  lastScheduleAction,
  onUndo,
  canUndo,
  sortPersonnel,
  getHighestQualificationLabel,
  onClose,
}: PersonnelScheduleDayBlockModalProps) {
  const [draggedPerson, setDraggedPerson] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ unitId: string; slotIndex: number } | null>(
    null,
  );
  const [showAllPersonnel, setShowAllPersonnel] = useState(false);
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
    [draggedPerson, dateKey, scheduleRows, getAssignmentsForDay, assignPersonToSlot],
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

  return createPortal(
    <div
      className="personnel-schedule-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="personnel-schedule-modal">
        <div className="personnel-schedule-modal-header">
          <h2>
            Assign Personnel -{" "}
            {date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </h2>
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
              const slots = getAssignmentsForDay(dateKey, row.unitId, row.slotCount);
              return (
                <div key={row.id} className="personnel-schedule-modal-apparatus">
                  <strong>{row.label}</strong>
                  <div className="personnel-schedule-modal-slots">
                    {slots.map((name, slotIdx) => {
                      const isRequired = slotIdx < row.minimumPersonnel;
                      const isEmpty = !name.trim();
                      const isRed = isRequired && isEmpty;
                      const isTextRow =
                        row.rowType === "support" && row.supportValueMode === "text";
                      return (
                        <div key={slotIdx} className="personnel-schedule-modal-slot-row">
                          {row.rowType === "apparatus" && slotIdx < row.minimumPersonnel ? (
                            <label
                              className="field-hint personnel-schedule-modal-ot-toggle"
                              title={`Split slot into up to ${overtimeSplitCount} personnel`}
                            >
                              <input
                                type="checkbox"
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
                              OT
                            </label>
                          ) : (
                            <span className="personnel-schedule-modal-ot-spacer" />
                          )}
                          <div
                            className={`personnel-schedule-modal-slot ${isRed ? "personnel-schedule-slot-required-empty" : ""} ${
                              dragOverSlot?.unitId === row.unitId &&
                              dragOverSlot?.slotIndex === slotIdx
                                ? "personnel-schedule-slot-drag-over"
                                : ""
                            }`}
                            onDragOver={
                              isTextRow
                                ? undefined
                                : (e) => {
                                    e.preventDefault();
                                    setDragOverSlot({ unitId: row.unitId, slotIndex: slotIdx });
                                  }
                            }
                            onDragLeave={isTextRow ? undefined : () => setDragOverSlot(null)}
                            onDrop={isTextRow ? undefined : () => handleDrop(row.unitId, slotIdx)}
                            onClick={
                              isTextRow
                                ? undefined
                                : () => name && handleRemoveFromSlot(row.unitId, slotIdx)
                            }
                            title={
                              isTextRow
                                ? "Type note (max 25 chars)"
                                : name
                                  ? `Click to remove ${name}`
                                  : "Drag personnel here"
                            }
                          >
                            {isTextRow ? (
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
                              />
                            ) : (() => {
                              const names = parseAssignedNames(name);
                              const isOvertime =
                                row.rowType === "apparatus" &&
                                slotIdx < row.minimumPersonnel &&
                                isOvertimeEnabledForSlot(dateKey, row.unitId, slotIdx);
                              return (
                                <div>
                                  {names.length > 0 ? (
                                    names.map((personName, personIndex) => {
                                      const person = allPersonnel.find(
                                        (entry) => entry.name === personName,
                                      );
                                      const isOffShiftWhenOvertime =
                                        isOvertime &&
                                        person !== undefined &&
                                        !person.shift.includes(effectiveShift);
                                      return (
                                        <span
                                          key={`${personName}-${personIndex}`}
                                          style={
                                            isOffShiftWhenOvertime
                                              ? { color: "#b91c1c", fontWeight: 700 }
                                              : undefined
                                          }
                                        >
                                          {personName}
                                          {personIndex < names.length - 1 ? " / " : ""}
                                        </span>
                                      );
                                    })
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
                  draggable
                  onDragStart={() => setDraggedPerson(p.name)}
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
  );
}
