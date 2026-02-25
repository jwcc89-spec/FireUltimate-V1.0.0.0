import {
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Palette,
  Pencil,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import {
  ALL_SUBMENU_PATHS,
  DASHBOARD_ALERTS,
  DASHBOARD_PRIORITY_LINKS,
  DASHBOARD_STATS,
  DEFAULT_DISPATCH_WORKFLOW_STATES,
  DEFAULT_INCIDENT_CALL_FIELD_ORDER,
  DISPATCH_PARSING_PREVIEW,
  HYDRANT_ADMIN_TABLE_ROWS,
  INCIDENT_CALLS,
  INCIDENT_CALL_FIELD_OPTIONS,
  INCIDENT_QUEUE_STATS,
  MAIN_MENUS,
  SUBMENU_PLACEHOLDER_NOTES,
  getDefaultPathForRole,
  getDisplayCardOptions,
  getIncidentCallDetail,
  getMainMenuById,
  getMainMenuByPath,
  getSubmenuByPath,
  getSubmenuForPath,
  getVisibleMenus,
  isPathAdminOnly,
  type DisplayCardOption,
  type IncidentCallFieldId,
  type IncidentDisplaySettings,
  type IncidentStatId,
  type MainMenu,
  type MainMenuId,
  type NavSubmenu,
  type Tone,
  type UserRole,
} from "./appData";
import {
  NERIS_FORM_SECTIONS,
  createDefaultNerisFormValues,
  getNerisFieldsForSection,
  getNerisValueOptions,
  isNerisFieldRequired,
  validateNerisSection,
  type NerisFieldMetadata,
  type NerisFormValues,
  type NerisSectionId,
  type NerisValueOption,
} from "./nerisMetadata";

interface SessionState {
  isAuthenticated: boolean;
  username: string;
  unit: string;
  role: UserRole;
}

interface AuthPageProps {
  onLogin: (username: string, unit: string, role: UserRole) => void;
}

interface ShellLayoutProps {
  session: SessionState;
  onLogout: () => void;
}

interface DashboardPageProps {
  role: UserRole;
  submenuVisibility: SubmenuVisibilityMap;
}

interface RouteResolverProps {
  role: UserRole;
  username: string;
  workflowStates: string[];
  onSaveWorkflowStates: (nextStates: string[]) => void;
  incidentDisplaySettings: IncidentDisplaySettings;
  onSaveIncidentDisplaySettings: (nextSettings: IncidentDisplaySettings) => void;
  submenuVisibility: SubmenuVisibilityMap;
  onSaveSubmenuVisibility: (nextVisibility: SubmenuVisibilityMap) => void;
  nerisExportSettings: NerisExportSettings;
  onSaveNerisExportSettings: (nextSettings: NerisExportSettings) => void;
}

interface MainMenuLandingPageProps {
  menu: MainMenu;
  role: UserRole;
  submenuVisibility: SubmenuVisibilityMap;
}

interface SubmenuPlaceholderPageProps {
  submenu: NavSubmenu;
}

interface IncidentsListPageProps {
  incidentDisplaySettings: IncidentDisplaySettings;
  onSaveIncidentDisplaySettings: (nextSettings: IncidentDisplaySettings) => void;
}

interface NerisReportFormPageProps {
  callNumber: string;
  role: UserRole;
  username: string;
  nerisExportSettings: NerisExportSettings;
}

interface IncidentCallDetailPageProps {
  callNumber: string;
}

interface MenuDisplayCardsProps {
  menu: MainMenu;
  role: UserRole;
  submenuVisibility: SubmenuVisibilityMap;
}

interface CustomizationPageProps {
  workflowStates: string[];
  onSaveWorkflowStates: (nextStates: string[]) => void;
  incidentDisplaySettings: IncidentDisplaySettings;
  onSaveIncidentDisplaySettings: (nextSettings: IncidentDisplaySettings) => void;
  submenuVisibility: SubmenuVisibilityMap;
  onSaveSubmenuVisibility: (nextVisibility: SubmenuVisibilityMap) => void;
  nerisExportSettings: NerisExportSettings;
  onSaveNerisExportSettings: (nextSettings: NerisExportSettings) => void;
}

interface CustomizationSectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
}

type DisplayCardConfig = Partial<Record<MainMenuId, string[]>>;
type SubmenuVisibilityMap = Record<string, boolean>;

interface NerisDraftAidEntry {
  aidDirection: string;
  aidType: string;
  aidDepartment: string;
}

interface NerisStoredDraft {
  formValues: NerisFormValues;
  reportStatus: string;
  lastSavedAt: string;
  additionalAidEntries: NerisDraftAidEntry[];
}

interface NerisExportSettings {
  exportUrl: string;
  vendorCode: string;
  vendorHeaderName: string;
  secretKey: string;
  authHeaderName: string;
  authScheme: string;
  contentType: string;
  apiVersionHeaderName: string;
  apiVersionHeaderValue: string;
}

interface NerisExportRecord {
  id: string;
  callNumber: string;
  incidentType: string;
  address: string;
  exportedAtIso: string;
  exportedAtLabel: string;
  attemptStatus: "success" | "failed";
  httpStatus: number;
  httpStatusText: string;
  statusLabel: string;
  reportStatusAtExport: string;
  validatorName: string;
  reportWriterName: string;
  submittedEntityId: string;
  submittedDepartmentNerisId: string;
  nerisId: string;
  responseSummary: string;
  responseDetail: string;
  submittedPayloadPreview: string;
}

type DepartmentCollectionKey =
  | "stations"
  | "apparatus"
  | "shiftInformation"
  | "personnel"
  | "personnelQualifications"
  | "mutualAidDepartments"
  | "userType";

type ShiftRecurrencePreset =
  | "Daily"
  | "Every other Day"
  | "Every 2 days"
  | "Every 3 days"
  | "Custom";

interface ShiftInformationEntry {
  shiftType: string;
  shiftDuration: number;
  recurrence: ShiftRecurrencePreset;
  recurrenceCustomValue: string;
  location: string;
}

interface DepartmentPersonnelRecord {
  name: string;
  shift: string;
  apparatusAssignment: string;
  station: string;
  userType: string;
  /** DD-M: credentials/qualifications from personnelQualifications list */
  qualifications: string[];
}

interface DepartmentStationRecord {
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  mobilePhone: string;
}

interface DepartmentApparatusRecord {
  unitId: string;
  unitType: string;
  minimumPersonnel: number;
  personnelRequirements: string[];
  station: string;
}

interface DepartmentNerisEntityOption {
  id: string;
  name: string;
}

interface DepartmentCollectionDefinition {
  key: DepartmentCollectionKey;
  label: string;
  editButtonLabel: string;
  helperText: string;
}

const SESSION_STORAGE_KEY = "fire-ultimate-session";
const DISPLAY_CARD_STORAGE_KEY = "fire-ultimate-display-cards";
const WORKFLOW_STATE_STORAGE_KEY = "fire-ultimate-workflow-states";
const INCIDENT_DISPLAY_STORAGE_KEY = "fire-ultimate-incident-display";
const SUBMENU_VISIBILITY_STORAGE_KEY = "fire-ultimate-submenu-visibility";
const SHELL_SIDEBAR_WIDTH_STORAGE_KEY = "fire-ultimate-shell-sidebar-width";
const NERIS_DRAFT_STORAGE_KEY = "fire-ultimate-neris-drafts";
const NERIS_EXPORT_SETTINGS_STORAGE_KEY = "fire-ultimate-neris-export-settings";
const NERIS_EXPORT_HISTORY_STORAGE_KEY = "fire-ultimate-neris-export-history";
const DEPARTMENT_LOGO_DATA_URL_STORAGE_KEY = "fire-ultimate-department-logo-data-url";
const DEPARTMENT_DETAILS_STORAGE_KEY = "fire-ultimate-department-details";

const LEGACY_SESSION_STORAGE_KEYS = ["stationboss-mimic-session"] as const;
const LEGACY_DISPLAY_CARD_STORAGE_KEYS = ["stationboss-mimic-display-cards"] as const;
const LEGACY_WORKFLOW_STATE_STORAGE_KEYS = ["stationboss-mimic-workflow-states"] as const;
const LEGACY_INCIDENT_DISPLAY_STORAGE_KEYS = ["stationboss-mimic-incident-display"] as const;
const LEGACY_SUBMENU_VISIBILITY_STORAGE_KEYS = [
  "stationboss-mimic-submenu-visibility",
] as const;
const LEGACY_SHELL_SIDEBAR_WIDTH_STORAGE_KEYS = [
  "stationboss-mimic-shell-sidebar-width",
] as const;
const LEGACY_NERIS_DRAFT_STORAGE_KEYS = [
  "stationboss-mimic-neris-drafts",
] as const;
const LEGACY_NERIS_EXPORT_SETTINGS_STORAGE_KEYS = [
  "stationboss-mimic-neris-export-settings",
] as const;
const LEGACY_NERIS_EXPORT_HISTORY_STORAGE_KEYS = [
  "stationboss-mimic-neris-export-history",
] as const;

function readStorageWithMigration(
  storageKey: string,
  legacyKeys: readonly string[],
): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const currentValue = window.localStorage.getItem(storageKey);
  if (currentValue !== null) {
    for (const legacyKey of legacyKeys) {
      window.localStorage.removeItem(legacyKey);
    }
    return currentValue;
  }

  for (const legacyKey of legacyKeys) {
    const legacyValue = window.localStorage.getItem(legacyKey);
    if (legacyValue !== null) {
      window.localStorage.setItem(storageKey, legacyValue);
      window.localStorage.removeItem(legacyKey);
      return legacyValue;
    }
  }

  return null;
}

function writeStorageValue(
  storageKey: string,
  legacyKeys: readonly string[],
  value: string,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, value);
  for (const legacyKey of legacyKeys) {
    window.localStorage.removeItem(legacyKey);
  }
}

function clearStorageValue(storageKey: string, legacyKeys: readonly string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey);
  for (const legacyKey of legacyKeys) {
    window.localStorage.removeItem(legacyKey);
  }
}

const EMPTY_SESSION: SessionState = {
  isAuthenticated: false,
  username: "",
  unit: "",
  role: "user",
};

const VALID_STAT_IDS = new Set<IncidentStatId>(
  INCIDENT_QUEUE_STATS.map((stat) => stat.id),
);
const VALID_CALL_FIELD_IDS = new Set<IncidentCallFieldId>(
  INCIDENT_CALL_FIELD_OPTIONS.map((field) => field.id),
);
const MIN_CALL_FIELD_WIDTH = 100;
const MAX_CALL_FIELD_WIDTH = 560;
const DEFAULT_SHELL_SIDEBAR_WIDTH = 316;
const MIN_SHELL_SIDEBAR_WIDTH = 220;
const MAX_SHELL_SIDEBAR_WIDTH = 520;
const DEFAULT_CALL_FIELD_WIDTHS: Record<IncidentCallFieldId, number> = {
  incidentType: 180,
  priority: 120,
  address: 360,
  assignedUnits: 230,
  status: 130,
  lastUpdated: 140,
};
const NERIS_QUEUE_FIELD_ORDER: IncidentCallFieldId[] = [...DEFAULT_INCIDENT_CALL_FIELD_ORDER];
type ApparatusGridFieldId = "unitType" | "minPersonnel" | "personnelRequirements" | "station";
const APPARATUS_GRID_FIELD_ORDER: ApparatusGridFieldId[] = [
  "unitType",
  "minPersonnel",
  "personnelRequirements",
  "station",
];
const MIN_APPARATUS_FIELD_WIDTH = 70;
const MAX_APPARATUS_FIELD_WIDTH = 320;
const DEFAULT_APPARATUS_FIELD_WIDTHS: Record<ApparatusGridFieldId, number> = {
  unitType: 120,
  minPersonnel: 90,
  personnelRequirements: 160,
  station: 110,
};
const DEPARTMENT_COLLECTION_DEFINITIONS: DepartmentCollectionDefinition[] = [
  {
    key: "stations",
    label: "Stations",
    editButtonLabel: "Edit Stations",
    helperText: "",
  },
  {
    key: "apparatus",
    label: "Apparatus",
    editButtonLabel: "Edit Apparatus",
    helperText: "",
  },
  {
    key: "shiftInformation",
    label: "Shift Information",
    editButtonLabel: "Edit Shift Information",
    helperText: "",
  },
  {
    key: "personnel",
    label: "Personnel",
    editButtonLabel: "Edit Personnel",
    helperText: "",
  },
  {
    key: "personnelQualifications",
    label: "Personnel Qualifications",
    editButtonLabel: "Edit Personnel Qualifications",
    helperText: "",
  },
  {
    key: "mutualAidDepartments",
    label: "Mutual Aid Departments",
    editButtonLabel: "Edit Mutual Aid Departments",
    helperText: "",
  },
  {
    key: "userType",
    label: "User Type",
    editButtonLabel: "Edit User Type",
    helperText: "",
  },
];
const SHIFT_RECURRENCE_PRESET_OPTIONS: ShiftRecurrencePreset[] = [
  "Daily",
  "Every other Day",
  "Every 2 days",
  "Every 3 days",
  "Custom",
];
const DEFAULT_USER_TYPE_VALUES = ["Admin", "Sub Admin", "Secretary", "User"];
const GMT_TIMEZONE_OPTIONS = [
  "GMT-05:00 Eastern",
  "GMT-06:00 Central",
  "GMT-07:00 Mountain",
  "GMT-08:00 Pacific",
] as const;
const DEPARTMENT_ENTITY_FALLBACK_OPTIONS: DepartmentNerisEntityOption[] = [
  { id: "FD00001001", name: "Fallback Fire Department 1" },
  { id: "FD00001002", name: "Fallback Fire Department 2" },
  { id: "FD00001003", name: "Fallback Fire Department 3" },
];

function readDepartmentDetailsDraft(): Record<string, unknown> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(DEPARTMENT_DETAILS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeDepartmentDraft(raw: Record<string, unknown>): Record<string, unknown> {
  const d = raw && typeof raw === "object" ? raw : {};
  const personnelRaw = d.personnelRecords;
  const personnelRecords = Array.isArray(personnelRaw)
    ? personnelRaw.map((entry: Record<string, unknown>) => ({
        name: String(entry?.name ?? ""),
        shift: String(entry?.shift ?? ""),
        apparatusAssignment: String(entry?.apparatusAssignment ?? ""),
        station: String(entry?.station ?? ""),
        userType: String(entry?.userType ?? ""),
        qualifications: Array.isArray(entry?.qualifications)
          ? (entry.qualifications as string[]).filter((q): q is string => typeof q === "string")
          : [],
      }))
    : [];
  return { ...d, personnelRecords };
}
const NERIS_REPORT_STATUS_BY_CALL: Record<string, string> = {
  "D-260218-101": "In Review",
  "D-260218-099": "Draft",
  "D-260218-094": "Ready for Review",
  "D-260218-089": "Draft",
  "D-260218-082": "Approved",
};
const SCHEDULE_STAFFING_BY_UNIT_ID: Record<string, string> = {};
const RESOURCE_PERSONNEL_OPTIONS: NerisValueOption[] = [
  { value: "ALEX_JOHNSON", label: "Alex Johnson" },
  { value: "BROOKE_MILLER", label: "Brooke Miller" },
  { value: "CAMERON_DIAZ", label: "Cameron Diaz" },
  { value: "DANIEL_REED", label: "Daniel Reed" },
  { value: "EMERY_PARK", label: "Emery Park" },
  { value: "FRANKIE_MOORE", label: "Frankie Moore" },
  { value: "GRAYSON_LEE", label: "Grayson Lee" },
  { value: "HARPER_YOUNG", label: "Harper Young" },
];
const RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS: NerisValueOption[] = [
  { value: "YES", label: "Yes" },
  { value: "NO", label: "No" },
  { value: "UNKNOWN", label: "Unknown" },
];
const RISK_REDUCTION_YES_NO_OPTIONS: NerisValueOption[] = [
  { value: "YES", label: "Yes" },
  { value: "NO", label: "No" },
];
const RISK_REDUCTION_SMOKE_ALARM_TYPE_OPTIONS: NerisValueOption[] = [
  { value: "BED_SHAKER", label: "Bed Shaker" },
  { value: "COMBINATION_SMOKE_CO", label: "Combination (smoke / CO)" },
  { value: "HARD_OF_HEARING_STROBE", label: "Hard of hearing with strobe" },
  { value: "HARDWIRED", label: "Hardwired" },
  { value: "INTERCONNECTED", label: "Interconnected" },
  { value: "LONG_LIFE_BATTERY_POWERED", label: "Long Life Battery Powered" },
  { value: "REPLACEABLE_BATTERY_POWERED", label: "Replaceable Battery Powered" },
  { value: "UNKNOWN", label: "Unknown" },
];
const RISK_REDUCTION_FIRE_ALARM_TYPE_OPTIONS: NerisValueOption[] = [
  { value: "AUTOMATIC", label: "Automatic" },
  { value: "MANUAL", label: "Manual" },
  { value: "MANUAL_AND_AUTOMATIC", label: "Manual and Automatic" },
];
const RISK_REDUCTION_OTHER_ALARM_TYPE_OPTIONS: NerisValueOption[] = [
  { value: "CARBON_MONOXIDE", label: "Carbon Monoxide" },
  { value: "HEAT_DETECTOR", label: "Heat Detector" },
  { value: "NATURAL_GAS", label: "Natural Gas" },
  { value: "OTHER_CHEMICAL_DETECTOR", label: "Other Chemical Detector" },
];
const RISK_REDUCTION_COOKING_SUPPRESSION_TYPE_OPTIONS: NerisValueOption[] = [
  { value: "COMMERCIAL_HOOD_SUPPRESSION", label: "Commercial Hood Suppression" },
  { value: "ELECTRIC_POWER_CUTOFF_DEVICE", label: "Electric Power Cutoff Device" },
  {
    value: "RESIDENTIAL_HOOD_MOUNTED_SUPPRESSION_DEVICE",
    label: "Residential Hood Mounted Suppression Device",
  },
  { value: "TEMPERATURE_LIMITING_STOVE_BURNER", label: "Temperature limiting Stove Burner" },
  { value: "OTHER", label: "Other" },
];
const RISK_REDUCTION_SUPPRESSION_COVERAGE_OPTIONS: NerisValueOption[] = [
  { value: "FULL", label: "Full" },
  { value: "PARTIAL", label: "Partial" },
  { value: "UNKNOWN", label: "Unknown" },
];
const NERIS_INCIDENT_ID_PATTERN = /^FD\d{8}\|[\w\-:]+\|\d{10}$/;

function normalizePath(pathname: string): string {
  if (pathname === "/") {
    return pathname;
  }
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function toToneClass(tone: Tone): string {
  return `tone tone-${tone}`;
}

function toneFromState(state: string): Tone {
  const normalized = state.trim().toLowerCase();
  if (normalized.includes("clear")) {
    return "positive";
  }
  if (normalized.includes("transport")) {
    return "neutral";
  }
  if (normalized.includes("scene")) {
    return "warning";
  }
  if (normalized.includes("enroute") || normalized.includes("dispatched")) {
    return "warning";
  }
  return "neutral";
}

function toneFromNerisStatus(status: string): Tone {
  const normalized = status.trim().toLowerCase();
  if (
    normalized.includes("submitted") ||
    normalized.includes("ready") ||
    normalized.includes("approved")
  ) {
    return "positive";
  }
  if (normalized.includes("review")) {
    return "warning";
  }
  if (normalized.includes("draft") || normalized.includes("missing")) {
    return "critical";
  }
  return "neutral";
}

function normalizeNerisEnumValue(raw: string): string {
  if (raw.includes("||")) {
    return raw;
  }
  return raw
    .split(":")
    .map((segment) => segment.trim())
    .join("||");
}

function formatNerisEnumSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

interface ParsedImportedLocationValues {
  locationState: string;
  locationCountry: string;
  locationPostalCode: string;
  locationCounty: string;
}

interface ResourceUnitEntry {
  id: string;
  unitId: string;
  unitType: string;
  staffing: string;
  responseMode: string;
  dispatchTime: string;
  enrouteTime: string;
  onSceneTime: string;
  clearTime: string;
  isCanceledEnroute: boolean;
  isComplete: boolean;
  isExpanded: boolean;
  showTimesEditor: boolean;
  personnel: string;
  showPersonnelSelector: boolean;
  reportWriter: string;
  unitNarrative: string;
}

interface EmergingElectrocutionItem {
  id: string;
  electricalHazardType: string;
  suppressionMethods: string;
}

interface EmergingPowerGenerationItem {
  id: string;
  photovoltaicHazardType: string;
  pvSourceTarget: string;
  suppressionMethods: string;
}

interface FireSuppressionSystemEntry {
  id: string;
  suppressionType: string;
  suppressionCoverage: string;
}

function parseImportedLocationValues(
  address: string,
  stateOptionValues: Set<string>,
  countryOptionValues: Set<string>,
): ParsedImportedLocationValues {
  const trimmedAddress = address.trim();
  if (!trimmedAddress || trimmedAddress === "No imported address available.") {
    return {
      locationState: "",
      locationCountry: countryOptionValues.has("US") ? "US" : "",
      locationPostalCode: "",
      locationCounty: "",
    };
  }

  const segments = trimmedAddress
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const postalMatch = trimmedAddress.match(/\b\d{5}(?:-\d{4})?\b/);
  const locationPostalCode = postalMatch?.[0] ?? "";
  const stateCandidates = Array.from(trimmedAddress.toUpperCase().matchAll(/\b[A-Z]{2}\b/g))
    .map((match) => match[0] ?? "")
    .filter((candidate) => candidate.length > 0);
  const locationState =
    [...stateCandidates].reverse().find((candidate) => stateOptionValues.has(candidate)) ?? "";

  let locationCountry = countryOptionValues.has("US") ? "US" : "";
  const lastSegment = segments[segments.length - 1]?.toUpperCase() ?? "";
  if (lastSegment === "USA" || lastSegment === "UNITED STATES") {
    locationCountry = countryOptionValues.has("US") ? "US" : "";
  } else {
    const countryCandidates = Array.from(lastSegment.matchAll(/\b[A-Z]{2}\b/g))
      .map((match) => match[0] ?? "")
      .filter((candidate) => candidate.length > 0);
    const matchedCountry = countryCandidates.find((candidate) =>
      countryOptionValues.has(candidate),
    );
    if (matchedCountry) {
      locationCountry = matchedCountry;
    }
  }

  let locationCounty = segments.find((segment) => /county/i.test(segment)) ?? "";
  if (!locationCounty && segments.length >= 2) {
    locationCounty = segments[1] ?? "";
  }
  locationCounty = locationCounty
    .replace(/\b\d{5}(?:-\d{4})?\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    locationState,
    locationCountry,
    locationPostalCode,
    locationCounty,
  };
}

function parseAssignedUnits(value: string): string[] {
  return value
    .split(",")
    .map((unit) => unit.trim())
    .filter((unit) => unit.length > 0);
}

function inferResourceUnitTypeValue(
  unitId: string,
  sourceUnitType: string | undefined,
  unitTypeOptions: NerisValueOption[],
): string {
  const optionValues = new Set(unitTypeOptions.map((option) => option.value));
  const normalizedSourceType = sourceUnitType?.trim().toLowerCase() ?? "";
  const normalizedUnitId = unitId.trim().toLowerCase();
  const preferred: string[] = [];

  if (normalizedSourceType.includes("engine")) {
    preferred.push("ENGINE_STRUCT");
  }
  if (
    normalizedSourceType.includes("ladder") ||
    normalizedSourceType.includes("truck")
  ) {
    preferred.push("TRUCK");
  }
  if (normalizedSourceType.includes("rescue")) {
    preferred.push("RESCUE");
  }
  if (
    normalizedSourceType.includes("medic") ||
    normalizedSourceType.includes("ambulance")
  ) {
    preferred.push("ALS_AMB");
  }
  if (normalizedSourceType.includes("chief") || normalizedSourceType.includes("command")) {
    preferred.push("CHIEF_STAFF_COMMAND");
  }

  if (normalizedUnitId.startsWith("engine ") || normalizedUnitId.startsWith("e")) {
    preferred.push("ENGINE_STRUCT");
  }
  if (normalizedUnitId.startsWith("ladder ") || normalizedUnitId.startsWith("truck ")) {
    preferred.push("TRUCK");
  }
  if (normalizedUnitId.startsWith("rescue ") || normalizedUnitId.startsWith("r")) {
    preferred.push("RESCUE");
  }
  if (normalizedUnitId.startsWith("medic ") || normalizedUnitId.startsWith("m")) {
    preferred.push("ALS_AMB");
  }
  if (normalizedUnitId.startsWith("chief ")) {
    preferred.push("CHIEF_STAFF_COMMAND");
  }

  const matchedPreferred = preferred.find((value) => optionValues.has(value));
  if (matchedPreferred) {
    return matchedPreferred;
  }

  const normalizedSourceToken = normalizedSourceType.replace(/\s+/g, "_").toUpperCase();
  if (normalizedSourceToken && optionValues.has(normalizedSourceToken)) {
    return normalizedSourceToken;
  }

  return "";
}

function toResourceSummaryTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "--";
  }
  const normalized = trimmed.replace(" ", "T");
  const datetimeMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/,
  );
  if (datetimeMatch) {
    const [, , month, day, time, seconds] = datetimeMatch;
    return `${month}/${day} ${time}:${seconds ?? "00"}`;
  }
  const timeOnlyMatch = trimmed.match(/^(\d{2}:\d{2})(?::(\d{2}))?$/);
  if (timeOnlyMatch) {
    const [, time, seconds] = timeOnlyMatch;
    return `${time ?? "--"}:${seconds ?? "00"}`;
  }
  return trimmed;
}

function toResourceDateTimeInputValue(value: string, fallbackDate: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replace(" ", "T");
  const datetimeMatch = normalized.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/,
  );
  if (datetimeMatch) {
    return `${datetimeMatch[1]}T${datetimeMatch[2]}:${datetimeMatch[3] ?? "00"}`;
  }
  const timeOnlyMatch = trimmed.match(/^(\d{2}:\d{2})(?::(\d{2}))?$/);
  if (timeOnlyMatch && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)) {
    return `${fallbackDate}T${timeOnlyMatch[1]}:${timeOnlyMatch[2] ?? "00"}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) {
    return "";
  }
  const year = String(parsed.getFullYear());
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  const seconds = String(parsed.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function toResourceDateTimeTimestamp(value: string, fallbackDate: string): number | null {
  const normalized = toResourceDateTimeInputValue(value, fallbackDate);
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return parsed.valueOf();
}

function addMinutesToResourceDateTime(value: string, minutesToAdd: number): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return "";
  }
  parsed.setMinutes(parsed.getMinutes() + minutesToAdd);
  const year = String(parsed.getFullYear());
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  const seconds = String(parsed.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function resourceUnitValidationErrorKey(
  unitEntryId: string,
  field: "personnel" | "dispatchTime" | "enrouteTime" | "onSceneTime" | "clearTime",
): string {
  return `resource_unit_validation_${unitEntryId}_${field}`;
}

function togglePillValue(currentValue: string, nextValue: string): string {
  return currentValue === nextValue ? "" : nextValue;
}

function countSelectedPersonnel(personnelCsv: string): number {
  return personnelCsv
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0).length;
}

function getStaffingValueForUnit(unitId: string, personnelCsv: string): string {
  const scheduledStaffing = SCHEDULE_STAFFING_BY_UNIT_ID[unitId]?.trim() ?? "";
  if (scheduledStaffing.length > 0) {
    return scheduledStaffing;
  }
  const selectedPersonnelCount = countSelectedPersonnel(personnelCsv);
  return selectedPersonnelCount > 0 ? String(selectedPersonnelCount) : "";
}

let emergingHazardItemCounter = 0;
let riskReductionSuppressionCounter = 0;

function nextEmergingHazardItemId(prefix: string): string {
  emergingHazardItemCounter += 1;
  return `${prefix}-${emergingHazardItemCounter}`;
}

function nextRiskReductionSuppressionId(): string {
  riskReductionSuppressionCounter += 1;
  return `risk-suppression-${riskReductionSuppressionCounter}`;
}

function dedupeAndCleanStrings(values: string[]): string[] {
  const cleaned = values.map((value) => value.trim()).filter((value) => value.length > 0);
  return Array.from(new Set(cleaned));
}

function dedupeCallFieldOrder(values: IncidentCallFieldId[]): IncidentCallFieldId[] {
  const seen = new Set<IncidentCallFieldId>();
  const order: IncidentCallFieldId[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      order.push(value);
    }
  }
  return order;
}

function dedupeIncidentStatIds(values: IncidentStatId[]): IncidentStatId[] {
  const seen = new Set<IncidentStatId>();
  const ids: IncidentStatId[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      ids.push(value);
    }
  }
  return ids;
}

function getDefaultSubmenuVisibilityMap(): SubmenuVisibilityMap {
  return Object.fromEntries(ALL_SUBMENU_PATHS.map((path) => [path, true]));
}

function getDefaultIncidentDisplaySettings(): IncidentDisplaySettings {
  return {
    hiddenStatIds: [],
    callFieldOrder: [...DEFAULT_INCIDENT_CALL_FIELD_ORDER],
  };
}

function normalizeIncidentDisplaySettings(
  settings: Partial<IncidentDisplaySettings> | null | undefined,
): IncidentDisplaySettings {
  const defaultSettings = getDefaultIncidentDisplaySettings();
  if (!settings) {
    return defaultSettings;
  }

  const hiddenStatIds = Array.isArray(settings.hiddenStatIds)
    ? (settings.hiddenStatIds.filter((id) => VALID_STAT_IDS.has(id)) as IncidentStatId[])
    : [];
  const callFieldOrder = Array.isArray(settings.callFieldOrder)
    ? dedupeCallFieldOrder(
        settings.callFieldOrder.filter((id) => VALID_CALL_FIELD_IDS.has(id)) as IncidentCallFieldId[],
      )
    : [...defaultSettings.callFieldOrder];

  return {
    hiddenStatIds: dedupeIncidentStatIds(hiddenStatIds),
    callFieldOrder: callFieldOrder.length
      ? callFieldOrder
      : [...defaultSettings.callFieldOrder],
  };
}

function getDefaultNerisExportSettings(): NerisExportSettings {
  return {
    exportUrl: "/api/neris/export",
    vendorCode: "",
    vendorHeaderName: "X-NERIS-Entity-ID",
    secretKey: "",
    authHeaderName: "Authorization",
    authScheme: "Bearer",
    contentType: "application/json",
    apiVersionHeaderName: "",
    apiVersionHeaderValue: "",
  };
}

function normalizeNerisExportSettings(
  settings: Partial<NerisExportSettings> | null | undefined,
): NerisExportSettings {
  const defaults = getDefaultNerisExportSettings();
  if (!settings) {
    return defaults;
  }
  return {
    exportUrl: typeof settings.exportUrl === "string" ? settings.exportUrl : defaults.exportUrl,
    vendorCode:
      typeof settings.vendorCode === "string" ? settings.vendorCode : defaults.vendorCode,
    vendorHeaderName:
      typeof settings.vendorHeaderName === "string"
        ? settings.vendorHeaderName
        : defaults.vendorHeaderName,
    secretKey: typeof settings.secretKey === "string" ? settings.secretKey : defaults.secretKey,
    authHeaderName:
      typeof settings.authHeaderName === "string"
        ? settings.authHeaderName
        : defaults.authHeaderName,
    authScheme:
      typeof settings.authScheme === "string" ? settings.authScheme : defaults.authScheme,
    contentType:
      typeof settings.contentType === "string" ? settings.contentType : defaults.contentType,
    apiVersionHeaderName:
      typeof settings.apiVersionHeaderName === "string"
        ? settings.apiVersionHeaderName
        : defaults.apiVersionHeaderName,
    apiVersionHeaderValue:
      typeof settings.apiVersionHeaderValue === "string"
        ? settings.apiVersionHeaderValue
        : defaults.apiVersionHeaderValue,
  };
}

function readSession(): SessionState {
  if (typeof window === "undefined") {
    return EMPTY_SESSION;
  }

  const rawValue = readStorageWithMigration(
    SESSION_STORAGE_KEY,
    LEGACY_SESSION_STORAGE_KEYS,
  );
  if (!rawValue) {
    return EMPTY_SESSION;
  }

  try {
    const parsed = JSON.parse(rawValue) as SessionState;
    if (
      typeof parsed.isAuthenticated === "boolean" &&
      typeof parsed.username === "string" &&
      typeof parsed.unit === "string" &&
      (parsed.role === "admin" || parsed.role === "user")
    ) {
      return parsed;
    }
  } catch {
    return EMPTY_SESSION;
  }

  return EMPTY_SESSION;
}

function writeSession(session: SessionState): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!session.isAuthenticated) {
    clearStorageValue(SESSION_STORAGE_KEY, LEGACY_SESSION_STORAGE_KEYS);
    return;
  }

  writeStorageValue(
    SESSION_STORAGE_KEY,
    LEGACY_SESSION_STORAGE_KEYS,
    JSON.stringify(session),
  );
}

function readDisplayCardConfig(): DisplayCardConfig {
  if (typeof window === "undefined") {
    return {};
  }

  const rawValue = readStorageWithMigration(
    DISPLAY_CARD_STORAGE_KEY,
    LEGACY_DISPLAY_CARD_STORAGE_KEYS,
  );
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as DisplayCardConfig;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return {};
  }

  return {};
}

function writeDisplayCardConfig(config: DisplayCardConfig): void {
  if (typeof window === "undefined") {
    return;
  }
  writeStorageValue(
    DISPLAY_CARD_STORAGE_KEY,
    LEGACY_DISPLAY_CARD_STORAGE_KEYS,
    JSON.stringify(config),
  );
}

function readWorkflowStates(): string[] {
  if (typeof window === "undefined") {
    return [...DEFAULT_DISPATCH_WORKFLOW_STATES];
  }

  const rawValue = readStorageWithMigration(
    WORKFLOW_STATE_STORAGE_KEY,
    LEGACY_WORKFLOW_STATE_STORAGE_KEYS,
  );
  if (!rawValue) {
    return [...DEFAULT_DISPATCH_WORKFLOW_STATES];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_DISPATCH_WORKFLOW_STATES];
    }
    const cleaned = dedupeAndCleanStrings(
      parsed.filter((item) => typeof item === "string"),
    );
    return cleaned.length ? cleaned : [...DEFAULT_DISPATCH_WORKFLOW_STATES];
  } catch {
    return [...DEFAULT_DISPATCH_WORKFLOW_STATES];
  }
}

function writeWorkflowStates(states: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  writeStorageValue(
    WORKFLOW_STATE_STORAGE_KEY,
    LEGACY_WORKFLOW_STATE_STORAGE_KEYS,
    JSON.stringify(states),
  );
}

function readIncidentDisplaySettings(): IncidentDisplaySettings {
  if (typeof window === "undefined") {
    return getDefaultIncidentDisplaySettings();
  }

  const rawValue = readStorageWithMigration(
    INCIDENT_DISPLAY_STORAGE_KEY,
    LEGACY_INCIDENT_DISPLAY_STORAGE_KEYS,
  );
  if (!rawValue) {
    return getDefaultIncidentDisplaySettings();
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<IncidentDisplaySettings>;
    return normalizeIncidentDisplaySettings(parsed);
  } catch {
    return getDefaultIncidentDisplaySettings();
  }
}

function writeIncidentDisplaySettings(settings: IncidentDisplaySettings): void {
  if (typeof window === "undefined") {
    return;
  }
  writeStorageValue(
    INCIDENT_DISPLAY_STORAGE_KEY,
    LEGACY_INCIDENT_DISPLAY_STORAGE_KEYS,
    JSON.stringify(settings),
  );
}

function readSubmenuVisibility(): SubmenuVisibilityMap {
  const defaults = getDefaultSubmenuVisibilityMap();
  if (typeof window === "undefined") {
    return defaults;
  }

  const rawValue = readStorageWithMigration(
    SUBMENU_VISIBILITY_STORAGE_KEY,
    LEGACY_SUBMENU_VISIBILITY_STORAGE_KEYS,
  );
  if (!rawValue) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return defaults;
    }
    const next = { ...defaults };
    for (const path of ALL_SUBMENU_PATHS) {
      const value = parsed[path];
      if (typeof value === "boolean") {
        next[path] = value;
      }
    }
    return next;
  } catch {
    return defaults;
  }
}

function writeSubmenuVisibility(next: SubmenuVisibilityMap): void {
  if (typeof window === "undefined") {
    return;
  }
  writeStorageValue(
    SUBMENU_VISIBILITY_STORAGE_KEY,
    LEGACY_SUBMENU_VISIBILITY_STORAGE_KEYS,
    JSON.stringify(next),
  );
}

function readNerisExportSettings(): NerisExportSettings {
  const defaults = getDefaultNerisExportSettings();
  if (typeof window === "undefined") {
    return defaults;
  }

  const rawValue = readStorageWithMigration(
    NERIS_EXPORT_SETTINGS_STORAGE_KEY,
    LEGACY_NERIS_EXPORT_SETTINGS_STORAGE_KEYS,
  );
  if (!rawValue) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<NerisExportSettings>;
    return normalizeNerisExportSettings(parsed);
  } catch {
    return defaults;
  }
}

function writeNerisExportSettings(settings: NerisExportSettings): void {
  if (typeof window === "undefined") {
    return;
  }
  writeStorageValue(
    NERIS_EXPORT_SETTINGS_STORAGE_KEY,
    LEGACY_NERIS_EXPORT_SETTINGS_STORAGE_KEYS,
    JSON.stringify(normalizeNerisExportSettings(settings)),
  );
}

function readShellSidebarWidth(): number {
  if (typeof window === "undefined") {
    return DEFAULT_SHELL_SIDEBAR_WIDTH;
  }
  const rawValue = readStorageWithMigration(
    SHELL_SIDEBAR_WIDTH_STORAGE_KEY,
    LEGACY_SHELL_SIDEBAR_WIDTH_STORAGE_KEYS,
  );
  if (!rawValue) {
    return DEFAULT_SHELL_SIDEBAR_WIDTH;
  }
  const parsedWidth = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsedWidth)) {
    return DEFAULT_SHELL_SIDEBAR_WIDTH;
  }
  return Math.min(
    MAX_SHELL_SIDEBAR_WIDTH,
    Math.max(MIN_SHELL_SIDEBAR_WIDTH, parsedWidth),
  );
}

function writeShellSidebarWidth(width: number): void {
  if (typeof window === "undefined") {
    return;
  }
  const clampedWidth = Math.min(
    MAX_SHELL_SIDEBAR_WIDTH,
    Math.max(MIN_SHELL_SIDEBAR_WIDTH, Math.round(width)),
  );
  writeStorageValue(
    SHELL_SIDEBAR_WIDTH_STORAGE_KEY,
    LEGACY_SHELL_SIDEBAR_WIDTH_STORAGE_KEYS,
    String(clampedWidth),
  );
}

function readNerisDraftStore(): Record<string, NerisStoredDraft> {
  if (typeof window === "undefined") {
    return {};
  }
  const rawValue = readStorageWithMigration(
    NERIS_DRAFT_STORAGE_KEY,
    LEGACY_NERIS_DRAFT_STORAGE_KEYS,
  );
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    const drafts: Record<string, NerisStoredDraft> = {};
    for (const [callNumber, candidateValue] of Object.entries(parsed)) {
      if (!candidateValue || typeof candidateValue !== "object") {
        continue;
      }
      const candidate = candidateValue as Record<string, unknown>;
      const formValuesCandidate = candidate.formValues;
      if (!formValuesCandidate || typeof formValuesCandidate !== "object") {
        continue;
      }
      const formValues: NerisFormValues = {};
      for (const [fieldId, fieldValue] of Object.entries(
        formValuesCandidate as Record<string, unknown>,
      )) {
        if (typeof fieldValue === "string") {
          formValues[fieldId] = fieldValue;
        }
      }
      const additionalAidEntries: NerisDraftAidEntry[] = Array.isArray(
        candidate.additionalAidEntries,
      )
        ? candidate.additionalAidEntries.reduce<NerisDraftAidEntry[]>(
            (entriesAccumulator, entryValue) => {
              if (!entryValue || typeof entryValue !== "object") {
                return entriesAccumulator;
              }
              const entry = entryValue as Record<string, unknown>;
              entriesAccumulator.push({
                aidDirection:
                  typeof entry.aidDirection === "string" ? entry.aidDirection : "",
                aidType: typeof entry.aidType === "string" ? entry.aidType : "",
                aidDepartment:
                  typeof entry.aidDepartment === "string" ? entry.aidDepartment : "",
              });
              return entriesAccumulator;
            },
            [],
          )
        : [];
      drafts[callNumber] = {
        formValues,
        reportStatus:
          typeof candidate.reportStatus === "string"
            ? candidate.reportStatus
            : NERIS_REPORT_STATUS_BY_CALL[callNumber] ?? "Draft",
        lastSavedAt:
          typeof candidate.lastSavedAt === "string"
            ? candidate.lastSavedAt
            : "Not saved",
        additionalAidEntries,
      };
    }
    return drafts;
  } catch {
    return {};
  }
}

function writeNerisDraftStore(store: Record<string, NerisStoredDraft>): void {
  if (typeof window === "undefined") {
    return;
  }
  writeStorageValue(
    NERIS_DRAFT_STORAGE_KEY,
    LEGACY_NERIS_DRAFT_STORAGE_KEYS,
    JSON.stringify(store),
  );
}

function readNerisDraft(callNumber: string): NerisStoredDraft | null {
  const store = readNerisDraftStore();
  return store[callNumber] ?? null;
}

function writeNerisDraft(callNumber: string, draft: NerisStoredDraft): void {
  const store = readNerisDraftStore();
  store[callNumber] = draft;
  writeNerisDraftStore(store);
}

function readNerisExportHistory(): NerisExportRecord[] {
  if (typeof window === "undefined") {
    return [];
  }
  const rawValue = readStorageWithMigration(
    NERIS_EXPORT_HISTORY_STORAGE_KEY,
    LEGACY_NERIS_EXPORT_HISTORY_STORAGE_KEYS,
  );
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry): NerisExportRecord | null => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const candidate = entry as Record<string, unknown>;
        const id = typeof candidate.id === "string" ? candidate.id : "";
        const callNumber = typeof candidate.callNumber === "string" ? candidate.callNumber : "";
        const incidentType =
          typeof candidate.incidentType === "string" ? candidate.incidentType : "";
        const address = typeof candidate.address === "string" ? candidate.address : "";
        const exportedAtIso =
          typeof candidate.exportedAtIso === "string" ? candidate.exportedAtIso : "";
        const exportedAtLabel =
          typeof candidate.exportedAtLabel === "string" ? candidate.exportedAtLabel : "";
        const attemptStatus =
          candidate.attemptStatus === "failed" ? "failed" : "success";
        const httpStatus =
          typeof candidate.httpStatus === "number" && Number.isFinite(candidate.httpStatus)
            ? candidate.httpStatus
            : attemptStatus === "failed"
              ? 0
              : 200;
        const httpStatusText =
          typeof candidate.httpStatusText === "string" ? candidate.httpStatusText : "";
        const statusLabel = typeof candidate.statusLabel === "string" ? candidate.statusLabel : "";
        const reportStatusAtExport =
          typeof candidate.reportStatusAtExport === "string"
            ? candidate.reportStatusAtExport
            : "";
        const validatorName =
          typeof candidate.validatorName === "string" ? candidate.validatorName : "";
        const reportWriterName =
          typeof candidate.reportWriterName === "string" ? candidate.reportWriterName : "";
        const submittedEntityId =
          typeof candidate.submittedEntityId === "string" ? candidate.submittedEntityId : "";
        const submittedDepartmentNerisId =
          typeof candidate.submittedDepartmentNerisId === "string"
            ? candidate.submittedDepartmentNerisId
            : "";
        const nerisId = typeof candidate.nerisId === "string" ? candidate.nerisId : "";
        const responseSummary =
          typeof candidate.responseSummary === "string" ? candidate.responseSummary : "";
        const responseDetail =
          typeof candidate.responseDetail === "string" ? candidate.responseDetail : "";
        const submittedPayloadPreview =
          typeof candidate.submittedPayloadPreview === "string"
            ? candidate.submittedPayloadPreview
            : "";
        if (!id || !callNumber || !exportedAtIso) {
          return null;
        }
        return {
          id,
          callNumber,
          incidentType,
          address,
          exportedAtIso,
          exportedAtLabel,
          attemptStatus,
          httpStatus,
          httpStatusText,
          statusLabel,
          reportStatusAtExport,
          validatorName,
          reportWriterName,
          submittedEntityId,
          submittedDepartmentNerisId,
          nerisId,
          responseSummary,
          responseDetail,
          submittedPayloadPreview,
        };
      })
      .filter((entry): entry is NerisExportRecord => Boolean(entry))
      .sort((left, right) => right.exportedAtIso.localeCompare(left.exportedAtIso));
  } catch {
    return [];
  }
}

function writeNerisExportHistory(history: NerisExportRecord[]): void {
  if (typeof window === "undefined") {
    return;
  }
  writeStorageValue(
    NERIS_EXPORT_HISTORY_STORAGE_KEY,
    LEGACY_NERIS_EXPORT_HISTORY_STORAGE_KEYS,
    JSON.stringify(history),
  );
}

function appendNerisExportRecord(record: NerisExportRecord): void {
  const current = readNerisExportHistory();
  current.unshift(record);
  writeNerisExportHistory(current);
}

function getCallFieldValue(
  call: (typeof INCIDENT_CALLS)[number],
  fieldId: IncidentCallFieldId,
): string {
  switch (fieldId) {
    case "incidentType":
      return call.incidentType;
    case "priority":
      return call.priority;
    case "address":
      return call.address;
    case "assignedUnits":
      return call.assignedUnits;
    case "status":
      return call.currentState;
    case "lastUpdated":
      return call.lastUpdated;
    default:
      return "";
  }
}

function getNerisReportStatus(callNumber: string): string {
  const draftStatus = readNerisDraft(callNumber)?.reportStatus;
  if (draftStatus) {
    return draftStatus;
  }
  return NERIS_REPORT_STATUS_BY_CALL[callNumber] ?? "Draft";
}

function getNerisQueueFieldValue(
  call: (typeof INCIDENT_CALLS)[number],
  fieldId: IncidentCallFieldId,
): string {
  if (fieldId === "status") {
    return getNerisReportStatus(call.callNumber);
  }
  return getCallFieldValue(call, fieldId);
}

function AuthPage({ onLogin }: AuthPageProps) {
  const [username, setUsername] = useState("");
  const [unit, setUnit] = useState("");
  const [securePin, setSecurePin] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !unit.trim() || !securePin.trim()) {
      setErrorMessage("Please provide fire department, username, and password.");
      return;
    }

    setErrorMessage("");
    onLogin(username.trim().toUpperCase(), unit.trim(), role);
  };

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <div className="brand-pill">
          <Shield size={16} />
          <span>Fire Ultimate Prototype</span>
        </div>
        <h1>Incident-focused workspace with mapping and admin controls</h1>
        <p>
          This phase adds deeper incident customization, parsing setup previews,
          and an updated incident detail page layout.
        </p>
        <ul className="brand-feature-list">
          <li>Simple login with Admin and User roles</li>
          <li>User role restricted only from Admin Functions</li>
          <li>Settings menu includes profile, display, and logout actions</li>
        </ul>
      </section>

      <section className="auth-form-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-header">
            <ShieldCheck size={24} />
            <div>
              <h2>Sign in to Fire Ultimate</h2>
              <p>Simple login mode remains active for this prototype.</p>
            </div>
          </div>

          <label htmlFor="username">Fire Department</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="organization"
            placeholder="CIFPD"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />

          <label htmlFor="unit">Username</label>
          <input
            id="unit"
            name="unit"
            type="text"
            autoComplete="username"
            placeholder="chief.jones"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          />

          <label htmlFor="pin">Password</label>
          <input
            id="pin"
            name="pin"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={securePin}
            onChange={(event) => setSecurePin(event.target.value)}
          />

          <label>Login Type</label>
          <div className="role-selector" role="radiogroup" aria-label="Login role">
            <button
              type="button"
              className={`role-choice ${role === "user" ? "active" : ""}`}
              onClick={() => setRole("user")}
              aria-pressed={role === "user"}
            >
              User
            </button>
            <button
              type="button"
              className={`role-choice ${role === "admin" ? "active" : ""}`}
              onClick={() => setRole("admin")}
              aria-pressed={role === "admin"}
            >
              Admin
            </button>
          </div>
          <p className="role-hint">
            Users can access all modules except Admin Functions.
          </p>

          {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

          <button type="submit" className="primary-button">
            Login
          </button>
        </form>
      </section>
    </div>
  );
}

function ShellLayout({ session, onLogout }: ShellLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState<number>(() =>
    readShellSidebarWidth(),
  );
  const [expandedMenuId, setExpandedMenuId] = useState<MainMenuId | null>(
    "incidentsMapping",
  );
  const activeSidebarResize = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );
  const sidebarWidthRef = useRef(sidebarWidth);
  const [departmentLogoDataUrl, setDepartmentLogoDataUrl] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem(DEPARTMENT_LOGO_DATA_URL_STORAGE_KEY) ?? "";
  });

  const location = useLocation();
  const navigate = useNavigate();
  const visibleMenus = useMemo(
    () => getVisibleMenus(session.role),
    [session.role],
  );
  const activeMenu = useMemo(
    () => getMainMenuByPath(location.pathname),
    [location.pathname],
  );
  const activeSubmenu = useMemo(
    () => getSubmenuForPath(location.pathname),
    [location.pathname],
  );
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date()),
    [],
  );

  const breadcrumb = useMemo(() => {
    const path = normalizePath(location.pathname);
    if (path === "/settings/profile") {
      return { primary: "Settings", secondary: "Profile Management" };
    }
    if (path === "/settings/display") {
      return { primary: "Settings", secondary: "Edit My Display" };
    }
    if (path === "/access-denied") {
      return { primary: "Access Denied", secondary: null };
    }
    if (path.startsWith("/incidents-mapping/incidents/")) {
      return {
        primary: "Incidents / Mapping",
        secondary: decodeURIComponent(path.replace("/incidents-mapping/incidents/", "")),
      };
    }
    if (!activeMenu) {
      return { primary: "Dashboard", secondary: null };
    }
    if (!activeSubmenu) {
      return { primary: activeMenu.title, secondary: null };
    }
    return { primary: activeMenu.title, secondary: activeSubmenu.label };
  }, [activeMenu, activeSubmenu, location.pathname]);

  const handleNavClick = () => {
    setMobileNavOpen(false);
    setSettingsOpen(false);
  };

  const expandedMenuForRender = activeMenu?.id ?? expandedMenuId;

  const handleLogout = () => {
    onLogout();
    setSettingsOpen(false);
    navigate("/auth", { replace: true });
  };

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    const handleDepartmentLogoUpdate = () => {
      if (typeof window === "undefined") {
        return;
      }
      setDepartmentLogoDataUrl(
        window.localStorage.getItem(DEPARTMENT_LOGO_DATA_URL_STORAGE_KEY) ?? "",
      );
    };

    window.addEventListener("department-logo-updated", handleDepartmentLogoUpdate);
    return () => {
      window.removeEventListener("department-logo-updated", handleDepartmentLogoUpdate);
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const activeResize = activeSidebarResize.current;
      if (!activeResize) {
        return;
      }
      const delta = event.clientX - activeResize.startX;
      const nextWidth = Math.min(
        MAX_SHELL_SIDEBAR_WIDTH,
        Math.max(MIN_SHELL_SIDEBAR_WIDTH, activeResize.startWidth + delta),
      );
      setSidebarWidth((previous) => (previous === nextWidth ? previous : nextWidth));
    };

    const stopResize = () => {
      if (!activeSidebarResize.current) {
        return;
      }
      activeSidebarResize.current = null;
      document.body.classList.remove("resizing-shell-sidebar");
      writeShellSidebarWidth(sidebarWidthRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.classList.remove("resizing-shell-sidebar");
    };
  }, []);

  const startSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mobileNavOpen) {
      return;
    }
    event.preventDefault();
    activeSidebarResize.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    document.body.classList.add("resizing-shell-sidebar");
  };

  const shellLayoutStyle = {
    "--shell-sidebar-width": `${sidebarWidth}px`,
  } as CSSProperties;

  return (
    <div className="shell-layout" style={shellLayoutStyle}>
      {mobileNavOpen ? (
        <button
          type="button"
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            {departmentLogoDataUrl ? (
              <img
                src={departmentLogoDataUrl}
                alt="Department logo"
                className="sidebar-logo-image"
              />
            ) : (
              <Shield size={18} />
            )}
          </div>
          <div>
            <strong>Fire Ultimate</strong>
            <span>Fire Department Software</span>
          </div>
        </div>

        <nav className="nav-groups">
          {visibleMenus.map((menu) => {
            const Icon = menu.icon;
            const isMenuRoute =
              location.pathname === menu.path ||
              location.pathname.startsWith(`${menu.path}/`);
            const visibleSubmenus = menu.submenus.filter(
              (submenu) => session.role === "admin" || !submenu.adminOnly,
            );
            const hasSubmenus = visibleSubmenus.length > 0;
            const isExpanded = hasSubmenus && menu.id === expandedMenuForRender;

            return (
              <section
                key={menu.id}
                className={`nav-module ${isMenuRoute ? "active" : ""}`}
              >
                <div className="nav-module-header">
                  <NavLink
                    to={menu.path}
                    className={({ isActive }) =>
                      `nav-module-link ${
                        isActive || isMenuRoute ? "active" : ""
                      }`
                    }
                    onClick={() => {
                      setExpandedMenuId(menu.id);
                      handleNavClick();
                    }}
                  >
                    <Icon size={16} />
                    <span>{menu.title}</span>
                  </NavLink>

                  {hasSubmenus ? (
                    <button
                      type="button"
                      className={`module-toggle ${isExpanded ? "expanded" : ""}`}
                      aria-label={`Toggle ${menu.title} submenu`}
                      onClick={() =>
                        setExpandedMenuId((previous) =>
                          previous === menu.id ? null : menu.id,
                        )
                      }
                    >
                      <ChevronDown size={16} />
                    </button>
                  ) : null}
                </div>

                {hasSubmenus ? (
                  <div className={`submenu-links ${isExpanded ? "open" : ""}`}>
                    {visibleSubmenus.map((submenu) => (
                      <NavLink
                        key={submenu.path}
                        to={submenu.path}
                        className={({ isActive }) =>
                          `submenu-link ${isActive ? "active" : ""}`
                        }
                        onClick={() => {
                          setExpandedMenuId(menu.id);
                          handleNavClick();
                        }}
                      >
                        {submenu.label}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </nav>
      </aside>

      <div
        className="sidebar-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize main navigation sidebar"
        onPointerDown={startSidebarResize}
      />

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button mobile-nav-toggle"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={18} />
            </button>

            <div className="breadcrumb">
              <span>{breadcrumb.primary}</span>
              {breadcrumb.secondary ? (
                <>
                  <ChevronRight size={14} />
                  <span className="breadcrumb-secondary">{breadcrumb.secondary}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="topbar-right">
            <label className="search-field">
              <Search size={15} />
              <input
                type="search"
                placeholder="Search calls, units, reports..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <button type="button" className="icon-button" aria-label="Notifications">
              <Bell size={16} />
            </button>

            <span className={`role-badge role-${session.role}`}>
              {session.role === "admin" ? "Admin" : "User"}
            </span>

            <div className="user-pill">
              <UserRound size={15} />
              <div>
                <strong>{session.unit}</strong>
                <span>
                  Fire Dept {session.username} | {dateLabel}
                </span>
              </div>
            </div>

            <div className="settings-wrap">
              <button
                type="button"
                className="icon-button"
                aria-label="Settings"
                onClick={() => setSettingsOpen((previous) => !previous)}
              >
                <Settings size={16} />
              </button>

              {settingsOpen ? (
                <div className="settings-dropdown">
                  <NavLink
                    to="/settings/profile"
                    className="settings-dropdown-item"
                    onClick={() => setSettingsOpen(false)}
                  >
                    <UserRound size={15} />
                    <span>Profile Management</span>
                  </NavLink>
                  <NavLink
                    to="/settings/display"
                    className="settings-dropdown-item"
                    onClick={() => setSettingsOpen(false)}
                  >
                    <Palette size={15} />
                    <span>Edit My Display</span>
                  </NavLink>
                  <button
                    type="button"
                    className="settings-dropdown-item settings-logout"
                    onClick={handleLogout}
                  >
                    <LogOut size={15} />
                    <span>Logout</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function MenuDisplayCards({
  menu,
  role,
  submenuVisibility,
}: MenuDisplayCardsProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [displayConfig, setDisplayConfig] = useState<DisplayCardConfig>(() =>
    readDisplayCardConfig(),
  );

  const defaultCards = useMemo(
    () =>
      menu.submenus.filter(
        (submenu) =>
          (role === "admin" || !submenu.adminOnly) &&
          submenuVisibility[submenu.path] !== false,
      ),
    [menu, role, submenuVisibility],
  );
  const defaultPathSet = useMemo(
    () => new Set<string>(defaultCards.map((submenu) => submenu.path)),
    [defaultCards],
  );
  const selectableOptions = useMemo(
    () =>
      getDisplayCardOptions(role).filter(
        (option) => submenuVisibility[option.path] !== false,
      ),
    [role, submenuVisibility],
  );
  const selectableMap = useMemo(
    () =>
      new Map<string, DisplayCardOption>(
        selectableOptions.map((option) => [option.path, option]),
      ),
    [selectableOptions],
  );

  const extraCardPaths = displayConfig[menu.id] ?? [];
  const extraCards = extraCardPaths.reduce<DisplayCardOption[]>(
    (cardsAccumulator, path) => {
      const card = selectableMap.get(path);
      if (card && !defaultPathSet.has(card.path)) {
        cardsAccumulator.push(card);
      }
      return cardsAccumulator;
    },
    [],
  );

  const cards: DisplayCardOption[] = [
    ...defaultCards.map((submenu) => ({
      ...submenu,
      parentMenuId: menu.id,
      parentMenuTitle: menu.title,
    })),
    ...extraCards,
  ];

  const updateMenuCardSelection = (path: string) => {
    if (defaultPathSet.has(path)) {
      return;
    }

    setDisplayConfig((previous) => {
      const current = previous[menu.id] ?? [];
      const next = current.includes(path)
        ? current.filter((item) => item !== path)
        : [...current, path];
      const normalized: DisplayCardConfig = {
        ...previous,
        [menu.id]: next,
      };

      if (next.length === 0) {
        delete normalized[menu.id];
      }

      writeDisplayCardConfig(normalized);
      return normalized;
    });
  };

  return (
    <section className="panel">
      <div className="panel-header display-panel-header">
        <div>
          <h2>Submenu Cards</h2>
          <p className="panel-caption">
            Click a card to open that submenu directly.
          </p>
        </div>

        <div className="edit-display-wrap">
          <button
            type="button"
            className="edit-display-link"
            onClick={() => setEditorOpen((previous) => !previous)}
          >
            Edit display
          </button>

          {editorOpen ? (
            <div className="edit-display-dropdown">
              <p>Choose extra submenu cards to show on this screen.</p>
              <ul>
                {selectableOptions.map((option) => {
                  const isDefault = defaultPathSet.has(option.path);
                  const isChecked =
                    isDefault || (displayConfig[menu.id] ?? []).includes(option.path);
                  return (
                    <li key={option.path}>
                      <label>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDefault}
                          onChange={() => updateMenuCardSelection(option.path)}
                        />
                        <span>
                          {option.label} <em>({option.parentMenuTitle})</em>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <small>
                Default submenu cards for this menu stay pinned and cannot be
                removed.
              </small>
            </div>
          ) : null}
        </div>
      </div>

      {cards.length > 0 ? (
        <section className="submenu-card-grid">
          {cards.map((card) => (
            <NavLink
              key={`${menu.id}-${card.path}`}
              to={card.path}
              className="submenu-card submenu-card-link"
            >
              <div className="submenu-card-header">
                <h2>{card.label}</h2>
                <span
                  className={`build-status ${
                    card.isBuilt ? "build-ready" : "build-planned"
                  }`}
                >
                  {card.isBuilt ? "Built" : "Scaffolded"}
                </span>
              </div>
              <p>{card.summary}</p>
              <span className="submenu-card-origin">{card.parentMenuTitle}</span>
            </NavLink>
          ))}
        </section>
      ) : (
        <p className="panel-description">
          This menu currently has no visible submenu cards. Use{" "}
          <strong>Edit display</strong> to add cards from other menus.
        </p>
      )}
    </section>
  );
}

function DashboardPage({ role, submenuVisibility }: DashboardPageProps) {
  const dashboardMenu = getMainMenuById("dashboard");

  return (
    <section className="page-section neris-report-page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            Current status across call activity, readiness, and high-priority
            updates.
          </p>
        </div>
        <div className="header-actions">
          <NavLink className="secondary-button button-link" to="/calendar/events">
            Open Calendar
          </NavLink>
          <NavLink className="primary-button button-link" to="/incidents-mapping/incidents">
            Open Incidents
          </NavLink>
        </div>
      </header>

      <section className="stat-grid">
        {DASHBOARD_STATS.map((stat) => (
          <article key={stat.label} className="stat-card">
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <span className={toToneClass(stat.tone)}>{stat.detail}</span>
          </article>
        ))}
      </section>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Priority Shortcuts</h2>
            <span className="panel-caption">
              {role === "admin"
                ? "Admin-level links included"
                : "Admin-only links will route to access denied"}
            </span>
          </div>
          <ul className="dashboard-shortcut-list">
            {DASHBOARD_PRIORITY_LINKS.map((link) => (
              <li key={link.path}>
                <div>
                  <strong>{link.label}</strong>
                  <p>{link.description}</p>
                </div>
                <NavLink className="secondary-button button-link compact" to={link.path}>
                  Open
                </NavLink>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Live Alerts</h2>
            <span className="panel-caption">Most recent operational notices</span>
          </div>
          <ul className="timeline-list">
            {DASHBOARD_ALERTS.map((alert) => (
              <li key={`${alert.title}-${alert.time}`}>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </div>
                <span className={toToneClass(alert.tone)}>{alert.time}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      {dashboardMenu ? (
        <MenuDisplayCards
          menu={dashboardMenu}
          role={role}
          submenuVisibility={submenuVisibility}
        />
      ) : null}
    </section>
  );
}

function IncidentsListPage({
  incidentDisplaySettings,
  onSaveIncidentDisplaySettings,
}: IncidentsListPageProps) {
  const navigate = useNavigate();
  const [isFieldEditorOpen, setIsFieldEditorOpen] = useState(false);
  const [dragFieldId, setDragFieldId] = useState<IncidentCallFieldId | null>(null);
  const [callFieldWidths, setCallFieldWidths] = useState<Record<IncidentCallFieldId, number>>(
    () => ({ ...DEFAULT_CALL_FIELD_WIDTHS }),
  );
  const activeResizeField = useRef<{
    fieldId: IncidentCallFieldId;
    startX: number;
    startWidth: number;
  } | null>(null);

  const visibleStats = INCIDENT_QUEUE_STATS.filter(
    (stat) => !incidentDisplaySettings.hiddenStatIds.includes(stat.id),
  );
  const visibleCallFieldOrder = dedupeCallFieldOrder(
    incidentDisplaySettings.callFieldOrder.filter((fieldId) =>
      VALID_CALL_FIELD_IDS.has(fieldId),
    ),
  );
  const callFieldOrder =
    visibleCallFieldOrder.length > 0
      ? visibleCallFieldOrder
      : [...DEFAULT_INCIDENT_CALL_FIELD_ORDER];
  const fieldLabelById = useMemo(
    () =>
      Object.fromEntries(
        INCIDENT_CALL_FIELD_OPTIONS.map((field) => [field.id, field.label]),
      ) as Record<IncidentCallFieldId, string>,
    [],
  );

  const openCallDetail = (callNumber: string) => {
    navigate(`/incidents-mapping/incidents/${encodeURIComponent(callNumber)}`);
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const activeResize = activeResizeField.current;
      if (!activeResize) {
        return;
      }

      const delta = event.clientX - activeResize.startX;
      const nextWidth = Math.min(
        MAX_CALL_FIELD_WIDTH,
        Math.max(MIN_CALL_FIELD_WIDTH, activeResize.startWidth + delta),
      );

      setCallFieldWidths((previous) => {
        if (previous[activeResize.fieldId] === nextWidth) {
          return previous;
        }
        return {
          ...previous,
          [activeResize.fieldId]: nextWidth,
        };
      });
    };

    const stopResize = () => {
      if (!activeResizeField.current) {
        return;
      }
      activeResizeField.current = null;
      document.body.classList.remove("resizing-dispatch-columns");
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.classList.remove("resizing-dispatch-columns");
    };
  }, []);

  const saveCallFieldOrder = (nextOrder: IncidentCallFieldId[]) => {
    onSaveIncidentDisplaySettings({
      ...incidentDisplaySettings,
      callFieldOrder: nextOrder,
    });
  };

  const handleFieldDrop = (targetFieldId: IncidentCallFieldId) => {
    if (!dragFieldId || dragFieldId === targetFieldId) {
      return;
    }

    const fromIndex = callFieldOrder.indexOf(dragFieldId);
    const toIndex = callFieldOrder.indexOf(targetFieldId);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    const nextOrder = [...callFieldOrder];
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, dragFieldId);
    saveCallFieldOrder(nextOrder);
    setDragFieldId(null);
  };

  const handleSaveFieldEditor = () => {
    setDragFieldId(null);
    setIsFieldEditorOpen(false);
  };

  const startFieldResize = (
    fieldId: IncidentCallFieldId,
    event: ReactPointerEvent<HTMLSpanElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    activeResizeField.current = {
      fieldId,
      startX: event.clientX,
      startWidth: callFieldWidths[fieldId] ?? DEFAULT_CALL_FIELD_WIDTHS[fieldId],
    };
    document.body.classList.add("resizing-dispatch-columns");
  };

  const dispatchGridStyle = {
    "--dispatch-grid-columns": callFieldOrder
      .map((fieldId) => {
        const width = callFieldWidths[fieldId] ?? DEFAULT_CALL_FIELD_WIDTHS[fieldId];
        const clampedWidth = Math.min(
          MAX_CALL_FIELD_WIDTH,
          Math.max(MIN_CALL_FIELD_WIDTH, width),
        );
        return `${clampedWidth}px`;
      })
      .join(" "),
  } as CSSProperties;

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Incidents / Mapping | Incidents</h1>
          <p>
            Click any call row to open full incident details with call
            information, map, apparatus, and dispatch notes.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button">
            Export Call Queue
          </button>
          <button type="button" className="primary-button">
            Create Incident
          </button>
        </div>
      </header>

      {visibleStats.length > 0 ? (
        <section className="stat-grid">
          {visibleStats.map((stat) => (
            <article key={stat.id} className="stat-card">
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
              <span className={toToneClass(stat.tone)}>{stat.detail}</span>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel-grid">
          <article className="panel">
            <p className="panel-description">
              All incident stat cards are currently hidden by customization.
            </p>
          </article>
        </section>
      )}

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Incidents</h2>
            {isFieldEditorOpen ? (
              <button
                type="button"
                className="primary-button compact-button"
                onClick={handleSaveFieldEditor}
              >
                Save
              </button>
            ) : (
              <button
                type="button"
                className="link-button"
                onClick={() => setIsFieldEditorOpen(true)}
              >
                Edit
              </button>
            )}
          </div>
          {isFieldEditorOpen ? (
            <div className="field-editor-panel">
              <p>Drag rows using the handle to reorder incident summary fields.</p>
              <ul className="drag-order-list">
                {callFieldOrder.map((fieldId) => (
                  <li
                    key={`order-${fieldId}`}
                    draggable
                    onDragStart={() => setDragFieldId(fieldId)}
                    onDragEnd={() => setDragFieldId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleFieldDrop(fieldId)}
                  >
                    <div className="drag-order-row">
                      <span>{fieldLabelById[fieldId]}</span>
                      <span className="drag-handle" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Call #</th>
                  <th>
                    <div
                      className="dispatch-grid-line dispatch-grid-header"
                      style={dispatchGridStyle}
                    >
                      {callFieldOrder.map((fieldId, index) => (
                        <span
                          key={`header-${fieldId}`}
                          className={`dispatch-field dispatch-field-${fieldId} dispatch-header-field`}
                        >
                          <span className="dispatch-header-label">{fieldLabelById[fieldId]}</span>
                          {index < callFieldOrder.length - 1 ? (
                            <span
                              className="dispatch-column-resizer"
                              role="separator"
                              aria-label={`Resize ${fieldLabelById[fieldId]} column`}
                              aria-orientation="vertical"
                              onPointerDown={(event) => startFieldResize(fieldId, event)}
                              title={`Drag to resize ${fieldLabelById[fieldId]}`}
                            >
                              |
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {INCIDENT_CALLS.map((call) => (
                  <tr
                    key={call.callNumber}
                    className="clickable-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openCallDetail(call.callNumber)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openCallDetail(call.callNumber);
                      }
                    }}
                  >
                    <td>
                      <strong className="call-number-text">{call.callNumber}</strong>
                    </td>
                    <td>
                      <div className="dispatch-info-cell">
                        <div className="dispatch-grid-line" style={dispatchGridStyle}>
                          {callFieldOrder.map((fieldId) => (
                            <span
                              key={`${call.callNumber}-${fieldId}`}
                              className={`dispatch-field dispatch-field-${fieldId}`}
                            >
                              {getCallFieldValue(call, fieldId)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-description">
            Future API integration will update these calls and notes in real-time as
            dispatch centers enter new information.
          </p>
        </article>
      </section>
    </section>
  );
}

function IncidentCallDetailPage({ callNumber }: IncidentCallDetailPageProps) {
  const detail = getIncidentCallDetail(callNumber);
  const [callInfoExpanded, setCallInfoExpanded] = useState(false);

  if (!detail) {
    return (
      <section className="page-section">
        <header className="page-header">
          <div>
            <h1>Incident not found</h1>
            <p>No incident record was found for call {callNumber}.</p>
          </div>
          <div className="header-actions">
            <NavLink className="secondary-button button-link" to="/incidents-mapping/incidents">
              Back to Incidents
            </NavLink>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{detail.callNumber}</h1>
          <p>{detail.dispatchInfo}</p>
        </div>
        <div className="header-actions">
          <NavLink className="secondary-button button-link" to="/incidents-mapping/incidents">
            Back to Incidents
          </NavLink>
          <button type="button" className="primary-button">
            Add Note
          </button>
        </div>
      </header>

      <section className="panel-grid">
        <article className="panel">
          <button
            type="button"
            className="call-info-toggle"
            onClick={() => setCallInfoExpanded((previous) => !previous)}
          >
            <div className="call-info-line">
              <strong>Incident Details:</strong>
              <span>
                {detail.receivedAt} | {detail.address} | {detail.stillDistrict}
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`call-info-chevron ${callInfoExpanded ? "open" : ""}`}
            />
          </button>

          {callInfoExpanded ? (
            <dl className="detail-grid">
              <div>
                <dt>Incident Type</dt>
                <dd>{detail.incidentType}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>{detail.priority}</dd>
              </div>
              <div>
                <dt>Assigned Units</dt>
                <dd>{detail.assignedUnits}</dd>
              </div>
              <div>
                <dt>Still District</dt>
                <dd>{detail.stillDistrict}</dd>
              </div>
              <div>
                <dt>Current Status</dt>
                <dd>{detail.currentState}</dd>
              </div>
              <div>
                <dt>Map Reference</dt>
                <dd>{detail.mapReference}</dd>
              </div>
              <div>
                <dt>Reported By</dt>
                <dd>{detail.reportedBy}</dd>
              </div>
              <div>
                <dt>Callback Number</dt>
                <dd>{detail.callbackNumber}</dd>
              </div>
              <div>
                <dt>Last Updated</dt>
                <dd>{detail.lastUpdated}</dd>
              </div>
            </dl>
          ) : null}
        </article>
      </section>

      <section className="panel-grid incident-detail-split">
        <article className="panel">
          <div className="panel-header">
            <h2>Apparatus Responding</h2>
          </div>
          <ul className="unit-status-list">
            {detail.apparatus.map((item) => (
              <li key={`${detail.callNumber}-${item.unit}`}>
                <div>
                  <strong>
                    {item.unit}{" "}
                    <span className="apparatus-personnel">({item.crew})</span>
                  </strong>
                </div>
                <span className={toToneClass(toneFromState(item.status))}>
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Live Map</h2>
            <span className="panel-caption">Prepared for GIS/API integration</span>
          </div>
          <div className="dispatch-map-placeholder map-large">
            <p>
              Live map surface for this incident. Future integration will stream
              unit locations, route updates, hydrants, and map markers in real-time.
            </p>
            <ul>
              <li>Current incident pin: {detail.address}</li>
              <li>Nearest hydrants and out-of-service hydrant warnings</li>
              <li>Map marker overlays from Incidents / Mapping settings</li>
            </ul>
          </div>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Dispatch Notes</h2>
            <span className="panel-caption">
              Future API updates will append notes automatically
            </span>
          </div>
          <ul className="timeline-list">
            {detail.dispatchNotes.map((note) => (
              <li key={`${detail.callNumber}-${note.time}-${note.text}`}>
                <p className="dispatch-note-line">
                  <strong>{note.time}</strong> | {note.text}
                </p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
}

function MainMenuLandingPage({
  menu,
  role,
  submenuVisibility,
}: MainMenuLandingPageProps) {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{menu.title}</h1>
          <p>{menu.summary}</p>
        </div>
      </header>

      <MenuDisplayCards menu={menu} role={role} submenuVisibility={submenuVisibility} />
    </section>
  );
}

function SubmenuPlaceholderPage({ submenu }: SubmenuPlaceholderPageProps) {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{submenu.label}</h1>
          <p>{submenu.summary}</p>
        </div>
      </header>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Module Status</h2>
          </div>
          <p className="panel-description">
            {submenu.isBuilt
              ? "This submenu includes an initial UI implementation."
              : "This submenu route is connected with a scaffold placeholder and is ready for detailed build-out."}
          </p>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Next Build Steps</h2>
          </div>
          <ul className="activity-list">
            {SUBMENU_PLACEHOLDER_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
}

function NerisReportingPage() {
  const navigate = useNavigate();
  const fieldLabelById = useMemo(
    () =>
      Object.fromEntries(
        INCIDENT_CALL_FIELD_OPTIONS.map((field) => [field.id, field.label]),
      ) as Record<IncidentCallFieldId, string>,
    [],
  );

  const openNerisReport = (callNumber: string) => {
    navigate(`/reporting/neris/${encodeURIComponent(callNumber)}`);
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Reporting | NERIS</h1>
          <p>
            Click any incident row to open the NERIS report form. This workflow will
            support admin-required fields, review, and export/API submission.
          </p>
        </div>
        <div className="header-actions">
          <NavLink className="secondary-button button-link compact-button" to="/reporting/neris/exports">
            View Exports
          </NavLink>
        </div>
      </header>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Incident Report Queue</h2>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Incident #</th>
                  <th>
                    <div className="dispatch-grid-line dispatch-grid-header">
                      {NERIS_QUEUE_FIELD_ORDER.map((fieldId) => (
                        <span
                          key={`neris-header-${fieldId}`}
                          className={`dispatch-field dispatch-field-${fieldId}`}
                        >
                          {fieldLabelById[fieldId]}
                        </span>
                      ))}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {INCIDENT_CALLS.map((call) => (
                  <tr
                    key={`neris-${call.callNumber}`}
                    className="clickable-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openNerisReport(call.callNumber)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openNerisReport(call.callNumber);
                      }
                    }}
                  >
                    <td>
                      <strong className="call-number-text">{call.callNumber}</strong>
                    </td>
                    <td>
                      <div className="dispatch-info-cell">
                        <div className="dispatch-grid-line">
                          {NERIS_QUEUE_FIELD_ORDER.map((fieldId) => {
                            const value = getNerisQueueFieldValue(call, fieldId);
                            return (
                              <span
                                key={`neris-${call.callNumber}-${fieldId}`}
                                className={`dispatch-field dispatch-field-${fieldId}`}
                              >
                                {fieldId === "status" ? (
                                  <span className={toToneClass(toneFromNerisStatus(value))}>
                                    {value}
                                  </span>
                                ) : (
                                  value
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-description">
            This queue mirrors the Incidents module layout while routing directly into
            incident-specific NERIS forms.
          </p>
        </article>
      </section>
    </section>
  );
}

interface NerisExportDetailsPageProps {
  callNumber: string;
}

function NerisExportsPage() {
  const navigate = useNavigate();
  const latestExportByCall = useMemo(() => {
    const map = new Map<string, NerisExportRecord>();
    readNerisExportHistory().forEach((entry) => {
      if (!map.has(entry.callNumber)) {
        map.set(entry.callNumber, entry);
      }
    });
    return map;
  }, []);

  const openExportDetails = (callNumber: string) => {
    navigate(`/reporting/neris/exports/${encodeURIComponent(callNumber)}`);
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Reporting | NERIS | Exports</h1>
          <p>
            Export visibility queue. Click any incident row to open validator details,
            report writer details, and recent export IDs.
          </p>
        </div>
        <div className="header-actions">
          <NavLink className="secondary-button button-link compact-button" to="/reporting/neris">
            Back to NERIS Queue
          </NavLink>
        </div>
      </header>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Incident Export Queue</h2>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Incident #</th>
                  <th>Incident Type</th>
                  <th>Report Status</th>
                  <th>Last Attempt Result</th>
                  <th>Last Export</th>
                  <th>Validator</th>
                  <th>Report Writer</th>
                  <th>NERIS ID</th>
                </tr>
              </thead>
              <tbody>
                {INCIDENT_CALLS.map((call) => {
                  const latestExport = latestExportByCall.get(call.callNumber);
                  return (
                    <tr
                      key={`neris-export-row-${call.callNumber}`}
                      className="clickable-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => openExportDetails(call.callNumber)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openExportDetails(call.callNumber);
                        }
                      }}
                    >
                      <td>
                        <strong className="call-number-text">{call.callNumber}</strong>
                      </td>
                      <td>{call.incidentType}</td>
                      <td>
                        <span className={toToneClass(toneFromNerisStatus(getNerisReportStatus(call.callNumber)))}>
                          {getNerisReportStatus(call.callNumber)}
                        </span>
                      </td>
                      <td>
                        {latestExport
                          ? `${latestExport.httpStatus} ${latestExport.httpStatusText}`.trim()
                          : "No attempts"}
                      </td>
                      <td>{latestExport?.exportedAtLabel ?? "Not exported"}</td>
                      <td>{latestExport?.validatorName || "--"}</td>
                      <td>{latestExport?.reportWriterName || "--"}</td>
                      <td>{latestExport?.nerisId || "--"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  );
}

function NerisExportDetailsPage({ callNumber }: NerisExportDetailsPageProps) {
  const navigate = useNavigate();
  const incident = getIncidentCallDetail(callNumber);
  const exportHistory = useMemo(
    () => readNerisExportHistory().filter((entry) => entry.callNumber === callNumber),
    [callNumber],
  );

  if (!incident) {
    return (
      <section className="page-section">
        <header className="page-header">
          <div>
            <h1>NERIS export details not found</h1>
            <p>No matching incident exists for report ID {callNumber}.</p>
          </div>
          <div className="header-actions">
            <NavLink className="secondary-button button-link" to="/reporting/neris/exports">
              Back to View Exports
            </NavLink>
          </div>
        </header>
      </section>
    );
  }

  const latestExport = exportHistory[0] ?? null;
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Export Details | {incident.callNumber}</h1>
          <p>
            <strong>{incident.incidentType}</strong> at {incident.address}
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => navigate("/reporting/neris/exports")}
          >
            Back to View Exports
          </button>
          <button
            type="button"
            className="primary-button compact-button"
            onClick={() => navigate(`/reporting/neris/${encodeURIComponent(callNumber)}`)}
          >
            Open Report
          </button>
        </div>
      </header>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Latest Export Attempt</h2>
          </div>
          {latestExport ? (
            <>
              <dl className="detail-grid">
                <div>
                  <dt>Attempt Result</dt>
                  <dd>
                    {latestExport.attemptStatus === "success" ? "Success" : "Failed"}
                  </dd>
                </div>
                <div>
                  <dt>HTTP Status</dt>
                  <dd>{`${latestExport.httpStatus} ${latestExport.httpStatusText}`.trim() || "--"}</dd>
                </div>
                <div>
                  <dt>Status Label</dt>
                  <dd>{latestExport.statusLabel || "--"}</dd>
                </div>
                <div>
                  <dt>NERIS ID</dt>
                  <dd>{latestExport.nerisId || "--"}</dd>
                </div>
                <div>
                  <dt>Validator</dt>
                  <dd>{latestExport.validatorName || "--"}</dd>
                </div>
                <div>
                  <dt>Report Writer</dt>
                  <dd>{latestExport.reportWriterName || "--"}</dd>
                </div>
                <div>
                  <dt>Submitted Entity ID</dt>
                  <dd>{latestExport.submittedEntityId || "--"}</dd>
                </div>
                <div>
                  <dt>Submitted Department NERIS ID</dt>
                  <dd>{latestExport.submittedDepartmentNerisId || "--"}</dd>
                </div>
                <div>
                  <dt>Exported At</dt>
                  <dd>{latestExport.exportedAtLabel || "--"}</dd>
                </div>
                <div>
                  <dt>Status at Export</dt>
                  <dd>{latestExport.reportStatusAtExport || "--"}</dd>
                </div>
              </dl>

              <div className="export-attempt-details-grid">
                <section className="export-attempt-detail-card">
                  <h3>Response Summary</h3>
                  <p>{latestExport.responseSummary || "No summary available."}</p>
                </section>
                <section className="export-attempt-detail-card">
                  <h3>Response Payload</h3>
                  <pre className="export-attempt-json">
                    {latestExport.responseDetail || "No response payload captured."}
                  </pre>
                </section>
                <section className="export-attempt-detail-card">
                  <h3>Submitted Payload</h3>
                  <pre className="export-attempt-json">
                    {latestExport.submittedPayloadPreview || "No payload captured."}
                  </pre>
                </section>
              </div>
            </>
          ) : (
            <p className="panel-description">
              No export attempts have been recorded for this incident yet.
            </p>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Export History</h2>
          </div>
          {exportHistory.length ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Exported At</th>
                    <th>Result</th>
                    <th>HTTP</th>
                    <th>Validator</th>
                    <th>Report Writer</th>
                    <th>NERIS ID</th>
                    <th>Entity ID</th>
                  </tr>
                </thead>
                <tbody>
                  {exportHistory.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.exportedAtLabel}</td>
                      <td>{entry.attemptStatus === "success" ? "Success" : "Failed"}</td>
                      <td>{`${entry.httpStatus} ${entry.httpStatusText}`.trim() || "--"}</td>
                      <td>{entry.validatorName || "--"}</td>
                      <td>{entry.reportWriterName || "--"}</td>
                      <td>{entry.nerisId || "--"}</td>
                      <td>{entry.submittedEntityId || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel-description">Run an export first to populate this history.</p>
          )}
        </article>
      </section>
    </section>
  );
}

type NerisGroupedOptionVariant = "incidentType" | "actionTactic";

const INCIDENT_TYPE_CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  HAZSIT: "HazMat",
  NOEMERG: "No Emergency",
  LAWENFORCE: "Law Enforcement",
  PUBSERV: "Public Service",
};

const CORE_SECTION_FIELD_HEADERS: Record<string, string> = {
  incident_neris_id: "INCIDENT",
  fd_neris_id: "DISPATCH",
  incident_people_present: "PEOPLE / DISPLACEMENT",
  incident_has_aid: "AID GIVEN / RECEIVED",
};

function getNerisGroupedCategoryLabel(
  categoryKey: string,
  variant: NerisGroupedOptionVariant,
): string {
  if (variant === "incidentType" && INCIDENT_TYPE_CATEGORY_LABEL_OVERRIDES[categoryKey]) {
    return INCIDENT_TYPE_CATEGORY_LABEL_OVERRIDES[categoryKey];
  }
  return formatNerisEnumSegment(categoryKey);
}

function getNerisGroupedSubgroupKey(
  categoryKey: string,
  rawSubgroupKey: string | undefined,
  variant: NerisGroupedOptionVariant,
): string {
  if (rawSubgroupKey) {
    return rawSubgroupKey;
  }
  if (variant === "incidentType" && categoryKey === "LAWENFORCE") {
    return "LAW_ENFORCEMENT_SUPPORT";
  }
  return "OTHER";
}

function getNerisGroupedSubgroupLabel(
  categoryKey: string,
  subgroupKey: string,
  variant: NerisGroupedOptionVariant,
): string {
  if (
    variant === "incidentType" &&
    categoryKey === "LAWENFORCE" &&
    subgroupKey === "LAW_ENFORCEMENT_SUPPORT"
  ) {
    return "Law Enforcement Support";
  }
  return formatNerisEnumSegment(subgroupKey);
}

function getNerisGroupedLeafLabel(
  segments: string[],
  option: NerisValueOption,
  variant: NerisGroupedOptionVariant,
): string {
  if (segments.length > 2) {
    return segments.slice(2).map(formatNerisEnumSegment).join(" / ");
  }
  if (segments.length === 2) {
    return formatNerisEnumSegment(segments[1]);
  }
  if (variant === "incidentType" && segments[0] === "LAWENFORCE") {
    return "Law Enforcement Support";
  }
  return option.label;
}

function getNerisGroupedSelectedLabel(
  option: NerisValueOption,
  variant: NerisGroupedOptionVariant,
): string {
  const segments = option.value
    .split("||")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return option.label;
  }

  const categoryKey = segments[0] ?? "";
  const categoryLabel = getNerisGroupedCategoryLabel(categoryKey, variant);
  if (segments.length === 1) {
    if (variant === "incidentType" && categoryKey === "LAWENFORCE") {
      return "Law Enforcement Support";
    }
    return categoryLabel;
  }

  const subgroupKey = getNerisGroupedSubgroupKey(categoryKey, segments[1], variant);
  const subgroupLabel = getNerisGroupedSubgroupLabel(categoryKey, subgroupKey, variant);
  if (segments.length === 2) {
    return `${categoryLabel} / ${subgroupLabel}`;
  }

  const leafLabel = segments.slice(2).map(formatNerisEnumSegment).join(" / ");
  return `${categoryLabel} / ${subgroupLabel} / ${leafLabel}`;
}

interface NerisGroupedOptionSelectProps {
  inputId: string;
  value: string;
  options: NerisValueOption[];
  onChange: (nextValue: string) => void;
  mode: "single" | "multi";
  variant: NerisGroupedOptionVariant;
  placeholder?: string;
  searchPlaceholder?: string;
  maxSelections?: number;
  showCheckboxes?: boolean;
  disabled?: boolean;
}

function NerisGroupedOptionSelect({
  inputId,
  value,
  options,
  onChange,
  mode,
  variant,
  placeholder,
  searchPlaceholder,
  maxSelections,
  showCheckboxes = false,
  disabled = false,
}: NerisGroupedOptionSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [collapsedSubgroups, setCollapsedSubgroups] = useState<Record<string, boolean>>({});

  const normalizedSelectedValues = Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => normalizeNerisEnumValue(entry)),
    ),
  );
  const normalizedSelectedValue = normalizedSelectedValues[0] ?? "";
  const selectedValueSet = new Set<string>(normalizedSelectedValues);
  const selectedOptions = normalizedSelectedValues
    .map((selectedValue) => options.find((option) => option.value === selectedValue))
    .filter((option): option is NerisValueOption => Boolean(option));
  const selectedOption = selectedOptions[0];
  const selectedOptionLabel = selectedOption
    ? getNerisGroupedSelectedLabel(selectedOption, variant)
    : "";
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const selectionLimitReached =
    mode === "multi" &&
    typeof maxSelections === "number" &&
    selectedValueSet.size >= maxSelections;

  interface GroupedLeafOption {
    option: NerisValueOption;
    leafLabel: string;
  }

  interface GroupedOptionCategory {
    categoryKey: string;
    categoryLabel: string;
    optionCount: number;
    directOptions: GroupedLeafOption[];
    subgroups: Array<{
      subgroupKey: string;
      subgroupLabel: string;
      options: GroupedLeafOption[];
    }>;
  }

  const groupedOptions: GroupedOptionCategory[] = useMemo(() => {
    const filteredOptions = options.filter((option) => {
      if (!normalizedSearch) {
        return true;
      }
      return (
        option.label.toLowerCase().includes(normalizedSearch) ||
        option.value.toLowerCase().includes(normalizedSearch)
      );
    });
    const categoryMap = new Map<
      string,
      Map<string, Array<{ option: NerisValueOption; leafLabel: string }>>
    >();

    for (const option of filteredOptions) {
      const segments = option.value
        .split("||")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
      const categoryKey = segments[0] ?? "UNCLASSIFIED";
      const subgroupKey = getNerisGroupedSubgroupKey(categoryKey, segments[1], variant);
      const leafLabel = getNerisGroupedLeafLabel(segments, option, variant);
      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, new Map());
      }
      const subgroupMap = categoryMap.get(categoryKey);
      if (!subgroupMap) {
        continue;
      }
      if (!subgroupMap.has(subgroupKey)) {
        subgroupMap.set(subgroupKey, []);
      }
      const subgroupOptions = subgroupMap.get(subgroupKey);
      if (!subgroupOptions) {
        continue;
      }
      subgroupOptions.push({
        option,
        leafLabel,
      });
    }

    return Array.from(categoryMap.entries()).map(([categoryKey, subgroupMap]) => {
      const directOptions: GroupedLeafOption[] = [];
      const subgroups = Array.from(subgroupMap.entries()).reduce<
        Array<{
          subgroupKey: string;
          subgroupLabel: string;
          options: GroupedLeafOption[];
        }>
      >((groupAccumulator, [subgroupKey, subgroupOptions]) => {
        if (variant === "actionTactic" && subgroupOptions.length === 1) {
          const onlyOption = subgroupOptions[0];
          if (onlyOption) {
            directOptions.push({
              option: onlyOption.option,
              leafLabel: getNerisGroupedSubgroupLabel(categoryKey, subgroupKey, variant),
            });
          }
          return groupAccumulator;
        }
        groupAccumulator.push({
          subgroupKey,
          subgroupLabel: getNerisGroupedSubgroupLabel(categoryKey, subgroupKey, variant),
          options: subgroupOptions,
        });
        return groupAccumulator;
      }, []);

      return {
        categoryKey,
        categoryLabel: getNerisGroupedCategoryLabel(categoryKey, variant),
        optionCount: Array.from(subgroupMap.values()).reduce(
          (count, subgroupOptions) => count + subgroupOptions.length,
          0,
        ),
        directOptions,
        subgroups,
      };
    });
  }, [options, normalizedSearch, variant]);

  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, disabled]);

  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }
    searchInputRef.current?.focus();
  }, [isOpen, disabled]);

  const handleToggleCategory = (categoryKey: string) => {
    const currentlyCollapsed = collapsedCategories[categoryKey] !== false;
    const nextCollapsed = !currentlyCollapsed;
    setCollapsedCategories((previous) => ({
      ...previous,
      [categoryKey]: nextCollapsed,
    }));
    if (!nextCollapsed) {
      setCollapsedSubgroups((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([collapseKey]) => !collapseKey.startsWith(`${categoryKey}::`)),
        ),
      );
    }
  };

  const handleToggleSubgroup = (categoryKey: string, subgroupKey: string) => {
    const collapseKey = `${categoryKey}::${subgroupKey}`;
    setCollapsedSubgroups((previous) => ({
      ...previous,
      [collapseKey]: !previous[collapseKey],
    }));
  };

  return (
    <div className="neris-incident-type-select" ref={containerRef}>
      <button
        id={inputId}
        type="button"
        className={`neris-incident-type-select-trigger${disabled ? " disabled" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((previous) => !previous);
          if (isOpen) {
            setSearchTerm("");
          }
        }}
      >
        {mode === "single" ? (
          <div className="neris-selected-pill-row">
            {selectedOption ? (
              <span className="neris-selected-pill">{selectedOptionLabel}</span>
            ) : (
              <span
                className={
                  selectedOptions.length === 0 && placeholder && placeholder.length > 0
                    ? "neris-incident-type-placeholder"
                    : undefined
                }
              >
                {placeholder && placeholder.length > 0 ? placeholder : "\u00A0"}
              </span>
            )}
          </div>
        ) : (
          <div className="neris-selected-pill-row">
            {selectedOptions.length ? (
              selectedOptions.map((selected) => (
                <span key={`${inputId}-${selected.value}`} className="neris-selected-pill">
                  {getNerisGroupedSelectedLabel(selected, variant)}
                </span>
              ))
            ) : (
              <span
                className={
                  placeholder && placeholder.length > 0 ? "neris-incident-type-placeholder" : undefined
                }
              >
                {placeholder ?? "Select one or more options"}
              </span>
            )}
          </div>
        )}
        <ChevronDown
          size={15}
          className={`neris-incident-type-trigger-icon${isOpen ? " open" : ""}`}
        />
      </button>

      {isOpen && !disabled ? (
        <div className="neris-incident-type-select-panel">
          <div className="neris-incident-type-search-row">
            <Search size={14} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              placeholder={searchPlaceholder ?? "Search options..."}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm ? (
              <button
                type="button"
                className="neris-incident-type-search-clear"
                onClick={() => setSearchTerm("")}
              >
                Clear
              </button>
            ) : null}
          </div>

          {mode === "multi" && typeof maxSelections === "number" ? (
            <p
              className={`neris-incident-type-selection-limit${
                selectionLimitReached ? " reached" : ""
              }`}
            >
              Selected {selectedValueSet.size} of {maxSelections} allowed.
            </p>
          ) : null}

          <div className="neris-incident-type-options-scroll" role="listbox">
            {groupedOptions.length ? (
              groupedOptions.map((category) => {
                const categoryCollapsed =
                  normalizedSearch.length === 0 && collapsedCategories[category.categoryKey] !== false;
                return (
                  <section key={category.categoryKey} className="neris-incident-type-group">
                    <button
                      type="button"
                      className="neris-incident-type-group-button"
                      onClick={() => handleToggleCategory(category.categoryKey)}
                    >
                      {categoryCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span>{category.categoryLabel}</span>
                      <strong>{category.optionCount}</strong>
                    </button>

                    {!categoryCollapsed ? (
                      <>
                        {category.directOptions.length ? (
                          <div className="neris-incident-type-item-list">
                            {category.directOptions.map(({ option, leafLabel }) => {
                              const isSelected =
                                mode === "single"
                                  ? option.value === normalizedSelectedValue
                                  : selectedValueSet.has(option.value);
                              const isDisabled =
                                mode === "multi" &&
                                typeof maxSelections === "number" &&
                                selectedValueSet.size >= maxSelections &&
                                !isSelected;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  className={`neris-incident-type-item neris-incident-type-item-main${
                                    isSelected ? " selected" : ""
                                  }${isDisabled ? " disabled" : ""}`}
                                  aria-selected={isSelected}
                                  aria-disabled={isDisabled}
                                  onClick={() => {
                                    if (isDisabled) {
                                      return;
                                    }
                                    if (mode === "single") {
                                      onChange(option.value);
                                      setIsOpen(false);
                                      setSearchTerm("");
                                      return;
                                    }
                                    const nextSelected = new Set(selectedValueSet);
                                    if (nextSelected.has(option.value)) {
                                      nextSelected.delete(option.value);
                                    } else {
                                      nextSelected.add(option.value);
                                    }
                                    const nextOrderedValues = options
                                      .map((entry) => entry.value)
                                      .filter((entryValue) => nextSelected.has(entryValue));
                                    onChange(nextOrderedValues.join(","));
                                  }}
                                >
                                  {showCheckboxes ? (
                                    <span className="neris-incident-type-item-checkbox">
                                      <input
                                        type="checkbox"
                                        tabIndex={-1}
                                        readOnly
                                        checked={isSelected}
                                      />
                                    </span>
                                  ) : null}
                                  <span>{leafLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                        {category.subgroups.map((subgroup) => {
                          const subgroupCollapseKey = `${category.categoryKey}::${subgroup.subgroupKey}`;
                          const subgroupCollapsed =
                            normalizedSearch.length === 0 &&
                            Boolean(collapsedSubgroups[subgroupCollapseKey]);
                          return (
                            <div
                              key={subgroupCollapseKey}
                              className="neris-incident-type-subgroup-container"
                            >
                              <button
                                type="button"
                                className="neris-incident-type-subgroup-button"
                                onClick={() =>
                                  handleToggleSubgroup(category.categoryKey, subgroup.subgroupKey)
                                }
                              >
                                {subgroupCollapsed ? (
                                  <ChevronRight size={13} />
                                ) : (
                                  <ChevronDown size={13} />
                                )}
                                <span>{subgroup.subgroupLabel}</span>
                              </button>
                              {!subgroupCollapsed ? (
                                <div className="neris-incident-type-item-list">
                                  {subgroup.options.map(({ option, leafLabel }) => {
                                    const isSelected =
                                      mode === "single"
                                        ? option.value === normalizedSelectedValue
                                        : selectedValueSet.has(option.value);
                                    const isDisabled =
                                      mode === "multi" &&
                                      typeof maxSelections === "number" &&
                                      selectedValueSet.size >= maxSelections &&
                                      !isSelected;
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        className={`neris-incident-type-item${
                                          isSelected ? " selected" : ""
                                        }${isDisabled ? " disabled" : ""}`}
                                        aria-selected={isSelected}
                                        aria-disabled={isDisabled}
                                        onClick={() => {
                                          if (isDisabled) {
                                            return;
                                          }
                                          if (mode === "single") {
                                            onChange(option.value);
                                            setIsOpen(false);
                                            setSearchTerm("");
                                            return;
                                          }
                                          const nextSelected = new Set(selectedValueSet);
                                          if (nextSelected.has(option.value)) {
                                            nextSelected.delete(option.value);
                                          } else {
                                            nextSelected.add(option.value);
                                          }
                                          const nextOrderedValues = options
                                            .map((entry) => entry.value)
                                            .filter((entryValue) => nextSelected.has(entryValue));
                                          onChange(nextOrderedValues.join(","));
                                        }}
                                      >
                                        {showCheckboxes ? (
                                          <span className="neris-incident-type-item-checkbox">
                                            <input type="checkbox" tabIndex={-1} readOnly checked={isSelected} />
                                          </span>
                                        ) : null}
                                        <span>{leafLabel}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </>
                    ) : null}
                  </section>
                );
              })
            ) : (
              <p className="neris-incident-type-empty">No options match your search.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface NerisFlatMultiOptionSelectProps {
  inputId: string;
  value: string;
  options: NerisValueOption[];
  onChange: (nextValue: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  maxSelections?: number;
  usePortal?: boolean;
  disabled?: boolean;
}

function NerisFlatMultiOptionSelect({
  inputId,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  maxSelections,
  usePortal = false,
  disabled = false,
}: NerisFlatMultiOptionSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const selectedValues = Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => normalizeNerisEnumValue(entry)),
    ),
  );
  const selectedValueSet = new Set<string>(selectedValues);
  const selectionLimitReached =
    typeof maxSelections === "number" && maxSelections > 0 && selectedValueSet.size >= maxSelections;
  const selectedOptions = selectedValues
    .map((selectedValue) => options.find((option) => option.value === selectedValue))
    .filter((option): option is NerisValueOption => Boolean(option));
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(normalizedSearch) ||
          option.value.toLowerCase().includes(normalizedSearch),
      )
    : options;

  useLayoutEffect(() => {
    if (!isOpen || !usePortal || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const maxPanelHeight = Math.min(480, Math.max(280, spaceBelow));
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: `${maxPanelHeight}px`,
      zIndex: 100000,
    });
  }, [isOpen, usePortal]);

  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inPanel = panelRef.current?.contains(target);
      if (!inContainer && !inPanel) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, disabled]);

  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }
    searchInputRef.current?.focus();
  }, [isOpen, disabled]);

  return (
    <div className="neris-incident-type-select" ref={containerRef}>
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        className={`neris-incident-type-select-trigger${disabled ? " disabled" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((previous) => !previous);
          if (isOpen) {
            setSearchTerm("");
          }
        }}
      >
        <div className="neris-selected-pill-row">
          {selectedOptions.length ? (
            selectedOptions.map((selected) => (
              <span key={`${inputId}-${selected.value}`} className="neris-selected-pill">
                {selected.label}
              </span>
            ))
          ) : (
            <span
              className={
                placeholder && placeholder.length > 0 ? "neris-incident-type-placeholder" : undefined
              }
            >
              {placeholder ?? "Select one or more options"}
            </span>
          )}
        </div>
        <ChevronDown
          size={15}
          className={`neris-incident-type-trigger-icon${isOpen ? " open" : ""}`}
        />
      </button>

      {isOpen && !disabled ? (
        usePortal ? (
          createPortal(
            <div
              ref={panelRef}
              className="neris-incident-type-select-panel neris-incident-type-select-panel-portal"
              style={panelStyle}
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="neris-incident-type-search-row">
                <Search size={14} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  placeholder={searchPlaceholder ?? "Search options..."}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                {searchTerm ? (
                  <button
                    type="button"
                    className="neris-incident-type-search-clear"
                    onClick={() => setSearchTerm("")}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {typeof maxSelections === "number" ? (
                <p
                  className={`neris-incident-type-selection-limit${
                    selectionLimitReached ? " reached" : ""
                  }`}
                >
                  Selected {selectedValueSet.size} of {maxSelections} allowed.
                </p>
              ) : null}
              <div className="neris-incident-type-options-scroll" role="listbox" onWheel={(e) => e.stopPropagation()}>
            {filteredOptions.length ? (
              <div className="neris-incident-type-item-list">
                {filteredOptions.map((option) => {
                  const isSelected = selectedValueSet.has(option.value);
                  const isDisabled =
                    selectionLimitReached && !isSelected;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`neris-incident-type-item${isSelected ? " selected" : ""}${isDisabled ? " disabled" : ""}`}
                      aria-selected={isSelected}
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        const nextSelected = new Set(selectedValueSet);
                        if (nextSelected.has(option.value)) {
                          nextSelected.delete(option.value);
                        } else {
                          nextSelected.add(option.value);
                        }
                        const nextOrderedValues = options
                          .map((entry) => entry.value)
                          .filter((entryValue) => nextSelected.has(entryValue));
                        onChange(nextOrderedValues.join(","));
                      }}
                    >
                      <span className="neris-incident-type-item-checkbox">
                        <input type="checkbox" tabIndex={-1} readOnly checked={isSelected} />
                      </span>
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="neris-incident-type-empty">No options match your search.</p>
            )}
          </div>
            </div>,
            document.body,
          )
        ) : (
        <div className="neris-incident-type-select-panel">
          <div className="neris-incident-type-search-row">
            <Search size={14} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              placeholder={searchPlaceholder ?? "Search options..."}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm ? (
              <button
                type="button"
                className="neris-incident-type-search-clear"
                onClick={() => setSearchTerm("")}
              >
                Clear
              </button>
            ) : null}
          </div>
          {typeof maxSelections === "number" ? (
            <p
              className={`neris-incident-type-selection-limit${
                selectionLimitReached ? " reached" : ""
              }`}
            >
              Selected {selectedValueSet.size} of {maxSelections} allowed.
            </p>
          ) : null}
          <div className="neris-incident-type-options-scroll" role="listbox" onWheel={(e) => e.stopPropagation()}>
            {filteredOptions.length ? (
              <div className="neris-incident-type-item-list">
                {filteredOptions.map((option) => {
                  const isSelected = selectedValueSet.has(option.value);
                  const isDisabled =
                    selectionLimitReached && !isSelected;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`neris-incident-type-item${isSelected ? " selected" : ""}${isDisabled ? " disabled" : ""}`}
                      aria-selected={isSelected}
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        const nextSelected = new Set(selectedValueSet);
                        if (nextSelected.has(option.value)) {
                          nextSelected.delete(option.value);
                        } else {
                          nextSelected.add(option.value);
                        }
                        const nextOrderedValues = options
                          .map((entry) => entry.value)
                          .filter((entryValue) => nextSelected.has(entryValue));
                        onChange(nextOrderedValues.join(","));
                      }}
                    >
                      <span className="neris-incident-type-item-checkbox">
                        <input type="checkbox" tabIndex={-1} readOnly checked={isSelected} />
                      </span>
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="neris-incident-type-empty">No options match your search.</p>
            )}
          </div>
        </div>
        )
      ) : null}
    </div>
  );
}

interface NerisFlatSingleOptionSelectProps {
  inputId: string;
  value: string;
  options: NerisValueOption[];
  onChange: (nextValue: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  usePortal?: boolean;
  disabled?: boolean;
  isOptionDisabled?: (optionValue: string) => boolean;
  allowClear?: boolean;
}

function NerisFlatSingleOptionSelect({
  inputId,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  usePortal = false,
  disabled = false,
  isOptionDisabled,
  allowClear = false,
}: NerisFlatSingleOptionSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const normalizedValue = normalizeNerisEnumValue(value);
  const selectedOption = options.find((option) => option.value === normalizedValue);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(normalizedSearch) ||
          option.value.toLowerCase().includes(normalizedSearch),
      )
    : options;

  useLayoutEffect(() => {
    if (!isOpen || !usePortal || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const maxPanelHeight = Math.min(480, Math.max(280, spaceBelow));
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: `${maxPanelHeight}px`,
      zIndex: 100000,
    });
  }, [isOpen, usePortal]);

  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inPanel = panelRef.current?.contains(target);
      if (!inContainer && !inPanel) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, disabled]);

  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }
    searchInputRef.current?.focus();
  }, [isOpen, disabled]);

  return (
    <div className="neris-incident-type-select" ref={containerRef}>
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        className={`neris-incident-type-select-trigger${disabled ? " disabled" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((previous) => !previous);
          if (isOpen) {
            setSearchTerm("");
          }
        }}
      >
        <div className="neris-selected-pill-row">
          {selectedOption ? (
            <span className="neris-selected-pill">{selectedOption.label}</span>
          ) : (
            <span
              className={
                placeholder && placeholder.length > 0 ? "neris-incident-type-placeholder" : undefined
              }
            >
              {placeholder ?? "Select an option"}
            </span>
          )}
        </div>
        <ChevronDown
          size={15}
          className={`neris-incident-type-trigger-icon${isOpen ? " open" : ""}`}
        />
      </button>

      {isOpen && !disabled ? (
        usePortal ? (
          createPortal(
            <div
              ref={panelRef}
              className="neris-incident-type-select-panel"
              style={panelStyle}
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="neris-incident-type-search-row">
                <Search size={14} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  placeholder={searchPlaceholder ?? "Search options..."}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                {searchTerm ? (
                  <button
                    type="button"
                    className="neris-incident-type-search-clear"
                    onClick={() => setSearchTerm("")}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {allowClear && normalizedValue ? (
                <div className="neris-single-select-clear-row">
                  <button
                    type="button"
                    className="neris-incident-type-search-clear"
                    onClick={() => {
                      onChange("");
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}
              <div className="neris-incident-type-options-scroll" role="listbox" onWheel={(e) => e.stopPropagation()}>
                {filteredOptions.length ? (
                  <div className="neris-incident-type-item-list">
                    {filteredOptions.map((option) => {
                      const isSelected = option.value === normalizedValue;
                      const optionDisabled = Boolean(isOptionDisabled?.(option.value));
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`neris-incident-type-item${isSelected ? " selected" : ""}${
                            optionDisabled ? " disabled" : ""
                          }`}
                          aria-selected={isSelected}
                          aria-disabled={optionDisabled}
                          onClick={() => {
                            if (optionDisabled) return;
                            onChange(option.value);
                            setIsOpen(false);
                            setSearchTerm("");
                          }}
                        >
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="neris-incident-type-empty">No options match your search.</p>
                )}
              </div>
            </div>,
            document.body,
          )
        ) : (
        <div className="neris-incident-type-select-panel">
          <div className="neris-incident-type-search-row">
            <Search size={14} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              placeholder={searchPlaceholder ?? "Search options..."}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm ? (
              <button
                type="button"
                className="neris-incident-type-search-clear"
                onClick={() => setSearchTerm("")}
              >
                Clear
              </button>
            ) : null}
          </div>
          {allowClear && normalizedValue ? (
            <div className="neris-single-select-clear-row">
              <button
                type="button"
                className="neris-incident-type-search-clear"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                Clear selection
              </button>
            </div>
          ) : null}
          <div className="neris-incident-type-options-scroll" role="listbox" onWheel={(e) => e.stopPropagation()}>
            {filteredOptions.length ? (
              <div className="neris-incident-type-item-list">
                {filteredOptions.map((option) => {
                  const isSelected = option.value === normalizedValue;
                  const optionDisabled = Boolean(isOptionDisabled?.(option.value));
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`neris-incident-type-item${isSelected ? " selected" : ""}${
                        optionDisabled ? " disabled" : ""
                      }`}
                      aria-selected={isSelected}
                      aria-disabled={optionDisabled}
                      onClick={() => {
                        if (optionDisabled) {
                          return;
                        }
                        onChange(option.value);
                        setIsOpen(false);
                        setSearchTerm("");
                      }}
                    >
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="neris-incident-type-empty">No options match your search.</p>
            )}
          </div>
        </div>
        )
      ) : null}
    </div>
  );
}

interface AidEntry {
  aidDirection: string;
  aidType: string;
  aidDepartment: string;
}

interface ValidationModalState {
  mode: "issues" | "checkSuccess" | "adminConfirm" | "adminSuccess";
  issues: string[];
}

const EMPTY_AID_ENTRY: AidEntry = {
  aidDirection: "",
  aidType: "",
  aidDepartment: "",
};

function NerisReportFormPage({
  callNumber,
  role,
  username,
  nerisExportSettings,
}: NerisReportFormPageProps) {
  const navigate = useNavigate();
  const detail = getIncidentCallDetail(callNumber);
  const detailForSideEffects = detail ?? {
    callNumber,
    incidentType: "",
    address: "",
    receivedAt: "",
    assignedUnits: "",
  };
  const persistedDraft = useMemo(() => readNerisDraft(callNumber), [callNumber]);
  const defaultFormValues = useMemo(
    () =>
      createDefaultNerisFormValues({
        callNumber,
        incidentType: detail?.incidentType,
        receivedAt: detail?.receivedAt,
        address: detail?.address,
      }),
    [callNumber, detail?.incidentType, detail?.receivedAt, detail?.address],
  );
  const [activeSectionId, setActiveSectionId] = useState<NerisSectionId>("core");
  const [reportStatus, setReportStatus] = useState<string>(() =>
    persistedDraft?.reportStatus ?? "Draft",
  );
  const [formValues, setFormValues] = useState<NerisFormValues>(() => ({
    ...defaultFormValues,
    ...(persistedDraft?.formValues ?? {}),
  }));
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [validationModal, setValidationModal] = useState<ValidationModalState | null>(
    null,
  );
  const [validatorName, setValidatorName] = useState<string>(() => username.trim());
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>(
    () => persistedDraft?.lastSavedAt ?? "Not saved",
  );
  const [additionalAidEntries, setAdditionalAidEntries] = useState<AidEntry[]>(() =>
    (persistedDraft?.additionalAidEntries ?? []).map((entry) => ({
      aidDirection: entry.aidDirection,
      aidType: entry.aidType,
      aidDepartment: entry.aidDepartment,
    })),
  );
  const [showDirectionOfTravelField, setShowDirectionOfTravelField] = useState<boolean>(
    () =>
      (persistedDraft?.formValues.location_direction_of_travel ?? "").trim().length >
      0,
  );
  const [showCrossStreetTypeField, setShowCrossStreetTypeField] = useState<boolean>(
    () =>
      (persistedDraft?.formValues.location_cross_street_type ?? "").trim().length >
      0,
  );
  const locationStateOptionValues = useMemo(
    () => new Set(getNerisValueOptions("state").map((option) => option.value)),
    [],
  );
  const locationCountryOptionValues = useMemo(
    () => new Set(getNerisValueOptions("country").map((option) => option.value)),
    [],
  );
  const responseModeOptions = useMemo(() => getNerisValueOptions("response_mode"), []);
  const unitTypeOptions = useMemo(() => getNerisValueOptions("unit_type"), []);
  const resourceFallbackDate = (formValues.incident_onset_date ?? "").trim() || "2026-02-18";
  const availableResourceUnitOptions = useMemo(() => {
    if (!detail) {
      return [] as NerisValueOption[];
    }

    const units = dedupeAndCleanStrings([
      ...detail.apparatus.map((apparatus) => apparatus.unit),
      ...parseAssignedUnits(detail.assignedUnits),
    ]);
    return units.map((unitId) => ({
      value: unitId,
      label: unitId,
    }));
  }, [detail]);
  const apparatusByResourceUnitId = useMemo(() => {
    const map = new Map<string, { unitType: string }>();
    if (!detail) {
      return map;
    }
    for (const apparatus of detail.apparatus) {
      map.set(apparatus.unit, {
        unitType: apparatus.unitType,
      });
    }
    return map;
  }, [detail]);
  const defaultResourceUnits = useMemo<ResourceUnitEntry[]>(() => {
    if (!availableResourceUnitOptions.length) {
      return [];
    }

    return availableResourceUnitOptions.map((option, index) => {
      const source = apparatusByResourceUnitId.get(option.value);
      return {
        id: `resource-${index}-${option.value.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
        unitId: option.value,
        unitType: inferResourceUnitTypeValue(option.value, source?.unitType, unitTypeOptions),
        staffing: getStaffingValueForUnit(option.value, ""),
        responseMode: "",
        dispatchTime: toResourceDateTimeInputValue(detail?.receivedAt ?? "", resourceFallbackDate),
        enrouteTime: "",
        onSceneTime: "",
        clearTime: "",
        isCanceledEnroute: false,
        isComplete: false,
        isExpanded: index === 0,
        showTimesEditor: false,
        personnel: "",
        showPersonnelSelector: false,
        reportWriter: "",
        unitNarrative: "",
      };
    });
  }, [
    availableResourceUnitOptions,
    apparatusByResourceUnitId,
    unitTypeOptions,
    detail?.receivedAt,
    resourceFallbackDate,
  ]);
  const persistedResourceUnits = useMemo<ResourceUnitEntry[]>(() => {
    const rawValue = persistedDraft?.formValues.resource_units_json;
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue) as Array<Partial<ResourceUnitEntry>>;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((item, index) => {
        const unitId = item.unitId?.trim() ?? "";
        const personnel = item.personnel?.trim() ?? "";
        const normalizedUnitType =
          item.unitType?.trim() ??
          inferResourceUnitTypeValue(unitId, undefined, unitTypeOptions);
        return {
          id:
            item.id?.trim() ||
            `resource-persisted-${index}-${unitId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
          unitId,
          unitType: normalizedUnitType,
          staffing: getStaffingValueForUnit(unitId, personnel),
          responseMode: item.responseMode?.trim() ?? "",
          dispatchTime: toResourceDateTimeInputValue(
            item.dispatchTime?.trim() ?? detail?.receivedAt ?? "",
            resourceFallbackDate,
          ),
          enrouteTime: toResourceDateTimeInputValue(
            item.enrouteTime?.trim() ?? "",
            resourceFallbackDate,
          ),
          onSceneTime: toResourceDateTimeInputValue(
            item.onSceneTime?.trim() ?? "",
            resourceFallbackDate,
          ),
          clearTime: toResourceDateTimeInputValue(item.clearTime?.trim() ?? "", resourceFallbackDate),
          isCanceledEnroute: Boolean(item.isCanceledEnroute),
          isComplete: Boolean(item.isComplete),
          isExpanded: Boolean(item.isExpanded),
          showTimesEditor: Boolean(item.showTimesEditor),
          personnel,
          showPersonnelSelector: Boolean(item.showPersonnelSelector),
          reportWriter: item.reportWriter?.trim() ?? "",
          unitNarrative: item.unitNarrative ?? "",
        };
      });
    } catch {
      return [];
    }
  }, [
    persistedDraft?.formValues.resource_units_json,
    detail?.receivedAt,
    unitTypeOptions,
    resourceFallbackDate,
  ]);
  const [resourceUnits, setResourceUnits] = useState<ResourceUnitEntry[]>(
    () => (persistedResourceUnits.length ? persistedResourceUnits : defaultResourceUnits),
  );
  const [emergingElectrocutionItems, setEmergingElectrocutionItems] = useState<
    EmergingElectrocutionItem[]
  >(() => {
    const stored = persistedDraft?.formValues.emerging_haz_electrocution_items_json;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Array<{
          electricalHazardType?: string;
          suppressionMethods?: string;
        }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item) => ({
            id: nextEmergingHazardItemId("electrocution"),
            electricalHazardType: item.electricalHazardType?.trim() ?? "",
            suppressionMethods: item.suppressionMethods?.trim() ?? "",
          }));
        }
      } catch {
        // Ignore malformed persisted values and fall back to legacy fields.
      }
    }

    const legacyElectricalHazardType =
      persistedDraft?.formValues.emerg_haz_electric_type?.trim() ?? "";
    const legacySuppressionMethods =
      persistedDraft?.formValues.emerg_haz_suppression_methods?.trim() ?? "";
    if (legacyElectricalHazardType || legacySuppressionMethods) {
      return [
        {
          id: nextEmergingHazardItemId("electrocution"),
          electricalHazardType: legacyElectricalHazardType,
          suppressionMethods: legacySuppressionMethods,
        },
      ];
    }

    return [];
  });
  const [emergingPowerGenerationItems, setEmergingPowerGenerationItems] = useState<
    EmergingPowerGenerationItem[]
  >(() => {
    const stored = persistedDraft?.formValues.emerging_haz_power_generation_items_json;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Array<{
          photovoltaicHazardType?: string;
          pvSourceTarget?: string;
          suppressionMethods?: string;
        }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item) => ({
            id: nextEmergingHazardItemId("power-generation"),
            photovoltaicHazardType: item.photovoltaicHazardType?.trim() ?? "",
            pvSourceTarget: item.pvSourceTarget?.trim() ?? "",
            suppressionMethods: item.suppressionMethods?.trim() ?? "",
          }));
        }
      } catch {
        // Ignore malformed persisted values and fall back to legacy fields.
      }
    }

    const legacyPvHazardType = persistedDraft?.formValues.emerg_haz_pv_type?.trim() ?? "";
    const legacyPvSourceTarget =
      persistedDraft?.formValues.emerg_haz_pv_source_target?.trim() ?? "";
    const legacySuppressionMethods =
      persistedDraft?.formValues.emerg_haz_suppression_methods?.trim() ?? "";
    if (legacyPvHazardType || legacyPvSourceTarget || legacySuppressionMethods) {
      return [
        {
          id: nextEmergingHazardItemId("power-generation"),
          photovoltaicHazardType: legacyPvHazardType,
          pvSourceTarget: legacyPvSourceTarget,
          suppressionMethods: legacySuppressionMethods,
        },
      ];
    }

    return [];
  });
  const pvSourceTargetOptions = useMemo(
    () =>
      getNerisValueOptions("source_target").filter((option) =>
        ["SOURCE", "TARGET", "UNKNOWN"].includes(option.value),
      ),
    [],
  );
  const [riskReductionSuppressionSystems, setRiskReductionSuppressionSystems] = useState<
    FireSuppressionSystemEntry[]
  >(() => {
    const stored = persistedDraft?.formValues.risk_reduction_fire_suppression_systems_json;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Array<{
          suppressionType?: string;
          suppressionCoverage?: string;
        }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item) => ({
            id: nextRiskReductionSuppressionId(),
            suppressionType: item.suppressionType?.trim() ?? "",
            suppressionCoverage: item.suppressionCoverage?.trim() ?? "",
          }));
        }
      } catch {
        // Ignore malformed persisted values and fall back to legacy fields.
      }
    }

    const legacySuppressionType = persistedDraft?.formValues.fire_suppression_types?.trim() ?? "";
    const legacySuppressionCoverage =
      persistedDraft?.formValues.fire_suppression_operation?.trim() ?? "";
    if (legacySuppressionType || legacySuppressionCoverage) {
      return [
        {
          id: nextRiskReductionSuppressionId(),
          suppressionType: legacySuppressionType,
          suppressionCoverage: legacySuppressionCoverage,
        },
      ];
    }

    return [];
  });
  const riskReductionCompletedValue = (formValues.risk_reduction_completed ?? "").trim();
  const riskReductionFollowUpValue = (formValues.risk_reduction_follow_up_required ?? "").trim();
  const riskReductionContactMadeValue = (formValues.risk_reduction_contacts_made ?? "").trim();
  const riskReductionSmokeAlarmPresentValue = (
    formValues.risk_reduction_smoke_alarm_present ?? ""
  ).trim();
  const riskReductionSmokeAlarmWorkingValue = (
    formValues.risk_reduction_smoke_alarm_working ?? ""
  ).trim();
  const riskReductionFireAlarmPresentValue = (
    formValues.risk_reduction_fire_alarm_present ?? ""
  ).trim();
  const riskReductionOtherAlarmPresentValue = (
    formValues.risk_reduction_other_alarm_present ?? ""
  ).trim();
  const riskReductionFireSuppressionPresentValue = (
    formValues.risk_reduction_fire_suppression_present ?? ""
  ).trim();
  const riskReductionCookingSuppressionPresentValue = (
    formValues.risk_reduction_cooking_suppression_present ?? ""
  ).trim();
  const [activeResourcePersonnelUnitId, setActiveResourcePersonnelUnitId] = useState<string | null>(
    null,
  );
  const activeResourcePersonnelUnit = useMemo(
    () =>
      activeResourcePersonnelUnitId
        ? resourceUnits.find((unit) => unit.id === activeResourcePersonnelUnitId) ?? null
        : null,
    [activeResourcePersonnelUnitId, resourceUnits],
  );

  useEffect(() => {
    if (persistedResourceUnits.length) {
      return;
    }
    setResourceUnits(defaultResourceUnits);
  }, [defaultResourceUnits, persistedResourceUnits.length]);

  useEffect(() => {
    if (activeResourcePersonnelUnitId && !activeResourcePersonnelUnit) {
      setActiveResourcePersonnelUnitId(null);
    }
  }, [activeResourcePersonnelUnitId, activeResourcePersonnelUnit]);

  useEffect(() => {
    const className = "resource-personnel-modal-open";
    if (activeResourcePersonnelUnitId) {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }
    return () => {
      document.body.classList.remove(className);
    };
  }, [activeResourcePersonnelUnitId]);

  useEffect(() => {
    const serializedElectrocutionItems = JSON.stringify(
      emergingElectrocutionItems.map((item) => ({
        electricalHazardType: item.electricalHazardType,
        suppressionMethods: item.suppressionMethods,
      })),
    );
    const serializedPowerGenerationItems = JSON.stringify(
      emergingPowerGenerationItems.map((item) => ({
        photovoltaicHazardType: item.photovoltaicHazardType,
        pvSourceTarget: item.pvSourceTarget,
        suppressionMethods: item.suppressionMethods,
      })),
    );
    const primaryElectrocutionItem = emergingElectrocutionItems[0];
    const primaryPowerGenerationItem = emergingPowerGenerationItems[0];
    const defaultSuppressionMethods =
      primaryElectrocutionItem?.suppressionMethods ||
      primaryPowerGenerationItem?.suppressionMethods ||
      "";

    setFormValues((previous) => {
      if (
        (previous.emerging_haz_electrocution_items_json ?? "") ===
          serializedElectrocutionItems &&
        (previous.emerging_haz_power_generation_items_json ?? "") ===
          serializedPowerGenerationItems &&
        (previous.emerg_haz_electric_type ?? "") ===
          (primaryElectrocutionItem?.electricalHazardType ?? "") &&
        (previous.emerg_haz_pv_type ?? "") ===
          (primaryPowerGenerationItem?.photovoltaicHazardType ?? "") &&
        (previous.emerg_haz_pv_source_target ?? "") ===
          (primaryPowerGenerationItem?.pvSourceTarget ?? "") &&
        (previous.emerg_haz_suppression_methods ?? "") === defaultSuppressionMethods
      ) {
        return previous;
      }

      return {
        ...previous,
        emerging_haz_electrocution_items_json: serializedElectrocutionItems,
        emerging_haz_power_generation_items_json: serializedPowerGenerationItems,
        emerg_haz_electric_type: primaryElectrocutionItem?.electricalHazardType ?? "",
        emerg_haz_pv_type: primaryPowerGenerationItem?.photovoltaicHazardType ?? "",
        emerg_haz_pv_source_target: primaryPowerGenerationItem?.pvSourceTarget ?? "",
        emerg_haz_suppression_methods: defaultSuppressionMethods,
      };
    });
  }, [emergingElectrocutionItems, emergingPowerGenerationItems]);

  useEffect(() => {
    const serializedSuppressionSystems = JSON.stringify(
      riskReductionSuppressionSystems.map((system) => ({
        suppressionType: system.suppressionType,
        suppressionCoverage: system.suppressionCoverage,
      })),
    );
    const primarySuppressionSystem = riskReductionSuppressionSystems[0];

    setFormValues((previous) => {
      if (
        (previous.risk_reduction_fire_suppression_systems_json ?? "") ===
          serializedSuppressionSystems &&
        (previous.fire_suppression_types ?? "") ===
          (primarySuppressionSystem?.suppressionType ?? "") &&
        (previous.fire_suppression_operation ?? "") ===
          (primarySuppressionSystem?.suppressionCoverage ?? "")
      ) {
        return previous;
      }

      return {
        ...previous,
        risk_reduction_fire_suppression_systems_json: serializedSuppressionSystems,
        fire_suppression_types: primarySuppressionSystem?.suppressionType ?? "",
        fire_suppression_operation: primarySuppressionSystem?.suppressionCoverage ?? "",
      };
    });
  }, [riskReductionSuppressionSystems]);

  const primaryIncidentCategory = useMemo(() => {
    const normalizedPrimaryIncidentType = normalizeNerisEnumValue(
      formValues.primary_incident_type ?? "",
    );
    return (
      normalizedPrimaryIncidentType
        .split("||")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)[0] ?? ""
    );
  }, [formValues.primary_incident_type]);
  const visibleNerisSections = useMemo(
    () =>
      NERIS_FORM_SECTIONS.filter((section) => {
        if (section.id === "fire") {
          return primaryIncidentCategory === "FIRE";
        }
        if (section.id === "medical") {
          return primaryIncidentCategory === "MEDICAL";
        }
        if (section.id === "hazards") {
          return (
            primaryIncidentCategory === "HAZSIT" || primaryIncidentCategory === "HAZMAT"
          );
        }
        return true;
      }),
    [primaryIncidentCategory],
  );
  const activeVisibleSectionId =
    visibleNerisSections.find((section) => section.id === activeSectionId)?.id ??
    visibleNerisSections[0]?.id ??
    "core";
  const currentSection =
    visibleNerisSections.find((section) => section.id === activeVisibleSectionId) ??
    visibleNerisSections[0] ??
    NERIS_FORM_SECTIONS[0]!;
  const sectionFields = useMemo(
    () => getNerisFieldsForSection(currentSection.id),
    [currentSection.id],
  );
  const displayedSectionFields = useMemo(() => {
    if (currentSection.id !== "location") {
      return sectionFields;
    }

    const locationFieldOrder = new Map<string, number>([
      ["location_state", 1],
      ["location_country", 2],
      ["location_postal_code", 3],
      ["location_county", 4],
      ["location_place_type", 5],
      ["location_use_primary", 6],
      ["location_use_secondary", 7],
      ["location_vacancy_cause", 8],
      ["location_direction_of_travel", 9],
      ["location_cross_street_type", 10],
      ["location_notes", 11],
    ]);

    return [...sectionFields].sort((left, right) => {
      const leftOrder = locationFieldOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = locationFieldOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
  }, [currentSection.id, sectionFields]);
  const allNerisFields = useMemo(
    () => NERIS_FORM_SECTIONS.flatMap((section) => getNerisFieldsForSection(section.id)),
    [],
  );
  const nerisFieldLabelById = useMemo(
    () =>
      Object.fromEntries(allNerisFields.map((field) => [field.id, field.label])) as Record<
        string,
        string
      >,
    [allNerisFields],
  );
  const nerisFieldSectionById = useMemo(
    () =>
      Object.fromEntries(
        allNerisFields.map((field) => [field.id, field.sectionId]),
      ) as Record<string, NerisSectionId>,
    [allNerisFields],
  );
  const nerisSectionLabelById = useMemo(
    () =>
      Object.fromEntries(
        NERIS_FORM_SECTIONS.map((section) => [section.id, section.label.toUpperCase()]),
      ) as Record<NerisSectionId, string>,
    [],
  );
  const sectionIndex = visibleNerisSections.findIndex(
    (section) => section.id === currentSection.id,
  );
  const hasNextSection =
    sectionIndex >= 0 && sectionIndex < visibleNerisSections.length - 1;
  const importedLocationAddress =
    (formValues.incident_location_address ?? "").trim() ||
    (formValues.dispatch_location_address ?? "").trim() ||
    detail?.address ||
    "No imported address available.";
  const parsedImportedLocation = useMemo(
    () =>
      parseImportedLocationValues(
        importedLocationAddress,
        locationStateOptionValues,
        locationCountryOptionValues,
      ),
    [
      importedLocationAddress,
      locationStateOptionValues,
      locationCountryOptionValues,
    ],
  );

  const updateFieldValue = (fieldId: string, value: string) => {
    const sanitizedValue =
      fieldId === "incident_displaced_number" ? value.replace(/[^\d]/g, "") : value;
    const shouldClearNoAction =
      fieldId === "incident_actions_taken" && sanitizedValue.trim().length > 0;
    const shouldClearActions =
      fieldId === "incident_noaction" && sanitizedValue.trim().length > 0;
    const shouldClearDisplacementCause =
      (fieldId === "incident_displaced_number" &&
        (sanitizedValue.trim().length === 0 ||
          Number.parseInt(sanitizedValue, 10) <= 0)) ||
      (fieldId === "incident_people_present" && sanitizedValue === "NO");
    const shouldClearAidFields =
      (fieldId === "incident_has_aid" && sanitizedValue === "NO") ||
      (fieldId === "incident_aid_agency_type" && sanitizedValue === "NON_FD_AID") ||
      (fieldId === "incident_aid_agency_type" && sanitizedValue === "FIRE_DEPARTMENT");
    setFormValues((previous) => {
      const nextValues: NerisFormValues = {
        ...previous,
        [fieldId]: sanitizedValue,
      };
      if (shouldClearNoAction) {
        nextValues.incident_noaction = "";
      }
      if (shouldClearActions) {
        nextValues.incident_actions_taken = "";
      }
      if (shouldClearDisplacementCause) {
        nextValues.incident_displaced_cause = "";
      }
      if (fieldId === "incident_people_present" && sanitizedValue === "NO") {
        nextValues.incident_displaced_number = "";
      }
      if (fieldId === "incident_has_aid" && sanitizedValue === "NO") {
        nextValues.incident_aid_agency_type = "";
        nextValues.incident_aid_direction = "";
        nextValues.incident_aid_type = "";
        nextValues.incident_aid_department_name = "";
        nextValues.incident_aid_nonfd = "";
      }
      if (fieldId === "incident_aid_agency_type" && sanitizedValue === "NON_FD_AID") {
        nextValues.incident_aid_direction = "";
        nextValues.incident_aid_type = "";
        nextValues.incident_aid_department_name = "";
      }
      if (fieldId === "incident_aid_agency_type" && sanitizedValue === "FIRE_DEPARTMENT") {
        nextValues.incident_aid_nonfd = "";
      }
      return nextValues;
    });

    if (
      (fieldId === "incident_has_aid" && sanitizedValue === "NO") ||
      (fieldId === "incident_aid_agency_type" && sanitizedValue === "NON_FD_AID") ||
      (fieldId === "incident_aid_direction" && sanitizedValue === "GIVEN")
    ) {
      setAdditionalAidEntries([]);
    }

    setSectionErrors((previous) => {
      const hasPrimaryError = Boolean(previous[fieldId]);
      const hasNoActionError = shouldClearNoAction && Boolean(previous.incident_noaction);
      const hasActionsError = shouldClearActions && Boolean(previous.incident_actions_taken);
      const hasDisplacementCauseError =
        shouldClearDisplacementCause && Boolean(previous.incident_displaced_cause);
      const hasDisplacementNumberError =
        fieldId === "incident_people_present" &&
        sanitizedValue === "NO" &&
        Boolean(previous.incident_displaced_number);
      const hasAidErrors =
        shouldClearAidFields &&
        (Boolean(previous.incident_aid_agency_type) ||
          Boolean(previous.incident_aid_direction) ||
          Boolean(previous.incident_aid_type) ||
          Boolean(previous.incident_aid_department_name) ||
          Boolean(previous.incident_aid_nonfd));
      if (
        !hasPrimaryError &&
        !hasNoActionError &&
        !hasActionsError &&
        !hasDisplacementCauseError &&
        !hasDisplacementNumberError &&
        !hasAidErrors
      ) {
        return previous;
      }
      const next = { ...previous };
      delete next[fieldId];
      if (shouldClearNoAction) {
        delete next.incident_noaction;
      }
      if (shouldClearActions) {
        delete next.incident_actions_taken;
      }
      if (shouldClearDisplacementCause) {
        delete next.incident_displaced_cause;
      }
      if (fieldId === "incident_people_present" && sanitizedValue === "NO") {
        delete next.incident_displaced_number;
      }
      if (shouldClearAidFields) {
        delete next.incident_aid_agency_type;
        delete next.incident_aid_direction;
        delete next.incident_aid_type;
        delete next.incident_aid_department_name;
        delete next.incident_aid_nonfd;
      }
      return next;
    });
    setSaveMessage("");
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    if (reportStatus !== "Draft") {
      setReportStatus("Draft");
    }
  };

  useEffect(() => {
    const locationUpdates: Record<string, string> = {};
    if (
      (formValues.location_state ?? "").trim().length === 0 &&
      parsedImportedLocation.locationState
    ) {
      locationUpdates.location_state = parsedImportedLocation.locationState;
    }
    if (
      (formValues.location_country ?? "").trim().length === 0 &&
      parsedImportedLocation.locationCountry
    ) {
      locationUpdates.location_country = parsedImportedLocation.locationCountry;
    }
    if (
      (formValues.location_postal_code ?? "").trim().length === 0 &&
      parsedImportedLocation.locationPostalCode
    ) {
      locationUpdates.location_postal_code = parsedImportedLocation.locationPostalCode;
    }
    if (
      (formValues.location_county ?? "").trim().length === 0 &&
      parsedImportedLocation.locationCounty
    ) {
      locationUpdates.location_county = parsedImportedLocation.locationCounty;
    }

    if (Object.keys(locationUpdates).length === 0) {
      return;
    }

    setFormValues((previous) => ({
      ...previous,
      ...locationUpdates,
    }));
  }, [
    formValues.location_state,
    formValues.location_country,
    formValues.location_postal_code,
    formValues.location_county,
    parsedImportedLocation.locationState,
    parsedImportedLocation.locationCountry,
    parsedImportedLocation.locationPostalCode,
    parsedImportedLocation.locationCounty,
  ]);

  const handlePullLocationFromImportedAddress = () => {
    const locationUpdates: Record<string, string> = {};
    if (
      parsedImportedLocation.locationState &&
      parsedImportedLocation.locationState !== (formValues.location_state ?? "")
    ) {
      locationUpdates.location_state = parsedImportedLocation.locationState;
    }
    if (
      parsedImportedLocation.locationCountry &&
      parsedImportedLocation.locationCountry !== (formValues.location_country ?? "")
    ) {
      locationUpdates.location_country = parsedImportedLocation.locationCountry;
    }
    if (
      parsedImportedLocation.locationPostalCode &&
      parsedImportedLocation.locationPostalCode !== (formValues.location_postal_code ?? "")
    ) {
      locationUpdates.location_postal_code = parsedImportedLocation.locationPostalCode;
    }
    if (
      parsedImportedLocation.locationCounty &&
      parsedImportedLocation.locationCounty !== (formValues.location_county ?? "")
    ) {
      locationUpdates.location_county = parsedImportedLocation.locationCounty;
    }

    if (Object.keys(locationUpdates).length === 0) {
      setSaveMessage(
        "No additional state, country, postal code, or county details were found to apply.",
      );
      setErrorMessage("");
      return;
    }

    setFormValues((previous) => ({
      ...previous,
      ...locationUpdates,
    }));
    setSectionErrors((previous) => {
      const next = { ...previous };
      delete next.location_state;
      delete next.location_country;
      delete next.location_postal_code;
      delete next.location_county;
      return next;
    });
    setSaveMessage("Location details pulled from imported address.");
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    if (reportStatus !== "Draft") {
      setReportStatus("Draft");
    }
  };

  const markNerisFormDirty = () => {
    setSaveMessage("");
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    if (reportStatus !== "Draft") {
      setReportStatus("Draft");
    }
  };

  const clearResourceUnitValidationErrors = (unitEntryId: string) => {
    const keyPrefix = `resource_unit_validation_${unitEntryId}_`;
    setSectionErrors((previous) => {
      let hasMatch = false;
      const next: Record<string, string> = {};
      Object.entries(previous).forEach(([key, value]) => {
        if (key.startsWith(keyPrefix)) {
          hasMatch = true;
          return;
        }
        next[key] = value;
      });
      return hasMatch ? next : previous;
    });
  };

  const toValidationIssueLabel = (
    fieldId: string,
    customIssueLabelsByFieldId: Record<string, string>,
  ): string => {
    const customLabel = customIssueLabelsByFieldId[fieldId];
    if (customLabel) {
      return customLabel;
    }
    const sectionId = nerisFieldSectionById[fieldId];
    const sectionLabel = sectionId ? nerisSectionLabelById[sectionId] : "UNKNOWN";
    return `${sectionLabel} - ${nerisFieldLabelById[fieldId] ?? fieldId}`;
  };

  const validateResourceUnit = (unitEntry: ResourceUnitEntry, unitIndex: number) => {
    const unitLabel = unitEntry.unitId.trim() || `Unit ${unitIndex + 1}`;
    const errors: Record<string, string> = {};
    const customIssueLabelsByFieldId: Record<string, string> = {};
    const addResourceError = (
      field: "personnel" | "dispatchTime" | "enrouteTime" | "onSceneTime" | "clearTime",
      fieldLabel: string,
      message: string,
    ) => {
      const errorKey = resourceUnitValidationErrorKey(unitEntry.id, field);
      errors[errorKey] = message;
      customIssueLabelsByFieldId[errorKey] = `Resources - ${unitLabel}: ${fieldLabel}`;
    };
    const addTimelineError = (
      entry: {
        key: string;
        label: string;
        customIssueLabel?: string;
      },
      message: string,
    ) => {
      errors[entry.key] = message;
      if (entry.customIssueLabel) {
        customIssueLabelsByFieldId[entry.key] = entry.customIssueLabel;
      }
    };

    if (countSelectedPersonnel(unitEntry.personnel) < 1) {
      addResourceError(
        "personnel",
        "Personnel",
        "At least one personnel member is required for each unit.",
      );
    }
    if (!unitEntry.dispatchTime.trim()) {
      addResourceError("dispatchTime", "Dispatch time", "Dispatch time is required.");
    }
    if (!unitEntry.clearTime.trim()) {
      addResourceError("clearTime", "Clear time", "Clear time is required.");
    }
    if (!unitEntry.isCanceledEnroute) {
      if (!unitEntry.enrouteTime.trim()) {
        addResourceError(
          "enrouteTime",
          "Enroute time",
          "Enroute time is required unless dispatched and canceled en route.",
        );
      }
      if (!unitEntry.onSceneTime.trim()) {
        addResourceError(
          "onSceneTime",
          "On Scene time",
          "On Scene time is required unless dispatched and canceled en route.",
        );
      }
    }

    const timelineEntries = [
      {
        key: "incident_time_call_create",
        label: "Call created time",
        value: formValues.incident_time_call_create ?? "",
      },
      {
        key: "incident_time_call_answered",
        label: "Call answered time",
        value: formValues.incident_time_call_answered ?? "",
      },
      {
        key: "incident_time_call_arrival",
        label: "Call arrival time",
        value: formValues.incident_time_call_arrival ?? "",
      },
      {
        key: resourceUnitValidationErrorKey(unitEntry.id, "dispatchTime"),
        label: "Unit dispatched time",
        customIssueLabel: `Resources - ${unitLabel}: Dispatch time`,
        value: unitEntry.dispatchTime,
      },
      {
        key: resourceUnitValidationErrorKey(unitEntry.id, "enrouteTime"),
        label: "Unit enroute time",
        customIssueLabel: `Resources - ${unitLabel}: Enroute time`,
        value: unitEntry.enrouteTime,
      },
      {
        key: resourceUnitValidationErrorKey(unitEntry.id, "onSceneTime"),
        label: "Unit on scene time",
        customIssueLabel: `Resources - ${unitLabel}: On Scene time`,
        value: unitEntry.onSceneTime,
      },
      {
        key: resourceUnitValidationErrorKey(unitEntry.id, "clearTime"),
        label: "Unit clear time",
        customIssueLabel: `Resources - ${unitLabel}: Clear time`,
        value: unitEntry.clearTime,
      },
      {
        key: "time_incident_clear",
        label: "Incident clear time",
        value: formValues.time_incident_clear ?? "",
      },
    ];

    let previousTimelineEntry: { label: string; timestamp: number } | null = null;
    timelineEntries.forEach((entry) => {
      const trimmedValue = entry.value.trim();
      if (!trimmedValue) {
        return;
      }
      const timestamp = toResourceDateTimeTimestamp(trimmedValue, resourceFallbackDate);
      if (timestamp === null) {
        addTimelineError(entry, `${entry.label} has an invalid date/time value.`);
        return;
      }
      if (previousTimelineEntry && timestamp < previousTimelineEntry.timestamp) {
        addTimelineError(
          entry,
          `${entry.label} cannot be earlier than ${previousTimelineEntry.label}.`,
        );
      }
      previousTimelineEntry = {
        label: entry.label,
        timestamp,
      };
    });

    return {
      errors,
      customIssueLabelsByFieldId,
    };
  };

  useEffect(() => {
    const primaryUnit = resourceUnits[0];
    const primaryUnitId = primaryUnit?.unitId ?? "";
    const primaryUnitType = primaryUnit?.unitType ?? "";
    const primaryUnitStaffing = primaryUnit
      ? getStaffingValueForUnit(primaryUnit.unitId, primaryUnit.personnel)
      : "";
    const primaryUnitResponseMode = primaryUnit?.responseMode ?? "";
    const additionalUnits = resourceUnits
      .slice(1)
      .map((unit) => unit.unitId.trim())
      .filter((unitId) => unitId.length > 0)
      .join(", ");
    const serializedResourceUnits = JSON.stringify(
      resourceUnits.map((unit) => ({
        id: unit.id,
        unitId: unit.unitId,
        unitType: unit.unitType,
        staffing: getStaffingValueForUnit(unit.unitId, unit.personnel),
        responseMode: unit.responseMode,
        dispatchTime: unit.dispatchTime,
        enrouteTime: unit.enrouteTime,
        onSceneTime: unit.onSceneTime,
        clearTime: unit.clearTime,
        isCanceledEnroute: unit.isCanceledEnroute,
        isComplete: unit.isComplete,
        isExpanded: unit.isExpanded,
        showTimesEditor: unit.showTimesEditor,
        personnel: unit.personnel,
        showPersonnelSelector: unit.showPersonnelSelector,
        reportWriter: unit.reportWriter,
        unitNarrative: unit.unitNarrative,
      })),
    );

    setFormValues((previous) => {
      if (
        (previous.resource_primary_unit_id ?? "") === primaryUnitId &&
        (previous.resource_primary_unit_type ?? "") === primaryUnitType &&
        (previous.resource_primary_unit_staffing ?? "") === primaryUnitStaffing &&
        (previous.resource_primary_unit_response_mode ?? "") === primaryUnitResponseMode &&
        (previous.resource_additional_units ?? "") === additionalUnits &&
        (previous.resource_units_json ?? "") === serializedResourceUnits
      ) {
        return previous;
      }

      return {
        ...previous,
        resource_primary_unit_id: primaryUnitId,
        resource_primary_unit_type: primaryUnitType,
        resource_primary_unit_staffing: primaryUnitStaffing,
        resource_primary_unit_response_mode: primaryUnitResponseMode,
        resource_additional_units: additionalUnits,
        resource_units_json: serializedResourceUnits,
      };
    });
  }, [resourceUnits]);

  const toggleResourceUnitExpanded = (unitEntryId: string) => {
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? {
              ...entry,
              isExpanded: !entry.isExpanded,
            }
          : entry,
      ),
    );
    markNerisFormDirty();
  };

  const toggleResourceUnitComplete = (unitEntryId: string) => {
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? {
              ...entry,
              isComplete: !entry.isComplete,
            }
          : entry,
      ),
    );
    markNerisFormDirty();
  };

  const deleteResourceUnit = (unitEntryId: string) => {
    setResourceUnits((previous) =>
      previous.filter((entry) => entry.id !== unitEntryId),
    );
    clearResourceUnitValidationErrors(unitEntryId);
    if (activeResourcePersonnelUnitId === unitEntryId) {
      setActiveResourcePersonnelUnitId(null);
    }
    markNerisFormDirty();
  };

  const updateResourceUnitField = (
    unitEntryId: string,
    field:
      | "unitId"
      | "unitType"
      | "staffing"
      | "responseMode"
      | "dispatchTime"
      | "enrouteTime"
      | "onSceneTime"
      | "clearTime"
      | "personnel"
      | "reportWriter"
      | "unitNarrative",
    value: string,
  ) => {
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? (() => {
              if (field === "personnel") {
                const nextStaffing = getStaffingValueForUnit(entry.unitId, value);
                return {
                  ...entry,
                  personnel: value,
                  staffing: nextStaffing,
                };
              }
              if (field === "dispatchTime") {
                const normalizedDispatch = toResourceDateTimeInputValue(value, resourceFallbackDate);
                const normalizedClear = toResourceDateTimeInputValue(
                  entry.clearTime,
                  resourceFallbackDate,
                );
                return {
                  ...entry,
                  dispatchTime: normalizedDispatch,
                  clearTime:
                    entry.isCanceledEnroute && !normalizedClear && normalizedDispatch
                      ? addMinutesToResourceDateTime(normalizedDispatch, 2)
                      : normalizedClear,
                };
              }
              if (
                field === "enrouteTime" ||
                field === "onSceneTime" ||
                field === "clearTime"
              ) {
                return {
                  ...entry,
                  [field]: toResourceDateTimeInputValue(value, resourceFallbackDate),
                };
              }
              return {
                ...entry,
                [field]: value,
              };
            })()
          : entry,
      ),
    );
    clearResourceUnitValidationErrors(unitEntryId);
    markNerisFormDirty();
  };

  const handleResourceUnitIdChange = (unitEntryId: string, nextUnitId: string) => {
    const source = apparatusByResourceUnitId.get(nextUnitId);
    const inferredUnitType = inferResourceUnitTypeValue(
      nextUnitId,
      source?.unitType,
      unitTypeOptions,
    );
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? {
              ...entry,
              unitId: nextUnitId,
              unitType: inferredUnitType || entry.unitType,
              staffing: getStaffingValueForUnit(nextUnitId, entry.personnel),
            }
          : entry,
      ),
    );
    clearResourceUnitValidationErrors(unitEntryId);
    markNerisFormDirty();
  };

  const openResourcePersonnelModal = (unitEntryId: string) => {
    setActiveResourcePersonnelUnitId(unitEntryId);
  };

  const closeResourcePersonnelModal = () => {
    setActiveResourcePersonnelUnitId(null);
  };

  const removeResourcePersonnel = (unitEntryId: string, personnelValue: string) => {
    setResourceUnits((previous) =>
      previous.map((entry) => {
        if (entry.id !== unitEntryId) {
          return entry;
        }

        const nextPersonnelValues = entry.personnel
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0 && value !== personnelValue);
        const nextPersonnelCsv = nextPersonnelValues.join(",");
        const nextStaffing = getStaffingValueForUnit(entry.unitId, nextPersonnelCsv);
        const nextReportWriter =
          entry.reportWriter === personnelValue ? "" : entry.reportWriter;

        return {
          ...entry,
          personnel: nextPersonnelCsv,
          staffing: nextStaffing,
          reportWriter: nextReportWriter,
        };
      }),
    );
    clearResourceUnitValidationErrors(unitEntryId);
    markNerisFormDirty();
  };

  const toggleResourceTimesEditor = (unitEntryId: string) => {
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? {
              ...entry,
              showTimesEditor: !entry.showTimesEditor,
            }
          : entry,
      ),
    );
    markNerisFormDirty();
  };

  const toggleResourceCanceledEnroute = (unitEntryId: string) => {
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? (() => {
              const nextCanceledEnroute = !entry.isCanceledEnroute;
              if (!nextCanceledEnroute) {
                return {
                  ...entry,
                  isCanceledEnroute: false,
                };
              }

              const normalizedDispatch = toResourceDateTimeInputValue(
                entry.dispatchTime,
                resourceFallbackDate,
              );
              const normalizedClear = toResourceDateTimeInputValue(
                entry.clearTime,
                resourceFallbackDate,
              );
              return {
                ...entry,
                isCanceledEnroute: true,
                dispatchTime: normalizedDispatch,
                clearTime:
                  normalizedClear || normalizedDispatch
                    ? normalizedClear || addMinutesToResourceDateTime(normalizedDispatch, 2)
                    : "",
              };
            })()
          : entry,
      ),
    );
    clearResourceUnitValidationErrors(unitEntryId);
    markNerisFormDirty();
  };

  const completeAndCollapseResourceUnit = (unitEntryId: string) => {
    const unitIndex = resourceUnits.findIndex((entry) => entry.id === unitEntryId);
    if (unitIndex < 0) {
      return;
    }
    const unitEntry = resourceUnits[unitIndex]!;
    const { errors, customIssueLabelsByFieldId } = validateResourceUnit(unitEntry, unitIndex);
    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      const unitErrorKeyPrefix = `resource_unit_validation_${unitEntryId}_`;
      setSectionErrors((previous) => {
        const next: Record<string, string> = {};
        Object.entries(previous).forEach(([key, value]) => {
          if (key.startsWith(unitErrorKeyPrefix)) {
            return;
          }
          next[key] = value;
        });
        return {
          ...next,
          ...errors,
        };
      });
      setValidationIssues(
        Array.from(
          new Set(
            Object.keys(errors).map((fieldId) =>
              toValidationIssueLabel(fieldId, customIssueLabelsByFieldId),
            ),
          ),
        ),
      );
      setValidationModal(null);
      setSaveMessage("");
      setErrorMessage(
        "Unit requirements are incomplete or out of sequence. Fix highlighted fields before completing.",
      );
      setResourceUnits((previous) =>
        previous.map((entry) =>
          entry.id === unitEntryId
            ? {
                ...entry,
                isExpanded: true,
                showTimesEditor: true,
                isComplete: false,
              }
            : entry,
        ),
      );
      return;
    }

    clearResourceUnitValidationErrors(unitEntryId);
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? {
              ...entry,
              isComplete: true,
              isExpanded: false,
              showTimesEditor: false,
            }
          : entry,
      ),
    );
    markNerisFormDirty();
  };

  const collapseResourceUnit = (unitEntryId: string) => {
    setResourceUnits((previous) =>
      previous.map((entry) =>
        entry.id === unitEntryId
          ? {
              ...entry,
              isExpanded: false,
              showTimesEditor: false,
            }
          : entry,
      ),
    );
    markNerisFormDirty();
  };

  const addEmergingElectrocutionItem = () => {
    setEmergingElectrocutionItems((previous) => [
      ...previous,
      {
        id: nextEmergingHazardItemId("electrocution"),
        electricalHazardType: "",
        suppressionMethods: "",
      },
    ]);
    markNerisFormDirty();
  };

  const updateEmergingElectrocutionItem = (
    itemId: string,
    field: "electricalHazardType" | "suppressionMethods",
    value: string,
  ) => {
    setEmergingElectrocutionItems((previous) =>
      previous.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
    markNerisFormDirty();
  };

  const deleteEmergingElectrocutionItem = (itemId: string) => {
    setEmergingElectrocutionItems((previous) =>
      previous.filter((item) => item.id !== itemId),
    );
    markNerisFormDirty();
  };

  const addEmergingPowerGenerationItem = () => {
    setEmergingPowerGenerationItems((previous) => [
      ...previous,
      {
        id: nextEmergingHazardItemId("power-generation"),
        photovoltaicHazardType: "",
        pvSourceTarget: "",
        suppressionMethods: "",
      },
    ]);
    markNerisFormDirty();
  };

  const updateEmergingPowerGenerationItem = (
    itemId: string,
    field: "photovoltaicHazardType" | "pvSourceTarget" | "suppressionMethods",
    value: string,
  ) => {
    setEmergingPowerGenerationItems((previous) =>
      previous.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
    markNerisFormDirty();
  };

  const deleteEmergingPowerGenerationItem = (itemId: string) => {
    setEmergingPowerGenerationItems((previous) =>
      previous.filter((item) => item.id !== itemId),
    );
    markNerisFormDirty();
  };

  const addRiskReductionSuppressionSystem = () => {
    setRiskReductionSuppressionSystems((previous) => [
      ...previous,
      {
        id: nextRiskReductionSuppressionId(),
        suppressionType: "",
        suppressionCoverage: "",
      },
    ]);
    markNerisFormDirty();
  };

  const updateRiskReductionSuppressionSystem = (
    systemId: string,
    field: "suppressionType" | "suppressionCoverage",
    value: string,
  ) => {
    setRiskReductionSuppressionSystems((previous) =>
      previous.map((system) =>
        system.id === systemId
          ? {
              ...system,
              [field]: value,
            }
          : system,
      ),
    );
    markNerisFormDirty();
  };

  const deleteRiskReductionSuppressionSystem = (systemId: string) => {
    setRiskReductionSuppressionSystems((previous) =>
      previous.filter((system) => system.id !== systemId),
    );
    markNerisFormDirty();
  };

  const stampSavedAt = (
    mode: "manual" | "auto",
    nextStatus: string = reportStatus,
    messageOverride?: string,
  ) => {
    const savedAt = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    writeNerisDraft(callNumber, {
      formValues,
      reportStatus: nextStatus,
      lastSavedAt: savedAt,
      additionalAidEntries: additionalAidEntries.map((entry) => ({
        aidDirection: entry.aidDirection,
        aidType: entry.aidType,
        aidDepartment: entry.aidDepartment,
      })),
    });
    setReportStatus(nextStatus);
    setLastSavedAt(savedAt);
    setSaveMessage(
      messageOverride ??
        (mode === "auto"
          ? `Draft auto-saved for ${detailForSideEffects.callNumber} at ${savedAt}.`
          : `Draft saved for ${detailForSideEffects.callNumber} at ${savedAt}.`),
    );
  };

  const buildValidationSnapshot = () => {
    const mergedErrors: Record<string, string> = {};
    const customIssueLabelsByFieldId: Record<string, string> = {};
    for (const section of NERIS_FORM_SECTIONS) {
      const validation = validateNerisSection(section.id, formValues);
      Object.assign(mergedErrors, validation.errors);
    }

    resourceUnits.forEach((unitEntry, unitIndex) => {
      const unitValidation = validateResourceUnit(unitEntry, unitIndex);
      Object.assign(mergedErrors, unitValidation.errors);
      Object.assign(customIssueLabelsByFieldId, unitValidation.customIssueLabelsByFieldId);
    });

    setSectionErrors(mergedErrors);
    const issueLabels = Array.from(
      new Set(
        Object.keys(mergedErrors).map((fieldId) =>
          toValidationIssueLabel(fieldId, customIssueLabelsByFieldId),
        ),
      ),
    );
    return {
      mergedErrors,
      issueLabels,
    };
  };

  const buildStoredAdditionalAidEntries = () =>
    additionalAidEntries.map((entry) => ({
      aidDirection: entry.aidDirection,
      aidType: entry.aidType,
      aidDepartment: entry.aidDepartment,
    }));

  const buildReportWriterName = () => {
    const rawReportWriter =
      resourceUnits
        .map((unit) => unit.reportWriter.trim())
        .find((candidate) => candidate.length > 0) ?? username.trim();
    if (!rawReportWriter) {
      return "";
    }
    if (!rawReportWriter.includes("_")) {
      return rawReportWriter;
    }
    return rawReportWriter
      .toLowerCase()
      .split("_")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  };

  const applyValidationFailure = (issueLabels: string[]) => {
    if (issueLabels.length === 0) {
      return;
    }
    const serializedAidEntries = buildStoredAdditionalAidEntries();
    writeNerisDraft(callNumber, {
      formValues,
      reportStatus: "Draft",
      lastSavedAt,
      additionalAidEntries: serializedAidEntries,
    });
    setReportStatus("Draft");
    setSaveMessage("");
    setErrorMessage(
      "Validation incomplete. Complete the required fields listed below.",
    );
    setValidationModal({
      mode: "issues",
      issues: issueLabels,
    });
  };

  const handleCheckForErrors = () => {
    const { mergedErrors, issueLabels } = buildValidationSnapshot();
    setSectionErrors(mergedErrors);
    setValidationIssues(issueLabels);

    if (issueLabels.length > 0) {
      applyValidationFailure(issueLabels);
      return;
    }

    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal({
      mode: "checkSuccess",
      issues: [],
    });
    stampSavedAt(
      "manual",
      "In Review",
      "Check for Errors passed. Status updated to In Review.",
    );
  };

  type ExportRequestConfig = {
    exportUrl: string;
    isProxyRequest: boolean;
    headers: Record<string, string>;
    payload: Record<string, unknown>;
  };

  type ExportExecutionResult = {
    exportedAtIso: string;
    exportedAtLabel: string;
    attemptStatus: "success" | "failed";
    httpStatus: number;
    httpStatusText: string;
    nerisId: string;
    submittedEntityId: string;
    submittedDepartmentNerisId: string;
    statusLabel: string;
    responseSummary: string;
    responseDetail: string;
    submittedPayloadPreview: string;
  };

  type ExportRequestError = Error & {
    httpStatus?: number;
    httpStatusText?: string;
    submittedEntityId?: string;
    submittedDepartmentNerisId?: string;
    responseSummary?: string;
    responseDetail?: string;
    submittedPayloadPreview?: string;
  };

  const toPrettyJson = (value: unknown): string => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  };

  const extractSubmittedDepartmentFromResponse = (
    responseJson: Record<string, unknown> | null,
  ): string => {
    if (
      responseJson?.submittedPayload &&
      typeof responseJson.submittedPayload === "object" &&
      (responseJson.submittedPayload as Record<string, unknown>).base &&
      typeof (responseJson.submittedPayload as Record<string, unknown>).base === "object" &&
      typeof (
        (responseJson.submittedPayload as Record<string, unknown>).base as Record<string, unknown>
      ).department_neris_id === "string"
    ) {
      return ((responseJson.submittedPayload as Record<string, unknown>).base as Record<
        string,
        unknown
      >).department_neris_id as string;
    }
    return (formValues.fd_neris_id ?? "").trim();
  };

  const extractExportResponseSummary = (
    response: Response,
    responseJson: Record<string, unknown> | null,
    responseText: string,
  ): string => {
    if (typeof responseJson?.message === "string" && responseJson.message.trim().length > 0) {
      return responseJson.message.trim();
    }
    const fallback =
      responseJson?.fallback && typeof responseJson.fallback === "object"
        ? (responseJson.fallback as Record<string, unknown>)
        : null;
    if (typeof fallback?.reason === "string" && fallback.reason.trim().length > 0) {
      const updateStatus =
        typeof fallback.updateStatus === "number" ? fallback.updateStatus : null;
      const updateStatusText =
        typeof fallback.updateStatusText === "string" ? fallback.updateStatusText : "";
      if (updateStatus !== null) {
        return `Fallback ${fallback.succeeded ? "succeeded" : "failed"} (${updateStatus} ${updateStatusText}). ${fallback.reason}`.trim();
      }
      return fallback.reason;
    }
    const detailFromNeris =
      responseJson?.neris && typeof responseJson.neris === "object"
        ? (responseJson.neris as Record<string, unknown>).detail
        : null;
    if (typeof detailFromNeris === "string" && detailFromNeris.trim().length > 0) {
      return detailFromNeris.trim();
    }
    if (Array.isArray(detailFromNeris) && detailFromNeris.length > 0) {
      return toPrettyJson(detailFromNeris);
    }
    if (responseText.trim().length > 0) {
      return responseText.slice(0, 280);
    }
    return `${response.status} ${response.statusText}`;
  };

  const createExportRequestError = (
    message: string,
    metadata: Omit<ExportExecutionResult, "exportedAtIso" | "exportedAtLabel" | "attemptStatus" | "nerisId" | "statusLabel"> & {
      httpStatus: number;
      httpStatusText: string;
    },
  ): ExportRequestError => {
    const error = new Error(message) as ExportRequestError;
    error.httpStatus = metadata.httpStatus;
    error.httpStatusText = metadata.httpStatusText;
    error.submittedEntityId = metadata.submittedEntityId;
    error.submittedDepartmentNerisId = metadata.submittedDepartmentNerisId;
    error.responseSummary = metadata.responseSummary;
    error.responseDetail = metadata.responseDetail;
    error.submittedPayloadPreview = metadata.submittedPayloadPreview;
    return error;
  };

  const getExistingIncidentNerisIdHint = () => {
    const fromForm = (formValues.incident_neris_id ?? "").trim();
    if (NERIS_INCIDENT_ID_PATTERN.test(fromForm)) {
      return fromForm;
    }
    const fromHistory = readNerisExportHistory().find(
      (entry) =>
        entry.callNumber === callNumber &&
        entry.attemptStatus === "success" &&
        NERIS_INCIDENT_ID_PATTERN.test(entry.nerisId),
    );
    return fromHistory?.nerisId ?? "";
  };

  const buildExportRequestConfig = (): ExportRequestConfig => {
    const defaultExportSettings = getDefaultNerisExportSettings();
    const exportUrl =
      nerisExportSettings.exportUrl.trim() ||
      String(import.meta.env.VITE_NERIS_EXPORT_URL ?? "").trim() ||
      defaultExportSettings.exportUrl;
    const vendorCode =
      nerisExportSettings.vendorCode.trim() ||
      String(import.meta.env.VITE_NERIS_VENDOR_CODE ?? "").trim();
    const secretKey =
      nerisExportSettings.secretKey.trim() ||
      String(import.meta.env.VITE_NERIS_SECRET_KEY ?? "").trim();
    const vendorHeaderName =
      nerisExportSettings.vendorHeaderName.trim() ||
      String(import.meta.env.VITE_NERIS_VENDOR_HEADER_NAME ?? "").trim() ||
      defaultExportSettings.vendorHeaderName;
    const authHeaderName =
      nerisExportSettings.authHeaderName.trim() ||
      String(import.meta.env.VITE_NERIS_AUTH_HEADER_NAME ?? "").trim() ||
      defaultExportSettings.authHeaderName;
    const authScheme =
      nerisExportSettings.authScheme.trim() ||
      String(import.meta.env.VITE_NERIS_AUTH_SCHEME ?? "").trim() ||
      defaultExportSettings.authScheme;
    const contentType =
      nerisExportSettings.contentType.trim() ||
      String(import.meta.env.VITE_NERIS_CONTENT_TYPE ?? "").trim() ||
      defaultExportSettings.contentType;
    const apiVersionHeaderName = nerisExportSettings.apiVersionHeaderName.trim();
    const apiVersionHeaderValue = nerisExportSettings.apiVersionHeaderValue.trim();
    const isProxyRequest = exportUrl.startsWith("/api/neris/");
    const existingIncidentNerisId = getExistingIncidentNerisIdHint();
    if (!exportUrl) {
      throw new Error(
        "Export is not configured. Add Export URL in Admin Functions > Customization > NERIS Export Configuration.",
      );
    }

    const payload = {
      callNumber: detailForSideEffects.callNumber,
      reportStatus,
      exportedAt: new Date().toISOString(),
      source: "Fire Ultimate Prototype",
      formValues,
      incidentSnapshot: {
        incidentType: detailForSideEffects.incidentType,
        address: detailForSideEffects.address,
        receivedAt: detailForSideEffects.receivedAt,
        assignedUnits: detailForSideEffects.assignedUnits,
      },
      integration: {
        entityId: vendorCode,
        contentType,
        apiVersionHeaderName,
        apiVersionHeaderValue,
        existingIncidentNerisId,
        allowUpdateFallback: true,
      },
      additionalAidEntries: buildStoredAdditionalAidEntries(),
    };
    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };
    if (vendorCode && vendorHeaderName) {
      headers[vendorHeaderName] = vendorCode;
    }
    if (!isProxyRequest && secretKey) {
      headers[authHeaderName] = authScheme
        ? `${authScheme} ${secretKey}`
        : secretKey;
    }
    if (apiVersionHeaderName && apiVersionHeaderValue) {
      headers[apiVersionHeaderName] = apiVersionHeaderValue;
    }
    return {
      exportUrl,
      isProxyRequest,
      headers,
      payload,
    };
  };

  const parseJsonResponseText = (responseText: string): Record<string, unknown> | null => {
    if (!responseText) {
      return null;
    }
    try {
      return JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const extractProxyApiIssues = (responseJson: Record<string, unknown> | null): string[] => {
    if (!responseJson || typeof responseJson !== "object") {
      return [];
    }
    const neris = responseJson.neris;
    if (!neris || typeof neris !== "object") {
      return [];
    }
    const detail = (neris as Record<string, unknown>).detail;
    if (!Array.isArray(detail)) {
      return [];
    }
    return detail
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return "";
        }
        const candidate = entry as Record<string, unknown>;
        const loc = Array.isArray(candidate.loc)
          ? candidate.loc
              .filter((segment): segment is string => typeof segment === "string")
              .join(" > ")
          : "";
        const message = typeof candidate.msg === "string" ? candidate.msg : "Validation issue";
        return loc ? `API - ${loc}: ${message}` : `API - ${message}`;
      })
      .filter((issue) => issue.length > 0);
  };

  const runPreExportValidation = async (requestConfig: ExportRequestConfig): Promise<string[]> => {
    if (!requestConfig.isProxyRequest) {
      return [];
    }
    if (!requestConfig.exportUrl.includes("/api/neris/export")) {
      return [];
    }

    const validateUrl = requestConfig.exportUrl.replace(
      "/api/neris/export",
      "/api/neris/validate",
    );
    const response = await fetch(validateUrl, {
      method: "POST",
      headers: requestConfig.headers,
      body: JSON.stringify(requestConfig.payload),
    });
    const responseText = await response.text();
    const responseJson = parseJsonResponseText(responseText);
    const apiIssues = extractProxyApiIssues(responseJson);
    if (apiIssues.length > 0) {
      return apiIssues;
    }
    if (response.ok) {
      return [];
    }
    if (response.status === 404 || response.status === 405) {
      // If proxy validate isn't available yet, continue with export path.
      return [];
    }
    if (response.status === 422) {
      return [
        `API - Validation failed (${response.status}). Review field values and required formats before export.`,
      ];
    }
    throw new Error(
      `Pre-export validation failed (${response.status} ${response.statusText}). ${
        responseText.slice(0, 240) || "No response details."
      }`,
    );
  };

  const getRequestedEntityId = (requestConfig: ExportRequestConfig): string => {
    const integration =
      requestConfig.payload.integration && typeof requestConfig.payload.integration === "object"
        ? (requestConfig.payload.integration as Record<string, unknown>)
        : null;
    return integration && typeof integration.entityId === "string" ? integration.entityId : "";
  };

  const executeExport = async (
    requestConfig: ExportRequestConfig,
  ): Promise<ExportExecutionResult> => {
    const isProxyRequest = requestConfig.isProxyRequest;
    const serializedAidEntries = buildStoredAdditionalAidEntries();
    writeNerisDraft(callNumber, {
      formValues,
      reportStatus,
      lastSavedAt,
      additionalAidEntries: serializedAidEntries,
    });

    const requestController = new AbortController();
    const timeoutId = window.setTimeout(() => requestController.abort(), 20_000);

    try {
      const response = await fetch(requestConfig.exportUrl, {
        method: "POST",
        headers: requestConfig.headers,
        body: JSON.stringify(requestConfig.payload),
        signal: requestController.signal,
      });
      const responseText = await response.text();
      const responseJson = parseJsonResponseText(responseText);
      const submittedEntityId =
        typeof responseJson?.submittedEntityId === "string"
          ? responseJson.submittedEntityId
          : getRequestedEntityId(requestConfig);
      const submittedDepartmentNerisId = extractSubmittedDepartmentFromResponse(responseJson);
      const submittedPayloadPreview =
        toPrettyJson(responseJson?.submittedPayload ?? requestConfig.payload) ||
        toPrettyJson(requestConfig.payload);
      const responseDetail = responseJson ? toPrettyJson(responseJson) : responseText;
      const responseSummary = extractExportResponseSummary(response, responseJson, responseText);
      if (!response.ok) {
        if (response.status === 403) {
          const troubleshooting =
            responseJson?.troubleshooting &&
            typeof responseJson.troubleshooting === "object"
              ? (responseJson.troubleshooting as Record<string, unknown>)
              : null;
          const accessibleEntityIds = Array.isArray(troubleshooting?.accessibleEntityIds)
            ? (troubleshooting?.accessibleEntityIds as unknown[])
                .filter((value): value is string => typeof value === "string")
                .slice(0, 8)
            : [];
          const submittedDepartmentFromTroubleshooting =
            typeof troubleshooting?.submittedDepartmentNerisId === "string"
              ? troubleshooting.submittedDepartmentNerisId
              : submittedDepartmentNerisId;
          const troubleshootingMessage =
            typeof troubleshooting?.message === "string" ? troubleshooting.message : "";
          const detailedMessage =
            accessibleEntityIds.length
              ? `Export denied (403). ${
                  troubleshootingMessage ||
                  `Submitted entity ID ${submittedEntityId} is not authorized for this token.`
                } Submitted entity ID: ${submittedEntityId}. ${
                  submittedDepartmentFromTroubleshooting
                    ? `Submitted Department NERIS ID: ${submittedDepartmentFromTroubleshooting}. `
                    : ""
                }Accessible entity IDs: ${accessibleEntityIds.join(", ")}`
              : `Export denied (403). ${
                  troubleshootingMessage ||
                  `Submitted entity ID ${submittedEntityId} is not authorized for this token.`
                } Submitted entity ID: ${submittedEntityId}. ${
                  submittedDepartmentFromTroubleshooting
                    ? `Submitted Department NERIS ID: ${submittedDepartmentFromTroubleshooting}.`
                    : ""
                }`;
          throw createExportRequestError(detailedMessage, {
            httpStatus: response.status,
            httpStatusText: response.statusText,
            submittedEntityId,
            submittedDepartmentNerisId: submittedDepartmentFromTroubleshooting,
            responseSummary:
              troubleshootingMessage ||
              responseSummary ||
              "Export denied by NERIS authorization checks.",
            responseDetail,
            submittedPayloadPreview,
          });
        }
        throw createExportRequestError(
          `Export failed (${response.status} ${response.statusText}). ${
            responseSummary || "No response details."
          }`,
          {
            httpStatus: response.status,
            httpStatusText: response.statusText,
            submittedEntityId,
            submittedDepartmentNerisId,
            responseSummary: responseSummary || `${response.status} ${response.statusText}`,
            responseDetail,
            submittedPayloadPreview,
          },
        );
      }

      const exportedAtDate = new Date();
      const exportedAtIso = exportedAtDate.toISOString();
      const exportedAtLabel = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(exportedAtDate);
      const nerisId =
        typeof responseJson?.neris === "object" &&
        responseJson.neris &&
        typeof (responseJson.neris as Record<string, unknown>).neris_id === "string"
          ? ((responseJson.neris as Record<string, unknown>).neris_id as string)
          : "";

      return {
        exportedAtIso,
        exportedAtLabel,
        attemptStatus: "success",
        httpStatus: response.status,
        httpStatusText: response.statusText,
        nerisId,
        submittedEntityId,
        submittedDepartmentNerisId,
        statusLabel: `${response.status} ${response.statusText}`.trim(),
        responseSummary: responseSummary || "Export submitted successfully.",
        responseDetail,
        submittedPayloadPreview,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw createExportRequestError(
          "Export timed out after 20 seconds. If using local proxy, confirm `npm run proxy` is running, then retry.",
          {
            httpStatus: 0,
            httpStatusText: "Timeout",
            submittedEntityId: getRequestedEntityId(requestConfig),
            submittedDepartmentNerisId: (formValues.fd_neris_id ?? "").trim(),
            responseSummary: "Request timed out before receiving response from export endpoint.",
            responseDetail: "",
            submittedPayloadPreview: toPrettyJson(requestConfig.payload),
          },
        );
      }
      const reason = error instanceof Error ? error.message : "Unknown export error.";
      if (reason.includes("Failed to fetch")) {
        throw createExportRequestError(
          isProxyRequest
            ? "Export request could not reach local proxy. Start it with `npm run proxy`, then retry."
            : "Export request could not reach the endpoint (network/CORS/proxy issue). Check endpoint URL and server logs.",
          {
            httpStatus: 0,
            httpStatusText: "Network Error",
            submittedEntityId: getRequestedEntityId(requestConfig),
            submittedDepartmentNerisId: (formValues.fd_neris_id ?? "").trim(),
            responseSummary: "Network failure (no response body).",
            responseDetail: "",
            submittedPayloadPreview: toPrettyJson(requestConfig.payload),
          },
        );
      }
      if (
        error &&
        typeof error === "object" &&
        "httpStatus" in error
      ) {
        throw error as ExportRequestError;
      }
      throw createExportRequestError(reason, {
        httpStatus: 0,
        httpStatusText: "Unexpected Error",
        submittedEntityId: getRequestedEntityId(requestConfig),
        submittedDepartmentNerisId: (formValues.fd_neris_id ?? "").trim(),
        responseSummary: reason,
        responseDetail: "",
        submittedPayloadPreview: toPrettyJson(requestConfig.payload),
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const appendExportHistoryRecord = (
    exportResult: ExportExecutionResult,
    validatorNameOverride: string,
    statusAtExport: string,
  ) => {
    appendNerisExportRecord({
      id: `${detailForSideEffects.callNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      callNumber: detailForSideEffects.callNumber,
      incidentType: detailForSideEffects.incidentType,
      address: detailForSideEffects.address,
      exportedAtIso: exportResult.exportedAtIso,
      exportedAtLabel: exportResult.exportedAtLabel,
      attemptStatus: exportResult.attemptStatus,
      httpStatus: exportResult.httpStatus,
      httpStatusText: exportResult.httpStatusText,
      statusLabel: exportResult.statusLabel || "Submitted",
      reportStatusAtExport: statusAtExport,
      validatorName: validatorNameOverride.trim(),
      reportWriterName: buildReportWriterName(),
      submittedEntityId: exportResult.submittedEntityId,
      submittedDepartmentNerisId: exportResult.submittedDepartmentNerisId,
      nerisId: exportResult.nerisId,
      responseSummary: exportResult.responseSummary,
      responseDetail: exportResult.responseDetail,
      submittedPayloadPreview: exportResult.submittedPayloadPreview,
    });
  };

  const appendFailedExportHistoryRecord = (
    error: unknown,
    validatorNameOverride: string,
    statusAtExport: string,
  ) => {
    const metadata =
      error && typeof error === "object" ? (error as ExportRequestError) : null;
    const exportedAtDate = new Date();
    const exportedAtIso = exportedAtDate.toISOString();
    const exportedAtLabel = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(exportedAtDate);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown export error.";
    const httpStatus = typeof metadata?.httpStatus === "number" ? metadata.httpStatus : 0;
    const httpStatusText =
      typeof metadata?.httpStatusText === "string" ? metadata.httpStatusText : "Error";
    appendNerisExportRecord({
      id: `${detailForSideEffects.callNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      callNumber: detailForSideEffects.callNumber,
      incidentType: detailForSideEffects.incidentType,
      address: detailForSideEffects.address,
      exportedAtIso,
      exportedAtLabel,
      attemptStatus: "failed",
      httpStatus,
      httpStatusText,
      statusLabel: `${httpStatus || "Error"} ${httpStatusText}`.trim(),
      reportStatusAtExport: statusAtExport,
      validatorName: validatorNameOverride.trim(),
      reportWriterName: buildReportWriterName(),
      submittedEntityId:
        typeof metadata?.submittedEntityId === "string" ? metadata.submittedEntityId : "",
      submittedDepartmentNerisId:
        typeof metadata?.submittedDepartmentNerisId === "string"
          ? metadata.submittedDepartmentNerisId
          : (formValues.fd_neris_id ?? "").trim(),
      nerisId: "",
      responseSummary:
        typeof metadata?.responseSummary === "string" && metadata.responseSummary.trim().length > 0
          ? metadata.responseSummary
          : errorMessage,
      responseDetail:
        typeof metadata?.responseDetail === "string" ? metadata.responseDetail : "",
      submittedPayloadPreview:
        typeof metadata?.submittedPayloadPreview === "string"
          ? metadata.submittedPayloadPreview
          : "",
    });
  };

  const handleOpenAdminValidateModal = () => {
    if (role !== "admin") {
      return;
    }
    const { mergedErrors, issueLabels } = buildValidationSnapshot();
    setSectionErrors(mergedErrors);
    setValidationIssues(issueLabels);
    if (issueLabels.length > 0) {
      applyValidationFailure(issueLabels);
      return;
    }
    setErrorMessage("");
    setSaveMessage("");
    setValidationModal({
      mode: "adminConfirm",
      issues: [],
    });
    if (!validatorName.trim()) {
      setValidatorName(username.trim());
    }
  };

  const handleAdminValidateAndExport = async () => {
    if (role !== "admin") {
      return;
    }
    const normalizedValidatorName = validatorName.trim();
    if (!normalizedValidatorName) {
      setErrorMessage("Validator username is required before validating/exporting.");
      return;
    }

    const localValidation = buildValidationSnapshot();
    setSectionErrors(localValidation.mergedErrors);
    setValidationIssues(localValidation.issueLabels);
    if (localValidation.issueLabels.length > 0) {
      applyValidationFailure(localValidation.issueLabels);
      return;
    }

    setErrorMessage("");
    setSaveMessage("Validate + export in progress...");
    setValidationModal(null);
    setIsExporting(true);
    try {
      const requestConfig = buildExportRequestConfig();
      const preExportIssues = await runPreExportValidation(requestConfig);
      if (preExportIssues.length > 0) {
        setValidationIssues(preExportIssues);
        setSectionErrors({});
        setSaveMessage("");
        setErrorMessage(
          "Pre-export validation found issues that are likely to return API 422 errors.",
        );
        setValidationModal({
          mode: "issues",
          issues: preExportIssues,
        });
        return;
      }

      const exportResult = await executeExport(requestConfig);
      appendExportHistoryRecord(exportResult, normalizedValidatorName, "Validated");
      setValidationIssues([]);
      setSectionErrors({});
      stampSavedAt(
        "manual",
        "Validated",
        exportResult.nerisId
          ? `Validated + exported at ${exportResult.exportedAtLabel}. NERIS ID: ${exportResult.nerisId}`
          : `Validated + exported at ${exportResult.exportedAtLabel}.`,
      );
      setValidationModal({
        mode: "adminSuccess",
        issues: [],
      });
    } catch (error) {
      appendFailedExportHistoryRecord(error, normalizedValidatorName, reportStatus);
      setSaveMessage("");
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected validate/export error.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportReport = async () => {
    setValidationModal(null);
    setErrorMessage("");
    setSaveMessage("Export in progress...");
    setIsExporting(true);
    try {
      const requestConfig = buildExportRequestConfig();
      const exportResult = await executeExport(requestConfig);
      appendExportHistoryRecord(exportResult, "", reportStatus);
      setSaveMessage(
        exportResult.nerisId
          ? `Report export accepted for ${detailForSideEffects.callNumber} at ${exportResult.exportedAtLabel}. NERIS ID: ${exportResult.nerisId}`
          : `Report export submitted for ${detailForSideEffects.callNumber} at ${exportResult.exportedAtLabel}.`,
      );
    } catch (error) {
      appendFailedExportHistoryRecord(error, "", reportStatus);
      setSaveMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Unknown export error.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleValidationModalClose = () => {
    setValidationModal(null);
  };

  const handleValidationModalReturn = () => {
    setValidationModal(null);
    navigate("/reporting/neris");
  };

  const handleValidationModalFixIssues = () => {
    setValidationModal(null);
    setActiveSectionId("core");
  };

  const handleValidationModalCancelAdmin = () => {
    setValidationModal(null);
  };

  const handleValidationValidatorNameSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    void handleAdminValidateAndExport();
  };

  const handleValidationValidatorNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValidatorName(event.currentTarget.value);
  };

  const handleValidationModalValidateFromSuccess = () => {
    setValidationModal(null);
    navigate("/reporting/neris");
  };

  const handleSaveDraft = () => {
    setSectionErrors({});
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    stampSavedAt("manual");
  };

  const goToNextSection = () => {
    if (!hasNextSection) {
      return;
    }
    setSectionErrors({});
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    stampSavedAt("auto");
    const nextSection = visibleNerisSections[sectionIndex + 1];
    if (nextSection) {
      setActiveSectionId(nextSection.id);
    }
  };

  const handleBack = () => {
    if (sectionIndex > 0) {
      const previousSection = visibleNerisSections[sectionIndex - 1];
      if (previousSection) {
        setActiveSectionId(previousSection.id);
      }
      return;
    }
    navigate("/reporting/neris");
  };

  const addAdditionalAidEntry = () => {
    setAdditionalAidEntries((previous) => [...previous, { ...EMPTY_AID_ENTRY }]);
    setValidationModal(null);
  };

  const updateAdditionalAidEntry = (
    index: number,
    field: keyof AidEntry,
    nextValue: string,
  ) => {
    setAdditionalAidEntries((previous) =>
      previous.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              [field]: nextValue,
            }
          : entry,
      ),
    );
    setSaveMessage("");
    setErrorMessage("");
    setValidationIssues([]);
    setValidationModal(null);
    if (reportStatus !== "Draft") {
      setReportStatus("Draft");
    }
  };

  const renderNerisField = (field: NerisFieldMetadata, fieldKey?: string) => {
    const inputId = `neris-field-${field.id}`;
    const value = formValues[field.id] ?? "";
    const isRequired = isNerisFieldRequired(field, formValues);
    const options = field.optionsKey ? getNerisValueOptions(field.optionsKey) : [];
    const error = sectionErrors[field.id];
    const wrapperClassName = field.layout === "full" ? "field-span-two" : undefined;
    const normalizedSingleValue = normalizeNerisEnumValue(value);
    const isPrimaryIncidentTypeField =
      field.id === "primary_incident_type" &&
      field.inputKind === "select" &&
      field.optionsKey === "incident_type";
    const isAdditionalIncidentTypesField =
      field.id === "additional_incident_types" &&
      field.inputKind === "multiselect" &&
      field.optionsKey === "incident_type";
    const isActionsTakenField =
      field.id === "incident_actions_taken" &&
      field.inputKind === "multiselect" &&
      field.optionsKey === "action_tactic";
    const isSpecialIncidentModifiersField =
      field.id === "special_incident_modifiers" &&
      field.inputKind === "multiselect" &&
      field.optionsKey === "incident_modifier";
    const isLocationUseField =
      (field.id === "location_use_primary" || field.id === "location_use_secondary") &&
      field.inputKind === "select" &&
      field.optionsKey === "location_use";
    const isNoActionReasonField =
      field.id === "incident_noaction" &&
      field.inputKind === "select" &&
      field.optionsKey === "no_action";
    const isAutomaticAlarmField =
      field.id === "dispatch_automatic_alarm" &&
      field.inputKind === "select" &&
      field.optionsKey === "yes_no";
    const isPeoplePresentField =
      field.id === "incident_people_present" &&
      field.inputKind === "select" &&
      field.optionsKey === "yes_no";
    const isDisplacedNumberField =
      field.id === "incident_displaced_number" && field.inputKind === "text";
    const isDisplacementCauseField =
      field.id === "incident_displaced_cause" &&
      field.inputKind === "multiselect" &&
      field.optionsKey === "displace_cause_incident";
    const isAidGivenQuestionField =
      field.id === "incident_has_aid" &&
      field.inputKind === "select" &&
      field.optionsKey === "yes_no";
    const isAidAgencyTypeField =
      field.id === "incident_aid_agency_type" &&
      field.inputKind === "select" &&
      field.optionsKey === "aid_agency_type";
    const isAidDirectionField =
      field.id === "incident_aid_direction" &&
      field.inputKind === "select" &&
      field.optionsKey === "aid_direction";
    const isAidTypeField =
      field.id === "incident_aid_type" &&
      field.inputKind === "select" &&
      field.optionsKey === "aid_type";
    const isAidDepartmentField =
      field.id === "incident_aid_department_name" &&
      field.inputKind === "select" &&
      field.optionsKey === "aid_department";
    const isAidNonFdField =
      field.id === "incident_aid_nonfd" &&
      field.inputKind === "multiselect" &&
      field.optionsKey === "aid_nonfd";
    const isAidManagedHiddenField =
      isAidAgencyTypeField ||
      isAidDirectionField ||
      isAidTypeField ||
      isAidDepartmentField ||
      isAidNonFdField;
    const hasNoActionSelected = (formValues.incident_noaction ?? "").trim().length > 0;
    const isNoActionReasonDisabled = (formValues.incident_actions_taken ?? "").trim().length > 0;
    const isActionsTakenDisabled = hasNoActionSelected;
    const isSingleChoiceButtonField =
      isNoActionReasonField || isAutomaticAlarmField || isPeoplePresentField;
    const displacedNumberValue = Number.parseInt(
      (formValues.incident_displaced_number ?? "").trim(),
      10,
    );
    const selectedPrimaryAidDepartment = (formValues.incident_aid_department_name ?? "").trim();
    const selectedAdditionalAidDepartments = additionalAidEntries
      .map((entry) => entry.aidDepartment.trim())
      .filter((entry) => entry.length > 0);

    if (
      field.id === "incident_displaced_cause" &&
      (Number.isNaN(displacedNumberValue) || displacedNumberValue <= 0)
    ) {
      return null;
    }
    if (isDisplacedNumberField && (formValues.incident_people_present ?? "") !== "YES") {
      return null;
    }
    if (isAidManagedHiddenField) {
      return null;
    }
    if (field.id === "location_direction_of_travel" && !showDirectionOfTravelField) {
      return null;
    }
    if (field.id === "location_cross_street_type" && !showCrossStreetTypeField) {
      return null;
    }
    if (currentSection.id === "resources" && field.id.startsWith("resource_")) {
      return null;
    }
    if (currentSection.id === "riskReduction") {
      return null;
    }
    if (
      currentSection.id === "emergingHazards" &&
      [
        "emerg_haz_electric_type",
        "emerg_haz_pv_type",
        "emerg_haz_pv_source_target",
        "emerg_haz_suppression_methods",
      ].includes(field.id)
    ) {
      return null;
    }

    return (
      <div key={fieldKey} className={wrapperClassName}>
        {!isAidGivenQuestionField ? (
          <label
            htmlFor={inputId}
            className={isNoActionReasonField ? "neris-field-label-italic" : undefined}
          >
            {field.label}
            {isRequired ? " *" : ""}
          </label>
        ) : null}

        {field.inputKind === "textarea" ? (
          <textarea
            id={inputId}
            rows={field.rows ?? 6}
            value={value}
            placeholder={field.placeholder}
            onChange={(event) => updateFieldValue(field.id, event.target.value)}
          />
        ) : null}

        {(field.inputKind === "text" ||
          field.inputKind === "date" ||
          field.inputKind === "time" ||
          field.inputKind === "datetime" ||
          field.inputKind === "readonly") ? (
          <input
            id={inputId}
            type={
              field.inputKind === "readonly"
                ? "text"
                : field.inputKind === "datetime"
                  ? "datetime-local"
                  : field.inputKind
            }
            step={field.inputKind === "time" ? 1 : undefined}
            readOnly={field.inputKind === "readonly"}
            value={value}
            placeholder={field.placeholder}
            onChange={(event) => updateFieldValue(field.id, event.target.value)}
          />
        ) : null}

        {isAidGivenQuestionField ? (
          <div className="neris-aid-block">
            <div className="neris-aid-question">
              <label>Was aid given or received?</label>
              <div className="neris-single-choice-row" role="group" aria-label="Was aid given or received?">
                {getNerisValueOptions("yes_no").map((option) => {
                  const isSelected = option.value === (formValues.incident_has_aid ?? "");
                  return (
                    <button
                      key={`incident-has-aid-${option.value}`}
                      type="button"
                      className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                      aria-pressed={isSelected}
                      onClick={() =>
                        updateFieldValue(
                          "incident_has_aid",
                          togglePillValue(formValues.incident_has_aid ?? "", option.value),
                        )
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {sectionErrors.incident_has_aid ? (
                <small className="field-error">{sectionErrors.incident_has_aid}</small>
              ) : null}
            </div>

            {(formValues.incident_has_aid ?? "") === "YES" ? (
              <div className="neris-aid-question">
                <label>Aid Type</label>
                <div className="neris-single-choice-row" role="group" aria-label="Aid Type">
                  {getNerisValueOptions("aid_agency_type").map((option) => {
                    const isSelected = option.value === (formValues.incident_aid_agency_type ?? "");
                    return (
                      <button
                        key={`incident-aid-agency-${option.value}`}
                        type="button"
                        className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                        aria-pressed={isSelected}
                        onClick={() =>
                          updateFieldValue(
                            "incident_aid_agency_type",
                            togglePillValue(
                              formValues.incident_aid_agency_type ?? "",
                              option.value,
                            ),
                          )
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {sectionErrors.incident_aid_agency_type ? (
                  <small className="field-error">{sectionErrors.incident_aid_agency_type}</small>
                ) : null}
              </div>
            ) : null}

            {(formValues.incident_has_aid ?? "") === "YES" &&
            (formValues.incident_aid_agency_type ?? "") === "NON_FD_AID" ? (
              <div className="neris-aid-question">
                <label>Non FD Aid</label>
                <NerisFlatMultiOptionSelect
                  inputId={`${inputId}-nonfd`}
                  value={formValues.incident_aid_nonfd ?? ""}
                  options={getNerisValueOptions("aid_nonfd")}
                  onChange={(nextValue) => updateFieldValue("incident_aid_nonfd", nextValue)}
                  placeholder="Select non FD aid"
                  searchPlaceholder="Search non FD aid..."
                />
                {sectionErrors.incident_aid_nonfd ? (
                  <small className="field-error">{sectionErrors.incident_aid_nonfd}</small>
                ) : null}
              </div>
            ) : null}

            {(formValues.incident_has_aid ?? "") === "YES" &&
            (formValues.incident_aid_agency_type ?? "") === "FIRE_DEPARTMENT" ? (
              <div className="neris-aid-question">
                <label>Aid direction</label>
                <div className="neris-single-choice-row" role="group" aria-label="Aid direction">
                  {getNerisValueOptions("aid_direction").map((option) => {
                    const isSelected = option.value === (formValues.incident_aid_direction ?? "");
                    return (
                      <button
                        key={`incident-aid-direction-${option.value}`}
                        type="button"
                        className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                        aria-pressed={isSelected}
                        onClick={() =>
                          updateFieldValue(
                            "incident_aid_direction",
                            togglePillValue(
                              formValues.incident_aid_direction ?? "",
                              option.value,
                            ),
                          )
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {sectionErrors.incident_aid_direction ? (
                  <small className="field-error">{sectionErrors.incident_aid_direction}</small>
                ) : null}

                <label className="neris-aid-subfield-label">Aid Type</label>
                <NerisFlatSingleOptionSelect
                  inputId={`${inputId}-aid-type`}
                  value={formValues.incident_aid_type ?? ""}
                  options={getNerisValueOptions("aid_type")}
                  onChange={(nextValue) => updateFieldValue("incident_aid_type", nextValue)}
                  placeholder="Select aid type"
                  searchPlaceholder="Search aid types..."
                />
                {sectionErrors.incident_aid_type ? (
                  <small className="field-error">{sectionErrors.incident_aid_type}</small>
                ) : null}

                <label className="neris-aid-subfield-label">Aid department name(s)</label>
                <NerisFlatSingleOptionSelect
                  inputId={`${inputId}-aid-department`}
                  value={formValues.incident_aid_department_name ?? ""}
                  options={getNerisValueOptions("aid_department")}
                  onChange={(nextValue) =>
                    updateFieldValue("incident_aid_department_name", nextValue)
                  }
                  placeholder="Select aid department"
                  searchPlaceholder="Search aid departments..."
                  isOptionDisabled={(optionValue) =>
                    optionValue !== selectedPrimaryAidDepartment &&
                    selectedAdditionalAidDepartments.includes(optionValue)
                  }
                />
                {sectionErrors.incident_aid_department_name ? (
                  <small className="field-error">{sectionErrors.incident_aid_department_name}</small>
                ) : null}

                {(formValues.incident_aid_direction ?? "") === "RECEIVED" ? (
                  <>
                    {additionalAidEntries.map((entry, entryIndex) => (
                      <div key={`additional-aid-${entryIndex}`} className="neris-additional-aid-entry">
                        <label className="neris-aid-subfield-label">Aid direction</label>
                        <div
                          className="neris-single-choice-row"
                          role="group"
                          aria-label="Additional aid direction"
                        >
                          {getNerisValueOptions("aid_direction").map((option) => {
                            const isSelected = option.value === entry.aidDirection;
                            return (
                              <button
                                key={`additional-aid-direction-${entryIndex}-${option.value}`}
                                type="button"
                                className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                                aria-pressed={isSelected}
                                onClick={() =>
                                  updateAdditionalAidEntry(
                                    entryIndex,
                                    "aidDirection",
                                    togglePillValue(entry.aidDirection, option.value),
                                  )
                                }
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>

                        <label className="neris-aid-subfield-label">Aid Type</label>
                        <NerisFlatSingleOptionSelect
                          inputId={`${inputId}-additional-aid-type-${entryIndex}`}
                          value={entry.aidType}
                          options={getNerisValueOptions("aid_type")}
                          onChange={(nextValue) =>
                            updateAdditionalAidEntry(entryIndex, "aidType", nextValue)
                          }
                          placeholder="Select aid type"
                          searchPlaceholder="Search aid types..."
                        />

                        <label className="neris-aid-subfield-label">Aid department name(s)</label>
                        <NerisFlatSingleOptionSelect
                          inputId={`${inputId}-additional-aid-department-${entryIndex}`}
                          value={entry.aidDepartment}
                          options={getNerisValueOptions("aid_department")}
                          onChange={(nextValue) =>
                            updateAdditionalAidEntry(entryIndex, "aidDepartment", nextValue)
                          }
                          placeholder="Select aid department"
                          searchPlaceholder="Search aid departments..."
                          isOptionDisabled={(optionValue) => {
                            if (optionValue === entry.aidDepartment) {
                              return false;
                            }
                            if (selectedPrimaryAidDepartment === optionValue) {
                              return true;
                            }
                            return additionalAidEntries.some(
                              (candidateEntry, candidateIndex) =>
                                candidateIndex !== entryIndex &&
                                candidateEntry.aidDepartment.trim() === optionValue,
                            );
                          }}
                        />
                      </div>
                    ))}

                    <button
                      type="button"
                      className="neris-link-button"
                      onClick={addAdditionalAidEntry}
                    >
                      Add Additional Aid
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {field.inputKind === "select" ? (
          isAidGivenQuestionField ? null : isSingleChoiceButtonField ? (
            <div
              className={`neris-single-choice-row${
                isNoActionReasonField && isNoActionReasonDisabled ? " disabled" : ""
              }`}
              role="group"
              aria-label={field.label}
              aria-disabled={isNoActionReasonField && isNoActionReasonDisabled}
            >
              {options.map((option) => {
                const isSelected = option.value === normalizedSingleValue;
                const isDisabled = isNoActionReasonField && isNoActionReasonDisabled;
                return (
                  <button
                    key={`${field.id}-${option.value}`}
                    type="button"
                    className={`neris-single-choice-button${isSelected ? " selected" : ""}${
                      isDisabled ? " disabled" : ""
                    }`}
                    aria-pressed={isSelected}
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) {
                        return;
                      }
                      updateFieldValue(
                        field.id,
                        togglePillValue(normalizedSingleValue, option.value),
                      );
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : isPrimaryIncidentTypeField ? (
            <NerisGroupedOptionSelect
              inputId={inputId}
              value={normalizedSingleValue}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              mode="single"
              variant="incidentType"
              placeholder=""
              searchPlaceholder="Search incident types..."
            />
          ) : isLocationUseField ? (
            <NerisGroupedOptionSelect
              inputId={inputId}
              value={normalizedSingleValue}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              mode="single"
              variant="incidentType"
              placeholder={`Select ${field.label.toLowerCase()}`}
              searchPlaceholder={`Search ${field.label.toLowerCase()}...`}
            />
          ) : (
            <NerisFlatSingleOptionSelect
              inputId={inputId}
              value={normalizedSingleValue}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              placeholder={`Select ${field.label.toLowerCase()}`}
              searchPlaceholder={`Search ${field.label.toLowerCase()}...`}
              allowClear={!isRequired}
            />
          )
        ) : null}

        {field.inputKind === "multiselect" ? (
          isAdditionalIncidentTypesField ? (
            <NerisGroupedOptionSelect
              inputId={inputId}
              value={value}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              mode="multi"
              variant="incidentType"
              placeholder="Select up to 2 incident types"
              searchPlaceholder="Search incident types..."
              maxSelections={2}
              showCheckboxes
            />
          ) : isSpecialIncidentModifiersField ? (
            <NerisFlatMultiOptionSelect
              inputId={inputId}
              value={value}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              placeholder="Select special incident modifier(s)"
              searchPlaceholder="Search special modifiers..."
            />
          ) : isDisplacementCauseField ? (
            <NerisFlatMultiOptionSelect
              inputId={inputId}
              value={value}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              placeholder="Select displacement cause(s)"
              searchPlaceholder="Search displacement causes..."
            />
          ) : isActionsTakenField ? (
            <NerisGroupedOptionSelect
              inputId={inputId}
              value={value}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              mode="multi"
              variant="actionTactic"
              placeholder="Select action(s) taken"
              searchPlaceholder="Search actions..."
              showCheckboxes
              disabled={isActionsTakenDisabled}
            />
          ) : (
            <NerisFlatMultiOptionSelect
              inputId={inputId}
              value={value}
              options={options}
              onChange={(nextValue) => updateFieldValue(field.id, nextValue)}
              placeholder={`Select ${field.label.toLowerCase()}`}
              searchPlaceholder={`Search ${field.label.toLowerCase()}...`}
            />
          )
        ) : null}

        {field.helperText ? <small className="field-hint">{field.helperText}</small> : null}

        {field.maxLength ? (
          <small className="field-hint">
            {value.length} / {field.maxLength} characters
          </small>
        ) : null}

        {error ? <small className="field-error">{error}</small> : null}
      </div>
    );
  };

  if (!detail) {
    return (
      <section className="page-section">
        <header className="page-header">
          <div>
            <h1>NERIS report not found</h1>
            <p>No matching incident exists for report ID {callNumber}.</p>
          </div>
          <div className="header-actions">
            <NavLink className="secondary-button button-link" to="/reporting/neris">
              Back to NERIS Queue
            </NavLink>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{detail.callNumber}</h1>
          <p>
            <strong>{detail.incidentType}</strong> at {detail.address}
          </p>
          <div className="neris-incident-meta">
            <span>
              Incident date <strong>{formValues.incident_onset_date || "Not set"}</strong>
            </span>
            <span>
              Last saved <strong>{lastSavedAt}</strong>
            </span>
            <span>
              Status{" "}
              <strong className={toToneClass(toneFromNerisStatus(reportStatus))}>
                {reportStatus}
              </strong>
            </span>
          </div>
          {saveMessage ? <p className="save-message neris-header-feedback">{saveMessage}</p> : null}
          {errorMessage ? <p className="auth-error neris-header-feedback">{errorMessage}</p> : null}
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button compact-button">
            Import
          </button>
          <button
            type="button"
            className="primary-button compact-button"
            onClick={handleExportReport}
            disabled={isExporting}
          >
            {isExporting ? "Exporting..." : "Export"}
          </button>
          <button type="button" className="secondary-button compact-button">
            CAD notes
          </button>
          <button type="button" className="secondary-button compact-button">
            Print
          </button>
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={handleCheckForErrors}
            disabled={isExporting}
          >
            Check for Errors
          </button>
          {role === "admin" ? (
            <button
              type="button"
              className="primary-button compact-button"
              onClick={handleOpenAdminValidateModal}
              disabled={isExporting}
            >
              Validate
            </button>
          ) : null}
          <span className={`neris-status-pill ${toToneClass(toneFromNerisStatus(reportStatus))}`}>
            {reportStatus}
          </span>
        </div>
      </header>

      {validationModal ? (
        <div className="validation-modal-backdrop" role="dialog" aria-modal="true">
          <div className="validation-modal panel">
            {validationModal.mode === "checkSuccess" ? (
              <>
                <h2>Check complete</h2>
                <p>
                  No required-field issues were found. Status has been updated to
                  In Review.
                </p>
                <div className="validation-modal-actions">
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={handleValidationModalClose}
                  >
                    Continue Editing
                  </button>
                  <button
                    type="button"
                    className="primary-button compact-button"
                    onClick={handleValidationModalReturn}
                  >
                    Return to Incidents
                  </button>
                </div>
              </>
            ) : null}
            {validationModal.mode === "issues" ? (
              <>
                <h2>Validation requires updates</h2>
                <p>The following required fields still need values:</p>
                <ul>
                  {validationModal.issues.map((issue: string) => (
                    <li key={`validation-modal-${issue}`}>{issue}</li>
                  ))}
                </ul>
                <div className="validation-modal-actions">
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={handleValidationModalClose}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="primary-button compact-button"
                    onClick={handleValidationModalFixIssues}
                  >
                    Fix issues now
                  </button>
                </div>
              </>
            ) : null}
            {validationModal.mode === "adminConfirm" ? (
              <form className="validation-modal-form" onSubmit={handleValidationValidatorNameSubmit}>
                <h2>Admin Validate + Auto Export</h2>
                <p>
                  Pre-export checks are complete. Enter the validator username, then
                  Validate to auto-export this report.
                </p>
                <label htmlFor="neris-validator-name">Validator username</label>
                <input
                  id="neris-validator-name"
                  type="text"
                  value={validatorName}
                  onChange={handleValidationValidatorNameChange}
                  placeholder="Enter validator username"
                />
                <div className="validation-modal-actions">
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={handleValidationModalCancelAdmin}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button compact-button"
                    disabled={isExporting}
                  >
                    {isExporting ? "Validating..." : "Validate + Export"}
                  </button>
                </div>
              </form>
            ) : null}
            {validationModal.mode === "adminSuccess" ? (
              <>
                <h2>Report validated and exported</h2>
                <p>
                  Status has been set to Validated and this export is now logged in
                  View Exports.
                </p>
                <div className="validation-modal-actions">
                  <button
                    type="button"
                    className="primary-button compact-button"
                    onClick={handleValidationModalValidateFromSuccess}
                  >
                    Return to Incidents
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="neris-report-layout">
        <aside className="panel neris-sidebar">
          <div className="neris-sidebar-header">
            <h2>Fire Incidents</h2>
            <p>NERIS sections</p>
          </div>
          <nav className="neris-section-nav" aria-label="NERIS section navigation">
            {visibleNerisSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={section.id === currentSection.id ? "active" : ""}
                onClick={() => setActiveSectionId(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        <article className="panel neris-form-panel">
          {currentSection.id !== "core" &&
          currentSection.id !== "location" &&
          currentSection.id !== "emergingHazards" &&
          currentSection.id !== "riskReduction" ? (
            <div className="panel-header">
              <h2>{currentSection.label}</h2>
            </div>
          ) : null}
          {currentSection.id !== "core" && currentSection.helper.trim().length > 0 ? (
            <p className="panel-description">{currentSection.helper}</p>
          ) : null}
          <div className="settings-form neris-field-grid">
            {currentSection.id === "emergingHazards" ? (
              <section className="field-span-two neris-emerging-hazard-layout">
                <div className="neris-core-field-heading">EMERGING HAZARDS</div>

                <article className="neris-emerging-hazard-group">
                  <div className="neris-emerging-hazard-group-header">
                    <h3 className="neris-core-field-heading">ELECTROCUTION</h3>
                    <button
                      type="button"
                      className="rl-box-button"
                      onClick={addEmergingElectrocutionItem}
                    >
                      + Add item
                    </button>
                  </div>

                  {emergingElectrocutionItems.length ? (
                    <div className="neris-emerging-hazard-item-list">
                      {emergingElectrocutionItems.map((item, itemIndex) => (
                        <div key={item.id} className="neris-emerging-hazard-item-card">
                          <div className="neris-emerging-hazard-item-title">
                            <span>Hazard {itemIndex + 1}</span>
                            <button
                              type="button"
                              className="neris-emerging-hazard-delete-button"
                              aria-label={`Delete electrocution hazard ${itemIndex + 1}`}
                              onClick={() => deleteEmergingElectrocutionItem(item.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="neris-emerging-hazard-field-grid">
                            <div className="neris-emerging-hazard-field">
                              <label>Electrical Hazard Type</label>
                              <NerisGroupedOptionSelect
                                inputId={`${item.id}-electrical-type`}
                                value={item.electricalHazardType}
                                options={getNerisValueOptions("emerg_haz_elec")}
                                onChange={(nextValue) =>
                                  updateEmergingElectrocutionItem(
                                    item.id,
                                    "electricalHazardType",
                                    nextValue,
                                  )
                                }
                                mode="single"
                                variant="incidentType"
                                placeholder="Select electrical hazard type"
                                searchPlaceholder="Search electrical hazard types..."
                              />
                            </div>
                            <div className="neris-emerging-hazard-field">
                              <label>Emerging Hazard Suppression Method(s)</label>
                              <NerisFlatMultiOptionSelect
                                inputId={`${item.id}-electrical-suppression`}
                                value={item.suppressionMethods}
                                options={getNerisValueOptions("emerg_haz_suppression")}
                                onChange={(nextValue) =>
                                  updateEmergingElectrocutionItem(
                                    item.id,
                                    "suppressionMethods",
                                    nextValue,
                                  )
                                }
                                placeholder="Select suppression method(s)"
                                searchPlaceholder="Search suppression methods..."
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>

                <article className="neris-emerging-hazard-group">
                  <div className="neris-emerging-hazard-group-header">
                    <h3 className="neris-core-field-heading">POWER GENERATION</h3>
                    <button
                      type="button"
                      className="rl-box-button"
                      onClick={addEmergingPowerGenerationItem}
                    >
                      + Add item
                    </button>
                  </div>

                  {emergingPowerGenerationItems.length ? (
                    <div className="neris-emerging-hazard-item-list">
                      {emergingPowerGenerationItems.map((item, itemIndex) => (
                        <div key={item.id} className="neris-emerging-hazard-item-card">
                          <div className="neris-emerging-hazard-item-title">
                            <span>Hazard {itemIndex + 1}</span>
                            <button
                              type="button"
                              className="neris-emerging-hazard-delete-button"
                              aria-label={`Delete power generation hazard ${itemIndex + 1}`}
                              onClick={() => deleteEmergingPowerGenerationItem(item.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="neris-emerging-hazard-field-grid">
                            <div className="neris-emerging-hazard-field">
                              <label>Photovoltaic Hazard Type</label>
                              <NerisFlatSingleOptionSelect
                                inputId={`${item.id}-pv-type`}
                                value={item.photovoltaicHazardType}
                                options={getNerisValueOptions("emerg_haz_pv")}
                                onChange={(nextValue) =>
                                  updateEmergingPowerGenerationItem(
                                    item.id,
                                    "photovoltaicHazardType",
                                    nextValue,
                                  )
                                }
                                placeholder="Select photovoltaic hazard type"
                                searchPlaceholder="Search photovoltaic hazard types..."
                              />
                            </div>
                            <div className="neris-emerging-hazard-field">
                              <label>Was PV the Source or Target?</label>
                              <div className="neris-single-choice-row" role="group" aria-label="Was PV the Source or Target?">
                                {pvSourceTargetOptions.map((option) => {
                                  const isSelected = option.value === item.pvSourceTarget;
                                  return (
                                    <button
                                      key={`${item.id}-pv-source-target-${option.value}`}
                                      type="button"
                                      className={`neris-single-choice-button${
                                        isSelected ? " selected" : ""
                                      }`}
                                      aria-pressed={isSelected}
                                      onClick={() =>
                                        updateEmergingPowerGenerationItem(
                                          item.id,
                                          "pvSourceTarget",
                                          togglePillValue(item.pvSourceTarget, option.value),
                                        )
                                      }
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="neris-emerging-hazard-field field-span-two">
                              <label>Emerging Hazard Suppression Method(s)</label>
                              <NerisFlatMultiOptionSelect
                                inputId={`${item.id}-power-suppression`}
                                value={item.suppressionMethods}
                                options={getNerisValueOptions("emerg_haz_suppression")}
                                onChange={(nextValue) =>
                                  updateEmergingPowerGenerationItem(
                                    item.id,
                                    "suppressionMethods",
                                    nextValue,
                                  )
                                }
                                placeholder="Select suppression method(s)"
                                searchPlaceholder="Search suppression methods..."
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              </section>
            ) : null}
            {currentSection.id === "riskReduction" ? (
              <section className="field-span-two neris-risk-reduction-layout">
                <div className="neris-core-field-heading">RISK REDUCTION</div>

                <div className="neris-risk-reduction-grid">
                  <div className="neris-risk-reduction-field">
                    <label>Risk reduction completed</label>
                    <div className="neris-single-choice-row" role="group" aria-label="Risk reduction completed">
                      {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                        const isSelected = option.value === riskReductionCompletedValue;
                        return (
                          <button
                            key={`risk-reduction-completed-${option.value}`}
                            type="button"
                            className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                            aria-pressed={isSelected}
                            onClick={() =>
                              updateFieldValue(
                                "risk_reduction_completed",
                                togglePillValue(riskReductionCompletedValue, option.value),
                              )
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="neris-risk-reduction-field">
                    <label>Follow-up required</label>
                    <div className="neris-single-choice-row" role="group" aria-label="Follow-up required">
                      {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                        const isSelected = option.value === riskReductionFollowUpValue;
                        return (
                          <button
                            key={`risk-reduction-follow-up-${option.value}`}
                            type="button"
                            className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                            aria-pressed={isSelected}
                            onClick={() =>
                              updateFieldValue(
                                "risk_reduction_follow_up_required",
                                togglePillValue(riskReductionFollowUpValue, option.value),
                              )
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="neris-risk-reduction-field">
                    <label>Contact Made?</label>
                    <div className="neris-single-choice-row" role="group" aria-label="Contact made">
                      {RISK_REDUCTION_YES_NO_OPTIONS.map((option) => {
                        const isSelected = option.value === riskReductionContactMadeValue;
                        return (
                          <button
                            key={`risk-reduction-contact-made-${option.value}`}
                            type="button"
                            className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                            aria-pressed={isSelected}
                            onClick={() =>
                              updateFieldValue(
                                "risk_reduction_contacts_made",
                                togglePillValue(riskReductionContactMadeValue, option.value),
                              )
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {riskReductionContactMadeValue === "YES" ? (
                  <section className="neris-risk-reduction-contact-box">
                    <div className="neris-risk-reduction-contact-grid">
                      <label>
                        Full Name
                        <input
                          type="text"
                          value={formValues.risk_reduction_contact_full_name ?? ""}
                          onChange={(event) =>
                            updateFieldValue(
                              "risk_reduction_contact_full_name",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        Phone Number
                        <input
                          type="text"
                          value={formValues.risk_reduction_contact_phone_number ?? ""}
                          onChange={(event) =>
                            updateFieldValue(
                              "risk_reduction_contact_phone_number",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        Street
                        <input
                          type="text"
                          value={formValues.risk_reduction_contact_street ?? ""}
                          onChange={(event) =>
                            updateFieldValue("risk_reduction_contact_street", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        City
                        <input
                          type="text"
                          value={formValues.risk_reduction_contact_city ?? ""}
                          onChange={(event) =>
                            updateFieldValue("risk_reduction_contact_city", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        State
                        <input
                          type="text"
                          value={formValues.risk_reduction_contact_state ?? ""}
                          onChange={(event) =>
                            updateFieldValue("risk_reduction_contact_state", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Zip Code
                        <input
                          type="text"
                          value={formValues.risk_reduction_contact_zip_code ?? ""}
                          onChange={(event) =>
                            updateFieldValue("risk_reduction_contact_zip_code", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </section>
                ) : null}

                {riskReductionCompletedValue === "YES" ? (
                  <div className="neris-risk-reduction-conditional-layout">
                    <section className="neris-risk-reduction-question-card">
                      <label>Was there at least one smoke alarm present?</label>
                      <div
                        className="neris-single-choice-row"
                        role="group"
                        aria-label="Was there at least one smoke alarm present?"
                      >
                        {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                          const isSelected = option.value === riskReductionSmokeAlarmPresentValue;
                          return (
                            <button
                              key={`risk-reduction-smoke-alarm-present-${option.value}`}
                              type="button"
                              className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() =>
                                updateFieldValue(
                                  "risk_reduction_smoke_alarm_present",
                                  togglePillValue(riskReductionSmokeAlarmPresentValue, option.value),
                                )
                              }
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>

                      {riskReductionSmokeAlarmPresentValue === "YES" ? (
                        <div className="neris-risk-reduction-subfields">
                          <div>
                            <label>
                              Was there at least one working or successfully test smoke alarm?
                            </label>
                            <div
                              className="neris-single-choice-row"
                              role="group"
                              aria-label="Was there at least one working or successfully test smoke alarm?"
                            >
                              {RISK_REDUCTION_YES_NO_OPTIONS.map((option) => {
                                const isSelected =
                                  option.value === riskReductionSmokeAlarmWorkingValue;
                                return (
                                  <button
                                    key={`risk-reduction-smoke-working-${option.value}`}
                                    type="button"
                                    className={`neris-single-choice-button${
                                      isSelected ? " selected" : ""
                                    }`}
                                    aria-pressed={isSelected}
                                    onClick={() =>
                                      updateFieldValue(
                                        "risk_reduction_smoke_alarm_working",
                                        togglePillValue(
                                          riskReductionSmokeAlarmWorkingValue,
                                          option.value,
                                        ),
                                      )
                                    }
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <label>Smoke Alarm Type(s)</label>
                            <NerisFlatMultiOptionSelect
                              inputId="risk-reduction-smoke-alarm-types"
                              value={formValues.risk_reduction_smoke_alarm_types ?? ""}
                              options={RISK_REDUCTION_SMOKE_ALARM_TYPE_OPTIONS}
                              onChange={(nextValue) =>
                                updateFieldValue("risk_reduction_smoke_alarm_types", nextValue)
                              }
                              placeholder="Select smoke alarm type(s)"
                              searchPlaceholder="Search smoke alarm types..."
                            />
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <section className="neris-risk-reduction-question-card">
                      <label>Was there at least one fire alarm present?</label>
                      <div
                        className="neris-single-choice-row"
                        role="group"
                        aria-label="Was there at least one fire alarm present?"
                      >
                        {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                          const isSelected = option.value === riskReductionFireAlarmPresentValue;
                          return (
                            <button
                              key={`risk-reduction-fire-alarm-present-${option.value}`}
                              type="button"
                              className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() =>
                                updateFieldValue(
                                  "risk_reduction_fire_alarm_present",
                                  togglePillValue(riskReductionFireAlarmPresentValue, option.value),
                                )
                              }
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      {riskReductionFireAlarmPresentValue === "YES" ? (
                        <div className="neris-risk-reduction-subfields">
                          <div>
                            <label>Fire Alarm Type(s)</label>
                            <NerisFlatMultiOptionSelect
                              inputId="risk-reduction-fire-alarm-types"
                              value={formValues.risk_reduction_fire_alarm_types ?? ""}
                              options={RISK_REDUCTION_FIRE_ALARM_TYPE_OPTIONS}
                              onChange={(nextValue) =>
                                updateFieldValue("risk_reduction_fire_alarm_types", nextValue)
                              }
                              placeholder="Select fire alarm type(s)"
                              searchPlaceholder="Search fire alarm types..."
                            />
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <section className="neris-risk-reduction-question-card">
                      <label>Were there any other alarms present?</label>
                      <div
                        className="neris-single-choice-row"
                        role="group"
                        aria-label="Were there any other alarms present?"
                      >
                        {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                          const isSelected = option.value === riskReductionOtherAlarmPresentValue;
                          return (
                            <button
                              key={`risk-reduction-other-alarm-present-${option.value}`}
                              type="button"
                              className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() =>
                                updateFieldValue(
                                  "risk_reduction_other_alarm_present",
                                  togglePillValue(riskReductionOtherAlarmPresentValue, option.value),
                                )
                              }
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      {riskReductionOtherAlarmPresentValue === "YES" ? (
                        <div className="neris-risk-reduction-subfields">
                          <div>
                            <label>Other Alarm Type(s)</label>
                            <NerisFlatMultiOptionSelect
                              inputId="risk-reduction-other-alarm-types"
                              value={formValues.risk_reduction_other_alarm_types ?? ""}
                              options={RISK_REDUCTION_OTHER_ALARM_TYPE_OPTIONS}
                              onChange={(nextValue) =>
                                updateFieldValue("risk_reduction_other_alarm_types", nextValue)
                              }
                              placeholder="Select other alarm type(s)"
                              searchPlaceholder="Search other alarm types..."
                            />
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <section className="neris-risk-reduction-question-card">
                      <label>Were there any fire suppresion systems present?</label>
                      <div
                        className="neris-single-choice-row"
                        role="group"
                        aria-label="Were there any fire suppression systems present?"
                      >
                        {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                          const isSelected =
                            option.value === riskReductionFireSuppressionPresentValue;
                          return (
                            <button
                              key={`risk-reduction-fire-suppression-present-${option.value}`}
                              type="button"
                              className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() => {
                                const nextValue = togglePillValue(
                                  riskReductionFireSuppressionPresentValue,
                                  option.value,
                                );
                                updateFieldValue(
                                  "risk_reduction_fire_suppression_present",
                                  nextValue,
                                );
                                if (
                                  nextValue === "YES" &&
                                  riskReductionSuppressionSystems.length === 0
                                ) {
                                  addRiskReductionSuppressionSystem();
                                }
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>

                      {riskReductionFireSuppressionPresentValue === "YES" ? (
                        <div className="neris-risk-reduction-subfields">
                          {riskReductionSuppressionSystems.map((system, systemIndex) => (
                            <div
                              key={system.id}
                              className="neris-risk-reduction-suppression-system-card"
                            >
                              <div className="neris-risk-reduction-suppression-system-header">
                                <strong>Fire Suppression System {systemIndex + 1}</strong>
                                <button
                                  type="button"
                                  className="neris-emerging-hazard-delete-button"
                                  aria-label={`Delete fire suppression system ${systemIndex + 1}`}
                                  onClick={() => deleteRiskReductionSuppressionSystem(system.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <div className="neris-risk-reduction-subfield-grid">
                                <label>
                                  Fire Suppression Type
                                  <input
                                    type="text"
                                    value={system.suppressionType}
                                    onChange={(event) =>
                                      updateRiskReductionSuppressionSystem(
                                        system.id,
                                        "suppressionType",
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                                <div>
                                  <label>Suppression System Coverage</label>
                                  <div
                                    className="neris-single-choice-row"
                                    role="group"
                                    aria-label="Suppression system coverage"
                                  >
                                    {RISK_REDUCTION_SUPPRESSION_COVERAGE_OPTIONS.map((option) => {
                                      const isSelected =
                                        option.value === system.suppressionCoverage;
                                      return (
                                        <button
                                          key={`${system.id}-coverage-${option.value}`}
                                          type="button"
                                          className={`neris-single-choice-button${
                                            isSelected ? " selected" : ""
                                          }`}
                                          aria-pressed={isSelected}
                                          onClick={() =>
                                            updateRiskReductionSuppressionSystem(
                                              system.id,
                                              "suppressionCoverage",
                                              togglePillValue(
                                                system.suppressionCoverage,
                                                option.value,
                                              ),
                                            )
                                          }
                                        >
                                          {option.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            className="fl-link-button"
                            onClick={addRiskReductionSuppressionSystem}
                          >
                            + Add Another Fire Suppression System
                          </button>
                        </div>
                      ) : null}
                    </section>

                    <section className="neris-risk-reduction-question-card">
                      <label>
                        Was there at least one cooking fire suppression system present?
                      </label>
                      <div
                        className="neris-single-choice-row"
                        role="group"
                        aria-label="Was there at least one cooking fire suppression system present?"
                      >
                        {RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS.map((option) => {
                          const isSelected =
                            option.value === riskReductionCookingSuppressionPresentValue;
                          return (
                            <button
                              key={`risk-reduction-cooking-suppression-present-${option.value}`}
                              type="button"
                              className={`neris-single-choice-button${isSelected ? " selected" : ""}`}
                              aria-pressed={isSelected}
                              onClick={() =>
                                updateFieldValue(
                                  "risk_reduction_cooking_suppression_present",
                                  togglePillValue(
                                    riskReductionCookingSuppressionPresentValue,
                                    option.value,
                                  ),
                                )
                              }
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      {riskReductionCookingSuppressionPresentValue === "YES" ? (
                        <div className="neris-risk-reduction-subfields">
                          <div>
                            <label>Cooking Fire Suppression Type(s)</label>
                            <NerisFlatMultiOptionSelect
                              inputId="risk-reduction-cooking-suppression-types"
                              value={formValues.risk_reduction_cooking_suppression_types ?? ""}
                              options={RISK_REDUCTION_COOKING_SUPPRESSION_TYPE_OPTIONS}
                              onChange={(nextValue) =>
                                updateFieldValue(
                                  "risk_reduction_cooking_suppression_types",
                                  nextValue,
                                )
                              }
                              placeholder="Select cooking fire suppression type(s)"
                              searchPlaceholder="Search cooking suppression types..."
                            />
                          </div>
                        </div>
                      ) : null}
                    </section>
                  </div>
                ) : null}
              </section>
            ) : null}
            {currentSection.id === "resources" ? (
              <section className="field-span-two neris-resource-unit-list">
                {resourceUnits.length ? (
                  resourceUnits.map((unitEntry) => {
                    const selectedPersonnelValues = unitEntry.personnel
                      .split(",")
                      .map((entry) => entry.trim())
                      .filter((entry) => entry.length > 0);
                    const selectedPersonnelOptions = selectedPersonnelValues
                      .map((value) =>
                        RESOURCE_PERSONNEL_OPTIONS.find((option) => option.value === value),
                      )
                      .filter((option): option is NerisValueOption => Boolean(option));
                    const reportWriterOptions = selectedPersonnelOptions.length
                      ? selectedPersonnelOptions
                      : RESOURCE_PERSONNEL_OPTIONS;
                    const staffingDisplay = getStaffingValueForUnit(
                      unitEntry.unitId,
                      unitEntry.personnel,
                    );
                    const unitTypeDisplayLabel =
                      unitTypeOptions.find((option) => option.value === unitEntry.unitType)?.label ??
                      unitEntry.unitType;
                    const personnelError =
                      sectionErrors[resourceUnitValidationErrorKey(unitEntry.id, "personnel")] ?? "";
                    const dispatchTimeError =
                      sectionErrors[resourceUnitValidationErrorKey(unitEntry.id, "dispatchTime")] ??
                      "";
                    const enrouteTimeError =
                      sectionErrors[resourceUnitValidationErrorKey(unitEntry.id, "enrouteTime")] ??
                      "";
                    const onSceneTimeError =
                      sectionErrors[resourceUnitValidationErrorKey(unitEntry.id, "onSceneTime")] ??
                      "";
                    const clearTimeError =
                      sectionErrors[resourceUnitValidationErrorKey(unitEntry.id, "clearTime")] ?? "";

                    return (
                      <article key={unitEntry.id} className="neris-resource-unit-card">
                        <header className="neris-resource-unit-header">
                          <div className="neris-resource-unit-summary">
                            <strong className="neris-resource-unit-name">
                              {unitEntry.unitId || "Unassigned unit"}
                            </strong>
                            <button
                              type="button"
                              className={`neris-resource-complete-chip ${
                                unitEntry.isComplete ? "complete" : "incomplete"
                              }`}
                              onClick={() => toggleResourceUnitComplete(unitEntry.id)}
                            >
                              <span className="neris-resource-complete-check">
                                {unitEntry.isComplete ? "x" : ""}
                              </span>
                              {unitEntry.isComplete ? "Complete" : "Incomplete"}
                            </button>
                            <span className="neris-resource-personnel-indicator">
                              <Users size={14} />
                              <strong>{staffingDisplay || "0"}</strong>
                            </span>
                            <div className="neris-resource-time-grid">
                              <div className="neris-resource-time-item">
                                <span>Dispatch</span>
                                <strong>{toResourceSummaryTime(unitEntry.dispatchTime)}</strong>
                              </div>
                              <div className="neris-resource-time-item">
                                <span>Enroute</span>
                                <strong>{toResourceSummaryTime(unitEntry.enrouteTime)}</strong>
                              </div>
                              <div className="neris-resource-time-item">
                                <span>On Scene</span>
                                <strong>{toResourceSummaryTime(unitEntry.onSceneTime)}</strong>
                              </div>
                              <div className="neris-resource-time-item">
                                <span>Clear</span>
                                <strong>{toResourceSummaryTime(unitEntry.clearTime)}</strong>
                              </div>
                            </div>
                          </div>
                          <div className="neris-resource-unit-actions">
                            <button
                              type="button"
                              className="neris-resource-delete-button"
                              onClick={() => deleteResourceUnit(unitEntry.id)}
                              aria-label={`Delete ${unitEntry.unitId || "unit"} block`}
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={
                                unitEntry.isExpanded
                                  ? "Collapse unit details"
                                  : "Expand unit details"
                              }
                              onClick={() => toggleResourceUnitExpanded(unitEntry.id)}
                            >
                              <ChevronDown
                                size={14}
                                className={`neris-resource-expand-icon${
                                  unitEntry.isExpanded ? " open" : ""
                                }`}
                              />
                            </button>
                          </div>
                        </header>
                        {unitEntry.isExpanded ? (
                          <div className="neris-resource-unit-body">
                            <div className="neris-resource-field-grid">
                              <div className="neris-resource-field field-span-two">
                                <label>Unit Response Mode</label>
                                <div className="neris-single-choice-row" role="group" aria-label="Unit response mode">
                                  {responseModeOptions.map((option) => {
                                    const isSelected = option.value === unitEntry.responseMode;
                                    return (
                                      <button
                                        key={`${unitEntry.id}-response-mode-${option.value}`}
                                        type="button"
                                        className={`neris-single-choice-button${
                                          isSelected ? " selected" : ""
                                        }`}
                                        aria-pressed={isSelected}
                                        onClick={() =>
                                          updateResourceUnitField(
                                            unitEntry.id,
                                            "responseMode",
                                            isSelected ? "" : option.value,
                                          )
                                        }
                                      >
                                        {option.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="neris-resource-field">
                                <label>Responding Unit ID</label>
                                <NerisFlatSingleOptionSelect
                                  inputId={`${unitEntry.id}-unit-id`}
                                  value={unitEntry.unitId}
                                  options={availableResourceUnitOptions}
                                  onChange={(nextValue) =>
                                    handleResourceUnitIdChange(unitEntry.id, nextValue)
                                  }
                                  isOptionDisabled={(optionValue) =>
                                    optionValue !== unitEntry.unitId &&
                                    resourceUnits.some(
                                      (otherUnit) =>
                                        otherUnit.id !== unitEntry.id &&
                                        otherUnit.unitId.trim() === optionValue,
                                    )
                                  }
                                  placeholder="Select responding unit"
                                  searchPlaceholder="Search responding units..."
                                />
                              </div>
                              <div className="neris-resource-field">
                                <label>Unit Type</label>
                                <input
                                  type="text"
                                  value={unitTypeDisplayLabel}
                                  readOnly
                                  className="neris-resource-unit-type-input"
                                  placeholder="Auto-populates from unit setup"
                                />
                              </div>
                            </div>

                            <div className="neris-resource-inline-links">
                              <button
                                type="button"
                                className="link-button"
                                aria-expanded={unitEntry.showTimesEditor}
                                onClick={() => toggleResourceTimesEditor(unitEntry.id)}
                              >
                                Edit Times
                              </button>
                              <label className="neris-resource-canceled-enroute-inline">
                                <input
                                  type="checkbox"
                                  checked={unitEntry.isCanceledEnroute}
                                  onChange={() => toggleResourceCanceledEnroute(unitEntry.id)}
                                />
                                <span>Dispatched and canceled en route</span>
                              </label>
                            </div>

                            {unitEntry.showTimesEditor ? (
                              <div className="neris-resource-times-editor">
                                <div className="neris-resource-times-editor-grid">
                                  <label>
                                    Dispatch
                                    <input
                                      type="datetime-local"
                                      step={1}
                                      value={unitEntry.dispatchTime}
                                      onChange={(event) =>
                                        updateResourceUnitField(
                                          unitEntry.id,
                                          "dispatchTime",
                                          event.target.value,
                                        )
                                      }
                                    />
                                    {dispatchTimeError ? (
                                      <small className="field-error">{dispatchTimeError}</small>
                                    ) : null}
                                  </label>
                                  <label>
                                    Enroute
                                    <input
                                      type="datetime-local"
                                      step={1}
                                      value={unitEntry.enrouteTime}
                                      onChange={(event) =>
                                        updateResourceUnitField(
                                          unitEntry.id,
                                          "enrouteTime",
                                          event.target.value,
                                        )
                                      }
                                    />
                                    {enrouteTimeError ? (
                                      <small className="field-error">{enrouteTimeError}</small>
                                    ) : null}
                                  </label>
                                  <label>
                                    On Scene
                                    <input
                                      type="datetime-local"
                                      step={1}
                                      value={unitEntry.onSceneTime}
                                      onChange={(event) =>
                                        updateResourceUnitField(
                                          unitEntry.id,
                                          "onSceneTime",
                                          event.target.value,
                                        )
                                      }
                                    />
                                    {onSceneTimeError ? (
                                      <small className="field-error">{onSceneTimeError}</small>
                                    ) : null}
                                  </label>
                                  <label>
                                    Clear
                                    <input
                                      type="datetime-local"
                                      step={1}
                                      value={unitEntry.clearTime}
                                      onChange={(event) =>
                                        updateResourceUnitField(
                                          unitEntry.id,
                                          "clearTime",
                                          event.target.value,
                                        )
                                      }
                                    />
                                    {clearTimeError ? (
                                      <small className="field-error">{clearTimeError}</small>
                                    ) : null}
                                  </label>
                                </div>
                                <button
                                  type="button"
                                  className={`neris-resource-canceled-enroute-button${
                                    unitEntry.isCanceledEnroute ? " active" : ""
                                  }`}
                                  aria-pressed={unitEntry.isCanceledEnroute}
                                  onClick={() => toggleResourceCanceledEnroute(unitEntry.id)}
                                >
                                  Dispatched and canceled en route
                                </button>
                              </div>
                            ) : null}

                            <section className="neris-resource-personnel-panel">
                              <div className="neris-resource-personnel-header-row">
                                <h4>Personnel</h4>
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={() => openResourcePersonnelModal(unitEntry.id)}
                                >
                                  Add Personnel
                                </button>
                              </div>
                              <div className="neris-resource-personnel-table-head">
                                <span>Name</span>
                              </div>
                              {selectedPersonnelOptions.length ? (
                                <ul className="neris-resource-personnel-list">
                                  {selectedPersonnelOptions.map((option) => (
                                    <li key={`${unitEntry.id}-personnel-${option.value}`}>
                                      <span>{option.label}</span>
                                      <div className="neris-resource-personnel-row-actions">
                                        <button
                                          type="button"
                                          className="icon-button"
                                          aria-label={`Edit ${option.label} assignment`}
                                        >
                                          <Pencil size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          className="icon-button"
                                          aria-label={`Remove ${option.label} from this unit`}
                                          onClick={() =>
                                            removeResourcePersonnel(unitEntry.id, option.value)
                                          }
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="neris-resource-personnel-empty">
                                  <Users size={24} className="neris-resource-personnel-empty-icon" />
                                  <p>No personnel assigned to this unit.</p>
                                  <small>Add personnel using the Add Personnel link above.</small>
                                </div>
                              )}
                              {personnelError ? (
                                <small className="field-error neris-resource-personnel-error">
                                  {personnelError}
                                </small>
                              ) : null}
                            </section>

                            <div className="neris-resource-field">
                              <label>Unit Report Writer</label>
                              <NerisFlatSingleOptionSelect
                                inputId={`${unitEntry.id}-report-writer`}
                                value={unitEntry.reportWriter}
                                options={reportWriterOptions}
                                onChange={(nextValue) =>
                                  updateResourceUnitField(
                                    unitEntry.id,
                                    "reportWriter",
                                    nextValue,
                                  )
                                }
                                placeholder="Select report writer"
                                searchPlaceholder="Search personnel..."
                                allowClear
                              />
                            </div>

                            <div className="neris-resource-unit-narrative">
                              <div className="neris-core-field-heading neris-resource-unit-narrative-heading">
                                UNIT NARRATIVE
                              </div>
                              <textarea
                                rows={6}
                                value={unitEntry.unitNarrative}
                                placeholder="Insert text here..."
                                onChange={(event) =>
                                  updateResourceUnitField(
                                    unitEntry.id,
                                    "unitNarrative",
                                    event.target.value,
                                  )
                                }
                              />
                            </div>

                            <div className="neris-resource-footer-actions">
                              <button
                                type="button"
                                className="primary-button compact-button neris-resource-complete-collapse-button"
                                onClick={() => completeAndCollapseResourceUnit(unitEntry.id)}
                              >
                                Complete and Collapse
                              </button>
                              <button
                                type="button"
                                className="primary-button compact-button"
                                onClick={() => collapseResourceUnit(unitEntry.id)}
                              >
                                Collapse
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="neris-resource-empty-state">
                    No responding units are available for this incident yet.
                  </div>
                )}
              </section>
            ) : null}
            {currentSection.id === "resources" && activeResourcePersonnelUnit ? (
              <div
                className="neris-resource-personnel-modal-backdrop"
                role="dialog"
                aria-modal="true"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    closeResourcePersonnelModal();
                  }
                }}
              >
                <section
                  className="panel neris-resource-personnel-modal"
                  onWheel={(event) => event.stopPropagation()}
                >
                  <div className="neris-resource-personnel-modal-header">
                    <h3>
                      Add Personnel
                      {activeResourcePersonnelUnit.unitId
                        ? ` - ${activeResourcePersonnelUnit.unitId}`
                        : ""}
                    </h3>
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={closeResourcePersonnelModal}
                    >
                      Close
                    </button>
                  </div>
                  <NerisFlatMultiOptionSelect
                    inputId={`resource-personnel-modal-${activeResourcePersonnelUnit.id}`}
                    value={activeResourcePersonnelUnit.personnel}
                    options={RESOURCE_PERSONNEL_OPTIONS}
                    onChange={(nextValue) =>
                      updateResourceUnitField(activeResourcePersonnelUnit.id, "personnel", nextValue)
                    }
                    placeholder="Select personnel"
                    searchPlaceholder="Search personnel..."
                  />
                  <small className="field-hint">
                    Select one or more personnel. Click outside this dialog to close.
                  </small>
                </section>
              </div>
            ) : null}
            {displayedSectionFields.flatMap((field) => {
              const nodes: ReactNode[] = [];
              const headingLabel =
                currentSection.id === "core" ? CORE_SECTION_FIELD_HEADERS[field.id] : undefined;
              if (headingLabel) {
                nodes.push(
                  <div key={`heading-${field.id}`} className="field-span-two neris-core-field-heading">
                    {headingLabel}
                  </div>,
                );
              }
              if (currentSection.id === "location" && field.id === "location_state") {
                nodes.push(
                  <div
                    key="heading-location-usage"
                    className="field-span-two neris-core-field-heading"
                  >
                    LOCATION / USAGE
                  </div>,
                );
                nodes.push(
                  <div
                    key="location-imported-address"
                    className="field-span-two neris-imported-address-block"
                  >
                    <div className="neris-imported-address-header">
                      <label htmlFor="location-imported-address-box">Imported address</label>
                      <button
                        type="button"
                        className="secondary-button compact-button neris-imported-address-sync-button"
                        onClick={handlePullLocationFromImportedAddress}
                      >
                        Pull location data
                      </button>
                    </div>
                    <div id="location-imported-address-box" className="neris-imported-address">
                      {importedLocationAddress}
                    </div>
                  </div>,
                );
              }
              if (currentSection.id === "location" && field.id === "location_direction_of_travel") {
                nodes.push(
                  <div
                    key="location-direction-of-travel-link"
                    className="field-span-two neris-location-add-links"
                  >
                    <button
                      type="button"
                      className="link-button"
                      aria-expanded={showDirectionOfTravelField}
                      onClick={() =>
                        setShowDirectionOfTravelField((previous) => !previous)
                      }
                    >
                      Add Direction of Travel
                    </button>
                  </div>,
                );
              }
              if (currentSection.id === "location" && field.id === "location_cross_street_type") {
                nodes.push(
                  <div
                    key="location-cross-street-link"
                    className="field-span-two neris-location-add-links"
                  >
                    <button
                      type="button"
                      className="link-button"
                      aria-expanded={showCrossStreetTypeField}
                      onClick={() =>
                        setShowCrossStreetTypeField((previous) => !previous)
                      }
                    >
                      Add Cross Street
                    </button>
                  </div>,
                );
              }
              nodes.push(renderNerisField(field, `field-${field.id}`));
              return nodes;
            })}
          </div>

          {validationIssues.length ? (
            <div className="validation-issue-list">
              <p>Required fields to complete:</p>
              <ul>
                {validationIssues.map((fieldLabel) => (
                  <li key={`validation-issue-${fieldLabel}`}>{fieldLabel}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="neris-form-actions">
            <button type="button" className="secondary-button compact-button" onClick={handleBack}>
              Back
            </button>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={handleSaveDraft}
            >
              Save
            </button>
            <button
              type="button"
              className="primary-button compact-button"
              onClick={goToNextSection}
              disabled={!hasNextSection}
            >
              Next
            </button>
          </div>
        </article>
      </section>
    </section>
  );
}

function DepartmentDetailsPage() {
  const initialDepartmentDraft = normalizeDepartmentDraft(readDepartmentDetailsDraft());
  const [departmentName, setDepartmentName] = useState(String(initialDepartmentDraft.departmentName ?? ""));
  const [departmentStreet, setDepartmentStreet] = useState(String(initialDepartmentDraft.departmentStreet ?? ""));
  const [departmentCity, setDepartmentCity] = useState(String(initialDepartmentDraft.departmentCity ?? ""));
  const [departmentState, setDepartmentState] = useState(String(initialDepartmentDraft.departmentState ?? ""));
  const [departmentZipCode, setDepartmentZipCode] = useState(String(initialDepartmentDraft.departmentZipCode ?? ""));
  const [departmentTimeZone, setDepartmentTimeZone] = useState(String(initialDepartmentDraft.departmentTimeZone ?? ""));
  const [mainContactName, setMainContactName] = useState(String(initialDepartmentDraft.mainContactName ?? ""));
  const [mainContactPhone, setMainContactPhone] = useState(String(initialDepartmentDraft.mainContactPhone ?? ""));
  const [secondaryContactName, setSecondaryContactName] = useState(String(initialDepartmentDraft.secondaryContactName ?? ""));
  const [secondaryContactPhone, setSecondaryContactPhone] = useState(String(initialDepartmentDraft.secondaryContactPhone ?? ""));
  const [departmentLogoFileName, setDepartmentLogoFileName] = useState(String(initialDepartmentDraft.departmentLogoFileName ?? "No file selected"));
  const [stationRecords, setStationRecords] = useState<DepartmentStationRecord[]>(
    Array.isArray(initialDepartmentDraft.stationRecords) ? (initialDepartmentDraft.stationRecords as DepartmentStationRecord[]) : [],
  );
  const [apparatusRecords, setApparatusRecords] = useState<DepartmentApparatusRecord[]>(
    Array.isArray(initialDepartmentDraft.apparatusRecords) ? (initialDepartmentDraft.apparatusRecords as DepartmentApparatusRecord[]) : [],
  );
  const [shiftInformationEntries, setShiftInformationEntries] = useState<ShiftInformationEntry[]>(
    Array.isArray(initialDepartmentDraft.shiftInformationEntries) ? (initialDepartmentDraft.shiftInformationEntries as ShiftInformationEntry[]) : [],
  );
  const [personnelRecords, setPersonnelRecords] = useState<DepartmentPersonnelRecord[]>(() => {
    const raw = initialDepartmentDraft.personnelRecords;
    if (!Array.isArray(raw)) return [];
    return raw.map((entry: Record<string, unknown>) => ({
      name: String(entry.name ?? ""),
      shift: String(entry.shift ?? ""),
      apparatusAssignment: String(entry.apparatusAssignment ?? ""),
      station: String(entry.station ?? ""),
      userType: String(entry.userType ?? ""),
      qualifications: Array.isArray(entry.qualifications)
        ? (entry.qualifications as string[]).filter((q): q is string => typeof q === "string")
        : [],
    }));
  });
  const [personnelQualifications, setPersonnelQualifications] = useState<string[]>(
    Array.isArray(initialDepartmentDraft.personnelQualifications) ? (initialDepartmentDraft.personnelQualifications as string[]) : [],
  );
  const [userTypeValues, setUserTypeValues] = useState<string[]>(
    Array.isArray(initialDepartmentDraft.userTypeValues) && initialDepartmentDraft.userTypeValues.length > 0
      ? (initialDepartmentDraft.userTypeValues as string[])
      : [...DEFAULT_USER_TYPE_VALUES],
  );
  const [mutualAidOptions, setMutualAidOptions] = useState<DepartmentNerisEntityOption[]>(DEPARTMENT_ENTITY_FALLBACK_OPTIONS);
  const [selectedMutualAidIds, setSelectedMutualAidIds] = useState<string[]>(
    Array.isArray(initialDepartmentDraft.selectedMutualAidIds) ? (initialDepartmentDraft.selectedMutualAidIds as string[]) : [],
  );
  const [activeCollectionEditor, setActiveCollectionEditor] = useState<DepartmentCollectionKey | null>(null);
  const [isMultiEditMode, setIsMultiEditMode] = useState(false);
  const [selectedSingleIndex, setSelectedSingleIndex] = useState<number | null>(null);
  const [selectedMultiIndices, setSelectedMultiIndices] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [stationDraft, setStationDraft] = useState<DepartmentStationRecord>({
    name: "",
    address: "",
    city: "",
    state: "",
    phone: "",
    mobilePhone: "",
  });
  const [apparatusDraft, setApparatusDraft] = useState<DepartmentApparatusRecord>({
    unitId: "",
    unitType: "",
    minimumPersonnel: 0,
    personnelRequirements: [],
    station: "",
  });
  const [shiftDraft, setShiftDraft] = useState<ShiftInformationEntry>({
    shiftType: "",
    shiftDuration: 0,
    recurrence: "Daily",
    recurrenceCustomValue: "",
    location: "",
  });
  const [personnelDraft, setPersonnelDraft] = useState<DepartmentPersonnelRecord>({
    name: "",
    shift: "",
    apparatusAssignment: "",
    station: "",
    userType: "",
    qualifications: [],
  });
  const [personnelBulkDraft, setPersonnelBulkDraft] = useState({
    shift: "",
    apparatusAssignment: "",
    station: "",
    userType: "",
    qualifications: [] as string[],
  });
  const [userTypeDraft, setUserTypeDraft] = useState("");
  const [qualificationDraft, setQualificationDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isEntryFormOpen, setIsEntryFormOpen] = useState(false);
  const [editingQualificationIndex, setEditingQualificationIndex] = useState<number | null>(null);
  const [dragQualificationIndex, setDragQualificationIndex] = useState<number | null>(null);
  const [autoSaveTick, setAutoSaveTick] = useState(0);
  const [apparatusFieldWidths, setApparatusFieldWidths] = useState<Record<ApparatusGridFieldId, number>>(
    () => ({ ...DEFAULT_APPARATUS_FIELD_WIDTHS }),
  );
  const [apparatusFieldOrder, setApparatusFieldOrder] = useState<ApparatusGridFieldId[]>(() => [
    ...APPARATUS_GRID_FIELD_ORDER,
  ]);
  const [isApparatusFieldEditorOpen, setIsApparatusFieldEditorOpen] = useState(false);
  const [dragApparatusFieldId, setDragApparatusFieldId] = useState<ApparatusGridFieldId | null>(null);
  const activeApparatusResizeField = useRef<{
    fieldId: ApparatusGridFieldId;
    startX: number;
    startWidth: number;
  } | null>(null);

  const unitTypeOptions = useMemo(() => getNerisValueOptions("unit_type"), []);
  const apparatusFieldLabelById = useMemo(
    () =>
      ({
        unitType: "Unit Type",
        minPersonnel: "Min Personnel",
        personnelRequirements: "Minimum Requirements",
        station: "Station",
      }) as Record<ApparatusGridFieldId, string>,
    [],
  );
  const getApparatusFieldValue = useCallback(
    (apparatus: DepartmentApparatusRecord, fieldId: ApparatusGridFieldId): string => {
      switch (fieldId) {
        case "unitType":
          return (unitTypeOptions.find((o) => o.value === apparatus.unitType)?.label ?? apparatus.unitType) || "—";
        case "minPersonnel":
          return String(apparatus.minimumPersonnel);
        case "personnelRequirements":
          return apparatus.personnelRequirements.length > 0 ? apparatus.personnelRequirements.join(", ") : "—";
        case "station":
          return apparatus.station || "—";
        default:
          return "—";
      }
    },
    [unitTypeOptions],
  );
  const apparatusGridStyle = useMemo(
    () =>
      ({
        "--apparatus-grid-columns": apparatusFieldOrder
          .map((fieldId) => {
            const width = apparatusFieldWidths[fieldId] ?? DEFAULT_APPARATUS_FIELD_WIDTHS[fieldId];
            const clampedWidth = Math.min(
              MAX_APPARATUS_FIELD_WIDTH,
              Math.max(MIN_APPARATUS_FIELD_WIDTH, width),
            );
            return `${clampedWidth}px`;
          })
          .join(" "),
      }) as CSSProperties,
    [apparatusFieldOrder, apparatusFieldWidths],
  );
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const activeResize = activeApparatusResizeField.current;
      if (!activeResize) {
        return;
      }
      const delta = event.clientX - activeResize.startX;
      const nextWidth = Math.min(
        MAX_APPARATUS_FIELD_WIDTH,
        Math.max(MIN_APPARATUS_FIELD_WIDTH, activeResize.startWidth + delta),
      );
      setApparatusFieldWidths((previous) => {
        if (previous[activeResize.fieldId] === nextWidth) {
          return previous;
        }
        return { ...previous, [activeResize.fieldId]: nextWidth };
      });
    };
    const stopResize = () => {
      if (!activeApparatusResizeField.current) {
        return;
      }
      activeApparatusResizeField.current = null;
      document.body.classList.remove("resizing-dispatch-columns");
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.classList.remove("resizing-dispatch-columns");
    };
  }, []);
  const startApparatusFieldResize = (
    fieldId: ApparatusGridFieldId,
    event: ReactPointerEvent<HTMLSpanElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    activeApparatusResizeField.current = {
      fieldId,
      startX: event.clientX,
      startWidth: apparatusFieldWidths[fieldId] ?? DEFAULT_APPARATUS_FIELD_WIDTHS[fieldId],
    };
    document.body.classList.add("resizing-dispatch-columns");
  };
  const handleApparatusFieldDrop = (targetFieldId: ApparatusGridFieldId) => {
    if (!dragApparatusFieldId || dragApparatusFieldId === targetFieldId) {
      return;
    }
    const fromIndex = apparatusFieldOrder.indexOf(dragApparatusFieldId);
    const toIndex = apparatusFieldOrder.indexOf(targetFieldId);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }
    const nextOrder = [...apparatusFieldOrder];
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, dragApparatusFieldId);
    setApparatusFieldOrder(nextOrder);
    setDragApparatusFieldId(null);
  };
  const activeCollectionDefinition = useMemo(
    () =>
      activeCollectionEditor
        ? DEPARTMENT_COLLECTION_DEFINITIONS.find((definition) => definition.key === activeCollectionEditor)
        : undefined,
    [activeCollectionEditor],
  );

  const stationNames = useMemo(
    () => stationRecords.map((station) => station.name).filter((name) => name.trim().length > 0),
    [stationRecords],
  );
  const sortedStationRecords = useMemo(
    () => [...stationRecords].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })),
    [stationRecords],
  );
  const sortedApparatusRecords = useMemo(
    () => [...apparatusRecords].sort((a, b) => (a.unitId || "").localeCompare(b.unitId || "", undefined, { sensitivity: "base" })),
    [apparatusRecords],
  );
  const apparatusNames = useMemo(
    () =>
      apparatusRecords
        .map((apparatus) => `${apparatus.unitId}${apparatus.unitType ? ` (${apparatus.unitType})` : ""}`)
        .filter((entry) => entry.trim().length > 0),
    [apparatusRecords],
  );
  const shiftOptionValues = useMemo(
    () =>
      shiftInformationEntries.map((entry) => {
        const recurrenceLabel =
          entry.recurrence === "Custom" && entry.recurrenceCustomValue.trim().length > 0
            ? entry.recurrenceCustomValue
            : entry.recurrence;
        return `${entry.shiftType} | ${entry.shiftDuration} | ${recurrenceLabel}${
          entry.location.trim().length > 0 ? ` | ${entry.location}` : ""
        }`;
      }),
    [shiftInformationEntries],
  );

  const detailCardOrder: DepartmentCollectionKey[] = [
    "stations",
    "personnelQualifications",
    "apparatus",
    "shiftInformation",
    "personnel",
  ];
  const detailCards = detailCardOrder
    .map((key) =>
      DEPARTMENT_COLLECTION_DEFINITIONS.find((definition) => definition.key === key),
    )
    .filter((definition): definition is DepartmentCollectionDefinition =>
      Boolean(definition),
    );
  const resourceCards = DEPARTMENT_COLLECTION_DEFINITIONS.filter(
    (definition) => definition.key === "mutualAidDepartments",
  );
  const accessCards = DEPARTMENT_COLLECTION_DEFINITIONS.filter(
    (definition) => definition.key === "userType",
  );

  const isStationsEditor = activeCollectionEditor === "stations";
  const isApparatusEditor = activeCollectionEditor === "apparatus";
  const isPersonnelEditor = activeCollectionEditor === "personnel";
  const isShiftEditor = activeCollectionEditor === "shiftInformation";
  const isQualificationsEditor = activeCollectionEditor === "personnelQualifications";
  const isUserTypeEditor = activeCollectionEditor === "userType";
  const isMutualAidEditor = activeCollectionEditor === "mutualAidDepartments";

  useEffect(() => {
    let isMounted = true;
    const fetchEntityOptions = async () => {
      try {
        const response = await fetch("/api/neris/debug/entities");
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          neris?: { entities?: Array<Record<string, unknown>> };
        };
        const rawEntities = Array.isArray(payload.neris?.entities) ? payload.neris.entities : [];
        const options = rawEntities
          .map((entry) => {
            const id = String(entry.neris_id ?? "").trim();
            const name = String(entry.name ?? entry.entity_name ?? entry.department_name ?? "").trim();
            if (!/^FD\d{8}$/.test(id)) {
              return null;
            }
            return { id, name: name.length > 0 ? name : `Department ${id}` };
          })
          .filter((entry): entry is DepartmentNerisEntityOption => Boolean(entry));
        if (isMounted && options.length > 0) {
          setMutualAidOptions(options);
        }
      } catch {
        // Keep fallback list.
      }
    };
    void fetchEntityOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadFromApi = async () => {
      try {
        const response = await fetch("/api/department-details");
        if (!response.ok || !isMounted) return;
        const json = (await response.json()) as { ok?: boolean; data?: Record<string, unknown> };
        if (!json?.ok || !json?.data || !isMounted) return;
        const d = normalizeDepartmentDraft(json.data);
        setDepartmentName(String(d.departmentName ?? ""));
        setDepartmentStreet(String(d.departmentStreet ?? ""));
        setDepartmentCity(String(d.departmentCity ?? ""));
        setDepartmentState(String(d.departmentState ?? ""));
        setDepartmentZipCode(String(d.departmentZipCode ?? ""));
        setDepartmentTimeZone(String(d.departmentTimeZone ?? ""));
        setMainContactName(String(d.mainContactName ?? ""));
        setMainContactPhone(String(d.mainContactPhone ?? ""));
        setSecondaryContactName(String(d.secondaryContactName ?? ""));
        setSecondaryContactPhone(String(d.secondaryContactPhone ?? ""));
        setDepartmentLogoFileName(String(d.departmentLogoFileName ?? "No file selected"));
        setStationRecords(
          Array.isArray(d.stationRecords) ? (d.stationRecords as DepartmentStationRecord[]) : [],
        );
        setApparatusRecords(
          Array.isArray(d.apparatusRecords) ? (d.apparatusRecords as DepartmentApparatusRecord[]) : [],
        );
        setShiftInformationEntries(
          Array.isArray(d.shiftInformationEntries)
            ? (d.shiftInformationEntries as ShiftInformationEntry[])
            : [],
        );
        setPersonnelRecords(
          Array.isArray(d.personnelRecords) ? (d.personnelRecords as DepartmentPersonnelRecord[]) : [],
        );
        setPersonnelQualifications(
          Array.isArray(d.personnelQualifications) ? (d.personnelQualifications as string[]) : [],
        );
        setUserTypeValues(
          Array.isArray(d.userTypeValues) && (d.userTypeValues as string[]).length > 0
            ? (d.userTypeValues as string[])
            : [...DEFAULT_USER_TYPE_VALUES],
        );
        setSelectedMutualAidIds(
          Array.isArray(d.selectedMutualAidIds) ? (d.selectedMutualAidIds as string[]) : [],
        );
      } catch {
        // Keep localStorage initial values.
      }
    };
    void loadFromApi();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogoSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setDepartmentLogoFileName(file?.name ?? "No file selected");
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof window === "undefined") {
        return;
      }
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      window.localStorage.setItem(DEPARTMENT_LOGO_DATA_URL_STORAGE_KEY, dataUrl);
      window.dispatchEvent(new Event("department-logo-updated"));
    };
    reader.readAsDataURL(file);
  };

  const resetEditorSelection = () => {
    setIsMultiEditMode(false);
    setSelectedSingleIndex(null);
    setSelectedMultiIndices([]);
    setIsEntryFormOpen(false);
    setEditingIndex(null);
  };

  const openCollectionEditor = (collectionKey: DepartmentCollectionKey) => {
    setActiveCollectionEditor(collectionKey);
    resetEditorSelection();
    if (collectionKey === "userType") {
      setUserTypeDraft("");
    }
    if (collectionKey === "personnelQualifications") {
      setQualificationDraft("");
      setEditingQualificationIndex(null);
    }
  };

  const closeCollectionEditor = () => {
    setActiveCollectionEditor(null);
    resetEditorSelection();
  };

  const setSelectionFromMultiSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedMultiIndices(
      Array.from(event.target.selectedOptions)
        .map((option) => Number.parseInt(option.value, 10))
        .filter((value) => Number.isFinite(value)),
    );
  };

  const openAddForm = () => {
    setEditingIndex(null);
    if (isStationsEditor) {
      setStationDraft({
        name: "",
        address: "",
        city: departmentCity || "",
        state: departmentState || "",
        phone: "",
        mobilePhone: "",
      });
    }
    if (isApparatusEditor) {
      setApparatusDraft({
        unitId: "",
        unitType: "",
        minimumPersonnel: 0,
        personnelRequirements: [],
        station: "",
      });
    }
    if (isPersonnelEditor) {
      setPersonnelDraft({
        name: "",
        shift: "",
        apparatusAssignment: "",
        station: "",
        userType: "",
        qualifications: [],
      });
      setPersonnelBulkDraft({
        shift: "",
        apparatusAssignment: "",
        station: "",
        userType: "",
        qualifications: [],
      });
    }
    setIsEntryFormOpen(true);
  };

  const openEditForm = (clickedIndex?: number) => {
    if (!isMultiEditMode) {
      const index = clickedIndex ?? selectedSingleIndex;
      if (index === null) {
        return;
      }
      setSelectedSingleIndex(index);
      setEditingIndex(index);
      if (isStationsEditor && stationRecords[index]) {
        setStationDraft(stationRecords[index]!);
      }
      if (isApparatusEditor && apparatusRecords[index]) {
        setApparatusDraft(apparatusRecords[index]!);
      }
      if (isPersonnelEditor && personnelRecords[index]) {
        setPersonnelDraft(personnelRecords[index]!);
      }
      setIsEntryFormOpen(true);
      return;
    }

    if (selectedMultiIndices.length === 0) {
      return;
    }
    setEditingIndex(-1);
    if (isStationsEditor) {
      setStationDraft({
        name: "",
        address: "",
        city: "",
        state: "",
        phone: "",
        mobilePhone: "",
      });
    }
    if (isApparatusEditor) {
      setApparatusDraft({
        unitId: "",
        unitType: "",
        minimumPersonnel: 0,
        personnelRequirements: [],
        station: "",
      });
    }
    if (isPersonnelEditor) {
      setPersonnelBulkDraft({
        shift: "",
        apparatusAssignment: "",
        station: "",
        userType: "",
        qualifications: [],
      });
    }
    setIsEntryFormOpen(true);
  };

  const saveStationForm = () => {
    if (!isMultiEditMode) {
      if (!stationDraft.name.trim()) {
        return;
      }
      const normalized = { ...stationDraft, name: stationDraft.name.trim() };
      setStationRecords((previous) =>
        editingIndex === null
          ? [...previous, normalized]
          : previous.map((entry, index) => (index === editingIndex ? normalized : entry)),
      );
    } else {
      setStationRecords((previous) =>
        previous.map((entry, index) => {
          if (!selectedMultiIndices.includes(index)) {
            return entry;
          }
          return {
            ...entry,
            address: stationDraft.address || entry.address,
            city: stationDraft.city || entry.city,
            state: stationDraft.state || entry.state,
            phone: stationDraft.phone || entry.phone,
            mobilePhone: stationDraft.mobilePhone || entry.mobilePhone,
          };
        }),
      );
    }
    setIsEntryFormOpen(false);
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Auto-saved.");
  };

  const saveApparatusForm = () => {
    if (!isMultiEditMode) {
      if (!apparatusDraft.unitId.trim() || !apparatusDraft.unitType.trim()) {
        return;
      }
      const minReq = Number.isFinite(apparatusDraft.minimumPersonnel) ? apparatusDraft.minimumPersonnel : 0;
      if (apparatusDraft.personnelRequirements.length !== minReq) {
        setStatusMessage(
          "Minimum Requirements selection count must match Minimum Personnel.",
        );
        return;
      }
      const normalized = {
        ...apparatusDraft,
        unitId: apparatusDraft.unitId.trim(),
        minimumPersonnel: Number.isFinite(apparatusDraft.minimumPersonnel)
          ? apparatusDraft.minimumPersonnel
          : 0,
      };
      setApparatusRecords((previous) =>
        editingIndex === null
          ? [...previous, normalized]
          : previous.map((entry, index) => (index === editingIndex ? normalized : entry)),
      );
    } else {
      setApparatusRecords((previous) =>
        previous.map((entry, index) => {
          if (!selectedMultiIndices.includes(index)) {
            return entry;
          }
          return {
            ...entry,
            unitType: apparatusDraft.unitType || entry.unitType,
            minimumPersonnel:
              apparatusDraft.minimumPersonnel > 0
                ? apparatusDraft.minimumPersonnel
                : entry.minimumPersonnel,
            personnelRequirements:
              apparatusDraft.personnelRequirements.length > 0
                ? apparatusDraft.personnelRequirements
                : entry.personnelRequirements,
            station: apparatusDraft.station || entry.station,
          };
        }),
      );
    }
    setIsEntryFormOpen(false);
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Auto-saved.");
  };

  const savePersonnelForm = () => {
    if (!isMultiEditMode) {
      if (!personnelDraft.name.trim()) {
        return;
      }
      const normalized = {
        ...personnelDraft,
        name: personnelDraft.name.trim(),
        qualifications: personnelDraft.qualifications ?? [],
      };
      setPersonnelRecords((previous) =>
        editingIndex === null
          ? [...previous, normalized]
          : previous.map((entry, index) => (index === editingIndex ? normalized : entry)),
      );
    } else {
      setPersonnelRecords((previous) =>
        previous.map((entry, index) => {
          if (!selectedMultiIndices.includes(index)) {
            return entry;
          }
          return {
            ...entry,
            shift: personnelBulkDraft.shift || entry.shift,
            apparatusAssignment:
              personnelBulkDraft.apparatusAssignment || entry.apparatusAssignment,
            station: personnelBulkDraft.station || entry.station,
            userType: personnelBulkDraft.userType || entry.userType,
            qualifications:
              personnelBulkDraft.qualifications.length > 0
                ? personnelBulkDraft.qualifications
                : entry.qualifications,
          };
        }),
      );
    }
    setIsEntryFormOpen(false);
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Auto-saved.");
  };

  const addShiftInformationEntry = () => {
    if (!shiftDraft.shiftType.trim() || shiftDraft.shiftDuration <= 0) {
      return;
    }
    if (shiftDraft.recurrence === "Custom" && !shiftDraft.recurrenceCustomValue.trim()) {
      return;
    }
    const normalized = {
      ...shiftDraft,
      shiftType: shiftDraft.shiftType.trim(),
      shiftDuration: shiftDraft.shiftDuration,
      recurrenceCustomValue: shiftDraft.recurrenceCustomValue.trim(),
      location: shiftDraft.location.trim(),
    };
    setShiftInformationEntries((previous) =>
      editingIndex === null
        ? [...previous, normalized]
        : previous.map((entry, index) => (index === editingIndex ? normalized : entry)),
    );
    setShiftDraft({
      shiftType: "",
      shiftDuration: 0,
      recurrence: "Daily",
      recurrenceCustomValue: "",
      location: "",
    });
    setEditingIndex(null);
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Auto-saved.");
  };

  const addOrUpdateUserType = () => {
    const trimmed = userTypeDraft.trim();
    if (!trimmed) {
      return;
    }
    setUserTypeValues((previous) =>
      editingIndex === null
        ? [...previous, trimmed]
        : previous.map((entry, index) => (index === editingIndex ? trimmed : entry)),
    );
    setUserTypeDraft("");
    setEditingIndex(null);
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Auto-saved.");
  };

  const addQualification = () => {
    const trimmed = qualificationDraft.trim();
    if (!trimmed) {
      return;
    }
    setPersonnelQualifications((previous) =>
      editingQualificationIndex === null
        ? [...previous, trimmed]
        : previous.map((entry, index) =>
            index === editingQualificationIndex ? trimmed : entry,
          ),
    );
    setQualificationDraft("");
    setEditingQualificationIndex(null);
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Auto-saved.");
  };

  const persistDepartmentDetails = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const payload = {
      departmentName,
      departmentStreet,
      departmentCity,
      departmentState,
      departmentZipCode,
      departmentTimeZone,
      mainContactName,
      mainContactPhone,
      secondaryContactName,
      secondaryContactPhone,
      departmentLogoFileName,
      stationRecords,
      apparatusRecords,
      shiftInformationEntries,
      personnelRecords,
      personnelQualifications,
      userTypeValues,
      selectedMutualAidIds,
    };
    window.localStorage.setItem(DEPARTMENT_DETAILS_STORAGE_KEY, JSON.stringify(payload));
    fetch("/api/department-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // API unavailable; localStorage already saved.
    });
  }, [
    apparatusRecords,
    departmentCity,
    departmentLogoFileName,
    departmentName,
    departmentState,
    departmentStreet,
    departmentTimeZone,
    departmentZipCode,
    mainContactName,
    mainContactPhone,
    personnelQualifications,
    personnelRecords,
    secondaryContactName,
    secondaryContactPhone,
    selectedMutualAidIds,
    shiftInformationEntries,
    stationRecords,
    userTypeValues,
  ]);

  useEffect(() => {
    if (autoSaveTick === 0) {
      return;
    }
    persistDepartmentDetails();
  }, [autoSaveTick, persistDepartmentDetails]);

  const handleDepartmentDetailsSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    persistDepartmentDetails();
    setStatusMessage("Department details saved locally in this browser.");
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Admin Functions | Department Details</h1>
          <p>Department setup and configuration values used throughout the system.</p>
        </div>
      </header>

      <form className="panel-grid" onSubmit={handleDepartmentDetailsSave}>
        <section className="panel-grid two-column">
          <article className="panel">
            <div className="panel-header">
              <h2>Department Profile</h2>
            </div>
            <div className="settings-form">
              <label htmlFor="department-name">Department Name</label>
              <input id="department-name" type="text" value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} />
              <label htmlFor="department-street">Department Address - Street</label>
              <input id="department-street" type="text" value={departmentStreet} onChange={(event) => setDepartmentStreet(event.target.value)} />
              <div className="department-inline-grid">
                <label htmlFor="department-city">
                  Department Address - City
                  <input id="department-city" type="text" value={departmentCity} onChange={(event) => setDepartmentCity(event.target.value)} />
                </label>
                <label htmlFor="department-state">
                  Department Address - State
                  <input id="department-state" type="text" value={departmentState} onChange={(event) => setDepartmentState(event.target.value)} />
                </label>
                <label htmlFor="department-zip">
                  Department Address - Zip Code
                  <input id="department-zip" type="text" value={departmentZipCode} onChange={(event) => setDepartmentZipCode(event.target.value)} />
                </label>
              </div>
              <label htmlFor="department-time-zone">Time Zone</label>
              <select id="department-time-zone" className="department-select-box" value={departmentTimeZone} onChange={(event) => setDepartmentTimeZone(event.target.value)}>
                <option value="">Select time zone</option>
                {GMT_TIMEZONE_OPTIONS.map((option) => (
                  <option key={`dept-timezone-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </article>
          <article className="panel">
            <div className="panel-header">
              <h2>Department Logo / Image</h2>
            </div>
            <div className="settings-form">
              <label htmlFor="department-logo-upload">Upload Department Logo/Image</label>
              <input id="department-logo-upload" type="file" accept="image/*" onChange={handleLogoSelection} />
              <p className="field-hint">Selected file: {departmentLogoFileName}</p>
            </div>
          </article>
        </section>

        <section className="panel-grid two-column">
          <article className="panel">
            <div className="panel-header">
              <h2>Main Contact</h2>
            </div>
            <div className="settings-form">
              <label htmlFor="main-contact-name">Main Contact Name</label>
              <input id="main-contact-name" type="text" value={mainContactName} onChange={(event) => setMainContactName(event.target.value)} />
              <label htmlFor="main-contact-phone">Main Contact Phone Number</label>
              <input id="main-contact-phone" type="tel" value={mainContactPhone} onChange={(event) => setMainContactPhone(event.target.value)} />
            </div>
          </article>
          <article className="panel">
            <div className="panel-header">
              <h2>Secondary Contact</h2>
            </div>
            <div className="settings-form">
              <label htmlFor="secondary-contact-name">Secondary Contact Name</label>
              <input id="secondary-contact-name" type="text" value={secondaryContactName} onChange={(event) => setSecondaryContactName(event.target.value)} />
              <label htmlFor="secondary-contact-phone">Secondary Contact Phone</label>
              <input id="secondary-contact-phone" type="tel" value={secondaryContactPhone} onChange={(event) => setSecondaryContactPhone(event.target.value)} />
            </div>
          </article>
        </section>

        <article className="panel">
          <div className="panel-header">
            <h2>Department Details</h2>
          </div>
          <div className="department-collection-grid">
            {detailCards.map((definition) => (
              <div key={definition.key} className="department-collection-card">
                <div className="department-collection-card-header">
                  <h3>{definition.label}</h3>
                  <button type="button" className="rl-box-button" onClick={() => openCollectionEditor(definition.key)}>
                    {definition.editButtonLabel}
                  </button>
                </div>
                <p className="field-hint">
                  {definition.key === "stations"
                    ? `Total Stations: ${stationRecords.length}`
                    : definition.key === "apparatus"
                      ? `Total Apparatus: ${apparatusRecords.length}`
                      : definition.key === "shiftInformation"
                        ? `Total Shift Information Entries: ${shiftInformationEntries.length}`
                        : definition.key === "personnel"
                          ? `Total Personnel: ${personnelRecords.length}`
                          : `Total Qualifications: ${personnelQualifications.length}`}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Department Resources</h2>
          </div>
          <div className="department-collection-grid">
            {resourceCards.map((definition) => (
              <div key={definition.key} className="department-collection-card">
                <div className="department-collection-card-header">
                  <h3>{definition.label}</h3>
                  <button type="button" className="rl-box-button" onClick={() => openCollectionEditor(definition.key)}>
                    {definition.editButtonLabel}
                  </button>
                </div>
                <p className="field-hint">Total Mutual Aid Departments: {selectedMutualAidIds.length}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Department Access</h2>
          </div>
          <div className="department-collection-grid">
            {accessCards.map((definition) => (
              <div key={definition.key} className="department-collection-card">
                <div className="department-collection-card-header">
                  <h3>{definition.label}</h3>
                  <button type="button" className="rl-box-button" onClick={() => openCollectionEditor(definition.key)}>
                    {definition.editButtonLabel}
                  </button>
                </div>
                <p className="field-hint">Total User Types: {userTypeValues.length}</p>
              </div>
            ))}
          </div>
        </article>

        <div className="header-actions">
          <button type="submit" className="primary-button">
            Save Department Details
          </button>
          {statusMessage ? <p className="save-message">{statusMessage}</p> : null}
        </div>
      </form>

      {activeCollectionEditor && activeCollectionDefinition ? (
        <div className="department-editor-backdrop" role="dialog" aria-modal="true">
          <article className="panel department-editor-modal">
            <div className="panel-header">
              <h2>{activeCollectionDefinition.label}</h2>
              <button type="button" className="secondary-button compact-button" onClick={closeCollectionEditor}>
                Close
              </button>
            </div>

            {(isStationsEditor || isApparatusEditor || isPersonnelEditor) ? (
              <>
                <div className="department-editor-toolbar-actions">
                  <button type="button" className="secondary-button compact-button" onClick={openAddForm}>
                    Add
                  </button>
                  <button
                    type="button"
                    className={`secondary-button compact-button ${isMultiEditMode ? "department-toggle-active" : ""}`}
                    onClick={() => {
                      setIsMultiEditMode((previous) => !previous);
                      setSelectedSingleIndex(null);
                      setSelectedMultiIndices([]);
                    }}
                  >
                    Edit Multiple
                  </button>
                  <button type="button" className="primary-button compact-button" onClick={() => openEditForm()}>
                    Edit
                  </button>
                </div>

                {!isMultiEditMode ? (
                  isApparatusEditor ? (
                    <div className="department-apparatus-list-wrapper">
                      <div className="department-apparatus-list-header">
                        {isApparatusFieldEditorOpen ? (
                          <button
                            type="button"
                            className="primary-button compact-button"
                            onClick={() => setIsApparatusFieldEditorOpen(false)}
                          >
                            Save
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => setIsApparatusFieldEditorOpen(true)}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      {isApparatusFieldEditorOpen ? (
                        <div className="field-editor-panel">
                          <p>Drag rows using the handle to reorder apparatus list columns.</p>
                          <ul className="drag-order-list">
                            {apparatusFieldOrder.map((fieldId) => (
                              <li
                                key={`apparatus-order-${fieldId}`}
                                draggable
                                onDragStart={() => setDragApparatusFieldId(fieldId)}
                                onDragEnd={() => setDragApparatusFieldId(null)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => handleApparatusFieldDrop(fieldId)}
                              >
                                <div className="drag-order-row">
                                  <span>{apparatusFieldLabelById[fieldId]}</span>
                                  <span className="drag-handle" aria-hidden="true">
                                    <span />
                                    <span />
                                    <span />
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Unit ID</th>
                              <th>
                                <div
                                  className="department-apparatus-grid-line department-apparatus-grid-header"
                                  style={apparatusGridStyle}
                                >
                                  {apparatusFieldOrder.map((fieldId, idx) => (
                                    <span
                                      key={`apparatus-header-${fieldId}`}
                                      className={`department-apparatus-field department-apparatus-header-field`}
                                    >
                                      <span className="department-apparatus-header-label">
                                        {apparatusFieldLabelById[fieldId]}
                                      </span>
                                      {idx < apparatusFieldOrder.length - 1 ? (
                                        <span
                                          className="dispatch-column-resizer"
                                          role="separator"
                                          aria-label={`Resize ${apparatusFieldLabelById[fieldId]} column`}
                                          aria-orientation="vertical"
                                          onPointerDown={(event) => startApparatusFieldResize(fieldId, event)}
                                          title={`Drag to resize ${apparatusFieldLabelById[fieldId]}`}
                                        >
                                          |
                                        </span>
                                      ) : null}
                                    </span>
                                  ))}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedApparatusRecords.length === 0 ? (
                              <tr>
                                <td colSpan={2} className="department-apparatus-empty">
                                  No apparatus units. Click Add to create one.
                                </td>
                              </tr>
                            ) : (
                            sortedApparatusRecords.map((apparatus) => {
                              const originalIndex = apparatusRecords.findIndex((a) => a === apparatus);
                              return (
                              <tr
                                key={`apparatus-row-${originalIndex}-${apparatus.unitId}`}
                                className={`clickable-row ${selectedSingleIndex === originalIndex ? "clickable-row-selected" : ""}`}
                                role="button"
                                tabIndex={0}
                                onClick={() => openEditForm(originalIndex)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    openEditForm(originalIndex);
                                  }
                                }}
                              >
                                <td>
                                  <strong className="call-number-text">{apparatus.unitId || "—"}</strong>
                                </td>
                                <td>
                                  <div className="dispatch-info-cell">
                                    <div className="department-apparatus-grid-line" style={apparatusGridStyle}>
                                      {apparatusFieldOrder.map((fieldId) => (
                                        <span
                                          key={`apparatus-${originalIndex}-${fieldId}`}
                                          className="department-apparatus-field"
                                        >
                                          {getApparatusFieldValue(apparatus, fieldId)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                              );
                            })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : isStationsEditor ? (
                    <div className="department-apparatus-list-wrapper">
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Station Name</th>
                              <th>
                                <div className="department-station-grid-line department-station-grid-header">
                                  <span>Address</span>
                                  <span>City</span>
                                  <span>State</span>
                                  <span>Phone</span>
                                  <span>Mobile Phone</span>
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedStationRecords.length === 0 ? (
                              <tr>
                                <td colSpan={2} className="department-apparatus-empty">
                                  No stations. Click Add to create one.
                                </td>
                              </tr>
                            ) : (
                              sortedStationRecords.map((station) => {
                                const originalIndex = stationRecords.findIndex((s) => s === station);
                                return (
                                <tr
                                  key={`station-row-${originalIndex}-${station.name}`}
                                  className={`clickable-row ${selectedSingleIndex === originalIndex ? "clickable-row-selected" : ""}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => openEditForm(originalIndex)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      openEditForm(originalIndex);
                                    }
                                  }}
                                >
                                  <td>
                                    <strong className="call-number-text">{station.name || "—"}</strong>
                                  </td>
                                  <td>
                                    <div className="dispatch-info-cell">
                                      <div className="department-station-grid-line">
                                        <span className="department-apparatus-field">{station.address || "—"}</span>
                                        <span className="department-apparatus-field">{station.city || "—"}</span>
                                        <span className="department-apparatus-field">{station.state || "—"}</span>
                                        <span className="department-apparatus-field">{station.phone || "—"}</span>
                                        <span className="department-apparatus-field">{station.mobilePhone || "—"}</span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : isPersonnelEditor ? (
                    <div className="department-apparatus-list-wrapper">
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>
                                <div className="department-personnel-grid-line department-personnel-grid-header">
                                  <span>Shift</span>
                                  <span>Apparatus</span>
                                  <span>Station</span>
                                  <span>User Type</span>
                                  <span>Qualifications</span>
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {personnelRecords.length === 0 ? (
                              <tr>
                                <td colSpan={2} className="department-apparatus-empty">
                                  No personnel. Click Add to create one.
                                </td>
                              </tr>
                            ) : (
                              personnelRecords.map((personnel, index) => (
                                <tr
                                  key={`personnel-row-${index}-${personnel.name}`}
                                  className={`clickable-row ${selectedSingleIndex === index ? "clickable-row-selected" : ""}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => openEditForm(index)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      openEditForm(index);
                                    }
                                  }}
                                >
                                  <td>
                                    <strong className="call-number-text">{personnel.name || "—"}</strong>
                                  </td>
                                  <td>
                                    <div className="dispatch-info-cell">
                                      <div className="department-personnel-grid-line">
                                        <span className="department-apparatus-field">{personnel.shift || "—"}</span>
                                        <span className="department-apparatus-field">{personnel.apparatusAssignment || "—"}</span>
                                        <span className="department-apparatus-field">{personnel.station || "—"}</span>
                                        <span className="department-apparatus-field">{personnel.userType || "—"}</span>
                                        <span className="department-apparatus-field">
                                          {personnel.qualifications.length > 0 ? personnel.qualifications.join(", ") : "—"}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null
                ) : (
                  <select
                    multiple
                    className="department-select-box department-select-multi"
                    value={selectedMultiIndices.map((index) => String(index))}
                    onChange={setSelectionFromMultiSelect}
                  >
                    {(isPersonnelEditor ? personnelRecords.map((entry) => entry.name) : isApparatusEditor ? apparatusNames : stationNames).map((entry, index) => (
                      <option key={`collection-multi-${entry}-${index}`} value={String(index)}>
                        {entry}
                      </option>
                    ))}
                  </select>
                )}
              </>
            ) : null}

            {isShiftEditor ? (
              <>
                <div className="department-editor-toolbar-actions">
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={() => {
                      setEditingIndex(null);
                      setSelectedSingleIndex(null);
                      setShiftDraft({
                        shiftType: "",
                        shiftDuration: 0,
                        recurrence: "Daily",
                        recurrenceCustomValue: "",
                        location: "",
                      });
                    }}
                  >
                    Add
                  </button>
                </div>
                <div className="department-apparatus-list-wrapper">
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Shift Type</th>
                          <th>
                            <div className="department-shift-grid-line department-shift-grid-header">
                              <span>Duration</span>
                              <span>Recurrence</span>
                              <span>Location</span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {shiftInformationEntries.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="department-apparatus-empty">
                              No shift entries. Click Add to create one.
                            </td>
                          </tr>
                        ) : (
                          shiftInformationEntries.map((entry, index) => {
                            const recurrenceLabel =
                              entry.recurrence === "Custom" && entry.recurrenceCustomValue.trim().length > 0
                                ? entry.recurrenceCustomValue
                                : entry.recurrence;
                            return (
                              <tr
                                key={`shift-row-${index}-${entry.shiftType}`}
                                className={`clickable-row ${selectedSingleIndex === index ? "clickable-row-selected" : ""}`}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setSelectedSingleIndex(index);
                                  setEditingIndex(index);
                                  setShiftDraft(entry);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setSelectedSingleIndex(index);
                                    setEditingIndex(index);
                                    setShiftDraft(entry);
                                  }
                                }}
                              >
                                <td>
                                  <strong className="call-number-text">{entry.shiftType || "—"}</strong>
                                </td>
                                <td>
                                  <div className="dispatch-info-cell">
                                    <div className="department-shift-grid-line">
                                      <span className="department-apparatus-field">{String(entry.shiftDuration)}</span>
                                      <span className="department-apparatus-field">{recurrenceLabel}</span>
                                      <span className="department-apparatus-field">{entry.location || "—"}</span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="department-edit-grid">
                  <label>
                    Shift Type
                    <input type="text" value={shiftDraft.shiftType} onChange={(event) => setShiftDraft((previous) => ({ ...previous, shiftType: event.target.value }))} />
                  </label>
                  <label>
                    Shift Duration
                    <input
                      type="number"
                      min={0}
                      value={shiftDraft.shiftDuration}
                      onChange={(event) =>
                        setShiftDraft((previous) => ({
                          ...previous,
                          shiftDuration: Number.parseInt(event.target.value, 10) || 0,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Recurrence
                    <select value={shiftDraft.recurrence} onChange={(event) => setShiftDraft((previous) => ({ ...previous, recurrence: event.target.value as ShiftRecurrencePreset }))}>
                      {SHIFT_RECURRENCE_PRESET_OPTIONS.map((option) => (
                        <option key={`shift-rec-${option}`} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  {shiftDraft.recurrence === "Custom" ? (
                    <label>
                      Custom Recurrence
                      <input type="text" value={shiftDraft.recurrenceCustomValue} onChange={(event) => setShiftDraft((previous) => ({ ...previous, recurrenceCustomValue: event.target.value }))} />
                    </label>
                  ) : null}
                  <label>
                    Location
                    <NerisFlatSingleOptionSelect
                      inputId="shift-location"
                      value={shiftDraft.location}
                      options={stationNames.map((s) => ({ value: s, label: s }))}
                      onChange={(nextValue) =>
                        setShiftDraft((previous) => ({ ...previous, location: nextValue }))
                      }
                      placeholder="Select station (optional)"
                      searchPlaceholder="Search stations..."
                      allowClear
                      usePortal
                    />
                  </label>
                </div>
                <div className="department-editor-toolbar-actions">
                  <button type="button" className="primary-button compact-button" onClick={addShiftInformationEntry}>
                    {editingIndex === null ? "Add Shift Information" : "Save Shift Information"}
                  </button>
                </div>
              </>
            ) : null}

            {isQualificationsEditor ? (
              <>
                <div className="department-editor-add-row">
                  <input
                    type="text"
                    value={qualificationDraft}
                    onChange={(event) => setQualificationDraft(event.target.value)}
                    placeholder="Qualification name"
                  />
                  <button
                    type="button"
                    className="primary-button compact-button"
                    onClick={addQualification}
                  >
                    {editingQualificationIndex === null ? "Add" : "Update"}
                  </button>
                </div>
                <p className="field-hint" style={{ marginTop: "0.5rem", marginBottom: "0.25rem" }}>
                  Click a row to edit. Drag rows to reorder (order establishes hierarchy for scheduling).
                </p>
                <div className="department-qualifications-list-wrapper">
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: "32px" }} aria-label="Drag to reorder" />
                          <th>Qualification</th>
                          <th style={{ width: "80px" }}>Order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {personnelQualifications.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="department-apparatus-empty">
                              No qualifications. Add one above.
                            </td>
                          </tr>
                        ) : (
                          personnelQualifications.map((qualification, index) => (
                            <tr
                              key={`qualification-${qualification}-${index}`}
                              className={`clickable-row ${editingQualificationIndex === index ? "clickable-row-selected" : ""}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setEditingQualificationIndex(index);
                                setQualificationDraft(qualification);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setEditingQualificationIndex(index);
                                  setQualificationDraft(qualification);
                                }
                              }}
                            >
                              <td
                                className="department-qualification-drag-cell"
                                onClick={(e) => e.stopPropagation()}
                                draggable
                                onDragStart={() => setDragQualificationIndex(index)}
                                onDragEnd={() => setDragQualificationIndex(null)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => {
                                  if (dragQualificationIndex === null || dragQualificationIndex === index) {
                                    return;
                                  }
                                  setPersonnelQualifications((previous) => {
                                    const next = [...previous];
                                    const [moved] = next.splice(dragQualificationIndex, 1);
                                    if (!moved) {
                                      return previous;
                                    }
                                    next.splice(index, 0, moved);
                                    return next;
                                  });
                                  setDragQualificationIndex(null);
                                  setAutoSaveTick((previous) => previous + 1);
                                  setStatusMessage("Auto-saved.");
                                }}
                              >
                                <span className="drag-handle" aria-hidden="true">
                                  <span />
                                  <span />
                                  <span />
                                </span>
                              </td>
                              <td>
                                <strong className="call-number-text">{qualification || "—"}</strong>
                              </td>
                              <td style={{ color: "#64748b", fontSize: "0.82rem" }}>
                                {index + 1}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}

            {isMutualAidEditor ? (
              <NerisFlatMultiOptionSelect
                inputId="mutual-aid-departments"
                value={selectedMutualAidIds.join(",")}
                options={mutualAidOptions.map((o) => ({
                  value: o.id,
                  label: `${o.name} (${o.id})`,
                }))}
                onChange={(nextValue) =>
                  setSelectedMutualAidIds(
                    nextValue.split(",").map((s) => s.trim()).filter(Boolean),
                  )
                }
                placeholder="Select mutual aid department(s)"
                searchPlaceholder="Search departments..."
                usePortal
              />
            ) : null}

            {isUserTypeEditor ? (
              <>
                <div className="department-editor-add-row">
                  <input type="text" value={userTypeDraft} onChange={(event) => setUserTypeDraft(event.target.value)} placeholder="User type value" />
                  <button type="button" className="primary-button compact-button" onClick={addOrUpdateUserType}>
                    {editingIndex === null ? "Add" : "Update"}
                  </button>
                </div>
                <p className="field-hint" style={{ marginTop: "0.5rem", marginBottom: "0.25rem" }}>
                  Click a row to edit.
                </p>
                <div className="department-qualifications-list-wrapper">
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>User Type</th>
                          <th style={{ width: "80px" }}>Order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userTypeValues.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="department-apparatus-empty">
                              No user types. Add one above.
                            </td>
                          </tr>
                        ) : (
                          userTypeValues.map((userType, index) => (
                            <tr
                              key={`user-type-${userType}-${index}`}
                              className={`clickable-row ${editingIndex === index ? "clickable-row-selected" : ""}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setEditingIndex(index);
                                setUserTypeDraft(userType);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setEditingIndex(index);
                                  setUserTypeDraft(userType);
                                }
                              }}
                            >
                              <td>
                                <strong className="call-number-text">{userType || "—"}</strong>
                              </td>
                              <td style={{ color: "#64748b", fontSize: "0.82rem" }}>
                                {index + 1}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </article>
        </div>
      ) : null}

      {isEntryFormOpen ? (
        <div className="department-editor-backdrop" role="dialog" aria-modal="true">
          <article className="panel department-editor-modal">
            <div className="panel-header">
              <h2>
                {isPersonnelEditor
                  ? isMultiEditMode
                    ? "Edit Multiple Personnel"
                    : "Personnel Entry"
                  : isApparatusEditor
                    ? isMultiEditMode
                      ? "Edit Multiple Apparatus"
                      : "Apparatus Entry"
                    : isMultiEditMode
                      ? "Edit Multiple Stations"
                      : "Station Entry"}
              </h2>
              <button type="button" className="secondary-button compact-button" onClick={() => setIsEntryFormOpen(false)}>
                Close
              </button>
            </div>

            {isStationsEditor ? (
              <div className="department-edit-grid">
                {!isMultiEditMode ? (
                  <label>
                    Station Name
                    <input type="text" value={stationDraft.name} onChange={(event) => setStationDraft((previous) => ({ ...previous, name: event.target.value }))} />
                  </label>
                ) : null}
                <label>
                  Address
                  <input type="text" value={stationDraft.address} onChange={(event) => setStationDraft((previous) => ({ ...previous, address: event.target.value }))} />
                </label>
                <label>
                  City
                  <input type="text" value={stationDraft.city} onChange={(event) => setStationDraft((previous) => ({ ...previous, city: event.target.value }))} />
                </label>
                <label>
                  State
                  <input type="text" value={stationDraft.state} onChange={(event) => setStationDraft((previous) => ({ ...previous, state: event.target.value }))} />
                </label>
                <label>
                  Phone
                  <input type="text" value={stationDraft.phone} onChange={(event) => setStationDraft((previous) => ({ ...previous, phone: event.target.value }))} />
                </label>
                <label>
                  Mobile Phone
                  <input type="text" value={stationDraft.mobilePhone} onChange={(event) => setStationDraft((previous) => ({ ...previous, mobilePhone: event.target.value }))} />
                </label>
              </div>
            ) : null}

            {isApparatusEditor ? (
              <div className="department-edit-grid">
                {!isMultiEditMode ? (
                  <label>
                    Unit ID
                    <input type="text" value={apparatusDraft.unitId} onChange={(event) => setApparatusDraft((previous) => ({ ...previous, unitId: event.target.value }))} />
                  </label>
                ) : null}
                <label>
                  Unit Type
                  <NerisFlatSingleOptionSelect
                    inputId="apparatus-unit-type"
                    value={apparatusDraft.unitType}
                    options={unitTypeOptions}
                    onChange={(nextValue) =>
                      setApparatusDraft((previous) => ({ ...previous, unitType: nextValue }))
                    }
                    placeholder="Select unit type"
                    searchPlaceholder="Search unit types..."
                    allowClear
                    usePortal
                  />
                </label>
                <label>
                  Minimum Personnel
                  <input
                    type="number"
                    min={0}
                    value={apparatusDraft.minimumPersonnel}
                    onChange={(event) =>
                      setApparatusDraft((previous) => ({
                        ...previous,
                        minimumPersonnel: Number.parseInt(event.target.value, 10) || 0,
                      }))
                    }
                  />
                </label>
                <label>
                  Minimum Requirements (select all that apply)
                  <NerisFlatMultiOptionSelect
                    inputId="apparatus-personnel-requirements"
                    value={apparatusDraft.personnelRequirements.join(",")}
                    options={personnelQualifications.map((q) => ({ value: q, label: q }))}
                    onChange={(nextValue) =>
                      setApparatusDraft((previous) => ({
                        ...previous,
                        personnelRequirements: nextValue
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }))
                    }
                    placeholder="Select personnel requirement(s)"
                    searchPlaceholder="Search qualifications..."
                    maxSelections={apparatusDraft.minimumPersonnel > 0 ? apparatusDraft.minimumPersonnel : undefined}
                    usePortal
                  />
                  {personnelQualifications.length === 0 ? (
                    <small className="field-hint">Add qualifications in Edit Personnel Qualifications first.</small>
                  ) : null}
                </label>
                <label>
                  Station
                  <NerisFlatSingleOptionSelect
                    inputId="apparatus-station"
                    value={apparatusDraft.station}
                    options={stationNames.map((s) => ({ value: s, label: s }))}
                    onChange={(nextValue) =>
                      setApparatusDraft((previous) => ({ ...previous, station: nextValue }))
                    }
                    placeholder="Select station"
                    searchPlaceholder="Search stations..."
                    allowClear
                    usePortal
                  />
                </label>
              </div>
            ) : null}

            {isPersonnelEditor ? (
              <div className="department-edit-grid">
                {!isMultiEditMode ? (
                  <label>
                    Personnel Name
                    <input type="text" value={personnelDraft.name} onChange={(event) => setPersonnelDraft((previous) => ({ ...previous, name: event.target.value }))} />
                  </label>
                ) : null}
                <label>
                  Shift
                  <select
                    value={!isMultiEditMode ? personnelDraft.shift : personnelBulkDraft.shift}
                    onChange={(event) =>
                      !isMultiEditMode
                        ? setPersonnelDraft((previous) => ({ ...previous, shift: event.target.value }))
                        : setPersonnelBulkDraft((previous) => ({ ...previous, shift: event.target.value }))
                    }
                  >
                    <option value="">{isMultiEditMode ? "No change" : "Select shift"}</option>
                    {shiftOptionValues.map((option) => (
                      <option key={`personnel-shift-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Apparatus Assignment
                  <select
                    value={!isMultiEditMode ? personnelDraft.apparatusAssignment : personnelBulkDraft.apparatusAssignment}
                    onChange={(event) =>
                      !isMultiEditMode
                        ? setPersonnelDraft((previous) => ({ ...previous, apparatusAssignment: event.target.value }))
                        : setPersonnelBulkDraft((previous) => ({ ...previous, apparatusAssignment: event.target.value }))
                    }
                  >
                    <option value="">{isMultiEditMode ? "No change" : "Select apparatus"}</option>
                    {apparatusNames.map((option) => (
                      <option key={`personnel-apparatus-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Station
                  <NerisFlatSingleOptionSelect
                    inputId="personnel-station"
                    value={!isMultiEditMode ? personnelDraft.station : personnelBulkDraft.station}
                    options={stationNames.map((s) => ({ value: s, label: s }))}
                    onChange={(nextValue) => {
                      if (!isMultiEditMode) {
                        setPersonnelDraft((previous) => ({ ...previous, station: nextValue }));
                      } else {
                        setPersonnelBulkDraft((previous) => ({ ...previous, station: nextValue }));
                      }
                    }}
                    placeholder={isMultiEditMode ? "No change" : "Select station"}
                    searchPlaceholder="Search stations..."
                    allowClear
                    usePortal
                  />
                </label>
                <label>
                  User Type
                  <select
                    value={!isMultiEditMode ? personnelDraft.userType : personnelBulkDraft.userType}
                    onChange={(event) =>
                      !isMultiEditMode
                        ? setPersonnelDraft((previous) => ({ ...previous, userType: event.target.value }))
                        : setPersonnelBulkDraft((previous) => ({ ...previous, userType: event.target.value }))
                    }
                  >
                    <option value="">{isMultiEditMode ? "No change" : "Select user type"}</option>
                    {userTypeValues.map((option) => (
                      <option key={`personnel-user-type-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="department-qualifications-field-label">
                  Qualifications (select all that apply)
                  <NerisFlatMultiOptionSelect
                    inputId="personnel-qualifications"
                    value={
                      !isMultiEditMode
                        ? personnelDraft.qualifications.join(",")
                        : personnelBulkDraft.qualifications.join(",")
                    }
                    options={personnelQualifications.map((q) => ({ value: q, label: q }))}
                    onChange={(nextValue) => {
                      const arr = nextValue.split(",").map((s) => s.trim()).filter(Boolean);
                      if (!isMultiEditMode) {
                        setPersonnelDraft((previous) => ({ ...previous, qualifications: arr }));
                      } else {
                        setPersonnelBulkDraft((previous) => ({ ...previous, qualifications: arr }));
                      }
                    }}
                    placeholder="Select qualification(s)"
                    searchPlaceholder="Search qualifications..."
                    usePortal
                  />
                  {personnelQualifications.length === 0 ? (
                    <small className="field-hint">Add qualifications in Personnel Qualifications first.</small>
                  ) : null}
                </label>
              </div>
            ) : null}

            <div className="department-editor-toolbar-actions">
              <button
                type="button"
                className="primary-button compact-button"
                onClick={() => {
                  if (isStationsEditor) {
                    saveStationForm();
                  } else if (isApparatusEditor) {
                    saveApparatusForm();
                  } else if (isPersonnelEditor) {
                    savePersonnelForm();
                  }
                }}
              >
                Save
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}

function HydrantsAdminPage() {
  const [fileName, setFileName] = useState("No file selected");
  const [statusMessage, setStatusMessage] = useState("");

  const handleUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("CSV upload staged in prototype mode. Parsing comes next.");
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Admin Functions | Hydrants</h1>
          <p>
            Mass upload hydrants via CSV and maintain hydrant placement manually on
            the map.
          </p>
        </div>
      </header>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>CSV Upload</h2>
          </div>
          <form className="settings-form" onSubmit={handleUpload}>
            <label htmlFor="hydrant-upload">Hydrant CSV File</label>
            <input
              id="hydrant-upload"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) =>
                setFileName(event.target.files?.[0]?.name ?? "No file selected")
              }
            />
            <p className="field-hint">Selected file: {fileName}</p>
            <button type="submit" className="primary-button">
              Upload CSV
            </button>
            {statusMessage ? <p className="save-message">{statusMessage}</p> : null}
          </form>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Hydrant Map Editing</h2>
          </div>
          <div className="dispatch-map-placeholder">
            <p>
              Hydrant map editor placeholder. This screen will support manual pin
              placement and hydrant attribute editing.
            </p>
            <ul>
              <li>Drag hydrant markers to adjust map location</li>
              <li>Update flow rate, status, and service notes</li>
              <li>Sync map marker overlays for incident response</li>
            </ul>
          </div>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Hydrant Records</h2>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Hydrant ID</th>
                  <th>Status</th>
                  <th>Zone</th>
                  <th>Last Inspection</th>
                  <th>Flow Rate</th>
                </tr>
              </thead>
              <tbody>
                {HYDRANT_ADMIN_TABLE_ROWS.map((row) => (
                  <tr key={row.hydrantId}>
                    <td>{row.hydrantId}</td>
                    <td>{row.status}</td>
                    <td>{row.zone}</td>
                    <td>{row.lastInspection}</td>
                    <td>{row.flowRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  );
}

function CustomizationSection({
  title,
  children,
  action,
  defaultOpen = false,
}: CustomizationSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <article className="panel collapsible-panel">
      <div className="panel-header collapsible-panel-header">
        <button
          type="button"
          className="collapsible-toggle"
          onClick={() => setIsOpen((previous) => !previous)}
          aria-expanded={isOpen}
        >
          <h2>{title}</h2>
          <ChevronDown
            size={16}
            className={`collapsible-icon ${isOpen ? "open" : ""}`}
          />
        </button>
        {action ? <div className="collapsible-action">{action}</div> : null}
      </div>
      {isOpen ? <div className="collapsible-panel-body">{children}</div> : null}
    </article>
  );
}

function CustomizationPage({
  workflowStates,
  onSaveWorkflowStates,
  incidentDisplaySettings,
  onSaveIncidentDisplaySettings,
  submenuVisibility,
  onSaveSubmenuVisibility,
  nerisExportSettings,
  onSaveNerisExportSettings,
}: CustomizationPageProps) {
  const [organizationName, setOrganizationName] = useState("CIFPD");
  const [primaryColor, setPrimaryColor] = useState("#1d4ed8");
  const [accentColor, setAccentColor] = useState("#0891b2");
  const [logoFileName, setLogoFileName] = useState("No file selected");
  const [workflowDraft, setWorkflowDraft] = useState<string[]>(() => [...workflowStates]);
  const [newState, setNewState] = useState("");
  const [incidentSettingsDraft, setIncidentSettingsDraft] =
    useState<IncidentDisplaySettings>(() => ({
      hiddenStatIds: [...incidentDisplaySettings.hiddenStatIds],
      callFieldOrder: [...incidentDisplaySettings.callFieldOrder],
    }));
  const [submenuVisibilityDraft, setSubmenuVisibilityDraft] =
    useState<SubmenuVisibilityMap>(() => ({ ...submenuVisibility }));
  const [nerisExportSettingsDraft, setNerisExportSettingsDraft] = useState<NerisExportSettings>(
    () => ({ ...nerisExportSettings }),
  );
  const [selectedParsingCall, setSelectedParsingCall] = useState(
    DISPATCH_PARSING_PREVIEW[0]?.callNumber ?? "",
  );
  const [savedMessage, setSavedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const visibleCallFieldOrder = dedupeCallFieldOrder(
    incidentSettingsDraft.callFieldOrder.filter((fieldId) =>
      VALID_CALL_FIELD_IDS.has(fieldId),
    ),
  );

  const parsingRow =
    DISPATCH_PARSING_PREVIEW.find((row) => row.callNumber === selectedParsingCall) ??
    DISPATCH_PARSING_PREVIEW[0];

  const updateWorkflowState = (index: number, value: string) => {
    setWorkflowDraft((previous) =>
      previous.map((state, currentIndex) =>
        currentIndex === index ? value : state,
      ),
    );
  };

  const removeWorkflowState = (index: number) => {
    setWorkflowDraft((previous) =>
      previous.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const addWorkflowState = () => {
    const trimmed = newState.trim();
    if (!trimmed) {
      return;
    }
    setWorkflowDraft((previous) => [...previous, trimmed]);
    setNewState("");
  };

  const resetWorkflowStates = () => {
    setWorkflowDraft([...DEFAULT_DISPATCH_WORKFLOW_STATES]);
  };

  const toggleIncidentStatVisibility = (statId: IncidentStatId) => {
    setIncidentSettingsDraft((previous) => {
      const hidden = previous.hiddenStatIds.includes(statId)
        ? previous.hiddenStatIds.filter((id) => id !== statId)
        : [...previous.hiddenStatIds, statId];
      return {
        ...previous,
        hiddenStatIds: hidden,
      };
    });
  };

  const toggleCallFieldVisibility = (fieldId: IncidentCallFieldId) => {
    setIncidentSettingsDraft((previous) => {
      const isVisible = previous.callFieldOrder.includes(fieldId);
      if (isVisible) {
        return {
          ...previous,
          callFieldOrder: previous.callFieldOrder.filter((id) => id !== fieldId),
        };
      }
      return {
        ...previous,
        callFieldOrder: [...previous.callFieldOrder, fieldId],
      };
    });
  };

  const moveCallField = (fieldId: IncidentCallFieldId, direction: "up" | "down") => {
    setIncidentSettingsDraft((previous) => {
      const currentIndex = previous.callFieldOrder.indexOf(fieldId);
      if (currentIndex < 0) {
        return previous;
      }

      const swapIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (swapIndex < 0 || swapIndex >= previous.callFieldOrder.length) {
        return previous;
      }

      const nextOrder = [...previous.callFieldOrder];
      const currentValue = nextOrder[currentIndex];
      nextOrder[currentIndex] = nextOrder[swapIndex];
      nextOrder[swapIndex] = currentValue;
      return {
        ...previous,
        callFieldOrder: nextOrder,
      };
    });
  };

  const toggleSubmenuVisibility = (path: string) => {
    setSubmenuVisibilityDraft((previous) => ({
      ...previous,
      [path]: previous[path] !== false ? false : true,
    }));
  };

  const updateNerisExportSetting = (
    field: keyof NerisExportSettings,
    value: string,
  ) => {
    setNerisExportSettingsDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedStates = dedupeAndCleanStrings(workflowDraft);
    if (!normalizedStates.length) {
      setSavedMessage("");
      setErrorMessage("Add at least one dispatch workflow state before saving.");
      return;
    }

    const normalizedCallFieldOrder = dedupeCallFieldOrder(
      incidentSettingsDraft.callFieldOrder.filter((fieldId) =>
        VALID_CALL_FIELD_IDS.has(fieldId),
      ),
    );
    if (!normalizedCallFieldOrder.length) {
      setSavedMessage("");
      setErrorMessage("Keep at least one visible incident call field.");
      return;
    }

    const normalizedIncidentSettings: IncidentDisplaySettings = {
      hiddenStatIds: incidentSettingsDraft.hiddenStatIds.filter((id) =>
        VALID_STAT_IDS.has(id),
      ),
      callFieldOrder: normalizedCallFieldOrder,
    };

    const normalizedSubmenuVisibility = {
      ...getDefaultSubmenuVisibilityMap(),
      ...submenuVisibilityDraft,
    };
    const normalizedNerisExportSettings = normalizeNerisExportSettings(
      nerisExportSettingsDraft,
    );

    onSaveWorkflowStates(normalizedStates);
    onSaveIncidentDisplaySettings(normalizedIncidentSettings);
    onSaveSubmenuVisibility(normalizedSubmenuVisibility);
    onSaveNerisExportSettings(normalizedNerisExportSettings);

    setIncidentSettingsDraft(normalizedIncidentSettings);
    setSubmenuVisibilityDraft(normalizedSubmenuVisibility);
    setNerisExportSettingsDraft(normalizedNerisExportSettings);
    setErrorMessage("");
    setSavedMessage(
      "Customization saved. Incident display, submenu visibility, workflow states, and NERIS export settings updated.",
    );
  };

  return (
    <section className="page-section">
      <form className="panel-grid customization-form" onSubmit={handleSave}>
        <header className="page-header customization-header">
          <div>
            <h1>Admin Functions | Customization</h1>
            <p>
              Configure branding, incident display controls, submenu visibility,
              parsing setup, and NERIS export settings.
            </p>
            {savedMessage ? <p className="save-message">{savedMessage}</p> : null}
            {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}
          </div>
          <div className="header-actions">
            <button type="submit" className="primary-button">
              Save Customization
            </button>
          </div>
        </header>

        <CustomizationSection title="Branding Controls">
          <div className="settings-form">
            <label htmlFor="org-name">Organization Name</label>
            <input
              id="org-name"
              type="text"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
            />

            <label htmlFor="logo-upload">Organization Logo</label>
            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              onChange={(event) =>
                setLogoFileName(event.target.files?.[0]?.name ?? "No file selected")
              }
            />
            <p className="field-hint">Selected file: {logoFileName}</p>

            <label htmlFor="primary-color">Primary Color</label>
            <input
              id="primary-color"
              type="color"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
            />

            <label htmlFor="accent-color">Accent Color</label>
            <input
              id="accent-color"
              type="color"
              value={accentColor}
              onChange={(event) => setAccentColor(event.target.value)}
            />
          </div>
        </CustomizationSection>

        <CustomizationSection
          title="Dispatch Workflow States"
          action={
            <button type="button" className="link-button" onClick={resetWorkflowStates}>
              Reset to default
            </button>
          }
        >
          <div className="settings-form">
            {workflowDraft.map((state, index) => (
              <div key={`${state}-${index}`} className="state-edit-row">
                <input
                  type="text"
                  value={state}
                  onChange={(event) => updateWorkflowState(index, event.target.value)}
                />
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => removeWorkflowState(index)}
                >
                  Remove
                </button>
              </div>
            ))}

            <div className="state-edit-row">
              <input
                type="text"
                value={newState}
                placeholder="Add new workflow state"
                onChange={(event) => setNewState(event.target.value)}
              />
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={addWorkflowState}
              >
                Add
              </button>
            </div>

            <small className="field-hint">
              Standard states: {DEFAULT_DISPATCH_WORKFLOW_STATES.join(", ")}
            </small>
          </div>
        </CustomizationSection>

        <CustomizationSection title="Incidents Display Settings">
          <div className="settings-form">
            <label>Incident stat boxes (show/hide)</label>
            <ul className="settings-list">
              {INCIDENT_QUEUE_STATS.map((stat) => {
                const isHidden = incidentSettingsDraft.hiddenStatIds.includes(stat.id);
                return (
                  <li key={stat.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!isHidden}
                        onChange={() => toggleIncidentStatVisibility(stat.id)}
                      />
                      <span>{stat.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </CustomizationSection>

        <CustomizationSection title="Incident Call Field Visibility & Row Order">
          <div className="settings-form">
            <ul className="settings-list field-order-list">
              {INCIDENT_CALL_FIELD_OPTIONS.map((field) => {
                const orderIndex = visibleCallFieldOrder.indexOf(field.id);
                const isVisible = orderIndex >= 0;
                return (
                  <li key={field.id}>
                    <div className="field-order-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => toggleCallFieldVisibility(field.id)}
                        />
                        <span>{field.label}</span>
                      </label>
                      <div className="field-order-controls">
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          disabled={!isVisible || orderIndex === 0}
                          onClick={() => moveCallField(field.id, "up")}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          disabled={
                            !isVisible ||
                            orderIndex === visibleCallFieldOrder.length - 1
                          }
                          onClick={() => moveCallField(field.id, "down")}
                        >
                          Down
                        </button>
                      </div>
                    </div>
                    <small>{field.description}</small>
                  </li>
                );
              })}
            </ul>
          </div>
        </CustomizationSection>

        <CustomizationSection title="Submenu Display Settings">
          <div className="settings-form">
            <p className="field-hint">
              Each submenu has a visibility setting to control whether it appears
              in menu card displays and Edit Display selections.
            </p>
            {MAIN_MENUS.filter((menu) => menu.submenus.length > 0).map((menu) => (
              <div key={`submenu-settings-${menu.id}`} className="submenu-settings-group">
                <h3>{menu.title}</h3>
                <ul className="settings-list">
                  {menu.submenus.map((submenu) => (
                    <li key={`${menu.id}-${submenu.path}`}>
                      <label>
                        <input
                          type="checkbox"
                          checked={submenuVisibilityDraft[submenu.path] !== false}
                          onChange={() => toggleSubmenuVisibility(submenu.path)}
                        />
                        <span>{submenu.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CustomizationSection>

        <CustomizationSection title="NERIS Export Configuration">
          <div className="settings-form">
            <p className="field-hint">
              Enter the API values needed for the Export button on NERIS reports.
              These settings are stored in this browser only. In proxy mode,
              credentials should be set on the server in <code>.env.server</code>.
            </p>

            <label htmlFor="neris-export-url">Export URL (endpoint)</label>
            <input
              id="neris-export-url"
              type="text"
              placeholder="https://..."
              value={nerisExportSettingsDraft.exportUrl}
              onChange={(event) =>
                updateNerisExportSetting("exportUrl", event.target.value)
              }
            />

            <label htmlFor="neris-vendor-code">NERIS Entity ID</label>
            <input
              id="neris-vendor-code"
              type="text"
              placeholder="ex: FD24160543"
              value={nerisExportSettingsDraft.vendorCode}
              onChange={(event) =>
                updateNerisExportSetting("vendorCode", event.target.value)
              }
            />
            <small className="field-hint">
              OpenAPI format is usually <code>FD########</code> or{" "}
              <code>VN########</code> (for example: FD24160543).
            </small>

            <label htmlFor="neris-vendor-header">Entity ID header name</label>
            <input
              id="neris-vendor-header"
              type="text"
              value={nerisExportSettingsDraft.vendorHeaderName}
              onChange={(event) =>
                updateNerisExportSetting("vendorHeaderName", event.target.value)
              }
            />

            <label htmlFor="neris-secret-key">Secret key / API token (direct mode only)</label>
            <input
              id="neris-secret-key"
              type="password"
              value={nerisExportSettingsDraft.secretKey}
              onChange={(event) =>
                updateNerisExportSetting("secretKey", event.target.value)
              }
            />

            <label htmlFor="neris-auth-header">Auth header name (default from OpenAPI)</label>
            <input
              id="neris-auth-header"
              type="text"
              value={nerisExportSettingsDraft.authHeaderName}
              onChange={(event) =>
                updateNerisExportSetting("authHeaderName", event.target.value)
              }
            />

            <label htmlFor="neris-auth-scheme">Auth scheme prefix (default from OpenAPI)</label>
            <input
              id="neris-auth-scheme"
              type="text"
              placeholder="Bearer"
              value={nerisExportSettingsDraft.authScheme}
              onChange={(event) =>
                updateNerisExportSetting("authScheme", event.target.value)
              }
            />

            <label htmlFor="neris-content-type">Content-Type (default from OpenAPI)</label>
            <input
              id="neris-content-type"
              type="text"
              value={nerisExportSettingsDraft.contentType}
              onChange={(event) =>
                updateNerisExportSetting("contentType", event.target.value)
              }
            />

            <label htmlFor="neris-version-header">API version header name (optional)</label>
            <input
              id="neris-version-header"
              type="text"
              value={nerisExportSettingsDraft.apiVersionHeaderName}
              onChange={(event) =>
                updateNerisExportSetting("apiVersionHeaderName", event.target.value)
              }
            />

            <label htmlFor="neris-version-value">API version header value (optional)</label>
            <input
              id="neris-version-value"
              type="text"
              value={nerisExportSettingsDraft.apiVersionHeaderValue}
              onChange={(event) =>
                updateNerisExportSetting("apiVersionHeaderValue", event.target.value)
              }
            />

            <small className="field-hint">
              Security note: these values are local browser settings for prototype
              testing. Production keys should be kept on a backend server.
            </small>
          </div>
        </CustomizationSection>

        <CustomizationSection title="Parsing Setup">
          <div className="settings-form">
            <label htmlFor="parsing-call-select">Dispatch feed preview call</label>
            <select
              id="parsing-call-select"
              value={selectedParsingCall}
              onChange={(event) => setSelectedParsingCall(event.target.value)}
            >
              {DISPATCH_PARSING_PREVIEW.map((row) => (
                <option key={row.callNumber} value={row.callNumber}>
                  {row.callNumber}
                </option>
              ))}
            </select>

            {parsingRow ? (
              <div className="parsing-preview">
                <p>
                  <strong>Received:</strong> {parsingRow.receivedAt}
                </p>
                <p>
                  <strong>Parsed:</strong> {parsingRow.parsedSummary}
                </p>
                <p>
                  <strong>Raw:</strong>
                </p>
                <pre>{parsingRow.rawMessage}</pre>
              </div>
            ) : null}

            <label>Incoming calls from dispatch</label>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Received</th>
                    <th>Call #</th>
                    <th>Parsed Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {DISPATCH_PARSING_PREVIEW.map((row) => (
                    <tr key={`parse-${row.callNumber}`}>
                      <td>{row.receivedAt}</td>
                      <td>{row.callNumber}</td>
                      <td>{row.parsedSummary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CustomizationSection>

        <CustomizationSection title="Preview">
          <div className="branding-preview">
            <div
              className="branding-preview-banner"
              style={{
                background: `linear-gradient(120deg, ${primaryColor} 0%, ${accentColor} 100%)`,
              }}
            >
              <span>{organizationName || "Organization Name"}</span>
            </div>
            <p>
              Branding preview only. Future backend integration will persist
              these choices per organization.
            </p>
            <ul className="workflow-chip-list">
              {workflowDraft.map((state) => (
                <li key={`preview-${state}`} className="workflow-chip">
                  {state}
                </li>
              ))}
            </ul>
          </div>
        </CustomizationSection>
      </form>
    </section>
  );
}

function ProfileManagementPage() {
  const [fullName, setFullName] = useState("Command User");
  const [email, setEmail] = useState("command@example.org");
  const [phone, setPhone] = useState("(555) 555-0191");
  const [message, setMessage] = useState("");

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("Profile updates saved in this prototype.");
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Profile Management</h1>
          <p>Manage your account contact details and preferences.</p>
        </div>
      </header>

      <section className="panel-grid">
        <article className="panel">
          <form className="settings-form" onSubmit={handleSave}>
            <label htmlFor="full-name">Full Name</label>
            <input
              id="full-name"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />

            <label htmlFor="profile-email">Email Address</label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label htmlFor="profile-phone">Phone Number</label>
            <input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />

            <button type="submit" className="primary-button">
              Save Profile
            </button>
            {message ? <p className="save-message">{message}</p> : null}
          </form>
        </article>
      </section>
    </section>
  );
}

function EditDisplayPage() {
  const [themeMode, setThemeMode] = useState("light");
  const [density, setDensity] = useState("comfortable");
  const [message, setMessage] = useState("");

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("Display preferences updated in this prototype.");
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Edit My Display</h1>
          <p>Set personal display preferences for your workspace.</p>
        </div>
      </header>

      <section className="panel-grid">
        <article className="panel">
          <form className="settings-form" onSubmit={handleSave}>
            <label htmlFor="theme-mode">Theme Mode</label>
            <select
              id="theme-mode"
              value={themeMode}
              onChange={(event) => setThemeMode(event.target.value)}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>

            <label htmlFor="display-density">Display Density</label>
            <select
              id="display-density"
              value={density}
              onChange={(event) => setDensity(event.target.value)}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>

            <button type="submit" className="primary-button">
              Save Display Settings
            </button>
            {message ? <p className="save-message">{message}</p> : null}
          </form>
        </article>
      </section>
    </section>
  );
}

function AccessDeniedPage() {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Access Denied</h1>
          <p>
            Your current role does not have permission to access this page.
            Admin Functions are limited to Admin login.
          </p>
        </div>
      </header>
      <section className="panel-grid">
        <article className="panel">
          <p className="panel-description">
            If you need access, sign out from the settings menu and log in as an
            Admin account.
          </p>
        </article>
      </section>
    </section>
  );
}

function NotFoundPage() {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Page Not Found</h1>
          <p>The route you entered is not connected yet.</p>
        </div>
      </header>
      <section className="panel-grid">
        <article className="panel">
          <NavLink className="primary-button button-link" to="/dashboard">
            Return to Dashboard
          </NavLink>
        </article>
      </section>
    </section>
  );
}

function RouteResolver({
  role,
  username,
  workflowStates,
  onSaveWorkflowStates,
  incidentDisplaySettings,
  onSaveIncidentDisplaySettings,
  submenuVisibility,
  onSaveSubmenuVisibility,
  nerisExportSettings,
  onSaveNerisExportSettings,
}: RouteResolverProps) {
  const location = useLocation();
  const path = normalizePath(location.pathname);

  if (path === "/") {
    return <Navigate to="/dashboard" replace />;
  }

  if (path === "/settings/profile") {
    return <ProfileManagementPage />;
  }

  if (path === "/settings/display") {
    return <EditDisplayPage />;
  }

  if (path === "/access-denied") {
    return <AccessDeniedPage />;
  }

  if (path === "/incidents") {
    return <Navigate to="/incidents-mapping" replace />;
  }
  if (path === "/incidents/dispatches") {
    return <Navigate to="/incidents-mapping/incidents" replace />;
  }
  if (path === "/incidents/map-view") {
    return <Navigate to="/incidents-mapping/map-view" replace />;
  }
  if (path === "/incidents/hydrants") {
    return <Navigate to="/admin-functions/hydrants" replace />;
  }

  if (role === "user" && isPathAdminOnly(path)) {
    return <Navigate to="/access-denied" replace />;
  }

  if (path === "/dashboard") {
    return <DashboardPage role={role} submenuVisibility={submenuVisibility} />;
  }

  if (path === "/incidents-mapping/incidents") {
    return (
      <IncidentsListPage
        incidentDisplaySettings={incidentDisplaySettings}
        onSaveIncidentDisplaySettings={onSaveIncidentDisplaySettings}
      />
    );
  }

  if (path.startsWith("/incidents-mapping/incidents/")) {
    const callNumber = decodeURIComponent(
      path.replace("/incidents-mapping/incidents/", ""),
    );
    return <IncidentCallDetailPage callNumber={callNumber} />;
  }

  if (path === "/reporting/neirs") {
    return <Navigate to="/reporting/neris" replace />;
  }

  if (path.startsWith("/reporting/neirs/")) {
    const legacyReportId = decodeURIComponent(path.replace("/reporting/neirs/", ""));
    return <Navigate to={`/reporting/neris/${encodeURIComponent(legacyReportId)}`} replace />;
  }

  if (path === "/reporting/neris") {
    return <NerisReportingPage />;
  }

  if (path === "/reporting/neris/exports") {
    return <NerisExportsPage />;
  }

  if (path.startsWith("/reporting/neris/exports/")) {
    const callNumber = decodeURIComponent(path.replace("/reporting/neris/exports/", ""));
    return <NerisExportDetailsPage callNumber={callNumber} />;
  }

  if (path.startsWith("/reporting/neris/")) {
    const callNumber = decodeURIComponent(path.replace("/reporting/neris/", ""));
    return (
      <NerisReportFormPage
        key={callNumber}
        callNumber={callNumber}
        role={role}
        username={username}
        nerisExportSettings={nerisExportSettings}
      />
    );
  }

  if (path === "/admin-functions/department-details") {
    return <DepartmentDetailsPage />;
  }

  if (path === "/admin-functions/hydrants") {
    return <HydrantsAdminPage />;
  }

  if (path === "/admin-functions/customization") {
    return (
      <CustomizationPage
        workflowStates={workflowStates}
        onSaveWorkflowStates={onSaveWorkflowStates}
        incidentDisplaySettings={incidentDisplaySettings}
        onSaveIncidentDisplaySettings={onSaveIncidentDisplaySettings}
        submenuVisibility={submenuVisibility}
        onSaveSubmenuVisibility={onSaveSubmenuVisibility}
        nerisExportSettings={nerisExportSettings}
        onSaveNerisExportSettings={onSaveNerisExportSettings}
      />
    );
  }

  const menu = getMainMenuByPath(path);
  if (menu && path === menu.path) {
    return (
      <MainMenuLandingPage
        menu={menu}
        role={role}
        submenuVisibility={submenuVisibility}
      />
    );
  }

  const submenu = getSubmenuByPath(path);
  if (submenu) {
    return <SubmenuPlaceholderPage submenu={submenu} />;
  }

  return <NotFoundPage />;
}

function App() {
  const [session, setSession] = useState<SessionState>(() => readSession());
  const [workflowStates, setWorkflowStates] = useState<string[]>(() =>
    readWorkflowStates(),
  );
  const [incidentDisplaySettings, setIncidentDisplaySettings] =
    useState<IncidentDisplaySettings>(() => readIncidentDisplaySettings());
  const [submenuVisibility, setSubmenuVisibility] = useState<SubmenuVisibilityMap>(
    () => readSubmenuVisibility(),
  );
  const [nerisExportSettings, setNerisExportSettings] =
    useState<NerisExportSettings>(() => readNerisExportSettings());

  const handleLogin = (username: string, unit: string, role: UserRole) => {
    const nextSession: SessionState = {
      isAuthenticated: true,
      username,
      unit,
      role,
    };
    setSession(nextSession);
    writeSession(nextSession);
  };

  const handleLogout = () => {
    setSession(EMPTY_SESSION);
    writeSession(EMPTY_SESSION);
  };

  const handleSaveWorkflowStates = (nextStates: string[]) => {
    const normalized = dedupeAndCleanStrings(nextStates);
    if (!normalized.length) {
      return;
    }
    setWorkflowStates(normalized);
    writeWorkflowStates(normalized);
  };

  const handleSaveIncidentDisplaySettings = (
    nextSettings: IncidentDisplaySettings,
  ) => {
    const normalized = normalizeIncidentDisplaySettings(nextSettings);
    if (!normalized.callFieldOrder.length) {
      return;
    }
    setIncidentDisplaySettings(normalized);
    writeIncidentDisplaySettings(normalized);
  };

  const handleSaveSubmenuVisibility = (nextVisibility: SubmenuVisibilityMap) => {
    const normalized = {
      ...getDefaultSubmenuVisibilityMap(),
      ...nextVisibility,
    };
    setSubmenuVisibility(normalized);
    writeSubmenuVisibility(normalized);
  };

  const handleSaveNerisExportSettings = (nextSettings: NerisExportSettings) => {
    const normalized = normalizeNerisExportSettings(nextSettings);
    setNerisExportSettings(normalized);
    writeNerisExportSettings(normalized);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={
            session.isAuthenticated ? (
              <Navigate to={getDefaultPathForRole(session.role)} replace />
            ) : (
              <AuthPage onLogin={handleLogin} />
            )
          }
        />

        <Route
          path="/*"
          element={
            session.isAuthenticated ? (
              <ShellLayout session={session} onLogout={handleLogout} />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        >
          <Route
            path="*"
            element={
              <RouteResolver
                role={session.role}
                username={session.username}
                workflowStates={workflowStates}
                onSaveWorkflowStates={handleSaveWorkflowStates}
                incidentDisplaySettings={incidentDisplaySettings}
                onSaveIncidentDisplaySettings={handleSaveIncidentDisplaySettings}
                submenuVisibility={submenuVisibility}
                onSaveSubmenuVisibility={handleSaveSubmenuVisibility}
                nerisExportSettings={nerisExportSettings}
                onSaveNerisExportSettings={handleSaveNerisExportSettings}
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

