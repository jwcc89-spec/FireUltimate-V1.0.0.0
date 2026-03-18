/**
 * Tenant mutual aid configuration from Department Details (localStorage + server payload).
 * Used by NERIS form to restrict "Aid department name(s)" to admin-selected departments.
 */

import type { NerisValueOption } from "./nerisMetadata";

export const MUTUAL_AID_DEPARTMENT_DETAILS_STORAGE_KEY = "fire-ultimate-department-details";

/** Prefix for CORE-only local mutual aid rows (not sent as NERIS department_neris_id). */
export const LOCAL_AID_OPTION_PREFIX = "LOCAL_AID_OPT:";

/** Stored in DepartmentDetails.payloadJson.mutualAidDepartmentSelections */
export type MutualAidDepartmentStoredEntry =
  | { nerisId: string; name: string; state?: string }
  | { localOnly: true; name: string; state?: string };

function isFdOrFmId(id: string): boolean {
  return /^(FD|FM)\d{8}$/.test(id.trim());
}

/**
 * When Department Details has at least one mutual aid entry (NERIS or local-only),
 * returns those rows as CORE "Aid department name(s)" options.
 * - NERIS rows: value = FD/FM id (exported).
 * - Local-only: value = synthetic LOCAL_AID_OPT:… (label = friendly name; not exported as FD aid).
 *
 * Returns null when no mutual aid list is configured → NERIS form uses full entity directory.
 */
export function readConfiguredMutualAidAidDepartmentOptions(): NerisValueOption[] | null {
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
    const localDupCounts = new Map<string, number>();

    for (const entry of sel) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const o = entry as Record<string, unknown>;
      if (o.localOnly === true) {
        const name = String(o.name ?? "").trim();
        if (!name) {
          continue;
        }
        const state = String(o.state ?? "").trim();
        const dupKey = `${name}\u0000${state}`;
        const dup = (localDupCounts.get(dupKey) ?? 0) + 1;
        localDupCounts.set(dupKey, dup);
        const base = `${LOCAL_AID_OPTION_PREFIX}${encodeURIComponent(name)}|${encodeURIComponent(state)}`;
        const value = dup === 1 ? base : `${base}#${dup}`;
        const label =
          state && state !== "—" ? `${name} (${state})` : name;
        opts.push({ value, label });
        continue;
      }
      const nerisId = String(o.nerisId ?? "").trim();
      if (!isFdOrFmId(nerisId)) {
        continue;
      }
      const name = String(o.name ?? "").trim() || nerisId;
      opts.push({ value: nerisId, label: name });
    }
    return opts.length > 0 ? opts : null;
  } catch {
    return null;
  }
}

export function isLocalAidDepartmentFormValue(value: string): boolean {
  return (value ?? "").trim().startsWith(LOCAL_AID_OPTION_PREFIX);
}
