import { createHash } from "node:crypto";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function trimValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** Hash the bill without CatchCreated, so the clock does not look like a report change. */
export function previewHash(payload) {
  const copy = payload && typeof payload === "object" ? JSON.parse(JSON.stringify(payload)) : {};
  const recovery = copy?.IncidentToBillPayload?.IncidentsToBill?.incident?.CostRecovery;
  if (recovery && typeof recovery === "object") delete recovery.CatchCreated;
  return createHash("sha256").update(JSON.stringify(copy)).digest("hex");
}

export function displaySubmitStatus(row, now = Date.now()) {
  const status = trimValue(row?.submitStatus);
  if (!status || status === "not_sent") return "not_sent";
  if (status === "submitting") {
    const started = row?.submitStartedAt ? new Date(row.submitStartedAt).getTime() : 0;
    if (!started || now - started > FIVE_MINUTES_MS) return "needs_review";
  }
  return status;
}

function replyMessage(json, fallback) {
  const api = json?.Done?.["API Response"];
  const message =
    (api && typeof api === "object" && trimValue(api.Message)) ||
    trimValue(json?.Done?.error) ||
    trimValue(json?.message) ||
    trimValue(json?.error);
  return message || fallback;
}

/**
 * @returns {{ outcome: "sent" | "failed" | "needs_review", trackingId: string, message: string }}
 */
export function classifyVendorReply({ httpStatus = 0, json = null, timedOut = false, networkError = false }) {
  if (timedOut) {
    return { outcome: "needs_review", trackingId: "", message: "Fire Recovery did not answer in time." };
  }
  if (networkError) {
    return { outcome: "needs_review", trackingId: "", message: "Fire Recovery could not be reached." };
  }
  const status = Number(httpStatus) || 0;
  const trackingId = trimValue(json?.Done?.TrackingId);
  if (status >= 400 && status <= 499) {
    return {
      outcome: "failed",
      trackingId: "",
      message: replyMessage(json, `Fire Recovery refused the bill (HTTP ${status}).`),
    };
  }
  if (status >= 500 || status === 0) {
    return {
      outcome: "needs_review",
      trackingId,
      message: replyMessage(json, `Fire Recovery did not confirm the bill (HTTP ${status || "none"}).`),
    };
  }
  const apiStatus = json?.Done?.["API Response"]?.Status;
  if (status === 200 && Number(apiStatus) === 1 && trackingId) {
    return { outcome: "sent", trackingId, message: "" };
  }
  return {
    outcome: "needs_review",
    trackingId,
    message: "Fire Recovery's reply did not include Status 1 and a tracking ID.",
  };
}

/** Keep an existing tracking ID. A later failure must not erase it. */
export function nextTrackingId(existingTrackingId, incomingTrackingId) {
  const existing = trimValue(existingTrackingId);
  if (existing) return existing;
  const incoming = trimValue(incomingTrackingId);
  return incoming || null;
}
