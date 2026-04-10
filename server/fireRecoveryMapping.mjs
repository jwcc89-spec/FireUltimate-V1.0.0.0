/**
 * Map stored NERIS export data to Fire Recovery USA
 * POST .../v2apis/incidents/rms/addincident (Add NERIS Incident for Billing).
 */

function trimValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * @param {string} full
 * @returns {{ first: string, middle: string, last: string }}
 */
export function parseHumanNameParts(full) {
  const s = trimValue(full);
  if (!s) return { first: "", middle: "", last: "" };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" };
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] };
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(" "),
    last: parts[parts.length - 1],
  };
}

/**
 * Vendor field name is "PrincipleIncidentType" (spelling per API).
 * @param {string} raw
 * @returns {string}
 */
function principleIncidentTypeFromNeris(raw) {
  const s = trimValue(raw);
  if (!s) return "Primary";
  const pipe = s.split("||")[0]?.trim() ?? s;
  const beforeColon = pipe.split(":")[0]?.trim() ?? pipe;
  return beforeColon.slice(0, 120) || "Primary";
}

/**
 * ISO 8601 date for CatchCreated (date-only allowed in vendor example).
 * @param {Record<string, unknown>} fv
 * @param {Record<string, unknown>} exportBody
 */
function catchCreatedIso(fv, exportBody) {
  const onsetDate = trimValue(String(fv.incident_onset_date ?? ""));
  const onsetTime = trimValue(String(fv.incident_onset_time ?? ""));
  if (onsetDate) {
    if (onsetTime && onsetTime.includes(":")) {
      const t = onsetTime.slice(0, 8).padEnd(8, "0");
      return `${onsetDate}T${t}`;
    }
    return `${onsetDate}T00:00:00`;
  }
  const exportedAt =
    exportBody.exportedAt && typeof exportBody.exportedAt === "string" ? exportBody.exportedAt : "";
  if (exportedAt) {
    const d = new Date(exportedAt);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 19);
    }
  }
  return new Date().toISOString().slice(0, 19);
}

/**
 * Best-effort count of on-scene personnel from resource_units_json.
 * @param {Record<string, unknown>} fv
 */
function countTotalPersonnelOnScene(fv) {
  const raw = trimValue(String(fv.resource_units_json ?? ""));
  if (!raw) return 0;
  try {
    const units = JSON.parse(raw);
    if (!Array.isArray(units)) return 0;
    let total = 0;
    for (const u of units) {
      if (!u || typeof u !== "object") continue;
      const n = Number(
        /** @type {Record<string, unknown>} */ (u).staffing ??
          /** @type {Record<string, unknown>} */ (u).personnel_count ??
          /** @type {Record<string, unknown>} */ (u).crew ??
          0,
      );
      if (Number.isFinite(n) && n > 0) {
        total += Math.floor(n);
      } else {
        total += 1;
      }
    }
    return Math.max(0, total);
  } catch {
    return 0;
  }
}

/**
 * @param {unknown} exportPayload — parsed JSON from NerisExportHistory.submittedPayloadPreview
 * @param {{ nerisId: string, reportWriterName: string, validatorName: string }} exportRow
 * @param {{ nerisDepartmentId: string, departmentName: string }} tenant
 * @returns {Record<string, unknown>}
 */
export function buildNerisIncidentForBillingPayload(exportPayload, exportRow, tenant) {
  const body = exportPayload && typeof exportPayload === "object" ? exportPayload : {};
  const fv =
    body.formValues && typeof body.formValues === "object" && !Array.isArray(body.formValues)
      ? /** @type {Record<string, unknown>} */ (body.formValues)
      : {};

  const incidentNumber = trimValue(String(fv.incident_internal_id ?? ""));
  const nerisIdIncident = trimValue(exportRow.nerisId);
  const primaryType = trimValue(String(fv.primary_incident_type ?? ""));
  const lawEnforcement = trimValue(String(fv.law_enforcement_number ?? fv.dispatch_final_disposition ?? ""));

  const filedSource = trimValue(exportRow.reportWriterName) || trimValue(exportRow.validatorName);
  const filed = parseHumanNameParts(filedSource);
  const firstFiled = filed.first || "Fire";
  const lastFiled = filed.last || "Ultimate";

  const totalPersonnel = countTotalPersonnelOnScene(fv);

  return {
    IncidentToBillPayload: {
      NERISDepartmentId: tenant.nerisDepartmentId,
      DepartmentName: tenant.departmentName,
      IncidentsToBill: {
        incident: {
          CostRecovery: {
            PrincipleIncidentType: principleIncidentTypeFromNeris(primaryType),
            NerisIdIncident: nerisIdIncident,
            IncidentNumber: incidentNumber,
            LawEnforcementNumber: lawEnforcement,
            CatchCreated: catchCreatedIso(fv, body),
            TotalPersonnelOnScene: totalPersonnel,
            FiledBy: {
              First: firstFiled,
              Last: lastFiled,
              Middle: filed.middle || "",
            },
            Parties: [],
          },
        },
      },
    },
  };
}

/**
 * @param {unknown} exportPayload
 * @returns {{ incidentType: string, incidentDateLabel: string }}
 */
export function extractIncidentMetadataFromExportPayload(exportPayload) {
  const body = exportPayload && typeof exportPayload === "object" ? exportPayload : {};
  const fv =
    body.formValues && typeof body.formValues === "object" && !Array.isArray(body.formValues)
      ? body.formValues
      : {};
  const incidentSnapshot =
    body.incidentSnapshot && typeof body.incidentSnapshot === "object"
      ? body.incidentSnapshot
      : {};

  const incidentType = trimValue(fv.primary_incident_type) || trimValue(incidentSnapshot.incidentType);
  const datePart = trimValue(fv.incident_onset_date);
  const timePart = trimValue(fv.incident_onset_time);
  const received = trimValue(incidentSnapshot.receivedAt);
  let incidentDateLabel = "";
  if (datePart && timePart) {
    incidentDateLabel = `${datePart} ${timePart}`;
  } else if (datePart) {
    incidentDateLabel = datePart;
  } else if (received) {
    incidentDateLabel = received;
  }

  return { incidentType, incidentDateLabel };
}
