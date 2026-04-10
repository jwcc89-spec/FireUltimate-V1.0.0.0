/**
 * CAD dispatch rule pipeline (Batch E). Ordered rules mutate working text and fill named slots.
 * Same module is intended for admin preview and server-side ingest (later batches).
 */

import { normalizeDispatchTextForParsing } from "./normalizeDispatchText.ts";

export type CadRule =
  | { type: "trim" }
  | { type: "normalize_newlines" }
  | { type: "delete_before_nth"; substring: string; occurrence: number; caseSensitive?: boolean }
  | { type: "delete_after_nth"; substring: string; occurrence: number; caseSensitive?: boolean }
  | { type: "regex_replace"; pattern: string; replacement: string; flags?: string }
  | {
      type: "extract_capture";
      pattern: string;
      /** 0 = full match, 1 = first capture group, … */
      group: number;
      slot: string;
      flags?: string;
    };

export type CadRuleEngineSuccess = {
  ok: true;
  text: string;
  slots: Record<string, string>;
};

export type CadRuleEngineFailure = {
  ok: false;
  error: string;
  text: string;
  slots: Record<string, string>;
};

export type CadRuleEngineResult = CadRuleEngineSuccess | CadRuleEngineFailure;

const RULE_TYPES = new Set<CadRule["type"]>([
  "trim",
  "normalize_newlines",
  "delete_before_nth",
  "delete_after_nth",
  "regex_replace",
  "extract_capture",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, field: string): string {
  if (typeof v !== "string") throw new Error(`${field} must be a string`);
  return v;
}

function asPositiveInt(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
  return v;
}

function asNonNegInt(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return v;
}

/**
 * Parse and validate rules from JSON (DB/API). Throws with a short message if invalid.
 */
export function parseCadRulesJson(raw: unknown): CadRule[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error("Rules must be an array.");
  const out: CadRule[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isPlainObject(item)) throw new Error(`Rule at index ${i} must be an object.`);
    const t = item.type;
    if (typeof t !== "string" || !RULE_TYPES.has(t as CadRule["type"])) {
      throw new Error(`Rule at index ${i} has invalid or missing type.`);
    }
    switch (t) {
      case "trim":
        out.push({ type: "trim" });
        break;
      case "normalize_newlines":
        out.push({ type: "normalize_newlines" });
        break;
      case "delete_before_nth": {
        const substring = asString(item.substring, "substring");
        const occurrence = asPositiveInt(item.occurrence, "occurrence");
        const caseSensitive =
          typeof item.caseSensitive === "boolean" ? item.caseSensitive : false;
        out.push({ type: "delete_before_nth", substring, occurrence, caseSensitive });
        break;
      }
      case "delete_after_nth": {
        const substring = asString(item.substring, "substring");
        const occurrence = asPositiveInt(item.occurrence, "occurrence");
        const caseSensitive =
          typeof item.caseSensitive === "boolean" ? item.caseSensitive : false;
        out.push({ type: "delete_after_nth", substring, occurrence, caseSensitive });
        break;
      }
      case "regex_replace": {
        const pattern = asString(item.pattern, "pattern");
        const replacement = asString(item.replacement, "replacement");
        const flags = typeof item.flags === "string" ? item.flags : "";
        out.push({ type: "regex_replace", pattern, replacement, flags });
        break;
      }
      case "extract_capture": {
        const pattern = asString(item.pattern, "pattern");
        const slot = asString(item.slot, "slot");
        const group = asNonNegInt(item.group, "group");
        const flags = typeof item.flags === "string" ? item.flags : "";
        out.push({ type: "extract_capture", pattern, group, slot, flags });
        break;
      }
      default:
        throw new Error(`Rule at index ${i} has unsupported type.`);
    }
  }
  return out;
}

function findNthSubstringIndex(
  text: string,
  sub: string,
  occurrence: number,
  caseSensitive: boolean,
): number {
  if (!sub.length || occurrence < 1) return -1;
  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? sub : sub.toLowerCase();
  let from = 0;
  for (let i = 0; i < occurrence; i++) {
    const idx = hay.indexOf(needle, from);
    if (idx === -1) return -1;
    if (i === occurrence - 1) return idx;
    from = idx + needle.length;
  }
  return -1;
}

function applyNormalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Run ordered rules. On failure (e.g. invalid regex at runtime), returns `{ ok: false, error }` with best-effort text/slots.
 */
export function runCadRulePipeline(
  inputText: string,
  rules: CadRule[],
  options?: { normalizeFirst?: boolean },
): CadRuleEngineResult {
  const normalizeFirst = options?.normalizeFirst !== false;
  let text = normalizeFirst ? normalizeDispatchTextForParsing(inputText) : inputText;
  const slots: Record<string, string> = {};

  for (let ri = 0; ri < rules.length; ri++) {
    const rule = rules[ri];
    try {
      switch (rule.type) {
        case "trim":
          text = text.trim();
          break;
        case "normalize_newlines":
          text = applyNormalizeNewlines(text);
          break;
        case "delete_before_nth": {
          const idx = findNthSubstringIndex(
            text,
            rule.substring,
            rule.occurrence,
            rule.caseSensitive ?? false,
          );
          if (idx !== -1) text = text.slice(idx);
          break;
        }
        case "delete_after_nth": {
          const idx = findNthSubstringIndex(
            text,
            rule.substring,
            rule.occurrence,
            rule.caseSensitive ?? false,
          );
          if (idx !== -1) {
            const end = idx + rule.substring.length;
            text = text.slice(0, end);
          }
          break;
        }
        case "regex_replace": {
          const re = new RegExp(rule.pattern, rule.flags ?? "");
          text = text.replace(re, rule.replacement);
          break;
        }
        case "extract_capture": {
          const re = new RegExp(rule.pattern, rule.flags ?? "");
          const m = text.match(re);
          if (m && rule.group < m.length) {
            slots[rule.slot] = m[rule.group] ?? "";
          } else {
            slots[rule.slot] = "";
          }
          break;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: `Rule ${ri} (${rule.type}): ${msg}`,
        text,
        slots,
      };
    }
  }

  return { ok: true, text, slots };
}
