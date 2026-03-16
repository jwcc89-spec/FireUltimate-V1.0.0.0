import {
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Palette,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  UserRound,
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
  getIncidentList,
  createIncident,
  updateIncident,
  deleteIncident,
} from "./api/incidents";
import {
  getNerisExportHistory,
  postNerisExportRecord,
} from "./api/nerisExportHistory";
import { getNerisDraft, patchNerisDraft } from "./api/nerisDrafts";
import { getNerisSettings, patchNerisSettings } from "./api/nerisSettings";
import {
  ALL_SUBMENU_PATHS,
  DASHBOARD_ALERTS,
  DASHBOARD_PRIORITY_LINKS,
  DASHBOARD_STATS,
  DEFAULT_DISPATCH_WORKFLOW_STATES,
  DEFAULT_INCIDENT_CALL_FIELD_ORDER,
  DISPATCH_PARSING_PREVIEW,
  INCIDENT_CALLS,
  INCIDENT_CALL_FIELD_OPTIONS,
  INCIDENT_QUEUE_STATS,
  MAIN_MENUS,
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
  type IncidentCallSummary,
  type IncidentCallFieldId,
  type IncidentDisplaySettings,
  type IncidentStatId,
  type MainMenu,
  type MainMenuId,
  type Tone,
  type UserRole,
} from "./appData";
import { SubmenuPlaceholderPage } from "./SubmenuPlaceholderPage";
import { HydrantsAdminPage } from "./HydrantsAdminPage";
import {
  getNerisValueOptions,
  type NerisFormValues,
  type NerisValueOption,
} from "./nerisMetadata";
import { PersonnelSchedulePage as PersonnelSchedulePageView } from "./PersonnelSchedulePage";
import { NerisReportFormPage as NerisReportFormPageView } from "./pages/NerisReportFormPage";
import {
  NerisFlatMultiOptionSelect,
  NerisFlatSingleOptionSelect,
} from "./NerisFlatSelects";
import { NerisGroupedOptionSelect } from "./NerisGroupedOptionSelect";
import { getRecurrenceIntervalDays, toDateKey } from "./scheduleUtils";

interface SessionState {
  isAuthenticated: boolean;
  username: string;
  unit: string;
  role: UserRole;
}

interface AuthPageProps {
  onLogin: (department: string, username: string, password: string) => Promise<string | null>;
}

interface ShellLayoutProps {
  session: SessionState;
  onLogout: () => void;
}

interface DashboardPageProps {
  role: UserRole;
  submenuVisibility: SubmenuVisibilityMap;
}

interface IncidentCreatePayload {
  incident_internal_id: string;
  dispatch_internal_id: string;
  incidentType: string;
  priority: string;
  stillDistrict: string;
  currentState: string;
  reportedBy: string;
  assignedUnits: string[];
  address: string;
  callbackNumber: string;
  dispatchNotes: string;
}

interface RouteResolverProps {
  role: UserRole;
  username: string;
  incidentCalls: IncidentCallSummary[];
  onCreateIncidentCall: (payload: IncidentCreatePayload) => Promise<IncidentCallSummary>;
  onUpdateIncidentCall: (
    callNumber: string,
    patch: Partial<IncidentCallSummary>,
  ) => void;
  onSetIncidentDeleted: (
    callNumber: string,
    deleted: boolean,
    reason?: string,
  ) => void;
  workflowStates: string[];
  onSaveWorkflowStates: (nextStates: string[]) => void;
  incidentDisplaySettings: IncidentDisplaySettings;
  onSaveIncidentDisplaySettings: (nextSettings: IncidentDisplaySettings) => void;
  submenuVisibility: SubmenuVisibilityMap;
  onSaveSubmenuVisibility: (nextVisibility: SubmenuVisibilityMap) => void;
  nerisExportSettings: NerisExportSettings;
  onSaveNerisExportSettings: (nextSettings: NerisExportSettings) => void;
  apparatusFromDepartmentDetails: { unit: string; unitType: string }[];
  nerisExportHistory: NerisExportRecord[];
  setNerisExportHistory: React.Dispatch<React.SetStateAction<NerisExportRecord[]>>;
}

interface MainMenuLandingPageProps {
  menu: MainMenu;
  role: UserRole;
  submenuVisibility: SubmenuVisibilityMap;
}

interface IncidentsListPageProps {
  incidentDisplaySettings: IncidentDisplaySettings;
  onSaveIncidentDisplaySettings: (nextSettings: IncidentDisplaySettings) => void;
  incidentCalls: IncidentCallSummary[];
  onCreateIncidentCall: (payload: IncidentCreatePayload) => Promise<IncidentCallSummary>;
}

interface IncidentCallDetailPageProps {
  callNumber: string;
  incidentCalls: IncidentCallSummary[];
  onUpdateIncidentCall: (
    callNumber: string,
    patch: Partial<IncidentCallSummary>,
  ) => void;
  onSetIncidentDeleted: (
    callNumber: string,
    deleted: boolean,
    reason?: string,
  ) => void;
}

interface NerisQueuePageProps {
  incidentCalls: IncidentCallSummary[];
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

interface NerisDraftNonFdAidEntry {
  aidType: string;
}

interface NerisStoredDraft {
  formValues: NerisFormValues;
  reportStatus: string;
  lastSavedAt: string;
  additionalAidEntries: NerisDraftAidEntry[];
  additionalNonFdAidEntries: NerisDraftNonFdAidEntry[];
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
  | "schedulerApparatus"
  | "shiftInformation"
  | "additionalFields"
  | "overtimeSetup"
  | "personnel"
  | "schedulerPersonnel"
  | "personnelQualifications"
  | "kellyRotation"
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

type KellyRotationUnit = "Days" | "Shifts";

interface KellyRotationEntry {
  personnel: string;
  repeatsEveryValue: number;
  repeatsEveryUnit: KellyRotationUnit;
  startsOn: string;
}

interface KellyRotationMultiAddDraft {
  shift: string;
  repeatsEveryValue: number;
  repeatsEveryUnit: KellyRotationUnit;
  startsOn: string;
  occurrenceSlots: string[][];
}

interface KellyMultiAddPendingConfirmation {
  entries: KellyRotationEntry[];
  replacements: string[];
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

interface DepartmentUserRecord {
  id?: string;
  name: string;
  userType: string;
  username: string;
  password: string;
}

interface MultiAddUserDraft {
  firstName: string;
  lastName: string;
  userType: string;
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
  commonName: string;
  unitType: string;
  make: string;
  model: string;
  year: string;
}

interface SchedulerApparatusRecord {
  apparatus: string;
  minimumPersonnel: number;
  maximumPersonnel: number;
  personnelRequirements: string[];
  station: string;
}

type AdditionalFieldValueMode = "text" | "personnel";

interface AdditionalFieldRecord {
  id: string;
  fieldName: string;
  numberOfSlots: number;
  valueMode: AdditionalFieldValueMode;
  personnelOverride: boolean;
}

interface DepartmentNerisEntityOption {
  id: string;
  name: string;
  state?: string;
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
const INCIDENT_QUEUE_STORAGE_KEY_PREFIX = "fire-ultimate-incident-queue";
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

function normalizeStorageUserKey(username: string | null | undefined): string {
  const cleaned = String(username ?? "").trim().toLowerCase();
  return cleaned.length > 0 ? cleaned : "anonymous";
}

function getUserScopedStorageKey(baseKey: string, username: string | null | undefined): string {
  return `${baseKey}:${normalizeStorageUserKey(username)}`;
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
type ApparatusGridFieldId = "commonName" | "unitType" | "make" | "model" | "year";
const APPARATUS_GRID_FIELD_ORDER: ApparatusGridFieldId[] = [
  "commonName",
  "unitType",
  "make",
  "model",
  "year",
];
const MIN_APPARATUS_FIELD_WIDTH = 70;
const MAX_APPARATUS_FIELD_WIDTH = 320;
const DEFAULT_APPARATUS_FIELD_WIDTHS: Record<ApparatusGridFieldId, number> = {
  commonName: 150,
  unitType: 120,
  make: 130,
  model: 130,
  year: 90,
};
type SchedulerApparatusGridFieldId =
  | "minPersonnel"
  | "maxPersonnel"
  | "personnelRequirements"
  | "station";
const SCHEDULER_APPARATUS_GRID_FIELD_ORDER: SchedulerApparatusGridFieldId[] = [
  "minPersonnel",
  "maxPersonnel",
  "personnelRequirements",
  "station",
];
const MIN_SCHEDULER_APPARATUS_FIELD_WIDTH = 70;
const MAX_SCHEDULER_APPARATUS_FIELD_WIDTH = 360;
const DEFAULT_SCHEDULER_APPARATUS_FIELD_WIDTHS: Record<SchedulerApparatusGridFieldId, number> = {
  minPersonnel: 110,
  maxPersonnel: 110,
  personnelRequirements: 210,
  station: 120,
};
type SchedulerPersonnelGridFieldId = "shift" | "apparatusAssignment" | "station" | "qualifications";
type UserTableColumnId = "name" | "username" | "userType";
const SCHEDULER_PERSONNEL_GRID_FIELD_ORDER: SchedulerPersonnelGridFieldId[] = [
  "shift",
  "apparatusAssignment",
  "station",
  "qualifications",
];
const MIN_SCHEDULER_PERSONNEL_FIELD_WIDTH = 80;
const MAX_SCHEDULER_PERSONNEL_FIELD_WIDTH = 360;
const DEFAULT_SCHEDULER_PERSONNEL_FIELD_WIDTHS: Record<SchedulerPersonnelGridFieldId, number> = {
  shift: 120,
  apparatusAssignment: 160,
  station: 120,
  qualifications: 210,
};
const MIN_USER_TABLE_COLUMN_WIDTH = 120;
const MAX_USER_TABLE_COLUMN_WIDTH = 440;
const DEFAULT_USER_TABLE_COLUMN_WIDTHS: Record<UserTableColumnId, number> = {
  name: 240,
  username: 200,
  userType: 180,
};
const DEFAULT_ADDITIONAL_FIELDS: AdditionalFieldRecord[] = [
  { id: "support-info", fieldName: "Info", numberOfSlots: 4, valueMode: "text", personnelOverride: false },
  { id: "support-chief-on-call", fieldName: "Chief on Call", numberOfSlots: 1, valueMode: "personnel", personnelOverride: true },
  { id: "support-vacation", fieldName: "Vacation", numberOfSlots: 2, valueMode: "personnel", personnelOverride: true },
  { id: "support-kelly-day", fieldName: "Kelly Day", numberOfSlots: 2, valueMode: "personnel", personnelOverride: true },
  { id: "support-injured", fieldName: "Injured", numberOfSlots: 2, valueMode: "personnel", personnelOverride: true },
  { id: "support-sick", fieldName: "Sick", numberOfSlots: 2, valueMode: "personnel", personnelOverride: true },
  { id: "support-other", fieldName: "Other", numberOfSlots: 2, valueMode: "personnel", personnelOverride: true },
  { id: "support-trade", fieldName: "Trade", numberOfSlots: 8, valueMode: "personnel", personnelOverride: true },
];

function normalizeAdditionalFields(raw: unknown): AdditionalFieldRecord[] {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_ADDITIONAL_FIELDS];
  }
  const parsed = raw
    .map((entry, index): AdditionalFieldRecord | null => {
      if (!entry || typeof entry !== "object") return null;
      const id = String((entry as { id?: unknown }).id ?? `support-custom-${index + 1}`).trim();
      const fieldName = String((entry as { fieldName?: unknown }).fieldName ?? "").trim();
      const valueModeRaw = String((entry as { valueMode?: unknown }).valueMode ?? "personnel").trim().toLowerCase();
      const valueMode: AdditionalFieldValueMode = valueModeRaw === "text" ? "text" : "personnel";
      const numberOfSlots = Math.max(1, Math.floor(Number((entry as { numberOfSlots?: unknown }).numberOfSlots ?? 1) || 1));
      const personnelOverride = Boolean((entry as { personnelOverride?: unknown }).personnelOverride);
      if (!fieldName) return null;
      return { id, fieldName, numberOfSlots, valueMode, personnelOverride };
    })
    .filter((entry): entry is AdditionalFieldRecord => Boolean(entry));

  const hasKelly = parsed.some((entry) => entry.id === "support-kelly-day");
  if (!hasKelly) {
    parsed.push(DEFAULT_ADDITIONAL_FIELDS.find((entry) => entry.id === "support-kelly-day")!);
  }
  return parsed.length > 0 ? parsed : [...DEFAULT_ADDITIONAL_FIELDS];
}

function toAdditionalFieldId(fieldName: string): string {
  const normalized = fieldName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized ? `support-${normalized}` : "support-custom";
}
const USER_UI_PREFERENCES_FALLBACK_KEY = "__default__";

function normalizeApparatusFieldWidths(
  raw: unknown,
): Record<ApparatusGridFieldId, number> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const next = { ...DEFAULT_APPARATUS_FIELD_WIDTHS };
  APPARATUS_GRID_FIELD_ORDER.forEach((fieldId) => {
    const candidate = Number(source[fieldId]);
    if (Number.isFinite(candidate)) {
      next[fieldId] = Math.min(
        MAX_APPARATUS_FIELD_WIDTH,
        Math.max(MIN_APPARATUS_FIELD_WIDTH, candidate),
      );
    }
  });
  return next;
}

function normalizeSchedulerApparatusFieldWidths(
  raw: unknown,
): Record<SchedulerApparatusGridFieldId, number> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const next = { ...DEFAULT_SCHEDULER_APPARATUS_FIELD_WIDTHS };
  SCHEDULER_APPARATUS_GRID_FIELD_ORDER.forEach((fieldId) => {
    const candidate = Number(source[fieldId]);
    if (Number.isFinite(candidate)) {
      next[fieldId] = Math.min(
        MAX_SCHEDULER_APPARATUS_FIELD_WIDTH,
        Math.max(MIN_SCHEDULER_APPARATUS_FIELD_WIDTH, candidate),
      );
    }
  });
  return next;
}

function normalizeSchedulerPersonnelFieldWidths(
  raw: unknown,
): Record<SchedulerPersonnelGridFieldId, number> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const next = { ...DEFAULT_SCHEDULER_PERSONNEL_FIELD_WIDTHS };
  SCHEDULER_PERSONNEL_GRID_FIELD_ORDER.forEach((fieldId) => {
    const candidate = Number(source[fieldId]);
    if (Number.isFinite(candidate)) {
      next[fieldId] = Math.min(
        MAX_SCHEDULER_PERSONNEL_FIELD_WIDTH,
        Math.max(MIN_SCHEDULER_PERSONNEL_FIELD_WIDTH, candidate),
      );
    }
  });
  return next;
}

function normalizeUserTableColumnWidths(
  raw: unknown,
): Record<UserTableColumnId, number> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const next = { ...DEFAULT_USER_TABLE_COLUMN_WIDTHS };
  (Object.keys(DEFAULT_USER_TABLE_COLUMN_WIDTHS) as UserTableColumnId[]).forEach((columnId) => {
    const candidate = Number(source[columnId]);
    if (Number.isFinite(candidate)) {
      next[columnId] = Math.min(
        MAX_USER_TABLE_COLUMN_WIDTH,
        Math.max(MIN_USER_TABLE_COLUMN_WIDTH, candidate),
      );
    }
  });
  return next;
}

function normalizeApparatusFieldOrder(raw: unknown): ApparatusGridFieldId[] {
  if (!Array.isArray(raw)) {
    return [...APPARATUS_GRID_FIELD_ORDER];
  }
  const parsed = raw.filter((value): value is ApparatusGridFieldId =>
    APPARATUS_GRID_FIELD_ORDER.includes(value as ApparatusGridFieldId),
  );
  const unique = Array.from(new Set(parsed));
  if (unique.length !== APPARATUS_GRID_FIELD_ORDER.length) {
    return [...APPARATUS_GRID_FIELD_ORDER];
  }
  return unique;
}
const DEPARTMENT_COLLECTION_DEFINITIONS: DepartmentCollectionDefinition[] = [
  {
    key: "stations",
    label: "Stations",
    editButtonLabel: "Edit Stations",
    helperText: "",
  },
  {
    key: "apparatus",
    label: "Department Apparatus",
    editButtonLabel: "Edit Department Apparatus",
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
    label: "Users",
    editButtonLabel: "Edit Users",
    helperText: "",
  },
  {
    key: "schedulerPersonnel",
    label: "Personnel",
    editButtonLabel: "Edit Personnel",
    helperText: "",
  },
  {
    key: "schedulerApparatus",
    label: "Scheduler Apparatus",
    editButtonLabel: "Edit Scheduler Apparatus",
    helperText: "",
  },
  {
    key: "additionalFields",
    label: "Additional Fields",
    editButtonLabel: "Edit Additional Fields",
    helperText: "",
  },
  {
    key: "overtimeSetup",
    label: "Overtime Setup",
    editButtonLabel: "Edit Overtime Setup",
    helperText: "",
  },
  {
    key: "personnelQualifications",
    label: "Personnel Qualifications",
    editButtonLabel: "Edit Personnel Qualifications",
    helperText: "",
  },
  {
    key: "kellyRotation",
    label: "Kelly Rotation",
    editButtonLabel: "Edit Kelly Rotation",
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
const DEFAULT_USER_TYPE_VALUES = ["Super Admin", "Admin", "Sub Admin", "Secretary", "User"];
const GMT_TIMEZONE_OPTIONS = [
  "GMT-05:00 Eastern",
  "GMT-06:00 Central",
  "GMT-07:00 Mountain",
  "GMT-08:00 Pacific",
] as const;
const DEPARTMENT_ENTITY_FALLBACK_OPTIONS: DepartmentNerisEntityOption[] = [
  { id: "FD00001001", name: "Fallback Fire Department 1", state: "Unknown" },
  { id: "FD00001002", name: "Fallback Fire Department 2", state: "Unknown" },
  { id: "FD00001003", name: "Fallback Fire Department 3", state: "Unknown" },
];

type IncidentSetupRequiredFieldKey =
  | "incidentType"
  | "priority"
  | "stillDistrict"
  | "currentState"
  | "reportedBy"
  | "assignedUnits"
  | "address"
  | "callbackNumber"
  | "incidentNumber"
  | "dispatchNumber"
  | "dispatchNotes";

interface IncidentsSetupConfig {
  incidentTypeOptions: string[];
  priorityOptions: string[];
  stillDistrictOptions: string[];
  currentStateOptions: string[];
  reportedByMode: "fill-in" | "dropdown";
  reportedByOptions: string[];
  requiredFields: Record<IncidentSetupRequiredFieldKey, boolean>;
  visibleFields: Record<IncidentSetupRequiredFieldKey, boolean>;
}

const DEFAULT_INCIDENTS_SETUP_CONFIG: IncidentsSetupConfig = {
  incidentTypeOptions: ["FIRE", "EMS", "RESCUE", "SERVICE"],
  priorityOptions: ["1", "2", "3", "4"],
  stillDistrictOptions: ["District 1", "District 2", "District 3"],
  currentStateOptions: ["Draft", "Dispatched", "Enroute", "On scene", "Cleared"],
  reportedByMode: "fill-in",
  reportedByOptions: [],
  requiredFields: {
    incidentType: false,
    priority: false,
    stillDistrict: false,
    currentState: false,
    reportedBy: false,
    assignedUnits: false,
    address: false,
    callbackNumber: false,
    incidentNumber: false,
    dispatchNumber: false,
    dispatchNotes: false,
  },
  visibleFields: {
    incidentType: true,
    priority: true,
    stillDistrict: true,
    currentState: true,
    reportedBy: true,
    assignedUnits: true,
    address: true,
    callbackNumber: true,
    incidentNumber: true,
    dispatchNumber: true,
    dispatchNotes: true,
  },
};

const INCIDENTS_REQUIRED_FIELD_ORDER: IncidentSetupRequiredFieldKey[] = [
  "incidentType",
  "priority",
  "stillDistrict",
  "currentState",
  "reportedBy",
  "assignedUnits",
  "address",
  "callbackNumber",
  "incidentNumber",
  "dispatchNumber",
  "dispatchNotes",
];

const INCIDENTS_SETUP_FIELD_LABELS: Record<IncidentSetupRequiredFieldKey, string> = {
  incidentType: "Incident Type",
  priority: "Priority",
  stillDistrict: "Still District",
  currentState: "Status",
  reportedBy: "Reported By",
  assignedUnits: "Assigned Units",
  address: "Address",
  callbackNumber: "Callback Number",
  incidentNumber: "Incident Number",
  dispatchNumber: "Dispatch Number",
  dispatchNotes: "Dispatch Notes",
};

interface IncidentSetupFieldCardDefinition {
  key: IncidentSetupRequiredFieldKey;
  editButtonLabel?: string;
  optionsKey?: IncidentSetupOptionsKey;
}

type IncidentSetupOptionsKey =
  | "incidentTypeOptions"
  | "priorityOptions"
  | "stillDistrictOptions"
  | "currentStateOptions"
  | "reportedByOptions";

const INCIDENTS_SETUP_FIELD_CARDS: IncidentSetupFieldCardDefinition[] = [
  { key: "incidentType", editButtonLabel: "Edit Incident Type", optionsKey: "incidentTypeOptions" },
  { key: "priority", editButtonLabel: "Edit Priority", optionsKey: "priorityOptions" },
  { key: "stillDistrict", editButtonLabel: "Edit Still District", optionsKey: "stillDistrictOptions" },
  { key: "currentState", editButtonLabel: "Edit Status", optionsKey: "currentStateOptions" },
  { key: "reportedBy", editButtonLabel: "Edit Reported By", optionsKey: "reportedByOptions" },
  { key: "assignedUnits" },
  { key: "address" },
  { key: "callbackNumber" },
  { key: "incidentNumber" },
  { key: "dispatchNumber" },
  { key: "dispatchNotes" },
];

const INCIDENT_CALL_FIELD_TO_SETUP_FIELD: Partial<
  Record<IncidentCallFieldId, IncidentSetupRequiredFieldKey>
> = {
  incidentType: "incidentType",
  priority: "priority",
  address: "address",
  assignedUnits: "assignedUnits",
};

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

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return Array.from(
    new Set(
      raw
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function normalizeIncidentsSetupConfig(raw: unknown): IncidentsSetupConfig {
  const source: Record<string, unknown> =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const requiredSource =
    source.requiredFields &&
    typeof source.requiredFields === "object" &&
    !Array.isArray(source.requiredFields)
      ? (source.requiredFields as Record<string, unknown>)
      : {};
  const visibleSource =
    source.visibleFields &&
    typeof source.visibleFields === "object" &&
    !Array.isArray(source.visibleFields)
      ? (source.visibleFields as Record<string, unknown>)
      : {};
  const requiredFields = INCIDENTS_REQUIRED_FIELD_ORDER.reduce(
    (accumulator, key) => {
      accumulator[key] = Boolean(requiredSource[key]);
      return accumulator;
    },
    { ...DEFAULT_INCIDENTS_SETUP_CONFIG.requiredFields } as Record<
      IncidentSetupRequiredFieldKey,
      boolean
    >,
  );
  const visibleFields = INCIDENTS_REQUIRED_FIELD_ORDER.reduce(
    (accumulator, key) => {
      accumulator[key] =
        key in visibleSource
          ? Boolean(visibleSource[key])
          : DEFAULT_INCIDENTS_SETUP_CONFIG.visibleFields[key];
      return accumulator;
    },
    { ...DEFAULT_INCIDENTS_SETUP_CONFIG.visibleFields } as Record<
      IncidentSetupRequiredFieldKey,
      boolean
    >,
  );
  const reportedByMode =
    String(source.reportedByMode ?? "").trim().toLowerCase() === "dropdown"
      ? "dropdown"
      : "fill-in";
  return {
    incidentTypeOptions:
      normalizeStringArray(source.incidentTypeOptions).length > 0
        ? normalizeStringArray(source.incidentTypeOptions)
        : [...DEFAULT_INCIDENTS_SETUP_CONFIG.incidentTypeOptions],
    priorityOptions:
      normalizeStringArray(source.priorityOptions).length > 0
        ? normalizeStringArray(source.priorityOptions)
        : [...DEFAULT_INCIDENTS_SETUP_CONFIG.priorityOptions],
    stillDistrictOptions:
      normalizeStringArray(source.stillDistrictOptions).length > 0
        ? normalizeStringArray(source.stillDistrictOptions)
        : [...DEFAULT_INCIDENTS_SETUP_CONFIG.stillDistrictOptions],
    currentStateOptions:
      normalizeStringArray(source.currentStateOptions).length > 0
        ? normalizeStringArray(source.currentStateOptions)
        : [...DEFAULT_INCIDENTS_SETUP_CONFIG.currentStateOptions],
    reportedByMode,
    reportedByOptions: normalizeStringArray(source.reportedByOptions),
    requiredFields,
    visibleFields,
  };
}

function readIncidentsSetupConfigFromDraft(): IncidentsSetupConfig {
  const draft = readDepartmentDetailsDraft();
  return normalizeIncidentsSetupConfig(draft.incidentsSetup);
}

function readApparatusOptionsFromDraft(): NerisValueOption[] {
  const draft = normalizeDepartmentDraft(readDepartmentDetailsDraft());
  const records = Array.isArray(draft.masterApparatusRecords)
    ? (draft.masterApparatusRecords as DepartmentApparatusRecord[])
    : [];
  return records
    .map((record) => ({
      value: String(record.commonName || record.unitId || "").trim(),
      label: String(record.commonName || record.unitId || "").trim(),
    }))
    .filter((option) => option.value.length > 0);
}

/** Apparatus from Department Details for NERIS Resources (unit + unitType for auto-fill). */
function readApparatusFromDepartmentDetails(): { unit: string; unitType: string }[] {
  const draft = normalizeDepartmentDraft(readDepartmentDetailsDraft());
  const records = Array.isArray(draft.masterApparatusRecords)
    ? (draft.masterApparatusRecords as DepartmentApparatusRecord[])
    : [];
  return records
    .map((record) => ({
      unit: String(record.commonName || record.unitId || "").trim(),
      unitType: String(record.unitType ?? "").trim(),
    }))
    .filter((entry) => entry.unit.length > 0);
}

function getIncidentDisplayNumber(call: IncidentCallSummary): string {
  return String(call.incident_internal_id ?? call.incidentNumber ?? call.callNumber).trim() || call.callNumber;
}

function normalizeDepartmentDraft(raw: Record<string, unknown>): Record<string, unknown> {
  const d = raw && typeof raw === "object" ? raw : {};
  const legacyApparatusRaw = d.apparatusRecords;
  const legacyMaxByUnitType = (unitTypeRaw: unknown): number => {
    const t = String(unitTypeRaw ?? "").toUpperCase();
    if (t.includes("AMB")) return 3;
    if (t.includes("ENGINE")) return 4;
    if (t.includes("LADDER") || t.includes("TOWER")) return 2;
    if (t.includes("CHIEF") || t.includes("COMMAND") || t.includes("CAR")) return 1;
    return 2;
  };
  const legacyApparatusRecords = Array.isArray(legacyApparatusRaw)
    ? legacyApparatusRaw
        .map((entry: Record<string, unknown>) => ({
          unitId: String(entry?.unitId ?? "").trim(),
          commonName: String(entry?.commonName ?? entry?.unitId ?? "").trim(),
          unitType: String(entry?.unitType ?? "").trim(),
          make: String(entry?.make ?? "").trim(),
          model: String(entry?.model ?? "").trim(),
          year: String(entry?.year ?? "").trim(),
          minimumPersonnel: Number(entry?.minimumPersonnel ?? 0) || 0,
          personnelRequirements: Array.isArray(entry?.personnelRequirements)
            ? (entry.personnelRequirements as string[]).filter((q): q is string => typeof q === "string")
            : [],
          station: String(entry?.station ?? "").trim(),
        }))
        .filter((entry) => entry.unitId.length > 0 || entry.commonName.length > 0)
    : [];
  const masterApparatusRaw = d.masterApparatusRecords;
  const masterApparatusRecords = Array.isArray(masterApparatusRaw)
    ? masterApparatusRaw
        .map((entry: Record<string, unknown>) => ({
          unitId: String(entry?.unitId ?? "").trim(),
          commonName: String(entry?.commonName ?? "").trim(),
          unitType: String(entry?.unitType ?? "").trim(),
          make: String(entry?.make ?? "").trim(),
          model: String(entry?.model ?? "").trim(),
          year: String(entry?.year ?? "").trim(),
        }))
        .filter((entry) => entry.unitId.length > 0 || entry.commonName.length > 0)
    : legacyApparatusRecords.map((entry) => ({
        unitId: entry.unitId,
        commonName: entry.commonName,
        unitType: entry.unitType,
        make: entry.make,
        model: entry.model,
        year: entry.year,
      }));
  const schedulerApparatusRaw = d.schedulerApparatusRecords;
  const schedulerApparatusRecords = Array.isArray(schedulerApparatusRaw)
    ? schedulerApparatusRaw
        .map((entry: Record<string, unknown>) => {
          const minimumPersonnel = Number(entry?.minimumPersonnel ?? 0) || 0;
          const maximumCandidate =
            Number(entry?.maximumPersonnel ?? entry?.maxPersonnel ?? minimumPersonnel) || 0;
          return {
            apparatus: String(entry?.apparatus ?? "").trim(),
            minimumPersonnel,
            maximumPersonnel: Math.max(minimumPersonnel, maximumCandidate || 2),
            personnelRequirements: Array.isArray(entry?.personnelRequirements)
              ? (entry.personnelRequirements as string[]).filter((q): q is string => typeof q === "string")
              : [],
            station: String(entry?.station ?? "").trim(),
          };
        })
        .filter((entry) => entry.apparatus.length > 0)
    : legacyApparatusRecords.map((entry) => {
        const minimumPersonnel = entry.minimumPersonnel;
        const maximumPersonnel = Math.max(
          minimumPersonnel,
          legacyMaxByUnitType(entry.unitType),
        );
        return {
          apparatus: entry.commonName || entry.unitId,
          minimumPersonnel,
          maximumPersonnel,
          personnelRequirements: entry.personnelRequirements,
          station: entry.station,
        };
      });
  const additionalFields = normalizeAdditionalFields(d.additionalFields);
  const personnelRaw = d.personnelRecords;
  const legacySchedulerRecords = Array.isArray(personnelRaw)
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
  const userRecordsRaw = d.userRecords;
  const userRecords = Array.isArray(userRecordsRaw)
    ? userRecordsRaw
        .map((entry: Record<string, unknown>) => ({
          name: String(entry?.name ?? "").trim(),
          userType: String(entry?.userType ?? "").trim(),
          username: String(entry?.username ?? "").trim(),
          password: String(entry?.password ?? ""),
        }))
        .filter((entry) => entry.name.length > 0)
    : legacySchedulerRecords
        .map((entry) => ({
          name: String(entry.name ?? "").trim(),
          userType: String(entry.userType ?? "").trim(),
          username: "",
          password: "",
        }))
        .filter((entry) => entry.name.length > 0);
  const schedulerRaw = d.schedulerPersonnelRecords;
  const schedulerPersonnelSeed = Array.isArray(schedulerRaw)
    ? schedulerRaw.map((entry: Record<string, unknown>) => ({
        name: String(entry?.name ?? ""),
        shift: String(entry?.shift ?? ""),
        apparatusAssignment: String(entry?.apparatusAssignment ?? ""),
        station: String(entry?.station ?? ""),
        userType: String(entry?.userType ?? ""),
        qualifications: Array.isArray(entry?.qualifications)
          ? (entry.qualifications as string[]).filter((q): q is string => typeof q === "string")
          : [],
      }))
    : legacySchedulerRecords;
  const schedulerByName = new Map(
    schedulerPersonnelSeed
      .map((entry) => [entry.name.trim().toLocaleLowerCase(), entry] as const)
      .filter(([name]) => name.length > 0),
  );
  const schedulerSeedUsers =
    userRecords.length > 0
      ? userRecords
      : schedulerPersonnelSeed
          .map((entry) => ({
            name: String(entry.name ?? "").trim(),
            userType: String(entry.userType ?? "").trim(),
            username: "",
            password: "",
          }))
          .filter((entry) => entry.name.length > 0);
  const schedulerPersonnelRecords = schedulerSeedUsers
    .map((user) => {
      const normalizedName = user.name.trim();
      const match = schedulerByName.get(normalizedName.toLocaleLowerCase());
      if (match) {
        return { ...match, name: normalizedName, userType: user.userType };
      }
      return {
        name: normalizedName,
        shift: "",
        apparatusAssignment: "",
        station: "",
        userType: user.userType,
        qualifications: [],
      } satisfies DepartmentPersonnelRecord;
    })
    .filter((entry) => entry.name.length > 0);
  const kellyRaw = d.kellyRotations;
  const kellyRotations = Array.isArray(kellyRaw)
    ? kellyRaw
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const repeatsEveryValue = Number((entry as { repeatsEveryValue?: unknown }).repeatsEveryValue);
          const repeatsEveryUnitRaw = String((entry as { repeatsEveryUnit?: unknown }).repeatsEveryUnit ?? "Shifts");
          const repeatsEveryUnit: KellyRotationUnit =
            repeatsEveryUnitRaw === "Days" ? "Days" : "Shifts";
          return {
            personnel: String((entry as { personnel?: unknown }).personnel ?? ""),
            repeatsEveryValue: Number.isFinite(repeatsEveryValue) && repeatsEveryValue > 0 ? repeatsEveryValue : 1,
            repeatsEveryUnit,
            startsOn: String((entry as { startsOn?: unknown }).startsOn ?? ""),
          } satisfies KellyRotationEntry;
        })
        .filter((entry): entry is KellyRotationEntry => Boolean(entry))
    : [];
  const schedulerEnabled =
    typeof d.schedulerEnabled === "boolean"
      ? d.schedulerEnabled
      : schedulerPersonnelRecords.length > 0 || kellyRotations.length > 0;
  const standardOvertimeSlot = Math.max(
    1,
    Math.floor(Number(d.standardOvertimeSlot ?? 24) || 24),
  );
  return {
    ...d,
    masterApparatusRecords,
    schedulerApparatusRecords,
    userRecords,
    schedulerPersonnelRecords,
    additionalFields,
    standardOvertimeSlot,
    schedulerEnabled,
    kellyRotations,
  };
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
const NERIS_AID_DEPARTMENT_ID_PATTERN = /^(FD|FM)\d{8}$/;
const NERIS_PROXY_MAPPED_FORM_FIELD_IDS = new Set<string>([
  "incident_internal_id",
  "dispatch_internal_id",
  "fd_neris_id",
  "incident_neris_id",
  "primary_incident_type",
  "additional_incident_types",
  "special_incident_modifiers",
  "incident_actions_taken",
  "incident_noaction",
  "incident_people_present",
  "incident_displaced_number",
  "incident_displaced_cause",
  "narrative_outcome",
  "narrative_obstacles",
  "incident_time_call_create",
  "incident_time_call_answered",
  "incident_time_call_arrival",
  "incident_time_unit_dispatched",
  "incident_time_unit_enroute",
  "incident_time_unit_staged",
  "incident_time_unit_on_scene",
  "incident_time_unit_canceled",
  "incident_time_unit_clear",
  "incident_time_clear",
  "incident_onset_date",
  "incident_onset_time",
  "incident_location_address",
  "dispatch_location_address",
  "location_place_type",
  "location_use_primary",
  "location_use_secondary",
  "location_in_use",
  "location_used_as_intended",
  "location_vacancy_cause",
  "location_state",
  "location_country",
  "location_direction_of_travel",
  "location_cross_street_type",
  "location_cross_street_name",
  "location_postal_code",
  "location_county",
  "dispatch_center_id",
  "dispatch_determinate_code",
  "initial_dispatch_code",
  "dispatch_final_disposition",
  "dispatch_automatic_alarm",
  "incident_has_aid",
  "incident_aid_agency_type",
  "incident_aid_direction",
  "incident_aid_type",
  "incident_aid_department_name",
  "incident_aid_nonfd",
  "resource_units_json",
  "resource_primary_unit_id",
  "resource_primary_unit_response_mode",
  "resource_additional_units",
  "resource_primary_unit_staffing",
  "emerging_haz_electrocution_items_json",
  "emerging_haz_power_generation_items_json",
  "medical_patient_care_report_id",
  "medical_patient_care_evaluation",
  "medical_patient_status",
  "medical_transport_disposition",
  "medical_patient_count",
]);

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
    normalized.includes("exported") ||
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

interface ParsedImportedLocationValues {
  locationState: string;
  locationCountry: string;
  locationPostalCode: string;
  locationCounty: string;
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

/** Return datetime string with date only (time 00:00:00) for "Populate Date" behavior. */
function toResourceDateOnlyInputValue(value: string, fallbackDate: string): string {
  const full = toResourceDateTimeInputValue(value, fallbackDate);
  if (!full) return "";
  const datePart = full.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "";
  return `${datePart}T00:00:00`;
}

/** Date part (YYYY-MM-DD) for date input; stored value is YYYY-MM-DDTHH:mm:ss. */
function formatResourceDatePart(value: string): string {
  const trimmed = (value ?? "").trim();
  if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return "";
}

/** Time part (HH:mm:ss, 24h only) for time input. Never returns 12h AM/PM. */
function formatResourceTimePart(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "00:00:00";
  // Datetime: YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss or with Z
  if (trimmed.length >= 16 && trimmed[10] === "T") {
    const timePart = trimmed.slice(11, 19);
    if (/^\d{2}:\d{2}:\d{2}$/.test(timePart)) return timePart;
    const short = trimmed.slice(11, 16);
    if (/^\d{2}:\d{2}$/.test(short)) return `${short}:00`;
  }
  // Time only HH:mm or HH:mm:ss
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(trimmed)) {
    const parts = trimmed.split(":");
    const hour = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
    const min = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));
    const sec = parts[2] != null ? Math.min(59, Math.max(0, parseInt(parts[2], 10) || 0)) : 0;
    return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  // Legacy or locale string containing AM/PM: parse and force 24h
  const upper = trimmed.toUpperCase();
  if (upper.includes("AM") || upper.includes("PM")) {
    const d = new Date(`1970-01-01 ${trimmed}`);
    if (!Number.isNaN(d.valueOf())) {
      const h = d.getHours();
      const m = d.getMinutes();
      const s = d.getSeconds();
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
  }
  return "00:00:00";
}

/** Parse user time input to HH:mm:ss 24h (e.g. "160445" -> "16:04:45", "1604" -> "16:04:00"). */
function parseTimeInput24h(value: string): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 0) return "00:00:00";
  if (digits.length === 1) return `${digits.padStart(2, "0")}:00:00`;
  if (digits.length === 2) return `${digits}:00:00`;
  if (digits.length === 3) {
    const hour = Math.min(23, Math.max(0, parseInt(digits.slice(0, 1), 10)));
    const min = Math.min(59, Math.max(0, parseInt(digits.slice(1, 3), 10)));
    return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
  }
  if (digits.length === 4) {
    const hour = Math.min(23, Math.max(0, parseInt(digits.slice(0, 2), 10)));
    const min = Math.min(59, Math.max(0, parseInt(digits.slice(2, 4), 10)));
    return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
  }
  if (digits.length === 5) {
    const hour = Math.min(23, Math.max(0, parseInt(digits.slice(0, 2), 10)));
    const min = Math.min(59, Math.max(0, parseInt(digits.slice(2, 4), 10)));
    const sec = Math.min(59, Math.max(0, parseInt(digits.slice(4, 5).padEnd(2, "0"), 10)));
    return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  const h = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const s = digits.slice(4, 6);
  const hour = Math.min(23, Math.max(0, parseInt(h, 10)));
  const min = Math.min(59, Math.max(0, parseInt(m, 10)));
  const sec = Math.min(59, Math.max(0, parseInt(s, 10)));
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Combine date and time parts into YYYY-MM-DDTHH:mm:ss (24h). */
function combineResourceDateTimeFromParts(datePart: string, timePart: string): string {
  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "";
  const t = (timePart ?? "").trim();
  const time = /^\d{2}:\d{2}:\d{2}$/.test(t) ? t : /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : "00:00:00";
  return `${datePart}T${time}`;
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
  field:
    | "personnel"
    | "dispatchTime"
    | "enrouteTime"
    | "stagedTime"
    | "onSceneTime"
    | "canceledTime"
    | "clearTime",
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
    callFieldWidths: { ...DEFAULT_CALL_FIELD_WIDTHS },
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
  const rawWidths =
    settings.callFieldWidths &&
    typeof settings.callFieldWidths === "object" &&
    !Array.isArray(settings.callFieldWidths)
      ? (settings.callFieldWidths as Partial<Record<IncidentCallFieldId, number>>)
      : {};
  const callFieldWidths: Record<IncidentCallFieldId, number> = {
    ...DEFAULT_CALL_FIELD_WIDTHS,
  };
  for (const fieldId of INCIDENT_CALL_FIELD_OPTIONS.map((field) => field.id)) {
    const candidate = rawWidths[fieldId];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      callFieldWidths[fieldId] = Math.min(
        MAX_CALL_FIELD_WIDTH,
        Math.max(MIN_CALL_FIELD_WIDTH, Math.round(candidate)),
      );
    }
  }

  return {
    hiddenStatIds: dedupeIncidentStatIds(hiddenStatIds),
    callFieldOrder: callFieldOrder.length
      ? callFieldOrder
      : [...defaultSettings.callFieldOrder],
    callFieldWidths,
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

function readIncidentDisplaySettings(username?: string): IncidentDisplaySettings {
  if (typeof window === "undefined") {
    return getDefaultIncidentDisplaySettings();
  }

  const userScopedKey = getUserScopedStorageKey(INCIDENT_DISPLAY_STORAGE_KEY, username);
  let rawValue = readStorageWithMigration(userScopedKey, []);
  if (!rawValue) {
    const fallbackValue = readStorageWithMigration(
      INCIDENT_DISPLAY_STORAGE_KEY,
      LEGACY_INCIDENT_DISPLAY_STORAGE_KEYS,
    );
    if (fallbackValue) {
      window.localStorage.setItem(userScopedKey, fallbackValue);
      rawValue = fallbackValue;
    }
  }
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

function writeIncidentDisplaySettings(
  settings: IncidentDisplaySettings,
  username?: string,
): void {
  if (typeof window === "undefined") {
    return;
  }
  writeStorageValue(
    getUserScopedStorageKey(INCIDENT_DISPLAY_STORAGE_KEY, username),
    [],
    JSON.stringify(settings),
  );
}

function getIncidentQueueStorageKey(): string {
  if (typeof window === "undefined") {
    return INCIDENT_QUEUE_STORAGE_KEY_PREFIX;
  }
  const host = window.location.hostname.trim().toLowerCase() || "unknown-host";
  return `${INCIDENT_QUEUE_STORAGE_KEY_PREFIX}:${host}`;
}

function normalizeIncidentSummary(candidate: unknown): IncidentCallSummary | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const source = candidate as Record<string, unknown>;
  const callNumber = String(source.callNumber ?? "").trim();
  if (!callNumber) {
    return null;
  }
  return {
    callNumber,
    incident_internal_id: String(source.incident_internal_id ?? source.incidentNumber ?? "").trim(),
    dispatch_internal_id: String(source.dispatch_internal_id ?? source.dispatchNumber ?? "").trim(),
    incidentNumber: String(source.incidentNumber ?? source.incident_internal_id ?? "").trim(),
    dispatchNumber: String(source.dispatchNumber ?? source.dispatch_internal_id ?? "").trim(),
    deletedAt: String(source.deletedAt ?? "").trim() || undefined,
    deletedBy: String(source.deletedBy ?? "").trim() || undefined,
    deletedReason: String(source.deletedReason ?? "").trim() || undefined,
    incidentType: String(source.incidentType ?? "").trim() || "Unknown",
    priority: String(source.priority ?? "").trim() || "3",
    address: String(source.address ?? "").trim() || "Unknown",
    stillDistrict: String(source.stillDistrict ?? "").trim() || "Unknown",
    assignedUnits: String(source.assignedUnits ?? "").trim(),
    reportedBy: String(source.reportedBy ?? "").trim() || undefined,
    callbackNumber: String(source.callbackNumber ?? "").trim() || undefined,
    dispatchNotes: Array.isArray(source.dispatchNotes)
      ? source.dispatchNotes.map((entry) => String(entry ?? "")).join("\n")
      : String(source.dispatchNotes ?? "").trim() || undefined,
    currentState: String(source.currentState ?? "").trim() || "Draft",
    lastUpdated: String(source.lastUpdated ?? "").trim() || "Just now",
    receivedAt: String(source.receivedAt ?? "").trim(),
    dispatchInfo: String(source.dispatchInfo ?? "").trim(),
  };
}

function isIncidentHiddenFromQueue(call: IncidentCallSummary): boolean {
  return Boolean(call.deletedAt && String(call.deletedAt).trim().length > 0);
}

function readIncidentQueue(): IncidentCallSummary[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(getIncidentQueueStorageKey());
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => normalizeIncidentSummary(entry))
      .filter((entry): entry is IncidentCallSummary => Boolean(entry));
  } catch {
    return [];
  }
}

function writeIncidentQueue(calls: IncidentCallSummary[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(getIncidentQueueStorageKey(), JSON.stringify(calls));
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
      const additionalNonFdAidEntries: NerisDraftNonFdAidEntry[] = Array.isArray(
        candidate.additionalNonFdAidEntries,
      )
        ? candidate.additionalNonFdAidEntries.reduce<NerisDraftNonFdAidEntry[]>(
            (entriesAccumulator, entryValue) => {
              if (!entryValue || typeof entryValue !== "object") {
                return entriesAccumulator;
              }
              const entry = entryValue as Record<string, unknown>;
              entriesAccumulator.push({
                aidType: typeof entry.aidType === "string" ? entry.aidType : "",
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
        additionalNonFdAidEntries,
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

/** Normalize API draft payload to NerisStoredDraft for form consumption. */
function normalizeApiDraftPayload(
  payload: unknown,
  callNumber: string,
): NerisStoredDraft | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;
  const formValuesCandidate = candidate.formValues;
  const formValues: NerisFormValues = {};
  if (formValuesCandidate && typeof formValuesCandidate === "object") {
    for (const [fieldId, fieldValue] of Object.entries(
      formValuesCandidate as Record<string, unknown>,
    )) {
      if (typeof fieldValue === "string") formValues[fieldId] = fieldValue;
    }
  }
  const additionalAidEntries: NerisDraftAidEntry[] = Array.isArray(
    candidate.additionalAidEntries,
  )
    ? (candidate.additionalAidEntries as Record<string, unknown>[]).reduce<
        NerisDraftAidEntry[]
      >((acc, entry) => {
        if (!entry || typeof entry !== "object") return acc;
        acc.push({
          aidDirection: typeof entry.aidDirection === "string" ? entry.aidDirection : "",
          aidType: typeof entry.aidType === "string" ? entry.aidType : "",
          aidDepartment: typeof entry.aidDepartment === "string" ? entry.aidDepartment : "",
        });
        return acc;
      }, [])
    : [];
  const additionalNonFdAidEntries: NerisDraftNonFdAidEntry[] = Array.isArray(
    candidate.additionalNonFdAidEntries,
  )
    ? (candidate.additionalNonFdAidEntries as Record<string, unknown>[]).reduce<
        NerisDraftNonFdAidEntry[]
      >((acc, entry) => {
        if (!entry || typeof entry !== "object") return acc;
        acc.push({ aidType: typeof entry.aidType === "string" ? entry.aidType : "" });
        return acc;
      }, [])
    : [];
  return {
    formValues,
    reportStatus:
      typeof candidate.reportStatus === "string"
        ? candidate.reportStatus
        : NERIS_REPORT_STATUS_BY_CALL[callNumber] ?? "Draft",
    lastSavedAt:
      typeof candidate.lastSavedAt === "string" ? candidate.lastSavedAt : "Not saved",
    additionalAidEntries,
    additionalNonFdAidEntries,
  };
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
  call: IncidentCallSummary,
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
  call: IncidentCallSummary,
  fieldId: IncidentCallFieldId,
): string {
  if (fieldId === "status") {
    const serverStatus = call.nerisReportStatus?.trim();
    if (serverStatus) return serverStatus;
    return getNerisReportStatus(call.callNumber);
  }
  return getCallFieldValue(call, fieldId);
}

function mapUserTypeToRole(userType: string): UserRole {
  return userType.trim().toLowerCase().includes("admin") ? "admin" : "user";
}

function validatePasswordPolicyClient(password: string): string | null {
  const value = password.trim();
  if (value.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[a-z]/.test(value)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/[A-Z]/.test(value)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[0-9]/.test(value)) {
    return "Password must include at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return "Password must include at least one special character.";
  }
  return null;
}

function normalizeTokenNamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "");
}

function toTitleCase(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function applyNameTemplate(template: string, firstName: string, lastName: string): string {
  const first = normalizeTokenNamePart(firstName.trim());
  const last = normalizeTokenNamePart(lastName.trim());
  if (!template.trim()) return "";

  const shorthand = template.toLowerCase().replace(/\s+/g, "");
  let normalizedTemplate = template;
  if (shorthand === "lllf") {
    normalizedTemplate = "${last:3}${first:1}";
  } else if (shorthand === "f(lastname)" || shorthand === "flastname") {
    normalizedTemplate = "${first:1}${last}";
  }
  normalizedTemplate = normalizedTemplate
    .replace(/\(lastname\)/gi, "${Last}")
    .replace(/\(firstname\)/gi, "${First}");

  const tokenValues: Record<string, string> = {
    first,
    last,
    First: toTitleCase(first),
    Last: toTitleCase(last),
    FIRST: first.toUpperCase(),
    LAST: last.toUpperCase(),
  };
  return normalizedTemplate.replace(/\$\{([A-Za-z]+)(?::(\d+))?\}/g, (_match, token, countRaw) => {
    const base = tokenValues[token] ?? "";
    const count = Number.parseInt(countRaw ?? "", 10);
    if (Number.isFinite(count) && count > 0) {
      return base.slice(0, count);
    }
    return base;
  });
}

function AuthPage({ onLogin }: AuthPageProps) {
  const [department, setDepartment] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      setErrorMessage("Please provide username and password.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);
    const loginError = await onLogin(department.trim(), username.trim(), password);
    if (loginError) {
      setErrorMessage(loginError);
    }
    setIsSubmitting(false);
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
          Sign in with credentials configured in Admin Functions -&gt; Department
          Details -&gt; Users.
        </p>
        <ul className="brand-feature-list">
          <li>Only saved users can sign in</li>
          <li>Access level is assigned from each user type</li>
          <li>Settings menu includes profile, display, and logout actions</li>
        </ul>
      </section>

      <section className="auth-form-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-header">
            <ShieldCheck size={24} />
            <div>
              <h2>Sign in to Fire Ultimate</h2>
              <p>Credentials are validated against saved Users.</p>
            </div>
          </div>

          <label htmlFor="department">Fire Department (optional)</label>
          <input
            id="department"
            name="department"
            type="text"
            autoComplete="organization"
            placeholder="CIFPD"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          />

          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="chief.jones"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? "Signing In..." : "Login"}
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

  const expandedMenuForRender = expandedMenuId ?? activeMenu?.id;

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
  incidentCalls,
  onCreateIncidentCall,
}: IncidentsListPageProps) {
  const navigate = useNavigate();
  const isDemoTenant = useIsDemoTenant();
  const [isFieldEditorOpen, setIsFieldEditorOpen] = useState(false);
  const [fieldEditorError, setFieldEditorError] = useState("");
  const [dragFieldId, setDragFieldId] = useState<IncidentCallFieldId | null>(null);
  const [fieldEditorOrderDraft, setFieldEditorOrderDraft] = useState<IncidentCallFieldId[]>([]);
  const [fieldEditorVisibilityDraft, setFieldEditorVisibilityDraft] = useState<
    Record<IncidentCallFieldId, boolean>
  >(
    () =>
      Object.fromEntries(
        INCIDENT_CALL_FIELD_OPTIONS.map((field) => [field.id, true]),
      ) as Record<IncidentCallFieldId, boolean>,
  );
  const [callFieldWidths, setCallFieldWidths] = useState<Record<IncidentCallFieldId, number>>(
    () => ({
      ...DEFAULT_CALL_FIELD_WIDTHS,
      ...(incidentDisplaySettings.callFieldWidths ?? {}),
    }),
  );
  const [isCreateIncidentModalOpen, setIsCreateIncidentModalOpen] = useState(false);
  const incidentsSetup = useMemo(() => readIncidentsSetupConfigFromDraft(), []);
  const apparatusOptions = useMemo(() => readApparatusOptionsFromDraft(), []);
  const [createIncidentDraft, setCreateIncidentDraft] = useState<IncidentCreatePayload>(() => ({
    incident_internal_id: "",
    dispatch_internal_id: "",
    incidentType: incidentsSetup.incidentTypeOptions[0] ?? "",
    priority: incidentsSetup.priorityOptions[0] ?? "",
    stillDistrict: incidentsSetup.stillDistrictOptions[0] ?? "",
    currentState: incidentsSetup.currentStateOptions[0] ?? "Draft",
    reportedBy: "",
    assignedUnits: [],
    address: "",
    callbackNumber: "",
    dispatchNotes: "",
  }));
  const [createIncidentError, setCreateIncidentError] = useState("");
  const isIncidentFieldVisible = useCallback(
    (fieldKey: IncidentSetupRequiredFieldKey) => incidentsSetup.visibleFields[fieldKey] !== false,
    [incidentsSetup.visibleFields],
  );
  const activeResizeField = useRef<{
    fieldId: IncidentCallFieldId;
    startX: number;
    startWidth: number;
  } | null>(null);
  const callFieldWidthsRef = useRef(callFieldWidths);
  const incidentDisplaySettingsRef = useRef(incidentDisplaySettings);
  const onSaveIncidentDisplaySettingsRef = useRef(onSaveIncidentDisplaySettings);

  const visibleStats = INCIDENT_QUEUE_STATS.filter(
    (stat) => !incidentDisplaySettings.hiddenStatIds.includes(stat.id),
  );
  const visibleCallFieldOrder = dedupeCallFieldOrder(
    incidentDisplaySettings.callFieldOrder.filter((fieldId) =>
      VALID_CALL_FIELD_IDS.has(fieldId) &&
      (INCIDENT_CALL_FIELD_TO_SETUP_FIELD[fieldId]
        ? isIncidentFieldVisible(INCIDENT_CALL_FIELD_TO_SETUP_FIELD[fieldId]!)
        : true),
    ),
  );
  const defaultVisibleCallFieldOrder = dedupeCallFieldOrder(
    DEFAULT_INCIDENT_CALL_FIELD_ORDER.filter((fieldId) =>
      INCIDENT_CALL_FIELD_TO_SETUP_FIELD[fieldId]
        ? isIncidentFieldVisible(INCIDENT_CALL_FIELD_TO_SETUP_FIELD[fieldId]!)
        : true,
    ),
  );
  const callFieldOrder =
    visibleCallFieldOrder.length > 0 ? visibleCallFieldOrder : defaultVisibleCallFieldOrder;
  const fieldLabelById = useMemo(
    () =>
      Object.fromEntries(
        INCIDENT_CALL_FIELD_OPTIONS.map((field) => [field.id, field.label]),
      ) as Record<IncidentCallFieldId, string>,
    [],
  );
  const allConfigurableCallFields = useMemo(
    () => INCIDENT_CALL_FIELD_OPTIONS.map((field) => field.id),
    [],
  );

  const getCompleteCallFieldOrder = useCallback(
    (sourceOrder: IncidentCallFieldId[]): IncidentCallFieldId[] => {
      const deduped = dedupeCallFieldOrder(sourceOrder.filter((fieldId) => VALID_CALL_FIELD_IDS.has(fieldId)));
      const missing = allConfigurableCallFields.filter((fieldId) => !deduped.includes(fieldId));
      return [...deduped, ...missing];
    },
    [allConfigurableCallFields],
  );

  const openCallDetail = (callNumber: string) => {
    navigate(`/incidents-mapping/incidents/${encodeURIComponent(callNumber)}`);
  };
  const queueCalls = useMemo(
    () =>
      isDemoTenant
        ? INCIDENT_CALLS
        : incidentCalls.filter((entry) => !isIncidentHiddenFromQueue(entry)),
    [incidentCalls, isDemoTenant],
  );
  const resetCreateIncidentDraft = () => {
    setCreateIncidentDraft({
      incident_internal_id: "",
      dispatch_internal_id: "",
      incidentType: incidentsSetup.incidentTypeOptions[0] ?? "",
      priority: incidentsSetup.priorityOptions[0] ?? "",
      stillDistrict: incidentsSetup.stillDistrictOptions[0] ?? "",
      currentState: incidentsSetup.currentStateOptions[0] ?? "Draft",
      reportedBy: "",
      assignedUnits: [],
      address: "",
      callbackNumber: "",
      dispatchNotes: "",
    });
    setCreateIncidentError("");
  };

  const handleOpenCreateIncidentModal = () => {
    resetCreateIncidentDraft();
    setIsCreateIncidentModalOpen(true);
  };

  const handleCreateIncident = async () => {
    const required = incidentsSetup.requiredFields;
    if (
      isIncidentFieldVisible("incidentNumber") &&
      required.incidentNumber &&
      !createIncidentDraft.incident_internal_id.trim()
    ) {
      setCreateIncidentError("Incident Number is required.");
      return;
    }
    if (
      isIncidentFieldVisible("dispatchNumber") &&
      required.dispatchNumber &&
      !createIncidentDraft.dispatch_internal_id.trim()
    ) {
      setCreateIncidentError("Dispatch Number is required.");
      return;
    }
    if (
      isIncidentFieldVisible("incidentType") &&
      required.incidentType &&
      !createIncidentDraft.incidentType.trim()
    ) {
      setCreateIncidentError("Incident Type is required.");
      return;
    }
    if (
      isIncidentFieldVisible("priority") &&
      required.priority &&
      !createIncidentDraft.priority.trim()
    ) {
      setCreateIncidentError("Priority is required.");
      return;
    }
    if (
      isIncidentFieldVisible("stillDistrict") &&
      required.stillDistrict &&
      !createIncidentDraft.stillDistrict.trim()
    ) {
      setCreateIncidentError("Still District is required.");
      return;
    }
    if (
      isIncidentFieldVisible("currentState") &&
      required.currentState &&
      !createIncidentDraft.currentState.trim()
    ) {
      setCreateIncidentError("Status is required.");
      return;
    }
    if (
      isIncidentFieldVisible("reportedBy") &&
      required.reportedBy &&
      !createIncidentDraft.reportedBy.trim()
    ) {
      setCreateIncidentError("Reported By is required.");
      return;
    }
    if (
      isIncidentFieldVisible("assignedUnits") &&
      required.assignedUnits &&
      createIncidentDraft.assignedUnits.length === 0
    ) {
      setCreateIncidentError("At least one assigned unit is required.");
      return;
    }
    if (
      isIncidentFieldVisible("address") &&
      required.address &&
      !createIncidentDraft.address.trim()
    ) {
      setCreateIncidentError("Address is required.");
      return;
    }
    if (
      isIncidentFieldVisible("callbackNumber") &&
      required.callbackNumber &&
      !createIncidentDraft.callbackNumber.trim()
    ) {
      setCreateIncidentError("Callback Number is required.");
      return;
    }
    if (
      isIncidentFieldVisible("dispatchNotes") &&
      required.dispatchNotes &&
      !createIncidentDraft.dispatchNotes.trim()
    ) {
      setCreateIncidentError("Dispatch Notes is required.");
      return;
    }
    try {
      const nextIncident = await onCreateIncidentCall(createIncidentDraft);
      setIsCreateIncidentModalOpen(false);
      openCallDetail(nextIncident.callNumber);
    } catch (err) {
      setCreateIncidentError(
        err instanceof Error ? err.message : "Failed to create incident.",
      );
    }
  };

  useEffect(() => {
    callFieldWidthsRef.current = callFieldWidths;
  }, [callFieldWidths]);

  useEffect(() => {
    incidentDisplaySettingsRef.current = incidentDisplaySettings;
  }, [incidentDisplaySettings]);

  useEffect(() => {
    onSaveIncidentDisplaySettingsRef.current = onSaveIncidentDisplaySettings;
  }, [onSaveIncidentDisplaySettings]);

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
      onSaveIncidentDisplaySettingsRef.current({
        ...incidentDisplaySettingsRef.current,
        callFieldWidths: { ...callFieldWidthsRef.current },
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.classList.remove("resizing-dispatch-columns");
    };
  }, []);

  const openFieldEditor = () => {
    const visibleSet = new Set(
      incidentDisplaySettings.callFieldOrder.filter((fieldId) => VALID_CALL_FIELD_IDS.has(fieldId)),
    );
    setFieldEditorOrderDraft(getCompleteCallFieldOrder(incidentDisplaySettings.callFieldOrder));
    setFieldEditorVisibilityDraft(
      Object.fromEntries(
        allConfigurableCallFields.map((fieldId) => [fieldId, visibleSet.has(fieldId)]),
      ) as Record<IncidentCallFieldId, boolean>,
    );
    setFieldEditorError("");
    setIsFieldEditorOpen(true);
  };

  const handleFieldDrop = (targetFieldId: IncidentCallFieldId) => {
    if (!dragFieldId || dragFieldId === targetFieldId) {
      return;
    }
    setFieldEditorOrderDraft((previous) => {
      const fromIndex = previous.indexOf(dragFieldId);
      const toIndex = previous.indexOf(targetFieldId);
      if (fromIndex < 0 || toIndex < 0) {
        return previous;
      }
      const nextOrder = [...previous];
      nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, dragFieldId);
      return nextOrder;
    });
    setDragFieldId(null);
  };

  const toggleFieldVisibilityFromEditor = (fieldId: IncidentCallFieldId) => {
    setFieldEditorVisibilityDraft((previous) => ({
      ...previous,
      [fieldId]: !previous[fieldId],
    }));
  };

  const applyFieldEditor = () => {
    const visibleOrder = fieldEditorOrderDraft.filter(
      (fieldId) => fieldEditorVisibilityDraft[fieldId],
    );
    if (!visibleOrder.length) {
      setFieldEditorError("At least one column must remain visible.");
      return;
    }
    onSaveIncidentDisplaySettings({
      ...incidentDisplaySettings,
      callFieldOrder: visibleOrder,
      callFieldWidths: { ...callFieldWidths },
    });
    setDragFieldId(null);
    setIsFieldEditorOpen(false);
    setFieldEditorError("");
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
          <button type="button" className="primary-button" onClick={handleOpenCreateIncidentModal}>
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
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={openFieldEditor}
            >
              <Settings size={15} style={{ marginRight: "0.35rem" }} />
              Configure Table
            </button>
          </div>
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
                {queueCalls.map((call) => (
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
                      <strong className="call-number-text">
                        {getIncidentDisplayNumber(call)}
                      </strong>
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
                {queueCalls.length === 0 ? (
                  <tr>
                    <td colSpan={2}>
                      <div className="empty-message">
                        No incidents yet. Click Create Incident to start a live record.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="panel-description">
            Future API integration will update these calls and notes in real-time as
            dispatch centers enter new information.
          </p>
        </article>
      </section>
      {isFieldEditorOpen ? (
        <div className="department-editor-backdrop" role="dialog" aria-modal="true">
          <article className="panel department-editor-modal">
            <div className="panel-header">
              <h2>Configure Table</h2>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => {
                  setIsFieldEditorOpen(false);
                  setDragFieldId(null);
                  setFieldEditorError("");
                }}
              >
                Close
              </button>
            </div>
            <p className="field-hint">Select columns to appear in the table and drag to reorder.</p>
            <div className="field-editor-panel">
              <ul className="drag-order-list">
                {fieldEditorOrderDraft.map((fieldId) => (
                  <li
                    key={`configure-order-${fieldId}`}
                    draggable
                    onDragStart={() => setDragFieldId(fieldId)}
                    onDragEnd={() => setDragFieldId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleFieldDrop(fieldId)}
                  >
                    <div className="drag-order-row" style={{ gap: "0.5rem" }}>
                      <span className="drag-handle" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span style={{ flex: 1 }}>{fieldLabelById[fieldId]}</span>
                      <label className="field-hint" style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
                        <span>{fieldEditorVisibilityDraft[fieldId] ? "On" : "Off"}</span>
                        <input
                          type="checkbox"
                          checked={fieldEditorVisibilityDraft[fieldId]}
                          onChange={() => toggleFieldVisibilityFromEditor(fieldId)}
                        />
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {fieldEditorError ? <p className="auth-error">{fieldEditorError}</p> : null}
            <div className="header-actions">
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => {
                  setIsFieldEditorOpen(false);
                  setDragFieldId(null);
                  setFieldEditorError("");
                }}
              >
                Cancel
              </button>
              <button type="button" className="primary-button compact-button" onClick={applyFieldEditor}>
                Apply
              </button>
            </div>
          </article>
        </div>
      ) : null}
      {isCreateIncidentModalOpen ? (
        <div className="department-editor-backdrop" role="dialog" aria-modal="true">
          <article className="panel department-editor-modal">
            <div className="panel-header">
              <h2>Create Incident</h2>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => setIsCreateIncidentModalOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="settings-form">
              {isIncidentFieldVisible("incidentNumber") ? (
              <label>
                Incident Number
                <input
                  type="text"
                  value={createIncidentDraft.incident_internal_id}
                  onChange={(event) =>
                    setCreateIncidentDraft((previous) => ({
                      ...previous,
                      incident_internal_id: event.target.value,
                    }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("dispatchNumber") ? (
              <label>
                Dispatch Number
                <input
                  type="text"
                  value={createIncidentDraft.dispatch_internal_id}
                  onChange={(event) =>
                    setCreateIncidentDraft((previous) => ({
                      ...previous,
                      dispatch_internal_id: event.target.value,
                    }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("incidentType") ? (
              <label>
                Incident Type
                <NerisFlatSingleOptionSelect
                  inputId="create-incident-type"
                  value={createIncidentDraft.incidentType}
                  options={incidentsSetup.incidentTypeOptions.map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(value) =>
                    setCreateIncidentDraft((previous) => ({
                      ...previous,
                      incidentType: value,
                    }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("priority") ? (
              <label>
                Priority
                <NerisFlatSingleOptionSelect
                  inputId="create-incident-priority"
                  value={createIncidentDraft.priority}
                  options={incidentsSetup.priorityOptions.map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(value) =>
                    setCreateIncidentDraft((previous) => ({
                      ...previous,
                      priority: value,
                    }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("stillDistrict") ? (
              <label>
                Still District
                <NerisFlatSingleOptionSelect
                  inputId="create-incident-still-district"
                  value={createIncidentDraft.stillDistrict}
                  options={incidentsSetup.stillDistrictOptions.map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(value) =>
                    setCreateIncidentDraft((previous) => ({
                      ...previous,
                      stillDistrict: value,
                    }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("currentState") ? (
              <label>
                Status
                <NerisFlatSingleOptionSelect
                  inputId="create-incident-current-state"
                  value={createIncidentDraft.currentState}
                  options={incidentsSetup.currentStateOptions.map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(value) =>
                    setCreateIncidentDraft((previous) => ({
                      ...previous,
                      currentState: value,
                    }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("reportedBy") ? (
              <label>
                Reported By
                {incidentsSetup.reportedByMode === "dropdown" ? (
                  <NerisFlatSingleOptionSelect
                    inputId="create-incident-reported-by"
                    value={createIncidentDraft.reportedBy}
                    options={incidentsSetup.reportedByOptions.map((value) => ({
                      value,
                      label: value,
                    }))}
                    onChange={(value) =>
                      setCreateIncidentDraft((previous) => ({
                        ...previous,
                        reportedBy: value,
                      }))
                    }
                  />
                ) : (
                  <input
                    type="text"
                    value={createIncidentDraft.reportedBy}
                    onChange={(event) =>
                      setCreateIncidentDraft((previous) => ({
                        ...previous,
                        reportedBy: event.target.value,
                      }))
                    }
                  />
                )}
              </label>
              ) : null}
              {isIncidentFieldVisible("assignedUnits") ? (
              <label>
                Assigned Units
                <NerisFlatMultiOptionSelect
                  inputId="create-incident-assigned-units"
                  options={apparatusOptions}
                  value={createIncidentDraft.assignedUnits.join(",")}
                  onChange={(nextValue) =>
                    setCreateIncidentDraft((previous) => ({
                      ...previous,
                      assignedUnits: dedupeAndCleanStrings(
                        nextValue
                          .split(",")
                          .map((entry) => entry.trim())
                          .filter((entry) => entry.length > 0),
                      ),
                    }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("address") ? (
              <label>
                Address
                <input
                  type="text"
                  value={createIncidentDraft.address}
                  onChange={(event) =>
                    setCreateIncidentDraft((previous) => ({
                      ...previous,
                      address: event.target.value,
                    }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("callbackNumber") ? (
              <label>
                Callback Number
                <input
                  type="text"
                  value={createIncidentDraft.callbackNumber}
                  onChange={(event) =>
                    setCreateIncidentDraft((previous) => ({
                      ...previous,
                      callbackNumber: event.target.value,
                    }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("dispatchNotes") ? (
              <label>
                Dispatch Notes
                <textarea
                  rows={4}
                  value={createIncidentDraft.dispatchNotes}
                  onChange={(event) =>
                    setCreateIncidentDraft((previous) => ({
                      ...previous,
                      dispatchNotes: event.target.value,
                    }))
                  }
                />
              </label>
              ) : null}
              {createIncidentError ? <p className="auth-error">{createIncidentError}</p> : null}
              <div className="header-actions">
                <button type="button" className="primary-button" onClick={handleCreateIncident}>
                  Create Incident
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}

function IncidentCallDetailPage({
  callNumber,
  incidentCalls,
  onUpdateIncidentCall,
  onSetIncidentDeleted,
}: IncidentCallDetailPageProps) {
  const navigate = useNavigate();
  const detail =
    getIncidentCallDetail(callNumber) ??
    (() => {
      const summary = incidentCalls.find(
        (entry) => entry.callNumber === callNumber && !isIncidentHiddenFromQueue(entry),
      );
      if (!summary) {
        return null;
      }
      return {
        ...summary,
        mapReference: "Pending GIS sync",
        reportedBy: "Manual entry",
        callbackNumber: "",
        apparatus: [],
        dispatchNotes: [],
      };
    })();
  const [callInfoExpanded, setCallInfoExpanded] = useState(false);
  const incidentsSetup = useMemo(() => readIncidentsSetupConfigFromDraft(), []);
  const apparatusOptions = useMemo(() => readApparatusOptionsFromDraft(), []);
  const [draft, setDraft] = useState<IncidentCreatePayload>(() => ({
    incident_internal_id: String(
      detail?.incident_internal_id ?? detail?.incidentNumber ?? detail?.callNumber ?? "",
    ).trim(),
    dispatch_internal_id: String(
      detail?.dispatch_internal_id ?? detail?.dispatchNumber ?? "",
    ).trim(),
    incidentType: String(detail?.incidentType ?? "").trim(),
    priority: String(detail?.priority ?? "").trim(),
    stillDistrict: String(detail?.stillDistrict ?? "").trim(),
    currentState: String(detail?.currentState ?? "").trim(),
    reportedBy: String(detail?.reportedBy ?? "").trim(),
    assignedUnits: dedupeAndCleanStrings(String(detail?.assignedUnits ?? "").split(",")),
    address: String(detail?.address ?? "").trim(),
    callbackNumber: String(detail?.callbackNumber ?? "").trim(),
    dispatchNotes: String(detail?.dispatchNotes ?? detail?.dispatchInfo ?? "").trim(),
  }));
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const isIncidentFieldVisible = useCallback(
    (fieldKey: IncidentSetupRequiredFieldKey) => incidentsSetup.visibleFields[fieldKey] !== false,
    [incidentsSetup.visibleFields],
  );

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

  const handleSaveDetail = () => {
    const required = incidentsSetup.requiredFields;
    if (
      isIncidentFieldVisible("incidentNumber") &&
      required.incidentNumber &&
      !draft.incident_internal_id.trim()
    ) {
      setSaveError("Incident Number is required.");
      return;
    }
    if (
      isIncidentFieldVisible("dispatchNumber") &&
      required.dispatchNumber &&
      !draft.dispatch_internal_id.trim()
    ) {
      setSaveError("Dispatch Number is required.");
      return;
    }
    if (
      isIncidentFieldVisible("incidentType") &&
      required.incidentType &&
      !draft.incidentType.trim()
    ) {
      setSaveError("Incident Type is required.");
      return;
    }
    if (
      isIncidentFieldVisible("priority") &&
      required.priority &&
      !draft.priority.trim()
    ) {
      setSaveError("Priority is required.");
      return;
    }
    if (
      isIncidentFieldVisible("stillDistrict") &&
      required.stillDistrict &&
      !draft.stillDistrict.trim()
    ) {
      setSaveError("Still District is required.");
      return;
    }
    if (
      isIncidentFieldVisible("currentState") &&
      required.currentState &&
      !draft.currentState.trim()
    ) {
      setSaveError("Status is required.");
      return;
    }
    if (
      isIncidentFieldVisible("reportedBy") &&
      required.reportedBy &&
      !draft.reportedBy.trim()
    ) {
      setSaveError("Reported By is required.");
      return;
    }
    if (
      isIncidentFieldVisible("assignedUnits") &&
      required.assignedUnits &&
      draft.assignedUnits.length === 0
    ) {
      setSaveError("Assigned Units is required.");
      return;
    }
    if (isIncidentFieldVisible("address") && required.address && !draft.address.trim()) {
      setSaveError("Address is required.");
      return;
    }
    if (
      isIncidentFieldVisible("callbackNumber") &&
      required.callbackNumber &&
      !draft.callbackNumber.trim()
    ) {
      setSaveError("Callback Number is required.");
      return;
    }
    if (
      isIncidentFieldVisible("dispatchNotes") &&
      required.dispatchNotes &&
      !draft.dispatchNotes.trim()
    ) {
      setSaveError("Dispatch Notes is required.");
      return;
    }

    onUpdateIncidentCall(callNumber, {
      incident_internal_id: draft.incident_internal_id.trim() || detail.callNumber,
      dispatch_internal_id: draft.dispatch_internal_id.trim(),
      incidentNumber: draft.incident_internal_id.trim() || detail.callNumber,
      dispatchNumber: draft.dispatch_internal_id.trim(),
      incidentType: draft.incidentType.trim(),
      priority: draft.priority.trim(),
      stillDistrict: draft.stillDistrict.trim(),
      currentState: draft.currentState.trim(),
      reportedBy: draft.reportedBy.trim(),
      assignedUnits: draft.assignedUnits.join(", "),
      address: draft.address.trim(),
      callbackNumber: draft.callbackNumber.trim(),
      dispatchNotes: draft.dispatchNotes.trim(),
      dispatchInfo: draft.dispatchNotes.trim() || detail.dispatchInfo,
    });
    setSaveError("");
    setSaveSuccess("Incident details saved.");
  };

  const handleDeleteIncident = () => {
    onSetIncidentDeleted(callNumber, true, "Deleted from Incident Detail page.");
    navigate("/incidents-mapping/incidents");
  };

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
            <div className="settings-form">
              {isIncidentFieldVisible("incidentNumber") ? (
              <label>
                Incident Number
                <input
                  type="text"
                  value={draft.incident_internal_id}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      incident_internal_id: event.target.value,
                    }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("dispatchNumber") ? (
              <label>
                Dispatch Number
                <input
                  type="text"
                  value={draft.dispatch_internal_id}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      dispatch_internal_id: event.target.value,
                    }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("incidentType") ? (
              <label>
                Incident Type
                <NerisFlatSingleOptionSelect
                  inputId={`incident-detail-type-${callNumber}`}
                  value={draft.incidentType}
                  options={incidentsSetup.incidentTypeOptions.map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(value) =>
                    setDraft((previous) => ({ ...previous, incidentType: value }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("priority") ? (
              <label>
                Priority
                <NerisFlatSingleOptionSelect
                  inputId={`incident-detail-priority-${callNumber}`}
                  value={draft.priority}
                  options={incidentsSetup.priorityOptions.map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(value) => setDraft((previous) => ({ ...previous, priority: value }))}
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("stillDistrict") ? (
              <label>
                Still District
                <NerisFlatSingleOptionSelect
                  inputId={`incident-detail-still-district-${callNumber}`}
                  value={draft.stillDistrict}
                  options={incidentsSetup.stillDistrictOptions.map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(value) =>
                    setDraft((previous) => ({ ...previous, stillDistrict: value }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("currentState") ? (
              <label>
                Status
                <NerisFlatSingleOptionSelect
                  inputId={`incident-detail-current-state-${callNumber}`}
                  value={draft.currentState}
                  options={incidentsSetup.currentStateOptions.map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(value) =>
                    setDraft((previous) => ({ ...previous, currentState: value }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("reportedBy") ? (
              <label>
                Reported By
                {incidentsSetup.reportedByMode === "dropdown" ? (
                  <NerisFlatSingleOptionSelect
                    inputId={`incident-detail-reported-by-${callNumber}`}
                    value={draft.reportedBy}
                    options={incidentsSetup.reportedByOptions.map((value) => ({
                      value,
                      label: value,
                    }))}
                    onChange={(value) =>
                      setDraft((previous) => ({ ...previous, reportedBy: value }))
                    }
                  />
                ) : (
                  <input
                    type="text"
                    value={draft.reportedBy}
                    onChange={(event) =>
                      setDraft((previous) => ({ ...previous, reportedBy: event.target.value }))
                    }
                  />
                )}
              </label>
              ) : null}
              {isIncidentFieldVisible("assignedUnits") ? (
              <label>
                Assigned Units
                <NerisFlatMultiOptionSelect
                  inputId={`incident-detail-assigned-units-${callNumber}`}
                  options={apparatusOptions}
                  value={draft.assignedUnits.join(",")}
                  onChange={(nextValue) =>
                    setDraft((previous) => ({
                      ...previous,
                      assignedUnits: dedupeAndCleanStrings(nextValue.split(",")),
                    }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("address") ? (
              <label>
                Address
                <input
                  type="text"
                  value={draft.address}
                  onChange={(event) =>
                    setDraft((previous) => ({ ...previous, address: event.target.value }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("callbackNumber") ? (
              <label>
                Callback Number
                <input
                  type="text"
                  value={draft.callbackNumber}
                  onChange={(event) =>
                    setDraft((previous) => ({ ...previous, callbackNumber: event.target.value }))
                  }
                />
              </label>
              ) : null}
              {isIncidentFieldVisible("dispatchNotes") ? (
              <label>
                Dispatch Notes
                <textarea
                  rows={4}
                  value={draft.dispatchNotes}
                  onChange={(event) =>
                    setDraft((previous) => ({ ...previous, dispatchNotes: event.target.value }))
                  }
                />
              </label>
              ) : null}
              {saveError ? <p className="auth-error">{saveError}</p> : null}
              {saveSuccess ? <p className="save-message">{saveSuccess}</p> : null}
              <div className="header-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleDeleteIncident}
                >
                  Delete
                </button>
                <button type="button" className="primary-button" onClick={handleSaveDetail}>
                  Save Incident Details
                </button>
              </div>
            </div>
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

function PersonnelSchedulePage() {
  return (
    <PersonnelSchedulePageView
      readDepartmentDetailsDraft={readDepartmentDetailsDraft}
      normalizeDepartmentDraft={normalizeDepartmentDraft}
      normalizeAdditionalFields={normalizeAdditionalFields}
    />
  );
}

function useIsDemoTenant(): boolean {
  const [isDemoTenant, setIsDemoTenant] = useState(() =>
    window.location.hostname.toLowerCase().includes("demo"),
  );

  useEffect(() => {
    let isMounted = true;

    const loadTenantContext = async () => {
      try {
        const response = await fetch("/api/tenant/context");
        if (!response.ok || !isMounted) return;

        const payload = (await response.json()) as {
          ok?: boolean;
          tenant?: { slug?: string };
        };
        const slug = String(payload?.tenant?.slug ?? "").toLowerCase();
        if (slug) {
          setIsDemoTenant(slug.includes("demo"));
        }
      } catch {
        // Keep hostname-based default when tenant context cannot be read.
      }
    };

    void loadTenantContext();

    return () => {
      isMounted = false;
    };
  }, []);

  return isDemoTenant;
}

function NerisReportingPage({ incidentCalls }: NerisQueuePageProps) {
  const navigate = useNavigate();
  const isDemoTenant = useIsDemoTenant();
  const queueCalls = useMemo(
    () =>
      isDemoTenant
        ? INCIDENT_CALLS
        : incidentCalls.filter((entry) => !isIncidentHiddenFromQueue(entry)),
    [incidentCalls, isDemoTenant],
  );
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
                {queueCalls.map((call) => (
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
                      <strong className="call-number-text">
                        {getIncidentDisplayNumber(call)}
                      </strong>
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
                {queueCalls.length === 0 ? (
                  <tr>
                    <td colSpan={2}>
                      <div className="empty-message">
                        No sample incidents are shown for live tenants. Connect your CAD/import flow or
                        create live incident records to begin NERIS exports.
                      </div>
                    </td>
                  </tr>
                ) : null}
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
  incidentCalls: IncidentCallSummary[];
  exportHistory?: NerisExportRecord[];
}

interface NerisExportsPagePropsWithHistory extends NerisQueuePageProps {
  exportHistory?: NerisExportRecord[];
}

function NerisExportsPage({ incidentCalls, exportHistory = [] }: NerisExportsPagePropsWithHistory) {
  const navigate = useNavigate();
  const isDemoTenant = useIsDemoTenant();
  const queueCalls = useMemo(
    () =>
      isDemoTenant
        ? INCIDENT_CALLS
        : incidentCalls.filter((entry) => !isIncidentHiddenFromQueue(entry)),
    [incidentCalls, isDemoTenant],
  );
  const latestExportByCall = useMemo(() => {
    const map = new Map<string, NerisExportRecord>();
    const history = exportHistory.length > 0 ? exportHistory : readNerisExportHistory();
    history.forEach((entry) => {
      if (!map.has(entry.callNumber)) {
        map.set(entry.callNumber, entry);
      }
    });
    return map;
  }, [exportHistory]);

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
                {queueCalls.map((call) => {
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
                        <strong className="call-number-text">
                          {getIncidentDisplayNumber(call)}
                        </strong>
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
                {queueCalls.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-message">
                        No export queue rows are shown for live tenants until incidents are connected.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  );
}

function NerisExportDetailsPage({ callNumber, incidentCalls, exportHistory: serverExportHistory = [] }: NerisExportDetailsPageProps) {
  const navigate = useNavigate();
  const incident =
    getIncidentCallDetail(callNumber) ??
    (() => {
      const summary = incidentCalls.find(
        (entry) => entry.callNumber === callNumber && !isIncidentHiddenFromQueue(entry),
      );
      if (!summary) {
        return null;
      }
      return {
        ...summary,
        mapReference: "",
        reportedBy: "",
        callbackNumber: "",
        apparatus: [],
        dispatchNotes: [],
      };
    })();
  const exportHistory = useMemo(
    () => {
      const history = serverExportHistory.length > 0 ? serverExportHistory : readNerisExportHistory();
      return history.filter((entry) => entry.callNumber === callNumber);
    },
    [callNumber, serverExportHistory],
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

interface NerisReportFormRouteProps {
  callNumber: string;
  role: UserRole;
  username: string;
  incidentCalls: IncidentCallSummary[];
  onUpdateIncidentCall: (
    callNumber: string,
    patch: Partial<IncidentCallSummary>,
  ) => void;
  nerisExportSettings: NerisExportSettings;
  apparatusFromDepartmentDetails: { unit: string; unitType: string }[];
  exportHistory?: NerisExportRecord[];
  onExportRecordAdded?: (record: NerisExportRecord) => Promise<void>;
}

function NerisReportFormPage(props: NerisReportFormRouteProps) {
  const { callNumber } = props;
  const [serverDraft, setServerDraft] = useState<NerisStoredDraft | null | undefined>(
    undefined,
  );
  const [draftLoadStatus, setDraftLoadStatus] = useState<"loading" | "done">("loading");

  useEffect(() => {
    if (!callNumber) {
      queueMicrotask(() => {
        setDraftLoadStatus("done");
        setServerDraft(null);
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setDraftLoadStatus("loading");
    });
    getNerisDraft(callNumber)
      .then((payload) => {
        if (cancelled) return;
        const normalized = payload ? normalizeApiDraftPayload(payload, callNumber) : null;
        setServerDraft(normalized ?? null);
        setDraftLoadStatus("done");
      })
      .catch(() => {
        if (!cancelled) {
          setServerDraft(null);
          setDraftLoadStatus("done");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [callNumber]);

  const readNerisDraftForForm = useCallback(
    (cn: string): NerisStoredDraft | null => {
      if (cn === callNumber && draftLoadStatus === "done" && serverDraft != null) {
        return serverDraft;
      }
      return readNerisDraft(cn);
    },
    [callNumber, draftLoadStatus, serverDraft],
  );

  const writeNerisDraftForForm = useCallback(
    (cn: string, draft: NerisStoredDraft) => {
      writeNerisDraft(cn, draft);
      if (cn === callNumber) setServerDraft(draft);
      patchNerisDraft(cn, draft).catch(() => {});
    },
    [callNumber],
  );

  const getExportHistory = () =>
    props.exportHistory && props.exportHistory.length > 0
      ? props.exportHistory
      : readNerisExportHistory();
  const appendAndSync = (record: NerisExportRecord) => {
    appendNerisExportRecord(record);
    props.onExportRecordAdded?.(record);
  };

  if (draftLoadStatus === "loading") {
    return (
      <div className="neris-draft-loading" style={{ padding: "1rem" }}>
        Loading draft…
      </div>
    );
  }

  return (
    <NerisReportFormPageView
      key={`neris-form-${callNumber}-ready`}
      {...props}
      readNerisDraft={readNerisDraftForForm}
      writeNerisDraft={writeNerisDraftForForm}
      appendNerisExportRecord={appendAndSync}
      parseAssignedUnits={parseAssignedUnits}
      inferResourceUnitTypeValue={inferResourceUnitTypeValue}
      getStaffingValueForUnit={getStaffingValueForUnit}
      nextEmergingHazardItemId={nextEmergingHazardItemId}
      nextRiskReductionSuppressionId={nextRiskReductionSuppressionId}
      dedupeAndCleanStrings={dedupeAndCleanStrings}
      normalizeNerisEnumValue={normalizeNerisEnumValue}
      parseImportedLocationValues={parseImportedLocationValues}
      toResourceSummaryTime={toResourceSummaryTime}
      toResourceDateTimeInputValue={toResourceDateTimeInputValue}
      toResourceDateOnlyInputValue={toResourceDateOnlyInputValue}
      formatResourceDatePart={formatResourceDatePart}
      formatResourceTimePart={formatResourceTimePart}
      parseTimeInput24h={parseTimeInput24h}
      combineResourceDateTimeFromParts={combineResourceDateTimeFromParts}
      toResourceDateTimeTimestamp={toResourceDateTimeTimestamp}
      addMinutesToResourceDateTime={addMinutesToResourceDateTime}
      resourceUnitValidationErrorKey={resourceUnitValidationErrorKey}
      countSelectedPersonnel={countSelectedPersonnel}
      readNerisExportHistory={getExportHistory}
      toToneClass={toToneClass}
      toneFromNerisStatus={toneFromNerisStatus}
      togglePillValue={togglePillValue}
      resourcePersonnelOptions={RESOURCE_PERSONNEL_OPTIONS}
      riskReductionYesNoUnknownOptions={RISK_REDUCTION_YES_NO_UNKNOWN_OPTIONS}
      riskReductionYesNoOptions={RISK_REDUCTION_YES_NO_OPTIONS}
      riskReductionSmokeAlarmTypeOptions={RISK_REDUCTION_SMOKE_ALARM_TYPE_OPTIONS}
      riskReductionFireAlarmTypeOptions={RISK_REDUCTION_FIRE_ALARM_TYPE_OPTIONS}
      riskReductionOtherAlarmTypeOptions={RISK_REDUCTION_OTHER_ALARM_TYPE_OPTIONS}
      riskReductionCookingSuppressionTypeOptions={RISK_REDUCTION_COOKING_SUPPRESSION_TYPE_OPTIONS}
      riskReductionSuppressionCoverageOptions={RISK_REDUCTION_SUPPRESSION_COVERAGE_OPTIONS}
      nerisIncidentIdPattern={NERIS_INCIDENT_ID_PATTERN}
      nerisAidDepartmentIdPattern={NERIS_AID_DEPARTMENT_ID_PATTERN}
      nerisProxyMappedFormFieldIds={NERIS_PROXY_MAPPED_FORM_FIELD_IDS}
      getDefaultNerisExportSettings={getDefaultNerisExportSettings}
      onUpdateIncidentCall={props.onUpdateIncidentCall}
    />
  );
}

type DepartmentDetailsPageMode =
  | "departmentDetails"
  | "schedulerSettings"
  | "personnelManagement";
type UserSortColumn = "name" | "username" | "userType";
type PersonnelSortColumn =
  | "name"
  | "shift"
  | "apparatusAssignment"
  | "station"
  | "qualifications";

interface DepartmentDetailsPageProps {
  mode?: DepartmentDetailsPageMode;
  incidentCalls?: IncidentCallSummary[];
  onRestoreIncidentCall?: (callNumber: string) => void;
}

function DepartmentDetailsPage({
  mode = "departmentDetails",
  incidentCalls = [],
  onRestoreIncidentCall,
}: DepartmentDetailsPageProps) {
  const initialDepartmentDraft = normalizeDepartmentDraft(readDepartmentDetailsDraft());
  const sessionUserName = readSession().username.trim().toLocaleLowerCase();
  const uiPreferenceUserKey = sessionUserName || USER_UI_PREFERENCES_FALLBACK_KEY;
  const initialUiPreferencesByUser =
    initialDepartmentDraft.uiPreferencesByUser &&
    typeof initialDepartmentDraft.uiPreferencesByUser === "object"
      ? (initialDepartmentDraft.uiPreferencesByUser as Record<string, Record<string, unknown>>)
      : {};
  const initialUserUiPreferences =
    initialUiPreferencesByUser[uiPreferenceUserKey] ??
    initialUiPreferencesByUser[USER_UI_PREFERENCES_FALLBACK_KEY] ??
    {};
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
    Array.isArray(initialDepartmentDraft.masterApparatusRecords)
      ? (initialDepartmentDraft.masterApparatusRecords as DepartmentApparatusRecord[])
      : [],
  );
  const [schedulerApparatusRecords, setSchedulerApparatusRecords] = useState<SchedulerApparatusRecord[]>(
    Array.isArray(initialDepartmentDraft.schedulerApparatusRecords)
      ? (initialDepartmentDraft.schedulerApparatusRecords as SchedulerApparatusRecord[])
      : [],
  );
  const [shiftInformationEntries, setShiftInformationEntries] = useState<ShiftInformationEntry[]>(
    Array.isArray(initialDepartmentDraft.shiftInformationEntries) ? (initialDepartmentDraft.shiftInformationEntries as ShiftInformationEntry[]) : [],
  );
  const [userRecords, setUserRecords] = useState<DepartmentUserRecord[]>(() => {
    const raw = initialDepartmentDraft.userRecords;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry: Record<string, unknown>) => ({
        name: String(entry.name ?? "").trim(),
        userType: String(entry.userType ?? "").trim(),
        username: String(entry.username ?? "").trim(),
        password: String(entry.password ?? ""),
      }))
      .filter((entry) => entry.name.length > 0);
  });
  const [personnelRecords, setPersonnelRecords] = useState<DepartmentPersonnelRecord[]>(() => {
    const raw = initialDepartmentDraft.schedulerPersonnelRecords;
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
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [personnelSearchQuery, setPersonnelSearchQuery] = useState("");
  const [userSortColumn, setUserSortColumn] = useState<UserSortColumn>("name");
  const [userSortDirection, setUserSortDirection] = useState<"asc" | "desc">("asc");
  const [personnelSortColumn, setPersonnelSortColumn] =
    useState<PersonnelSortColumn>("name");
  const [personnelSortDirection, setPersonnelSortDirection] = useState<"asc" | "desc">("asc");
  const [schedulerEnabled, setSchedulerEnabled] = useState(
    Boolean(initialDepartmentDraft.schedulerEnabled ?? false),
  );
  const [standardOvertimeSlot, setStandardOvertimeSlot] = useState(
    Math.max(1, Math.floor(Number(initialDepartmentDraft.standardOvertimeSlot ?? 24) || 24)),
  );
  const [additionalFieldRecords, setAdditionalFieldRecords] = useState<AdditionalFieldRecord[]>(
    normalizeAdditionalFields(initialDepartmentDraft.additionalFields),
  );
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
  const [incidentsSetup, setIncidentsSetup] = useState<IncidentsSetupConfig>(() =>
    normalizeIncidentsSetupConfig(initialDepartmentDraft.incidentsSetup),
  );
  const [editingIncidentSetupField, setEditingIncidentSetupField] =
    useState<IncidentSetupRequiredFieldKey | null>(null);
  const [incidentSetupOptionDrafts, setIncidentSetupOptionDrafts] = useState<
    Partial<Record<IncidentSetupRequiredFieldKey, string>>
  >({});
  const [kellyRotations, setKellyRotations] = useState<KellyRotationEntry[]>(
    Array.isArray(initialDepartmentDraft.kellyRotations)
      ? (initialDepartmentDraft.kellyRotations as KellyRotationEntry[])
      : [],
  );
  const [editingKellyRotationIndex, setEditingKellyRotationIndex] = useState<number | null>(null);
  const [kellyRotationDraft, setKellyRotationDraft] = useState<KellyRotationEntry>({
    personnel: "",
    repeatsEveryValue: 14,
    repeatsEveryUnit: "Shifts",
    startsOn: "",
  });
  const [isKellyMultiAddOpen, setIsKellyMultiAddOpen] = useState(false);
  const [kellyMultiAddError, setKellyMultiAddError] = useState("");
  const [kellyMultiAddDraft, setKellyMultiAddDraft] =
    useState<KellyRotationMultiAddDraft>({
      shift: "",
      repeatsEveryValue: 14,
      repeatsEveryUnit: "Shifts",
      startsOn: "",
      occurrenceSlots: [],
    });
  const [kellyMultiAddPendingConfirmation, setKellyMultiAddPendingConfirmation] =
    useState<KellyMultiAddPendingConfirmation | null>(null);
  const [activeCollectionEditor, setActiveCollectionEditor] = useState<DepartmentCollectionKey | null>(null);
  const [isMultiEditMode, setIsMultiEditMode] = useState(false);
  const [selectedSingleIndex, setSelectedSingleIndex] = useState<number | null>(null);
  const [selectedMultiIndices, setSelectedMultiIndices] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isMultiAddOpen, setIsMultiAddOpen] = useState(false);
  const [multiAddUsernameTemplate, setMultiAddUsernameTemplate] = useState("${last:3}${first:1}");
  const [multiAddPasswordTemplate, setMultiAddPasswordTemplate] = useState("${Last}12345!");
  const [multiAddDefaultUserType, setMultiAddDefaultUserType] = useState("User");
  const [multiAddRows, setMultiAddRows] = useState<MultiAddUserDraft[]>([
    { firstName: "", lastName: "", userType: "" },
  ]);
  const [multiAddError, setMultiAddError] = useState("");
  const [multiAddSuccess, setMultiAddSuccess] = useState("");
  const [isMultiAddingUsers, setIsMultiAddingUsers] = useState(false);
  const [resetPasswordTargetIndex, setResetPasswordTargetIndex] = useState<number | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordConfirmValue, setResetPasswordConfirmValue] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState("");
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
    commonName: "",
    unitType: "",
    make: "",
    model: "",
    year: "",
  });
  const [schedulerApparatusDraft, setSchedulerApparatusDraft] = useState<SchedulerApparatusRecord>({
    apparatus: "",
    minimumPersonnel: 0,
    maximumPersonnel: 2,
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
  const [userDraft, setUserDraft] = useState<DepartmentUserRecord>({
    name: "",
    userType: "",
    username: "",
    password: "",
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
  const [additionalFieldDraft, setAdditionalFieldDraft] = useState<AdditionalFieldRecord>({
    id: "",
    fieldName: "",
    numberOfSlots: 1,
    valueMode: "personnel",
    personnelOverride: true,
  });
  const [editingAdditionalFieldIndex, setEditingAdditionalFieldIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isEntryFormOpen, setIsEntryFormOpen] = useState(false);
  const [editingQualificationIndex, setEditingQualificationIndex] = useState<number | null>(null);
  const [dragQualificationIndex, setDragQualificationIndex] = useState<number | null>(null);
  const [dragUserTypeIndex, setDragUserTypeIndex] = useState<number | null>(null);
  const [dragSchedulerApparatusIndex, setDragSchedulerApparatusIndex] = useState<number | null>(null);
  const [dragAdditionalFieldIndex, setDragAdditionalFieldIndex] = useState<number | null>(null);
  const [isImportApparatusModalOpen, setIsImportApparatusModalOpen] = useState(false);
  const [uiPreferencesByUser, setUiPreferencesByUser] = useState<
    Record<string, Record<string, unknown>>
  >(initialUiPreferencesByUser);
  const [autoSaveTick, setAutoSaveTick] = useState(0);
  const [schedulerApparatusFieldWidths, setSchedulerApparatusFieldWidths] = useState<
    Record<SchedulerApparatusGridFieldId, number>
  >(() =>
    normalizeSchedulerApparatusFieldWidths(
      initialUserUiPreferences.schedulerApparatusFieldWidths,
    ),
  );
  const [schedulerPersonnelFieldWidths, setSchedulerPersonnelFieldWidths] = useState<
    Record<SchedulerPersonnelGridFieldId, number>
  >(() =>
    normalizeSchedulerPersonnelFieldWidths(
      initialUserUiPreferences.schedulerPersonnelFieldWidths,
    ),
  );
  const [userTableColumnWidths, setUserTableColumnWidths] = useState<
    Record<UserTableColumnId, number>
  >(() =>
    normalizeUserTableColumnWidths(
      initialUserUiPreferences.userTableColumnWidths,
    ),
  );
  const [apparatusFieldWidths, setApparatusFieldWidths] = useState<Record<ApparatusGridFieldId, number>>(
    () => normalizeApparatusFieldWidths(initialUserUiPreferences.apparatusFieldWidths),
  );
  const [apparatusFieldOrder, setApparatusFieldOrder] = useState<ApparatusGridFieldId[]>(() => [
    ...normalizeApparatusFieldOrder(initialUserUiPreferences.apparatusFieldOrder),
  ]);
  const [isApparatusFieldEditorOpen, setIsApparatusFieldEditorOpen] = useState(false);
  const [dragApparatusFieldId, setDragApparatusFieldId] = useState<ApparatusGridFieldId | null>(null);
  const activeApparatusResizeField = useRef<{
    fieldId: ApparatusGridFieldId;
    startX: number;
    startWidth: number;
  } | null>(null);
  const activeSchedulerApparatusResizeField = useRef<{
    fieldId: SchedulerApparatusGridFieldId;
    startX: number;
    startWidth: number;
  } | null>(null);
  const activeSchedulerPersonnelResizeField = useRef<{
    fieldId: SchedulerPersonnelGridFieldId;
    startX: number;
    startWidth: number;
  } | null>(null);
  const activeUserTableResizeField = useRef<{
    fieldId: UserTableColumnId;
    startX: number;
    startWidth: number;
  } | null>(null);

  const unitTypeOptions = useMemo(() => getNerisValueOptions("unit_type"), []);
  const apparatusFieldLabelById = useMemo(
    () =>
      ({
        commonName: "Common Name",
        unitType: "Unit Type",
        make: "Make",
        model: "Model",
        year: "Year",
      }) as Record<ApparatusGridFieldId, string>,
    [],
  );
  const getApparatusFieldValue = useCallback(
    (apparatus: DepartmentApparatusRecord, fieldId: ApparatusGridFieldId): string => {
      switch (fieldId) {
        case "commonName":
          return apparatus.commonName || "—";
        case "unitType":
          return (unitTypeOptions.find((o) => o.value === apparatus.unitType)?.label ?? apparatus.unitType) || "—";
        case "make":
          return apparatus.make || "—";
        case "model":
          return apparatus.model || "—";
        case "year":
          return apparatus.year || "—";
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
  const schedulerApparatusGridStyle = useMemo(
    () =>
      ({
        "--scheduler-apparatus-grid-columns": SCHEDULER_APPARATUS_GRID_FIELD_ORDER
          .map((fieldId) => {
            const width =
              schedulerApparatusFieldWidths[fieldId] ??
              DEFAULT_SCHEDULER_APPARATUS_FIELD_WIDTHS[fieldId];
            const clampedWidth = Math.min(
              MAX_SCHEDULER_APPARATUS_FIELD_WIDTH,
              Math.max(MIN_SCHEDULER_APPARATUS_FIELD_WIDTH, width),
            );
            return `${clampedWidth}px`;
          })
          .join(" "),
      }) as CSSProperties,
    [schedulerApparatusFieldWidths],
  );
  const schedulerPersonnelGridStyle = useMemo(
    () =>
      ({
        "--scheduler-personnel-grid-columns": SCHEDULER_PERSONNEL_GRID_FIELD_ORDER
          .map((fieldId) => {
            const width =
              schedulerPersonnelFieldWidths[fieldId] ??
              DEFAULT_SCHEDULER_PERSONNEL_FIELD_WIDTHS[fieldId];
            const clampedWidth = Math.min(
              MAX_SCHEDULER_PERSONNEL_FIELD_WIDTH,
              Math.max(MIN_SCHEDULER_PERSONNEL_FIELD_WIDTH, width),
            );
            return `${clampedWidth}px`;
          })
          .join(" "),
      }) as CSSProperties,
    [schedulerPersonnelFieldWidths],
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
      setAutoSaveTick((previous) => previous + 1);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.classList.remove("resizing-dispatch-columns");
    };
  }, []);
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const activeResize = activeSchedulerApparatusResizeField.current;
      if (!activeResize) {
        return;
      }
      const delta = event.clientX - activeResize.startX;
      const nextWidth = Math.min(
        MAX_SCHEDULER_APPARATUS_FIELD_WIDTH,
        Math.max(MIN_SCHEDULER_APPARATUS_FIELD_WIDTH, activeResize.startWidth + delta),
      );
      setSchedulerApparatusFieldWidths((previous) => {
        if (previous[activeResize.fieldId] === nextWidth) {
          return previous;
        }
        return { ...previous, [activeResize.fieldId]: nextWidth };
      });
    };
    const stopResize = () => {
      if (!activeSchedulerApparatusResizeField.current) {
        return;
      }
      activeSchedulerApparatusResizeField.current = null;
      document.body.classList.remove("resizing-dispatch-columns");
      setAutoSaveTick((previous) => previous + 1);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.classList.remove("resizing-dispatch-columns");
    };
  }, []);
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const activeResize = activeSchedulerPersonnelResizeField.current;
      if (!activeResize) {
        return;
      }
      const delta = event.clientX - activeResize.startX;
      const nextWidth = Math.min(
        MAX_SCHEDULER_PERSONNEL_FIELD_WIDTH,
        Math.max(MIN_SCHEDULER_PERSONNEL_FIELD_WIDTH, activeResize.startWidth + delta),
      );
      setSchedulerPersonnelFieldWidths((previous) => {
        if (previous[activeResize.fieldId] === nextWidth) {
          return previous;
        }
        return { ...previous, [activeResize.fieldId]: nextWidth };
      });
    };
    const stopResize = () => {
      if (!activeSchedulerPersonnelResizeField.current) {
        return;
      }
      activeSchedulerPersonnelResizeField.current = null;
      document.body.classList.remove("resizing-dispatch-columns");
      setAutoSaveTick((previous) => previous + 1);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.classList.remove("resizing-dispatch-columns");
    };
  }, []);
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const activeResize = activeUserTableResizeField.current;
      if (!activeResize) {
        return;
      }
      const delta = event.clientX - activeResize.startX;
      const nextWidth = Math.min(
        MAX_USER_TABLE_COLUMN_WIDTH,
        Math.max(MIN_USER_TABLE_COLUMN_WIDTH, activeResize.startWidth + delta),
      );
      setUserTableColumnWidths((previous) => {
        if (previous[activeResize.fieldId] === nextWidth) {
          return previous;
        }
        return { ...previous, [activeResize.fieldId]: nextWidth };
      });
    };
    const stopResize = () => {
      if (!activeUserTableResizeField.current) {
        return;
      }
      activeUserTableResizeField.current = null;
      document.body.classList.remove("resizing-dispatch-columns");
      setAutoSaveTick((previous) => previous + 1);
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
  const startSchedulerApparatusFieldResize = (
    fieldId: SchedulerApparatusGridFieldId,
    event: ReactPointerEvent<HTMLSpanElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    activeSchedulerApparatusResizeField.current = {
      fieldId,
      startX: event.clientX,
      startWidth:
        schedulerApparatusFieldWidths[fieldId] ??
        DEFAULT_SCHEDULER_APPARATUS_FIELD_WIDTHS[fieldId],
    };
    document.body.classList.add("resizing-dispatch-columns");
  };
  const startSchedulerPersonnelFieldResize = (
    fieldId: SchedulerPersonnelGridFieldId,
    event: ReactPointerEvent<HTMLSpanElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    activeSchedulerPersonnelResizeField.current = {
      fieldId,
      startX: event.clientX,
      startWidth:
        schedulerPersonnelFieldWidths[fieldId] ??
        DEFAULT_SCHEDULER_PERSONNEL_FIELD_WIDTHS[fieldId],
    };
    document.body.classList.add("resizing-dispatch-columns");
  };
  const startUserTableColumnResize = (
    fieldId: UserTableColumnId,
    event: ReactPointerEvent<HTMLSpanElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    activeUserTableResizeField.current = {
      fieldId,
      startX: event.clientX,
      startWidth:
        userTableColumnWidths[fieldId] ??
        DEFAULT_USER_TABLE_COLUMN_WIDTHS[fieldId],
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
    setAutoSaveTick((previous) => previous + 1);
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
    () => [...apparatusRecords].sort((a, b) => (a.commonName || "").localeCompare(b.commonName || "", undefined, { sensitivity: "base" })),
    [apparatusRecords],
  );
  const apparatusNames = useMemo(
    () =>
      schedulerApparatusRecords
        .map((apparatus) => apparatus.apparatus)
        .filter((entry) => entry.trim().length > 0),
    [schedulerApparatusRecords],
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
  const kellyPersonnelGroups = useMemo(() => {
    const shiftByName = new Map<string, string>();
    personnelRecords.forEach((entry) => {
      const name = String(entry.name ?? "").trim();
      const shift = String(entry.shift ?? "").trim();
      if (!name) return;
      shiftByName.set(name, shift);
    });
    const names = Array.from(
      new Set(userRecords.map((record) => record.name.trim()).filter((name) => name.length > 0)),
    );
    const grouped = new Map<string, string[]>();
    names.forEach((name) => {
      const shiftRaw = shiftByName.get(name) ?? "";
      const shiftKey = shiftRaw.split("|")[0]?.trim() || "Unassigned Shift";
      const current = grouped.get(shiftKey) ?? [];
      current.push(name);
      grouped.set(shiftKey, current);
    });
    const shiftRank = (shift: string): number => {
      const normalized = shift.trim().toUpperCase();
      if (normalized.startsWith("A SHIFT")) return 1;
      if (normalized.startsWith("B SHIFT")) return 2;
      if (normalized.startsWith("C SHIFT")) return 3;
      if (normalized.startsWith("D SHIFT")) return 4;
      if (normalized === "UNASSIGNED SHIFT") return 99;
      return 50;
    };
    return Array.from(grouped.entries())
      .map(([shift, members]) => ({
        shift,
        members: [...members].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => {
        const rankDiff = shiftRank(a.shift) - shiftRank(b.shift);
        return rankDiff !== 0 ? rankDiff : a.shift.localeCompare(b.shift);
      });
  }, [personnelRecords, userRecords]);
  const kellyShiftOptions = useMemo(
    () =>
      kellyPersonnelGroups
        .map((group) => group.shift)
        .filter((shift) => shift.trim().length > 0 && shift !== "Unassigned Shift"),
    [kellyPersonnelGroups],
  );
  const selectedKellyGroup = useMemo(
    () => kellyPersonnelGroups.find((group) => group.shift === kellyMultiAddDraft.shift),
    [kellyPersonnelGroups, kellyMultiAddDraft.shift],
  );
  const kellySlotCount = useMemo(() => {
    const kellyField = additionalFieldRecords.find((record) => record.id === "support-kelly-day");
    return Math.max(1, Math.floor(Number(kellyField?.numberOfSlots ?? 2) || 2));
  }, [additionalFieldRecords]);
  const kellyOccurrencePreview = useMemo(() => {
    if (!kellyMultiAddDraft.startsOn) {
      return [];
    }
    const startDate = new Date(`${kellyMultiAddDraft.startsOn}T00:00:00`);
    if (Number.isNaN(startDate.getTime())) {
      return [];
    }
    const shiftEntry = shiftInformationEntries.find(
      (entry) =>
        entry.shiftType.trim() === kellyMultiAddDraft.shift.trim(),
    );
    const recurrenceDays = Math.max(1, getRecurrenceIntervalDays(shiftEntry));
    const stepDays = recurrenceDays;
    const previewCount = Math.max(1, Math.floor(kellyMultiAddDraft.repeatsEveryValue || 1));
    return Array.from({ length: previewCount }, (_, index) => {
      const nextDate = new Date(startDate);
      nextDate.setDate(startDate.getDate() + index * stepDays);
      return toDateKey(nextDate);
    });
  }, [
    kellyMultiAddDraft.repeatsEveryValue,
    kellyMultiAddDraft.shift,
    kellyMultiAddDraft.startsOn,
    shiftInformationEntries,
  ]);
  const addKellyRotation = () => {
    if (!kellyRotationDraft.personnel.trim() || !kellyRotationDraft.startsOn) {
      return;
    }
    const normalized: KellyRotationEntry = {
      personnel: kellyRotationDraft.personnel.trim(),
      repeatsEveryValue: Math.max(1, Math.floor(kellyRotationDraft.repeatsEveryValue || 1)),
      repeatsEveryUnit: kellyRotationDraft.repeatsEveryUnit,
      startsOn: kellyRotationDraft.startsOn,
    };
    setKellyRotations((previous) =>
      editingKellyRotationIndex === null
        ? [...previous.filter((entry) => entry.personnel !== normalized.personnel), normalized]
        : previous.map((entry, index) => (index === editingKellyRotationIndex ? normalized : entry)),
    );
    setKellyRotationDraft({
      personnel: "",
      repeatsEveryValue: 14,
      repeatsEveryUnit: "Shifts",
      startsOn: "",
    });
    setEditingKellyRotationIndex(null);
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Auto-saved.");
  };
  const openKellyMultiAdd = () => {
    const defaultShift = kellyShiftOptions[0] ?? "";
    setKellyMultiAddError("");
    setKellyMultiAddDraft({
      shift: defaultShift,
      repeatsEveryValue: 14,
      repeatsEveryUnit: "Shifts",
      startsOn: "",
      occurrenceSlots: [],
    });
    setKellyMultiAddPendingConfirmation(null);
    setIsKellyMultiAddOpen(true);
  };
  const closeKellyMultiAdd = () => {
    setIsKellyMultiAddOpen(false);
    setKellyMultiAddError("");
    setKellyMultiAddPendingConfirmation(null);
  };
  const updateKellyMultiAddSlot = (rowIndex: number, slotIndex: number, value: string) => {
    setKellyMultiAddPendingConfirmation(null);
    setKellyMultiAddDraft((previous) => {
      const nextRows = previous.occurrenceSlots.map((row) => [...row]);
      if (!nextRows[rowIndex]) {
        nextRows[rowIndex] = Array.from({ length: kellySlotCount }, () => "");
      }
      nextRows[rowIndex]![slotIndex] = value;
      return { ...previous, occurrenceSlots: nextRows };
    });
  };
  const submitKellyMultiAdd = () => {
    if (!kellyMultiAddDraft.shift.trim()) {
      setKellyMultiAddError("Select a shift before creating rotation rules.");
      return;
    }
    if (!kellyMultiAddDraft.startsOn) {
      setKellyMultiAddError("Select a start date before creating rotation rules.");
      return;
    }
    const selectedEntries = kellyOccurrencePreview.flatMap((dateKey, rowIndex) =>
      (kellyMultiAddDraft.occurrenceSlots[rowIndex] ?? [])
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .map((personnel) => ({
          personnel,
          repeatsEveryValue: Math.max(1, Math.floor(kellyMultiAddDraft.repeatsEveryValue || 1)),
          repeatsEveryUnit: kellyMultiAddDraft.repeatsEveryUnit,
          startsOn: dateKey,
        } satisfies KellyRotationEntry)),
    );
    const replacementMap = new Map<string, KellyRotationEntry>();
    selectedEntries.forEach((entry) => {
      replacementMap.set(entry.personnel, entry);
    });
    if (replacementMap.size === 0) {
      setKellyMultiAddError("Select at least one personnel slot.");
      return;
    }
    const entries = Array.from(replacementMap.values());
    const replacements = kellyRotations
      .map((entry) => entry.personnel.trim())
      .filter((personnel) => replacementMap.has(personnel));
    setKellyMultiAddPendingConfirmation({
      entries,
      replacements,
    });
    setKellyMultiAddError("");
  };
  const confirmKellyMultiAdd = () => {
    if (!kellyMultiAddPendingConfirmation) {
      return;
    }
    const replacementMap = new Map(
      kellyMultiAddPendingConfirmation.entries.map((entry) => [entry.personnel, entry]),
    );
    setKellyRotations((previous) => {
      const withoutReplaced = previous.filter(
        (entry) => !replacementMap.has(entry.personnel.trim()),
      );
      return [...withoutReplaced, ...kellyMultiAddPendingConfirmation.entries];
    });
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Kelly rotation rules updated.");
    closeKellyMultiAdd();
  };

  const detailCardOrder: DepartmentCollectionKey[] = [
    "stations",
    "apparatus",
  ];
  const schedulerSettingsCardOrder: DepartmentCollectionKey[] = [
    "shiftInformation",
    "additionalFields",
    "overtimeSetup",
    "personnelQualifications",
    "schedulerApparatus",
    "schedulerPersonnel",
    "kellyRotation",
  ];
  const detailCards = detailCardOrder
    .map((key) =>
      DEPARTMENT_COLLECTION_DEFINITIONS.find((definition) => definition.key === key),
    )
    .filter((definition): definition is DepartmentCollectionDefinition =>
      Boolean(definition),
    );
  const schedulerSettingsCards = schedulerSettingsCardOrder
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
  const personnelManagementCardOrder: DepartmentCollectionKey[] = ["personnel"];
  const personnelManagementCards = personnelManagementCardOrder
    .map((key) =>
      DEPARTMENT_COLLECTION_DEFINITIONS.find((definition) => definition.key === key),
    )
    .filter((definition): definition is DepartmentCollectionDefinition =>
      Boolean(definition),
    );
  const filteredUserRows = useMemo(() => {
    const query = userSearchQuery.trim().toLocaleLowerCase();
    const rows = userRecords.map((user, index) => ({ user, index }));
    if (!query) {
      return rows;
    }
    return rows.filter(({ user }) => {
      const fields = [user.name, user.username, user.userType]
        .map((value) => String(value ?? "").toLocaleLowerCase());
      return fields.some((value) => value.includes(query));
    });
  }, [userRecords, userSearchQuery]);
  const sortedFilteredUserRows = useMemo(() => {
    const rows = [...filteredUserRows];
    rows.sort((left, right) => {
      const leftValue = String(left.user[userSortColumn] ?? "");
      const rightValue = String(right.user[userSortColumn] ?? "");
      const result = leftValue.localeCompare(rightValue, undefined, { sensitivity: "base" });
      return userSortDirection === "asc" ? result : -result;
    });
    return rows;
  }, [filteredUserRows, userSortColumn, userSortDirection]);
  const filteredPersonnelRows = useMemo(() => {
    const query = personnelSearchQuery.trim().toLocaleLowerCase();
    const rows = personnelRecords.map((personnel, index) => ({ personnel, index }));
    if (!query) {
      return rows;
    }
    return rows.filter(({ personnel }) => {
      const fields = [
        personnel.name,
        personnel.shift,
        personnel.apparatusAssignment,
        personnel.station,
        personnel.userType,
        personnel.qualifications.join(", "),
      ].map((value) => String(value ?? "").toLocaleLowerCase());
      return fields.some((value) => value.includes(query));
    });
  }, [personnelRecords, personnelSearchQuery]);
  const sortedFilteredPersonnelRows = useMemo(() => {
    const rows = [...filteredPersonnelRows];
    rows.sort((left, right) => {
      const leftValue =
        personnelSortColumn === "qualifications"
          ? left.personnel.qualifications.join(", ")
          : String(left.personnel[personnelSortColumn] ?? "");
      const rightValue =
        personnelSortColumn === "qualifications"
          ? right.personnel.qualifications.join(", ")
          : String(right.personnel[personnelSortColumn] ?? "");
      const result = leftValue.localeCompare(rightValue, undefined, { sensitivity: "base" });
      return personnelSortDirection === "asc" ? result : -result;
    });
    return rows;
  }, [filteredPersonnelRows, personnelSortColumn, personnelSortDirection]);
  const showDepartmentDetailsSection = mode === "departmentDetails";
  const showSchedulerSettingsSection = mode === "schedulerSettings";
  const showPersonnelManagementSection = mode === "personnelManagement";
  const deletedIncidentAuditEntries = useMemo(
    () =>
      incidentCalls
        .filter((entry) => isIncidentHiddenFromQueue(entry))
        .sort((a, b) => String(b.deletedAt ?? "").localeCompare(String(a.deletedAt ?? ""))),
    [incidentCalls],
  );
  const pageTitle = showDepartmentDetailsSection
    ? "Admin Functions | Department Details"
    : showSchedulerSettingsSection
      ? "Admin Functions | Scheduler Settings"
      : "Admin Functions | Personnel Management";
  const pageSubtitle = showDepartmentDetailsSection
    ? "Department setup and configuration values used throughout the system."
    : showSchedulerSettingsSection
      ? "Scheduler configuration and staffing control settings."
      : "Manage users and personnel access settings.";
  const saveButtonLabel = showSchedulerSettingsSection
    ? "Save Scheduler Settings"
    : showPersonnelManagementSection
      ? "Save Personnel Management"
      : "Save Department Details";

  const isStationsEditor = activeCollectionEditor === "stations";
  const isApparatusEditor = activeCollectionEditor === "apparatus";
  const isSchedulerApparatusEditor = activeCollectionEditor === "schedulerApparatus";
  const isUsersEditor = activeCollectionEditor === "personnel";
  const isSchedulerPersonnelEditor = activeCollectionEditor === "schedulerPersonnel";
  const isShiftEditor = activeCollectionEditor === "shiftInformation";
  const isAdditionalFieldsEditor = activeCollectionEditor === "additionalFields";
  const isOvertimeSetupEditor = activeCollectionEditor === "overtimeSetup";
  const isQualificationsEditor = activeCollectionEditor === "personnelQualifications";
  const isKellyRotationEditor = activeCollectionEditor === "kellyRotation";
  const isUserTypeEditor = activeCollectionEditor === "userType";
  const isMutualAidEditor = activeCollectionEditor === "mutualAidDepartments";

  const handleUserSort = (column: UserSortColumn) => {
    if (column === userSortColumn) {
      setUserSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setUserSortColumn(column);
    setUserSortDirection("asc");
  };
  const handlePersonnelSort = (column: PersonnelSortColumn) => {
    if (column === personnelSortColumn) {
      setPersonnelSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
      return;
    }
    setPersonnelSortColumn(column);
    setPersonnelSortDirection("asc");
  };

  useEffect(() => {
    if (multiAddDefaultUserType.trim()) {
      return;
    }
    const fallback = userTypeValues.find((value) => value.trim().length > 0) ?? "User";
    setMultiAddDefaultUserType(fallback);
  }, [multiAddDefaultUserType, userTypeValues]);
  useEffect(() => {
    setKellyMultiAddDraft((previous) => {
      if (previous.occurrenceSlots.length === kellyOccurrencePreview.length &&
        previous.occurrenceSlots.every((row) => row.length === kellySlotCount)
      ) {
        return previous;
      }
      const nextRows = Array.from({ length: kellyOccurrencePreview.length }, (_, rowIndex) =>
        Array.from({ length: kellySlotCount }, (_, slotIndex) =>
          previous.occurrenceSlots[rowIndex]?.[slotIndex] ?? "",
        ),
      );
      return { ...previous, occurrenceSlots: nextRows };
    });
  }, [kellyOccurrencePreview.length, kellySlotCount]);

  const multiAddPreview = useMemo(() => {
    const existingUsernames = new Set(
      userRecords.map((record) => record.username.trim().toLowerCase()).filter(Boolean),
    );
    const generatedCounts = new Map<string, number>();

    const generated = multiAddRows.map((row, index) => {
      const first = row.firstName.trim();
      const last = row.lastName.trim();
      const fullName = [first, last].filter(Boolean).join(" ").trim();
      const generatedUsername = applyNameTemplate(multiAddUsernameTemplate, first, last)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const generatedPassword = applyNameTemplate(multiAddPasswordTemplate, first, last).trim();
      const userType = row.userType.trim() || multiAddDefaultUserType.trim() || "User";
      if (generatedUsername) {
        generatedCounts.set(generatedUsername, (generatedCounts.get(generatedUsername) ?? 0) + 1);
      }
      return {
        index,
        first,
        last,
        fullName,
        username: generatedUsername,
        password: generatedPassword,
        userType,
      };
    });

    return generated.map((entry) => {
      const issues: string[] = [];
      if (!entry.first || !entry.last) {
        issues.push("First and Last Name are required.");
      }
      if (!entry.username) {
        issues.push("Generated username is empty.");
      }
      if (!entry.password) {
        issues.push("Generated password is empty.");
      }
      if (entry.username && existingUsernames.has(entry.username)) {
        issues.push("Username already exists.");
      }
      if ((generatedCounts.get(entry.username) ?? 0) > 1) {
        issues.push("Username collides with another row in this batch.");
      }
      return {
        ...entry,
        error: issues.join(" "),
      };
    });
  }, [
    multiAddRows,
    multiAddUsernameTemplate,
    multiAddPasswordTemplate,
    multiAddDefaultUserType,
    userRecords,
  ]);

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
        const options: DepartmentNerisEntityOption[] = rawEntities
          .map((entry): DepartmentNerisEntityOption | null => {
            const id = String(entry.neris_id ?? "").trim();
            const name = String(entry.name ?? entry.entity_name ?? entry.department_name ?? "").trim();
            const state = String(
              entry.fd_state ?? entry.state ?? entry.state_code ?? entry.state_abbreviation ?? "",
            ).trim().toUpperCase().slice(0, 2) || "Unknown";
            if (!/^FD\d{8}$/.test(id)) {
              return null;
            }
            return { id, name: name.length > 0 ? name : `Department ${id}`, state };
          })
          .filter((entry): entry is DepartmentNerisEntityOption => entry !== null);
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
        if (typeof window !== "undefined") {
          window.localStorage.setItem(DEPARTMENT_DETAILS_STORAGE_KEY, JSON.stringify(json.data));
        }
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
        const apiUiPreferencesByUser =
          d.uiPreferencesByUser && typeof d.uiPreferencesByUser === "object"
            ? (d.uiPreferencesByUser as Record<string, Record<string, unknown>>)
            : {};
        setUiPreferencesByUser(apiUiPreferencesByUser);
        const apiUserUiPreferences =
          apiUiPreferencesByUser[uiPreferenceUserKey] ??
          apiUiPreferencesByUser[USER_UI_PREFERENCES_FALLBACK_KEY] ??
          {};
        setApparatusFieldWidths(
          normalizeApparatusFieldWidths(apiUserUiPreferences.apparatusFieldWidths),
        );
        setApparatusFieldOrder(
          normalizeApparatusFieldOrder(apiUserUiPreferences.apparatusFieldOrder),
        );
        setSchedulerApparatusFieldWidths(
          normalizeSchedulerApparatusFieldWidths(
            apiUserUiPreferences.schedulerApparatusFieldWidths,
          ),
        );
        setSchedulerPersonnelFieldWidths(
          normalizeSchedulerPersonnelFieldWidths(
            apiUserUiPreferences.schedulerPersonnelFieldWidths,
          ),
        );
        setUserTableColumnWidths(
          normalizeUserTableColumnWidths(
            apiUserUiPreferences.userTableColumnWidths,
          ),
        );
        setStationRecords(
          Array.isArray(d.stationRecords) ? (d.stationRecords as DepartmentStationRecord[]) : [],
        );
        setApparatusRecords(
          Array.isArray(d.masterApparatusRecords)
            ? (d.masterApparatusRecords as DepartmentApparatusRecord[])
            : [],
        );
        setSchedulerApparatusRecords(
          Array.isArray(d.schedulerApparatusRecords)
            ? (d.schedulerApparatusRecords as SchedulerApparatusRecord[])
            : [],
        );
        setShiftInformationEntries(
          Array.isArray(d.shiftInformationEntries)
            ? (d.shiftInformationEntries as ShiftInformationEntry[])
            : [],
        );
        // Prefer /api/users for Department Access (Wave 3); fallback to payload userRecords for older data.
        const usersRes = await fetch("/api/users");
        if (usersRes.ok && isMounted) {
          const usersJson = (await usersRes.json()) as { ok?: boolean; users?: { id: string; username: string; userType: string; name?: string }[] };
          if (usersJson?.ok && Array.isArray(usersJson.users)) {
            setUserRecords(
              usersJson.users.map((u) => ({
                id: u.id,
                name: String(u.name ?? u.username ?? "").trim(),
                userType: String(u.userType ?? "User").trim(),
                username: String(u.username ?? "").trim(),
                password: "",
              })),
            );
          } else {
            setUserRecords(
              Array.isArray(d.userRecords)
                ? (d.userRecords as Record<string, unknown>[])
                    .map((entry) => ({
                      id: typeof entry.id === "string" ? entry.id : undefined,
                      name: String(entry.name ?? "").trim(),
                      userType: String(entry.userType ?? "").trim(),
                      username: String(entry.username ?? "").trim(),
                      password: String(entry.password ?? ""),
                    }))
                    .filter((entry) => entry.name.length > 0)
                : [],
            );
          }
        } else if (isMounted) {
          setUserRecords(
            Array.isArray(d.userRecords)
              ? (d.userRecords as Record<string, unknown>[])
                  .map((entry) => ({
                    id: typeof entry.id === "string" ? entry.id : undefined,
                    name: String(entry.name ?? "").trim(),
                    userType: String(entry.userType ?? "").trim(),
                    username: String(entry.username ?? "").trim(),
                    password: String(entry.password ?? ""),
                  }))
                  .filter((entry) => entry.name.length > 0)
              : [],
          );
        }
        setPersonnelRecords(
          Array.isArray(d.schedulerPersonnelRecords)
            ? (d.schedulerPersonnelRecords as DepartmentPersonnelRecord[])
            : [],
        );
        setSchedulerEnabled(Boolean(d.schedulerEnabled ?? false));
        setStandardOvertimeSlot(
          Math.max(1, Math.floor(Number(d.standardOvertimeSlot ?? 24) || 24)),
        );
        setAdditionalFieldRecords(normalizeAdditionalFields(d.additionalFields));
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
        setIncidentsSetup(normalizeIncidentsSetupConfig(d.incidentsSetup));
        setKellyRotations(
          Array.isArray(d.kellyRotations) ? (d.kellyRotations as KellyRotationEntry[]) : [],
        );
      } catch {
        // Keep localStorage initial values.
      }
    };
    void loadFromApi();
    return () => {
      isMounted = false;
    };
  }, [uiPreferenceUserKey]);

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
    setIsMultiAddOpen(false);
    setIsKellyMultiAddOpen(false);
    setKellyMultiAddError("");
    setMultiAddError("");
    setMultiAddSuccess("");
    setUserSearchQuery("");
    setPersonnelSearchQuery("");
    if (
      collectionKey === "apparatus" ||
      collectionKey === "personnel" ||
      collectionKey === "schedulerPersonnel" ||
      collectionKey === "schedulerApparatus"
    ) {
      setIsMultiEditMode(false);
    }
    if (collectionKey === "userType") {
      setUserTypeDraft("");
    }
    if (collectionKey === "personnelQualifications") {
      setQualificationDraft("");
      setEditingQualificationIndex(null);
    }
    if (collectionKey === "kellyRotation") {
      setEditingKellyRotationIndex(null);
      setKellyRotationDraft({
        personnel: "",
        repeatsEveryValue: 14,
        repeatsEveryUnit: "Shifts",
        startsOn: "",
      });
    }
    if (collectionKey === "additionalFields") {
      setEditingAdditionalFieldIndex(null);
      setAdditionalFieldDraft({
        id: "",
        fieldName: "",
        numberOfSlots: 1,
        valueMode: "personnel",
        personnelOverride: true,
      });
    }
  };

  const closeCollectionEditor = () => {
    setActiveCollectionEditor(null);
    resetEditorSelection();
    setIsMultiAddOpen(false);
    setIsKellyMultiAddOpen(false);
    setKellyMultiAddError("");
    setResetPasswordTargetIndex(null);
    setResetPasswordValue("");
    setResetPasswordConfirmValue("");
    setIsResettingPassword(false);
    setResetPasswordError("");
    setResetPasswordSuccess("");
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
        commonName: "",
        unitType: "",
        make: "",
        model: "",
        year: "",
      });
    }
    if (isSchedulerApparatusEditor) {
      setSchedulerApparatusDraft({
        apparatus: "",
        minimumPersonnel: 0,
        maximumPersonnel: 2,
        personnelRequirements: [],
        station: "",
      });
    }
    if (isUsersEditor) {
      setUserDraft({
        name: "",
        userType: "",
        username: "",
        password: "",
      });
    }
    if (isSchedulerPersonnelEditor) {
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
      if (isSchedulerApparatusEditor && schedulerApparatusRecords[index]) {
        setSchedulerApparatusDraft(schedulerApparatusRecords[index]!);
      }
      if (isUsersEditor && userRecords[index]) {
        setUserDraft(userRecords[index]!);
      }
      if (isSchedulerPersonnelEditor && personnelRecords[index]) {
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
        commonName: "",
        unitType: "",
        make: "",
        model: "",
        year: "",
      });
    }
    if (isSchedulerApparatusEditor) {
      setSchedulerApparatusDraft({
        apparatus: "",
        minimumPersonnel: 0,
        maximumPersonnel: 2,
        personnelRequirements: [],
        station: "",
      });
    }
    if (isSchedulerPersonnelEditor) {
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
    if (!apparatusDraft.unitId.trim() || !apparatusDraft.commonName.trim() || !apparatusDraft.unitType.trim()) {
      return;
    }
    const normalized = {
      ...apparatusDraft,
      unitId: apparatusDraft.unitId.trim(),
      commonName: apparatusDraft.commonName.trim(),
      unitType: apparatusDraft.unitType.trim(),
      make: apparatusDraft.make.trim(),
      model: apparatusDraft.model.trim(),
      year: apparatusDraft.year.trim(),
    };
    setApparatusRecords((previous) =>
      editingIndex === null
        ? [...previous, normalized]
        : previous.map((entry, index) => (index === editingIndex ? normalized : entry)),
    );
    setIsEntryFormOpen(false);
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Auto-saved.");
  };

  const normalizeSchedulerStationGrouping = (
    records: SchedulerApparatusRecord[],
  ): SchedulerApparatusRecord[] => {
    const groups = new Map<string, SchedulerApparatusRecord[]>();
    const stationOrder: string[] = [];
    records.forEach((entry) => {
      const key = entry.station.trim().toLocaleLowerCase();
      if (!groups.has(key)) {
        groups.set(key, []);
        stationOrder.push(key);
      }
      groups.get(key)!.push(entry);
    });
    return stationOrder.flatMap((key) => groups.get(key) ?? []);
  };

  const saveSchedulerApparatusForm = () => {
    if (!schedulerApparatusDraft.apparatus.trim()) {
      return;
    }
    const minimumPersonnel = Number.isFinite(schedulerApparatusDraft.minimumPersonnel)
      ? Math.max(0, Math.floor(schedulerApparatusDraft.minimumPersonnel))
      : 0;
    const maximumPersonnel = Number.isFinite(schedulerApparatusDraft.maximumPersonnel)
      ? Math.max(1, Math.floor(schedulerApparatusDraft.maximumPersonnel))
      : 1;
    if (maximumPersonnel < minimumPersonnel) {
      setStatusMessage("Max Personnel must be greater than or equal to Min Personnel.");
      return;
    }
    if (schedulerApparatusDraft.personnelRequirements.length !== minimumPersonnel) {
      setStatusMessage("Minimum Requirements selection count must match Minimum Personnel.");
      return;
    }
    const normalized: SchedulerApparatusRecord = {
      apparatus: schedulerApparatusDraft.apparatus.trim(),
      minimumPersonnel,
      maximumPersonnel,
      personnelRequirements: schedulerApparatusDraft.personnelRequirements.filter(Boolean),
      station: schedulerApparatusDraft.station.trim(),
    };
    setSchedulerApparatusRecords((previous) => {
      const next =
        editingIndex === null
          ? [...previous, normalized]
          : previous.map((entry, index) => (index === editingIndex ? normalized : entry));
      return normalizeSchedulerStationGrouping(next);
    });
    setIsEntryFormOpen(false);
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Auto-saved.");
  };

  const importSchedulerApparatusFromDepartment = () => {
    setSchedulerApparatusRecords((previous) => {
      const existing = new Set(
        previous.map((entry) => entry.apparatus.trim().toLocaleLowerCase()).filter(Boolean),
      );
      const imported = apparatusRecords
        .map((entry) => entry.commonName.trim())
        .filter((name) => name.length > 0 && !existing.has(name.toLocaleLowerCase()))
        .map((name) => ({
          apparatus: name,
          minimumPersonnel: 0,
          maximumPersonnel: 2,
          personnelRequirements: [] as string[],
          station: "",
        }));
      return normalizeSchedulerStationGrouping([...previous, ...imported]);
    });
    setIsImportApparatusModalOpen(false);
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Imported apparatus into Scheduler Settings.");
  };

  const handleSchedulerApparatusDrop = (targetIndex: number) => {
    setSchedulerApparatusRecords((previous) => {
      const fromIndex = dragSchedulerApparatusIndex;
      if (fromIndex === null || fromIndex < 0 || fromIndex >= previous.length) {
        return previous;
      }
      if (targetIndex < 0 || targetIndex >= previous.length) {
        return previous;
      }
      const fromStation = previous[fromIndex]?.station.trim().toLocaleLowerCase() ?? "";
      const targetStation = previous[targetIndex]?.station.trim().toLocaleLowerCase() ?? "";
      const next = [...previous];

      if (fromStation && fromStation === targetStation) {
        const [moved] = next.splice(fromIndex, 1);
        next.splice(targetIndex, 0, moved!);
        return next;
      }

      const sourceIndexes = next
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.station.trim().toLocaleLowerCase() === fromStation)
        .map(({ index }) => index);

      if (sourceIndexes.length === 0) {
        return previous;
      }

      const movedGroup = sourceIndexes.map((index) => next[index]!);
      const remaining = next.filter((_, index) => !sourceIndexes.includes(index));
      const insertIndex = remaining.findIndex(
        (entry) => entry.station.trim().toLocaleLowerCase() === targetStation,
      );
      const safeInsertIndex = insertIndex < 0 ? remaining.length : insertIndex;
      remaining.splice(safeInsertIndex, 0, ...movedGroup);
      return remaining;
    });
    setDragSchedulerApparatusIndex(null);
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Scheduler apparatus order updated.");
  };

  const saveUserForm = async () => {
    const normalizedName = userDraft.name.trim();
    const normalizedUsername = userDraft.username.trim().toLowerCase();
    if (!normalizedName) {
      return;
    }
    const isNewUser = editingIndex === null;
    if (!normalizedUsername || (isNewUser && !userDraft.password.trim())) {
      setStatusMessage("Users require username and password.");
      return;
    }
    if (isNewUser) {
      const passwordError = validatePasswordPolicyClient(userDraft.password);
      if (passwordError) {
        setStatusMessage(passwordError);
        return;
      }
    } else if (userDraft.password.trim()) {
      const passwordError = validatePasswordPolicyClient(userDraft.password);
      if (passwordError) {
        setStatusMessage(passwordError);
        return;
      }
    }
    const duplicateUsernameIndex = userRecords.findIndex(
      (entry, index) =>
        index !== editingIndex &&
        entry.username.trim().toLowerCase() === normalizedUsername,
    );
    if (duplicateUsernameIndex >= 0) {
      setStatusMessage("Username already exists. Choose a different username.");
      return;
    }
    const previousName = editingIndex !== null ? userRecords[editingIndex]?.name.trim() ?? "" : "";
    const userId = editingIndex !== null ? userRecords[editingIndex]?.id : undefined;
    try {
      if (isNewUser) {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: normalizedName,
            username: normalizedUsername,
            password: userDraft.password.trim(),
            userType: userDraft.userType || "User",
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          user?: { id: string; username: string; userType: string; name?: string };
          message?: string;
        };
        if (!res.ok) {
          setStatusMessage(json?.message ?? "Failed to create user.");
          return;
        }
        const created = json.user!;
        const nextUserRecords = [
          ...userRecords,
          {
            id: created.id,
            name: String(created.name ?? normalizedName),
            userType: created.userType,
            username: created.username,
            password: "",
          },
        ];
        setUserRecords(nextUserRecords);
        setPersonnelRecords((prev) => {
          const byName = new Map(
            prev
              .map((entry) => [entry.name.trim().toLocaleLowerCase(), entry] as const)
              .filter(([name]) => name.length > 0),
          );
          return nextUserRecords
            .map((user) => {
              const userName = user.name.trim();
              const existing = byName.get(userName.toLocaleLowerCase());
              if (existing) {
                const matched = nextUserRecords.find(
                  (u) => u.name.trim().localeCompare(userName, undefined, { sensitivity: "base" }) === 0,
                );
                return { ...existing, name: userName, userType: matched?.userType ?? existing.userType };
              }
              const matched = nextUserRecords.find(
                (r) => r.name.trim().localeCompare(userName, undefined, { sensitivity: "base" }) === 0,
              );
              return {
                name: userName,
                shift: "",
                apparatusAssignment: "",
                station: "",
                userType: matched?.userType ?? "",
                qualifications: [],
              } satisfies DepartmentPersonnelRecord;
            })
            .filter((entry) => entry.name.length > 0);
        });
      } else {
        let targetId = userId;
        if (!targetId) {
          const listRes = await fetch("/api/users");
          const listJson = (await listRes.json()) as { ok?: boolean; users?: { id: string; username: string }[] };
          if (listJson?.ok && Array.isArray(listJson.users)) {
            const found = listJson.users.find(
              (u) => u.username.toLowerCase() === userRecords[editingIndex!]?.username?.toLowerCase(),
            );
            targetId = found?.id;
          }
        }
        if (!targetId) {
          setStatusMessage("Could not find user to update. Refresh the page and try again.");
          return;
        }
        const res = await fetch(`/api/users/${targetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: normalizedName,
            username: normalizedUsername,
            ...(userDraft.password.trim() ? { password: userDraft.password.trim() } : {}),
            userType: userDraft.userType || "User",
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          user?: { id: string; username: string; userType: string; name?: string };
          message?: string;
        };
        if (!res.ok) {
          setStatusMessage(json?.message ?? "Failed to update user.");
          return;
        }
        const updated = json.user!;
        const nextUserRecords = userRecords.map((entry, index) =>
          index === editingIndex
            ? {
                id: updated.id,
                name: String(updated.name ?? normalizedName),
                userType: updated.userType,
                username: updated.username,
                password: "",
              }
            : entry,
        );
        setUserRecords(nextUserRecords);
        setPersonnelRecords((prev) => {
          const byName = new Map(
            prev
              .map((entry) => [entry.name.trim().toLocaleLowerCase(), entry] as const)
              .filter(([name]) => name.length > 0),
          );
          return nextUserRecords
            .map((user) => {
              const userName = user.name.trim();
              const existing = byName.get(userName.toLocaleLowerCase());
              if (existing) {
                const matched = nextUserRecords.find(
                  (u) => u.name.trim().localeCompare(userName, undefined, { sensitivity: "base" }) === 0,
                );
                return { ...existing, name: userName, userType: matched?.userType ?? existing.userType };
              }
              const matched = nextUserRecords.find(
                (r) => r.name.trim().localeCompare(userName, undefined, { sensitivity: "base" }) === 0,
              );
              return {
                name: userName,
                shift: "",
                apparatusAssignment: "",
                station: "",
                userType: matched?.userType ?? "",
                qualifications: [],
              } satisfies DepartmentPersonnelRecord;
            })
            .filter((entry) => entry.name.length > 0);
        });
        if (
          previousName &&
          normalizedName &&
          previousName.localeCompare(normalizedName, undefined, { sensitivity: "base" }) !== 0
        ) {
          setKellyRotations((previous) =>
            previous.map((entry) =>
              entry.personnel.trim() === previousName ? { ...entry, personnel: normalizedName } : entry,
            ),
          );
        }
      }
      setIsEntryFormOpen(false);
      setStatusMessage("User saved.");
    } catch {
      setStatusMessage("Network error saving user.");
    }
  };

  const updateMultiAddRow = (
    index: number,
    key: keyof MultiAddUserDraft,
    value: string,
  ) => {
    setMultiAddRows((previous) =>
      previous.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  };

  const addMultiAddRow = () => {
    setMultiAddRows((previous) => [
      ...previous,
      { firstName: "", lastName: "", userType: "" },
    ]);
  };

  const removeMultiAddRow = (index: number) => {
    setMultiAddRows((previous) => {
      const next = previous.filter((_row, rowIndex) => rowIndex !== index);
      return next.length > 0 ? next : [{ firstName: "", lastName: "", userType: "" }];
    });
  };

  const submitMultiAddUsers = async () => {
    setMultiAddError("");
    setMultiAddSuccess("");
    const invalid = multiAddPreview.filter((row) => row.error.length > 0);
    if (invalid.length > 0) {
      setMultiAddError("Fix preview errors before creating users.");
      return;
    }
    if (multiAddPreview.length === 0) {
      setMultiAddError("Add at least one user row.");
      return;
    }

    setIsMultiAddingUsers(true);
    const createdRows: DepartmentUserRecord[] = [];
    const failedRows: Array<{ index: number; message: string }> = [];

    for (const row of multiAddPreview) {
      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.fullName,
            username: row.username,
            password: row.password,
            userType: row.userType,
          }),
        });
        const json = (await response.json()) as {
          ok?: boolean;
          user?: { id: string; username: string; userType: string; name?: string };
          message?: string;
        };
        if (!response.ok || !json?.ok || !json.user) {
          failedRows.push({
            index: row.index,
            message: json?.message ?? "Create user failed.",
          });
          continue;
        }
        createdRows.push({
          id: json.user.id,
          name: String(json.user.name ?? row.fullName),
          userType: String(json.user.userType ?? row.userType),
          username: String(json.user.username ?? row.username),
          password: "",
        });
      } catch {
        failedRows.push({
          index: row.index,
          message: "Network error.",
        });
      }
    }

    if (createdRows.length > 0) {
      const nextUserRecords = [...userRecords];
      const existingUsernames = new Set(
        nextUserRecords.map((record) => record.username.trim().toLowerCase()),
      );
      createdRows.forEach((created) => {
        const normalizedUsername = created.username.trim().toLowerCase();
        if (!existingUsernames.has(normalizedUsername)) {
          nextUserRecords.push(created);
          existingUsernames.add(normalizedUsername);
        }
      });
      setUserRecords(nextUserRecords);
      setPersonnelRecords((prev) => {
        const byName = new Map(
          prev
            .map((entry) => [entry.name.trim().toLocaleLowerCase(), entry] as const)
            .filter(([name]) => name.length > 0),
        );
        return nextUserRecords
          .map((user) => {
            const userName = user.name.trim();
            const existing = byName.get(userName.toLocaleLowerCase());
            if (existing) {
              const matched = nextUserRecords.find(
                (u) =>
                  u.name
                    .trim()
                    .localeCompare(userName, undefined, { sensitivity: "base" }) === 0,
              );
              return {
                ...existing,
                name: userName,
                userType: matched?.userType ?? existing.userType,
              };
            }
            const matched = nextUserRecords.find(
              (r) =>
                r.name
                  .trim()
                  .localeCompare(userName, undefined, { sensitivity: "base" }) === 0,
            );
            return {
              name: userName,
              shift: "",
              apparatusAssignment: "",
              station: "",
              userType: matched?.userType ?? "",
              qualifications: [],
            } satisfies DepartmentPersonnelRecord;
          })
          .filter((entry) => entry.name.length > 0);
      });
    }

    if (failedRows.length > 0) {
      setMultiAddError(
        failedRows
          .map((failure) => `Row ${failure.index + 1}: ${failure.message}`)
          .join(" "),
      );
      setMultiAddRows(
        failedRows.map((failure) => multiAddRows[failure.index]!).filter(Boolean),
      );
    } else {
      setMultiAddRows([{ firstName: "", lastName: "", userType: "" }]);
      setMultiAddSuccess(`${createdRows.length} user(s) created.`);
      setStatusMessage(`${createdRows.length} user(s) created.`);
      setIsMultiAddOpen(false);
    }
    setIsMultiAddingUsers(false);
  };

  const openResetPasswordForm = (index: number) => {
    setResetPasswordTargetIndex(index);
    setResetPasswordValue("");
    setResetPasswordConfirmValue("");
    setResetPasswordError("");
    setResetPasswordSuccess("");
  };

  const submitResetUserPassword = async () => {
    if (resetPasswordTargetIndex === null) {
      return;
    }
    const target = userRecords[resetPasswordTargetIndex];
    if (!target) {
      setResetPasswordError("Could not find selected user.");
      return;
    }
    const trimmed = resetPasswordValue.trim();
    const trimmedConfirm = resetPasswordConfirmValue.trim();
    if (!trimmed || !trimmedConfirm) {
      setResetPasswordError("Please enter and confirm the new password.");
      return;
    }
    if (trimmed !== trimmedConfirm) {
      setResetPasswordError("New password and confirm password must match.");
      return;
    }
    const policyError = validatePasswordPolicyClient(trimmed);
    if (policyError) {
      setResetPasswordError(policyError);
      return;
    }
    setIsResettingPassword(true);
    setResetPasswordError("");
    setResetPasswordSuccess("");
    try {
      let targetId = target.id?.trim();
      if (!targetId && target.username.trim()) {
        const listRes = await fetch("/api/users");
        const listJson = (await listRes.json()) as {
          ok?: boolean;
          users?: { id: string; username: string }[];
        };
        if (listJson?.ok && Array.isArray(listJson.users)) {
          const matched = listJson.users.find(
            (user) =>
              user.username.trim().toLowerCase() === target.username.trim().toLowerCase(),
          );
          targetId = matched?.id?.trim() ?? "";
        }
      }
      if (!targetId) {
        setResetPasswordError("Unable to find this user for password reset. Refresh and try again.");
        return;
      }
      const res = await fetch(`/api/users/${targetId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: trimmed }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json?.ok) {
        setResetPasswordError(json?.message ?? "Unable to reset password.");
        return;
      }
      setResetPasswordSuccess("Password reset.");
      setStatusMessage("Password reset.");
      setResetPasswordValue("");
      setResetPasswordConfirmValue("");
    } catch {
      setResetPasswordError("Unable to reach reset-password service.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const resetUserPassword = async (index: number) => {
    openResetPasswordForm(index);
  };

  const closeResetPasswordForm = () => {
    setResetPasswordTargetIndex(null);
    setResetPasswordValue("");
    setResetPasswordConfirmValue("");
    setResetPasswordError("");
    setResetPasswordSuccess("");
  };

  const savePersonnelForm = () => {
    if (!isMultiEditMode) {
      if (!personnelDraft.name.trim()) {
        return;
      }
      const previousName =
        editingIndex !== null ? personnelRecords[editingIndex]?.name.trim() ?? "" : "";
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
      if (
        previousName &&
        normalized.name &&
        previousName.localeCompare(normalized.name, undefined, { sensitivity: "base" }) !== 0
      ) {
        setKellyRotations((previous) =>
          previous.map((entry) =>
            entry.personnel.trim() === previousName
              ? { ...entry, personnel: normalized.name }
              : entry,
          ),
        );
      }
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

  const resetAdditionalFieldDraft = useCallback(() => {
    setAdditionalFieldDraft({
      id: "",
      fieldName: "",
      numberOfSlots: 1,
      valueMode: "personnel",
      personnelOverride: true,
    });
  }, []);

  const saveAdditionalField = () => {
    const normalizedName = additionalFieldDraft.fieldName.trim();
    if (!normalizedName) {
      return;
    }
    const normalizedSlots = Math.max(1, Math.floor(Number(additionalFieldDraft.numberOfSlots) || 1));
    const normalizedMode: AdditionalFieldValueMode =
      additionalFieldDraft.valueMode === "text" ? "text" : "personnel";
    const normalizedOverride =
      normalizedMode === "personnel" ? Boolean(additionalFieldDraft.personnelOverride) : false;

    setAdditionalFieldRecords((previous) => {
      const existingRow =
        editingAdditionalFieldIndex !== null ? previous[editingAdditionalFieldIndex] : undefined;
      const preserveKellyId = existingRow?.id === "support-kelly-day";
      const baseId = existingRow?.id ?? toAdditionalFieldId(normalizedName);
      let nextId = preserveKellyId ? "support-kelly-day" : baseId;
      const takenIds = new Set(
        previous
          .map((entry, index) => ({ entry, index }))
          .filter(({ index }) => index !== editingAdditionalFieldIndex)
          .map(({ entry }) => entry.id),
      );
      if (takenIds.has(nextId)) {
        let counter = 2;
        while (takenIds.has(`${nextId}-${counter}`)) {
          counter += 1;
        }
        nextId = `${nextId}-${counter}`;
      }
      const normalizedRow: AdditionalFieldRecord = {
        id: nextId,
        fieldName: normalizedName,
        numberOfSlots: normalizedSlots,
        valueMode: preserveKellyId ? "personnel" : normalizedMode,
        personnelOverride: preserveKellyId ? true : normalizedOverride,
      };
      return editingAdditionalFieldIndex === null
        ? [...previous, normalizedRow]
        : previous.map((entry, index) =>
            index === editingAdditionalFieldIndex ? normalizedRow : entry,
          );
    });

    setEditingAdditionalFieldIndex(null);
    resetAdditionalFieldDraft();
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Auto-saved.");
  };

  const removeAdditionalField = (index: number) => {
    const record = additionalFieldRecords[index];
    if (!record) return;
    if (record.id === "support-kelly-day") {
      setStatusMessage("Kelly Day is required and cannot be removed.");
      return;
    }
    setAdditionalFieldRecords((previous) =>
      previous.filter((_, fieldIndex) => fieldIndex !== index),
    );
    if (editingAdditionalFieldIndex === index) {
      setEditingAdditionalFieldIndex(null);
      resetAdditionalFieldDraft();
    }
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Auto-saved.");
  };

  const handleAdditionalFieldDrop = (targetIndex: number) => {
    setAdditionalFieldRecords((previous) => {
      const fromIndex = dragAdditionalFieldIndex;
      if (fromIndex === null || fromIndex < 0 || fromIndex >= previous.length) {
        return previous;
      }
      if (targetIndex < 0 || targetIndex >= previous.length || targetIndex === fromIndex) {
        return previous;
      }
      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) {
        return previous;
      }
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragAdditionalFieldIndex(null);
    setAutoSaveTick((previous) => previous + 1);
    setStatusMessage("Additional field order updated.");
  };

  const persistDepartmentDetails = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const nextUiPreferencesByUser = {
      ...uiPreferencesByUser,
      [uiPreferenceUserKey]: {
        ...(uiPreferencesByUser[uiPreferenceUserKey] ?? {}),
        apparatusFieldWidths,
        apparatusFieldOrder,
        schedulerApparatusFieldWidths,
        schedulerPersonnelFieldWidths,
        userTableColumnWidths,
      },
    };
    // Omit userRecords from payload: auth lives in User table only (Wave 3), not in DepartmentDetails.payloadJson.
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
      masterApparatusRecords: apparatusRecords,
      schedulerApparatusRecords,
      additionalFields: additionalFieldRecords,
      standardOvertimeSlot,
      shiftInformationEntries,
      schedulerPersonnelRecords: personnelRecords,
      personnelQualifications,
      userTypeValues,
      selectedMutualAidIds,
      incidentsSetup,
      kellyRotations,
      schedulerEnabled,
      uiPreferencesByUser: nextUiPreferencesByUser,
    };
    window.localStorage.setItem(DEPARTMENT_DETAILS_STORAGE_KEY, JSON.stringify(payload));
    fetch("/api/department-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (res.ok) {
          setStatusMessage("Department details saved.");
        } else {
          setStatusMessage("Saved locally. File save failed—ensure npm run proxy is running.");
        }
      })
      .catch(() => {
        setStatusMessage("Saved locally. File save failed—ensure npm run proxy is running.");
      });
  }, [
    apparatusFieldOrder,
    apparatusFieldWidths,
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
    kellyRotations,
    additionalFieldRecords,
    standardOvertimeSlot,
    personnelQualifications,
    personnelRecords,
    schedulerApparatusFieldWidths,
    schedulerApparatusRecords,
    schedulerEnabled,
    schedulerPersonnelFieldWidths,
    userTableColumnWidths,
    uiPreferenceUserKey,
    uiPreferencesByUser,
    secondaryContactName,
    secondaryContactPhone,
    selectedMutualAidIds,
    incidentsSetup,
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
    setStatusMessage("Saving…");
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{pageTitle}</h1>
          <p>{pageSubtitle}</p>
        </div>
      </header>

      <form className="panel-grid" onSubmit={handleDepartmentDetailsSave}>
        <section
          className="panel-grid two-column"
          style={{ display: showDepartmentDetailsSection ? undefined : "none" }}
        >
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

        <section
          className="panel-grid two-column"
          style={{ display: showDepartmentDetailsSection ? undefined : "none" }}
        >
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

        <article
          className="panel"
          style={{ display: showDepartmentDetailsSection ? undefined : "none" }}
        >
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
                          ? `Total Users: ${userRecords.length}`
                        : definition.key === "kellyRotation"
                          ? `Total Kelly Rotations: ${kellyRotations.length}`
                          : `Total Qualifications: ${personnelQualifications.length}`}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article
          className="panel"
          style={{ display: showDepartmentDetailsSection ? undefined : "none" }}
        >
          <div className="panel-header">
            <h2>Incident Audit Log</h2>
          </div>
          {deletedIncidentAuditEntries.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Incident Number</th>
                    <th>Deleted At</th>
                    <th>Deleted By</th>
                    <th>Reason</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deletedIncidentAuditEntries.map((entry) => (
                    <tr key={`incident-audit-${entry.callNumber}`}>
                      <td>{getIncidentDisplayNumber(entry)}</td>
                      <td>{entry.deletedAt || "--"}</td>
                      <td>{entry.deletedBy || "--"}</td>
                      <td>{entry.deletedReason || "--"}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={() => onRestoreIncidentCall?.(entry.callNumber)}
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="field-hint">
              No deleted incidents are currently hidden.
            </p>
          )}
        </article>

        <article
          className="panel"
          style={{ display: showDepartmentDetailsSection ? undefined : "none" }}
        >
          <div className="panel-header">
            <h2>Incidents Setup</h2>
          </div>
          <div className="department-collection-grid">
            {INCIDENTS_SETUP_FIELD_CARDS.map((fieldCard) => {
              const fieldKey = fieldCard.key;
              const isEditing = editingIncidentSetupField === fieldKey;
              const optionsValue = fieldCard.optionsKey ? incidentsSetup[fieldCard.optionsKey] : [];
              const isVisible = incidentsSetup.visibleFields[fieldKey];
              const isRequired = incidentsSetup.requiredFields[fieldKey];
              return (
                <div key={`incident-setup-${fieldKey}`} className="department-collection-card">
                  <div className="department-collection-card-header">
                    <h3>{INCIDENTS_SETUP_FIELD_LABELS[fieldKey]}</h3>
                    {fieldCard.editButtonLabel ? (
                      <button
                        type="button"
                        className="rl-box-button"
                        onClick={() => {
                          if (isEditing) {
                            setEditingIncidentSetupField(null);
                            setIncidentSetupOptionDrafts((priorDrafts) => {
                              const nextDrafts = { ...priorDrafts };
                              delete nextDrafts[fieldKey];
                              return nextDrafts;
                            });
                            return;
                          }
                          setEditingIncidentSetupField(fieldKey);
                          if (fieldCard.optionsKey) {
                            const currentOptions = incidentsSetup[fieldCard.optionsKey];
                            setIncidentSetupOptionDrafts((priorDrafts) => ({
                              ...priorDrafts,
                              [fieldKey]: currentOptions.join("\n"),
                            }));
                          }
                        }}
                      >
                        {fieldCard.editButtonLabel}
                      </button>
                    ) : null}
                  </div>
                  <label className="field-hint" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    {isVisible ? <span>Visible</span> : <em>Hidden</em>}
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(event) =>
                        setIncidentsSetup((previous) => ({
                          ...previous,
                          visibleFields: {
                            ...previous.visibleFields,
                            [fieldKey]: event.target.checked,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="field-hint" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    {isRequired ? <span>Required</span> : <em>Not required</em>}
                    <input
                      type="checkbox"
                      checked={isRequired}
                      onChange={(event) =>
                        setIncidentsSetup((previous) => ({
                          ...previous,
                          requiredFields: {
                            ...previous.requiredFields,
                            [fieldKey]: event.target.checked,
                          },
                        }))
                      }
                    />
                  </label>

                  {isEditing ? (
                    <div className="settings-form" style={{ marginTop: "0.5rem" }}>
                      {fieldCard.key === "reportedBy" ? (
                        <label
                          className="field-hint"
                          style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                        >
                          <input
                            type="checkbox"
                            checked={incidentsSetup.reportedByMode === "fill-in"}
                            onChange={(event) =>
                              setIncidentsSetup((previous) => ({
                                ...previous,
                                reportedByMode: event.target.checked ? "fill-in" : "dropdown",
                              }))
                            }
                          />
                          Use fill-in text input (unchecked = DD-S dropdown)
                        </label>
                      ) : null}

                      {fieldCard.optionsKey &&
                      (fieldCard.key !== "reportedBy" || incidentsSetup.reportedByMode === "dropdown") ? (
                        <label>
                          {INCIDENTS_SETUP_FIELD_LABELS[fieldKey]} options (one per line)
                          <textarea
                            rows={4}
                            value={
                              incidentSetupOptionDrafts[fieldKey] ??
                              (Array.isArray(optionsValue) ? optionsValue.join("\n") : "")
                            }
                            onChange={(event) =>
                              (() => {
                                const raw = event.target.value;
                                setIncidentSetupOptionDrafts((previousDrafts) => ({
                                  ...previousDrafts,
                                  [fieldKey]: raw,
                                }));
                                setIncidentsSetup((previous) => {
                                  const nextOptions = Array.from(
                                    new Set(
                                      raw
                                        .split(/\n|,/)
                                        .map((value) => value.trim())
                                        .filter((value) => value.length > 0),
                                    ),
                                  );
                                  if (!fieldCard.optionsKey) {
                                    return previous;
                                  }
                                  return {
                                    ...previous,
                                    [fieldCard.optionsKey]: nextOptions,
                                  } as IncidentsSetupConfig;
                                });
                              })()
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </article>

        <article
          className="panel"
          style={{ display: showSchedulerSettingsSection ? undefined : "none" }}
        >
          <div className="panel-header">
            <h2>Scheduler Settings</h2>
            <label className="field-hint" style={{ marginLeft: "auto" }}>
              <input
                type="checkbox"
                checked={schedulerEnabled}
                onChange={(event) => {
                  setSchedulerEnabled(event.target.checked);
                  setAutoSaveTick((previous) => previous + 1);
                  setStatusMessage("Auto-saved.");
                }}
                style={{ marginRight: "0.35rem" }}
              />
              Enable Scheduler Settings
            </label>
          </div>
          {schedulerEnabled ? (
            <div className="department-collection-grid">
              {schedulerSettingsCards.map((definition) => (
                <div key={definition.key} className="department-collection-card">
                  <div className="department-collection-card-header">
                    <h3>{definition.label}</h3>
                    <button type="button" className="rl-box-button" onClick={() => openCollectionEditor(definition.key)}>
                      {definition.editButtonLabel}
                    </button>
                  </div>
                  <p className="field-hint">
                    {definition.key === "shiftInformation"
                      ? `Total Shift Information Entries: ${shiftInformationEntries.length}`
                      : definition.key === "additionalFields"
                      ? `Total Additional Fields: ${additionalFieldRecords.length}`
                      : definition.key === "overtimeSetup"
                      ? `Standard Overtime Slot: ${standardOvertimeSlot} hour(s)`
                      : definition.key === "schedulerApparatus"
                      ? `Total Apparatus: ${schedulerApparatusRecords.length}`
                      : definition.key === "schedulerPersonnel"
                      ? `Total Personnel: ${personnelRecords.length}`
                      : definition.key === "kellyRotation"
                        ? `Total Kelly Rotations: ${kellyRotations.length}`
                        : `Total Qualifications: ${personnelQualifications.length}`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="field-hint">
              Scheduler settings are hidden until this feature is enabled by a super admin.
            </p>
          )}
        </article>

        <article
          className="panel"
          style={{ display: showDepartmentDetailsSection ? undefined : "none" }}
        >
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

        <article
          className="panel"
          style={{ display: showDepartmentDetailsSection ? undefined : "none" }}
        >
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

        <article
          className="panel"
          style={{ display: showPersonnelManagementSection ? undefined : "none" }}
        >
          <div className="panel-header">
            <h2>Personnel Management</h2>
          </div>
          <div className="department-collection-grid">
            {personnelManagementCards.map((definition) => (
              <div key={definition.key} className="department-collection-card">
                <div className="department-collection-card-header">
                  <h3>{definition.label}</h3>
                  <button
                    type="button"
                    className="rl-box-button"
                    onClick={() => openCollectionEditor(definition.key)}
                  >
                    {definition.editButtonLabel}
                  </button>
                </div>
                <p className="field-hint">Total Users: {userRecords.length}</p>
              </div>
            ))}
          </div>
        </article>

        <div className="header-actions">
          <button type="submit" className="primary-button">
            {saveButtonLabel}
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

            {(isStationsEditor || isApparatusEditor || isUsersEditor || isSchedulerPersonnelEditor || isSchedulerApparatusEditor || isAdditionalFieldsEditor) ? (
              <>
                <div className="department-editor-toolbar-actions">
                  {!isSchedulerPersonnelEditor && !isSchedulerApparatusEditor && !isAdditionalFieldsEditor ? (
                    <button type="button" className="secondary-button compact-button" onClick={openAddForm}>
                      Add
                    </button>
                  ) : null}
                  {isUsersEditor ? (
                    <button
                      type="button"
                      className={`secondary-button compact-button ${isMultiAddOpen ? "department-toggle-active" : ""}`}
                      onClick={() => {
                        setIsMultiAddOpen((previous) => !previous);
                        setMultiAddError("");
                        setMultiAddSuccess("");
                      }}
                    >
                      Multi-Add
                    </button>
                  ) : null}
                  {isStationsEditor ? (
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
                  ) : null}
                </div>

                {isUsersEditor ? (
                  <div className="department-apparatus-list-wrapper">
                    {isMultiAddOpen ? (
                      <div className="panel" style={{ marginBottom: "0.75rem" }}>
                        <div className="panel-header">
                          <h3>Multi-Add Users</h3>
                        </div>
                        <div className="settings-form">
                          <label>
                            Username Template
                            <input
                              type="text"
                              value={multiAddUsernameTemplate}
                              onChange={(event) => setMultiAddUsernameTemplate(event.target.value)}
                              placeholder="${last:3}${first:1}"
                            />
                          </label>
                          <label>
                            Password Template
                            <input
                              type="text"
                              value={multiAddPasswordTemplate}
                              onChange={(event) => setMultiAddPasswordTemplate(event.target.value)}
                              placeholder="${Last}12345!"
                            />
                          </label>
                          <label>
                            Default User Type
                            <select
                              value={multiAddDefaultUserType}
                              onChange={(event) => setMultiAddDefaultUserType(event.target.value)}
                            >
                              {userTypeValues.map((option) => (
                                <option key={`multi-add-type-${option}`} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <p className="field-hint">
                            Tokens: {"${first}"}, {"${last}"}, {"${first:1}"}, {"${last:3}"},{" "}
                            {"${First}"}, {"${Last}"}. Quick shortcuts: <code>LLLF</code> and{" "}
                            <code>f(last name)</code>.
                          </p>
                          <div className="table-wrapper">
                            <table>
                              <thead>
                                <tr>
                                  <th>First Name</th>
                                  <th>Last Name</th>
                                  <th>User Type</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {multiAddRows.map((row, rowIndex) => (
                                  <tr key={`multi-add-row-${rowIndex}`}>
                                    <td>
                                      <input
                                        type="text"
                                        value={row.firstName}
                                        onChange={(event) =>
                                          updateMultiAddRow(rowIndex, "firstName", event.target.value)
                                        }
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="text"
                                        value={row.lastName}
                                        onChange={(event) =>
                                          updateMultiAddRow(rowIndex, "lastName", event.target.value)
                                        }
                                      />
                                    </td>
                                    <td>
                                      <select
                                        value={row.userType}
                                        onChange={(event) =>
                                          updateMultiAddRow(rowIndex, "userType", event.target.value)
                                        }
                                      >
                                        <option value="">Use default</option>
                                        {userTypeValues.map((option) => (
                                          <option key={`multi-add-row-type-${rowIndex}-${option}`} value={option}>
                                            {option}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="secondary-button compact-button"
                                        onClick={() => removeMultiAddRow(rowIndex)}
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="department-editor-toolbar-actions">
                            <button type="button" className="secondary-button compact-button" onClick={addMultiAddRow}>
                              Add Row
                            </button>
                            <button
                              type="button"
                              className="primary-button compact-button"
                              onClick={() => void submitMultiAddUsers()}
                              disabled={isMultiAddingUsers}
                            >
                              {isMultiAddingUsers ? "Creating..." : "Create Users"}
                            </button>
                          </div>

                          <div className="table-wrapper" style={{ marginTop: "0.5rem" }}>
                            <table>
                              <thead>
                                <tr>
                                  <th>Full Name</th>
                                  <th>Generated Username</th>
                                  <th>Generated Password</th>
                                  <th>User Type</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {multiAddPreview.map((row) => (
                                  <tr key={`multi-add-preview-${row.index}`}>
                                    <td>{row.fullName || "—"}</td>
                                    <td>{row.username || "—"}</td>
                                    <td>{row.password || "—"}</td>
                                    <td>{row.userType || "—"}</td>
                                    <td>{row.error || "Ready"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {multiAddError ? <p className="auth-error">{multiAddError}</p> : null}
                          {multiAddSuccess ? <p className="save-message">{multiAddSuccess}</p> : null}
                        </div>
                      </div>
                    ) : null}
                    {resetPasswordTargetIndex !== null && userRecords[resetPasswordTargetIndex] ? (
                      <div className="panel" style={{ marginBottom: "0.75rem" }}>
                        <div className="panel-header">
                          <h3>Reset Password</h3>
                        </div>
                        <div className="settings-form">
                          <p className="field-hint">
                            Reset password for{" "}
                            <strong>
                              {userRecords[resetPasswordTargetIndex]?.username ||
                                userRecords[resetPasswordTargetIndex]?.name ||
                                "selected user"}
                            </strong>
                            .
                          </p>
                          <label>
                            New Password
                            <input
                              type="password"
                              value={resetPasswordValue}
                              onChange={(event) => setResetPasswordValue(event.target.value)}
                              autoComplete="new-password"
                            />
                          </label>
                          <label>
                            Confirm New Password
                            <input
                              type="password"
                              value={resetPasswordConfirmValue}
                              onChange={(event) => setResetPasswordConfirmValue(event.target.value)}
                              autoComplete="new-password"
                            />
                          </label>
                          <p className="field-hint">
                            Password policy: 8+ chars, uppercase, lowercase, number, and special
                            character.
                          </p>
                          <div className="department-editor-toolbar-actions">
                            <button
                              type="button"
                              className="primary-button compact-button"
                              onClick={() => void submitResetUserPassword()}
                              disabled={isResettingPassword}
                            >
                              {isResettingPassword ? "Resetting..." : "Save Reset Password"}
                            </button>
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={closeResetPasswordForm}
                              disabled={isResettingPassword}
                            >
                              Cancel
                            </button>
                          </div>
                          {resetPasswordError ? <p className="auth-error">{resetPasswordError}</p> : null}
                          {resetPasswordSuccess ? <p className="save-message">{resetPasswordSuccess}</p> : null}
                        </div>
                      </div>
                    ) : null}
                    <div className="department-editor-toolbar-actions" style={{ marginBottom: "0.5rem" }}>
                      <input
                        type="search"
                        value={userSearchQuery}
                        onChange={(event) => setUserSearchQuery(event.target.value)}
                        placeholder="Search users by name, username, or user type..."
                        aria-label="Search users"
                      />
                    </div>
                    <div className="table-wrapper">
                      <table className="user-edit-table">
                        <colgroup>
                          <col style={{ width: `${userTableColumnWidths.name}px` }} />
                          <col style={{ width: `${userTableColumnWidths.username}px` }} />
                          <col style={{ width: `${userTableColumnWidths.userType}px` }} />
                          <col style={{ width: "160px" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>
                              <div className="user-table-header-control">
                                <button
                                  type="button"
                                  className={`table-sort-button ${userSortColumn === "name" ? "table-sort-button-active" : ""}`}
                                  onClick={() => handleUserSort("name")}
                                  aria-label="Sort by user full name"
                                >
                                  <span>User Full Name</span>
                                  {userSortColumn === "name" ? (
                                    <span
                                      className={`table-sort-glyph table-sort-glyph-${userSortDirection}`}
                                      aria-hidden="true"
                                    >
                                      <span />
                                      <span />
                                      <span />
                                    </span>
                                  ) : null}
                                </button>
                                <span
                                  className="dispatch-column-resizer user-table-column-resizer"
                                  role="separator"
                                  aria-label="Resize user full name column"
                                  aria-orientation="vertical"
                                  onPointerDown={(event) =>
                                    startUserTableColumnResize("name", event)
                                  }
                                  title="Drag to resize User Full Name column"
                                >
                                  |
                                </span>
                              </div>
                            </th>
                            <th>
                              <div className="user-table-header-control">
                                <button
                                  type="button"
                                  className={`table-sort-button ${userSortColumn === "username" ? "table-sort-button-active" : ""}`}
                                  onClick={() => handleUserSort("username")}
                                  aria-label="Sort by username"
                                >
                                  <span>Username</span>
                                  {userSortColumn === "username" ? (
                                    <span
                                      className={`table-sort-glyph table-sort-glyph-${userSortDirection}`}
                                      aria-hidden="true"
                                    >
                                      <span />
                                      <span />
                                      <span />
                                    </span>
                                  ) : null}
                                </button>
                                <span
                                  className="dispatch-column-resizer user-table-column-resizer"
                                  role="separator"
                                  aria-label="Resize username column"
                                  aria-orientation="vertical"
                                  onPointerDown={(event) =>
                                    startUserTableColumnResize("username", event)
                                  }
                                  title="Drag to resize Username column"
                                >
                                  |
                                </span>
                              </div>
                            </th>
                            <th>
                              <div className="user-table-header-control">
                                <button
                                  type="button"
                                  className={`table-sort-button ${userSortColumn === "userType" ? "table-sort-button-active" : ""}`}
                                  onClick={() => handleUserSort("userType")}
                                  aria-label="Sort by user type"
                                >
                                  <span>User Type</span>
                                  {userSortColumn === "userType" ? (
                                    <span
                                      className={`table-sort-glyph table-sort-glyph-${userSortDirection}`}
                                      aria-hidden="true"
                                    >
                                      <span />
                                      <span />
                                      <span />
                                    </span>
                                  ) : null}
                                </button>
                                <span
                                  className="dispatch-column-resizer user-table-column-resizer"
                                  role="separator"
                                  aria-label="Resize user type column"
                                  aria-orientation="vertical"
                                  onPointerDown={(event) =>
                                    startUserTableColumnResize("userType", event)
                                  }
                                  title="Drag to resize User Type column"
                                >
                                  |
                                </span>
                              </div>
                            </th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedFilteredUserRows.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="department-apparatus-empty">
                                {userRecords.length === 0
                                  ? "No users. Click Add to create one."
                                  : "No users match the search."}
                              </td>
                            </tr>
                          ) : (
                            sortedFilteredUserRows.map(({ user, index }) => (
                              <tr
                                key={`user-row-${index}-${user.name}`}
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
                                  <strong className="call-number-text">{user.name || "—"}</strong>
                                </td>
                                <td>
                                  <span className="department-apparatus-field">{user.username || "—"}</span>
                                </td>
                                <td>
                                  <span className="department-apparatus-field">{user.userType || "—"}</span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="secondary-button compact-button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      void resetUserPassword(index);
                                    }}
                                  >
                                    Reset Password
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : isSchedulerApparatusEditor ? (
                  <div className="department-apparatus-list-wrapper">
                    <div className="department-editor-toolbar-actions" style={{ marginBottom: "0.5rem" }}>
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() => setIsImportApparatusModalOpen(true)}
                      >
                        Import Apparatus
                      </button>
                    </div>
                    <div className="table-wrapper scheduler-apparatus-table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: "42px" }} aria-label="Drag handle" />
                            <th>Apparatus</th>
                            <th>
                              <div
                                className="department-scheduler-apparatus-grid-line department-personnel-grid-header"
                                style={schedulerApparatusGridStyle}
                              >
                                {SCHEDULER_APPARATUS_GRID_FIELD_ORDER.map((fieldId, idx) => {
                                  const label =
                                    fieldId === "minPersonnel"
                                      ? "Min Personnel"
                                      : fieldId === "maxPersonnel"
                                        ? "Max Personnel"
                                      : fieldId === "personnelRequirements"
                                        ? "Minimum Requirements"
                                        : "Station";
                                  return (
                                    <span
                                      key={`scheduler-apparatus-header-${fieldId}`}
                                      className="department-apparatus-field department-apparatus-header-field"
                                    >
                                      <span className="department-apparatus-header-label">{label}</span>
                                      {idx < SCHEDULER_APPARATUS_GRID_FIELD_ORDER.length - 1 ? (
                                        <span
                                          className="dispatch-column-resizer"
                                          role="separator"
                                          aria-label={`Resize ${label} column`}
                                          aria-orientation="vertical"
                                          onPointerDown={(event) =>
                                            startSchedulerApparatusFieldResize(fieldId, event)
                                          }
                                          title={`Drag to resize ${label}`}
                                        >
                                          |
                                        </span>
                                      ) : null}
                                    </span>
                                  );
                                })}
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedulerApparatusRecords.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="department-apparatus-empty">
                                No scheduler apparatus yet. Click Import Apparatus to add rows.
                              </td>
                            </tr>
                          ) : (
                            schedulerApparatusRecords.map((entry, index) => (
                              <tr
                                key={`scheduler-apparatus-${index}-${entry.apparatus}`}
                                className={`clickable-row ${selectedSingleIndex === index ? "clickable-row-selected" : ""}`}
                                draggable
                                onDragStart={() => setDragSchedulerApparatusIndex(index)}
                                onDragEnd={() => setDragSchedulerApparatusIndex(null)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => handleSchedulerApparatusDrop(index)}
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
                                  <span className="drag-handle" aria-hidden="true">
                                    <span />
                                    <span />
                                    <span />
                                  </span>
                                </td>
                                <td>
                                  <strong className="call-number-text">{entry.apparatus || "—"}</strong>
                                </td>
                                <td>
                                  <div className="dispatch-info-cell">
                                    <div
                                      className="department-scheduler-apparatus-grid-line"
                                      style={schedulerApparatusGridStyle}
                                    >
                                      <span className="department-apparatus-field">{String(entry.minimumPersonnel)}</span>
                                      <span className="department-apparatus-field">{String(entry.maximumPersonnel)}</span>
                                      <span className="department-apparatus-field">
                                        {entry.personnelRequirements.length > 0 ? entry.personnelRequirements.join(", ") : "—"}
                                      </span>
                                      <span className="department-apparatus-field">{entry.station || "—"}</span>
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
                ) : isSchedulerPersonnelEditor ? (
                  <div className="department-apparatus-list-wrapper">
                      <div className="department-editor-toolbar-actions" style={{ marginBottom: "0.5rem" }}>
                        <input
                          type="search"
                          value={personnelSearchQuery}
                          onChange={(event) => setPersonnelSearchQuery(event.target.value)}
                          placeholder="Search personnel by name, shift, apparatus, station, or qualification..."
                          aria-label="Search personnel"
                        />
                      </div>
                      <div className="table-wrapper scheduler-personnel-table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>
                                <button
                                  type="button"
                                  className={`table-sort-button ${personnelSortColumn === "name" ? "table-sort-button-active" : ""}`}
                                  onClick={() => handlePersonnelSort("name")}
                                  aria-label="Sort personnel by name"
                                >
                                  <span>Name</span>
                                  {personnelSortColumn === "name" ? (
                                    <span
                                      className={`table-sort-glyph table-sort-glyph-${personnelSortDirection}`}
                                      aria-hidden="true"
                                    >
                                      <span />
                                      <span />
                                      <span />
                                    </span>
                                  ) : null}
                                </button>
                              </th>
                              <th>
                                <div
                                  className="department-personnel-grid-line--four department-personnel-grid-header"
                                  style={schedulerPersonnelGridStyle}
                                >
                                  {SCHEDULER_PERSONNEL_GRID_FIELD_ORDER.map((fieldId, idx) => {
                                    const label =
                                      fieldId === "shift"
                                        ? "Shift"
                                        : fieldId === "apparatusAssignment"
                                          ? "Apparatus"
                                          : fieldId === "station"
                                            ? "Station"
                                            : "Qualifications";
                                    return (
                                      <span
                                        key={`scheduler-personnel-header-${fieldId}`}
                                        className="department-apparatus-field department-apparatus-header-field"
                                      >
                                        <button
                                          type="button"
                                          className={`table-sort-button table-sort-button-inline ${personnelSortColumn === fieldId ? "table-sort-button-active" : ""}`}
                                          onClick={() => handlePersonnelSort(fieldId)}
                                          aria-label={`Sort personnel by ${label}`}
                                        >
                                          <span className="department-apparatus-header-label">{label}</span>
                                          {personnelSortColumn === fieldId ? (
                                            <span
                                              className={`table-sort-glyph table-sort-glyph-${personnelSortDirection}`}
                                              aria-hidden="true"
                                            >
                                              <span />
                                              <span />
                                              <span />
                                            </span>
                                          ) : null}
                                        </button>
                                        {idx < SCHEDULER_PERSONNEL_GRID_FIELD_ORDER.length - 1 ? (
                                          <span
                                            className="dispatch-column-resizer"
                                            role="separator"
                                            aria-label={`Resize ${label} column`}
                                            aria-orientation="vertical"
                                            onPointerDown={(event) =>
                                              startSchedulerPersonnelFieldResize(fieldId, event)
                                            }
                                            title={`Drag to resize ${label}`}
                                          >
                                            |
                                          </span>
                                        ) : null}
                                      </span>
                                    );
                                  })}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedFilteredPersonnelRows.length === 0 ? (
                              <tr>
                                <td colSpan={2} className="department-apparatus-empty">
                                  {personnelRecords.length === 0
                                    ? "No personnel yet. Add users first in Admin Functions -> Personnel Management."
                                    : "No personnel match the search."}
                                </td>
                              </tr>
                            ) : (
                              sortedFilteredPersonnelRows.map(({ personnel, index }) => (
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
                                      <div
                                        className="department-personnel-grid-line--four"
                                        style={schedulerPersonnelGridStyle}
                                      >
                                        <span className="department-apparatus-field">{personnel.shift || "—"}</span>
                                        <span className="department-apparatus-field">{personnel.apparatusAssignment || "—"}</span>
                                        <span className="department-apparatus-field">{personnel.station || "—"}</span>
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
                ) : (isApparatusEditor || isStationsEditor) && isMultiEditMode ? (
                  <select
                    multiple
                    className="department-select-box department-select-multi"
                    value={selectedMultiIndices.map((index) => String(index))}
                    onChange={setSelectionFromMultiSelect}
                  >
                    {(isApparatusEditor ? apparatusNames : stationNames).map((entry, index) => (
                      <option key={`collection-multi-${entry}-${index}`} value={String(index)}>
                        {entry}
                      </option>
                    ))}
                  </select>
                ) : !isMultiEditMode && isApparatusEditor ? (
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
                  ) : !isMultiEditMode && isStationsEditor ? (
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
                  ) : null}
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

            {isAdditionalFieldsEditor ? (
              <>
                <div className="department-editor-add-row">
                  <input
                    type="text"
                    value={additionalFieldDraft.fieldName}
                    onChange={(event) =>
                      setAdditionalFieldDraft((previous) => ({
                        ...previous,
                        fieldName: event.target.value,
                      }))
                    }
                    placeholder="Field Name"
                  />
                  <input
                    type="number"
                    min={1}
                    value={additionalFieldDraft.numberOfSlots}
                    onChange={(event) =>
                      setAdditionalFieldDraft((previous) => ({
                        ...previous,
                        numberOfSlots: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                      }))
                    }
                    placeholder="Number of Slots"
                  />
                  <select
                    value={additionalFieldDraft.valueMode}
                    onChange={(event) =>
                      setAdditionalFieldDraft((previous) => ({
                        ...previous,
                        valueMode: (event.target.value as AdditionalFieldValueMode) || "personnel",
                        personnelOverride:
                          event.target.value === "text" ? false : previous.personnelOverride,
                      }))
                    }
                  >
                    <option value="text">Text</option>
                    <option value="personnel">Personnel</option>
                  </select>
                  <label className="field-hint" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <input
                      type="checkbox"
                      checked={
                        additionalFieldDraft.valueMode === "personnel" &&
                        additionalFieldDraft.personnelOverride
                      }
                      disabled={additionalFieldDraft.valueMode !== "personnel"}
                      onChange={(event) =>
                        setAdditionalFieldDraft((previous) => ({
                          ...previous,
                          personnelOverride: event.target.checked,
                        }))
                      }
                    />
                    Personnel Override
                  </label>
                  <button
                    type="button"
                    className="primary-button compact-button"
                    onClick={saveAdditionalField}
                  >
                    {editingAdditionalFieldIndex === null ? "Add" : "Update"}
                  </button>
                </div>
                <p className="field-hint" style={{ marginTop: "0.5rem", marginBottom: "0.25rem" }}>
                  `Text` behaves like the Info row. `Personnel` allows slot assignments in Personnel Schedule.
                </p>
                <div className="department-qualifications-list-wrapper">
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: "32px" }} aria-label="Drag to reorder" />
                          <th>Field Name</th>
                          <th style={{ width: "110px" }}>Slots</th>
                          <th style={{ width: "120px" }}>Type</th>
                          <th style={{ width: "160px" }}>Personnel Override</th>
                          <th style={{ width: "90px" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {additionalFieldRecords.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="department-apparatus-empty">
                              No additional fields. Add one above.
                            </td>
                          </tr>
                        ) : (
                          additionalFieldRecords.map((entry, index) => (
                            <tr
                              key={`additional-field-${entry.id}-${index}`}
                              className={`clickable-row ${
                                editingAdditionalFieldIndex === index ? "clickable-row-selected" : ""
                              }`}
                              draggable
                              onDragStart={() => setDragAdditionalFieldIndex(index)}
                              onDragEnd={() => setDragAdditionalFieldIndex(null)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => handleAdditionalFieldDrop(index)}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setEditingAdditionalFieldIndex(index);
                                setAdditionalFieldDraft(entry);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setEditingAdditionalFieldIndex(index);
                                  setAdditionalFieldDraft(entry);
                                }
                              }}
                            >
                              <td
                                className="department-qualification-drag-cell"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <span className="drag-handle" aria-hidden="true">
                                  <span />
                                  <span />
                                  <span />
                                </span>
                              </td>
                              <td>
                                <strong className="call-number-text">{entry.fieldName || "—"}</strong>
                                {entry.id === "support-kelly-day" ? (
                                  <small className="field-hint" style={{ marginLeft: "0.45rem" }}>
                                    Required
                                  </small>
                                ) : null}
                              </td>
                              <td>{entry.numberOfSlots}</td>
                              <td>{entry.valueMode === "text" ? "Text" : "Personnel"}</td>
                              <td>{entry.valueMode === "personnel" && entry.personnelOverride ? "Yes" : "No"}</td>
                              <td>
                                <button
                                  type="button"
                                  className="secondary-button compact-button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeAdditionalField(index);
                                  }}
                                  disabled={entry.id === "support-kelly-day"}
                                >
                                  Remove
                                </button>
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

            {isOvertimeSetupEditor ? (
              <>
                <div className="department-edit-grid">
                  <label>
                    Standard Overtime Slot (hours)
                    <input
                      type="number"
                      min={1}
                      value={standardOvertimeSlot}
                      onChange={(event) =>
                        setStandardOvertimeSlot(
                          Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                        )
                      }
                    />
                  </label>
                </div>
                <p className="field-hint" style={{ marginTop: "0.5rem" }}>
                  Minimum apparatus slots can be overtime-split in day block view. Example: 12 =&gt; 2 personnel in one
                  slot, 8 =&gt; 3 personnel in one slot.
                </p>
                <div className="department-editor-toolbar-actions">
                  <button
                    type="button"
                    className="primary-button compact-button"
                    onClick={() => {
                      setAutoSaveTick((previous) => previous + 1);
                      setStatusMessage("Auto-saved.");
                    }}
                  >
                    Save
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
              <NerisGroupedOptionSelect
                inputId="mutual-aid-departments"
                value={selectedMutualAidIds
                  .map((id) => {
                    const opt = mutualAidOptions.find((o) => o.id === id);
                    return opt ? `${opt.state ?? "Unknown"}||${opt.id}` : "";
                  })
                  .filter(Boolean)
                  .join(",")}
                options={mutualAidOptions.map((o) => ({
                  value: `${o.state ?? "Unknown"}||${o.id}`,
                  label: `${o.name} (${o.id})`,
                }))}
                onChange={(nextValue) =>
                  setSelectedMutualAidIds(
                    nextValue
                      .split(",")
                      .map((s) => {
                        const parts = s.trim().split("||");
                        return parts.length >= 2 ? parts[1]!.trim() : parts[0]?.trim() ?? "";
                      })
                      .filter(Boolean),
                  )
                }
                mode="multi"
                variant="entityByState"
                placeholder="Select mutual aid department(s)"
                searchPlaceholder="Search departments..."
                showCheckboxes
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
                  Click a row to edit. Drag rows to reorder (order establishes hierarchy).
                </p>
                <div className="department-qualifications-list-wrapper">
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: "32px" }} aria-label="Drag to reorder" />
                          <th>User Type</th>
                          <th style={{ width: "80px" }}>Order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userTypeValues.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="department-apparatus-empty">
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
                              <td
                                className="department-qualification-drag-cell"
                                onClick={(e) => e.stopPropagation()}
                                draggable
                                onDragStart={() => setDragUserTypeIndex(index)}
                                onDragEnd={() => setDragUserTypeIndex(null)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => {
                                  if (dragUserTypeIndex === null || dragUserTypeIndex === index) {
                                    return;
                                  }
                                  setUserTypeValues((previous) => {
                                    const next = [...previous];
                                    const [moved] = next.splice(dragUserTypeIndex, 1);
                                    if (!moved) {
                                      return previous;
                                    }
                                    next.splice(index, 0, moved);
                                    return next;
                                  });
                                  setDragUserTypeIndex(null);
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

            {isKellyRotationEditor ? (
              <>
                <div className="department-editor-add-row kelly-rotation-editor-row">
                  <select
                    className="kelly-rotation-personnel-select"
                    value={kellyRotationDraft.personnel}
                    onChange={(event) =>
                      setKellyRotationDraft((previous) => ({ ...previous, personnel: event.target.value }))
                    }
                  >
                    <option value="">Select personnel</option>
                    {kellyPersonnelGroups.map((group) => (
                      <optgroup key={`kelly-group-${group.shift}`} label={group.shift}>
                        {group.members.map((name) => (
                          <option key={`kelly-person-${group.shift}-${name}`} value={name}>
                            {name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={kellyRotationDraft.repeatsEveryValue}
                    onChange={(event) =>
                      setKellyRotationDraft((previous) => ({
                        ...previous,
                        repeatsEveryValue: Number(event.target.value) || 1,
                      }))
                    }
                    placeholder="Repeats Every"
                  />
                  <select
                    value={kellyRotationDraft.repeatsEveryUnit}
                    onChange={(event) =>
                      setKellyRotationDraft((previous) => ({
                        ...previous,
                        repeatsEveryUnit: (event.target.value as KellyRotationUnit) || "Shifts",
                      }))
                    }
                  >
                    <option value="Days">Days</option>
                    <option value="Shifts">Shifts</option>
                  </select>
                  <input
                    type="date"
                    value={kellyRotationDraft.startsOn}
                    onChange={(event) =>
                      setKellyRotationDraft((previous) => ({ ...previous, startsOn: event.target.value }))
                    }
                  />
                  <button type="button" className="primary-button compact-button" onClick={addKellyRotation}>
                    {editingKellyRotationIndex === null ? "Add" : "Update"}
                  </button>
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={openKellyMultiAdd}
                  >
                    Multi-Add
                  </button>
                </div>
                {isKellyMultiAddOpen ? (
                  <div className="panel" style={{ marginTop: "0.65rem" }}>
                    <div className="panel-header">
                      <h3>Kelly Rotation Multi-Add</h3>
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={closeKellyMultiAdd}
                      >
                        Close
                      </button>
                    </div>
                    <div className="settings-form">
                      <div className="kelly-multi-add-controls">
                        <label>
                          Shift
                          <select
                            value={kellyMultiAddDraft.shift}
                            onChange={(event) => {
                              setKellyMultiAddPendingConfirmation(null);
                              setKellyMultiAddDraft((previous) => ({
                                ...previous,
                                shift: event.target.value,
                                occurrenceSlots: [],
                              }));
                            }}
                          >
                            <option value="">Select shift</option>
                            {kellyShiftOptions.map((shift) => (
                              <option key={`kelly-multi-shift-${shift}`} value={shift}>
                                {shift}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Repeat Interval
                          <input
                            type="number"
                            min={1}
                            value={kellyMultiAddDraft.repeatsEveryValue}
                            onChange={(event) => {
                              setKellyMultiAddPendingConfirmation(null);
                              setKellyMultiAddDraft((previous) => ({
                                ...previous,
                                repeatsEveryValue: Number(event.target.value) || 1,
                              }));
                            }}
                          />
                        </label>
                        <label>
                          Unit
                          <select
                            value={kellyMultiAddDraft.repeatsEveryUnit}
                            onChange={(event) => {
                              setKellyMultiAddPendingConfirmation(null);
                              setKellyMultiAddDraft((previous) => ({
                                ...previous,
                                repeatsEveryUnit: (event.target.value as KellyRotationUnit) || "Shifts",
                              }));
                            }}
                          >
                            <option value="Days">Days</option>
                            <option value="Shifts">Shifts</option>
                          </select>
                        </label>
                        <label>
                          Start Date
                          <input
                            type="date"
                            value={kellyMultiAddDraft.startsOn}
                            onChange={(event) => {
                              setKellyMultiAddPendingConfirmation(null);
                              setKellyMultiAddDraft((previous) => ({
                                ...previous,
                                startsOn: event.target.value,
                              }));
                            }}
                          />
                        </label>
                      </div>
                      <div className="kelly-multi-add-preview">
                        <p className="field-hint" style={{ margin: 0 }}>
                          Occurrence slots
                        </p>
                        {kellyOccurrencePreview.length > 0 ? (
                          <div className="kelly-multi-add-occurrence-grid">
                            {kellyOccurrencePreview.map((dateKey, index) => {
                              const date = new Date(`${dateKey}T00:00:00`);
                              const displayDate = Number.isNaN(date.getTime())
                                ? dateKey
                                : date.toLocaleDateString();
                              return (
                                <div
                                  key={`kelly-multi-preview-${dateKey}-${index}`}
                                  className="kelly-multi-add-occurrence-card"
                                >
                                  <div className="kelly-multi-add-occurrence-date">
                                    <strong>#{index + 1}</strong>
                                    <span>{displayDate}</span>
                                  </div>
                                  <div className="kelly-multi-add-occurrence-slots">
                                    {Array.from({ length: kellySlotCount }, (_, slotIndex) => (
                                      <label key={`kelly-row-slot-${index}-${slotIndex}`}>
                                        Slot {slotIndex + 1}
                                        <NerisFlatSingleOptionSelect
                                          inputId={`kelly-row-${index}-slot-${slotIndex}`}
                                          value={kellyMultiAddDraft.occurrenceSlots[index]?.[slotIndex] ?? ""}
                                          options={(selectedKellyGroup?.members ?? []).map((name) => ({
                                            value: name,
                                            label: name,
                                          }))}
                                          onChange={(nextValue) =>
                                            updateKellyMultiAddSlot(index, slotIndex, nextValue)
                                          }
                                          isOptionDisabled={(optionValue) =>
                                            kellyMultiAddDraft.occurrenceSlots.some((row, selectedRowIndex) =>
                                              row.some(
                                                (selectedName, selectedSlotIndex) =>
                                                  !(
                                                    selectedRowIndex === index &&
                                                    selectedSlotIndex === slotIndex
                                                  ) &&
                                                  selectedName.trim().length > 0 &&
                                                  selectedName === optionValue,
                                              ),
                                            )
                                          }
                                          placeholder={
                                            kellyMultiAddDraft.shift
                                              ? "Select personnel"
                                              : "Select shift first"
                                          }
                                          searchPlaceholder="Search personnel..."
                                          usePortal
                                          disabled={!kellyMultiAddDraft.shift}
                                          allowClear
                                        />
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="field-hint" style={{ margin: "0.35rem 0 0 0" }}>
                            Select start date to preview.
                          </p>
                        )}
                      </div>
                      <div className="department-editor-toolbar-actions">
                        <button
                          type="button"
                          className="primary-button compact-button"
                          onClick={submitKellyMultiAdd}
                          disabled={Boolean(kellyMultiAddPendingConfirmation)}
                        >
                          Create Rotation Rules
                        </button>
                        {kellyMultiAddPendingConfirmation ? (
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            onClick={() => setKellyMultiAddPendingConfirmation(null)}
                          >
                            Cancel Pending
                          </button>
                        ) : null}
                      </div>
                      {kellyMultiAddPendingConfirmation ? (
                        <div className="panel" style={{ marginTop: "0.45rem" }}>
                          <p className="field-hint" style={{ margin: 0 }}>
                            Confirm creating {kellyMultiAddPendingConfirmation.entries.length} rotation
                            rule(s).
                            {kellyMultiAddPendingConfirmation.replacements.length > 0
                              ? ` ${kellyMultiAddPendingConfirmation.replacements.length} existing rule(s) will be replaced.`
                              : " No existing rules will be replaced."}
                          </p>
                          {kellyMultiAddPendingConfirmation.replacements.length > 0 ? (
                            <p className="field-hint" style={{ marginTop: "0.35rem" }}>
                              Replacing: {kellyMultiAddPendingConfirmation.replacements.join(", ")}
                            </p>
                          ) : null}
                          <div className="department-editor-toolbar-actions">
                            <button
                              type="button"
                              className="primary-button compact-button"
                              onClick={confirmKellyMultiAdd}
                            >
                              Confirm Create
                            </button>
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() => setKellyMultiAddPendingConfirmation(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {kellyMultiAddError ? <p className="auth-error">{kellyMultiAddError}</p> : null}
                    </div>
                  </div>
                ) : null}
                <p className="field-hint" style={{ marginTop: "0.5rem", marginBottom: "0.25rem" }}>
                  Click a row to edit.
                </p>
                <div className="department-qualifications-list-wrapper">
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Personnel</th>
                          <th>Repeats Every</th>
                          <th>Starts On</th>
                          <th style={{ width: "90px" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kellyRotations.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="department-apparatus-empty">
                              No Kelly rotations. Add one above.
                            </td>
                          </tr>
                        ) : (
                          kellyRotations.map((entry, index) => (
                            <tr
                              key={`kelly-rotation-${entry.personnel}-${index}`}
                              className={`clickable-row ${editingKellyRotationIndex === index ? "clickable-row-selected" : ""}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setEditingKellyRotationIndex(index);
                                setKellyRotationDraft(entry);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setEditingKellyRotationIndex(index);
                                  setKellyRotationDraft(entry);
                                }
                              }}
                            >
                              <td>
                                <strong className="call-number-text">{entry.personnel || "—"}</strong>
                              </td>
                              <td>{entry.repeatsEveryValue} {entry.repeatsEveryUnit}</td>
                              <td>{entry.startsOn || "—"}</td>
                              <td>
                                <button
                                  type="button"
                                  className="secondary-button compact-button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setKellyRotations((previous) =>
                                      previous.filter((_, rotationIndex) => rotationIndex !== index),
                                    );
                                    if (editingKellyRotationIndex === index) {
                                      setEditingKellyRotationIndex(null);
                                      setKellyRotationDraft({
                                        personnel: "",
                                        repeatsEveryValue: 14,
                                        repeatsEveryUnit: "Shifts",
                                        startsOn: "",
                                      });
                                    }
                                    setAutoSaveTick((previous) => previous + 1);
                                    setStatusMessage("Auto-saved.");
                                  }}
                                >
                                  Remove
                                </button>
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
                {isUsersEditor
                  ? "User Entry"
                  : isSchedulerApparatusEditor
                    ? "Scheduler Apparatus Entry"
                  : isSchedulerPersonnelEditor
                    ? "Scheduler Personnel Entry"
                  : isApparatusEditor
                    ? "Apparatus Entry"
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
                <label>
                  Unit ID
                  <input type="text" value={apparatusDraft.unitId} onChange={(event) => setApparatusDraft((previous) => ({ ...previous, unitId: event.target.value }))} />
                </label>
                <label>
                  Common Name
                  <input type="text" value={apparatusDraft.commonName} onChange={(event) => setApparatusDraft((previous) => ({ ...previous, commonName: event.target.value }))} />
                </label>
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
                  Make
                  <input type="text" value={apparatusDraft.make} onChange={(event) => setApparatusDraft((previous) => ({ ...previous, make: event.target.value }))} />
                </label>
                <label>
                  Model
                  <input type="text" value={apparatusDraft.model} onChange={(event) => setApparatusDraft((previous) => ({ ...previous, model: event.target.value }))} />
                </label>
                <label>
                  Year
                  <input type="text" value={apparatusDraft.year} onChange={(event) => setApparatusDraft((previous) => ({ ...previous, year: event.target.value }))} />
                </label>
              </div>
            ) : null}

            {isSchedulerApparatusEditor ? (
              <div className="department-edit-grid">
                <label>
                  Apparatus
                  <input type="text" value={schedulerApparatusDraft.apparatus} readOnly />
                </label>
                <label>
                  Min Personnel
                  <input
                    type="number"
                    min={0}
                    value={schedulerApparatusDraft.minimumPersonnel}
                    onChange={(event) =>
                      setSchedulerApparatusDraft((previous) => ({
                        ...previous,
                        minimumPersonnel: Number.parseInt(event.target.value, 10) || 0,
                      }))
                    }
                  />
                </label>
                <label>
                  Max Personnel
                  <input
                    type="number"
                    min={1}
                    value={schedulerApparatusDraft.maximumPersonnel}
                    onChange={(event) =>
                      setSchedulerApparatusDraft((previous) => ({
                        ...previous,
                        maximumPersonnel: Number.parseInt(event.target.value, 10) || 1,
                      }))
                    }
                  />
                </label>
                <label>
                  Minimum Requirements (select all that apply)
                  <NerisFlatMultiOptionSelect
                    inputId="scheduler-apparatus-personnel-requirements"
                    value={schedulerApparatusDraft.personnelRequirements.join(",")}
                    options={personnelQualifications.map((q) => ({ value: q, label: q }))}
                    onChange={(nextValue) =>
                      setSchedulerApparatusDraft((previous) => ({
                        ...previous,
                        personnelRequirements: nextValue
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }))
                    }
                    placeholder="Select minimum requirement(s)"
                    searchPlaceholder="Search qualifications..."
                    maxSelections={
                      schedulerApparatusDraft.minimumPersonnel > 0
                        ? schedulerApparatusDraft.minimumPersonnel
                        : undefined
                    }
                    usePortal
                  />
                </label>
                <label>
                  Station
                  <NerisFlatSingleOptionSelect
                    inputId="scheduler-apparatus-station"
                    value={schedulerApparatusDraft.station}
                    options={stationNames.map((s) => ({ value: s, label: s }))}
                    onChange={(nextValue) =>
                      setSchedulerApparatusDraft((previous) => ({ ...previous, station: nextValue }))
                    }
                    placeholder="Select station"
                    searchPlaceholder="Search stations..."
                    allowClear
                    usePortal
                  />
                </label>
              </div>
            ) : null}

            {isUsersEditor ? (
              <div className="department-edit-grid">
                <label>
                  User Full Name
                  <input
                    type="text"
                    value={userDraft.name}
                    onChange={(event) =>
                      setUserDraft((previous) => ({ ...previous, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Username
                  <input
                    type="text"
                    value={userDraft.username}
                    onChange={(event) =>
                      setUserDraft((previous) => ({
                        ...previous,
                        username: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={userDraft.password}
                    onChange={(event) =>
                      setUserDraft((previous) => ({
                        ...previous,
                        password: event.target.value,
                      }))
                    }
                  />
                  <small className="field-hint">
                    Password policy: 8+ chars, uppercase, lowercase, number, and special character.
                  </small>
                </label>
                <label>
                  User Type
                  <select
                    value={userDraft.userType}
                    onChange={(event) =>
                      setUserDraft((previous) => ({ ...previous, userType: event.target.value }))
                    }
                  >
                    <option value="">Select user type</option>
                    {userTypeValues.map((option) => (
                      <option key={`user-user-type-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {isSchedulerPersonnelEditor ? (
              <div className="department-edit-grid">
                <label>
                  Personnel Name
                  <input type="text" value={personnelDraft.name} readOnly />
                </label>
                <label>
                  Shift
                  <select
                    value={personnelDraft.shift}
                    onChange={(event) =>
                      setPersonnelDraft((previous) => ({ ...previous, shift: event.target.value }))
                    }
                  >
                    <option value="">Select shift</option>
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
                    value={personnelDraft.apparatusAssignment}
                    onChange={(event) => {
                      const nextApparatus = event.target.value;
                      const matchedApparatus = schedulerApparatusRecords.find(
                        (a) => a.apparatus.trim() === nextApparatus,
                      );
                      const defaultStation = matchedApparatus?.station?.trim() ?? "";
                      setPersonnelDraft((previous) => ({
                        ...previous,
                        apparatusAssignment: nextApparatus,
                        station: defaultStation ? defaultStation : previous.station,
                      }));
                    }}
                  >
                    <option value="">Select apparatus</option>
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
                    value={personnelDraft.station}
                    options={stationNames.map((s) => ({ value: s, label: s }))}
                    onChange={(nextValue) => {
                      setPersonnelDraft((previous) => ({ ...previous, station: nextValue }));
                    }}
                    placeholder="Select station"
                    searchPlaceholder="Search stations..."
                    allowClear
                    usePortal
                  />
                </label>
                <label className="department-qualifications-field-label">
                  Qualifications (select all that apply)
                  <NerisFlatMultiOptionSelect
                    inputId="personnel-qualifications"
                    value={personnelDraft.qualifications.join(",")}
                    options={personnelQualifications.map((q) => ({ value: q, label: q }))}
                    onChange={(nextValue) => {
                      const arr = nextValue.split(",").map((s) => s.trim()).filter(Boolean);
                      setPersonnelDraft((previous) => ({ ...previous, qualifications: arr }));
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
                  } else if (isSchedulerApparatusEditor) {
                    saveSchedulerApparatusForm();
                  } else if (isUsersEditor) {
                    saveUserForm();
                  } else if (isSchedulerPersonnelEditor) {
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

      {isImportApparatusModalOpen ? (
        <div className="department-editor-backdrop" role="dialog" aria-modal="true">
          <article className="panel department-editor-modal">
            <div className="panel-header">
              <h2>Import Apparatus</h2>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => setIsImportApparatusModalOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="field-hint">
              Continue will import all Apparatus Common Names from Department Details into Scheduler Settings.
            </p>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Common Name</th>
                  </tr>
                </thead>
                <tbody>
                  {apparatusRecords.length === 0 ? (
                    <tr>
                      <td className="department-apparatus-empty">No apparatus available to import.</td>
                    </tr>
                  ) : (
                    apparatusRecords.map((entry, index) => (
                      <tr key={`import-apparatus-${index}-${entry.commonName}`}>
                        <td>{entry.commonName || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="department-editor-toolbar-actions">
              <button
                type="button"
                className="primary-button compact-button"
                onClick={importSchedulerApparatusFromDepartment}
                disabled={apparatusRecords.length === 0}
              >
                Continue
              </button>
            </div>
          </article>
        </div>
      ) : null}
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

function ProfileManagementPage({ username }: { username: string }) {
  const [accountUserId, setAccountUserId] = useState("");
  const [accountUsername, setAccountUsername] = useState(username);
  const [fullName, setFullName] = useState("Command User");
  const [email, setEmail] = useState("command@example.org");
  const [phone, setPhone] = useState("(555) 555-0191");
  const [message, setMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/users");
        if (!response.ok || !isMounted) {
          return;
        }
        const json = (await response.json()) as {
          ok?: boolean;
          users?: { id: string; username: string; name?: string }[];
        };
        if (!json?.ok || !Array.isArray(json.users) || !isMounted) {
          return;
        }
        const normalizedSessionUsername = username.trim().toLowerCase();
        const matched = json.users.find(
          (user) => user.username.trim().toLowerCase() === normalizedSessionUsername,
        );
        if (!matched) {
          return;
        }
        setAccountUserId(matched.id);
        setAccountUsername(matched.username);
        setFullName(String(matched.name ?? matched.username));
      } catch {
        // Keep defaults if profile lookup fails.
      }
    };
    void loadProfile();
    return () => {
      isMounted = false;
    };
  }, [username]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError("");
    setMessage("");
    const trimmedName = fullName.trim();
    if (!accountUserId) {
      setProfileError("Could not find the signed-in account. Log out and sign in again.");
      return;
    }
    if (!trimmedName) {
      setProfileError("Full Name is required.");
      return;
    }
    setIsSavingProfile(true);
    try {
      const response = await fetch(`/api/users/${accountUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !json?.ok) {
        setProfileError(json?.message ?? "Unable to save profile.");
        return;
      }
      setMessage("Profile saved.");
    } catch {
      setProfileError("Unable to reach profile service.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    const trimmedCurrent = currentPassword.trim();
    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmNewPassword.trim();
    if (!trimmedCurrent || !trimmedNew || !trimmedConfirm) {
      setPasswordError("Please complete all password fields.");
      return;
    }
    if (trimmedNew !== trimmedConfirm) {
      setPasswordError("New password and confirm password must match.");
      return;
    }
    if (trimmedNew.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (!/[a-z]/.test(trimmedNew)) {
      setPasswordError("Password must include at least one lowercase letter.");
      return;
    }
    if (!/[A-Z]/.test(trimmedNew)) {
      setPasswordError("Password must include at least one uppercase letter.");
      return;
    }
    if (!/[0-9]/.test(trimmedNew)) {
      setPasswordError("Password must include at least one number.");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(trimmedNew)) {
      setPasswordError("Password must include at least one special character.");
      return;
    }

    setIsSavingPassword(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: accountUsername || username,
          currentPassword: trimmedCurrent,
          newPassword: trimmedNew,
        }),
      });
      const json = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !json?.ok) {
        setPasswordError(json?.message ?? "Unable to update password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordMessage("Password updated.");
    } catch {
      setPasswordError("Unable to reach password service.");
    } finally {
      setIsSavingPassword(false);
    }
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

            <button type="submit" className="primary-button" disabled={isSavingProfile}>
              {isSavingProfile ? "Saving..." : "Save Profile"}
            </button>
            {profileError ? <p className="auth-error">{profileError}</p> : null}
            {message ? <p className="save-message">{message}</p> : null}
          </form>
        </article>
        <article className="panel">
          <form className="settings-form" onSubmit={handlePasswordSave}>
            <h2>Change Password</h2>
            <p className="field-hint">
              Account username: <strong>{accountUsername || username || "(unknown)"}</strong>
            </p>

            <label htmlFor="current-password">Current Password</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />

            <label htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />

            <label htmlFor="confirm-new-password">Confirm New Password</label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              autoComplete="new-password"
            />

            <p className="field-hint">
              Password policy: 8+ chars, uppercase, lowercase, number, and special character.
            </p>

            <button type="submit" className="primary-button" disabled={isSavingPassword}>
              {isSavingPassword ? "Updating..." : "Update Password"}
            </button>
            {passwordError ? <p className="auth-error">{passwordError}</p> : null}
            {passwordMessage ? <p className="save-message">{passwordMessage}</p> : null}
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
  incidentCalls,
  onCreateIncidentCall,
  onUpdateIncidentCall,
  onSetIncidentDeleted,
  workflowStates,
  onSaveWorkflowStates,
  incidentDisplaySettings,
  onSaveIncidentDisplaySettings,
  submenuVisibility,
  onSaveSubmenuVisibility,
  nerisExportSettings,
  onSaveNerisExportSettings,
  apparatusFromDepartmentDetails,
  nerisExportHistory,
  setNerisExportHistory,
}: RouteResolverProps) {
  const location = useLocation();
  const path = normalizePath(location.pathname);

  let content: React.ReactNode;

  if (path === "/") {
    content = <Navigate to="/dashboard" replace />;
  } else if (path === "/settings/profile") {
    content = <ProfileManagementPage username={username} />;
  } else if (path === "/settings/display") {
    content = <EditDisplayPage />;
  } else if (path === "/access-denied") {
    content = <AccessDeniedPage />;
  } else if (path === "/incidents") {
    content = <Navigate to="/incidents-mapping" replace />;
  } else if (path === "/incidents/dispatches") {
    content = <Navigate to="/incidents-mapping/incidents" replace />;
  } else if (path === "/incidents/map-view") {
    content = <Navigate to="/incidents-mapping/map-view" replace />;
  } else if (path === "/incidents/hydrants") {
    content = <Navigate to="/admin-functions/hydrants" replace />;
  } else if (role === "user" && isPathAdminOnly(path)) {
    content = <Navigate to="/access-denied" replace />;
  } else if (path === "/dashboard") {
    content = <DashboardPage role={role} submenuVisibility={submenuVisibility} />;
  } else if (path === "/incidents-mapping/incidents") {
    content = (
      <IncidentsListPage
        key={`incidents-list-${username}`}
        incidentDisplaySettings={incidentDisplaySettings}
        onSaveIncidentDisplaySettings={onSaveIncidentDisplaySettings}
        incidentCalls={incidentCalls}
        onCreateIncidentCall={onCreateIncidentCall}
      />
    );
  } else if (path.startsWith("/incidents-mapping/incidents/")) {
    const callNumber = decodeURIComponent(
      path.replace("/incidents-mapping/incidents/", ""),
    );
    content = (
      <IncidentCallDetailPage
        callNumber={callNumber}
        incidentCalls={incidentCalls}
        onUpdateIncidentCall={onUpdateIncidentCall}
        onSetIncidentDeleted={onSetIncidentDeleted}
      />
    );
  } else if (path === "/reporting/neirs") {
    content = <Navigate to="/reporting/neris" replace />;
  } else if (path.startsWith("/reporting/neirs/")) {
    const legacyReportId = decodeURIComponent(path.replace("/reporting/neirs/", ""));
    content = <Navigate to={`/reporting/neris/${encodeURIComponent(legacyReportId)}`} replace />;
  } else if (path === "/reporting/neris") {
    content = <NerisReportingPage incidentCalls={incidentCalls} />;
  } else if (path === "/reporting/neris/exports") {
    content = <NerisExportsPage incidentCalls={incidentCalls} exportHistory={nerisExportHistory} />;
  } else if (path.startsWith("/reporting/neris/exports/")) {
    const callNumber = decodeURIComponent(path.replace("/reporting/neris/exports/", ""));
    content = <NerisExportDetailsPage callNumber={callNumber} incidentCalls={incidentCalls} exportHistory={nerisExportHistory} />;
  } else if (path.startsWith("/reporting/neris/")) {
    const callNumber = decodeURIComponent(path.replace("/reporting/neris/", ""));
    content = (
      <NerisReportFormPage
        key={callNumber}
        callNumber={callNumber}
        role={role}
        username={username}
        incidentCalls={incidentCalls}
        onUpdateIncidentCall={onUpdateIncidentCall}
        nerisExportSettings={nerisExportSettings}
        apparatusFromDepartmentDetails={apparatusFromDepartmentDetails}
        exportHistory={nerisExportHistory}
        onExportRecordAdded={async (record) => {
          await postNerisExportRecord(record);
          const list = await getNerisExportHistory();
          setNerisExportHistory(list);
        }}
      />
    );
  } else if (path === "/admin-functions/department-details") {
    content = (
      <DepartmentDetailsPage
        mode="departmentDetails"
        incidentCalls={incidentCalls}
        onRestoreIncidentCall={(targetCallNumber) =>
          onSetIncidentDeleted(targetCallNumber, false)
        }
      />
    );
  } else if (path === "/admin-functions/scheduler-settings") {
    content = <DepartmentDetailsPage mode="schedulerSettings" />;
  } else if (path === "/admin-functions/personnel-management") {
    content = <DepartmentDetailsPage mode="personnelManagement" />;
  } else if (path === "/personnel/schedule") {
    content = <PersonnelSchedulePage />;
  } else if (path === "/admin-functions/hydrants") {
    content = <HydrantsAdminPage />;
  } else if (path === "/admin-functions/customization") {
    content = (
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
  } else {
    const menu = getMainMenuByPath(path);
    if (menu && path === menu.path) {
      content = (
        <MainMenuLandingPage
          menu={menu}
          role={role}
          submenuVisibility={submenuVisibility}
        />
      );
    } else {
      const submenu = getSubmenuByPath(path);
      content = submenu ? (
        <SubmenuPlaceholderPage submenu={submenu} /> 
      ) : (
        <NotFoundPage />
      );
    }
  }

  return (
    <div key={path} className="route-resolver-root">
      {content}
    </div>
  );
}

function App() {
  const [session, setSession] = useState<SessionState>(() => readSession());
  const [incidentCalls, setIncidentCalls] = useState<IncidentCallSummary[]>(() =>
    readIncidentQueue(),
  );

  useEffect(() => {
    if (!session.isAuthenticated) return;
    getIncidentList(false)
      .then((list) => {
        setIncidentCalls(list);
        writeIncidentQueue(list);
      })
      .catch(() => {
        setIncidentCalls(readIncidentQueue());
      });
  }, [session.isAuthenticated]);

  const [nerisExportHistory, setNerisExportHistory] = useState<NerisExportRecord[]>([]);
  const [nerisExportSettings, setNerisExportSettings] =
    useState<NerisExportSettings>(() => readNerisExportSettings());

  useEffect(() => {
    if (!session.isAuthenticated) return;
    getNerisExportHistory()
      .then((list) => setNerisExportHistory(list))
      .catch(() => setNerisExportHistory([]));
  }, [session.isAuthenticated]);

  useEffect(() => {
    if (!session.isAuthenticated || typeof window === "undefined") return;
    fetch("/api/department-details")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { ok?: boolean; data?: Record<string, unknown> } | null) => {
        if (json?.ok && json.data) {
          window.localStorage.setItem(DEPARTMENT_DETAILS_STORAGE_KEY, JSON.stringify(json.data));
        }
      })
      .catch(() => {});
  }, [session.isAuthenticated]);

  useEffect(() => {
    if (!session.isAuthenticated) return;
    getNerisSettings()
      .then((data) => {
        const merged = normalizeNerisExportSettings(data);
        setNerisExportSettings(merged);
        writeNerisExportSettings(merged);
      })
      .catch(() => {});
  }, [session.isAuthenticated]);

  const [workflowStates, setWorkflowStates] = useState<string[]>(() =>
    readWorkflowStates(),
  );
  const [incidentDisplaySettings, setIncidentDisplaySettings] =
    useState<IncidentDisplaySettings>(() => readIncidentDisplaySettings(session.username));
  const [submenuVisibility, setSubmenuVisibility] = useState<SubmenuVisibilityMap>(
    () => readSubmenuVisibility(),
  );

  const apparatusFromDepartmentDetails = useMemo(
    () => readApparatusFromDepartmentDetails(),
    [],
  );

  const handleLogin = async (
    department: string,
    username: string,
    password: string,
  ): Promise<string | null> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department, username, password }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        message?: string;
        user?: { name?: string; userType?: string; username?: string };
      };
      if (!response.ok || !json?.ok || !json.user) {
        return json?.message ?? "Login failed.";
      }
      const nextSession: SessionState = {
        isAuthenticated: true,
        username: String(json.user.username ?? username).trim(),
        unit: department || "",
        role: mapUserTypeToRole(String(json.user.userType ?? "")),
      };
      setSession(nextSession);
      setIncidentDisplaySettings(readIncidentDisplaySettings(nextSession.username));
      writeSession(nextSession);
      return null;
    } catch {
      return "Unable to reach login service.";
    }
  };

  const handleLogout = () => {
    setSession(EMPTY_SESSION);
    setIncidentDisplaySettings(readIncidentDisplaySettings(""));
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
    const normalized = normalizeIncidentDisplaySettings({
      ...nextSettings,
      callFieldWidths: nextSettings.callFieldWidths ?? incidentDisplaySettings.callFieldWidths,
    });
    if (!normalized.callFieldOrder.length) {
      return;
    }
    setIncidentDisplaySettings(normalized);
    writeIncidentDisplaySettings(normalized, session.username);
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
    patchNerisSettings(normalized)
      .then((data) => {
        const merged = normalizeNerisExportSettings(data);
        setNerisExportSettings(merged);
        writeNerisExportSettings(merged);
      })
      .catch(() => {});
  };

  const handleCreateIncidentCall = async (
    payload: IncidentCreatePayload,
  ): Promise<IncidentCallSummary> => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const receivedAt = `${hh}:${mm}:${ss}`;
    const body = {
      incidentNumber: payload.incident_internal_id.trim() || undefined,
      dispatchNumber: payload.dispatch_internal_id.trim() || undefined,
      incidentType: payload.incidentType.trim() || "New Incident",
      priority: payload.priority.trim() || "3",
      address: payload.address.trim() || "Update address",
      stillDistrict: payload.stillDistrict.trim() || "Update district",
      assignedUnits: payload.assignedUnits.join(", "),
      reportedBy: payload.reportedBy.trim() || undefined,
      callbackNumber: payload.callbackNumber.trim() || undefined,
      dispatchNotes: payload.dispatchNotes.trim() || undefined,
      currentState: payload.currentState.trim() || "Draft",
      receivedAt,
      dispatchInfo:
        payload.dispatchNotes.trim() ||
        "Manual incident created from Incidents / Mapping.",
    };
    const nextIncident = await createIncident(body);
    setIncidentCalls((previous) => {
      const deduped = previous.filter((entry) => entry.callNumber !== nextIncident.callNumber);
      const next = [nextIncident, ...deduped];
      writeIncidentQueue(next);
      return next;
    });
    return nextIncident;
  };

  const handleUpdateIncidentCall = useCallback(
    async (callNumber: string, patch: Partial<IncidentCallSummary>) => {
      const apiPatch = {
        incidentNumber: patch.incidentNumber ?? patch.incident_internal_id,
        dispatchNumber: patch.dispatchNumber ?? patch.dispatch_internal_id,
        incidentType: patch.incidentType,
        priority: patch.priority,
        address: patch.address,
        stillDistrict: patch.stillDistrict,
        assignedUnits: patch.assignedUnits,
        reportedBy: patch.reportedBy,
        callbackNumber: patch.callbackNumber,
        dispatchNotes:
          typeof patch.dispatchNotes === "string"
            ? patch.dispatchNotes
            : undefined,
        currentState: patch.currentState,
        dispatchInfo: patch.dispatchInfo,
      };
      try {
        const updated = await updateIncident(callNumber, apiPatch);
        setIncidentCalls((previous) => {
          const next = previous.map((entry) =>
            entry.callNumber === callNumber ? updated : entry,
          );
          writeIncidentQueue(next);
          return next;
        });
      } catch {
        const patchEntries = Object.entries(patch) as Array<[keyof IncidentCallSummary, unknown]>;
        setIncidentCalls((previous) => {
          let didChange = false;
          const next = previous.map((entry) => {
            if (entry.callNumber !== callNumber) return entry;
            const hasRealChange = patchEntries.some(
              ([key, value]) => value !== undefined && !Object.is(entry[key], value),
            );
            if (!hasRealChange) return entry;
            didChange = true;
            return {
              ...entry,
              ...patch,
              callNumber: entry.callNumber,
              lastUpdated: "Just now",
            };
          });
          if (!didChange) return previous;
          writeIncidentQueue(next);
          return next;
        });
      }
    },
    [],
  );

  const handleSetIncidentDeleted = async (
    callNumber: string,
    deleted: boolean,
    reason?: string,
  ) => {
    const actor = session.username.trim() || "unknown";
    if (deleted) {
      try {
        const updated = await deleteIncident(callNumber, {
          deletedBy: actor,
          deletedReason: reason?.trim() || "Deleted by user.",
        });
        setIncidentCalls((previous) => {
          const next = previous.map((entry) =>
            entry.callNumber === callNumber ? updated : entry,
          );
          writeIncidentQueue(next);
          return next;
        });
      } catch {
        const nowIso = new Date().toISOString();
        setIncidentCalls((previous) => {
          const next = previous.map((entry) => {
            if (entry.callNumber !== callNumber) return entry;
            return {
              ...entry,
              deletedAt: nowIso,
              deletedBy: actor,
              deletedReason: reason?.trim() || "Deleted by user.",
              lastUpdated: "Just now",
            };
          });
          writeIncidentQueue(next);
          return next;
        });
      }
    } else {
      try {
        const updated = await updateIncident(callNumber, { deletedAt: null });
        setIncidentCalls((previous) => {
          const next = previous.map((entry) =>
            entry.callNumber === callNumber
              ? { ...updated, deletedAt: undefined, deletedBy: undefined, deletedReason: undefined }
              : entry,
          );
          writeIncidentQueue(next);
          return next;
        });
      } catch {
        setIncidentCalls((previous) => {
          const next = previous.map((entry) => {
            if (entry.callNumber !== callNumber) return entry;
            return {
              ...entry,
              deletedAt: undefined,
              deletedBy: undefined,
              deletedReason: undefined,
              lastUpdated: "Just now",
            };
          });
          writeIncidentQueue(next);
          return next;
        });
      }
    }
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
                incidentCalls={incidentCalls}
                onCreateIncidentCall={handleCreateIncidentCall}
                onUpdateIncidentCall={handleUpdateIncidentCall}
                onSetIncidentDeleted={handleSetIncidentDeleted}
                workflowStates={workflowStates}
                onSaveWorkflowStates={handleSaveWorkflowStates}
                incidentDisplaySettings={incidentDisplaySettings}
                onSaveIncidentDisplaySettings={handleSaveIncidentDisplaySettings}
                submenuVisibility={submenuVisibility}
                onSaveSubmenuVisibility={handleSaveSubmenuVisibility}
                nerisExportSettings={nerisExportSettings}
                onSaveNerisExportSettings={handleSaveNerisExportSettings}
                apparatusFromDepartmentDetails={apparatusFromDepartmentDetails}
                nerisExportHistory={nerisExportHistory}
                setNerisExportHistory={setNerisExportHistory}
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

