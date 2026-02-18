import { type FormEvent, useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Search,
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
  DASHBOARD_CERTIFICATIONS,
  DASHBOARD_DISPATCH_ROWS,
  DASHBOARD_READINESS,
  DASHBOARD_STATS,
  DASHBOARD_TIMELINE,
  MODULE_CONTENT,
  NAV_MODULES,
  PRIMARY_MODULES,
  SUBMENU_BUILD_NOTES,
  getModuleByPath,
  getSubmenuLabel,
  type ModuleId,
  type PrimaryModuleId,
  type Tone,
} from "./appData";

interface SessionState {
  isAuthenticated: boolean;
  username: string;
  unit: string;
}

interface AuthPageProps {
  onLogin: (username: string, unit: string) => void;
}

interface ShellLayoutProps {
  session: SessionState;
  onLogout: () => void;
}

interface ModulePageProps {
  moduleId: PrimaryModuleId;
}

const SESSION_STORAGE_KEY = "stationboss-mimic-session";

const EMPTY_SESSION: SessionState = {
  isAuthenticated: false,
  username: "",
  unit: "",
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
      typeof parsed.unit === "string"
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

function toToneClass(tone: Tone): string {
  return `tone tone-${tone}`;
}

function AuthPage({ onLogin }: AuthPageProps) {
  const [username, setUsername] = useState("");
  const [unit, setUnit] = useState("");
  const [securePin, setSecurePin] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !unit.trim() || !securePin.trim()) {
      setErrorMessage("Please provide username, unit, and secure pin.");
      return;
    }

    setErrorMessage("");
    onLogin(username.trim().toUpperCase(), unit.trim());
  };

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <div className="brand-pill">
          <Shield size={16} />
          <span>Station Boss Replica</span>
        </div>
        <h1>Operational command center prototype</h1>
        <p>
          Version 1 includes complete UI scaffolding for dashboard, certifications,
          checklists, daily logs, dispatches, equipment, events, fuel logs,
          incidents, maintenance, meetings, messages, personnel, and vendors.
        </p>
        <ul className="brand-feature-list">
          <li>Responsive web shell ready for future mobile extension</li>
          <li>Linked submenu routes across all requested modules</li>
          <li>Production-style dashboard cards, queues, and activity feeds</li>
        </ul>
      </section>

      <section className="auth-form-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-header">
            <ShieldCheck size={24} />
            <div>
              <h2>Sign in to Station Boss</h2>
              <p>Use your username, unit, and secure pin.</p>
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
            placeholder="••••"
            value={securePin}
            onChange={(event) => setSecurePin(event.target.value)}
          />

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
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedModules, setExpandedModules] = useState<
    Record<ModuleId, boolean>
  >(() => {
    return Object.fromEntries(
      NAV_MODULES.map((module) => [module.id, module.id === "dashboard"]),
    ) as Record<ModuleId, boolean>;
  });

  const location = useLocation();
  const navigate = useNavigate();
  const activeModule = useMemo(
    () => getModuleByPath(location.pathname),
    [location.pathname],
  );
  const activeSubmenuLabel = useMemo(
    () => getSubmenuLabel(location.pathname),
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

  const breadcrumbSecondary =
    activeSubmenuLabel && activeSubmenuLabel !== activeModule?.title
      ? activeSubmenuLabel
      : null;

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
          {NAV_MODULES.map((module) => {
            const Icon = module.icon;
            const isModuleRoute =
              location.pathname === module.path ||
              location.pathname.startsWith(`${module.path}/`);
            const isExpanded = expandedModules[module.id] || isModuleRoute;

            return (
              <section
                key={module.id}
                className={`nav-module ${isModuleRoute ? "active" : ""}`}
              >
                <div className="nav-module-header">
                  <NavLink
                    to={module.path}
                    className={({ isActive }) =>
                      `nav-module-link ${
                        isActive || isModuleRoute ? "active" : ""
                      }`
                    }
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <Icon size={16} />
                    <span>{module.title}</span>
                  </NavLink>

                  <button
                    type="button"
                    className={`module-toggle ${isExpanded ? "expanded" : ""}`}
                    aria-label={`Toggle ${module.title} submenu`}
                    onClick={() =>
                      setExpandedModules((previousValue) => ({
                        ...previousValue,
                        [module.id]: !isExpanded,
                      }))
                    }
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                <div className={`submenu-links ${isExpanded ? "open" : ""}`}>
                  {module.submenu.map((submenu) => (
                    <NavLink
                      key={submenu.path}
                      to={submenu.path}
                      className={({ isActive }) =>
                        `submenu-link ${isActive ? "active" : ""}`
                      }
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {submenu.label}
                    </NavLink>
                  ))}
                </div>
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
              <span>{activeModule?.title ?? "Dashboard"}</span>
              {breadcrumbSecondary ? (
                <>
                  <ChevronRight size={14} />
                  <span className="breadcrumb-secondary">{breadcrumbSecondary}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="topbar-right">
            <label className="search-field">
              <Search size={15} />
              <input
                type="search"
                placeholder="Search modules, members, dispatch IDs..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <button type="button" className="icon-button">
              <Bell size={16} />
            </button>

            <div className="user-pill">
              <UserRound size={15} />
              <div>
                <strong>{session.username}</strong>
                <span>
                  Unit {session.unit} · {dateLabel}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                onLogout();
                navigate("/auth", { replace: true });
              }}
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function DashboardPage() {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            Live operational visibility across dispatch, staffing, readiness, and
            communication.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button">
            Export Snapshot
          </button>
          <button type="button" className="primary-button">
            Create Dispatch
          </button>
        </div>
      </header>

      <section className="stat-grid">
        {DASHBOARD_STATS.map((stat) => (
          <article key={stat.label} className="stat-card">
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <span className={toToneClass(stat.tone)}>{stat.change}</span>
          </article>
        ))}
      </section>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Live Dispatch Queue</h2>
            <span className="panel-caption">Updated continuously</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Call ID</th>
                  <th>Type</th>
                  <th>Address</th>
                  <th>Assigned Units</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {DASHBOARD_DISPATCH_ROWS.map((row) => (
                  <tr key={row.join("-")}>
                    {row.map((column) => (
                      <td key={column}>{column}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Certifications Expiring</h2>
            <span className="panel-caption">30-day window</span>
          </div>
          <ul className="list-card">
            {DASHBOARD_CERTIFICATIONS.map((certification) => (
              <li key={`${certification.member}-${certification.certification}`}>
                <div>
                  <strong>{certification.member}</strong>
                  <p>{certification.certification}</p>
                </div>
                <span className={toToneClass(certification.tone)}>
                  {certification.expiresIn}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Daily Readiness Completion</h2>
            <span className="panel-caption">Shift progress</span>
          </div>
          <ul className="progress-list">
            {DASHBOARD_READINESS.map((entry) => {
              const percent = Math.round((entry.complete / entry.total) * 100);
              return (
                <li key={entry.label}>
                  <div className="progress-label-row">
                    <span>{entry.label}</span>
                    <span>
                      {entry.complete}/{entry.total} ({percent}%)
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${percent}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Operational Timeline</h2>
            <span className="panel-caption">Last hour</span>
          </div>
          <ul className="timeline-list">
            {DASHBOARD_TIMELINE.map((item) => (
              <li key={`${item.title}-${item.time}`}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <span className={toToneClass(item.tone)}>{item.time}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
}

function ModulePage({ moduleId }: ModulePageProps) {
  const content = MODULE_CONTENT[moduleId];

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{content.title}</h1>
          <p>{content.subtitle}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button">
            {content.secondaryAction}
          </button>
          <button type="button" className="primary-button">
            {content.primaryAction}
          </button>
        </div>
      </header>

      <section className="stat-grid">
        {content.stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <span className={toToneClass(stat.tone)}>{stat.change}</span>
          </article>
        ))}
      </section>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>{content.tableTitle}</h2>
            <span className="panel-caption">Live module data preview</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {content.tableColumns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {content.tableRows.map((row) => (
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
            <h2>{content.alertsTitle}</h2>
            <span className="panel-caption">Priority monitor</span>
          </div>
          <ul className="timeline-list">
            {content.alerts.map((alert) => (
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

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>{content.activityTitle}</h2>
            <span className="panel-caption">Most recent updates</span>
          </div>
          <ul className="activity-list">
            {content.activity.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
}

function SubmenuPlaceholderPage() {
  const location = useLocation();
  const module = getModuleByPath(location.pathname);
  const submenuLabel = getSubmenuLabel(location.pathname);

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{submenuLabel ?? module?.title ?? "Submenu Route Connected"}</h1>
          <p>
            This submenu link is active and ready for detailed implementation in
            a follow-up version.
          </p>
        </div>
      </header>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Route Link Verified</h2>
          </div>
          <p className="route-path">{location.pathname}</p>
          <p className="panel-description">
            {module?.summary ??
              "This destination is available and can be expanded with full CRUD and API wiring."}
          </p>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Planned Build Components</h2>
          </div>
          <ul className="activity-list">
            {SUBMENU_BUILD_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
}

function App() {
  const [session, setSession] = useState<SessionState>(() => readSession());

  const handleLogin = (username: string, unit: string) => {
    const nextSession: SessionState = {
      isAuthenticated: true,
      username,
      unit,
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
              <Navigate to="/dashboard" replace />
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
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          {PRIMARY_MODULES.map((module) => (
            <Route
              key={module.id}
              path={module.path.slice(1)}
              element={<ModulePage moduleId={module.id} />}
            />
          ))}
          <Route path="dashboard/*" element={<SubmenuPlaceholderPage />} />
          {PRIMARY_MODULES.map((module) => (
            <Route
              key={`${module.id}-submenu`}
              path={`${module.path.slice(1)}/*`}
              element={<SubmenuPlaceholderPage />}
            />
          ))}
          <Route path="*" element={<SubmenuPlaceholderPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
