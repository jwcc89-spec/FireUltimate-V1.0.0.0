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
  DISPATCH_ACTIVITY,
  DISPATCH_ALERTS,
  DISPATCH_STATS,
  DISPATCH_TABLE_COLUMNS,
  DISPATCH_TABLE_ROWS,
  DISPATCH_UNIT_STATUSES,
  MAIN_MENUS,
  SUBMENU_PLACEHOLDER_NOTES,
  getDefaultPathForRole,
  getMainMenuByPath,
  getSubmenuByPath,
  getVisibleMenus,
  isPathAdminOnly,
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
}

interface MainMenuLandingPageProps {
  menu: MainMenu;
  role: UserRole;
}

interface SubmenuPlaceholderPageProps {
  submenu: NavSubmenu;
}

const SESSION_STORAGE_KEY = "stationboss-mimic-session";

const EMPTY_SESSION: SessionState = {
  isAuthenticated: false,
  username: "",
  unit: "",
  role: "user",
};

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

function normalizePath(pathname: string): string {
  if (pathname === "/") {
    return pathname;
  }
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function toToneClass(tone: Tone): string {
  return `tone tone-${tone}`;
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
        <h1>Station operations workspace with role-based access</h1>
        <p>
          Version 2 uses your new condensed menu structure and includes a
          built-out Dispatches module under Incidents. All additional submenus
          are connected and ready for incremental build-out.
        </p>
        <ul className="brand-feature-list">
          <li>Simple login with Admin and User roles</li>
          <li>User role can access all modules except Admin Functions</li>
          <li>Settings menu includes profile, display, and logout actions</li>
        </ul>
      </section>

      <section className="auth-form-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-header">
            <ShieldCheck size={24} />
            <div>
              <h2>Sign in to Station Boss</h2>
              <p>Simple login mode is enabled for this prototype.</p>
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
        MAIN_MENUS.map((menu) => [menu.id, menu.id === "incidents"]),
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
    () => getSubmenuByPath(location.pathname),
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

function DashboardPage({ role }: DashboardPageProps) {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            Current status across dispatch activity, readiness, and high-priority
            updates.
          </p>
        </div>
        <div className="header-actions">
          <NavLink className="secondary-button button-link" to="/calendar/events">
            Open Calendar
          </NavLink>
          <NavLink className="primary-button button-link" to="/incidents/dispatches">
            Open Dispatches
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
                : "Admin-only links will show access denial"}
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
    </section>
  );
}

function DispatchesPage() {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Incidents | Dispatches</h1>
          <p>
            Primary dispatch workspace with live call queue, unit status, and
            incident alerts.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button">
            Export Dispatch Log
          </button>
          <button type="button" className="primary-button">
            Create Dispatch
          </button>
        </div>
      </header>

      <section className="stat-grid">
        {DISPATCH_STATS.map((stat) => (
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
            <h2>Active Dispatch Queue</h2>
            <span className="panel-caption">Live call board</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {DISPATCH_TABLE_COLUMNS.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DISPATCH_TABLE_ROWS.map((row) => (
                  <tr key={row.join("-")}>
                    {row.map((cell) => (
                      <td key={cell}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Unit Status</h2>
            <span className="panel-caption">Current assignments</span>
          </div>
          <ul className="unit-status-list">
            {DISPATCH_UNIT_STATUSES.map((entry) => (
              <li key={`${entry.unit}-${entry.assignment}`}>
                <div>
                  <strong>{entry.unit}</strong>
                  <p>
                    {entry.type} | Assignment: {entry.assignment}
                  </p>
                </div>
                <span className={toToneClass(entry.tone)}>{entry.status}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Map View (Dispatch Zone)</h2>
            <span className="panel-caption">UI placeholder for map integration</span>
          </div>
          <div className="dispatch-map-placeholder">
            <p>
              This map pane is prepared for future dispatch center API and GIS
              integration.
            </p>
            <ul>
              <li>Incident markers by priority and response state</li>
              <li>Unit movement overlays and hydrant proximity</li>
              <li>Boundary layers for first-due and mutual aid zones</li>
            </ul>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Dispatch Alerts</h2>
            <span className="panel-caption">Critical watch list</span>
          </div>
          <ul className="timeline-list">
            {DISPATCH_ALERTS.map((alert) => (
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

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Dispatch Activity</h2>
            <span className="panel-caption">Latest updates</span>
          </div>
          <ul className="activity-list">
            {DISPATCH_ACTIVITY.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Integration Notes</h2>
            <span className="panel-caption">Next technical milestone</span>
          </div>
          <div className="integration-note">
            <p>
              This module is structured to receive live dispatch center data via
              API in a later phase.
            </p>
            <ol>
              <li>Create inbound endpoint mappings for call and unit payloads.</li>
              <li>Authenticate and validate inbound CAD relay requests.</li>
              <li>Normalize incident types to your in-app category schema.</li>
              <li>Stream status updates into this queue and map in real-time.</li>
            </ol>
          </div>
        </article>
      </section>
    </section>
  );
}

function MainMenuLandingPage({ menu, role }: MainMenuLandingPageProps) {
  const visibleSubmenus = menu.submenus.filter(
    (submenu) => role === "admin" || !submenu.adminOnly,
  );

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{menu.title}</h1>
          <p>{menu.summary}</p>
        </div>
      </header>

      {visibleSubmenus.length ? (
        <section className="submenu-card-grid">
          {visibleSubmenus.map((submenu) => (
            <article key={submenu.path} className="submenu-card">
              <div className="submenu-card-header">
                <h2>{submenu.label}</h2>
                <span
                  className={`build-status ${
                    submenu.isBuilt ? "build-ready" : "build-planned"
                  }`}
                >
                  {submenu.isBuilt ? "Built" : "Scaffolded"}
                </span>
              </div>
              <p>{submenu.summary}</p>
              <NavLink className="secondary-button button-link compact" to={submenu.path}>
                Open submenu
              </NavLink>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel-grid">
          <article className="panel">
            <p className="panel-description">
              This module currently has no submenu and can be expanded directly
              on this page as requirements evolve.
            </p>
          </article>
        </section>
      )}
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
              ? "This submenu includes an initial functional UI."
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

function TrainingPage() {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Training</h1>
          <p>
            Training currently has no submenu and can be expanded with course
            tracking, simulator records, and completion workflows.
          </p>
        </div>
      </header>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Suggested Training Features</h2>
          </div>
          <ul className="activity-list">
            <li>Training calendar and attendance capture</li>
            <li>Skill sign-off workflows by rank and role</li>
            <li>Certification-linked training recommendations</li>
            <li>Document and scenario library for drills</li>
          </ul>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Current Mode</h2>
          </div>
          <p className="panel-description">
            UI scaffold only. Ready for detailed requirements and field mapping.
          </p>
        </article>
      </section>
    </section>
  );
}

function CustomizationPage() {
  const [organizationName, setOrganizationName] = useState("CIFPD");
  const [primaryColor, setPrimaryColor] = useState("#1d4ed8");
  const [accentColor, setAccentColor] = useState("#0891b2");
  const [logoFileName, setLogoFileName] = useState("No file selected");
  const [savedMessage, setSavedMessage] = useState("");

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavedMessage(
      "Customization preferences saved locally in this prototype view.",
    );
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Admin Functions | Customization</h1>
          <p>
            Configure branding options so agencies can upload a logo and choose
            color themes.
          </p>
        </div>
      </header>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Branding Controls</h2>
          </div>
          <form className="settings-form" onSubmit={handleSave}>
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
                setLogoFileName(
                  event.target.files?.[0]?.name ?? "No file selected",
                )
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

            <button type="submit" className="primary-button">
              Save Customization
            </button>
            {savedMessage ? <p className="save-message">{savedMessage}</p> : null}
          </form>
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
              Preview only. In a future phase this will persist to organization
              settings and update the full application theme.
            </p>
          </div>
        </article>
      </section>
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

function RouteResolver({ role }: RouteResolverProps) {
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

  if (role === "user" && isPathAdminOnly(path)) {
    return <Navigate to="/access-denied" replace />;
  }

  if (path === "/dashboard") {
    return <DashboardPage role={role} />;
  }

  if (path === "/training") {
    return <TrainingPage />;
  }

  if (path === "/incidents/dispatches") {
    return <DispatchesPage />;
  }

  if (path === "/admin-functions/customization") {
    return <CustomizationPage />;
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
          <Route path="*" element={<RouteResolver role={session.role} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

