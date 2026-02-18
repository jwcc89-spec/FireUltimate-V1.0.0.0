import { type FormEvent, useMemo, useState } from "react";
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
  DASHBOARD_ALERTS,
  DASHBOARD_PRIORITY_LINKS,
  DASHBOARD_STATS,
  DEFAULT_DISPATCH_WORKFLOW_STATES,
  HYDRANT_ADMIN_TABLE_ROWS,
  INCIDENT_CALLS,
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
  type MainMenu,
  type MainMenuId,
  type NavSubmenu,
  type Tone,
  type UserRole,
} from "./appData";

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
}

interface RouteResolverProps {
  role: UserRole;
  workflowStates: string[];
  onSaveWorkflowStates: (nextStates: string[]) => void;
}

interface MainMenuLandingPageProps {
  menu: MainMenu;
  role: UserRole;
}

interface SubmenuPlaceholderPageProps {
  submenu: NavSubmenu;
}

interface IncidentsListPageProps {
  workflowStates: string[];
}

interface IncidentCallDetailPageProps {
  callNumber: string;
  workflowStates: string[];
}

interface MenuDisplayCardsProps {
  menu: MainMenu;
  role: UserRole;
}

interface CustomizationPageProps {
  workflowStates: string[];
  onSaveWorkflowStates: (nextStates: string[]) => void;
}

type DisplayCardConfig = Partial<Record<MainMenuId, string[]>>;

const SESSION_STORAGE_KEY = "stationboss-mimic-session";
const DISPLAY_CARD_STORAGE_KEY = "stationboss-mimic-display-cards";
const WORKFLOW_STATE_STORAGE_KEY = "stationboss-mimic-workflow-states";

const EMPTY_SESSION: SessionState = {
  isAuthenticated: false,
  username: "",
  unit: "",
  role: "user",
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

function dedupeAndCleanStates(states: string[]): string[] {
  const cleaned = states
    .map((state) => state.trim())
    .filter((state) => state.length > 0);
  return Array.from(new Set(cleaned));
}

function readSession(): SessionState {
  if (typeof window === "undefined") {
    return EMPTY_SESSION;
  }

  const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY);
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
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function readDisplayCardConfig(): DisplayCardConfig {
  if (typeof window === "undefined") {
    return {};
  }

  const rawValue = window.localStorage.getItem(DISPLAY_CARD_STORAGE_KEY);
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
  window.localStorage.setItem(DISPLAY_CARD_STORAGE_KEY, JSON.stringify(config));
}

function readWorkflowStates(): string[] {
  if (typeof window === "undefined") {
    return [...DEFAULT_DISPATCH_WORKFLOW_STATES];
  }

  const rawValue = window.localStorage.getItem(WORKFLOW_STATE_STORAGE_KEY);
  if (!rawValue) {
    return [...DEFAULT_DISPATCH_WORKFLOW_STATES];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_DISPATCH_WORKFLOW_STATES];
    }
    const cleaned = dedupeAndCleanStates(parsed.filter((item) => typeof item === "string"));
    return cleaned.length ? cleaned : [...DEFAULT_DISPATCH_WORKFLOW_STATES];
  } catch {
    return [...DEFAULT_DISPATCH_WORKFLOW_STATES];
  }
}

function writeWorkflowStates(states: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(WORKFLOW_STATE_STORAGE_KEY, JSON.stringify(states));
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
      setErrorMessage("Please provide username, unit, and secure pin.");
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
          <span>Station Boss Prototype</span>
        </div>
        <h1>Incident-focused workspace with mapping and admin controls</h1>
        <p>
          This phase adds a clickable incident call workflow, per-menu card display
          customization, and configurable dispatch states in Admin Functions.
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
              <h2>Sign in to Station Boss</h2>
              <p>Simple login mode remains active for this prototype.</p>
            </div>
          </div>

          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="CIFPD"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />

          <label htmlFor="unit">Unit</label>
          <input
            id="unit"
            name="unit"
            type="text"
            inputMode="numeric"
            placeholder="100"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          />

          <label htmlFor="pin">Secure Pin</label>
          <input
            id="pin"
            name="pin"
            type="password"
            autoComplete="current-password"
            placeholder="3799"
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
  const [expandedMenus, setExpandedMenus] = useState<Record<MainMenuId, boolean>>(
    () =>
      Object.fromEntries(
        MAIN_MENUS.map((menu) => [menu.id, menu.id === "incidentsMapping"]),
      ) as Record<MainMenuId, boolean>,
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
            <strong>Station Boss</strong>
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
            const isExpanded = hasSubmenus && (expandedMenus[menu.id] || isMenuRoute);

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
                    onClick={handleNavClick}
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
                        setExpandedMenus((previous) => ({
                          ...previous,
                          [menu.id]: !isExpanded,
                        }))
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
                        onClick={handleNavClick}
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
                <strong>{session.username}</strong>
                <span>
                  Unit {session.unit} | {dateLabel}
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

function MenuDisplayCards({ menu, role }: MenuDisplayCardsProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [displayConfig, setDisplayConfig] = useState<DisplayCardConfig>(() =>
    readDisplayCardConfig(),
  );

  const defaultCards = useMemo(
    () =>
      menu.submenus.filter((submenu) => role === "admin" || !submenu.adminOnly),
    [menu, role],
  );
  const defaultPathSet = useMemo(
    () => new Set<string>(defaultCards.map((submenu) => submenu.path)),
    [defaultCards],
  );
  const selectableOptions = useMemo(() => getDisplayCardOptions(role), [role]);
  const selectableMap = useMemo(
    () => new Map<string, DisplayCardOption>(selectableOptions.map((option) => [option.path, option])),
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
                          {option.label}{" "}
                          <em>({option.parentMenuTitle})</em>
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
            <NavLink key={`${menu.id}-${card.path}`} to={card.path} className="submenu-card submenu-card-link">
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
              <span className="submenu-card-origin">
                {card.parentMenuTitle}
              </span>
            </NavLink>
          ))}
        </section>
      ) : (
        <p className="panel-description">
          This menu currently has no default submenu cards. Use{" "}
          <strong>Edit display</strong> to add cards from other menus.
        </p>
      )}
    </section>
  );
}

function DashboardPage({ role }: DashboardPageProps) {
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

      {dashboardMenu ? <MenuDisplayCards menu={dashboardMenu} role={role} /> : null}
    </section>
  );
}

function IncidentsListPage({ workflowStates }: IncidentsListPageProps) {
  const navigate = useNavigate();

  const openCallDetail = (callNumber: string) => {
    navigate(`/incidents-mapping/incidents/${encodeURIComponent(callNumber)}`);
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Incidents / Mapping | Incidents</h1>
          <p>
            Click any call row to open full incident details, map view, apparatus,
            and dispatch notes.
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

      <section className="stat-grid">
        {INCIDENT_QUEUE_STATS.map((stat) => (
          <article key={stat.label} className="stat-card">
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <span className={toToneClass(stat.tone)}>{stat.detail}</span>
          </article>
        ))}
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Incident Calls</h2>
            <span className="panel-caption">
              Fields shown: Call # and associated Dispatch Information
            </span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Call #</th>
                  <th>Dispatch Information</th>
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
                        <span>{call.dispatchInfo}</span>
                        <div className="dispatch-info-meta">
                          <span className={toToneClass(toneFromState(call.currentState))}>
                            {call.currentState}
                          </span>
                          <small>Updated {call.lastUpdated}</small>
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
            the dispatch center enters new information.
          </p>
        </article>
      </section>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Configured Workflow States</h2>
            <span className="panel-caption">Admin customizable</span>
          </div>
          <ul className="workflow-chip-list">
            {workflowStates.map((state) => (
              <li key={state} className="workflow-chip">
                {state}
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Next Build Focus</h2>
          </div>
          <ul className="activity-list">
            <li>Dispatch center API ingestion for automatic incident updates</li>
            <li>Map marker overlays tied to incident and hydrant data</li>
            <li>Role-level permissions for create/edit call operations</li>
            <li>Audit history for incident and note updates</li>
          </ul>
        </article>
      </section>
    </section>
  );
}

function IncidentCallDetailPage({
  callNumber,
  workflowStates,
}: IncidentCallDetailPageProps) {
  const detail = getIncidentCallDetail(callNumber);
  const normalizedStates = workflowStates.length
    ? workflowStates
    : [...DEFAULT_DISPATCH_WORKFLOW_STATES];

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

  const activeWorkflowIndex = normalizedStates.findIndex(
    (state) => state.toLowerCase() === detail.currentState.toLowerCase(),
  );

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

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Call Information</h2>
            <span className={toToneClass(toneFromState(detail.currentState))}>
              {detail.currentState}
            </span>
          </div>
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
              <dt>Address</dt>
              <dd>{detail.address}</dd>
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
              <dt>Received At</dt>
              <dd>{detail.receivedAt}</dd>
            </div>
            <div>
              <dt>Last Updated</dt>
              <dd>{detail.lastUpdated}</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Dispatch Workflow</h2>
            <span className="panel-caption">Configured in Admin Functions</span>
          </div>
          <ul className="workflow-track">
            {normalizedStates.map((state, index) => {
              const isActive = index === activeWorkflowIndex;
              const isComplete =
                activeWorkflowIndex >= 0 && index <= activeWorkflowIndex;
              return (
                <li
                  key={`${detail.callNumber}-${state}`}
                  className={`workflow-step ${isActive ? "active" : ""} ${
                    isComplete ? "complete" : ""
                  }`}
                >
                  <span>{state}</span>
                </li>
              );
            })}
          </ul>
        </article>
      </section>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Live Map</h2>
            <span className="panel-caption">Prepared for GIS/API integration</span>
          </div>
          <div className="dispatch-map-placeholder">
            <p>
              Live map surface for this incident. Future integration will stream
              unit locations, route updates, hydrants, and map markers in real-time.
            </p>
            <ul>
              <li>Current incident pin: {detail.address}</li>
              <li>Nearest hydrants and out-of-service hydrant warnings</li>
              <li>Map marker overlays from Incident / Mapping settings</li>
            </ul>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Apparatus Responding</h2>
            <span className="panel-caption">Live response assignment view</span>
          </div>
          <ul className="unit-status-list">
            {detail.apparatus.map((item) => (
              <li key={`${detail.callNumber}-${item.unit}`}>
                <div>
                  <strong>
                    {item.unit} ({item.unitType})
                  </strong>
                  <p>
                    Crew: {item.crew} | ETA: {item.eta}
                  </p>
                </div>
                <span className={toToneClass(toneFromState(item.status))}>
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
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
              <li key={`${detail.callNumber}-${note.time}-${note.source}`}>
                <div>
                  <strong>
                    {note.time} | {note.source}
                  </strong>
                  <p>{note.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
}

function MainMenuLandingPage({ menu, role }: MainMenuLandingPageProps) {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{menu.title}</h1>
          <p>{menu.summary}</p>
        </div>
      </header>

      <MenuDisplayCards menu={menu} role={role} />
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

function CustomizationPage({
  workflowStates,
  onSaveWorkflowStates,
}: CustomizationPageProps) {
  const [organizationName, setOrganizationName] = useState("CIFPD");
  const [primaryColor, setPrimaryColor] = useState("#1d4ed8");
  const [accentColor, setAccentColor] = useState("#0891b2");
  const [logoFileName, setLogoFileName] = useState("No file selected");
  const [workflowDraft, setWorkflowDraft] = useState<string[]>(() => [...workflowStates]);
  const [newState, setNewState] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedStates = dedupeAndCleanStates(workflowDraft);

    if (!normalizedStates.length) {
      setErrorMessage("Add at least one workflow state before saving.");
      setSavedMessage("");
      return;
    }

    onSaveWorkflowStates(normalizedStates);
    setWorkflowDraft(normalizedStates);
    setErrorMessage("");
    setSavedMessage(
      "Customization saved. Dispatch workflow states updated successfully.",
    );
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Admin Functions | Customization</h1>
          <p>
            Configure branding and dispatch workflow states for organization setup.
          </p>
        </div>
      </header>

      <form className="panel-grid two-column" onSubmit={handleSave}>
        <article className="panel">
          <div className="panel-header">
            <h2>Branding Controls</h2>
          </div>
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
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Dispatch Workflow States</h2>
            <button type="button" className="link-button" onClick={resetWorkflowStates}>
              Reset to default
            </button>
          </div>

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
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Preview</h2>
          </div>
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
              Branding preview only. Future backend integration will persist these
              choices per organization.
            </p>
            <ul className="workflow-chip-list">
              {workflowDraft.map((state) => (
                <li key={`preview-${state}`} className="workflow-chip">
                  {state}
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Save Configuration</h2>
          </div>
          <div className="settings-form">
            <button type="submit" className="primary-button">
              Save Customization
            </button>
            {savedMessage ? <p className="save-message">{savedMessage}</p> : null}
            {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}
          </div>
        </article>
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
    return <DashboardPage role={role} />;
  }

  if (path === "/incidents-mapping/incidents") {
    return <IncidentsListPage workflowStates={workflowStates} />;
  }

  if (path.startsWith("/incidents-mapping/incidents/")) {
    const callNumber = decodeURIComponent(
      path.replace("/incidents-mapping/incidents/", ""),
    );
    return (
      <IncidentCallDetailPage
        callNumber={callNumber}
        workflowStates={workflowStates}
      />
    );
  }

  if (path === "/admin-functions/hydrants") {
    return <HydrantsAdminPage />;
  }

  if (path === "/admin-functions/customization") {
    return (
      <CustomizationPage
        workflowStates={workflowStates}
        onSaveWorkflowStates={onSaveWorkflowStates}
      />
    );
  }

  const menu = getMainMenuByPath(path);
  if (menu && path === menu.path) {
    return <MainMenuLandingPage menu={menu} role={role} />;
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
    const normalized = dedupeAndCleanStates(nextStates);
    if (!normalized.length) {
      return;
    }
    setWorkflowStates(normalized);
    writeWorkflowStates(normalized);
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
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

