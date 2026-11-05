import { createHash, timingSafeEqual } from "node:crypto";

export const CAD_INGEST_UNCONFIGURED_MESSAGE =
  "CAD ingest is not configured: set CAD_INGEST_SECRET on the API service and the same value on cad-email-ingest-worker (header X-CAD-Ingest-Secret).";

function trimValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function configuredCadIngestSecret(env = process.env) {
  return trimValue(env.CAD_INGEST_SECRET);
}

function digest(value) {
  return createHash("sha256").update(String(value ?? "")).digest();
}

/** Same answer time for a wrong secret of any length. */
export function cadIngestSecretsMatch(provided, expected) {
  return timingSafeEqual(digest(provided), digest(expected));
}

/**
 * Missing secret refuses intake everywhere. A present secret must match the header.
 * @returns {{ ok: true } | { ok: false, status: number, message: string }}
 */
export function cadIngestGuard(request, secret = configuredCadIngestSecret()) {
  if (!secret) {
    return { ok: false, status: 503, message: CAD_INGEST_UNCONFIGURED_MESSAGE };
  }
  const provided = trimValue(request?.headers?.["x-cad-ingest-secret"]);
  if (!cadIngestSecretsMatch(provided, secret)) {
    return { ok: false, status: 401, message: "Unauthorized." };
  }
  return { ok: true };
}
