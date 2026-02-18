import {
  BarChart3,
  CalendarDays,
  FileStack,
  Flame,
  GraduationCap,
  LayoutDashboard,
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
  | "incidents"
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

export interface DispatchStat {
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

export const MAIN_MENUS: MainMenu[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    summary:
      "Real-time station awareness with readiness, alerts, and activity.",
    submenus: [],
  },
  {
    id: "incidents",
    title: "Incidents",
    path: "/incidents",
    icon: Flame,
    summary: "Dispatch operations, hydrants, and incident map workflows.",
    submenus: [
      {
        label: "Dispatches",
        path: "/incidents/dispatches",
        summary: "Primary dispatch workflow and active call board.",
        isBuilt: true,
      },
      {
        label: "Hydrants",
        path: "/incidents/hydrants",
        summary: "Hydrant status, inspections, and response readiness.",
        isBuilt: false,
      },
      {
        label: "Map View",
        path: "/incidents/map-view",
        summary: "Spatial view of incidents, units, and response zones.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "reporting",
    title: "Reporting",
    path: "/reporting",
    icon: BarChart3,
    summary: "Agency reporting flows and compliance exports.",
    submenus: [
      {
        label: "NEIRS",
        path: "/reporting/neirs",
        summary: "Incident reporting aligned to NEIRS workflows.",
        isBuilt: false,
      },
      {
        label: "EMS",
        path: "/reporting/ems",
        summary: "EMS reporting and exportable medical summaries.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "personnel",
    title: "Personnel",
    path: "/personnel",
    icon: Users,
    summary: "Shift planning and personnel certification readiness.",
    submenus: [
      {
        label: "Schedule",
        path: "/personnel/schedule",
        summary: "Shift schedules, swaps, and staffing coverage.",
        isBuilt: false,
      },
      {
        label: "Certifications",
        path: "/personnel/certifications",
        summary: "Personnel certification tracking and renewals.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "apparatus",
    title: "Apparatus",
    path: "/apparatus",
    icon: Truck,
    summary: "Apparatus inventory, service, and usage records.",
    submenus: [
      {
        label: "Units",
        path: "/apparatus/units",
        summary: "Unit list, assignment status, and availability.",
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
        summary: "Fuel usage, spend tracking, and audit logs.",
        isBuilt: false,
      },
      {
        label: "Maintenance Logs",
        path: "/apparatus/maintenance-logs",
        summary: "Preventive and corrective maintenance records.",
        isBuilt: false,
      },
      {
        label: "Mileage Logs",
        path: "/apparatus/mileage-logs",
        summary: "Mileage tracking and utilization history.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "calendar",
    title: "Calendar",
    path: "/calendar",
    icon: CalendarDays,
    summary: "Department events and meeting schedule management.",
    submenus: [
      {
        label: "Events",
        path: "/calendar/events",
        summary: "Internal and public-facing event scheduling.",
        isBuilt: false,
      },
      {
        label: "Meetings",
        path: "/calendar/meetings",
        summary: "Meeting calendar, agenda tracking, and follow-up.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "fileCenter",
    title: "File Center",
    path: "/file-center",
    icon: FileStack,
    summary: "Operational files, forms, and station resource collections.",
    submenus: [
      {
        label: "Checklists",
        path: "/file-center/checklists",
        summary: "Station checklist templates and active instances.",
        isBuilt: false,
      },
      {
        label: "Daily Logs",
        path: "/file-center/daily-logs",
        summary: "Daily station logs and shift notes.",
        isBuilt: false,
      },
      {
        label: "E-Forms",
        path: "/file-center/e-forms",
        summary: "Digital forms for agency operations and documentation.",
        isBuilt: false,
      },
      {
        label: "Medical Supplies",
        path: "/file-center/medical-supplies",
        summary: "Medical supply tracking and inventory visibility.",
        isBuilt: false,
      },
      {
        label: "Water Logs",
        path: "/file-center/water-logs",
        summary: "Water consumption and usage documentation.",
        isBuilt: false,
      },
      {
        label: "Vendors",
        path: "/file-center/vendors",
        summary: "Vendor records and service contact details.",
        isBuilt: false,
      },
      {
        label: "Resources",
        path: "/file-center/resources",
        summary: "Reference documents and operational playbooks.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "firePrevention",
    title: "Fire Prevention",
    path: "/fire-prevention",
    icon: ShieldAlert,
    summary: "Prevention workflows including permits and inspections.",
    submenus: [
      {
        label: "Fire Investigations",
        path: "/fire-prevention/fire-investigations",
        summary: "Case management and investigation tracking.",
        isBuilt: false,
      },
      {
        label: "Pre-Plans",
        path: "/fire-prevention/pre-plans",
        summary: "Pre-plan records and structure readiness details.",
        isBuilt: false,
      },
      {
        label: "Inspections",
        path: "/fire-prevention/inspections",
        summary: "Inspection scheduling and inspection outcome logs.",
        isBuilt: false,
      },
      {
        label: "Permits",
        path: "/fire-prevention/permits",
        summary: "Permit intake, approvals, and status workflows.",
        isBuilt: false,
      },
      {
        label: "Properties",
        path: "/fire-prevention/properties",
        summary: "Property records relevant to fire prevention.",
        isBuilt: false,
      },
      {
        label: "Smoke Alarms",
        path: "/fire-prevention/smoke-alarms",
        summary: "Smoke alarm request and installation tracking.",
        isBuilt: false,
      },
    ],
  },
  {
    id: "training",
    title: "Training",
    path: "/training",
    icon: GraduationCap,
    summary: "Training schedules, records, and future simulator access.",
    submenus: [],
  },
  {
    id: "adminFunctions",
    title: "Admin Functions",
    path: "/admin-functions",
    icon: Settings2,
    summary: "Administration tools for organization setup and management.",
    adminOnly: true,
    submenus: [
      {
        label: "Scheduling",
        path: "/admin-functions/scheduling",
        summary: "Department-wide schedule controls.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Overtime Hiring",
        path: "/admin-functions/overtime-hiring",
        summary: "Overtime request and hiring workflows.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Personnel Management",
        path: "/admin-functions/personnel-management",
        summary: "Administrative personnel and account management.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Point Tracker",
        path: "/admin-functions/point-tracker",
        summary: "Performance and point tracking rules.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Manage Groups",
        path: "/admin-functions/manage-groups",
        summary: "Permission groups and role assignments.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Expiration Tracker",
        path: "/admin-functions/expiration-tracker",
        summary: "Expiration and renewal reminder controls.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Reports",
        path: "/admin-functions/reports",
        summary: "Administrative reporting and exports.",
        isBuilt: false,
        adminOnly: true,
      },
      {
        label: "Customization",
        path: "/admin-functions/customization",
        summary:
          "Upload organization logo and customize application colors.",
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
    summary: "Message center for internal communication and broadcast.",
    submenus: [
      {
        label: "View Messages",
        path: "/messaging/view-messages",
        summary: "Inbox and message conversation history.",
        isBuilt: false,
      },
      {
        label: "Create Message",
        path: "/messaging/create-message",
        summary: "Compose and send member or group messages.",
        isBuilt: false,
      },
    ],
  },
];

export const DASHBOARD_STATS: DashboardStat[] = [
  {
    label: "Active Dispatches",
    value: "14",
    detail: "3 are high priority",
    tone: "warning",
  },
  {
    label: "Units In Service",
    value: "27 / 30",
    detail: "3 in maintenance",
    tone: "neutral",
  },
  {
    label: "Open Tasks",
    value: "42",
    detail: "11 due this shift",
    tone: "warning",
  },
  {
    label: "Unread Messages",
    value: "19",
    detail: "5 marked urgent",
    tone: "critical",
  },
];

export const DASHBOARD_ALERTS: AlertItem[] = [
  {
    title: "Second alarm assignment",
    detail: "Dispatch D-260218-082 escalated to second alarm.",
    time: "5m ago",
    tone: "critical",
  },
  {
    title: "Hydrant maintenance note",
    detail: "Hydrant H-112 remains out of service pending valve repair.",
    time: "12m ago",
    tone: "warning",
  },
  {
    title: "Roster synchronization complete",
    detail: "Personnel schedule sync finished with no conflicts.",
    time: "23m ago",
    tone: "positive",
  },
  {
    title: "Training readiness",
    detail: "Tomorrow's ladder drill roster is now fully staffed.",
    time: "37m ago",
    tone: "positive",
  },
];

export const DASHBOARD_PRIORITY_LINKS: Array<{
  label: string;
  path: string;
  description: string;
}> = [
  {
    label: "Open Dispatches",
    path: "/incidents/dispatches",
    description: "View live dispatch call board and unit status.",
  },
  {
    label: "Hydrant Exceptions",
    path: "/incidents/hydrants",
    description: "Check hydrants flagged as out of service.",
  },
  {
    label: "Upcoming Meetings",
    path: "/calendar/meetings",
    description: "Review command and operations meeting schedule.",
  },
  {
    label: "Customization",
    path: "/admin-functions/customization",
    description: "Update logo and color theme for your organization.",
  },
];

export const DISPATCH_STATS: DispatchStat[] = [
  {
    label: "Open Calls",
    value: "14",
    detail: "2 escalation-level calls",
    tone: "warning",
  },
  {
    label: "Average Turnout",
    value: "01:43",
    detail: "8 seconds faster than yesterday",
    tone: "positive",
  },
  {
    label: "Average Arrival",
    value: "05:11",
    detail: "Within target response goal",
    tone: "positive",
  },
  {
    label: "Pending Narratives",
    value: "4",
    detail: "Require end-of-shift completion",
    tone: "critical",
  },
];

export const DISPATCH_TABLE_COLUMNS = [
  "Call ID",
  "Type",
  "Priority",
  "Address",
  "Assigned Units",
  "Status",
];

export const DISPATCH_TABLE_ROWS: string[][] = [
  [
    "D-260218-101",
    "Medical",
    "Priority 2",
    "412 River St",
    "Engine 2, Medic 4",
    "En Route",
  ],
  [
    "D-260218-099",
    "Alarm Activation",
    "Priority 3",
    "95 Oak Ave",
    "Engine 1, Ladder 6",
    "On Scene",
  ],
  [
    "D-260218-094",
    "MVC",
    "Priority 2",
    "Hwy 62 MM 17",
    "Rescue 3, Medic 2",
    "Transport",
  ],
  [
    "D-260218-089",
    "Lift Assist",
    "Priority 4",
    "311 Aspen Ct",
    "Engine 5",
    "Cleared",
  ],
  [
    "D-260218-082",
    "Structure Fire",
    "Priority 1",
    "16 Harbor Ln",
    "2 Alarm Assignment",
    "Command",
  ],
];

export const DISPATCH_UNIT_STATUSES: Array<{
  unit: string;
  type: string;
  assignment: string;
  status: string;
  tone: Tone;
}> = [
  {
    unit: "Engine 1",
    type: "Engine",
    assignment: "D-260218-099",
    status: "On Scene",
    tone: "warning",
  },
  {
    unit: "Engine 2",
    type: "Engine",
    assignment: "D-260218-101",
    status: "En Route",
    tone: "warning",
  },
  {
    unit: "Ladder 6",
    type: "Truck",
    assignment: "D-260218-099",
    status: "On Scene",
    tone: "warning",
  },
  {
    unit: "Medic 4",
    type: "Medic",
    assignment: "D-260218-101",
    status: "En Route",
    tone: "warning",
  },
  {
    unit: "Rescue 3",
    type: "Rescue",
    assignment: "D-260218-094",
    status: "Transport",
    tone: "neutral",
  },
  {
    unit: "Brush 7",
    type: "Brush",
    assignment: "None",
    status: "Available",
    tone: "positive",
  },
];

export const DISPATCH_ALERTS: AlertItem[] = [
  {
    title: "Escalated structure fire",
    detail: "D-260218-082 has been upgraded to second alarm assignment.",
    time: "4m ago",
    tone: "critical",
  },
  {
    title: "Hydrant exception nearby",
    detail: "Hydrant H-112 near Harbor Ln reported out of service.",
    time: "11m ago",
    tone: "warning",
  },
  {
    title: "CAD relay healthy",
    detail: "CAD bridge is up and processing incoming calls with no delay.",
    time: "20m ago",
    tone: "positive",
  },
  {
    title: "Narrative backlog warning",
    detail: "4 dispatch narratives still pending completion for this shift.",
    time: "39m ago",
    tone: "warning",
  },
];

export const DISPATCH_ACTIVITY: string[] = [
  "Medic 4 acknowledged dispatch and marked en route.",
  "Command upgraded D-260218-082 to second alarm assignment.",
  "Dispatch supervisor manually linked hydrant warning to Harbor incident.",
  "Rescue 3 marked patient transport and updated hospital destination.",
  "Auto-notification sent to command staff for all Priority 1 calls.",
];

export const SUBMENU_PLACEHOLDER_NOTES: string[] = [
  "Route is connected and ready for full data model integration.",
  "Page shell can support table, details panel, and create/edit workflows.",
  "Role-based permissions can be layered as module behavior is implemented.",
  "API integration and dispatch center ingestion can be wired in this module.",
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

export function getVisibleMenus(role: UserRole): MainMenu[] {
  if (role === "admin") {
    return MAIN_MENUS;
  }

  return MAIN_MENUS.filter((menu) => !menu.adminOnly);
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
  for (const menu of MAIN_MENUS) {
    const submenu = menu.submenus.find((item) => item.path === normalizedPath);
    if (submenu) {
      return submenu;
    }
  }
  return undefined;
}

export function isPathAdminOnly(pathname: string): boolean {
  const normalizedPath = normalizePath(pathname);
  const matchedMenu = getMainMenuByPath(normalizedPath);
  if (!matchedMenu) {
    return false;
  }

  if (matchedMenu.adminOnly) {
    return true;
  }

  const submenu = matchedMenu.submenus.find((item) => item.path === normalizedPath);
  return Boolean(submenu?.adminOnly);
}

export function getMenuSummary(pathname: string): string {
  const submenu = getSubmenuByPath(pathname);
  if (submenu) {
    return submenu.summary;
  }

  const menu = getMainMenuByPath(pathname);
  return menu?.summary ?? "Module route connected.";
}

export function getDefaultPathForRole(role: UserRole): string {
  return role === "admin" ? "/dashboard" : "/dashboard";
}

