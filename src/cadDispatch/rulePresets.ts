/**
 * Product-defined rule packs (Batch K direction: tenants select packs; rules ship in code until catalog DB exists).
 * Merge order = checkbox / selection order in the UI (here: array order of selected ids).
 */

import type { CadRule } from "./ruleEngine.ts";

export type RulePackDefinition = {
  id: string;
  label: string;
  description: string;
  rules: CadRule[];
};

/** Message pipeline — member-facing parsed string + slots. */
export const MESSAGE_RULE_PACKS: RulePackDefinition[] = [
  {
    id: "msg_basic_cleanup",
    label: "Basic cleanup",
    description: "Trim and normalize line endings.",
    rules: [{ type: "trim" }, { type: "normalize_newlines" }],
  },
  {
    id: "msg_icomm_cfs",
    label: "ICOMM — capture CFS line",
    description: "Extracts CFS number from a line like CFS: 25-004567.",
    rules: [
      { type: "trim" },
      { type: "normalize_newlines" },
      {
        type: "extract_capture",
        pattern: "CFS:\\s*(\\S+)",
        group: 1,
        slot: "cfs",
        flags: "i",
      },
    ],
  },
  {
    id: "msg_icomm_nature",
    label: "ICOMM — capture NATURE line",
    description: "Extracts NATURE value when present.",
    rules: [
      {
        type: "extract_capture",
        pattern: "NATURE:\\s*([^\\r\\n]+)",
        group: 1,
        slot: "nature",
        flags: "i",
      },
    ],
  },
];

/** Incident pipeline — same engine; packs tuned for slot extraction used with field maps. */
export const INCIDENT_RULE_PACKS: RulePackDefinition[] = [
  {
    id: "inc_basic_cleanup",
    label: "Basic cleanup",
    description: "Trim and normalize line endings.",
    rules: [{ type: "trim" }, { type: "normalize_newlines" }],
  },
  {
    id: "inc_icomm_core",
    label: "ICOMM — CFS + address + nature",
    description: "Common ICOMM-style lines for merge key and mapping.",
    rules: [
      { type: "trim" },
      { type: "normalize_newlines" },
      {
        type: "extract_capture",
        pattern: "CFS:\\s*(\\S+)",
        group: 1,
        slot: "cfs",
        flags: "i",
      },
      {
        type: "extract_capture",
        pattern: "ADDR:\\s*([^\\r\\n]+)",
        group: 1,
        slot: "address",
        flags: "i",
      },
      {
        type: "extract_capture",
        pattern: "NATURE:\\s*([^\\r\\n]+)",
        group: 1,
        slot: "nature",
        flags: "i",
      },
    ],
  },
];

export function mergeRulePacksByIds(
  selectedIds: readonly string[],
  packs: readonly RulePackDefinition[],
): CadRule[] {
  const byId = new Map(packs.map((p) => [p.id, p] as const));
  const out: CadRule[] = [];
  for (const id of selectedIds) {
    const p = byId.get(id);
    if (p) out.push(...p.rules);
  }
  return out;
}

/** Merge checked packs in **catalog order** (order of `packs` array). */
export function mergeSelectedPacksInCatalogOrder(
  packs: readonly RulePackDefinition[],
  selectedIds: ReadonlySet<string>,
): CadRule[] {
  return packs.filter((p) => selectedIds.has(p.id)).flatMap((p) => p.rules);
}

export function serializeRulesForEditor(rules: CadRule[]): string {
  return JSON.stringify(rules, null, 2);
}
