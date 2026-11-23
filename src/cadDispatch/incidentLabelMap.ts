/**
 * Plain label-to-field setup for Incident Parsing.
 * Saves as the existing extract rules + field map. No new database columns.
 */

import { escapeRegexLiteral, tryDecodeLiteralPattern } from "./regexEscape.ts";
import {
  buildMappedIncidentFieldsPreview,
  extractMergeKeyFromSlots,
} from "./incidentMappingPreview.ts";
import { parseCadRulesJson, runCadRulePipeline, type CadRule } from "./ruleEngine.ts";

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

export type IncidentLabelField = {
  id: IncidentLabelFieldId;
  label: string;
  /** Incident column written by ingest. Incident number is the merge key, not a mapped column. */
  target: string | null;
  notes: boolean;
  hint: string;
};

export const INCIDENT_LABEL_FIELDS: readonly IncidentLabelField[] = [
  {
    id: "incidentNumber",
    label: "Incident number",
    target: null,
    notes: false,
    hint: "Later emails with this same number update the same incident.",
  },
  {
    id: "dispatchNumber",
    label: "Dispatch number",
    target: "dispatchNumber",
    notes: false,
    hint: "Leave the label blank to copy the incident number.",
  },
  {
    id: "incidentType",
    label: "Incident type",
    target: "incidentType",
    notes: false,
    hint: "The words after this label are saved as the incident type.",
  },
  {
    id: "initialDispatchCode",
    label: "Initial dispatch code",
    target: "initialDispatchCode",
    notes: false,
    hint: "The words after this label are saved as the initial dispatch code.",
  },
  {
    id: "priority",
    label: "Priority",
    target: "priority",
    notes: false,
    hint: "The words after this label are saved as the priority.",
  },
  {
    id: "stillDistrict",
    label: "Still district",
    target: "stillDistrict",
    notes: false,
    hint: "The words after this label are saved as the still district.",
  },
  {
    id: "reportedBy",
    label: "Reported by",
    target: "reportedBy",
    notes: false,
    hint: "The words after this label are saved as reported by.",
  },
  {
    id: "assignedUnits",
    label: "Assigned units",
    target: "assignedUnits",
    notes: false,
    hint: "The words after this label are saved as assigned units.",
  },
  {
    id: "address",
    label: "Address",
    target: "address",
    notes: false,
    hint: "The words after this label, or the next line, are saved as the address.",
  },
  {
    id: "callbackNumber",
    label: "Callback number",
    target: "callbackNumber",
    notes: false,
    hint: "The words after this label are saved as the callback number.",
  },
  {
    id: "dispatchNotes",
    label: "Dispatch notes",
    target: "dispatchNotes",
    notes: true,
    hint: "Text after this label is saved until the next blank line. Leave blank to save the full email as the notes.",
  },
];

const LINE_PREFIX = "(?:^|\\n)\\s*";
const LINE_SUFFIX = "\\s*:?\\s*(?:\\n\\s*)?([^\\n]+)";
const NOTES_SUFFIX = "\\s*:?\\s*([^\\n]+(?:\\n(?!\\s*\\n)[^\\n]+)*)";

export function emptyIncidentLabels(): Record<IncidentLabelFieldId, string> {
  return {
    incidentNumber: "",
    dispatchNumber: "",
    incidentType: "",
    initialDispatchCode: "",
    priority: "",
    stillDistrict: "",
    reportedBy: "",
    assignedUnits: "",
    address: "",
    callbackNumber: "",
    dispatchNotes: "",
  };
}

function cleanLabel(label: string): string {
  return label.trim().replace(/\s*:+\s*$/, "");
}

export function patternForEmailLabel(label: string, notes: boolean): string {
  const escaped = escapeRegexLiteral(cleanLabel(label));
  return `${LINE_PREFIX}${escaped}${notes ? NOTES_SUFFIX : LINE_SUFFIX}`;
}

function labelFromPattern(pattern: string, notes: boolean): string | null {
  const suffix = notes ? NOTES_SUFFIX : LINE_SUFFIX;
  if (!pattern.startsWith(LINE_PREFIX) || !pattern.endsWith(suffix)) return null;
  const mid = pattern.slice(LINE_PREFIX.length, pattern.length - suffix.length);
  const decoded = tryDecodeLiteralPattern(mid);
  if (decoded == null || !decoded.trim()) return null;
  return decoded;
}

export function buildIncidentLabelConfig(labels: Record<IncidentLabelFieldId, string>): {
  rules: CadRule[];
  fieldMap: Record<string, string>;
  incidentNumberExtract: { slot: string } | null;
} {
  const rules: CadRule[] = [{ type: "trim" }, { type: "normalize_newlines" }];
  const fieldMap: Record<string, string> = {};
  let incidentNumberExtract: { slot: string } | null = null;

  for (const field of INCIDENT_LABEL_FIELDS) {
    const label = cleanLabel(labels[field.id] ?? "");
    if (!label) continue;
    rules.push({
      type: "extract_capture",
      pattern: patternForEmailLabel(label, field.notes),
      group: 1,
      slot: field.id,
      flags: "i",
    });
    if (field.id === "incidentNumber") {
      incidentNumberExtract = { slot: "incidentNumber" };
    } else if (field.target) {
      fieldMap[field.id] = field.target;
    }
  }

  return { rules, fieldMap, incidentNumberExtract };
}

export function labelsFromSavedRules(rawRules: unknown): {
  recognized: boolean;
  labels: Record<IncidentLabelFieldId, string>;
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
    if (rule.type !== "extract_capture" || rule.group !== 1 || (rule.flags ?? "") !== "i") {
      return { recognized: false, labels };
    }
    const field = INCIDENT_LABEL_FIELDS.find((item) => item.id === rule.slot);
    if (!field || seen.has(field.id)) return { recognized: false, labels };
    const label = labelFromPattern(rule.pattern, field.notes);
    if (!label) return { recognized: false, labels };
    labels[field.id] = label;
    seen.add(field.id);
  }
  return { recognized: true, labels };
}

/** Label on the line that contains the highlighted value. */
export function labelOnLineOfSelection(text: string, selected: string): string | null {
  const needle = selected.trim();
  if (!needle || !text) return null;
  const idx = text.indexOf(needle);
  if (idx < 0) return null;
  const lineStart = text.lastIndexOf("\n", idx - 1) + 1;
  const lineEnd = text.indexOf("\n", idx);
  const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const colon = line.indexOf(":");
  if (colon < 0) {
    if (lineStart === 0) return null;
    const prevEnd = lineStart - 1;
    const prevStart = text.lastIndexOf("\n", prevEnd - 1) + 1;
    const prev = text.slice(prevStart, prevEnd);
    const prevColon = prev.indexOf(":");
    if (prevColon < 0) return null;
    const prevLabel = prev.slice(0, prevColon).trim();
    const prevValue = prev.slice(prevColon + 1).trim();
    if (!prevLabel || prevValue) return null;
    return prevLabel;
  }
  const label = line.slice(0, colon).trim();
  const value = line.slice(colon + 1).trim();
  if (!label || !value) return null;
  if (!value.toLowerCase().includes(needle.toLowerCase()) && !needle.toLowerCase().includes(value.toLowerCase())) {
    return null;
  }
  return label;
}

export type IncidentPreviewRow = {
  id: string;
  label: string;
  value: string;
};

export function previewIncidentFromLabels(
  plainText: string,
  labels: Record<IncidentLabelFieldId, string>,
): { ok: true; rows: IncidentPreviewRow[] } | { ok: false; error: string } {
  const built = buildIncidentLabelConfig(labels);
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
