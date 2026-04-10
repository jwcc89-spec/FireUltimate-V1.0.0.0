/**
 * CAD dispatch rule pipeline (server). Keep in sync with src/cadDispatch/ruleEngine.ts
 * and related files — same behavior as the browser bundle.
 */

export function normalizeDispatchTextForParsing(input) {
  if (!input) return "";
  let s = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/\uFEFF/g, "");
  return s.trim();
}

const RULE_TYPES = new Set([
  "trim",
  "normalize_newlines",
  "delete_before_nth",
  "delete_after_nth",
  "regex_replace",
  "extract_capture",
]);

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v, field) {
  if (typeof v !== "string") throw new Error(`${field} must be a string`);
  return v;
}

function asPositiveInt(v, field) {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
  return v;
}

function asNonNegInt(v, field) {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return v;
}

export function parseCadRulesJson(raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error("Rules must be an array.");
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isPlainObject(item)) throw new Error(`Rule at index ${i} must be an object.`);
    const t = item.type;
    if (typeof t !== "string" || !RULE_TYPES.has(t)) {
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

function findNthSubstringIndex(text, sub, occurrence, caseSensitive) {
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

function applyNormalizeNewlines(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function runCadRulePipeline(inputText, rules, options) {
  const normalizeFirst = options?.normalizeFirst !== false;
  let text = normalizeFirst ? normalizeDispatchTextForParsing(inputText) : inputText;
  const slots = {};

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
        default:
          break;
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

export function tryDecodeRawBody(rawBody) {
  if (!rawBody || typeof rawBody !== "string") return null;
  const trimmed = rawBody.trim();
  const withoutSuffix = trimmed.endsWith("[TRUNCATED]")
    ? trimmed.slice(0, -"[TRUNCATED]".length).trim()
    : trimmed;
  if (!withoutSuffix.length) return null;
  try {
    return atob(withoutSuffix);
  } catch {
    return null;
  }
}

export function extractPlainTextFromMime(decodedMime) {
  if (!decodedMime || typeof decodedMime !== "string") return null;
  const idx = decodedMime.search(/Content-Transfer-Encoding:\s*base64/i);
  if (idx === -1) return null;
  const afterHeader = decodedMime.slice(idx);
  const blankMatch = afterHeader.match(/\n\s*\n/);
  const bodyStart = blankMatch ? afterHeader.indexOf(blankMatch[0]) + blankMatch[0].length : 0;
  let block = afterHeader.slice(bodyStart);
  const boundaryIdx = block.search(/\n--/);
  if (boundaryIdx !== -1) block = block.slice(0, boundaryIdx);
  const base64Only = block.replace(/\s/g, "").replace(/\[TRUNCATED\]/gi, "");
  if (!base64Only.length || !/^[A-Za-z0-9+/=]*$/.test(base64Only)) return null;
  try {
    return atob(base64Only);
  } catch {
    return null;
  }
}

export function getDispatchPlainTextFromRawBody(rawBody) {
  const decoded = tryDecodeRawBody(rawBody);
  if (decoded === null) {
    const t = typeof rawBody === "string" ? rawBody.trim() : "";
    return t.length ? t : null;
  }
  const plain = extractPlainTextFromMime(decoded);
  if (plain) return plain;
  const t = decoded.trim();
  return t.length ? t : null;
}
