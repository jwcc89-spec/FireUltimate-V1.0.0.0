import { createHash } from "node:crypto";

const FILL_KEYS = [
  "address",
  "incidentType",
  "priority",
  "stillDistrict",
  "assignedUnits",
  "reportedBy",
  "callbackNumber",
  "mapReference",
  "dispatchInfo",
  "receivedAt",
];

const FIELD_LABELS = {
  address: "address",
  incidentType: "type",
  priority: "priority",
  stillDistrict: "still district",
  assignedUnits: "units",
  reportedBy: "reported by",
  callbackNumber: "callback number",
  mapReference: "dispatch code",
  dispatchInfo: "incident information",
  receivedAt: "call created",
};

function trimValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function cadIngestIdentity(headers, rawBody) {
  const source = headers && typeof headers === "object" && !Array.isArray(headers) ? headers : {};
  const messageId = String(
    source["message-id"] || source["Message-ID"] || source["Message-Id"] || "",
  )
    .trim()
    .toLowerCase();
  const bodyHash = createHash("sha256").update(String(rawBody ?? "")).digest("hex");
  return { messageId, bodyHash };
}

export function cadIngestIsDuplicate(identity, priorIdentities) {
  if (!identity?.bodyHash) return false;
  return priorIdentities.some((prior) => {
    if (!prior || typeof prior !== "object") return false;
    if (identity.messageId && prior.messageId && identity.messageId === prior.messageId) return true;
    return Boolean(prior.bodyHash && identity.bodyHash === prior.bodyHash);
  });
}

export function appendCadNote(existing, block) {
  const next = trimValue(block).slice(0, 12000);
  const current = trimValue(existing);
  if (!next) return current.slice(0, 20000);
  if (!current) return next;
  if (current.includes(next)) return current.slice(0, 20000);
  return [current, next].join("\n\n--- CAD dispatch ---\n").slice(0, 20000);
}

/** Copy incoming values only into blank fields. A filled field stays as saved. */
export function fillBlankIncidentFields(existing, incoming) {
  const data = {};
  const newer = [];
  for (const key of FILL_KEYS) {
    const next = trimValue(incoming?.[key]);
    if (!next) continue;
    const current = trimValue(existing?.[key]);
    if (!existing || !current) data[key] = next;
    else if (current !== next) newer.push(FIELD_LABELS[key] || key);
  }
  return { data, newer };
}

export function cadNewerInformationMessage(labels) {
  if (!labels?.length) return "";
  return `CAD has newer information for ${labels.join(", ")}. Those fields were left as saved.`;
}
