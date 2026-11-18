/**
 * Shared types and helpers for Narrative Builder (PRIORITY 11.1).
 * Used by admin page and NERIS report form.
 */

import {
  getNerisValueOptions,
  NERIS_FORM_FIELDS,
  NERIS_FORM_SECTIONS,
  type NerisSectionId,
} from "./nerisMetadata";

// Segment types for building a narrative template
export type NarrativeSegmentFillable = { type: "fillable"; text: string };
export type NarrativeSegmentNeris = { type: "neris"; fieldId: string };
export type NarrativeSegmentUserFillable = {
  type: "userFillable";
  placeholderHint?: string;
};
export interface NarrativeQuestionRow {
  answer: string;
  response: string;
}
export type NarrativeSegmentQuestion = {
  type: "question";
  questionText: string;
  rows: NarrativeQuestionRow[];
};
export type NarrativeSegment =
  | NarrativeSegmentFillable
  | NarrativeSegmentNeris
  | NarrativeSegmentUserFillable
  | NarrativeSegmentQuestion;

export interface NarrativeTemplate {
  id: string;
  name: string;
  segments: NarrativeSegment[];
  createdAt?: string;
}

function formatNerisDateToMmDdYyyy(raw: string): string {
  const value = raw.trim();
  // Expected NERIS internal date format: YYYY-MM-DD
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, yyyy, mm, dd] = match;
  return `${mm}/${dd}/${yyyy}`;
}

/** Format a NERIS stored value into the user-visible narrative display. */
export function formatNerisValueForNarrative(fieldId: string, rawValue: string): string {
  const fieldMeta = NERIS_FORM_FIELDS.find((f) => f.id === fieldId);
  const value = rawValue.trim();
  if (!value) return "";

  if (fieldMeta?.inputKind === "date") {
    return formatNerisDateToMmDdYyyy(value);
  }

  if (fieldMeta?.optionsKey) {
    const options = getNerisValueOptions(fieldMeta.optionsKey);
    const byValue = new Map(options.map((o) => [o.value, o.label] as const));

    const toLastOnly = (mappedOrRaw: string) => {
      // Some NERIS enum values are hierarchical and stored/represented as
      // `A||B||C` (which our general label formatting displays as `A / B / C`).
      // For Narrative Builder we want the final label only (e.g. `C`).
      if (mappedOrRaw.includes(" / ")) {
        const parts = mappedOrRaw.split(" / ").map((p) => p.trim()).filter(Boolean);
        if (parts.length > 0) return parts[parts.length - 1]!;
      }
      return mappedOrRaw;
    };

    if (fieldMeta.inputKind === "multiselect") {
      const parts = value
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const mapped = parts.map((p) => {
        const label = byValue.get(p) ?? p;
        return p.includes("||") ? toLastOnly(label) : label;
      });
      return mapped.join(", ");
    }

    const mapped = byValue.get(value) ?? value;
    return value.includes("||") ? toLastOnly(mapped) : mapped;
  }

  return value;
}

/**
 * Values that live on the Resources unit cards (`resource_units_json`),
 * not as their own NERIS form fields. Narrative Builder can insert them.
 */
export const NARRATIVE_RESOURCE_FIELDS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "narrative_resource_units", label: "Apparatus that responded" },
  { id: "narrative_resource_unit_details", label: "Each unit (all values)" },
  { id: "narrative_resource_unit_types", label: "Unit types" },
  { id: "narrative_resource_staffing", label: "Staffing" },
  { id: "narrative_resource_response_modes", label: "Response modes" },
  { id: "narrative_resource_transport_modes", label: "Transport modes" },
  { id: "narrative_resource_personnel_count", label: "Number of personnel on scene" },
  { id: "narrative_resource_personnel_names", label: "Personnel on scene" },
  { id: "narrative_resource_unit_personnel", label: "Personnel by unit" },
  { id: "narrative_resource_dispatch_times", label: "Dispatch times" },
  { id: "narrative_resource_enroute_times", label: "En route times" },
  { id: "narrative_resource_staged_times", label: "Staged times" },
  { id: "narrative_resource_on_scene_times", label: "On scene times" },
  { id: "narrative_resource_returning_times", label: "Returning times" },
  { id: "narrative_resource_canceled_times", label: "Canceled times" },
  { id: "narrative_resource_clear_times", label: "Clear times" },
  { id: "narrative_resource_canceled_enroute", label: "Dispatched and canceled en route" },
  { id: "narrative_resource_report_writers", label: "Report writers" },
  { id: "narrative_resource_unit_narratives", label: "Unit narratives" },
];

const NARRATIVE_RESOURCE_FIELD_IDS = new Set(NARRATIVE_RESOURCE_FIELDS.map((field) => field.id));

export type NarrativePickerField = { id: string; label: string };

export function narrativePickerSections(): Array<{ id: NerisSectionId; label: string }> {
  return NERIS_FORM_SECTIONS.filter((section) => narrativePickerFields(section.id).length > 0).map(
    (section) => ({ id: section.id, label: section.label }),
  );
}

export function narrativePickerFields(sectionId: NerisSectionId): NarrativePickerField[] {
  const fields = NERIS_FORM_FIELDS.filter((field) => field.sectionId === sectionId).map((field) => ({
    id: field.id,
    label: field.label,
  }));
  if (sectionId === "resources") {
    fields.push(...NARRATIVE_RESOURCE_FIELDS);
  }
  return fields;
}

export function narrativeFieldSection(fieldId: string): NerisSectionId {
  if (NARRATIVE_RESOURCE_FIELD_IDS.has(fieldId)) return "resources";
  return NERIS_FORM_FIELDS.find((field) => field.id === fieldId)?.sectionId ?? "core";
}

export function narrativeFieldLabel(fieldId: string): string {
  const extra = NARRATIVE_RESOURCE_FIELDS.find((field) => field.id === fieldId);
  if (extra) return extra.label;
  return NERIS_FORM_FIELDS.find((field) => field.id === fieldId)?.label ?? fieldId;
}

type ResourceUnitCard = {
  unitId?: string;
  unitType?: string;
  staffing?: string;
  responseMode?: string;
  transportMode?: string;
  dispatchTime?: string;
  enrouteTime?: string;
  stagedTime?: string;
  onSceneTime?: string;
  returningTime?: string;
  canceledTime?: string;
  clearTime?: string;
  isCanceledEnroute?: boolean;
  personnel?: unknown;
  reportWriter?: string;
  unitNarrative?: string;
};

export type NarrativePersonnelOption = { value: string; label: string };

export type NarrativeBuildContext = {
  personnelOptions?: NarrativePersonnelOption[];
};

function normalizePersonnelToken(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/\//g, "_")
    .toUpperCase()
    .replace(/[^A-Z0-9_|]/g, "");
}

/** The unit card stores personnel as comma-separated usernames, or sometimes as a list. */
function personnelTokens(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => personnelTokens(entry));
  }
  if (raw && typeof raw === "object") {
    const row = raw as Record<string, unknown>;
    return personnelTokens(row.value ?? row.username ?? row.name ?? row.label ?? "");
  }
  const text = String(raw ?? "").trim();
  if (!text) return [];
  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function personnelDisplayNames(raw: unknown, options: NarrativePersonnelOption[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const token of personnelTokens(raw)) {
    const normalized = normalizePersonnelToken(token);
    const match = options.find(
      (option) =>
        option.value === token || normalizePersonnelToken(option.value) === normalized,
    );
    const label = (match?.label || token).trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    names.push(label);
  }
  return names;
}

function onScenePersonnelNames(units: ResourceUnitCard[], options: NarrativePersonnelOption[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const unit of units) {
    if (unit.isCanceledEnroute === true) continue;
    for (const name of personnelDisplayNames(unit.personnel, options)) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }
  return names;
}

function parseResourceUnitCards(formValues: Record<string, string>): ResourceUnitCard[] {
  const raw = (formValues.resource_units_json ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is ResourceUnitCard => Boolean(row) && typeof row === "object");
  } catch {
    return [];
  }
}

function formatResourceClock(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  return `${month}/${day}/${year.slice(2)} ${hour}:${minute}`;
}

function unitLabel(unit: ResourceUnitCard, index: number): string {
  const id = (unit.unitId ?? "").trim();
  return id || `Unit ${index + 1}`;
}

function joinUnitValues(
  units: ResourceUnitCard[],
  read: (unit: ResourceUnitCard) => string,
): string {
  return units
    .map((unit, index) => {
      const value = read(unit).trim();
      if (!value) return "";
      return `${unitLabel(unit, index)}: ${value}`;
    })
    .filter((line) => line.length > 0)
    .join("; ");
}

function formatUnitDetails(
  unit: ResourceUnitCard,
  index: number,
  options: NarrativePersonnelOption[],
): string {
  const parts: string[] = [unitLabel(unit, index)];
  const type = formatNerisValueForNarrative("resource_primary_unit_type", unit.unitType ?? "");
  if (type) parts.push(type);
  const staffing = (unit.staffing ?? "").trim();
  if (staffing) parts.push(`staffing ${staffing}`);
  const response = formatNerisValueForNarrative(
    "resource_primary_unit_response_mode",
    unit.responseMode ?? "",
  );
  if (response) parts.push(`response ${response}`);
  const transport = formatNerisValueForNarrative(
    "resource_primary_unit_response_mode",
    unit.transportMode ?? "",
  );
  if (transport) parts.push(`transport ${transport}`);
  const personnel = personnelDisplayNames(unit.personnel, options).join(", ");
  if (personnel) parts.push(`personnel ${personnel}`);
  const times: Array<[string, string | undefined]> = [
    ["dispatch", unit.dispatchTime],
    ["en route", unit.enrouteTime],
    ["staged", unit.stagedTime],
    ["on scene", unit.onSceneTime],
    ["returning", unit.returningTime],
    ["canceled", unit.canceledTime],
    ["clear", unit.clearTime],
  ];
  for (const [label, raw] of times) {
    const formatted = formatResourceClock(raw);
    if (formatted) parts.push(`${label} ${formatted}`);
  }
  if (unit.isCanceledEnroute) parts.push("dispatched and canceled en route");
  const writer = personnelDisplayNames(unit.reportWriter, options).join(", ");
  if (writer) parts.push(`report writer ${writer}`);
  const narrative = (unit.unitNarrative ?? "").trim();
  if (narrative) parts.push(narrative);
  return parts.join(", ");
}

/** Narrative text for a Resources card value. Returns null when the id is a normal NERIS field. */
export function formatNarrativeResourceValue(
  fieldId: string,
  formValues: Record<string, string>,
  context?: NarrativeBuildContext,
): string | null {
  if (!NARRATIVE_RESOURCE_FIELD_IDS.has(fieldId)) return null;
  const units = parseResourceUnitCards(formValues);
  const personnelOptions = context?.personnelOptions ?? [];
  if (
    fieldId === "narrative_resource_personnel_count" ||
    fieldId === "narrative_resource_personnel_names"
  ) {
    const names = onScenePersonnelNames(units, personnelOptions);
    if (fieldId === "narrative_resource_personnel_count") {
      return units.length === 0 ? "" : String(names.length);
    }
    return names.join(", ");
  }
  if (units.length === 0) return "";
  if (fieldId === "narrative_resource_units") {
    return units
      .map((unit) => (unit.unitId ?? "").trim())
      .filter((id) => id.length > 0)
      .join(", ");
  }
  if (fieldId === "narrative_resource_unit_details") {
    return units.map((unit, index) => formatUnitDetails(unit, index, personnelOptions)).join("; ");
  }
  if (fieldId === "narrative_resource_unit_types") {
    return joinUnitValues(units, (unit) =>
      formatNerisValueForNarrative("resource_primary_unit_type", unit.unitType ?? ""),
    );
  }
  if (fieldId === "narrative_resource_staffing") {
    return joinUnitValues(units, (unit) => unit.staffing ?? "");
  }
  if (fieldId === "narrative_resource_response_modes") {
    return joinUnitValues(units, (unit) =>
      formatNerisValueForNarrative("resource_primary_unit_response_mode", unit.responseMode ?? ""),
    );
  }
  if (fieldId === "narrative_resource_transport_modes") {
    return joinUnitValues(units, (unit) =>
      formatNerisValueForNarrative("resource_primary_unit_response_mode", unit.transportMode ?? ""),
    );
  }
  if (fieldId === "narrative_resource_unit_personnel") {
    return joinUnitValues(units, (unit) => personnelDisplayNames(unit.personnel, personnelOptions).join(", "));
  }
  if (fieldId === "narrative_resource_dispatch_times") {
    return joinUnitValues(units, (unit) => formatResourceClock(unit.dispatchTime));
  }
  if (fieldId === "narrative_resource_enroute_times") {
    return joinUnitValues(units, (unit) => formatResourceClock(unit.enrouteTime));
  }
  if (fieldId === "narrative_resource_staged_times") {
    return joinUnitValues(units, (unit) => formatResourceClock(unit.stagedTime));
  }
  if (fieldId === "narrative_resource_on_scene_times") {
    return joinUnitValues(units, (unit) => formatResourceClock(unit.onSceneTime));
  }
  if (fieldId === "narrative_resource_returning_times") {
    return joinUnitValues(units, (unit) => formatResourceClock(unit.returningTime));
  }
  if (fieldId === "narrative_resource_canceled_times") {
    return joinUnitValues(units, (unit) => formatResourceClock(unit.canceledTime));
  }
  if (fieldId === "narrative_resource_clear_times") {
    return joinUnitValues(units, (unit) => formatResourceClock(unit.clearTime));
  }
  if (fieldId === "narrative_resource_canceled_enroute") {
    return joinUnitValues(units, (unit) => (unit.isCanceledEnroute ? "Yes" : "No"));
  }
  if (fieldId === "narrative_resource_report_writers") {
    return joinUnitValues(units, (unit) =>
      personnelDisplayNames(unit.reportWriter, personnelOptions).join(", "),
    );
  }
  if (fieldId === "narrative_resource_unit_narratives") {
    return joinUnitValues(units, (unit) => unit.unitNarrative ?? "");
  }
  return "";
}

/** Build final narrative string from template + form values + user-fillable values (for NERIS form). */
export function buildNarrativeFromTemplate(
  template: NarrativeTemplate,
  formValues: Record<string, string>,
  userFillableValues: string[],
  questionAnswerValues: string[],
  context?: NarrativeBuildContext,
): string {
  let userIndex = 0;
  let questionIndex = 0;
  const parts = template.segments.map((seg) => {
    if (seg.type === "fillable") return seg.text.trim();
    if (seg.type === "neris") {
      const resourceValue = formatNarrativeResourceValue(seg.fieldId, formValues, context);
      if (resourceValue !== null) return resourceValue;
      return formatNerisValueForNarrative(seg.fieldId, formValues[seg.fieldId] ?? "");
    }
    if (seg.type === "userFillable") {
      const value = userFillableValues[userIndex] ?? "";
      userIndex += 1;
      return value.trim();
    }
    if (seg.type === "question") {
      const selectedAnswer = questionAnswerValues[questionIndex] ?? "";
      questionIndex += 1;
      const match = seg.rows.find((r) => r.answer === selectedAnswer);
      return (match?.response ?? "").trim();
    }
    return "";
  });

  // Join parts with spaces so templates read like sentences.
  return parts.filter((p) => p.length > 0).join(" ");
}
