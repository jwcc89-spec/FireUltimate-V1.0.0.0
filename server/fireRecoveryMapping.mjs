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

const MOTOR_VEHICLE_TYPES = new Set([
  "MEDICAL: INJURY: MOTOR_VEHICLE_COLLISION",
  "HAZSIT: HAZARD_NONCHEM: MOTOR_VEHICLE_COLLISION",
  "RESCUE: TRANSPORTATION: MOTOR_VEHICLE_EXTRICATION_ENTRAPPED",
]);

function incidentTypeKey(value) {
  return trimValue(value)
    .toUpperCase()
    .replace(/\|\|/g, ":")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isMotorVehicleIncident(primary, additional) {
  const values = [primary, ...trimValue(additional).split(",")];
  return values.some((value) => MOTOR_VEHICLE_TYPES.has(incidentTypeKey(value)));
}

function localDateTime(value, fallbackDate) {
  const trimmed = trimValue(value).replace(" ", "T");
  const dated = trimmed.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/);
  if (dated) return `${dated[1]}T${dated[2]}:${dated[3] ?? "00"}`;
  const clock = trimmed.match(/^(\d{2}:\d{2})(?::(\d{2}))?$/);
  const date = trimValue(fallbackDate).slice(0, 10);
  if (clock && /^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T${clock[1]}:${clock[2] ?? "00"}`;
  return "";
}

function locationParts(formValues) {
  const address = trimValue(formValues.incident_location_address);
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    street: parts[0] ?? "",
    city: parts.length >= 3 ? (parts[1] ?? "") : "",
    state: trimValue(formValues.location_state),
    zip: trimValue(formValues.location_postal_code),
  };
}

function resourceUnits(formValues) {
  const raw = trimValue(formValues.resource_units_json);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((unit) => unit && typeof unit === "object") : [];
  } catch {
    return [];
  }
}

function personnelNames(value) {
  if (Array.isArray(value)) return value.map((entry) => trimValue(entry)).filter(Boolean);
  return trimValue(value).split(",").map((entry) => entry.trim()).filter(Boolean);
}

function onScenePeople(formValues) {
  const names = new Set();
  for (const unit of resourceUnits(formValues)) {
    if (unit.isCanceledEnroute === true) continue;
    for (const name of personnelNames(unit.personnel)) names.add(name);
  }
  return [...names];
}

function callClearedRaw(formValues) {
  const incidentClear = trimValue(formValues.incident_time_clear) || trimValue(formValues.time_incident_clear);
  if (incidentClear) return incidentClear;
  const clears = [];
  for (const unit of resourceUnits(formValues)) {
    if (unit.isCanceledEnroute === true) continue;
    const clear = trimValue(unit.clearTime);
    if (clear) clears.push(clear);
  }
  if (clears.length === 0) return trimValue(formValues.incident_time_unit_clear);
  return clears.slice().sort().at(-1) ?? "";
}

function parseBilling(raw) {
  try {
    const parsed = JSON.parse(trimValue(raw) || "{}");
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.parties)) return { parties: [], lawEnforcementReportNumber: "", nerisCode: "" };
    return parsed;
  } catch {
    return { parties: [], lawEnforcementReportNumber: "", nerisCode: "" };
  }
}

const REQUIREMENT_DEFAULTS = {
  "fr.lawEnforcementNumber": "optional",
  "fr.nerisCode": "optional",
  "fr.party.firstName": "required",
  "fr.party.lastName": "required",
  "fr.party.address": "required",
  "fr.party.phone": "recommended",
  "fr.party.email": "optional",
  "fr.party.isResident": "recommended",
  "fr.party.insuranceCompany": "required",
  "fr.party.policyNumber": "recommended",
  "fr.party.insuranceContact": "recommended",
  "fr.party.vehicleMake": "required",
  "fr.party.vehicleModel": "required",
  "fr.party.licensePlate": "recommended",
  "fr.party.vin": "recommended",
  "fr.party.atFault": "optional",
};

function requirementLevel(key, settings) {
  const value = settings && typeof settings === "object" ? settings[key] : "";
  if (value === "required" || value === "recommended" || value === "optional") return value;
  return REQUIREMENT_DEFAULTS[key] ?? "optional";
}

export function missingFireRecoveryFields(formValues, settings, filedByName) {
  const missing = [];
  const values = formValues && typeof formValues === "object" ? formValues : {};
  if (!trimValue(filedByName)) missing.push("Form Filed By");
  if (!trimValue(values.incident_onset_date)) missing.push("Run Date");
  if (!trimValue(values.incident_time_call_arrival)) missing.push("Time Alarm Received");
  if (!callClearedRaw(values)) missing.push("Time Call Cleared");
  if (!trimValue(values.incident_internal_id)) missing.push("Run Number");
  if (onScenePeople(values).length < 1) missing.push("Total Personnel On-Scene");
  const location = locationParts(values);
  if (!location.street) missing.push("Incident Location street");
  if (!location.city) missing.push("Incident Location city");
  if (!location.state) missing.push("Incident Location state");
  if (!location.zip) missing.push("Incident Location zip");
  const billing = parseBilling(values.fire_recovery_billing_json);
  if (requirementLevel("fr.lawEnforcementNumber", settings) === "required" && !trimValue(billing.lawEnforcementReportNumber)) {
    missing.push("Law Enforcement Agency Report Number");
  }
  const code = trimValue(billing.nerisCode) || trimValue(values.primary_incident_type);
  if (requirementLevel("fr.nerisCode", settings) === "required" && !code) missing.push("NERIS Code");
  if (!Array.isArray(billing.parties) || billing.parties.length < 1) missing.push("At least one party");
  (billing.parties ?? []).forEach((party, index) => {
    const title = `Party ${index + 1}`;
    const blank = (key, label, value) => {
      if (requirementLevel(key, settings) === "required" && !trimValue(value)) missing.push(`${title} — ${label}`);
    };
    blank("fr.party.firstName", "First Name", party.firstName);
    blank("fr.party.lastName", "Last Name", party.lastName);
    const addressMissing = !trimValue(party.street) || !trimValue(party.city) || !trimValue(party.state) || !trimValue(party.zip);
    if (requirementLevel("fr.party.address", settings) === "required" && addressMissing) {
      missing.push(`${title} — Party Address (street, city, state, zip)`);
    }
    blank("fr.party.phone", "Party Phone", party.phone);
    blank("fr.party.email", "Party Email", party.email);
    blank("fr.party.isResident", "Is Resident?", party.isResident);
    if (!party.uninsured) blank("fr.party.insuranceCompany", "Insurance Company / Liable Party", party.insuranceCompany);
    blank("fr.party.policyNumber", "Policy Number", party.policyNumber);
    blank("fr.party.insuranceContact", "Insurance Contact Number", party.insuranceContactNumber);
    blank("fr.party.vehicleMake", "Vehicle Make", party.vehicleMake);
    blank("fr.party.vehicleModel", "Vehicle Model", party.vehicleModel);
    blank("fr.party.licensePlate", "License Plate", party.licensePlate);
    blank("fr.party.vin", "VIN", party.vin);
    blank("fr.party.atFault", "At Fault Party", party.atFault);
  });
  return missing;
}

function yes(value) {
  return trimValue(value).toUpperCase() === "YES";
}

function partyPayload(party) {
  return {
    Party: {
      First: trimValue(party.firstName),
      Middle: "",
      Last: trimValue(party.lastName),
      Address: trimValue(party.street),
      City: trimValue(party.city),
      State: trimValue(party.state),
      Zip: trimValue(party.zip),
      Phone: trimValue(party.phone),
      Email: trimValue(party.email),
      Isresident: yes(party.isResident),
      AtFault: yes(party.atFault),
      InvolvementType: "",
      InvolTypeDescript: "",
      Vehicle: {
        VehicleYear: trimValue(party.vehicleYear),
        VehicleMake: trimValue(party.vehicleMake),
        VehicleModel: trimValue(party.vehicleModel),
        VehicleVIN: trimValue(party.vin),
        LicensePlate: trimValue(party.licensePlate),
        VehicleOther: trimValue(party.otherVehicleDetails),
        CommercialVehicle: party.commercialVehicle === true,
        Owner: false,
        CompanyName: trimValue(party.companyName),
        InsuranceCompanyName: party.uninsured === true ? "" : trimValue(party.insuranceCompany),
        InsuranceContactNumber: trimValue(party.insuranceContactNumber),
        PolicyNumber: trimValue(party.policyNumber),
        DOTNumber: trimValue(party.dotNumber),
      },
    },
  };
}

/**
 * Pure Fire Recovery bill. Department ID is chosen by the caller from FIRE_RECOVERY_MODE.
 * @param {Record<string, unknown>} formValues
 * @param {{ nerisId?: string, reportWriterName?: string, callNumber?: string }} receipt
 * @param {{ departmentId?: string, departmentName?: string }} tenant
 * @param {{ submittedAt?: string }} submitter
 */
export function buildFireRecoveryPayload(formValues, receipt, tenant, submitter) {
  const values = formValues && typeof formValues === "object" ? formValues : {};
  const billing = parseBilling(values.fire_recovery_billing_json);
  const runDate = trimValue(values.incident_onset_date);
  const nerisCode = trimValue(billing.nerisCode) || trimValue(values.primary_incident_type);
  const runNumber = trimValue(values.incident_internal_id);
  const location = locationParts(values);
  const people = onScenePeople(values);
  const units = resourceUnits(values);
  const activeUnits = units.filter((unit) => unit.isCanceledEnroute !== true);
  const filed = parseHumanNameParts(receipt?.reportWriterName);
  const lawFromBilling = trimValue(billing.lawEnforcementReportNumber);
  let lawNumber = lawFromBilling;
  if (!lawNumber) {
    try {
      const vehicles = JSON.parse(trimValue(values.person_owner_vehicles_json) || "[]");
      if (Array.isArray(vehicles)) {
        lawNumber = trimValue(vehicles.find((vehicle) => trimValue(vehicle?.policeReportFileNumber))?.policeReportFileNumber);
      }
    } catch {
      lawNumber = "";
    }
  }
  const earliestOnScene = activeUnits
    .map((unit) => localDateTime(unit.onSceneTime, runDate))
    .filter(Boolean)
    .sort()[0] ?? "";
  const narrative = ["narrative", "narrative_outcome", "narrative_obstacles"]
    .map((key) => trimValue(values[key]))
    .filter(Boolean)
    .join("\n");
  const actions = trimValue(values.incident_actions_taken)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((code) => ({ IncidentActionsTakenCode: code, IncidentActionsTakenDescription: code }));
  const respondingUnits = units.map((unit) => ({
    UnitNumber: trimValue(unit.unitId),
    UnitTypeCode: trimValue(unit.unitType),
    UnitTypeDescription: trimValue(unit.unitType),
    UnitOnsceneDateTime: localDateTime(unit.onSceneTime, runDate),
    UnitClearDateTime: localDateTime(unit.clearTime, runDate),
    UnitCanceledEnRoute: unit.isCanceledEnroute === true,
  }));

  return {
    IncidentToBillPayload: {
      NERISDepartmentId: trimValue(tenant?.departmentId),
      DepartmentName: trimValue(tenant?.departmentName),
      IncidentsToBill: {
        incident: {
          IncidentID: runNumber,
          IncidentType: nerisCode,
          IncidentTypeDescription: nerisCode,
          AlarmDateTime: localDateTime(values.incident_time_call_arrival, runDate),
          FirstUnitOnSceneDateTime: localDateTime(values.incident_time_unit_on_scene, runDate) || earliestOnScene,
          ClearedDateTime: localDateTime(callClearedRaw(values), runDate),
          CanceledInRoute: units.length > 0 && units.every((unit) => unit.isCanceledEnroute === true),
          Narrative: narrative,
          Location: {
            LocationID: trimValue(receipt?.callNumber),
            Address: location.street,
            City: location.city,
            State: location.state,
            Zip: location.zip,
          },
          IncidentActionsTaken: actions,
          RespondingUnits: respondingUnits,
          CostRecovery: {
            PrincipleIncidentType: nerisCode,
            NerisIdIncident: trimValue(receipt?.nerisId),
            IncidentNumber: runNumber,
            LawEnforcementNumber: lawNumber,
            CatchCreated: localDateTime(submitter?.submittedAt, runDate) || trimValue(submitter?.submittedAt),
            TotalPersonnelOnScene: people.length,
            FiledBy: {
              First: filed.first,
              Last: filed.last,
              Middle: filed.middle,
            },
            Parties: (billing.parties ?? []).map(partyPayload),
          },
        },
      },
    },
  };
}
