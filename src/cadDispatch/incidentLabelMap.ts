/**
 * Incident Parsing for semicolon-separated CAD text.
 * Each incident field stores which part of the email to use.
 * Saved as the existing extract rules + field map. No new database columns.
 */

import {
  buildMappedIncidentFieldsPreview,
  extractMergeKeyFromSlots,
} from "./incidentMappingPreview.ts";
import { escapeRegexLiteral } from "./regexEscape.ts";
import { parseCadRulesJson, runCadRulePipeline, type CadRule } from "./ruleEngine.ts";

export const DEFAULT_SECTION_SEPARATOR = ";";

/** One visible character. A blank value means the default semicolon. */
export function normalizeSectionSeparator(value: string): string {
  const char = Array.from(value)[0] ?? "";
  if (!char || /\s/.test(char)) return DEFAULT_SECTION_SEPARATOR;
  return char;
}

export function separatorFromExtract(raw: unknown): string {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const value = (raw as { separator?: unknown }).separator;
    if (typeof value === "string") return normalizeSectionSeparator(value);
  }
  return DEFAULT_SECTION_SEPARATOR;
}

export type IncidentLabelFieldId =
  | "incidentNumber"
  | "dispatchNumber"
  | "incidentType"
  | "initialDispatchCode"
  | "priority"
  | "stillDistrict"
  | "reportedBy"
  | "assignedUnits"
  | "address"
  | "callbackNumber"
  | "dispatchNotes";

export type IncidentPartChoice = {
  /** Zero-based part when the email is split on semicolons. */
  index: number;
  /** Use only the words after a colon inside that part, such as the value in "CAD Notes: None". */
  afterLabel: boolean;
};

export type IncidentLabelField = {
  id: IncidentLabelFieldId;
  label: string;
  /** Incident column written by ingest. Incident number is the merge key, not a mapped column. */
  target: string | null;
  hint: string;
};

export const INCIDENT_LABEL_FIELDS: readonly IncidentLabelField[] = [
  {
    id: "incidentNumber",
    label: "Incident number",
    target: null,
    hint: "Later emails with this same number update the same incident.",
  },
  {
    id: "dispatchNumber",
    label: "Dispatch number",
    target: "dispatchNumber",
    hint: "Leave this unused to copy the incident number.",
  },
  {
    id: "incidentType",
    label: "Incident type",
    target: "incidentType",
    hint: "Choose the part that names the type of call.",
  },
  {
    id: "initialDispatchCode",
    label: "Initial dispatch code",
    target: "initialDispatchCode",
    hint: "Choose the part that holds the dispatch code.",
  },
  {
    id: "priority",
    label: "Priority",
    target: "priority",
    hint: "Choose the part that holds the priority.",
  },
  {
    id: "stillDistrict",
    label: "Still district",
    target: "stillDistrict",
    hint: "Choose the part that holds the still district.",
  },
  {
    id: "reportedBy",
    label: "Reported by",
    target: "reportedBy",
    hint: "Choose the part that names who reported the call.",
  },
  {
    id: "assignedUnits",
    label: "Assigned units",
    target: "assignedUnits",
    hint: "Choose the part that lists the units.",
  },
  {
    id: "address",
    label: "Address",
    target: "address",
    hint: "Choose the part that holds the street address.",
  },
  {
    id: "callbackNumber",
    label: "Callback number",
    target: "callbackNumber",
    hint: "Choose the part that holds the callback number.",
  },
  {
    id: "dispatchNotes",
    label: "Dispatch notes",
    target: "dispatchNotes",
    hint: "Choose the notes part. If you leave this unused, the full email is saved as the notes.",
  },
];

function separatorPattern(separator: string): { head: string; wholeTail: string; afterTail: string } {
  const active = normalizeSectionSeparator(separator);
  const escaped = escapeRegexLiteral(active);
  const classBody = active.replace(/[\\\]\-^]/g, "\\$&");
  const notSeparator = `[^${classBody}\\n]`;
  return {
    head: `(?:^|\\n)(?:${notSeparator}*${escaped}){`,
    wholeTail: `}\\s*(${notSeparator}+)`,
    afterTail: `}\\s*[^:${classBody}\\n]*:\\s*(${notSeparator}*)`,
  };
}

export function emptyIncidentLabels(): Record<IncidentLabelFieldId, IncidentPartChoice | null> {
  return {
    incidentNumber: null,
    dispatchNumber: null,
    incidentType: null,
    initialDispatchCode: null,
    priority: null,
    stillDistrict: null,
    reportedBy: null,
    assignedUnits: null,
    address: null,
    callbackNumber: null,
    dispatchNotes: null,
  };
}

/** Split one CAD line on the separator character. Uses the first line that contains it. */
export function splitDispatchParts(text: string, separator = DEFAULT_SECTION_SEPARATOR): string[] {
  const active = normalizeSectionSeparator(separator);
  const source =
    text
      .split(/\n/)
      .map((line) => line.trim())
      .find((line) => line.includes(active)) ?? text.trim();
  const parts = source.split(active).map((part) => part.trim());
  while (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

export function valueAfterLabel(part: string): string | null {
  const colon = part.indexOf(":");
  if (colon < 0) return null;
  return part.slice(colon + 1).trim();
}

export function partChoiceKey(choice: IncidentPartChoice | null): string {
  if (!choice) return "";
  return choice.afterLabel ? `${choice.index}:after` : String(choice.index);
}

export function fieldIdForSection(
  choices: Record<IncidentLabelFieldId, IncidentPartChoice | null>,
  index: number,
): IncidentLabelFieldId | "" {
  for (const field of INCIDENT_LABEL_FIELDS) {
    const choice = choices[field.id];
    if (choice && choice.index === index) return field.id;
  }
  return "";
}

export function assignSectionToField(
  choices: Record<IncidentLabelFieldId, IncidentPartChoice | null>,
  index: number,
  fieldId: string,
): Record<IncidentLabelFieldId, IncidentPartChoice | null> {
  const next: Record<IncidentLabelFieldId, IncidentPartChoice | null> = { ...choices };
  for (const field of INCIDENT_LABEL_FIELDS) {
    const choice = next[field.id];
    if (choice && choice.index === index) next[field.id] = null;
  }
  const selected = INCIDENT_LABEL_FIELDS.find((field) => field.id === fieldId);
  if (selected) next[selected.id] = { index, afterLabel: false };
  return next;
}

export function partChoiceFromKey(key: string): IncidentPartChoice | null {
  if (!key) return null;
  const afterLabel = key.endsWith(":after");
  const raw = afterLabel ? key.slice(0, -":after".length) : key;
  if (!/^\d+$/.test(raw)) return null;
  return { index: Number(raw), afterLabel };
}

function patternForPart(choice: IncidentPartChoice, separator: string): string {
  const pieces = separatorPattern(separator);
  return `${pieces.head}${choice.index}${choice.afterLabel ? pieces.afterTail : pieces.wholeTail}`;
}

function choiceFromPattern(pattern: string, separator: string): IncidentPartChoice | null {
  const pieces = separatorPattern(separator);
  if (!pattern.startsWith(pieces.head)) return null;
  const tail = pattern.endsWith(pieces.afterTail)
    ? pieces.afterTail
    : pattern.endsWith(pieces.wholeTail)
      ? pieces.wholeTail
      : null;
  if (!tail) return null;
  const mid = pattern.slice(pieces.head.length, pattern.length - tail.length);
  if (!/^\d+$/.test(mid)) return null;
  return { index: Number(mid), afterLabel: tail === pieces.afterTail };
}

export function buildIncidentLabelConfig(
  choices: Record<IncidentLabelFieldId, IncidentPartChoice | null>,
  separator = DEFAULT_SECTION_SEPARATOR,
): {
  rules: CadRule[];
  fieldMap: Record<string, string>;
  incidentNumberExtract: { separator: string; slot?: string };
} {
  const active = normalizeSectionSeparator(separator);
  const rules: CadRule[] = [{ type: "trim" }, { type: "normalize_newlines" }];
  const fieldMap: Record<string, string> = {};
  const incidentNumberExtract: { separator: string; slot?: string } = { separator: active };

  for (const field of INCIDENT_LABEL_FIELDS) {
    const choice = choices[field.id];
    if (!choice || choice.index < 0) continue;
    rules.push({
      type: "extract_capture",
      pattern: patternForPart(choice, active),
      group: 1,
      slot: field.id,
      flags: "",
    });
    if (field.id === "incidentNumber") {
      incidentNumberExtract.slot = "incidentNumber";
    } else if (field.target) {
      fieldMap[field.id] = field.target;
    }
  }

  return { rules, fieldMap, incidentNumberExtract };
}

export function labelsFromSavedRules(rawRules: unknown, separator = DEFAULT_SECTION_SEPARATOR): {
  recognized: boolean;
  labels: Record<IncidentLabelFieldId, IncidentPartChoice | null>;
} {
  const labels = emptyIncidentLabels();
  let rules: CadRule[];
  try {
    rules = parseCadRulesJson(rawRules);
  } catch {
    return { recognized: false, labels };
  }
  if (rules.length === 0) return { recognized: true, labels };
  if (rules.length < 2 || rules[0].type !== "trim" || rules[1].type !== "normalize_newlines") {
    return { recognized: false, labels };
  }
  const seen = new Set<string>();
  for (const rule of rules.slice(2)) {
    if (rule.type !== "extract_capture" || rule.group !== 1 || (rule.flags ?? "") !== "") {
      return { recognized: false, labels };
    }
    const field = INCIDENT_LABEL_FIELDS.find((item) => item.id === rule.slot);
    if (!field || seen.has(field.id)) return { recognized: false, labels };
    const choice = choiceFromPattern(rule.pattern, separator);
    if (!choice) return { recognized: false, labels };
    labels[field.id] = choice;
    seen.add(field.id);
  }
  return { recognized: true, labels };
}

/** The semicolon part that contains the highlighted words. */
export function partFromSelection(
  text: string,
  selected: string,
  separator = DEFAULT_SECTION_SEPARATOR,
): IncidentPartChoice | null {
  const active = normalizeSectionSeparator(separator);
  const needle = selected.trim();
  if (!needle || !text.includes(needle)) return null;
  const idx = text.indexOf(needle);
  const start = text.lastIndexOf(active, idx);
  const end = text.indexOf(active, idx);
  const segment = text.slice(start + 1, end === -1 ? text.length : end).trim();
  const index = splitDispatchParts(text, active).indexOf(segment);
  if (index < 0) return null;
  const colon = segment.indexOf(":");
  if (colon >= 0) {
    const value = segment.slice(colon + 1).trim();
    if (value && needle.toLowerCase() === value.toLowerCase()) {
      return { index, afterLabel: true };
    }
  }
  return { index, afterLabel: false };
}

export type IncidentPreviewRow = {
  id: string;
  label: string;
  value: string;
};

export function previewIncidentFromLabels(
  plainText: string,
  choices: Record<IncidentLabelFieldId, IncidentPartChoice | null>,
  separator = DEFAULT_SECTION_SEPARATOR,
): { ok: true; rows: IncidentPreviewRow[] } | { ok: false; error: string } {
  const built = buildIncidentLabelConfig(choices, separator);
  const result = runCadRulePipeline(plainText, built.rules);
  if (!result.ok) return { ok: false, error: result.error };
  const mergeKey = extractMergeKeyFromSlots(result.slots, built.incidentNumberExtract);
  const mapped = buildMappedIncidentFieldsPreview(result.slots, built.fieldMap, result.text);
  const dispatchNumber = mapped.dispatchNumber || mergeKey;
  const initialDispatchCode = mapped.initialDispatchCode || mapped.mapReference || "";
  const rows: IncidentPreviewRow[] = [
    { id: "incidentNumber", label: "Incident number", value: mergeKey },
    { id: "dispatchNumber", label: "Dispatch number", value: dispatchNumber },
    { id: "incidentType", label: "Incident type", value: mapped.incidentType || "" },
    { id: "initialDispatchCode", label: "Initial dispatch code", value: initialDispatchCode },
    { id: "priority", label: "Priority", value: mapped.priority || "" },
    { id: "stillDistrict", label: "Still district", value: mapped.stillDistrict || "" },
    { id: "status", label: "Status", value: "Draft" },
    { id: "reportedBy", label: "Reported by", value: mapped.reportedBy || "" },
    { id: "assignedUnits", label: "Assigned units", value: mapped.assignedUnits || "" },
    { id: "address", label: "Address", value: mapped.address || "" },
    { id: "callbackNumber", label: "Callback number", value: mapped.callbackNumber || "" },
    { id: "dispatchNotes", label: "Dispatch notes", value: mapped.dispatchNotes || "" },
  ];
  return { ok: true, rows };
}
