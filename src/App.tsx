import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
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
  workflowStates: string[];
  onSaveWorkflowStates: (nextStates: string[]) => void;
  incidentDisplaySettings: IncidentDisplaySettings;
  onSaveIncidentDisplaySettings: (nextSettings: IncidentDisplaySettings) => void;
  submenuVisibility: SubmenuVisibilityMap;
  onSaveSubmenuVisibility: (nextVisibility: SubmenuVisibilityMap) => void;
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
}

interface CustomizationSectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
}

type DisplayCardConfig = Partial<Record<MainMenuId, string[]>>;
type SubmenuVisibilityMap = Record<string, boolean>;

const SESSION_STORAGE_KEY = "fire-ultimate-session";
const DISPLAY_CARD_STORAGE_KEY = "fire-ultimate-display-cards";
const WORKFLOW_STATE_STORAGE_KEY = "fire-ultimate-workflow-states";
const INCIDENT_DISPLAY_STORAGE_KEY = "fire-ultimate-incident-display";
const SUBMENU_VISIBILITY_STORAGE_KEY = "fire-ultimate-submenu-visibility";

const LEGACY_SESSION_STORAGE_KEYS = ["stationboss-mimic-session"] as const;
const LEGACY_DISPLAY_CARD_STORAGE_KEYS = ["stationboss-mimic-display-cards"] as const;
const LEGACY_WORKFLOW_STATE_STORAGE_KEYS = ["stationboss-mimic-workflow-states"] as const;
const LEGACY_INCIDENT_DISPLAY_STORAGE_KEYS = ["stationboss-mimic-incident-display"] as const;
const LEGACY_SUBMENU_VISIBILITY_STORAGE_KEYS = [
  "stationboss-mimic-submenu-visibility",
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
const DEFAULT_CALL_FIELD_WIDTHS: Record<IncidentCallFieldId, number> = {
  incidentType: 180,
  priority: 120,
  address: 360,
  assignedUnits: 230,
  status: 130,
  lastUpdated: 140,
};
const NERIS_QUEUE_FIELD_ORDER: IncidentCallFieldId[] = [...DEFAULT_INCIDENT_CALL_FIELD_ORDER];
const NERIS_REPORT_STATUS_BY_CALL: Record<string, string> = {
  "D-260218-101": "In Review",
  "D-260218-099": "Draft",
  "D-260218-094": "Ready for Review",
  "D-260218-089": "Draft",
  "D-260218-082": "Approved",
};

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
  const [expandedMenuId, setExpandedMenuId] = useState<MainMenuId | null>(
    "incidentsMapping",
  );

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

  return (
    <div className="shell-layout">
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
            <Shield size={18} />
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
    <section className="page-section">
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

type NerisGroupedOptionVariant = "incidentType" | "actionTactic";

const INCIDENT_TYPE_CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  HAZSIT: "HazMat",
  NOEMERG: "No Emergency",
  LAWENFORCE: "Law Enforcement",
  PUBSERV: "Public Service",
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
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const selectionLimitReached =
    mode === "multi" &&
    typeof maxSelections === "number" &&
    selectedValueSet.size >= maxSelections;

  const groupedOptions = useMemo(() => {
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

    return Array.from(categoryMap.entries()).map(([categoryKey, subgroupMap]) => ({
      categoryKey,
      categoryLabel: getNerisGroupedCategoryLabel(categoryKey, variant),
      optionCount: Array.from(subgroupMap.values()).reduce(
        (count, subgroupOptions) => count + subgroupOptions.length,
        0,
      ),
      subgroups: Array.from(subgroupMap.entries()).map(([subgroupKey, subgroupOptions]) => ({
        subgroupKey,
        subgroupLabel: getNerisGroupedSubgroupLabel(categoryKey, subgroupKey, variant),
        options: subgroupOptions,
      })),
    }));
  }, [options, normalizedSearch, variant]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    searchInputRef.current?.focus();
  }, [isOpen]);

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
        className="neris-incident-type-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((previous) => !previous);
          if (isOpen) {
            setSearchTerm("");
          }
        }}
      >
        {mode === "single" ? (
          <span
            className={
              selectedOptions.length === 0 && placeholder && placeholder.length > 0
                ? "neris-incident-type-placeholder"
                : undefined
            }
          >
            {selectedOption?.label ?? (placeholder && placeholder.length > 0 ? placeholder : "\u00A0")}
          </span>
        ) : (
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
        )}
        <ChevronDown
          size={15}
          className={`neris-incident-type-trigger-icon${isOpen ? " open" : ""}`}
        />
      </button>

      {isOpen ? (
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

                    {!categoryCollapsed
                      ? category.subgroups.map((subgroup) => {
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
                        })
                      : null}
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
}

function NerisFlatMultiOptionSelect({
  inputId,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
}: NerisFlatMultiOptionSelectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    searchInputRef.current?.focus();
  }, [isOpen]);

  return (
    <div className="neris-incident-type-select" ref={containerRef}>
      <button
        id={inputId}
        type="button"
        className="neris-incident-type-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
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

      {isOpen ? (
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
          <div className="neris-incident-type-options-scroll" role="listbox">
            {filteredOptions.length ? (
              <div className="neris-incident-type-item-list">
                {filteredOptions.map((option) => {
                  const isSelected = selectedValueSet.has(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`neris-incident-type-item${isSelected ? " selected" : ""}`}
                      aria-selected={isSelected}
                      onClick={() => {
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
      ) : null}
    </div>
  );
}

function NerisReportFormPage({ callNumber }: NerisReportFormPageProps) {
  const navigate = useNavigate();
  const detail = getIncidentCallDetail(callNumber);
  const [activeSectionId, setActiveSectionId] = useState<NerisSectionId>("core");
  const [reportStatus, setReportStatus] = useState<string>(() =>
    getNerisReportStatus(callNumber),
  );
  const [formValues, setFormValues] = useState<NerisFormValues>(() =>
    createDefaultNerisFormValues({
      callNumber,
      incidentType: detail?.incidentType,
      receivedAt: detail?.receivedAt,
      address: detail?.address,
    }),
  );
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState("Not saved");
  const [fieldOptionFilters, setFieldOptionFilters] = useState<Record<string, string>>({});

  const currentSection =
    NERIS_FORM_SECTIONS.find((section) => section.id === activeSectionId) ??
    NERIS_FORM_SECTIONS[0];
  const sectionFields = useMemo(
    () => getNerisFieldsForSection(activeSectionId),
    [activeSectionId],
  );
  const sectionIndex = NERIS_FORM_SECTIONS.findIndex(
    (section) => section.id === activeSectionId,
  );
  const hasNextSection = sectionIndex < NERIS_FORM_SECTIONS.length - 1;
  const reportStatusOptions = useMemo(
    () => getNerisValueOptions("report_status"),
    [],
  );

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

  const updateFieldValue = (fieldId: string, value: string) => {
    setFormValues((previous) => ({
      ...previous,
      [fieldId]: value,
    }));
    setSectionErrors((previous) => {
      if (!previous[fieldId]) {
        return previous;
      }
      const next = { ...previous };
      delete next[fieldId];
      return next;
    });
    setSaveMessage("");
    setErrorMessage("");
  };

  const validateCurrentSection = (): boolean => {
    const result = validateNerisSection(activeSectionId, formValues);
    setSectionErrors(result.errors);
    if (!result.isValid) {
      setSaveMessage("");
      setErrorMessage("Complete required fields before continuing.");
    } else {
      setErrorMessage("");
    }
    return result.isValid;
  };

  const handleSaveDraft = () => {
    if (!validateCurrentSection()) {
      return;
    }
    const savedAt = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    setLastSavedAt(savedAt);
    setSaveMessage(`Draft saved for ${detail.callNumber} at ${savedAt}.`);
  };

  const goToNextSection = () => {
    if (!validateCurrentSection()) {
      return;
    }
    if (!hasNextSection) {
      return;
    }
    const nextSection = NERIS_FORM_SECTIONS[sectionIndex + 1];
    if (nextSection) {
      setActiveSectionId(nextSection.id);
    }
  };

  const handleBack = () => {
    if (sectionIndex > 0) {
      const previousSection = NERIS_FORM_SECTIONS[sectionIndex - 1];
      if (previousSection) {
        setActiveSectionId(previousSection.id);
      }
      return;
    }
    navigate("/reporting/neris");
  };

  const renderNerisField = (field: NerisFieldMetadata) => {
    const inputId = `neris-field-${field.id}`;
    const value = formValues[field.id] ?? "";
    const isRequired = isNerisFieldRequired(field, formValues);
    const options = field.optionsKey ? getNerisValueOptions(field.optionsKey) : [];
    const error = sectionErrors[field.id];
    const wrapperClassName = field.layout === "full" ? "field-span-two" : undefined;
    const selectedValues = value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const normalizedSingleValue = normalizeNerisEnumValue(value);
    const normalizedSelectedValues = selectedValues.map((entry) =>
      normalizeNerisEnumValue(entry),
    );
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
    const shouldShowTypeahead =
      (field.inputKind === "select" || field.inputKind === "multiselect") &&
      options.length > 10 &&
      !isPrimaryIncidentTypeField &&
      !isAdditionalIncidentTypesField &&
      !isActionsTakenField &&
      !isSpecialIncidentModifiersField;
    const optionFilter = fieldOptionFilters[field.id] ?? "";
    const normalizedFilter = optionFilter.trim().toLowerCase();
    const filteredOptions =
      shouldShowTypeahead && normalizedFilter
        ? options.filter(
            (option) =>
              option.label.toLowerCase().includes(normalizedFilter) ||
              option.value.toLowerCase().includes(normalizedFilter),
          )
        : options;

    return (
      <div key={field.id} className={wrapperClassName}>
        <label htmlFor={inputId}>
          {field.label}
          {isRequired ? " *" : ""}
        </label>

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

        {field.inputKind === "select" ? (
          isPrimaryIncidentTypeField ? (
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
          ) : (
            <>
              {shouldShowTypeahead ? (
                <input
                  type="text"
                  className="field-typeahead-input"
                  value={optionFilter}
                  placeholder={`Filter ${field.label.toLowerCase()}...`}
                  onChange={(event) =>
                    setFieldOptionFilters((previous) => ({
                      ...previous,
                      [field.id]: event.target.value,
                    }))
                  }
                />
              ) : null}
              <select
                id={inputId}
                value={normalizedSingleValue}
                onChange={(event) => updateFieldValue(field.id, event.target.value)}
              >
                {!isRequired ? <option value="">Select an option</option> : null}
                {filteredOptions.map((option) => (
                  <option key={`${field.id}-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
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
            />
          ) : (
            <>
              {shouldShowTypeahead ? (
                <input
                  type="text"
                  className="field-typeahead-input"
                  value={optionFilter}
                  placeholder={`Filter ${field.label.toLowerCase()}...`}
                  onChange={(event) =>
                    setFieldOptionFilters((previous) => ({
                      ...previous,
                      [field.id]: event.target.value,
                    }))
                  }
                />
              ) : null}
              <select
                id={inputId}
                multiple
                className="neris-multiselect"
                value={normalizedSelectedValues}
                onChange={(event) =>
                  updateFieldValue(
                    field.id,
                    Array.from(event.target.selectedOptions)
                      .map((option) => option.value)
                      .join(","),
                  )
                }
              >
                {filteredOptions.map((option) => (
                  <option key={`${field.id}-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
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
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button compact-button">
            Import
          </button>
          <button type="button" className="secondary-button compact-button">
            CAD notes
          </button>
          <button type="button" className="secondary-button compact-button">
            Print
          </button>
          <select
            className="neris-status-select"
            aria-label="NERIS report status"
            value={reportStatus}
            onChange={(event) => setReportStatus(event.target.value)}
          >
            {reportStatusOptions.map((option) => (
              <option key={`report-status-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="neris-report-layout">
        <aside className="panel neris-sidebar">
          <div className="neris-sidebar-header">
            <h2>Fire Incidents</h2>
            <p>NERIS sections</p>
          </div>
          <nav className="neris-section-nav" aria-label="NERIS section navigation">
            {NERIS_FORM_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={section.id === activeSectionId ? "active" : ""}
                onClick={() => setActiveSectionId(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        <article className="panel neris-form-panel">
          <div className="panel-header">
            <h2>{currentSection.label}</h2>
          </div>
          <p className="panel-description">{currentSection.helper}</p>
          <div className="settings-form neris-field-grid">
            {sectionFields.map((field) => renderNerisField(field))}
          </div>

          {saveMessage ? <p className="save-message">{saveMessage}</p> : null}
          {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

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

    onSaveWorkflowStates(normalizedStates);
    onSaveIncidentDisplaySettings(normalizedIncidentSettings);
    onSaveSubmenuVisibility(normalizedSubmenuVisibility);

    setIncidentSettingsDraft(normalizedIncidentSettings);
    setSubmenuVisibilityDraft(normalizedSubmenuVisibility);
    setErrorMessage("");
    setSavedMessage(
      "Customization saved. Incident display, submenu visibility, and workflow states updated.",
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
              and parsing setup.
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
  workflowStates,
  onSaveWorkflowStates,
  incidentDisplaySettings,
  onSaveIncidentDisplaySettings,
  submenuVisibility,
  onSaveSubmenuVisibility,
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

  if (path.startsWith("/reporting/neris/")) {
    const callNumber = decodeURIComponent(path.replace("/reporting/neris/", ""));
    return <NerisReportFormPage key={callNumber} callNumber={callNumber} />;
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
                workflowStates={workflowStates}
                onSaveWorkflowStates={handleSaveWorkflowStates}
                incidentDisplaySettings={incidentDisplaySettings}
                onSaveIncidentDisplaySettings={handleSaveIncidentDisplaySettings}
                submenuVisibility={submenuVisibility}
                onSaveSubmenuVisibility={handleSaveSubmenuVisibility}
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

