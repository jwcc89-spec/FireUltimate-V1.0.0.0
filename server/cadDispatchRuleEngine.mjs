/**
 * CAD dispatch rule pipeline (server). Keep in sync with src/cadDispatch/ruleEngine.ts
 * and `src/cadDispatch/extractDispatchPlainText.ts` (MIME / plain text — Batch G1).
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

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function splitHeadersAndBody(raw) {
  const match = /\r?\n\r?\n/.exec(raw);
  if (!match || match.index === undefined) {
    return { headers: raw, body: "" };
  }
  return {
    headers: raw.slice(0, match.index),
    body: raw.slice(match.index + match[0].length),
  };
}

function getHeader(headers, name) {
  const re = new RegExp(`^${escapeRegExp(name)}:\\s*([^\\r\\n]*)`, "im");
  const m = headers.match(re);
  return m ? m[1].trim() : "";
}

function parseBoundary(contentTypeValue) {
  const m = contentTypeValue.match(/\bboundary\s*=\s*("([^"]+)"|([^;\s]+))/i);
  if (!m) return null;
  return (m[2] ?? m[3] ?? "").trim();
}

function parseCharset(contentTypeValue) {
  const m = contentTypeValue.match(/charset\s*=\s*["']?([^"'\s;]+)/i);
  if (!m) return "utf-8";
  return m[1].replace(/^utf8$/i, "utf-8");
}

function decodeQuotedPrintableBody(body, charset) {
  const clean = body.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < clean.length; i++) {
    if (
      clean[i] === "=" &&
      i + 2 < clean.length &&
      /^[0-9A-Fa-f]{2}$/.test(clean.slice(i + 1, i + 3))
    ) {
      bytes.push(parseInt(clean.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(clean.charCodeAt(i) & 0xff);
    }
  }
  const u8 = new Uint8Array(bytes);
  const cs = charset.toLowerCase().replace(/^utf8$/i, "utf-8");
  try {
    return new TextDecoder(cs).decode(u8);
  } catch {
    return new TextDecoder("utf-8").decode(u8);
  }
}

function decodeBase64Body(body, charset) {
  const b64 = body.replace(/\s/g, "").replace(/\[TRUNCATED\]/gi, "");
  if (!b64.length || !/^[A-Za-z0-9+/=]*$/.test(b64)) return null;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const cs = charset.toLowerCase().replace(/^utf8$/i, "utf-8");
    try {
      return new TextDecoder(cs).decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  } catch {
    return null;
  }
}

function decodeTextPlainPart(partHeaders, partBody) {
  const ct = getHeader(partHeaders, "Content-Type");
  if (!ct || !/text\/plain/i.test(ct)) return null;
  const charset = parseCharset(ct);
  const cte = (getHeader(partHeaders, "Content-Transfer-Encoding") || "7bit").toLowerCase();
  const body = partBody.replace(/\r?\n$/m, "").replace(/\s+$/, "");

  if (cte.includes("quoted-printable")) {
    return decodeQuotedPrintableBody(body, charset);
  }
  if (cte.includes("base64")) {
    return decodeBase64Body(body, charset);
  }
  return body.trimEnd();
}

function splitMultipartParts(body, boundary) {
  const lines = body.split(/\r?\n/);
  const out = [];
  let buf = [];
  const start = `--${boundary}`;
  const end = `--${boundary}--`;
  let seenStart = false;
  for (const line of lines) {
    if (line === end) {
      if (seenStart && buf.length) out.push(buf.join("\n"));
      break;
    }
    if (line === start) {
      if (seenStart && buf.length) out.push(buf.join("\n"));
      buf = [];
      seenStart = true;
      continue;
    }
    if (seenStart) buf.push(line);
  }
  return out;
}

export function extractPlainTextFromDecodedMime(decodedMime) {
  if (!decodedMime || typeof decodedMime !== "string") return null;
  const top = splitHeadersAndBody(decodedMime.trim());
  const topCt = getHeader(top.headers, "Content-Type");

  if (/multipart\//i.test(topCt)) {
    const boundary = parseBoundary(topCt);
    if (boundary) {
      const parts = splitMultipartParts(top.body, boundary);
      for (const part of parts) {
        const { headers, body } = splitHeadersAndBody(part);
        const plain = decodeTextPlainPart(headers, body);
        if (plain != null && plain.trim().length) return plain.trim();
      }
    }
  }

  if (/text\/plain/i.test(topCt)) {
    const plain = decodeTextPlainPart(top.headers, top.body);
    if (plain != null && plain.trim().length) return plain.trim();
  }

  return null;
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
  const fromStructure = extractPlainTextFromDecodedMime(decoded);
  if (fromStructure != null && fromStructure.length) return fromStructure;
  const fromLegacyBase64 = extractPlainTextFromMime(decoded);
  if (fromLegacyBase64 != null && fromLegacyBase64.length) return fromLegacyBase64.trim();
  const t = decoded.trim();
  return t.length ? t : null;
}
