import type { ChecklistAssignment, ChecklistFrequency, ChecklistItem, ChecklistSection, ChecklistTargetKind } from "../../api/checklists";
import { FREQUENCIES, TARGET_KINDS } from "../../api/checklists";

export function newId(prefix: "s" | "i"): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function emptySection(): ChecklistSection {
  return { id: newId("s"), title: "", items: [emptyItem()] };
}

export function emptyItem(): ChecklistItem {
  return { id: newId("i"), label: "", type: "check", required: true };
}

/** The same rule the server uses, so a flag shows while the check is being filled in. */
export function itemFlag(item: ChecklistItem, value: string, completedOn: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (item.type === "check") return raw === "Fail" ? "Failed" : "";
  if (item.type === "quantity") return typeof item.par === "number" && Number(raw) < item.par ? "Short" : "";
  if (item.type === "number") {
    const number = Number(raw);
    if (!Number.isFinite(number)) return "";
    const low = typeof item.min === "number" && number < item.min;
    const high = typeof item.max === "number" && number > item.max;
    return low || high ? "Out of range" : "";
  }
  if (item.type === "expiration") return completedOn && raw < completedOn ? "Expired" : "";
  return "";
}

export function itemRule(item: ChecklistItem): string {
  if (item.type === "quantity" && typeof item.par === "number") return `Par ${item.par}`;
  if (item.type === "number") {
    const low = typeof item.min === "number" ? item.min : null;
    const high = typeof item.max === "number" ? item.max : null;
    if (low !== null && high !== null) return `${low} to ${high}`;
    if (low !== null) return `At least ${low}`;
    if (high !== null) return `At most ${high}`;
  }
  return "";
}

export function frequencyLabel(value: ChecklistFrequency): string {
  return FREQUENCIES.find((entry) => entry.value === value)?.label ?? value;
}

export function targetKindLabel(value: ChecklistTargetKind): string {
  return TARGET_KINDS.find((entry) => entry.value === value)?.label ?? value;
}

export function targetText(kind: ChecklistTargetKind, label: string): string {
  if (kind === "none") return "General";
  return `${targetKindLabel(kind)}: ${label || "—"}`;
}

export function statusTone(status: string): string {
  if (status === "Overdue" || status === "Flagged") return "tone tone-critical";
  if (status === "Due") return "tone tone-warning";
  if (status === "Complete" || status === "Submitted" || status === "Reviewed") return "tone tone-positive";
  return "tone tone-neutral";
}

export function isOpen(assignment: ChecklistAssignment): boolean {
  return assignment.status === "Due" || assignment.status === "Overdue";
}
