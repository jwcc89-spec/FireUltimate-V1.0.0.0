/**
 * Decode Worker base64 / MIME and extract plain-text dispatch body (shared by Raw Email + Incident Parsing preview).
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

/**
 * Extract the first base64-encoded text/plain part from decoded MIME (e.g. CAD dispatch body).
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

/** Best-effort plain text from a stored ingest raw body (for preview / parsing). */
export function getDispatchPlainTextFromRawBody(rawBody: string): string | null {
  const decoded = tryDecodeRawBody(rawBody);
  if (decoded === null) {
    const t = rawBody?.trim();
    return t.length ? t : null;
  }
  const plain = extractPlainTextFromMime(decoded);
  if (plain) return plain;
  const t = decoded.trim();
  return t.length ? t : null;
}
