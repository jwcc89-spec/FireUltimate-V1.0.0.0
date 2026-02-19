export type NerisSectionId =
  | "core"
  | "narrative"
  | "location"
  | "incidentTimes"
  | "resources"
  | "emergingHazards"
  | "exposures"
  | "riskReduction"
  | "medical"
  | "rescuesCasualties"
  | "attachments";

export type NerisFieldInputKind =
  | "text"
  | "date"
  | "time"
  | "textarea"
  | "select"
  | "readonly";

export interface NerisSectionConfig {
  id: NerisSectionId;
  label: string;
  helper: string;
}

export interface NerisValueOption {
  value: string;
  label: string;
}

export interface NerisConditionalRule {
  fieldId: string;
  operator: "equals" | "notEmpty" | "includes";
  value?: string;
}

export interface NerisFieldMetadata {
  id: string;
  sectionId: NerisSectionId;
  label: string;
  inputKind: NerisFieldInputKind;
  required?: boolean;
  requiredIf?: NerisConditionalRule;
  optionsKey?: keyof typeof NERIS_VALUE_SETS;
  placeholder?: string;
  helperText?: string;
  maxLength?: number;
  rows?: number;
  layout?: "half" | "full";
}

export type NerisFormValues = Record<string, string>;

export interface NerisValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

interface CreateNerisDefaultsInput {
  callNumber: string;
  incidentType?: string;
  receivedAt?: string;
}

export const NERIS_METADATA_VERSION = "NERIS v1 metadata scaffold";

export const NERIS_SCHEMA_REFERENCE_LINKS = [
  "https://neris.fsri.org/technical-reference",
  "https://api.neris.fsri.org/v1/openapi.json",
  "https://neris-prod-public.s3.us-east-2.amazonaws.com/docs/NERIS_V1_Core_Schemas.zip",
  "https://neris-prod-public.s3.us-east-2.amazonaws.com/docs/NERIS_V1_Secondary_Schemas.zip",
] as const;

export const NERIS_FORM_SECTIONS: NerisSectionConfig[] = [
  {
    id: "core",
    label: "Core",
    helper:
      "Complete baseline NERIS incident fields. Required and conditional rules are metadata-driven.",
  },
  {
    id: "narrative",
    label: "Narrative",
    helper: "Document final outcomes and notable response context.",
  },
  {
    id: "location",
    label: "Location",
    helper: "Capture location precision and scene environment details.",
  },
  {
    id: "incidentTimes",
    label: "Incident Times",
    helper: "Track lifecycle timestamps from dispatch through clearance.",
  },
  {
    id: "resources",
    label: "Resources",
    helper: "Record units, apparatus, and mutual aid resource usage.",
  },
  {
    id: "emergingHazards",
    label: "Emerging Hazards",
    helper: "Flag hazardous materials or hazards found on scene.",
  },
  {
    id: "exposures",
    label: "Exposures",
    helper: "Document threatened structures, vehicles, or adjacent risk.",
  },
  {
    id: "riskReduction",
    label: "Risk Reduction",
    helper: "Capture prevention/education actions connected to this incident.",
  },
  {
    id: "medical",
    label: "Medical",
    helper: "Document patient care and related medical observations.",
  },
  {
    id: "rescuesCasualties",
    label: "Rescues/Casualties",
    helper: "Track rescues, injuries, and casualty outcomes.",
  },
  {
    id: "attachments",
    label: "Attachments",
    helper: "Attach CAD notes, photos, diagrams, and supporting files.",
  },
];

const NERIS_INCIDENT_TYPE_VALUES: readonly string[] = [
  "FIRE: OUTSIDE_FIRE: CONSTRUCTION_WASTE",
  "FIRE: OUTSIDE_FIRE: OTHER_OUTSIDE_FIRE",
  "FIRE: OUTSIDE_FIRE: OUTSIDE_TANK_FIRE",
  "FIRE: OUTSIDE_FIRE: TRASH_RUBBISH_FIRE",
  "FIRE: OUTSIDE_FIRE: VEGETATION_GRASS_FIRE",
  "FIRE: OUTSIDE_FIRE: WILDFIRE_WILDLAND",
  "FIRE: OUTSIDE_FIRE: WILDFIRE_URBAN_INTERFACE",
  "FIRE: OUTSIDE_FIRE: UTILITY_INFRASTRUCTURE_FIRE",
  "FIRE: OUTSIDE_FIRE: DUMPSTER_OUTDOOR_CONTAINER_FIRE",
  "FIRE: SPECIAL_FIRE: ESS_FIRE",
  "FIRE: SPECIAL_FIRE: EXPLOSION",
  "FIRE: SPECIAL_FIRE: INFRASTRUCTURE_FIRE",
  "FIRE: STRUCTURE_FIRE: STRUCTURAL_INVOLVEMENT_FIRE",
  "FIRE: STRUCTURE_FIRE: ROOM_AND_CONTENTS_FIRE",
  "FIRE: STRUCTURE_FIRE: CONFINED_COOKING_APPLIANCE_FIRE",
  "FIRE: STRUCTURE_FIRE: CHIMNEY_FIRE",
  "FIRE: TRANSPORTATION_FIRE: AIRCRAFT_FIRE",
  "FIRE: TRANSPORTATION_FIRE: VEHICLE_FIRE_PASSENGER",
  "FIRE: TRANSPORTATION_FIRE: VEHICLE_FIRE_COMMERCIAL",
  "FIRE: TRANSPORTATION_FIRE: VEHICLE_FIRE_RV",
  "FIRE: TRANSPORTATION_FIRE: VEHICLE_FIRE_FOOD_TRUCK",
  "FIRE: TRANSPORTATION_FIRE: BOAT_PERSONAL_WATERCRAFT_BARGE_FIRE",
  "FIRE: TRANSPORTATION_FIRE: POWERED_MOBILITY_DEVICE_FIRE",
  "FIRE: TRANSPORTATION_FIRE: TRAIN_RAIL_FIRE",
  "HAZSIT: HAZARD_NONCHEM: BOMB_THREAT_RESPONSE_SUSPICIOUS_PACKAGE",
  "HAZSIT: HAZARD_NONCHEM: ELEC_POWER_LINE_DOWN_ARCHING_MALFUNC",
  "HAZSIT: HAZARD_NONCHEM: ELEC_HAZARD_SHORT_CIRCUIT",
  "HAZSIT: HAZARD_NONCHEM: MOTOR_VEHICLE_COLLISION",
  "HAZSIT: HAZARDOUS_MATERIALS: FUEL_SPILL_ODOR",
  "HAZSIT: HAZARDOUS_MATERIALS: GAS_LEAK_ODOR",
  "HAZSIT: HAZARDOUS_MATERIALS: CARBON_MONOXIDE_RELEASE",
  "HAZSIT: HAZARDOUS_MATERIALS: BIOLOGICAL_RELEASE_INCIDENT",
  "HAZSIT: HAZARDOUS_MATERIALS: RADIOACTIVE_RELEASE_INCIDENT",
  "HAZSIT: HAZARDOUS_MATERIALS: HAZMAT_RELEASE_TRANSPORT",
  "HAZSIT: HAZARDOUS_MATERIALS: HAZMAT_RELEASE_FACILITY",
  "HAZSIT: OVERPRESSURE: RUPTURE_WITHOUT_FIRE",
  "HAZSIT: OVERPRESSURE: NO_RUPTURE",
  "HAZSIT: INVESTIGATION: ODOR",
  "HAZSIT: INVESTIGATION: SMOKE_INVESTIGATION",
  "MEDICAL: ILLNESS: ABDOMINAL_PAIN",
  "MEDICAL: ILLNESS: ALLERGIC_REACTION_STINGS",
  "MEDICAL: ILLNESS: BACK_PAIN_NON_TRAUMA",
  "MEDICAL: ILLNESS: BREATHING_PROBLEMS",
  "MEDICAL: ILLNESS: CARDIAC_ARREST",
  "MEDICAL: ILLNESS: CHEST_PAIN_NON_TRAUMA",
  "MEDICAL: ILLNESS: CONVULSIONS_SEIZURES",
  "MEDICAL: ILLNESS: DIABETIC_PROBLEMS",
  "MEDICAL: ILLNESS: HEADACHE",
  "MEDICAL: ILLNESS: HEART_PROBLEMS",
  "MEDICAL: ILLNESS: OVERDOSE",
  "MEDICAL: ILLNESS: PANDEMIC_EPIDEMIC_OUTBREAK",
  "MEDICAL: ILLNESS: PREGNANCY_CHILDBIRTH",
  "MEDICAL: ILLNESS: PSYCHOLOGICAL_BEHAVIOR_ISSUES",
  "MEDICAL: ILLNESS: SICK_CASE",
  "MEDICAL: ILLNESS: STROKE_CVA",
  "MEDICAL: ILLNESS: UNCONSCIOUS_VICTIM",
  "MEDICAL: ILLNESS: WELL_PERSON_CHECK",
  "MEDICAL: ILLNESS: ALTERED_MENTAL_STATUS",
  "MEDICAL: ILLNESS: NAUSEA_VOMITING",
  "MEDICAL: ILLNESS: UNKNOWN_PROBLEM",
  "MEDICAL: ILLNESS: NO_APPROPRIATE_CHOICE",
  "MEDICAL: INJURY: ANIMAL_BITES",
  "MEDICAL: INJURY: ASSAULT",
  "MEDICAL: INJURY: BURNS_EXPLOSION",
  "MEDICAL: INJURY: CARBON_MONOXIDE_OTHER_INHALATION_INJURY",
  "MEDICAL: INJURY: CHOKING",
  "MEDICAL: INJURY: DROWNING_DIVING_SCUBA_ACCIDENT",
  "MEDICAL: INJURY: ELECTROCUTION",
  "MEDICAL: INJURY: EYE_TRAUMA",
  "MEDICAL: INJURY: FALL",
  "MEDICAL: INJURY: HEAT_COLD_EXPOSURE",
  "MEDICAL: INJURY: MOTOR_VEHICLE_COLLISION",
  "MEDICAL: INJURY: INDUSTRIAL_INACCESSIBLE_ENTRAPMENT",
  "MEDICAL: INJURY: POISONING",
  "MEDICAL: INJURY: GUNSHOT_WOUND",
  "MEDICAL: INJURY: HEMORRHAGE_LACERATION",
  "MEDICAL: INJURY: STAB_PENETRATING_TRAUMA",
  "MEDICAL: INJURY: OTHER_TRAUMATIC_INJURY",
  "MEDICAL: OTHER: HEALTHCARE_PROFESSIONAL_ADMISSION",
  "MEDICAL: OTHER: MEDICAL_ALARM",
  "MEDICAL: OTHER: STANDBY_REQUEST",
  "MEDICAL: OTHER: TRANSFER_INTERFACILITY",
  "MEDICAL: OTHER: AIRMEDICAL_TRANSPORT",
  "MEDICAL: OTHER: INTERCEPT_OTHER_UNIT",
  "MEDICAL: OTHER: COMMUNITY_PUBLIC_HEALTH",
  "PUBSERV: CITIZEN_ASSIST: LOST_PERSON",
  "PUBSERV: CITIZEN_ASSIST: PERSON_IN_DISTRESS",
  "PUBSERV: CITIZEN_ASSIST: CITIZEN_ASSIST_SERVICE_CALL",
  "PUBSERV: CITIZEN_ASSIST: LIFT_ASSIST",
  "PUBSERV: ALARMS_NONMED: FIRE_ALARM",
  "PUBSERV: ALARMS_NONMED: GAS_ALARM",
  "PUBSERV: ALARMS_NONMED: CO_ALARM",
  "PUBSERV: ALARMS_NONMED: OTHER_ALARM",
  "PUBSERV: DISASTER_WEATHER: DAMAGE_ASSESSMENT",
  "PUBSERV: DISASTER_WEATHER: WEATHER_RESPONSE",
  "PUBSERV: OTHER: MOVE_UP",
  "PUBSERV: OTHER: STANDBY",
  "PUBSERV: OTHER: DAMAGED_HYDRANT",
  "RESCUE: OUTSIDE: BACKOUNTRY_RESCUE",
  "RESCUE: OUTSIDE: CONFINED_SPACE_RESCUE",
  "RESCUE: OUTSIDE: TRENCH",
  "RESCUE: OUTSIDE: EXTRICATION_ENTRAPPED",
  "RESCUE: OUTSIDE: HIGH_ANGLE_RESCUE",
  "RESCUE: OUTSIDE: LOW_ANGLE_RESCUE",
  "RESCUE: OUTSIDE: STEEP_ANGLE_RESCUE",
  "RESCUE: OUTSIDE: LIMITED_NO_ACCESS",
  "RESCUE: STRUCTURE: BUILDING_STRUCTURE_COLLAPSE",
  "RESCUE: STRUCTURE: CONFINED_SPACE_RESCUE",
  "RESCUE: STRUCTURE: ELEVATOR_ESCALATOR_RESCUE",
  "RESCUE: STRUCTURE: EXTRICATION_ENTRAPPED",
  "RESCUE: TRANSPORTATION: MOTOR_VEHICLE_EXTRICATION_ENTRAPPED",
  "RESCUE: TRANSPORTATION: TRAIN_RAIL_COLLISION_DERAILMENT",
  "RESCUE: TRANSPORTATION: AVIATION_COLLISION_CRASH",
  "RESCUE: TRANSPORTATION: AVIATION_STANDBY",
  "RESCUE: WATER: PERSON_IN_WATER_STANDING",
  "RESCUE: WATER: PERSON_IN_WATER_SWIFTWATER",
  "RESCUE: WATER: WATERCRAFT_IN_DISTRESS",
  "NOEMERG: FALSE_ALARM: INTENTIONAL_FALSE_ALARM",
  "NOEMERG: FALSE_ALARM: MALFUNCTIONING_ALARM",
  "NOEMERG: FALSE_ALARM: ACCIDENTAL_ALARM",
  "NOEMERG: FALSE_ALARM: OTHER_FALSE_CALL",
  "NOEMERG: FALSE_ALARM: BOMB_SCARE",
  "NOEMERG: GOOD_INTENT: NO_INCIDENT_FOUND_LOCATION_ERROR",
  "NOEMERG: GOOD_INTENT: CONTROLLED_BURNING_AUTHORIZED",
  "NOEMERG: GOOD_INTENT: SMOKE_FROM_NONHOSTILE_SOURCE",
  "NOEMERG: GOOD_INTENT: INVESTIGATE_HAZARDOUS_RELEASE",
  "NOEMERG: CANCELLED",
  "LAWENFORCE",
];

function formatNerisIncidentTypeLabel(value: string): string {
  return value
    .split(":")
    .map((segment) =>
      segment
        .trim()
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase()),
    )
    .join(" / ");
}

const NERIS_INCIDENT_TYPE_OPTIONS: NerisValueOption[] = NERIS_INCIDENT_TYPE_VALUES.map(
  (value) => ({
    value,
    label: formatNerisIncidentTypeLabel(value),
  }),
);

export const NERIS_VALUE_SETS = {
  report_status: [
    { value: "Draft", label: "Draft" },
    { value: "In Review", label: "In Review" },
    { value: "Ready for Review", label: "Ready for Review" },
    { value: "Approved", label: "Approved" },
    { value: "Submitted", label: "Submitted" },
  ],
  incident_type: NERIS_INCIDENT_TYPE_OPTIONS,
  incident_modifier: [
    { value: "None", label: "None" },
    { value: "Mass Casualty", label: "Mass Casualty" },
    { value: "Hazmat", label: "Hazmat" },
    { value: "Wildland", label: "Wildland" },
  ],
  dispatch_code: [
    { value: "AMB.UNRESP-BREATHING", label: "AMB.UNRESP-BREATHING" },
    { value: "FIRE.STRUCT-RESIDENTIAL", label: "FIRE.STRUCT-RESIDENTIAL" },
    { value: "FIRE.AUTO-ACCIDENT", label: "FIRE.AUTO-ACCIDENT" },
    { value: "RESCUE.PUBLIC-ASSIST", label: "RESCUE.PUBLIC-ASSIST" },
  ],
} as const satisfies Record<string, NerisValueOption[]>;

const NERIS_SECTION_NOTE_IDS: NerisSectionId[] = [
  "location",
  "incidentTimes",
  "resources",
  "emergingHazards",
  "exposures",
  "riskReduction",
  "medical",
  "rescuesCasualties",
  "attachments",
];

const NERIS_SECTION_NOTE_FIELDS: NerisFieldMetadata[] = NERIS_SECTION_NOTE_IDS.map(
  (sectionId) => ({
    id: `${sectionId}_notes`,
    sectionId,
    label: `${NERIS_FORM_SECTIONS.find((section) => section.id === sectionId)?.label ?? sectionId} notes`,
    inputKind: "textarea",
    placeholder: "Enter notes for this section...",
    rows: 6,
    maxLength: 100000,
    layout: "full",
  }),
);

export const NERIS_FORM_FIELDS: NerisFieldMetadata[] = [
  {
    id: "incident_onset_date",
    sectionId: "core",
    label: "Incident onset date",
    inputKind: "date",
    required: true,
    layout: "half",
  },
  {
    id: "incident_onset_time",
    sectionId: "core",
    label: "Incident onset time",
    inputKind: "time",
    required: true,
    layout: "half",
  },
  {
    id: "incident_number",
    sectionId: "core",
    label: "Incident number",
    inputKind: "readonly",
    required: true,
    layout: "half",
  },
  {
    id: "dispatch_run_number",
    sectionId: "core",
    label: "Dispatch run number",
    inputKind: "text",
    required: true,
    layout: "half",
  },
  {
    id: "primary_incident_type",
    sectionId: "core",
    label: "Primary incident type",
    inputKind: "select",
    optionsKey: "incident_type",
    required: true,
    layout: "full",
  },
  {
    id: "additional_incident_types",
    sectionId: "core",
    label: "Additional incident type(s)",
    inputKind: "text",
    requiredIf: {
      fieldId: "primary_incident_type",
      operator: "equals",
      value: "MEDICAL: ILLNESS: NO_APPROPRIATE_CHOICE",
    },
    placeholder: "Comma-separated values (up to 2)",
    layout: "full",
  },
  {
    id: "special_incident_modifiers",
    sectionId: "core",
    label: "Special incident modifier(s)",
    inputKind: "select",
    optionsKey: "incident_modifier",
    layout: "full",
  },
  {
    id: "initial_dispatch_code",
    sectionId: "core",
    label: "Initial dispatch code",
    inputKind: "select",
    optionsKey: "dispatch_code",
    layout: "full",
  },
  {
    id: "narrative_outcome",
    sectionId: "narrative",
    label: "Describe the final outcomes of the incident.",
    inputKind: "textarea",
    required: true,
    maxLength: 100000,
    rows: 7,
    layout: "full",
  },
  {
    id: "narrative_obstacles",
    sectionId: "narrative",
    label: "Describe any obstacles that impacted the incident.",
    inputKind: "textarea",
    maxLength: 100000,
    rows: 7,
    layout: "full",
  },
  ...NERIS_SECTION_NOTE_FIELDS,
];

export function getNerisValueOptions(
  key: keyof typeof NERIS_VALUE_SETS,
): NerisValueOption[] {
  return [...NERIS_VALUE_SETS[key]];
}

export function getNerisFieldsForSection(sectionId: NerisSectionId): NerisFieldMetadata[] {
  return NERIS_FORM_FIELDS.filter((field) => field.sectionId === sectionId);
}

function evaluateNerisRule(rule: NerisConditionalRule, values: NerisFormValues): boolean {
  const value = (values[rule.fieldId] ?? "").trim();
  if (rule.operator === "notEmpty") {
    return value.length > 0;
  }
  if (rule.operator === "includes") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .includes(rule.value ?? "");
  }
  return value === (rule.value ?? "");
}

export function isNerisFieldRequired(
  field: NerisFieldMetadata,
  values: NerisFormValues,
): boolean {
  if (field.required) {
    return true;
  }
  if (!field.requiredIf) {
    return false;
  }
  return evaluateNerisRule(field.requiredIf, values);
}

export function validateNerisSection(
  sectionId: NerisSectionId,
  values: NerisFormValues,
): NerisValidationResult {
  const sectionFields = getNerisFieldsForSection(sectionId);
  const errors: Record<string, string> = {};

  for (const field of sectionFields) {
    const value = (values[field.id] ?? "").trim();
    const isRequired = isNerisFieldRequired(field, values);
    if (isRequired && !value) {
      errors[field.id] = `${field.label} is required.`;
      continue;
    }

    if (field.maxLength && value.length > field.maxLength) {
      errors[field.id] = `${field.label} must be ${field.maxLength} characters or less.`;
      continue;
    }

    if (field.optionsKey && value) {
      const allowedValues = new Set<string>(
        NERIS_VALUE_SETS[field.optionsKey].map((option) => option.value),
      );
      if (!allowedValues.has(value)) {
        errors[field.id] = `${field.label} must use an allowed value.`;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

function normalizeNerisTime(receivedAt: string | undefined): string {
  if (!receivedAt) {
    return "15:30:13";
  }
  const match = receivedAt.match(/^(\d{2}:\d{2}:\d{2})$/);
  if (!match) {
    return "15:30:13";
  }
  return match[1];
}

function mapIncidentSummaryToNerisType(incidentType: string | undefined): string {
  const normalized = (incidentType ?? "").trim().toLowerCase();
  if (!normalized) {
    return "MEDICAL: ILLNESS: SICK_CASE";
  }

  if (normalized.includes("convulsion") || normalized.includes("seizure")) {
    return "MEDICAL: ILLNESS: CONVULSIONS_SEIZURES";
  }
  if (normalized.includes("medical")) {
    return "MEDICAL: ILLNESS: SICK_CASE";
  }
  if (normalized.includes("structure fire")) {
    return "FIRE: STRUCTURE_FIRE: STRUCTURAL_INVOLVEMENT_FIRE";
  }
  if (normalized.includes("vehicle fire")) {
    return "FIRE: TRANSPORTATION_FIRE: VEHICLE_FIRE_PASSENGER";
  }
  if (normalized.includes("alarm")) {
    return "PUBSERV: ALARMS_NONMED: FIRE_ALARM";
  }
  if (normalized.includes("smoke")) {
    return "HAZSIT: INVESTIGATION: SMOKE_INVESTIGATION";
  }

  return "MEDICAL: ILLNESS: SICK_CASE";
}

export function createDefaultNerisFormValues({
  callNumber,
  incidentType,
  receivedAt,
}: CreateNerisDefaultsInput): NerisFormValues {
  const incidentTypeValues = new Set<string>(
    NERIS_VALUE_SETS.incident_type.map((option) => option.value),
  );
  const mappedIncidentType = mapIncidentSummaryToNerisType(incidentType);
  const safeIncidentType = incidentTypeValues.has(mappedIncidentType)
    ? mappedIncidentType
    : "MEDICAL: ILLNESS: SICK_CASE";

  return {
    incident_onset_date: "2026-02-18",
    incident_onset_time: normalizeNerisTime(receivedAt),
    incident_number: callNumber,
    dispatch_run_number: callNumber.replace(/^D-/, ""),
    primary_incident_type: safeIncidentType,
    additional_incident_types: "",
    special_incident_modifiers: "None",
    initial_dispatch_code: "AMB.UNRESP-BREATHING",
    narrative_outcome: "",
    narrative_obstacles: "",
    location_notes: "",
    incidentTimes_notes: "",
    resources_notes: "",
    emergingHazards_notes: "",
    exposures_notes: "",
    riskReduction_notes: "",
    medical_notes: "",
    rescuesCasualties_notes: "",
    attachments_notes: "",
  };
}
