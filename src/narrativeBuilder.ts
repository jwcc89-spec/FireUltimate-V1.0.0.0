/**
 * Shared types and helpers for Narrative Builder (PRIORITY 11.1).
 * Used by admin page and NERIS report form.
 */

import { getNerisValueOptions, NERIS_FORM_FIELDS } from "./nerisMetadata";

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

/** Build final narrative string from template + form values + user-fillable values (for NERIS form). */
export function buildNarrativeFromTemplate(
  template: NarrativeTemplate,
  formValues: Record<string, string>,
  userFillableValues: string[],
  questionAnswerValues: string[],
): string {
  let userIndex = 0;
  let questionIndex = 0;
  const parts = template.segments.map((seg) => {
    if (seg.type === "fillable") return seg.text.trim();
    if (seg.type === "neris") {
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
