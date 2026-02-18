import {
  BarChart3,
  CalendarDays,
  FileStack,
  GraduationCap,
  LayoutDashboard,
  MapPinned,
  MessageSquare,
  Settings2,
  ShieldAlert,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type UserRole = "admin" | "user";

export type MainMenuId =
  | "dashboard"
  | "incidentsMapping"
  | "reporting"
  | "personnel"
  | "apparatus"
  | "calendar"
  | "fileCenter"
  | "firePrevention"
  | "training"
  | "adminFunctions"
  | "messaging";

export type Tone = "positive" | "warning" | "critical" | "neutral";

export interface DashboardStat {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}

export interface AlertItem {
  title: string;
  detail: string;
  time: string;
  tone: Tone;
}

export interface NavSubmenu {
  label: string;
  path: `/${string}`;
  summary: string;
  isBuilt: boolean;
  adminOnly?: boolean;
}

export interface MainMenu {
  id: MainMenuId;
  title: string;
  path: `/${string}`;
  icon: LucideIcon;
  summary: string;
  adminOnly?: boolean;
  submenus: NavSubmenu[];
}

export interface DisplayCardOption extends NavSubmenu {
  parentMenuId: MainMenuId;
  parentMenuTitle: string;
}

export interface IncidentCallSummary {
  callNumber: string;
  dispatchInfo: string;
  currentState: string;
  lastUpdated: string;
}

export interface DispatchNote {
  time: string;
  source: string;
  text: string;
}

export interface RespondingApparatus {
  unit: string;
  unitType: string;
  status: string;
  crew: string;
  eta: string;
}

export interface IncidentCallDetail extends IncidentCallSummary {
  incidentType: string;
  priority: string;
  address: string;
  mapReference: string;
  reportedBy: string;
  callbackNumber: string;
  receivedAt: string;
  apparatus: RespondingApparatus[];
  dispatchNotes: DispatchNote[];
}

export const DEFAULT_DISPATCH_WORKFLOW_STATES = [
  "Dispatched",
  "Enroute",
  "On scene",
  "Transport",
  "Cleared",
] as const;

export const MAIN_MENUS: MainMenu[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    summary:
      "Real-time station awareness with readiness, alerts, and quick access.",
    submenus: [],
  },
  {
    id: "incidentsMapping",
    title: "Incidents / Mapping",
    path: "/incidents-mapping",
    icon: MapPinned,
    summary:
      "Manage active incidents and mapping overlays for response operations.",
    submenus: [
      {
        label: "Incidents",
        path: "/incidents-mapping/incidents",
        summary:
          "Call queue with clickable call records opening incident detail screens.",
        isBuilt: true,
      },
      {
        label: "Map View",
        path: "/incidents-mapping/map-view",
        summary: "Live operational map for incidents and unit positioning.",
        isBuilt: false,
      },
      {
        label: "Map Markers",
        path: "/incidents-mapping/map-markers",
        summary:
          "Overlay marker management for zones, hazards, and response layers.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "reporting",
    title: "Reporting",
    path: "/reporting",
    icon: BarChart3,
    summary: "Agency reporting flows and export-ready compliance data.",
    submenus: [
      {
        label: "NEIRS",
        path: "/reporting/neirs",
        summary: "Incident reporting aligned to NEIRS data structure.",
        isBuilt: false,
      },
      {
        label: "EMS",
        path: "/reporting/ems",
        summary: "EMS response reporting and summary exports.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "personnel",
    title: "Personnel",
    path: "/personnel",
    icon: Users,
    summary: "Scheduling and certification visibility for all personnel.",
    submenus: [
      {
        label: "Schedule",
        path: "/personnel/schedule",
        summary: "Shift scheduling, swaps, and staffing assignment workflows.",
        isBuilt: false,
      },
      {
        label: "Certifications",
        path: "/personnel/certifications",
        summary: "Personnel certification status and expiration tracking.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "apparatus",
    title: "Apparatus",
    path: "/apparatus",
    icon: Truck,
    summary: "Operational readiness for units, equipment, and logs.",
    submenus: [
      {
        label: "Units",
        path: "/apparatus/units",
        summary: "Unit roster with operational status and assignment views.",
        isBuilt: false,
      },
      {
        label: "Equipment List",
        path: "/apparatus/equipment-list",
        summary: "Equipment inventory by unit and station.",
        isBuilt: false,
      },
      {
        label: "Fuel Logs",
        path: "/apparatus/fuel-logs",
        summary: "Fuel usage and accountability logs.",
        isBuilt: false,
      },
      {
        label: "Maintenance Logs",
        path: "/apparatus/maintenance-logs",
        summary: "Maintenance records and service history tracking.",
        isBuilt: false,
      },
      {
        label: "Mileage Logs",
        path: "/apparatus/mileage-logs",
        summary: "Mileage monitoring and utilization reporting.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "calendar",
    title: "Calendar",
    path: "/calendar",
    icon: CalendarDays,
    summary: "Unified event and meeting scheduling workspace.",
    submenus: [
      {
        label: "Events",
        path: "/calendar/events",
        summary: "Department events and community activity planning.",
        isBuilt: false,
      },
      {
        label: "Meetings",
        path: "/calendar/meetings",
        summary: "Meeting schedule, agendas, and minutes tracking.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "fileCenter",
    title: "File Center",
    path: "/file-center",
    icon: FileStack,
    summary: "Centralized operational files, forms, and resource documents.",
    submenus: [
      {
        label: "Checklists",
        path: "/file-center/checklists",
        summary: "Checklist templates and operational checklist instances.",
        isBuilt: false,
      },
      {
        label: "Daily Logs",
        path: "/file-center/daily-logs",
        summary: "Shift logs and station daily documentation.",
        isBuilt: false,
      },
      {
        label: "E-Forms",
        path: "/file-center/e-forms",
        summary: "Digital operational forms and completion records.",
        isBuilt: false,
      },
      {
        label: "Medical Supplies",
        path: "/file-center/medical-supplies",
        summary: "Medical supply inventory and replenishment records.",
        isBuilt: false,
      },
      {
        label: "Water Logs",
        path: "/file-center/water-logs",
        summary: "Water usage and refill documentation.",
        isBuilt: false,
      },
      {
        label: "Vendors",
        path: "/file-center/vendors",
        summary: "Vendor directory and service references.",
        isBuilt: false,
      },
      {
        label: "Resources",
        path: "/file-center/resources",
        summary: "Training and operational resources repository.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "firePrevention",
    title: "Fire Prevention",
    path: "/fire-prevention",
    icon: ShieldAlert,
    summary: "Inspection, permitting, and prevention program management.",
    submenus: [
      {
        label: "Fire Investigations",
        path: "/fire-prevention/fire-investigations",
        summary: "Investigation case tracking and outcomes.",
        isBuilt: false,
      },
      {
        label: "Pre-Plans",
        path: "/fire-prevention/pre-plans",
        summary: "Pre-plan creation, updates, and mapping references.",
        isBuilt: false,
      },
      {
        label: "Inspections",
        path: "/fire-prevention/inspections",
        summary: "Inspection scheduling and completion workflows.",
        isBuilt: false,
      },
      {
        label: "Permits",
        path: "/fire-prevention/permits",
        summary: "Permit requests, reviews, and approvals.",
        isBuilt: false,
      },
      {
        label: "Properties",
        path: "/fire-prevention/properties",
        summary: "Property profiles and hazard details.",
        isBuilt: false,
      },
      {
        label: "Smoke Alarms",
        path: "/fire-prevention/smoke-alarms",
        summary: "Smoke alarm requests and installation tracking.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "training",
    title: "Training",
    path: "/training",
    icon: GraduationCap,
    summary: "Training coordination and readiness lifecycle management.",
    submenus: [],
  },
  {
    id: "adminFunctions",
    title: "Admin Functions",
    path: "/admin-functions",
    icon: Settings2,
    summary: "Administrative configuration and account management tools.",
    adminOnly: true,
    submenus: [
      {
        label: "Scheduling",
        path: "/admin-functions/scheduling",
        summary: "Administrative schedule management controls.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Overtime Hiring",
        path: "/admin-functions/overtime-hiring",
        summary: "Overtime posting and selection workflows.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Personnel Management",
        path: "/admin-functions/personnel-management",
        summary: "Manage accounts, permissions, and personnel settings.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Point Tracker",
        path: "/admin-functions/point-tracker",
        summary: "Policy-based point tracking and visibility.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Manage Groups",
        path: "/admin-functions/manage-groups",
        summary: "Group setup and permission templates.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Expiration Tracker",
        path: "/admin-functions/expiration-tracker",
        summary: "Track and alert on expiring records.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Reports",
        path: "/admin-functions/reports",
        summary: "Administrative reports and exports.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Hydrants",
        path: "/admin-functions/hydrants",
        summary:
          "Mass upload hydrants with CSV and edit hydrant positions on the map.",
        isBuilt: true,
        adminOnly: true,
      },
      {
        label: "Customization",
        path: "/admin-functions/customization",
        summary:
          "Upload logo, choose colors, and define dispatch workflow states.",
        isBuilt: true,
        adminOnly: true,
      },
    ],
  },
  {
    id: "messaging",
    title: "Messaging",
    path: "/messaging",
    icon: MessageSquare,
    summary: "Internal communications and broadcast messaging workspace.",
    submenus: [
      {
        label: "View Messages",
        path: "/messaging/view-messages",
        summary: "Read and manage existing message threads.",
        isBuilt: false,
      },
      {
        label: "Create Message",
        path: "/messaging/create-message",
        summary: "Compose and send messages to members or groups.",
        isBuilt: false,
      },
    ],
  },
];

export const DASHBOARD_STATS: DashboardStat[] = [
  {
    label: "Active Calls",
    value: "14",
    detail: "2 are Priority 1",
    tone: "warning",
  },
  {
    label: "Units Available",
    value: "27 / 30",
    detail: "3 in maintenance",
    tone: "neutral",
  },
  {
    label: "Pending Reports",
    value: "8",
    detail: "4 need supervisor sign-off",
    tone: "warning",
  },
  {
    label: "Unread Messages",
    value: "19",
    detail: "5 urgent notifications",
    tone: "critical",
  },
];

export const DASHBOARD_ALERTS: AlertItem[] = [
  {
    title: "Priority 1 escalation",
    detail: "Call D-260218-082 moved to second alarm assignment.",
    time: "4m ago",
    tone: "critical",
  },
  {
    title: "Dispatch workflow lag",
    detail: "Two incidents are missing final cleared-state update.",
    time: "11m ago",
    tone: "warning",
  },
  {
    title: "Map overlay sync complete",
    detail: "Map marker metadata synced successfully.",
    time: "19m ago",
    tone: "positive",
  },
  {
    title: "Shift roster imported",
    detail: "Personnel schedule refreshed from roster source.",
    time: "31m ago",
    tone: "positive",
  },
];

export const DASHBOARD_PRIORITY_LINKS: Array<{
  label: string;
  path: string;
  description: string;
}> = [
  {
    label: "Open Incidents",
    path: "/incidents-mapping/incidents",
    description: "Go to the incident call queue and open call details.",
  },
  {
    label: "Map Markers",
    path: "/incidents-mapping/map-markers",
    description: "View and manage map marker overlay configuration.",
  },
  {
    label: "Hydrants Admin",
    path: "/admin-functions/hydrants",
    description: "Mass upload hydrants and edit placements on map.",
  },
  {
    label: "Customization",
    path: "/admin-functions/customization",
    description: "Define logo, colors, and workflow states.",
  },
];

export const INCIDENT_QUEUE_STATS: DashboardStat[] = [
  {
    label: "Open Calls",
    value: "14",
    detail: "5 currently in active response",
    tone: "warning",
  },
  {
    label: "Average Turnout",
    value: "01:42",
    detail: "Improved by 9 seconds",
    tone: "positive",
  },
  {
    label: "Average Travel",
    value: "05:08",
    detail: "Within operational target",
    tone: "positive",
  },
  {
    label: "Calls Awaiting Closure",
    value: "3",
    detail: "Pending final state and notes",
    tone: "critical",
  },
];

export const INCIDENT_CALL_DETAILS: IncidentCallDetail[] = [
  {
    callNumber: "D-260218-101",
    dispatchInfo:
      "Medical | 412 River St | Engine 2, Medic 4 | Priority 2",
    currentState: "Enroute",
    lastUpdated: "2m ago",
    incidentType: "Medical Emergency",
    priority: "Priority 2",
    address: "412 River St",
    mapReference: "Grid B4",
    reportedBy: "Dispatch Center",
    callbackNumber: "(555) 0144",
    receivedAt: "09:11",
    apparatus: [
      {
        unit: "Engine 2",
        unitType: "Engine",
        status: "Enroute",
        crew: "4",
        eta: "03:20",
      },
      {
        unit: "Medic 4",
        unitType: "Medic",
        status: "Enroute",
        crew: "2",
        eta: "03:10",
      },
    ],
    dispatchNotes: [
      {
        time: "09:11",
        source: "Dispatch",
        text: "Patient experiencing chest pain and shortness of breath.",
      },
      {
        time: "09:12",
        source: "Dispatch",
        text: "Caller reports patient is conscious and seated in front room.",
      },
      {
        time: "09:13",
        source: "Engine 2",
        text: "Engine 2 enroute with 4 personnel.",
      },
    ],
  },
  {
    callNumber: "D-260218-099",
    dispatchInfo:
      "Alarm Activation | 95 Oak Ave | Engine 1, Ladder 6 | Priority 3",
    currentState: "On scene",
    lastUpdated: "5m ago",
    incidentType: "Automatic Alarm",
    priority: "Priority 3",
    address: "95 Oak Ave",
    mapReference: "Grid C2",
    reportedBy: "Dispatch Center",
    callbackNumber: "(555) 0170",
    receivedAt: "08:56",
    apparatus: [
      {
        unit: "Engine 1",
        unitType: "Engine",
        status: "On scene",
        crew: "4",
        eta: "Arrived",
      },
      {
        unit: "Ladder 6",
        unitType: "Truck",
        status: "On scene",
        crew: "3",
        eta: "Arrived",
      },
    ],
    dispatchNotes: [
      {
        time: "08:56",
        source: "Dispatch",
        text: "Commercial fire alarm activation at side entrance panel.",
      },
      {
        time: "09:00",
        source: "Ladder 6",
        text: "Ladder 6 on scene conducting size-up.",
      },
      {
        time: "09:04",
        source: "Dispatch",
        text: "Alarm company reports potential false activation but unconfirmed.",
      },
    ],
  },
  {
    callNumber: "D-260218-094",
    dispatchInfo: "MVC | Hwy 62 MM 17 | Rescue 3, Medic 2 | Priority 2",
    currentState: "Transport",
    lastUpdated: "8m ago",
    incidentType: "Motor Vehicle Collision",
    priority: "Priority 2",
    address: "Hwy 62 MM 17",
    mapReference: "Grid E1",
    reportedBy: "State Dispatch",
    callbackNumber: "(555) 0126",
    receivedAt: "08:31",
    apparatus: [
      {
        unit: "Rescue 3",
        unitType: "Rescue",
        status: "Transport",
        crew: "3",
        eta: "12:00 to hospital",
      },
      {
        unit: "Medic 2",
        unitType: "Medic",
        status: "Transport",
        crew: "2",
        eta: "11:40 to hospital",
      },
    ],
    dispatchNotes: [
      {
        time: "08:31",
        source: "Dispatch",
        text: "Two-vehicle MVC reported in median with possible entrapment.",
      },
      {
        time: "08:36",
        source: "Rescue 3",
        text: "One patient extricated and transferred to Medic 2.",
      },
      {
        time: "08:43",
        source: "Dispatch",
        text: "Traffic control requested from law enforcement.",
      },
    ],
  },
  {
    callNumber: "D-260218-089",
    dispatchInfo: "Lift Assist | 311 Aspen Ct | Engine 5 | Priority 4",
    currentState: "Cleared",
    lastUpdated: "18m ago",
    incidentType: "Lift Assist",
    priority: "Priority 4",
    address: "311 Aspen Ct",
    mapReference: "Grid A5",
    reportedBy: "Dispatch Center",
    callbackNumber: "(555) 0182",
    receivedAt: "08:02",
    apparatus: [
      {
        unit: "Engine 5",
        unitType: "Engine",
        status: "Cleared",
        crew: "3",
        eta: "Returned",
      },
    ],
    dispatchNotes: [
      {
        time: "08:02",
        source: "Dispatch",
        text: "Resident requested non-injury lift assist.",
      },
      {
        time: "08:10",
        source: "Engine 5",
        text: "Patient assisted and no additional care requested.",
      },
      {
        time: "08:14",
        source: "Engine 5",
        text: "Engine 5 cleared and returning to service.",
      },
    ],
  },
  {
    callNumber: "D-260218-082",
    dispatchInfo:
      "Structure Fire | 16 Harbor Ln | 2 Alarm Assignment | Priority 1",
    currentState: "On scene",
    lastUpdated: "1m ago",
    incidentType: "Structure Fire",
    priority: "Priority 1",
    address: "16 Harbor Ln",
    mapReference: "Grid D3",
    reportedBy: "Dispatch Center",
    callbackNumber: "(555) 0102",
    receivedAt: "07:41",
    apparatus: [
      {
        unit: "Engine 1",
        unitType: "Engine",
        status: "On scene",
        crew: "4",
        eta: "Arrived",
      },
      {
        unit: "Engine 7",
        unitType: "Engine",
        status: "On scene",
        crew: "4",
        eta: "Arrived",
      },
      {
        unit: "Ladder 6",
        unitType: "Truck",
        status: "On scene",
        crew: "3",
        eta: "Arrived",
      },
      {
        unit: "Medic 4",
        unitType: "Medic",
        status: "On standby",
        crew: "2",
        eta: "Arrived",
      },
    ],
    dispatchNotes: [
      {
        time: "07:41",
        source: "Dispatch",
        text: "Multiple callers reporting visible flames from roof line.",
      },
      {
        time: "07:46",
        source: "Command",
        text: "Upgraded to second alarm assignment, defensive strategy.",
      },
      {
        time: "07:52",
        source: "Dispatch",
        text: "Utility company notified for emergency shutoff.",
      },
      {
        time: "07:59",
        source: "Command",
        text: "Primary search complete, no occupants located.",
      },
    ],
  },
];

export const INCIDENT_CALLS: IncidentCallSummary[] = INCIDENT_CALL_DETAILS.map(
  ({ callNumber, dispatchInfo, currentState, lastUpdated }) => ({
    callNumber,
    dispatchInfo,
    currentState,
    lastUpdated,
  }),
);

export const HYDRANT_ADMIN_TABLE_ROWS: Array<{
  hydrantId: string;
  status: string;
  zone: string;
  lastInspection: string;
  flowRate: string;
}> = [
  {
    hydrantId: "H-112",
    status: "Out of Service",
    zone: "Harbor District",
    lastInspection: "2026-02-10",
    flowRate: "N/A",
  },
  {
    hydrantId: "H-047",
    status: "In Service",
    zone: "Oak District",
    lastInspection: "2026-01-18",
    flowRate: "1280 gpm",
  },
  {
    hydrantId: "H-203",
    status: "Needs Inspection",
    zone: "River Corridor",
    lastInspection: "2025-11-07",
    flowRate: "1120 gpm",
  },
];

export const SUBMENU_PLACEHOLDER_NOTES: string[] = [
  "Route wiring is complete and ready for full module implementation.",
  "Data model, create/edit flows, and permissions can be layered next.",
  "Table filtering, exports, and audit history can be added per module.",
  "API integration points are prepared for future backend connectivity.",
];

function normalizePath(pathname: string): string {
  if (pathname === "/") {
    return pathname;
  }
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

const MENUS_BY_PATH = [...MAIN_MENUS].sort(
  (left, right) => right.path.length - left.path.length,
);

const DISPLAY_CARDS: DisplayCardOption[] = MAIN_MENUS.flatMap((menu) =>
  menu.submenus.map((submenu) => ({
    ...submenu,
    parentMenuId: menu.id,
    parentMenuTitle: menu.title,
  })),
);

export function getVisibleMenus(role: UserRole): MainMenu[] {
  if (role === "admin") {
    return MAIN_MENUS;
  }
  return MAIN_MENUS.filter((menu) => !menu.adminOnly);
}

export function getMainMenuById(menuId: MainMenuId): MainMenu | undefined {
  return MAIN_MENUS.find((menu) => menu.id === menuId);
}

export function getMainMenuByPath(pathname: string): MainMenu | undefined {
  const normalizedPath = normalizePath(pathname);
  return MENUS_BY_PATH.find(
    (menu) =>
      normalizedPath === menu.path ||
      normalizedPath.startsWith(`${menu.path}/`),
  );
}

export function getSubmenuByPath(pathname: string): NavSubmenu | undefined {
  const normalizedPath = normalizePath(pathname);
  return DISPLAY_CARDS.find((submenu) => submenu.path === normalizedPath);
}

export function getSubmenuForPath(pathname: string): NavSubmenu | undefined {
  const normalizedPath = normalizePath(pathname);
  const exact = getSubmenuByPath(normalizedPath);
  if (exact) {
    return exact;
  }

  return DISPLAY_CARDS.find((submenu) =>
    normalizedPath.startsWith(`${submenu.path}/`),
  );
}

export function getDisplayCardOptionByPath(
  path: string,
): DisplayCardOption | undefined {
  const normalizedPath = normalizePath(path);
  return DISPLAY_CARDS.find((card) => card.path === normalizedPath);
}

export function getDisplayCardOptions(role: UserRole): DisplayCardOption[] {
  if (role === "admin") {
    return DISPLAY_CARDS;
  }

  return DISPLAY_CARDS.filter((card) => {
    if (card.adminOnly) {
      return false;
    }
    const parentMenu = getMainMenuById(card.parentMenuId);
    return !parentMenu?.adminOnly;
  });
}

export function isPathAdminOnly(pathname: string): boolean {
  const normalizedPath = normalizePath(pathname);
  const matchedMenu = getMainMenuByPath(normalizedPath);
  if (matchedMenu?.adminOnly) {
    return true;
  }

  const submenu = DISPLAY_CARDS.find(
    (card) =>
      normalizedPath === card.path || normalizedPath.startsWith(`${card.path}/`),
  );
  if (!submenu) {
    return false;
  }

  if (submenu.adminOnly) {
    return true;
  }

  const parentMenu = getMainMenuById(submenu.parentMenuId);
  return Boolean(parentMenu?.adminOnly);
}

export function getIncidentCallDetail(
  callNumber: string,
): IncidentCallDetail | undefined {
  return INCIDENT_CALL_DETAILS.find((call) => call.callNumber === callNumber);
}

export function getDefaultPathForRole(role: UserRole): string {
  return role === "admin" ? "/dashboard" : "/dashboard";
}

