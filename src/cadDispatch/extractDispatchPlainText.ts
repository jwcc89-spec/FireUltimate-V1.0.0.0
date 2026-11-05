/**
 * Decode Worker base64 / MIME and extract plain-text dispatch body (shared by Raw Email + Incident Parsing preview + ingest).
 * Batch G1: multipart/alternative, text/plain, quoted-printable + base64 parts (Gmail-style); legacy base64 inner part kept.
 */

/** Try to decode base64 raw body from the ingest worker; returns decoded string or null if not base64. */
export function tryDecodeRawBody(rawBody: string): string | null {
  if (!rawBody || typeof rawBody !== "string") return null;
  const trimmed = rawBody.trim();
  const withoutSuffix = trimmed.endsWith("[TRUNCATED]")
    ? trimmed.slice(0, -"[TRUNCATED]".length).trim()
    : trimmed;
  if (!withoutSuffix.length) return null;
  try {
    const decoded = atob(withoutSuffix);
    return decoded;
  } catch {
    return null;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitHeadersAndBody(raw: string): { headers: string; body: string } {
  const match = /\r?\n\r?\n/.exec(raw);
  if (!match || match.index === undefined) {
    return { headers: raw, body: "" };
  }
  return {
    headers: raw.slice(0, match.index),
    body: raw.slice(match.index + match[0].length),
  };
}

/** First matching header value (unfolded line continuation not handled; sufficient for CAD MIME). */
function getHeader(headers: string, name: string): string {
  const re = new RegExp(`^${escapeRegExp(name)}:\\s*([^\\r\\n]*)`, "im");
  const m = headers.match(re);
  return m ? m[1].trim() : "";
}

function parseBoundary(contentTypeValue: string): string | null {
  const m = contentTypeValue.match(/\bboundary\s*=\s*("([^"]+)"|([^;\s]+))/i);
  if (!m) return null;
  return (m[2] ?? m[3] ?? "").trim();
}

function parseCharset(contentTypeValue: string): string {
  const m = contentTypeValue.match(/charset\s*=\s*["']?([^"'\s;]+)/i);
  if (!m) return "utf-8";
  return m[1].replace(/^utf8$/i, "utf-8");
}

function decodeQuotedPrintableBody(body: string, charset: string): string {
  const clean = body.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
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

function decodeBase64Body(body: string, charset: string): string | null {
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

/**
 * Decode a single MIME part body using Content-Type + Content-Transfer-Encoding.
 * Returns null if the part is not text/plain.
 */
function decodeTextPlainPart(partHeaders: string, partBody: string): string | null {
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

/** Split multipart body into part strings (each part: headers + blank line + body). Preamble before first boundary is ignored. */
function splitMultipartParts(body: string, boundary: string): string[] {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  let buf: string[] = [];
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

/**
 * From a decoded RFC822 / MIME string, extract best-effort human dispatch plain text.
 */
export function extractPlainTextFromDecodedMime(decodedMime: string): string | null {
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

/**
 * Extract the first base64-encoded text/plain part from decoded MIME (legacy ICOMM / older paths).
 * Returns decoded plain text suitable for parsing, or null if none found.
 */
export function extractPlainTextFromMime(decodedMime: string): string | null {
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

/** Best-effort plain text from a stored ingest raw body (for preview / parsing / ingest). */
export function getDispatchPlainTextFromRawBody(rawBody: string): string | null {
  const decoded = tryDecodeRawBody(rawBody);
  if (decoded === null) {
    const t = rawBody?.trim();
    return t.length ? t : null;
  }
  const fromStructure = extractPlainTextFromDecodedMime(decoded);
  if (fromStructure != null && fromStructure.length) return fromStructure;
  const fromLegacyBase64 = extractPlainTextFromMime(decoded);
  if (fromLegacyBase64 != null && fromLegacyBase64.length) return fromLegacyBase64.trim();
  const t = decoded.trim();
  return t.length ? t : null;
}
