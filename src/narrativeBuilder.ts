/**
 * Shared types and helpers for Narrative Builder (PRIORITY 11.1).
 * Used by admin page and NERIS report form.
 */

import { NERIS_FORM_FIELDS } from "./nerisMetadata";

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
      const rawValue = (formValues[seg.fieldId] ?? "").trim();
      const fieldMeta = NERIS_FORM_FIELDS.find((f) => f.id === seg.fieldId);
      if (fieldMeta?.inputKind === "date") {
        return formatNerisDateToMmDdYyyy(rawValue);
      }
      return rawValue;
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
