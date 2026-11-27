/** Policy manual, DTBs, acknowledgments, assignments, templates and random rules. */
import type { JSONContent } from "@tiptap/react";
import { apiJson, send } from "./maintenance";

export type PolicyKind = "policy" | "dtb";
export type CategoryKind = "manual" | "dtb";
export type PolicyStatus = "draft" | "published" | "archived";
export type MyAck = "none" | "needed" | "acknowledged";

export interface PolicyCategory {
  id: string;
  kind: CategoryKind;
  number: number;
  title: string;
  sortOrder: number;
}

export type PolicyCategoryInput = Pick<PolicyCategory, "kind" | "number" | "title">;

export interface PolicySummary {
  id: string;
  kind: PolicyKind;
  categoryId: string;
  number: string;
  title: string;
  status: PolicyStatus;
  currentVersion: number;
  ackVersion: number;
  publishedAt: string;
  effectiveDate: string;
  requiresAck: boolean;
  hasDraft: boolean;
  updatedAt: string;
  updatedBy: string;
  myAck: MyAck;
  acknowledgedAt: string;
  dueDate: string;
}

export interface PolicyAttachmentInfo {
  name: string;
  size: number;
}

export interface PolicyDetail extends PolicySummary {
  canManage: boolean;
  published: {
    version: number;
    content: JSONContent | null;
    attachment: PolicyAttachmentInfo | null;
    publishedAt: string;
    publishedBy: string;
    changeNote: string;
  } | null;
  draft: { content: JSONContent | null; attachment: PolicyAttachmentInfo | null } | null;
  history: { version: number; publishedAt: string; publishedBy: string; changeNote: string; requireReack: boolean }[];
}

export interface PolicyInput {
  kind: PolicyKind;
  categoryId: string;
  number: string;
  title: string;
  effectiveDate: string;
  requiresAck: boolean;
  content: JSONContent | null;
  attachment: { name: string; size: number; dataUrl: string } | null;
  /** Keep the draft's PDF when no new file was picked. */
  keepAttachment?: boolean;
  archived?: boolean;
}

export interface PoliciesHome {
  needed: PolicySummary[];
  acknowledged: PolicySummary[];
  dtbs: PolicySummary[];
  dtbsDone: PolicySummary[];
}

export interface PolicyPerson {
  id: string;
  name: string;
}

export interface PolicyAckStatusRow {
  userId: string;
  name: string;
  assigned: boolean;
  status: "Acknowledged" | "Pending" | "Not assigned";
  acknowledgedAt: string;
  acknowledgedVersion: number;
}

export interface PolicyAssignment {
  id: string;
  policyId: string;
  userId: string;
  source: "publish" | "manual" | "template" | "rule";
  periodKey: string;
  dueDate: string;
  assignedBy: string;
  createdAt: string;
}

export interface PolicyTemplate {
  id: string;
  name: string;
  policyIds: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  kind: PolicyKind;
  count: number;
  period: "week" | "month";
  categoryIds: string[];
  userIds: string[];
  active: boolean;
  updatedAt: string;
  updatedBy: string;
}

export type PolicyRuleInput = Omit<PolicyRule, "id" | "updatedAt" | "updatedBy">;

/** Biggest PDF that still fits in one save. */
export const MAX_POLICY_PDF_BYTES = 2.5 * 1024 * 1024;

const path = (id: string) => `/api/policies/${encodeURIComponent(id)}`;

export const getPolicyCategories = (kind?: CategoryKind) =>
  apiJson<PolicyCategory[]>(`/api/policies/categories${kind ? `?kind=${kind}` : ""}`);
export const createPolicyCategory = (input: PolicyCategoryInput) =>
  apiJson<PolicyCategory>("/api/policies/categories", send("POST", input));
export const updatePolicyCategory = (id: string, input: PolicyCategoryInput) =>
  apiJson<void>(`/api/policies/categories/${encodeURIComponent(id)}`, send("PATCH", input));
export const deletePolicyCategory = (id: string) => apiJson<void>(`/api/policies/categories/${encodeURIComponent(id)}`, send("DELETE"));

export const getPoliciesHome = () => apiJson<PoliciesHome>("/api/policies/home");

export async function getPolicies(kind: PolicyKind, query = ""): Promise<{ rows: PolicySummary[]; canManage: boolean }> {
  const params = new URLSearchParams({ kind });
  if (query.trim()) params.set("q", query.trim());
  const response = await fetch(`/api/policies?${params.toString()}`);
  const json = (await response.json().catch(() => null)) as { data?: PolicySummary[]; canManage?: boolean; message?: string } | null;
  if (!response.ok) throw new Error(json?.message ?? `Request failed (${response.status}).`);
  return { rows: json?.data ?? [], canManage: json?.canManage === true };
}

export const getPolicy = (id: string) => apiJson<PolicyDetail>(path(id));
export const getPolicyAttachment = (id: string, draft = false) =>
  apiJson<{ name: string; dataUrl: string }>(`${path(id)}/attachment${draft ? "?draft=1" : ""}`);
export const createPolicy = (input: PolicyInput) => apiJson<PolicySummary>("/api/policies", send("POST", input));
export const updatePolicy = (id: string, input: PolicyInput) => apiJson<PolicySummary>(path(id), send("PATCH", input));
export const deletePolicy = (id: string) => apiJson<void>(path(id), send("DELETE"));
export const publishPolicy = (id: string, options: { requireReack: boolean; changeNote: string; assignEveryone: boolean }) =>
  apiJson<PolicySummary>(`${path(id)}/publish`, send("POST", options));
export const acknowledgePolicy = (id: string) => apiJson<PolicySummary>(`${path(id)}/acknowledge`, send("POST"));
export const getPolicyAckStatus = (id: string) => apiJson<PolicyAckStatusRow[]>(`${path(id)}/status`);

export const getPolicyPeople = () => apiJson<PolicyPerson[]>("/api/policies/people");
export const getPolicyAssignments = (policyId = "") =>
  apiJson<PolicyAssignment[]>(`/api/policies/assignments${policyId ? `?policyId=${encodeURIComponent(policyId)}` : ""}`);
export const createPolicyAssignments = (input: { policyIds: string[]; userIds: string[]; dueDate: string }) =>
  apiJson<{ created: number }>("/api/policies/assignments", send("POST", input));
export const deletePolicyAssignment = (id: string) => apiJson<void>(`/api/policies/assignments/${encodeURIComponent(id)}`, send("DELETE"));

export const getPolicyTemplates = () => apiJson<PolicyTemplate[]>("/api/policies/templates");
export const createPolicyTemplate = (input: { name: string; policyIds: string[] }) =>
  apiJson<PolicyTemplate>("/api/policies/templates", send("POST", input));
export const updatePolicyTemplate = (id: string, input: { name: string; policyIds: string[] }) =>
  apiJson<void>(`/api/policies/templates/${encodeURIComponent(id)}`, send("PATCH", input));
export const deletePolicyTemplate = (id: string) => apiJson<void>(`/api/policies/templates/${encodeURIComponent(id)}`, send("DELETE"));
export const assignPolicyTemplate = (id: string, input: { userIds: string[]; dueDate: string }) =>
  apiJson<{ created: number }>(`/api/policies/templates/${encodeURIComponent(id)}/assign`, send("POST", input));

export const getPolicyRules = () => apiJson<PolicyRule[]>("/api/policies/rules");
export const createPolicyRule = (input: PolicyRuleInput) => apiJson<PolicyRule>("/api/policies/rules", send("POST", input));
export const updatePolicyRule = (id: string, input: PolicyRuleInput) =>
  apiJson<void>(`/api/policies/rules/${encodeURIComponent(id)}`, send("PATCH", input));
export const deletePolicyRule = (id: string) => apiJson<void>(`/api/policies/rules/${encodeURIComponent(id)}`, send("DELETE"));

export function policyLabel(policy: Pick<PolicySummary, "number" | "title">): string {
  return [policy.number, policy.title].filter(Boolean).join(" ");
}
