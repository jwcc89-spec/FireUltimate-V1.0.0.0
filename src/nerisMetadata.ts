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

export const NERIS_VALUE_SETS = {
  report_status: [
    { value: "Draft", label: "Draft" },
    { value: "In Review", label: "In Review" },
    { value: "Ready for Review", label: "Ready for Review" },
    { value: "Approved", label: "Approved" },
    { value: "Submitted", label: "Submitted" },
  ],
  incident_type: [
    { value: "Medical Assist", label: "Medical Assist" },
    { value: "Structure Fire", label: "Structure Fire" },
    { value: "Vehicle Fire", label: "Vehicle Fire" },
    { value: "Alarm Activation", label: "Alarm Activation" },
    { value: "Smoke Investigation", label: "Smoke Investigation" },
    { value: "Other", label: "Other" },
  ],
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
      value: "Other",
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

export function createDefaultNerisFormValues({
  callNumber,
  incidentType,
  receivedAt,
}: CreateNerisDefaultsInput): NerisFormValues {
  const incidentTypeValues = new Set<string>(
    NERIS_VALUE_SETS.incident_type.map((option) => option.value),
  );
  const safeIncidentType = incidentTypeValues.has(incidentType ?? "")
    ? (incidentType ?? "Medical Assist")
    : "Medical Assist";

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
