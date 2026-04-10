/**
 * Client-side mirror of `buildCadMappedIncidentFields` + merge key extraction in `server/neris-proxy.mjs`
 * (CAD ingest incident automation). Keep in sync when server logic changes.
 */

export const CAD_INCIDENT_FIELD_OPTIONS = [
  { value: "address", label: "Address" },
  { value: "incidentType", label: "Incident type" },
  { value: "priority", label: "Priority" },
  { value: "stillDistrict", label: "Still district" },
  { value: "assignedUnits", label: "Assigned units" },
  { value: "reportedBy", label: "Reported by" },
  { value: "callbackNumber", label: "Callback number" },
  { value: "dispatchNotes", label: "Dispatch notes" },
  { value: "mapReference", label: "Map reference" },
  { value: "dispatchInfo", label: "Dispatch info" },
  { value: "receivedAt", label: "Received at" },
] as const;

const TARGET_SET = new Set<string>(CAD_INCIDENT_FIELD_OPTIONS.map((o) => o.value));

export function extractMergeKeyFromSlots(
  slots: Record<string, string>,
  incidentNumberExtract: { slot?: string } | null,
): string {
  if (incidentNumberExtract && typeof incidentNumberExtract === "object") {
    const slotName = String(incidentNumberExtract.slot ?? "").trim();
    if (slotName && slots[slotName]) return String(slots[slotName]).trim();
  }
  if (slots.cfs) return String(slots.cfs).trim();
  if (slots.incidentNumber) return String(slots.incidentNumber).trim();
  return "";
}

export function buildMappedIncidentFieldsPreview(
  slots: Record<string, string>,
  fieldMap: Record<string, string>,
  pipelineText: string,
): Record<string, string> {
  const data: Record<string, string> = {};
  if (fieldMap && typeof fieldMap === "object") {
    for (const [slotKey, targetRaw] of Object.entries(fieldMap)) {
      const target = String(targetRaw).trim();
      if (!TARGET_SET.has(target)) continue;
      const v = slots[slotKey];
      if (v == null || String(v).trim() === "") continue;
      data[target] = String(v).trim();
    }
  }
  if (!data.dispatchNotes && pipelineText) {
    data.dispatchNotes = pipelineText.slice(0, 12000);
  }
  return data;
}
