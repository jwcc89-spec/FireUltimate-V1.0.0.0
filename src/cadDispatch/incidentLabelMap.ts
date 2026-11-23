/**
 * Incident Parsing for semicolon-separated CAD text.
 * Each incident field stores which part of the email to use.
 * Saved as the existing extract rules + field map. No new database columns.
 */

import { buildMappedIncidentFieldsPreview } from "./incidentMappingPreview.ts";
import { escapeRegexLiteral } from "./regexEscape.ts";
import { parseCadRulesJson, runCadRulePipeline, type CadRule } from "./ruleEngine.ts";

export const DEFAULT_SECTION_SEPARATOR = ";";
export const DEFAULT_INCIDENT_NUMBER_FORMAT = "{yy}-{seq}";
export const DEFAULT_RESET_MONTH = 11;
export const DEFAULT_RESET_DAY = 1;
export const DEFAULT_RESET_TIME = "00:00";
const INCIDENT_NUMBER_TIME_ZONE = "America/Chicago";

export type CadNumberReset = {
  month: number;
  day: number;
  time: string;
};

/** One visible character. A blank value means the default semicolon. */
export function normalizeSectionSeparator(value: string): string {
  const char = Array.from(value)[0] ?? "";
  if (!char || /\s/.test(char)) return DEFAULT_SECTION_SEPARATOR;
  return char;
}

/** Call number from a follow-up email, such as "CAD CFS: 26018313". Empty for a new-call email. */
export function followUpCallNumber(text: string): string {
  const match = text.match(/CAD CFS:\s*([0-9A-Za-z-]+)/i);
  return match?.[1]?.trim() ?? "";
}

/** Value after a label, stopping at a comma, semicolon, or new line. */
export function labeledCadValue(text: string, label: string): string {
  const match = text.match(new RegExp(`${escapeRegexLiteral(label)}\\s*:\\s*([^;,\\n]+)`, "i"));
  return match?.[1]?.trim() ?? "";
}

/** Digits at the end of "Department CFS: CrescentIroquoisFPD2600089". */
export function departmentCfsDigits(text: string): string {
  const raw = labeledCadValue(text, "Department CFS");
  const match = raw.match(/(\d+)\s*$/);
  return match?.[1] ?? "";
}

/**
 * CAD number used to match later emails. Follow-up mail uses "CAD CFS:".
 * A new-call email uses the number before the first separator.
 */
export function cadDispatchNumber(text: string, separator = DEFAULT_SECTION_SEPARATOR): string {
  const labeled = followUpCallNumber(text);
  if (labeled) return labeled;
  const active = normalizeSectionSeparator(separator);
  const first = text.trim().split(active)[0]?.trim() ?? "";
  if (/^\d[\dA-Za-z-]*$/.test(first)) return first;
  return "";
}

/** Turn a department CFS into the incident number. `{yy}-{seq}` makes 2600089 into 26-00089. */
export function formatIncidentNumber(cfs: string, pattern = DEFAULT_INCIDENT_NUMBER_FORMAT): string {
  const digits = cfs.trim();
  if (!digits) return "";
  const template = pattern.trim() || DEFAULT_INCIDENT_NUMBER_FORMAT;
  return template
    .replaceAll("{cfs}", digits)
    .replaceAll("{yy}", digits.slice(0, 2))
    .replaceAll("{seq}", digits.slice(2));
}

export function incidentNumberFormatFromExtract(raw: unknown): string {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const value = (raw as { incidentNumberFormat?: unknown }).incidentNumberFormat;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return DEFAULT_INCIDENT_NUMBER_FORMAT;
}

export function parseResetTime(value: string): { hour: number; minute: number } | null {
  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function resetFromExtract(raw: unknown): CadNumberReset {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const month = Number(source.resetMonth);
  const day = Number(source.resetDay);
  const time = typeof source.resetTime === "string" ? source.resetTime : DEFAULT_RESET_TIME;
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : DEFAULT_RESET_MONTH,
    day: Number.isInteger(day) && day >= 1 && day <= 31 ? day : DEFAULT_RESET_DAY,
    time: parseResetTime(time) ? time : DEFAULT_RESET_TIME,
  };
}

function chicagoParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: INCIDENT_NUMBER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** UTC instant for a clock time in America/Chicago. */
export function chicagoWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const seen = chicagoParts(new Date(utc));
    const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    utc += desired - seenUtc;
  }
  return new Date(utc);
}

/** The two-digit year is the calendar year of the next reset. November 1, 2026 starts 27. */
export function currentFiscalPeriod(now: Date, reset: CadNumberReset): { yy: string; periodStart: Date } {
  const parsed = parseResetTime(reset.time) ?? { hour: 0, minute: 0 };
  const nowParts = chicagoParts(now);
  let start = chicagoWallTimeToUtc(nowParts.year, reset.month, reset.day, parsed.hour, parsed.minute);
  if (now.getTime() < start.getTime()) {
    start = chicagoWallTimeToUtc(nowParts.year - 1, reset.month, reset.day, parsed.hour, parsed.minute);
  }
  const startParts = chicagoParts(start);
  const nextStart = chicagoWallTimeToUtc(startParts.year + 1, reset.month, reset.day, parsed.hour, parsed.minute);
  const yy = String(chicagoParts(nextStart).year).slice(-2);
  return { yy, periodStart: start };
}

export function formatAssignedIncidentNumber(sequence: number, yy: string, pattern: string): string {
  const seq = String(Math.max(1, sequence)).padStart(3, "0");
  const template = pattern.trim() || DEFAULT_INCIDENT_NUMBER_FORMAT;
  return template.replaceAll("{yy}", yy).replaceAll("{seq}", seq);
}

export function incidentNumberSeriesExample(
  now: Date,
  reset: CadNumberReset,
  pattern = DEFAULT_INCIDENT_NUMBER_FORMAT,
): string {
  const { yy } = currentFiscalPeriod(now, reset);
  const first = formatAssignedIncidentNumber(1, yy, pattern);
  const second = formatAssignedIncidentNumber(2, yy, pattern);
  return `${first}, then ${second}`;
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
  | "dispatchNotes"
  | "incidentInformation";

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
    hint: "Assigned from the reset date and format. Later emails match the dispatch number.",
  },
  {
    id: "dispatchNumber",
    label: "Dispatch number",
    target: "dispatchNumber",
    hint: "The CAD number. Later emails for this call use this number to find the incident.",
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
  {
    id: "incidentInformation",
    label: "Incident Information",
    target: "dispatchInfo",
    hint: "Choose the part that describes the call, such as the line after the address.",
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
    incidentInformation: null,
  };
}

export function linesToPhrases(value: string): string[] {
  return value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function phrasesToLines(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return raw
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join("\n");
}

export function phraseListFromExtract(raw: unknown, key: "excludeContains" | "excludeExceptions"): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return linesToPhrases(phrasesToLines((raw as Record<string, unknown>)[key]));
}

/** True when the email contains an exclude phrase and none of the exceptions. */
export function emailExcludedBySetup(
  text: string,
  exclude: readonly string[],
  exceptions: readonly string[],
): boolean {
  const hay = text.toLowerCase();
  const excluded = exclude.some((phrase) => phrase.trim() && hay.includes(phrase.trim().toLowerCase()));
  if (!excluded) return false;
  return !exceptions.some((phrase) => phrase.trim() && hay.includes(phrase.trim().toLowerCase()));
}

export function unitsMentionedInCadEmail(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const token = value.trim();
    const key = token.toLowerCase();
    if (!token || seen.has(key)) return;
    seen.add(key);
    found.push(token);
  };
  const labeled = labeledCadValue(text, "Units");
  if (labeled) {
    for (const part of labeled.split(/[,;/]+/)) add(part);
  }
  const timed = /([0-9A-Za-z]+)\s*-\s*(?:Dispatch|On Scene|InQuarters|In Quarters|Enroute|En Route|Clear)/gi;
  for (const match of text.matchAll(timed)) add(match[1] ?? "");
  return found;
}

/** Keep only names that match a Department Apparatus unit id or common name. */
export function filterNamedUnits(value: string, apparatusNames: readonly string[]): string {
  const allowed = new Set(apparatusNames.map((name) => name.trim().toLowerCase()).filter(Boolean));
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(/[,;/]+/)) {
    const token = part.trim();
    const key = token.toLowerCase();
    if (!token || seen.has(key) || !allowed.has(key)) continue;
    seen.add(key);
    kept.push(token);
  }
  return kept.join(", ");
}

export function unitsMatchingApparatus(text: string, apparatusNames: readonly string[]): string {
  return filterNamedUnits(unitsMentionedInCadEmail(text).join(", "), apparatusNames);
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
  incidentNumberFormat = DEFAULT_INCIDENT_NUMBER_FORMAT,
  reset: CadNumberReset = {
    month: DEFAULT_RESET_MONTH,
    day: DEFAULT_RESET_DAY,
    time: DEFAULT_RESET_TIME,
  },
  filters: { excludeContains?: string[]; excludeExceptions?: string[] } = {},
): {
  rules: CadRule[];
  fieldMap: Record<string, string>;
  incidentNumberExtract: {
    separator: string;
    incidentNumberFormat: string;
    resetMonth: number;
    resetDay: number;
    resetTime: string;
    excludeContains: string[];
    excludeExceptions: string[];
  };
} {
  const active = normalizeSectionSeparator(separator);
  const rules: CadRule[] = [{ type: "trim" }, { type: "normalize_newlines" }];
  const fieldMap: Record<string, string> = {};
  const incidentNumberExtract = {
    separator: active,
    incidentNumberFormat: incidentNumberFormat.trim() || DEFAULT_INCIDENT_NUMBER_FORMAT,
    resetMonth: reset.month,
    resetDay: reset.day,
    resetTime: parseResetTime(reset.time) ? reset.time : DEFAULT_RESET_TIME,
    excludeContains: linesToPhrases((filters.excludeContains ?? []).join("\n")),
    excludeExceptions: linesToPhrases((filters.excludeExceptions ?? []).join("\n")),
  };

  for (const field of INCIDENT_LABEL_FIELDS) {
    if (field.id === "incidentNumber") continue;
    const choice = choices[field.id];
    if (!choice || choice.index < 0) continue;
    if (!field.target) continue;
    rules.push({
      type: "extract_capture",
      pattern: patternForPart(choice, active),
      group: 1,
      slot: field.id,
      flags: "",
    });
    fieldMap[field.id] = field.target;
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
    if (rule.slot === "incidentNumber") continue;
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
  incidentNumberFormat = DEFAULT_INCIDENT_NUMBER_FORMAT,
  reset: CadNumberReset = {
    month: DEFAULT_RESET_MONTH,
    day: DEFAULT_RESET_DAY,
    time: DEFAULT_RESET_TIME,
  },
  now = new Date(),
  filters: { excludeContains?: string[]; excludeExceptions?: string[]; apparatusNames?: string[] | null } = {},
): { ok: true; followUp: boolean; excluded: boolean; rows: IncidentPreviewRow[] } | { ok: false; error: string } {
  const incidentNumber = incidentNumberSeriesExample(now, reset, incidentNumberFormat);
  const excluded = emailExcludedBySetup(
    plainText,
    filters.excludeContains ?? [],
    filters.excludeExceptions ?? [],
  );
  const apparatusNames = filters.apparatusNames ?? null;
  const followUpNumber = followUpCallNumber(plainText);
  if (followUpNumber) {
    const mentioned = unitsMentionedInCadEmail(plainText);
    const matched = apparatusNames ? unitsMatchingApparatus(plainText, apparatusNames) : mentioned.join(", ");
    const units = matched || (apparatusNames && mentioned.length > 0 ? "Not a department apparatus" : "Unchanged");
    return {
      ok: true,
      followUp: true,
      excluded,
      rows: [
        { id: "incidentNumber", label: "Incident number", value: incidentNumber },
        { id: "dispatchNumber", label: "Dispatch number", value: followUpNumber },
        { id: "incidentType", label: "Incident type", value: "Unchanged" },
        { id: "incidentInformation", label: "Incident Information", value: "Unchanged" },
        { id: "initialDispatchCode", label: "Initial dispatch code", value: "Unchanged" },
        { id: "priority", label: "Priority", value: "Unchanged" },
        { id: "stillDistrict", label: "Still district", value: "Unchanged" },
        { id: "status", label: "Status", value: "Draft" },
        { id: "reportedBy", label: "Reported by", value: "Unchanged" },
        { id: "assignedUnits", label: "Assigned units", value: units },
        { id: "address", label: "Address", value: "Unchanged" },
        { id: "callbackNumber", label: "Callback number", value: "Unchanged" },
        { id: "dispatchNotes", label: "Dispatch notes", value: plainText.trim() },
      ],
    };
  }
  const built = buildIncidentLabelConfig(choices, separator, incidentNumberFormat, reset);
  const result = runCadRulePipeline(plainText, built.rules);
  if (!result.ok) return { ok: false, error: result.error };
  const mapped = buildMappedIncidentFieldsPreview(result.slots, built.fieldMap, result.text);
  const initialDispatchCode = mapped.initialDispatchCode || mapped.mapReference || "";
  const dispatchNumber = mapped.dispatchNumber || cadDispatchNumber(plainText, separator);
  const mappedUnits = mapped.assignedUnits || "";
  const units =
    apparatusNames == null
      ? mappedUnits
      : filterNamedUnits(mappedUnits, apparatusNames) ||
        (mappedUnits ? "Not a department apparatus" : "");
  const rows: IncidentPreviewRow[] = [
    { id: "incidentNumber", label: "Incident number", value: incidentNumber },
    { id: "dispatchNumber", label: "Dispatch number", value: dispatchNumber },
    { id: "incidentType", label: "Incident type", value: mapped.incidentType || "" },
    { id: "incidentInformation", label: "Incident Information", value: mapped.dispatchInfo || "" },
    { id: "initialDispatchCode", label: "Initial dispatch code", value: initialDispatchCode },
    { id: "priority", label: "Priority", value: mapped.priority || "" },
    { id: "stillDistrict", label: "Still district", value: mapped.stillDistrict || "" },
    { id: "status", label: "Status", value: "Draft" },
    { id: "reportedBy", label: "Reported by", value: mapped.reportedBy || "" },
    { id: "assignedUnits", label: "Assigned units", value: units },
    { id: "address", label: "Address", value: mapped.address || "" },
    { id: "callbackNumber", label: "Callback number", value: mapped.callbackNumber || "" },
    { id: "dispatchNotes", label: "Dispatch notes", value: mapped.dispatchNotes || "" },
  ];
  return { ok: true, followUp: false, excluded, rows };
}
