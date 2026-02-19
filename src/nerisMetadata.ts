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
  | "datetime"
  | "textarea"
  | "select"
  | "multiselect"
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
  operator: "equals" | "notEmpty" | "isEmpty" | "includes";
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
  address?: string;
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

const NERIS_ACTION_TACTIC_VALUES: readonly string[] = [
  "EMERGENCY_MEDICAL_CARE: PATIENT_ASSESSMENT",
  "EMERGENCY_MEDICAL_CARE: PROVIDE_BASIC_LIFE_SUPPORT",
  "EMERGENCY_MEDICAL_CARE: PROVIDE_ADVANCED_LIFE_SUPPORT",
  "EMERGENCY_MEDICAL_CARE: PROVIDE_TRANSPORT",
  "EMERGENCY_MEDICAL_CARE: PATIENT_REFERRAL",
  "COMMAND_AND_CONTROL: ESTABLISH_INCIDENT_COMMAND",
  "COMMAND_AND_CONTROL: SAFETY_OFFICER_ASSIGNED",
  "COMMAND_AND_CONTROL: PIO_ASSIGNED",
  "COMMAND_AND_CONTROL: NOTIFY_OTHER_AGENCIES",
  "COMMAND_AND_CONTROL: INCIDENT_ASSESSMENT_COMPLETED",
  "COMMAND_AND_CONTROL: ACCOUNTABILITY_OFFICER_ASSIGNED",
  "FORCIBLE_ENTRY",
  "INVESTIGATION",
  "SUPPRESSION: STRUCTURAL_FIRE_SUPPRESSION: INTERIOR",
  "SUPPRESSION: STRUCTURAL_FIRE_SUPPRESSION: EXTERIOR",
  "SUPPRESSION: STRUCTURAL_FIRE_SUPPRESSION: EXTERIOR_AND_INTERIOR",
  "SUPPRESSION: OUTSIDE_FIRE_SUPPRESSION: ESTABLISH FIRE LINES",
  "SUPPRESSION: OUTSIDE_FIRE_SUPPRESSION: BACKBURN",
  "SUPPRESSION: OUTSIDE_FIRE_SUPPRESSION: CONFINEMENT",
  "SUPPRESSION: OUTSIDE_FIRE_SUPPRESSION: STRUCTURE_PROTECTION",
  "SUPPRESSION: OUTSIDE_FIRE_SUPPRESSION: FIRE_CONTROL_EXTINGUISHMENT",
  "SUPPRESSION: OUTSIDE_FIRE_SUPPRESSION: FIRE_RETARDANT_DROP",
  "SUPPRESSION: OUTSIDE_FIRE_SUPPRESSION: WATER_DROP",
  "CONTAINMENT: OUTSIDE_FIRE_SUPPRESSION: HAND_CREW_FUEL_BREAK",
  "CONTAINMENT: OUTSIDE_FIRE_SUPPRESSION: DOZER_FUEL_BREAK",
  "VENTILATION: VERTICAL",
  "VENTILATION: VERTICAL: PRIOR_TO_SUPPRESSION",
  "VENTILATION: VERTICAL: DURING_SUPPRESSION",
  "VENTILATION: VERTICAL: POST_SUPPRESSION",
  "VENTILATION: HORIZONTAL",
  "VENTILATION: HORIZONTAL: PRIOR_TO_SUPPRESSION",
  "VENTILATION: HORIZONTAL: DURING_SUPPRESSION",
  "VENTILATION: HORIZONTAL: POST_SUPPRESSION",
  "VENTILATION: POSITIVE_PRESSURE",
  "VENTILATION: POSITIVE_PRESSURE: PRIOR_TO_SUPPRESSION",
  "VENTILATION: POSITIVE_PRESSURE: DURING_SUPPRESSION",
  "VENTILATION: POSITIVE_PRESSURE: POST_SUPPRESSION",
  "VENTILATION: HYDRAULIC",
  "VENTILATION: HYDRAULIC: PRIOR_TO_SUPPRESSION",
  "VENTILATION: HYDRAULIC: DURING_SUPPRESSION",
  "VENTILATION: HYDRAULIC: POST_SUPPRESSION",
  "SEARCH_STRUCTURE: DOOR_INITIATED_SEARCH",
  "SEARCH_STRUCTURE: DOOR_INITIATED_SEARCH: PRIOR_TO_SUPPRESSION",
  "SEARCH_STRUCTURE: DOOR_INITIATED_SEARCH: DURING_SUPPRESSION",
  "SEARCH_STRUCTURE: DOOR_INITIATED_SEARCH: POST_SUPPRESSION",
  "SEARCH_STRUCTURE: WINDOW_INITIATED_SEARCH",
  "SEARCH_STRUCTURE: WINDOW_INITIATED_SEARCH: PRIOR_TO_SUPPRESSION",
  "SEARCH_STRUCTURE: WINDOW_INITIATED_SEARCH: DURING_SUPPRESSION",
  "SEARCH_STRUCTURE: WINDOW_INITIATED_SEARCH: POST_SUPPRESSION",
  "NON_STRUCTURE_SEARCH: SEARCH_AREA_OF_COLLAPSE",
  "NON_STRUCTURE_SEARCH: SEARCH_UNDERGROUND_INFRASTRUCTURE",
  "NON_STRUCTURE_SEARCH: WIDE_AREA_OUTDOOR_SEARCH",
  "NON_STRUCTURE_SEARCH: SEARCH_WATERWAY",
  "NON_STRUCTURE_SEARCH: BODY_RECOVERY",
  "NON_STRUCTURE_SEARCH: USAR_K9_SEARCH",
  "SALVAGE_AND_OVERHAUL",
  "PERSONNEL_CONTAMINATION_REDUCTION: ON_SCENE_CONTAMINATION_REDUCTION",
  "PERSONNEL_CONTAMINATION_REDUCTION: CLEAN_CAB_TRANSPORT",
  "PERSONNEL_CONTAMINATION_REDUCTION: PPE_WASHED_POST_INCIDENT",
  "HAZARDOUS_SITUATION_MITIGATION: TAKE_SAMPLES",
  "HAZARDOUS_SITUATION_MITIGATION: SPILL_CONTROL",
  "HAZARDOUS_SITUATION_MITIGATION: LEAK_STOP",
  "HAZARDOUS_SITUATION_MITIGATION: REMOVE_HAZARD",
  "HAZARDOUS_SITUATION_MITIGATION: DECONTAMINATION",
  "HAZARDOUS_SITUATION_MITIGATION: ATMOSPHERIC_MONITORING_INTERIOR",
  "HAZARDOUS_SITUATION_MITIGATION: ATMOSPHERIC_MONITORING_EXTERIOR_FENCELINE",
  "PROVIDE_EVACUATION_SUPPORT: CONNECTED_INTERIOR_SPACES",
  "PROVIDE_EVACUATION_SUPPORT: REMOTE_INTERIOR_SPACES",
  "PROVIDE_EVACUATION_SUPPORT: NEARBY_BUILDINGS",
  "PROVIDE_EVACUATION_SUPPORT: LARGE_AREA",
  "PROVIDE_EQUIPMENT: PROVIDE_SPECIAL_EQUIPMENT",
  "PROVIDE_EQUIPMENT: PROVIDE_LIGHT",
  "PROVIDE_EQUIPMENT: PROVIDE_ELECTRICAL_POWER",
  "PROVIDE_EQUIPMENT: PROVIDE_DRONE_VIDEO_EQUIPMENT",
  "PROVIDE_SERVICES: RESTORE_SPRINKLER_SYSTEM",
  "PROVIDE_SERVICES: RESTORE_RESET_ALARM_SYSTEM",
  "PROVIDE_SERVICES: SHUT_DOWN_ALARM",
  "PROVIDE_SERVICES: SHUT_DOWN_SPRINKLER_SYSTEM",
  "PROVIDE_SERVICES: SECURE_PROPERTY",
  "PROVIDE_SERVICES: REMOVE_WATER",
  "PROVIDE_SERVICES: ASSIST_UNINJURED_PERSON",
  "PROVIDE_SERVICES: ASSIST_ANIMAL",
  "PROVIDE_SERVICES: PROVIDE_APPARATUS_WATER",
  "PROVIDE_SERVICES: CONTROL_CROWD",
  "PROVIDE_SERVICES: CONTROL_TRAFFIC",
  "PROVIDE_SERVICES: DAMAGE_ASSESSMENT",
  "INFORMATION_ENFORCEMENT: REFER_TO_PROPER_AHJ",
  "INFORMATION_ENFORCEMENT: ENFORCE_CODE_OR_LAW",
  "INFORMATION_ENFORCEMENT: PROVIDE_PUBLIC_INFORMATION",
];

const NERIS_NO_ACTION_VALUES: readonly string[] = [
  "CANCELLED",
  "STAGED_STANDBY",
  "NO_INCIDENT_FOUND",
];

const NERIS_AID_DIRECTION_VALUES: readonly string[] = ["GIVEN", "RECEIVED"];

const NERIS_AID_TYPE_VALUES: readonly string[] = [
  "SUPPORT_AID",
  "IN_LIEU_AID",
  "ACTING_AS_AID",
];

const NERIS_AID_NONFD_VALUES: readonly string[] = [
  "LAW_ENFORCEMENT",
  "SOCIAL_SERVICES",
  "ANIMAL_SERVICES",
  "HOUSING_SERVICES",
  "UTILITIES_PUBLIC_WORKS",
  "REMEDIATION_SERVICES",
];

function formatNerisCodeLabel(value: string): string {
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
    label: formatNerisCodeLabel(value),
  }),
);

const NERIS_ACTION_TACTIC_OPTIONS: NerisValueOption[] = NERIS_ACTION_TACTIC_VALUES.map(
  (value) => ({
    value,
    label: formatNerisCodeLabel(value),
  }),
);

const NERIS_NO_ACTION_OPTIONS: NerisValueOption[] = NERIS_NO_ACTION_VALUES.map((value) => ({
  value,
  label: formatNerisCodeLabel(value),
}));

const NERIS_AID_DIRECTION_OPTIONS: NerisValueOption[] = NERIS_AID_DIRECTION_VALUES.map(
  (value) => ({
    value,
    label: formatNerisCodeLabel(value),
  }),
);

const NERIS_AID_TYPE_OPTIONS: NerisValueOption[] = NERIS_AID_TYPE_VALUES.map((value) => ({
  value,
  label: formatNerisCodeLabel(value),
}));

const NERIS_AID_NONFD_OPTIONS: NerisValueOption[] = NERIS_AID_NONFD_VALUES.map((value) => ({
  value,
  label: formatNerisCodeLabel(value),
}));

export const NERIS_VALUE_SETS = {
  report_status: [
    { value: "Draft", label: "Draft" },
    { value: "In Review", label: "In Review" },
    { value: "Ready for Review", label: "Ready for Review" },
    { value: "Approved", label: "Approved" },
    { value: "Submitted", label: "Submitted" },
  ],
  incident_type: NERIS_INCIDENT_TYPE_OPTIONS,
  action_tactic: NERIS_ACTION_TACTIC_OPTIONS,
  no_action: NERIS_NO_ACTION_OPTIONS,
  aid_direction: NERIS_AID_DIRECTION_OPTIONS,
  aid_type: NERIS_AID_TYPE_OPTIONS,
  aid_nonfd: NERIS_AID_NONFD_OPTIONS,
  incident_modifier: [
    {
      value: "TYPE_SET_PENDING",
      label: "Type set pending from published type_special_modifier reference",
    },
  ],
  yes_no: [
    { value: "YES", label: "Yes" },
    { value: "NO", label: "No" },
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
    id: "incident_neris_id",
    sectionId: "core",
    label: "Incident NERIS ID",
    inputKind: "readonly",
    required: true,
    layout: "full",
    helperText: "System identifier derived from incident start time.",
  },
  {
    id: "incident_internal_id",
    sectionId: "core",
    label: "Incident number",
    inputKind: "text",
    required: true,
    layout: "half",
  },
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
    id: "dispatch_internal_id",
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
    inputKind: "multiselect",
    optionsKey: "incident_type",
    helperText: "Select up to 2 additional types when needed.",
    layout: "full",
  },
  {
    id: "special_incident_modifiers",
    sectionId: "core",
    label: "Special incident modifier(s)",
    inputKind: "text",
    placeholder: "Value set pending publication of type_special_modifier",
    helperText:
      "NERIS core schema references type_special_modifier; currently pending in public type workbook.",
    layout: "full",
  },
  {
    id: "incident_actions_taken",
    sectionId: "core",
    label: "Actions taken",
    inputKind: "multiselect",
    optionsKey: "action_tactic",
    requiredIf: {
      fieldId: "incident_noaction",
      operator: "isEmpty",
    },
    helperText: "Required unless a No action reason is selected.",
    layout: "full",
  },
  {
    id: "incident_noaction",
    sectionId: "core",
    label: "No action reason",
    inputKind: "select",
    optionsKey: "no_action",
    requiredIf: {
      fieldId: "incident_actions_taken",
      operator: "isEmpty",
    },
    helperText: "Required if no actions are entered.",
    layout: "full",
  },
  {
    id: "fd_neris_id",
    sectionId: "core",
    label: "Department NERIS ID",
    inputKind: "text",
    required: true,
    layout: "half",
  },
  {
    id: "dispatch_center_id",
    sectionId: "core",
    label: "Dispatch center ID",
    inputKind: "text",
    layout: "half",
  },
  {
    id: "dispatch_location_address",
    sectionId: "core",
    label: "Dispatch location",
    inputKind: "text",
    required: true,
    layout: "full",
  },
  {
    id: "incident_location_address",
    sectionId: "core",
    label: "Incident location",
    inputKind: "text",
    required: true,
    layout: "full",
  },
  {
    id: "initial_dispatch_code",
    sectionId: "core",
    label: "Initial dispatch code (incident code)",
    inputKind: "text",
    layout: "half",
  },
  {
    id: "dispatch_determinate_code",
    sectionId: "core",
    label: "Determinate dispatch code",
    inputKind: "text",
    layout: "half",
  },
  {
    id: "dispatch_final_disposition",
    sectionId: "core",
    label: "Final disposition",
    inputKind: "text",
    layout: "half",
  },
  {
    id: "dispatch_automatic_alarm",
    sectionId: "core",
    label: "Automatic alarm",
    inputKind: "select",
    optionsKey: "yes_no",
    layout: "half",
  },
  {
    id: "dispatch_time_call_create",
    sectionId: "core",
    label: "Time call created",
    inputKind: "datetime",
    required: true,
    layout: "half",
  },
  {
    id: "dispatch_time_call_answering",
    sectionId: "core",
    label: "Time call answering",
    inputKind: "datetime",
    required: true,
    layout: "half",
  },
  {
    id: "dispatch_time_call_arrival",
    sectionId: "core",
    label: "Time call arrival",
    inputKind: "datetime",
    required: true,
    layout: "half",
  },
  {
    id: "time_incident_clear",
    sectionId: "core",
    label: "Time incident clear",
    inputKind: "datetime",
    layout: "half",
  },
  {
    id: "incident_displaced_number",
    sectionId: "core",
    label: "Displaced number",
    inputKind: "text",
    required: true,
    layout: "half",
  },
  {
    id: "incident_displaced_cause",
    sectionId: "core",
    label: "Displacement cause",
    inputKind: "text",
    layout: "half",
  },
  {
    id: "dispatch_comment",
    sectionId: "core",
    label: "Dispatch comments",
    inputKind: "textarea",
    rows: 4,
    maxLength: 100000,
    layout: "full",
  },
  {
    id: "incident_aid_direction",
    sectionId: "core",
    label: "Aid direction",
    inputKind: "select",
    optionsKey: "aid_direction",
    layout: "half",
  },
  {
    id: "incident_aid_type",
    sectionId: "core",
    label: "Aid type",
    inputKind: "select",
    optionsKey: "aid_type",
    layout: "half",
  },
  {
    id: "incident_aid_department_name",
    sectionId: "core",
    label: "Aid department name(s)",
    inputKind: "text",
    placeholder: "Comma-separated department names",
    layout: "full",
  },
  {
    id: "incident_aid_nonfd",
    sectionId: "core",
    label: "Aid non-FD type(s)",
    inputKind: "multiselect",
    optionsKey: "aid_nonfd",
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
  if (rule.operator === "isEmpty") {
    return value.length === 0;
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
      if (field.inputKind === "multiselect") {
        const invalidSelections = value
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
          .filter((entry) => !allowedValues.has(entry));
        if (invalidSelections.length) {
          errors[field.id] = `${field.label} contains one or more invalid selections.`;
        }
      } else if (!allowedValues.has(value)) {
        errors[field.id] = `${field.label} must use an allowed value.`;
      }
    }
  }

  if (sectionId === "core") {
    const actions = (values.incident_actions_taken ?? "").trim();
    const noAction = (values.incident_noaction ?? "").trim();
    if (actions && noAction) {
      errors.incident_actions_taken =
        "Use either Actions taken or No action reason, not both.";
      errors.incident_noaction =
        "Use either No action reason or Actions taken, not both.";
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

function toDateTimeLocal(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const timeMatch = value.match(/^(\d{2}:\d{2}:\d{2})$/);
  if (timeMatch) {
    return `2026-02-18T${timeMatch[1]}`;
  }
  return fallback;
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
  address,
}: CreateNerisDefaultsInput): NerisFormValues {
  const incidentTypeValues = new Set<string>(
    NERIS_VALUE_SETS.incident_type.map((option) => option.value),
  );
  const mappedIncidentType = mapIncidentSummaryToNerisType(incidentType);
  const safeIncidentType = incidentTypeValues.has(mappedIncidentType)
    ? mappedIncidentType
    : "MEDICAL: ILLNESS: SICK_CASE";
  const dispatchDateTime = toDateTimeLocal(receivedAt, "2026-02-18T15:30:13");

  return {
    incident_neris_id: `NERIS-${callNumber.replace(/[^A-Z0-9]/gi, "")}`,
    incident_internal_id: callNumber,
    incident_onset_date: "2026-02-18",
    incident_onset_time: normalizeNerisTime(receivedAt),
    dispatch_internal_id: callNumber.replace(/^D-/, ""),
    primary_incident_type: safeIncidentType,
    additional_incident_types: "",
    special_incident_modifiers: "",
    incident_actions_taken: "",
    incident_noaction: "",
    fd_neris_id: "FD-00000001",
    dispatch_center_id: "0000",
    dispatch_location_address: address ?? "",
    incident_location_address: address ?? "",
    initial_dispatch_code: "AMB.UNRESP-BREATHING",
    dispatch_determinate_code: "",
    dispatch_final_disposition: "",
    dispatch_automatic_alarm: "NO",
    dispatch_time_call_create: dispatchDateTime,
    dispatch_time_call_answering: dispatchDateTime,
    dispatch_time_call_arrival: dispatchDateTime,
    time_incident_clear: "",
    incident_displaced_number: "0",
    incident_displaced_cause: "",
    dispatch_comment: "",
    incident_aid_direction: "",
    incident_aid_type: "",
    incident_aid_department_name: "",
    incident_aid_nonfd: "",
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
