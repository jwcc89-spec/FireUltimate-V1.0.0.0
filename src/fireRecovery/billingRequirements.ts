/**
 * Fire Recovery billing rules shared by the report tab and, later, the server.
 * Requirement levels live here so the screen and the submit check stay the same.
 */

export type FireRecoveryRunType = "MOTOR_VEHICLE" | "COMMERCIAL_TRUCKING";
export type YesNoBlank = "" | "YES" | "NO";
export type RequirementLevel = "required" | "recommended" | "optional";

export type FireRecoveryParty = {
  id: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  isResident: YesNoBlank;
  uninsured: boolean;
  insuranceCompany: string;
  policyNumber: string;
  insuranceContactNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  licensePlate: string;
  vin: string;
  otherVehicleDetails: string;
  atFault: YesNoBlank;
  commercialVehicle: boolean;
  dotNumber: string;
  companyName: string;
};

export type FireRecoveryBilling = {
  version: 1;
  runType: FireRecoveryRunType;
  lawEnforcementReportNumber: string;
  nerisCode: string;
  parties: FireRecoveryParty[];
};

export type FireRecoveryRequirementKey =
  | "fr.lawEnforcementNumber"
  | "fr.nerisCode"
  | "fr.party.firstName"
  | "fr.party.lastName"
  | "fr.party.address"
  | "fr.party.phone"
  | "fr.party.email"
  | "fr.party.isResident"
  | "fr.party.insuranceCompany"
  | "fr.party.policyNumber"
  | "fr.party.insuranceContact"
  | "fr.party.vehicleMake"
  | "fr.party.vehicleModel"
  | "fr.party.licensePlate"
  | "fr.party.vin"
  | "fr.party.atFault";

export type FireRecoveryRequirementRow = {
  key: FireRecoveryRequirementKey;
  label: string;
  defaultLevel: RequirementLevel;
};

export const FIRE_RECOVERY_REQUIREMENT_ROWS: FireRecoveryRequirementRow[] = [
  { key: "fr.lawEnforcementNumber", label: "Law Enforcement Agency Report Number", defaultLevel: "optional" },
  { key: "fr.nerisCode", label: "NERIS Code (pre-filled from the report)", defaultLevel: "optional" },
  { key: "fr.party.firstName", label: "First Name", defaultLevel: "required" },
  { key: "fr.party.lastName", label: "Last Name", defaultLevel: "required" },
  { key: "fr.party.address", label: "Party Address (street, city, state, zip)", defaultLevel: "required" },
  { key: "fr.party.phone", label: "Party Phone", defaultLevel: "recommended" },
  { key: "fr.party.email", label: "Party Email", defaultLevel: "optional" },
  { key: "fr.party.isResident", label: "Is Resident?", defaultLevel: "recommended" },
  { key: "fr.party.insuranceCompany", label: "Insurance Company / Liable Party", defaultLevel: "required" },
  { key: "fr.party.policyNumber", label: "Policy Number", defaultLevel: "recommended" },
  { key: "fr.party.insuranceContact", label: "Insurance Contact Number", defaultLevel: "recommended" },
  { key: "fr.party.vehicleMake", label: "Vehicle Make", defaultLevel: "required" },
  { key: "fr.party.vehicleModel", label: "Vehicle Model", defaultLevel: "required" },
  { key: "fr.party.licensePlate", label: "License Plate", defaultLevel: "recommended" },
  { key: "fr.party.vin", label: "VIN", defaultLevel: "recommended" },
  { key: "fr.party.atFault", label: "At Fault Party", defaultLevel: "optional" },
];

const BILLABLE_INCIDENT_TYPES = new Set([
  "MEDICAL: INJURY: MOTOR_VEHICLE_COLLISION",
  "HAZSIT: HAZARD_NONCHEM: MOTOR_VEHICLE_COLLISION",
  "RESCUE: TRANSPORTATION: MOTOR_VEHICLE_EXTRICATION_ENTRAPPED",
]);

export type BillingFixSection = "core" | "incidentTimes" | "resources" | "location";

export type BillingGap = {
  key: string;
  label: string;
  level: "required" | "recommended";
  fixSection: BillingFixSection | "";
  fixSectionLabel: string;
};

export type CopyContact = {
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  insuranceCompany?: string;
};

export type CopyVehicle = {
  personsInvolved: string[];
  vehicleMake: string;
  model: string;
  year: string;
  vin: string;
  licensePlate: string;
  uninsured: boolean;
  insuranceCompanyName: string;
  policyNumber: string;
  insuranceCompanyPhone: string;
};

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function incidentTypeKey(value: string): string {
  return text(value)
    .toUpperCase()
    .replace(/\|\|/g, ":")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isFireRecoveryBillable(primary: string, additional: string): boolean {
  const values = [primary, ...text(additional).split(",")]
    .map((entry) => incidentTypeKey(entry))
    .filter(Boolean);
  return values.some((value) => BILLABLE_INCIDENT_TYPES.has(value));
}

export function defaultRequirementLevel(key: FireRecoveryRequirementKey): RequirementLevel {
  return FIRE_RECOVERY_REQUIREMENT_ROWS.find((row) => row.key === key)?.defaultLevel ?? "optional";
}

export function parseRequirementSettings(raw: unknown): Partial<Record<FireRecoveryRequirementKey, RequirementLevel>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const parsed: Partial<Record<FireRecoveryRequirementKey, RequirementLevel>> = {};
  for (const row of FIRE_RECOVERY_REQUIREMENT_ROWS) {
    const level = source[row.key];
    if (level === "required" || level === "recommended" || level === "optional") {
      parsed[row.key] = level;
    }
  }
  return parsed;
}

export function requirementLevel(
  key: FireRecoveryRequirementKey,
  settings: Partial<Record<FireRecoveryRequirementKey, RequirementLevel>>,
): RequirementLevel {
  return settings[key] ?? defaultRequirementLevel(key);
}

export function createParty(id?: string): FireRecoveryParty {
  const partyId =
    text(id) ||
    (typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `party-${Math.random().toString(16).slice(2)}`);
  return {
    id: partyId,
    firstName: "",
    lastName: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    isResident: "",
    uninsured: false,
    insuranceCompany: "",
    policyNumber: "",
    insuranceContactNumber: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleYear: "",
    licensePlate: "",
    vin: "",
    otherVehicleDetails: "",
    atFault: "",
    commercialVehicle: false,
    dotNumber: "",
    companyName: "",
  };
}

export function emptyBilling(): FireRecoveryBilling {
  return {
    version: 1,
    runType: "MOTOR_VEHICLE",
    lawEnforcementReportNumber: "",
    nerisCode: "",
    parties: [],
  };
}

function yesNo(value: unknown): YesNoBlank {
  const raw = text(value).toUpperCase();
  if (raw === "YES" || raw === "NO") return raw;
  return "";
}

function partyFromUnknown(value: unknown): FireRecoveryParty | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<FireRecoveryParty>;
  const party = createParty(text(row.id));
  party.firstName = text(row.firstName);
  party.lastName = text(row.lastName);
  party.street = text(row.street);
  party.city = text(row.city);
  party.state = text(row.state);
  party.zip = text(row.zip);
  party.phone = text(row.phone);
  party.email = text(row.email);
  party.isResident = yesNo(row.isResident);
  party.uninsured = row.uninsured === true;
  party.insuranceCompany = text(row.insuranceCompany);
  party.policyNumber = text(row.policyNumber);
  party.insuranceContactNumber = text(row.insuranceContactNumber);
  party.vehicleMake = text(row.vehicleMake);
  party.vehicleModel = text(row.vehicleModel);
  party.vehicleYear = text(row.vehicleYear);
  party.licensePlate = text(row.licensePlate);
  party.vin = text(row.vin);
  party.otherVehicleDetails = text(row.otherVehicleDetails);
  party.atFault = yesNo(row.atFault);
  party.commercialVehicle = row.commercialVehicle === true;
  party.dotNumber = text(row.dotNumber);
  party.companyName = text(row.companyName);
  return party;
}

export function parseBilling(raw: string): FireRecoveryBilling {
  if (!text(raw)) return emptyBilling();
  try {
    const parsed = JSON.parse(raw) as Partial<FireRecoveryBilling>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.parties)) return emptyBilling();
    return {
      version: 1,
      runType: parsed.runType === "COMMERCIAL_TRUCKING" ? "COMMERCIAL_TRUCKING" : "MOTOR_VEHICLE",
      lawEnforcementReportNumber: text(parsed.lawEnforcementReportNumber),
      nerisCode: text(parsed.nerisCode),
      parties: parsed.parties.map(partyFromUnknown).filter((party): party is FireRecoveryParty => Boolean(party)),
    };
  } catch {
    return emptyBilling();
  }
}

export function serializeBilling(billing: FireRecoveryBilling): string {
  return JSON.stringify(billing);
}

function applyContact(party: FireRecoveryParty, contact: CopyContact | null) {
  if (!contact) return;
  party.firstName = text(contact.firstName);
  party.lastName = text(contact.lastName);
  party.phone = text(contact.phone);
  party.street = text(contact.street);
  party.city = text(contact.city);
  party.state = text(contact.state);
  party.zip = text(contact.zip);
  if (!party.insuranceCompany) party.insuranceCompany = text(contact.insuranceCompany);
}

function applyVehicle(party: FireRecoveryParty, vehicle: CopyVehicle) {
  party.vehicleMake = text(vehicle.vehicleMake);
  party.vehicleModel = text(vehicle.model);
  party.vehicleYear = text(vehicle.year);
  party.vin = text(vehicle.vin);
  party.licensePlate = text(vehicle.licensePlate);
  party.uninsured = vehicle.uninsured === true;
  party.insuranceCompany = vehicle.uninsured ? "" : text(vehicle.insuranceCompanyName) || party.insuranceCompany;
  party.policyNumber = text(vehicle.policyNumber);
  party.insuranceContactNumber = text(vehicle.insuranceCompanyPhone);
}

export function copyPartiesFromPersonOwner(
  persons: CopyContact[],
  owners: CopyContact[],
  vehicles: CopyVehicle[],
): FireRecoveryParty[] {
  const parties: FireRecoveryParty[] = [];
  const used = new Set<string>();
  const claim = (kind: "person" | "owner", index: number): CopyContact | null => {
    const list = kind === "person" ? persons : owners;
    const key = `${kind}:${index}`;
    if (used.has(key) || index < 0 || index >= list.length) return null;
    used.add(key);
    return list[index] ?? null;
  };
  const claimRef = (ref: string): CopyContact | null => {
    const [kind, rawIndex] = text(ref).split(":");
    const index = Number.parseInt(rawIndex ?? "", 10);
    if (kind !== "person" && kind !== "owner") return null;
    return claim(kind, index);
  };
  const claimNext = (): CopyContact | null => {
    for (let index = 0; index < persons.length; index += 1) {
      const contact = claim("person", index);
      if (contact) return contact;
    }
    for (let index = 0; index < owners.length; index += 1) {
      const contact = claim("owner", index);
      if (contact) return contact;
    }
    return null;
  };

  for (const vehicle of vehicles) {
    const involved = Array.isArray(vehicle.personsInvolved) ? vehicle.personsInvolved : [];
    let contact: CopyContact | null = null;
    for (const ref of involved) {
      contact = claimRef(ref);
      if (contact) break;
    }
    if (!contact) contact = claimNext();
    const party = createParty();
    applyContact(party, contact);
    applyVehicle(party, vehicle);
    parties.push(party);
  }

  const addLeftovers = (kind: "person" | "owner", list: CopyContact[]) => {
    list.forEach((_, index) => {
      const contact = claim(kind, index);
      if (!contact) return;
      const party = createParty();
      applyContact(party, contact);
      parties.push(party);
    });
  };
  addLeftovers("person", persons);
  addLeftovers("owner", owners);
  return parties;
}

export function incidentLocationParts(formValues: Record<string, string>): {
  street: string;
  city: string;
  state: string;
  zip: string;
} {
  const address = text(formValues.incident_location_address);
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    street: parts[0] ?? "",
    city: parts.length >= 3 ? (parts[1] ?? "") : "",
    state: text(formValues.location_state),
    zip: text(formValues.location_postal_code),
  };
}

export function displayRunDate(value: string): string {
  const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return text(value);
  return `${match[2]}/${match[3]}/${match[1]}`;
}

export function displayClock(value: string): string {
  const match = text(value).match(/(\d{2}:\d{2})/);
  return match?.[1] ?? text(value);
}

function personnelNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => text(entry)).filter((entry) => entry.length > 0);
  }
  return text(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function timeSortKey(value: string): string {
  const trimmed = text(value).replace(" ", "T");
  const dated = trimmed.match(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/);
  if (dated) return `${dated[1]}T${dated[2]}:${dated[3] ?? "00"}`;
  const clock = trimmed.match(/(\d{2}:\d{2})(?::(\d{2}))?/);
  if (clock) return `0000-00-00T${clock[1]}:${clock[2] ?? "00"}`;
  return "";
}

/** Incident clear time, then the latest Resources clear time, then Incident Times unit clear time. */
export function callClearedValue(formValues: Record<string, string>): string {
  const incidentClear = text(formValues.incident_time_clear) || text(formValues.time_incident_clear);
  if (incidentClear) return incidentClear;
  const resourceClears: string[] = [];
  const raw = formValues.resource_units_json ?? "";
  if (text(raw)) {
    try {
      const units = JSON.parse(raw) as unknown;
      if (Array.isArray(units)) {
        for (const unit of units) {
          if (!unit || typeof unit !== "object") continue;
          const row = unit as Record<string, unknown>;
          if (row.isCanceledEnroute === true) continue;
          const clear = text(row.clearTime);
          if (clear) resourceClears.push(clear);
        }
      }
    } catch {
      resourceClears.length = 0;
    }
  }
  if (resourceClears.length > 0) {
    return resourceClears.slice().sort((left, right) => timeSortKey(left).localeCompare(timeSortKey(right))).at(-1) ?? "";
  }
  return text(formValues.incident_time_unit_clear);
}

export function onScenePersonnel(resourceUnitsJson: string): { count: number; names: string[] } {
  if (!text(resourceUnitsJson)) return { count: 0, names: [] };
  try {
    const units = JSON.parse(resourceUnitsJson) as unknown;
    if (!Array.isArray(units)) return { count: 0, names: [] };
    const names = new Set<string>();
    for (const unit of units) {
      if (!unit || typeof unit !== "object") continue;
      const row = unit as Record<string, unknown>;
      if (row.isCanceledEnroute === true) continue;
      for (const name of personnelNames(row.personnel)) names.add(name);
    }
    return { count: names.size, names: [...names] };
  } catch {
    return { count: 0, names: [] };
  }
}

function gap(
  key: string,
  label: string,
  level: RequirementLevel,
  fixSection: BillingFixSection | "" = "",
  fixSectionLabel = "",
): BillingGap | null {
  if (level === "optional") return null;
  return { key, label, level, fixSection, fixSectionLabel };
}

export function findBillingGaps(
  billing: FireRecoveryBilling,
  formValues: Record<string, string>,
  settings: Partial<Record<FireRecoveryRequirementKey, RequirementLevel>>,
  filedByName: string,
  options?: { omitFiledBy?: boolean },
): { required: BillingGap[]; recommended: BillingGap[] } {
  const found: BillingGap[] = [];
  const push = (entry: BillingGap | null) => {
    if (entry) found.push(entry);
  };

  if (!options?.omitFiledBy && !text(filedByName)) {
    push(gap("fr.filedBy", "Form Filed By", "required"));
  }
  if (!text(formValues.incident_onset_date)) {
    push(gap("fr.runDate", "Run Date", "required", "core", "Core"));
  }
  if (!text(formValues.incident_time_call_arrival)) {
    push(gap("fr.alarm", "Time Alarm Received", "required", "incidentTimes", "Incident Times"));
  }
  if (!text(callClearedValue(formValues))) {
    push(gap("fr.clear", "Time Call Cleared", "required", "incidentTimes", "Incident Times"));
  }
  if (!text(formValues.incident_internal_id)) {
    push(gap("fr.runNumber", "Run Number", "required", "core", "Core"));
  }
  if (onScenePersonnel(formValues.resource_units_json ?? "").count < 1) {
    push(gap("fr.personnel", "Total Personnel On-Scene", "required", "resources", "Resources"));
  }
  const location = incidentLocationParts(formValues);
  if (!location.street) push(gap("fr.street", "Incident Location street", "required", "core", "Core"));
  if (!location.city) push(gap("fr.city", "Incident Location city", "required", "location", "Location"));
  if (!location.state) push(gap("fr.state", "Incident Location state", "required", "location", "Location"));
  if (!location.zip) push(gap("fr.zip", "Incident Location zip", "required", "location", "Location"));

  const lawLevel = requirementLevel("fr.lawEnforcementNumber", settings);
  if (!text(billing.lawEnforcementReportNumber)) {
    push(gap("fr.lawEnforcementNumber", "Law Enforcement Agency Report Number", lawLevel));
  }
  const code = text(billing.nerisCode) || text(formValues.primary_incident_type);
  if (!code) {
    push(gap("fr.nerisCode", "NERIS Code", requirementLevel("fr.nerisCode", settings)));
  }
  if (billing.parties.length < 1) {
    push(gap("fr.parties", "At least one party", "required"));
  }

  billing.parties.forEach((party, index) => {
    const title = `Party ${index + 1}`;
    const check = (key: FireRecoveryRequirementKey, label: string, value: string) => {
      if (text(value)) return;
      push(gap(`${key}:${party.id}`, `${title} — ${label}`, requirementLevel(key, settings)));
    };
    check("fr.party.firstName", "First Name", party.firstName);
    check("fr.party.lastName", "Last Name", party.lastName);
    const addressMissing = !text(party.street) || !text(party.city) || !text(party.state) || !text(party.zip);
    if (addressMissing) {
      push(
        gap(
          `fr.party.address:${party.id}`,
          `${title} — Party Address (street, city, state, zip)`,
          requirementLevel("fr.party.address", settings),
        ),
      );
    }
    check("fr.party.phone", "Party Phone", party.phone);
    check("fr.party.email", "Party Email", party.email);
    check("fr.party.isResident", "Is Resident?", party.isResident);
    if (!party.uninsured) check("fr.party.insuranceCompany", "Insurance Company / Liable Party", party.insuranceCompany);
    check("fr.party.policyNumber", "Policy Number", party.policyNumber);
    check("fr.party.insuranceContact", "Insurance Contact Number", party.insuranceContactNumber);
    check("fr.party.vehicleMake", "Vehicle Make", party.vehicleMake);
    check("fr.party.vehicleModel", "Vehicle Model", party.vehicleModel);
    check("fr.party.licensePlate", "License Plate", party.licensePlate);
    check("fr.party.vin", "VIN", party.vin);
    check("fr.party.atFault", "At Fault Party", party.atFault);
  });

  return {
    required: found.filter((entry) => entry.level === "required"),
    recommended: found.filter((entry) => entry.level === "recommended"),
  };
}

/** Labels for the NERIS Validate button. Form Filed By is filled in at export, so it is not listed. */
export function billingValidationIssueLabels(
  formValues: Record<string, string>,
  settings: Partial<Record<FireRecoveryRequirementKey, RequirementLevel>>,
): string[] {
  const primary = formValues.primary_incident_type ?? "";
  const additional = formValues.additional_incident_types ?? "";
  if (!isFireRecoveryBillable(primary, additional)) return [];
  const gaps = findBillingGaps(parseBilling(formValues.fire_recovery_billing_json ?? ""), formValues, settings, "", {
    omitFiledBy: true,
  });
  return gaps.required.map((entry) => `Motor Vehicle Collision - ${entry.label}`);
}

export function billingPrintRows(
  rawJson: string,
  formValues: Record<string, string>,
): Array<{ label: string; value: string }> {
  if (!text(rawJson)) return [];
  const billing = parseBilling(rawJson);
  if (rawJson.trim() && billing.parties.length === 0 && !text(billing.lawEnforcementReportNumber) && !text(billing.nerisCode) && billing.runType === "MOTOR_VEHICLE") {
    const parsed = (() => {
      try {
        return JSON.parse(rawJson) as { version?: number };
      } catch {
        return null;
      }
    })();
    if (!parsed || parsed.version !== 1) return [];
  }
  const rows: Array<{ label: string; value: string }> = [
    {
      label: "Run type",
      value: billing.runType === "COMMERCIAL_TRUCKING" ? "Commercial Trucking Incident" : "Motor Vehicle Incident",
    },
  ];
  if (text(billing.lawEnforcementReportNumber)) {
    rows.push({ label: "Law Enforcement Agency Report Number", value: billing.lawEnforcementReportNumber });
  }
  const code = text(billing.nerisCode) || text(formValues.primary_incident_type);
  if (code) rows.push({ label: "NERIS Code", value: code });
  billing.parties.forEach((party, index) => {
    const bits = [
      [party.firstName, party.lastName].filter((part) => text(part)).join(" "),
      [party.street, party.city, party.state, party.zip].filter((part) => text(part)).join(", "),
      party.phone ? `Phone: ${party.phone}` : "",
      party.email ? `Email: ${party.email}` : "",
      party.isResident ? `Resident: ${party.isResident}` : "",
      party.uninsured ? "Uninsured" : party.insuranceCompany ? `Insurance: ${party.insuranceCompany}` : "",
      party.policyNumber ? `Policy: ${party.policyNumber}` : "",
      party.insuranceContactNumber ? `Insurance phone: ${party.insuranceContactNumber}` : "",
      [party.vehicleYear, party.vehicleMake, party.vehicleModel].filter((part) => text(part)).join(" "),
      party.licensePlate ? `Plate: ${party.licensePlate}` : "",
      party.vin ? `VIN: ${party.vin}` : "",
      party.otherVehicleDetails ? party.otherVehicleDetails : "",
      party.atFault ? `At fault: ${party.atFault}` : "",
      party.commercialVehicle ? "Commercial vehicle" : "",
      party.dotNumber ? `DOT: ${party.dotNumber}` : "",
      party.companyName ? party.companyName : "",
    ].filter((part) => text(part));
    if (bits.length > 0) {
      rows.push({ label: `Party ${index + 1}`, value: bits.join(" • ") });
    }
  });
  return rows;
}
