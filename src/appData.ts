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

export type IncidentStatId =
  | "openCalls"
  | "averageTurnout"
  | "averageTravel"
  | "awaitingClosure";

export type IncidentCallFieldId =
  | "incidentType"
  | "priority"
  | "address"
  | "assignedUnits"
  | "status"
  | "lastUpdated";

export interface DashboardStat {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}

export interface IncidentQueueStat extends DashboardStat {
  id: IncidentStatId;
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
  incidentType: string;
  priority: string;
  address: string;
  stillDistrict: string;
  assignedUnits: string;
  currentState: string;
  lastUpdated: string;
  receivedAt: string;
  dispatchInfo: string;
}

export interface DispatchNote {
  time: string;
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
  apparatus: RespondingApparatus[];
  dispatchNotes: DispatchNote[];
}

export interface IncidentCallFieldOption {
  id: IncidentCallFieldId;
  label: string;
  description: string;
}

export interface IncidentDisplaySettings {
  hiddenStatIds: IncidentStatId[];
  callFieldOrder: IncidentCallFieldId[];
}

export interface DispatchParsingPreviewRow {
  receivedAt: string;
  callNumber: string;
  rawMessage: string;
  parsedSummary: string;
}

export const DEFAULT_DISPATCH_WORKFLOW_STATES = [
  "Dispatched",
  "Enroute",
  "On scene",
  "Transport",
  "Cleared",
] as const;

export const DEFAULT_INCIDENT_CALL_FIELD_ORDER: IncidentCallFieldId[] = [
  "incidentType",
  "priority",
  "address",
  "assignedUnits",
  "status",
  "lastUpdated",
];

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
        isBuilt: true,
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

export const INCIDENT_QUEUE_STATS: IncidentQueueStat[] = [
  {
    id: "openCalls",
    label: "Open Calls",
    value: "14",
    detail: "5 currently in active response",
    tone: "warning",
  },
  {
    id: "averageTurnout",
    label: "Average Turnout",
    value: "01:42",
    detail: "Improved by 9 seconds",
    tone: "positive",
  },
  {
    id: "averageTravel",
    label: "Average Travel",
    value: "05:08",
    detail: "Within operational target",
    tone: "positive",
  },
  {
    id: "awaitingClosure",
    label: "Calls Awaiting Closure",
    value: "3",
    detail: "Pending final state and notes",
    tone: "critical",
  },
];

export const INCIDENT_CALL_FIELD_OPTIONS: IncidentCallFieldOption[] = [
  {
    id: "incidentType",
    label: "Incident Type",
    description: "Type/classification of the dispatch call.",
  },
  {
    id: "priority",
    label: "Priority",
    description: "Priority level assigned by dispatch.",
  },
  {
    id: "address",
    label: "Address",
    description: "Incident location/address.",
  },
  {
    id: "assignedUnits",
    label: "Assigned Units",
    description: "Units currently assigned to this call.",
  },
  {
    id: "status",
    label: "Status",
    description: "Current workflow state for the incident.",
  },
  {
    id: "lastUpdated",
    label: "Last Updated",
    description: "Most recent update timestamp for this call.",
  },
];

export const INCIDENT_CALL_DETAILS: IncidentCallDetail[] = [
  {
    callNumber: "D-260218-101",
    incidentType: "Medical Emergency",
    priority: "Priority 2",
    address: "412 River St, River City, ST",
    stillDistrict: "Still District 2",
    assignedUnits: "Engine 2, Medic 4",
    currentState: "Enroute",
    lastUpdated: "2m ago",
    receivedAt: "09:11:02",
    dispatchInfo:
      "Medical Emergency | Priority 2 | 412 River St, River City, ST | Engine 2, Medic 4",
    mapReference: "Grid B4",
    reportedBy: "Dispatch Center",
    callbackNumber: "(555) 0144",
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
        time: "09:11:02",
        text: "Patient experiencing chest pain and shortness of breath.",
      },
      {
        time: "09:12:20",
        text: "Caller reports patient is conscious and seated in front room.",
      },
      {
        time: "09:13:47",
        text: "Engine 2 enroute with 4 personnel.",
      },
    ],
  },
  {
    callNumber: "D-260218-099",
    incidentType: "Automatic Alarm",
    priority: "Priority 3",
    address: "95 Oak Ave, River City, ST",
    stillDistrict: "Still District 1",
    assignedUnits: "Engine 1, Ladder 6",
    currentState: "On scene",
    lastUpdated: "5m ago",
    receivedAt: "08:56:47",
    dispatchInfo:
      "Automatic Alarm | Priority 3 | 95 Oak Ave, River City, ST | Engine 1, Ladder 6",
    mapReference: "Grid C2",
    reportedBy: "Dispatch Center",
    callbackNumber: "(555) 0170",
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
        time: "08:56:47",
        text: "Commercial fire alarm activation at side entrance panel.",
      },
      {
        time: "09:00:11",
        text: "Ladder 6 on scene conducting size-up.",
      },
      {
        time: "09:04:55",
        text: "Alarm company reports potential false activation but unconfirmed.",
      },
    ],
  },
  {
    callNumber: "D-260218-094",
    incidentType: "Motor Vehicle Collision",
    priority: "Priority 2",
    address: "Hwy 62 MM 17, River County, ST",
    stillDistrict: "Still District 4",
    assignedUnits: "Rescue 3, Medic 2",
    currentState: "Transport",
    lastUpdated: "8m ago",
    receivedAt: "08:31:19",
    dispatchInfo:
      "Motor Vehicle Collision | Priority 2 | Hwy 62 MM 17, River County, ST | Rescue 3, Medic 2",
    mapReference: "Grid E1",
    reportedBy: "State Dispatch",
    callbackNumber: "(555) 0126",
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
        time: "08:31:19",
        text: "Two-vehicle MVC reported in median with possible entrapment.",
      },
      {
        time: "08:36:44",
        text: "One patient extricated and transferred to Medic 2.",
      },
      {
        time: "08:43:08",
        text: "Traffic control requested from law enforcement.",
      },
    ],
  },
  {
    callNumber: "D-260218-089",
    incidentType: "Lift Assist",
    priority: "Priority 4",
    address: "311 Aspen Ct, River City, ST",
    stillDistrict: "Still District 3",
    assignedUnits: "Engine 5",
    currentState: "Cleared",
    lastUpdated: "18m ago",
    receivedAt: "08:02:14",
    dispatchInfo: "Lift Assist | Priority 4 | 311 Aspen Ct, River City, ST | Engine 5",
    mapReference: "Grid A5",
    reportedBy: "Dispatch Center",
    callbackNumber: "(555) 0182",
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
        time: "08:02:14",
        text: "Resident requested non-injury lift assist.",
      },
      {
        time: "08:10:28",
        text: "Patient assisted and no additional care requested.",
      },
      {
        time: "08:14:53",
        text: "Engine 5 cleared and returning to service.",
      },
    ],
  },
  {
    callNumber: "D-260218-082",
    incidentType: "Structure Fire",
    priority: "Priority 1",
    address: "16 Harbor Ln, River City, ST",
    stillDistrict: "Still District 5",
    assignedUnits: "Engine 1, Engine 7, Ladder 6, Medic 4",
    currentState: "On scene",
    lastUpdated: "1m ago",
    receivedAt: "07:41:31",
    dispatchInfo:
      "Structure Fire | Priority 1 | 16 Harbor Ln, River City, ST | Engine 1, Engine 7, Ladder 6, Medic 4",
    mapReference: "Grid D3",
    reportedBy: "Dispatch Center",
    callbackNumber: "(555) 0102",
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
        time: "07:41:31",
        text: "Multiple callers reporting visible flames from roof line.",
      },
      {
        time: "07:46:12",
        text: "Upgraded to second alarm assignment, defensive strategy.",
      },
      {
        time: "07:52:40",
        text: "Utility company notified for emergency shutoff.",
      },
      {
        time: "07:59:06",
        text: "Primary search complete, no occupants located.",
      },
    ],
  },
];

export const INCIDENT_CALLS: IncidentCallSummary[] = INCIDENT_CALL_DETAILS.map(
  (call) => ({
    callNumber: call.callNumber,
    incidentType: call.incidentType,
    priority: call.priority,
    address: call.address,
    stillDistrict: call.stillDistrict,
    assignedUnits: call.assignedUnits,
    currentState: call.currentState,
    lastUpdated: call.lastUpdated,
    receivedAt: call.receivedAt,
    dispatchInfo: call.dispatchInfo,
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

export const DISPATCH_PARSING_PREVIEW: DispatchParsingPreviewRow[] = [
  {
    receivedAt: "09:11:02",
    callNumber: "D-260218-101",
    rawMessage:
      "CAD|CALL=D-260218-101|TYPE=MEDICAL|PRIORITY=2|ADDR=412 River St|UNITS=E2,M4",
    parsedSummary:
      "Medical Emergency | Priority 2 | 412 River St | Engine 2, Medic 4",
  },
  {
    receivedAt: "08:56:47",
    callNumber: "D-260218-099",
    rawMessage:
      "CAD|CALL=D-260218-099|TYPE=ALARM|PRIORITY=3|ADDR=95 Oak Ave|UNITS=E1,L6",
    parsedSummary:
      "Automatic Alarm | Priority 3 | 95 Oak Ave | Engine 1, Ladder 6",
  },
  {
    receivedAt: "07:41:31",
    callNumber: "D-260218-082",
    rawMessage:
      "CAD|CALL=D-260218-082|TYPE=STRUCT FIRE|PRIORITY=1|ADDR=16 Harbor Ln|UNITS=E1,E7,L6,M4",
    parsedSummary:
      "Structure Fire | Priority 1 | 16 Harbor Ln | Engine 1, Engine 7, Ladder 6, Medic 4",
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

export const ALL_SUBMENU_PATHS = DISPLAY_CARDS.map((submenu) => submenu.path);

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

