/** Inventory checklists API client: templates, kits, assignments and completed checks. */
import { apiJson, send } from "./maintenance";

export type ChecklistItemType = "check" | "yesno" | "quantity" | "number" | "expiration" | "date" | "select" | "text";
export type ChecklistTargetKind = "apparatus" | "station" | "kit" | "none";
export type ChecklistFrequency = "once" | "shift" | "daily" | "weekly" | "monthly";

export const ITEM_TYPES: { value: ChecklistItemType; label: string; hint: string }[] = [
  { value: "check", label: "OK / Fail / N/A", hint: "Fail flags the check." },
  { value: "yesno", label: "Yes / No", hint: "" },
  { value: "quantity", label: "Quantity (par)", hint: "Below par flags the check as short." },
  { value: "number", label: "Number (low / high)", hint: "Outside the limits flags the check." },
  { value: "expiration", label: "Expiration date", hint: "A date before the check date flags it as expired." },
  { value: "date", label: "Date", hint: "" },
  { value: "select", label: "Pick one", hint: "" },
  { value: "text", label: "Text", hint: "" },
];

export const TARGET_KINDS: { value: ChecklistTargetKind; label: string }[] = [
  { value: "apparatus", label: "Apparatus" },
  { value: "station", label: "Station" },
  { value: "kit", label: "Kit" },
  { value: "none", label: "Nothing (general)" },
];

export const FREQUENCIES: { value: ChecklistFrequency; label: string }[] = [
  { value: "shift", label: "Every shift" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "once", label: "One time" },
];

export interface ChecklistItem {
  id: string;
  label: string;
  type: ChecklistItemType;
  required: boolean;
  par?: number;
  min?: number | null;
  max?: number | null;
  options?: string[];
}

export interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  enabled: boolean;
  version: number;
  versionId: string;
  sections: ChecklistSection[];
  updatedAt: string;
}

export type ChecklistTemplateInput = Pick<ChecklistTemplate, "name" | "enabled" | "sections">;

export interface Kit {
  id: string;
  name: string;
  kitType: string;
  locationRef: string;
  notes: string;
}

export type KitInput = Omit<Kit, "id">;

export type AssignmentStatus = "Due" | "Overdue" | "Complete" | "Scheduled" | "Paused";

export interface ChecklistAssignment {
  id: string;
  templateId: string;
  templateName: string;
  targetKind: ChecklistTargetKind;
  targetRef: string;
  targetLabel: string;
  assignedTo: string;
  frequency: ChecklistFrequency;
  startsOn: string;
  active: boolean;
  lastCompletedOn: string;
  status: AssignmentStatus;
  dueOn: string;
}

export type ChecklistAssignmentInput = Pick<
  ChecklistAssignment,
  "templateId" | "targetKind" | "targetRef" | "assignedTo" | "frequency" | "startsOn" | "active"
>;

export interface ChecklistFlag {
  itemId: string;
  label: string;
  reason: string;
}

export interface ChecklistAnswer {
  value: string;
  note: string;
  flag?: string;
}

export interface ChecklistSubmission {
  id: string;
  submissionNumber: string;
  templateId: string;
  templateName: string;
  assignmentId: string;
  targetKind: ChecklistTargetKind;
  targetRef: string;
  targetLabel: string;
  completedOn: string;
  completedByName: string;
  status: "Submitted" | "Flagged" | "Reviewed";
  flagCount: number;
  flags: ChecklistFlag[];
  reviewedBy: string;
  createdAt: string;
}

export interface ChecklistSubmissionDetail extends ChecklistSubmission {
  notes: string;
  results: Record<string, ChecklistAnswer>;
  sections: ChecklistSection[];
}

export interface ChecklistSubmissionInput {
  templateId: string;
  assignmentId: string;
  targetKind: ChecklistTargetKind;
  targetRef: string;
  completedOn: string;
  signatureName: string;
  pin: string;
  notes: string;
  results: Record<string, ChecklistAnswer>;
}

const id = (value: string) => encodeURIComponent(value);

export const getChecklistTemplates = () => apiJson<ChecklistTemplate[]>("/api/checklists/templates");
export const createChecklistTemplate = (input: ChecklistTemplateInput) =>
  apiJson<ChecklistTemplate>("/api/checklists/templates", send("POST", input));
export const updateChecklistTemplate = (templateId: string, input: ChecklistTemplateInput) =>
  apiJson<ChecklistTemplate>(`/api/checklists/templates/${id(templateId)}`, send("PATCH", input));
export const deleteChecklistTemplate = (templateId: string) =>
  apiJson<void>(`/api/checklists/templates/${id(templateId)}`, send("DELETE"));

export const getKits = () => apiJson<Kit[]>("/api/checklists/kits");
export const createKit = (input: KitInput) => apiJson<Kit>("/api/checklists/kits", send("POST", input));
export const updateKit = (kitId: string, input: KitInput) => apiJson<Kit>(`/api/checklists/kits/${id(kitId)}`, send("PATCH", input));
export const deleteKit = (kitId: string) => apiJson<void>(`/api/checklists/kits/${id(kitId)}`, send("DELETE"));

export const getAssignments = (date: string) =>
  apiJson<ChecklistAssignment[]>(`/api/checklists/assignments?date=${id(date)}`);
export const createAssignment = (input: ChecklistAssignmentInput, date: string) =>
  apiJson<ChecklistAssignment>(`/api/checklists/assignments?date=${id(date)}`, send("POST", input));
export const updateAssignment = (assignmentId: string, input: ChecklistAssignmentInput, date: string) =>
  apiJson<ChecklistAssignment>(`/api/checklists/assignments/${id(assignmentId)}?date=${id(date)}`, send("PATCH", input));
export const deleteAssignment = (assignmentId: string) =>
  apiJson<void>(`/api/checklists/assignments/${id(assignmentId)}`, send("DELETE"));

export const getSubmissions = () => apiJson<ChecklistSubmission[]>("/api/checklists/submissions");
export const getSubmission = (submissionId: string) =>
  apiJson<ChecklistSubmissionDetail>(`/api/checklists/submissions/${id(submissionId)}`);
export const createSubmission = (input: ChecklistSubmissionInput) =>
  apiJson<ChecklistSubmissionDetail>("/api/checklists/submissions", send("POST", input));
export const reviewSubmission = (submissionId: string) =>
  apiJson<void>(`/api/checklists/submissions/${id(submissionId)}/review`, send("PATCH"));
export const deleteSubmission = (submissionId: string) =>
  apiJson<void>(`/api/checklists/submissions/${id(submissionId)}`, send("DELETE"));
