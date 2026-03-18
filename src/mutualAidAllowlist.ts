/**
 * Tenant mutual aid configuration from Department Details (localStorage + server payload).
 * Used by NERIS form to restrict "Aid department name(s)" to admin-selected departments.
 */

import type { NerisValueOption } from "./nerisMetadata";

export const MUTUAL_AID_DEPARTMENT_DETAILS_STORAGE_KEY = "fire-ultimate-department-details";

/** Stored in DepartmentDetails.payloadJson.mutualAidDepartmentSelections */
export type MutualAidDepartmentStoredEntry =
  | { nerisId: string; name: string; state?: string }
  | { localOnly: true; name: string; state?: string };

function isFdOrFmId(id: string): boolean {
  return /^(FD|FM)\d{8}$/.test(id.trim());
}

/**
 * Returns allowlist options for NERIS FD aid field, or null if tenant has not configured
 * any NERIS mutual aid departments (fall back to full directory in the form).
 */
export function readMutualAidNerisAllowlistFromStorage(): NerisValueOption[] | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(MUTUAL_AID_DEPARTMENT_DETAILS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw) as Record<string, unknown>;
    const sel = data.mutualAidDepartmentSelections;
    if (!Array.isArray(sel) || sel.length === 0) {
      return null;
    }
    const opts: NerisValueOption[] = [];
    for (const entry of sel) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const o = entry as Record<string, unknown>;
      if (o.localOnly === true) {
        continue;
      }
      const nerisId = String(o.nerisId ?? "").trim();
      if (!isFdOrFmId(nerisId)) {
        continue;
      }
      const name = String(o.name ?? "").trim() || nerisId;
      opts.push({ value: nerisId, label: `${name} (${nerisId})` });
    }
    return opts.length > 0 ? opts : null;
  } catch {
    return null;
  }
}
