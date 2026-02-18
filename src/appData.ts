import {
  BadgeCheck,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  Flame,
  Fuel,
  LayoutDashboard,
  MessageSquare,
  NotebookText,
  RadioTower,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type ModuleId =
  | "dashboard"
  | "certifications"
  | "checklists"
  | "dailyLogs"
  | "dispatches"
  | "equipment"
  | "events"
  | "fuelLogs"
  | "incidents"
  | "maintenance"
  | "meetings"
  | "messages"
  | "personnel"
  | "vendors";

export type PrimaryModuleId = Exclude<ModuleId, "dashboard">;

export type Tone = "positive" | "warning" | "critical" | "neutral";

export interface ModuleStat {
  label: string;
  value: string;
  change: string;
  tone: Tone;
}

export interface ModuleAlert {
  title: string;
  detail: string;
  time: string;
  tone: Tone;
}

export interface ModuleContent {
  title: string;
  subtitle: string;
  primaryAction: string;
  secondaryAction: string;
  stats: ModuleStat[];
  tableTitle: string;
  tableColumns: string[];
  tableRows: string[][];
  alertsTitle: string;
  alerts: ModuleAlert[];
  activityTitle: string;
  activity: string[];
}

export interface NavSubmenu {
  label: string;
  path: `/${string}`;
}

export interface NavModule {
  id: ModuleId;
  title: string;
  path: `/${string}`;
  icon: LucideIcon;
  summary: string;
  submenu: NavSubmenu[];
}

export const NAV_MODULES: NavModule[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    summary: "System readiness, live activity, and priority alerts.",
    submenu: [
      { label: "Overview", path: "/dashboard/overview" },
      { label: "Activity Feed", path: "/dashboard/activity-feed" },
      { label: "Unit Status", path: "/dashboard/unit-status" },
      { label: "Analytics", path: "/dashboard/analytics" },
    ],
  },
  {
    id: "certifications",
    title: "Certifications",
    path: "/certifications",
    icon: BadgeCheck,
    summary: "Track personnel compliance and expiring credentials.",
    submenu: [
      { label: "Certifications List", path: "/certifications/list" },
      { label: "Certification Types", path: "/certifications/types" },
      { label: "Expiring Soon", path: "/certifications/expiring" },
      { label: "Certification Reports", path: "/certifications/reports" },
    ],
  },
  {
    id: "checklists",
    title: "Checklists",
    path: "/checklists",
    icon: ClipboardList,
    summary: "Standardize station tasks and operational readiness checks.",
    submenu: [
      { label: "Active Checklists", path: "/checklists/active" },
      { label: "Checklist Templates", path: "/checklists/templates" },
      { label: "Assignments", path: "/checklists/assignments" },
      { label: "Audit Trail", path: "/checklists/audit" },
    ],
  },
  {
    id: "dailyLogs",
    title: "Daily Logs",
    path: "/daily-logs",
    icon: NotebookText,
    summary: "Capture day-to-day operations and station observations.",
    submenu: [
      { label: "Daily Log Entries", path: "/daily-logs/entries" },
      { label: "Water Logs", path: "/daily-logs/water-logs" },
      { label: "Mileage Logs", path: "/daily-logs/mileage-logs" },
      { label: "Attachments", path: "/daily-logs/documents" },
    ],
  },
  {
    id: "dispatches",
    title: "Dispatches",
    path: "/dispatches",
    icon: RadioTower,
    summary: "Manage incoming calls, CAD imports, and dispatch workflows.",
    submenu: [
      { label: "Dispatch List", path: "/dispatches/list" },
      { label: "Create Dispatch", path: "/dispatches/create" },
      { label: "Dispatch Dropbox", path: "/dispatches/dropbox" },
      { label: "Incident Types", path: "/dispatches/incident-types" },
    ],
  },
  {
    id: "equipment",
    title: "Equipment",
    path: "/equipment",
    icon: Wrench,
    summary: "Inventory and serviceability across apparatus and gear.",
    submenu: [
      { label: "Equipment List", path: "/equipment/list" },
      { label: "Units", path: "/equipment/units" },
      { label: "Hydrants", path: "/equipment/hydrants" },
      { label: "Training Assets", path: "/equipment/training-assets" },
    ],
  },
  {
    id: "events",
    title: "Events",
    path: "/events",
    icon: CalendarDays,
    summary: "Plan and track community, training, and station events.",
    submenu: [
      { label: "Event Calendar", path: "/events/calendar" },
      { label: "Event Types", path: "/events/types" },
      { label: "Smoke Alarm Requests", path: "/events/smoke-alarms" },
      { label: "Outreach Programs", path: "/events/outreach" },
    ],
  },
  {
    id: "fuelLogs",
    title: "Fuel Logs",
    path: "/fuel-logs",
    icon: Fuel,
    summary: "Track fuel usage, trends, and accountability by unit.",
    submenu: [
      { label: "Fuel Entries", path: "/fuel-logs/entries" },
      { label: "Create Fuel Log", path: "/fuel-logs/create" },
      { label: "Usage Trends", path: "/fuel-logs/trends" },
      { label: "Fuel Vendors", path: "/fuel-logs/vendors" },
    ],
  },
  {
    id: "incidents",
    title: "Incidents",
    path: "/incidents",
    icon: Flame,
    summary: "Document incidents, investigations, and response outcomes.",
    submenu: [
      { label: "Incident List", path: "/incidents/list" },
      { label: "Create Incident", path: "/incidents/create" },
      { label: "Fire Investigations", path: "/incidents/fire-investigations" },
      { label: "Incident Analytics", path: "/incidents/analytics" },
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance",
    path: "/maintenance",
    icon: Wrench,
    summary: "Preventive and corrective maintenance operations.",
    submenu: [
      { label: "Work Orders", path: "/maintenance/work-orders" },
      { label: "PM Schedules", path: "/maintenance/pm-schedules" },
      { label: "Compliance", path: "/maintenance/compliance" },
      { label: "Maintenance Vendors", path: "/maintenance/vendors" },
    ],
  },
  {
    id: "meetings",
    title: "Meetings",
    path: "/meetings",
    icon: CalendarCheck2,
    summary: "Coordinate agendas, notes, and follow-up accountability.",
    submenu: [
      { label: "Meeting Schedule", path: "/meetings/schedule" },
      { label: "Agendas", path: "/meetings/agendas" },
      { label: "Minutes", path: "/meetings/minutes" },
      { label: "Action Items", path: "/meetings/action-items" },
    ],
  },
  {
    id: "messages",
    title: "Messages",
    path: "/messages",
    icon: MessageSquare,
    summary: "Internal messaging, broadcast updates, and groups.",
    submenu: [
      { label: "Inbox", path: "/messages/inbox" },
      { label: "Conversations", path: "/messages/conversations" },
      { label: "Message Groups", path: "/messages/groups" },
      { label: "Broadcast Templates", path: "/messages/templates" },
    ],
  },
  {
    id: "personnel",
    title: "Personnel",
    path: "/personnel",
    icon: Users,
    summary: "Roster management, assignments, and shift tracking.",
    submenu: [
      { label: "Roster", path: "/personnel/roster" },
      { label: "Roles & Permissions", path: "/personnel/roles" },
      { label: "Shift Assignments", path: "/personnel/shifts" },
      { label: "Personnel Certifications", path: "/personnel/certifications" },
    ],
  },
  {
    id: "vendors",
    title: "Vendors",
    path: "/vendors",
    icon: Building2,
    summary: "External contacts for supplies, services, and contracts.",
    submenu: [
      { label: "Vendor Directory", path: "/vendors/directory" },
      { label: "Service Contracts", path: "/vendors/contracts" },
      { label: "Service History", path: "/vendors/service-history" },
      { label: "Vendor Contacts", path: "/vendors/contacts" },
    ],
  },
];

export const PRIMARY_MODULES = NAV_MODULES.filter(
  (module) => module.id !== "dashboard",
) as Array<NavModule & { id: PrimaryModuleId }>;

export const MODULE_CONTENT: Record<PrimaryModuleId, ModuleContent> = {
  certifications: {
    title: "Certifications",
    subtitle:
      "Credential compliance, expiration tracking, and certification readiness.",
    primaryAction: "Add Certification",
    secondaryAction: "Export Roster",
    stats: [
      { label: "Active Certifications", value: "642", change: "+18 this month", tone: "positive" },
      { label: "Expiring in 30 Days", value: "27", change: "Need renewal", tone: "warning" },
      { label: "Expired", value: "4", change: "Immediate action", tone: "critical" },
      { label: "Compliance Rate", value: "97.2%", change: "+1.4%", tone: "positive" },
    ],
    tableTitle: "Certification Queue",
    tableColumns: ["Member", "Certification", "Issued", "Expires", "Status"],
    tableRows: [
      ["A. Martinez", "Fire Officer I", "2024-03-14", "2026-03-14", "Active"],
      ["R. Singh", "HazMat Ops", "2023-08-20", "2026-02-28", "Renewal Due"],
      ["C. Johnson", "EMT-B", "2024-06-11", "2026-05-10", "Active"],
      ["P. Williams", "Driver Operator", "2022-01-02", "2026-02-24", "Urgent"],
      ["L. Garcia", "Instructor II", "2024-05-09", "2027-05-09", "Active"],
    ],
    alertsTitle: "Compliance Alerts",
    alerts: [
      {
        title: "Renewal packet pending",
        detail: "HazMat Ops renewals have 3 members pending paperwork.",
        time: "Updated 9m ago",
        tone: "warning",
      },
      {
        title: "Expired certification",
        detail: "P. Williams Driver Operator expired overnight.",
        time: "Updated 32m ago",
        tone: "critical",
      },
      {
        title: "State sync completed",
        detail: "Credential verification sync finished without errors.",
        time: "Updated 1h ago",
        tone: "positive",
      },
    ],
    activityTitle: "Recent Certification Activity",
    activity: [
      "M. Harris renewed Firefighter II and moved to active status.",
      "Quarterly CPR recertification campaign launched for B Shift.",
      "System generated 14 automated renewal reminders.",
      "Certification types updated for new EMS protocol revisions.",
    ],
  },
  checklists: {
    title: "Checklists",
    subtitle: "Readiness workflows for apparatus, stations, and shift duties.",
    primaryAction: "Create Checklist",
    secondaryAction: "Manage Templates",
    stats: [
      { label: "Open Checklists", value: "39", change: "+7 today", tone: "warning" },
      { label: "Completed Today", value: "112", change: "+9% vs yesterday", tone: "positive" },
      { label: "Overdue Tasks", value: "11", change: "Needs follow-up", tone: "critical" },
      { label: "Completion Rate", value: "91.6%", change: "+2.1%", tone: "positive" },
    ],
    tableTitle: "Active Shift Checklists",
    tableColumns: ["Checklist", "Assigned To", "Station", "Due", "Status"],
    tableRows: [
      ["Engine 2 Pre-Trip", "B Shift", "Station 1", "07:00", "In Progress"],
      ["PPE Readiness", "A Shift", "Station 3", "08:30", "Open"],
      ["SCBA Audit", "Training", "Station 2", "10:00", "Open"],
      ["Rescue Unit Inventory", "C Shift", "Station 1", "06:45", "Completed"],
      ["Generator Inspection", "Facilities", "HQ", "11:30", "Overdue"],
    ],
    alertsTitle: "Checklist Exceptions",
    alerts: [
      {
        title: "Failed item flagged",
        detail: "Engine 2 fuel card missing during pre-trip inspection.",
        time: "7m ago",
        tone: "critical",
      },
      {
        title: "Template update available",
        detail: "SCBA audit template revised with 2 new NFPA checks.",
        time: "21m ago",
        tone: "warning",
      },
      {
        title: "Auto-assignment complete",
        detail: "Daily station opening tasks assigned to morning crews.",
        time: "58m ago",
        tone: "positive",
      },
    ],
    activityTitle: "Checklist Timeline",
    activity: [
      "Engine 2 pre-trip checklist reached 85% completion.",
      "Station 3 housekeeping checklist marked complete.",
      "Facilities team acknowledged overdue generator inspection.",
      "A Shift completed hydration and rehabilitation supply check.",
    ],
  },
  dailyLogs: {
    title: "Daily Logs",
    subtitle: "Shift notes, station events, and operational documentation.",
    primaryAction: "Create Daily Log",
    secondaryAction: "Export Logbook",
    stats: [
      { label: "Logs Entered Today", value: "46", change: "+12 since 06:00", tone: "positive" },
      { label: "Pending Supervisor Review", value: "8", change: "Awaiting approval", tone: "warning" },
      { label: "Unresolved Issues", value: "3", change: "Escalated", tone: "critical" },
      { label: "Avg. Entry Time", value: "5m 12s", change: "-14s", tone: "positive" },
    ],
    tableTitle: "Recent Log Entries",
    tableColumns: ["Time", "Station", "Author", "Summary", "Status"],
    tableRows: [
      ["06:42", "Station 1", "L. Rivera", "Morning apparatus checks completed", "Approved"],
      ["07:05", "Station 2", "J. Brown", "SCBA bottle refill delayed", "Needs Follow-up"],
      ["08:17", "HQ", "M. Kim", "Vendor scheduled for bay door service", "Open"],
      ["08:41", "Station 3", "R. Nguyen", "Community tour group arrived", "Approved"],
      ["09:03", "Station 1", "D. Clark", "Medic 4 tablet battery replaced", "Approved"],
    ],
    alertsTitle: "Flagged Entries",
    alerts: [
      {
        title: "Operational issue",
        detail: "Station 2 reported SCBA refill delay > 30 minutes.",
        time: "6m ago",
        tone: "warning",
      },
      {
        title: "Supervisor note required",
        detail: "HQ maintenance log entry missing resolution note.",
        time: "29m ago",
        tone: "critical",
      },
      {
        title: "Documentation quality",
        detail: "Daily log completion quality score improved to 94%.",
        time: "1h ago",
        tone: "positive",
      },
    ],
    activityTitle: "Daily Log Stream",
    activity: [
      "Station 3 added outreach event attendance totals.",
      "Engine 5 documented post-call decon completion.",
      "Watch commander approved all overnight entries.",
      "HQ training room readiness noted for afternoon drill.",
    ],
  },
  dispatches: {
    title: "Dispatches",
    subtitle: "Call intake, dispatch lifecycle, and responder coordination.",
    primaryAction: "Create Dispatch",
    secondaryAction: "Open CAD Dropbox",
    stats: [
      { label: "Open Dispatches", value: "14", change: "+2 active", tone: "warning" },
      { label: "Average Turnout", value: "01:47", change: "-00:08", tone: "positive" },
      { label: "Escalated Calls", value: "2", change: "High priority", tone: "critical" },
      { label: "Resolved Today", value: "63", change: "+11%", tone: "positive" },
    ],
    tableTitle: "Dispatch Board",
    tableColumns: ["Call ID", "Type", "Address", "Assigned Units", "Status"],
    tableRows: [
      ["D-260218-101", "Medical", "412 River St", "Medic 4, Engine 2", "En Route"],
      ["D-260218-099", "Alarm", "95 Oak Ave", "Engine 1, Ladder 6", "On Scene"],
      ["D-260218-094", "MVC", "Hwy 62 MM 17", "Rescue 3, Medic 2", "Transport"],
      ["D-260218-087", "Lift Assist", "311 Aspen Ct", "Engine 5", "Cleared"],
      ["D-260218-082", "Structure Fire", "16 Harbor Ln", "2 Alarm Assignment", "Command"],
    ],
    alertsTitle: "Dispatch Alerts",
    alerts: [
      {
        title: "CAD relay delay",
        detail: "One relay account is running 90 seconds behind.",
        time: "4m ago",
        tone: "warning",
      },
      {
        title: "Priority call escalation",
        detail: "Structure fire call moved to second alarm assignment.",
        time: "12m ago",
        tone: "critical",
      },
      {
        title: "Data bridge healthy",
        detail: "Dispatch Dropbox processed all inbound feeds.",
        time: "36m ago",
        tone: "positive",
      },
    ],
    activityTitle: "Dispatch Activity",
    activity: [
      "Medic 4 marked available and returned to station.",
      "Dispatch D-260218-094 changed from On Scene to Transport.",
      "Incident type matrix refreshed from agency settings.",
      "Mutual aid unit accepted auto-generated dispatch alert.",
    ],
  },
  equipment: {
    title: "Equipment",
    subtitle: "Asset visibility, readiness, and lifecycle tracking.",
    primaryAction: "Add Equipment",
    secondaryAction: "Run Inventory Audit",
    stats: [
      { label: "Tracked Assets", value: "1,284", change: "+14 added", tone: "positive" },
      { label: "Out of Service", value: "17", change: "Repair needed", tone: "warning" },
      { label: "Inspection Overdue", value: "9", change: "Critical checks pending", tone: "critical" },
      { label: "Utilization Rate", value: "88.3%", change: "+3.5%", tone: "positive" },
    ],
    tableTitle: "Equipment Readiness",
    tableColumns: ["Asset", "Category", "Location", "Last Service", "Status"],
    tableRows: [
      ["Engine 1 Pump Panel", "Apparatus", "Station 1", "2026-02-01", "Ready"],
      ["Thermal Camera #12", "Investigation", "Station 2", "2026-01-18", "Service Due"],
      ["SCBA Pack 44", "PPE", "Station 1", "2026-02-12", "Ready"],
      ["Generator G-3", "Facilities", "HQ", "2025-12-03", "Out of Service"],
      ["Hydrant Wrench Kit", "Tools", "Engine 5", "2026-02-10", "Ready"],
    ],
    alertsTitle: "Equipment Alerts",
    alerts: [
      {
        title: "Out-of-service apparatus component",
        detail: "Generator G-3 flagged pending vendor repair.",
        time: "15m ago",
        tone: "critical",
      },
      {
        title: "Scheduled calibration",
        detail: "Thermal Camera #12 calibration due this week.",
        time: "31m ago",
        tone: "warning",
      },
      {
        title: "Inventory sync complete",
        detail: "Station 1 and Station 3 inventory counts reconciled.",
        time: "1h ago",
        tone: "positive",
      },
    ],
    activityTitle: "Equipment Activity",
    activity: [
      "Rescue tools audit completed at Station 2.",
      "Hydrant map sync pushed 12 new records.",
      "Two SCBA packs reassigned to C Shift.",
      "Engine 1 pump test uploaded with passing score.",
    ],
  },
  events: {
    title: "Events",
    subtitle: "Event lifecycle for public safety and internal initiatives.",
    primaryAction: "Create Event",
    secondaryAction: "Open Event Calendar",
    stats: [
      { label: "Upcoming Events", value: "23", change: "+5 this week", tone: "positive" },
      { label: "Pending Approvals", value: "6", change: "Review required", tone: "warning" },
      { label: "Scheduling Conflicts", value: "2", change: "Resolve staffing", tone: "critical" },
      { label: "Attendance Rate", value: "94%", change: "+1.2%", tone: "positive" },
    ],
    tableTitle: "Event Schedule",
    tableColumns: ["Event", "Type", "Start", "Location", "Status"],
    tableRows: [
      ["CPR Community Class", "Public Education", "Feb 21 09:00", "Station 2", "Confirmed"],
      ["Hose Evolution Drill", "Training", "Feb 22 14:00", "Drill Yard", "Confirmed"],
      ["Smoke Alarm Install", "Outreach", "Feb 23 10:30", "Oak District", "Pending"],
      ["Officer Development", "Internal", "Feb 24 08:00", "HQ", "Draft"],
      ["School Fire Safety Talk", "Public Education", "Feb 24 13:00", "Riverside Elementary", "Confirmed"],
    ],
    alertsTitle: "Event Alerts",
    alerts: [
      {
        title: "Staffing conflict",
        detail: "Two events overlap with minimum shift staffing window.",
        time: "10m ago",
        tone: "warning",
      },
      {
        title: "Permit requirement",
        detail: "Community event requires updated city permit upload.",
        time: "22m ago",
        tone: "critical",
      },
      {
        title: "Attendance trend",
        detail: "Public outreach attendance exceeded monthly target.",
        time: "1h ago",
        tone: "positive",
      },
    ],
    activityTitle: "Event Activity",
    activity: [
      "Smoke alarm outreach event moved to Oak District lot B.",
      "Instructor assignment confirmed for hose evolution drill.",
      "Calendar invite sent to mutual aid coordinator.",
      "Public education packet uploaded for school presentation.",
    ],
  },
  fuelLogs: {
    title: "Fuel Logs",
    subtitle: "Consumption tracking and reconciliation by unit and vendor.",
    primaryAction: "Create Fuel Log",
    secondaryAction: "Download Fuel Report",
    stats: [
      { label: "Entries This Month", value: "312", change: "+24", tone: "positive" },
      { label: "Unapproved Entries", value: "11", change: "Review queue", tone: "warning" },
      { label: "Variance Exceptions", value: "3", change: "Investigate", tone: "critical" },
      { label: "Avg MPG Fleet", value: "6.8", change: "+0.3", tone: "positive" },
    ],
    tableTitle: "Recent Fuel Entries",
    tableColumns: ["Date", "Unit", "Gallons", "Vendor", "Status"],
    tableRows: [
      ["2026-02-18", "Engine 2", "34.2", "City Fuel Depot", "Approved"],
      ["2026-02-18", "Medic 4", "16.8", "West Supply", "Approved"],
      ["2026-02-17", "Ladder 6", "42.6", "City Fuel Depot", "Pending"],
      ["2026-02-17", "Rescue 3", "21.9", "Station Tank", "Approved"],
      ["2026-02-17", "Engine 5", "37.4", "West Supply", "Variance"],
    ],
    alertsTitle: "Fuel Monitoring Alerts",
    alerts: [
      {
        title: "Variance detected",
        detail: "Engine 5 fuel variance exceeded tolerance by 8%.",
        time: "8m ago",
        tone: "critical",
      },
      {
        title: "Pending approvals",
        detail: "11 fuel entries are awaiting supervisor sign-off.",
        time: "18m ago",
        tone: "warning",
      },
      {
        title: "Cost trend favorable",
        detail: "Average fuel cost down 2.4% over prior month.",
        time: "52m ago",
        tone: "positive",
      },
    ],
    activityTitle: "Fuel Activity",
    activity: [
      "City Fuel Depot uploaded overnight transaction file.",
      "Ladder 6 entry auto-matched to odometer reading.",
      "Variance workflow opened for Engine 5 review.",
      "Monthly fuel spend report sent to command staff.",
    ],
  },
  incidents: {
    title: "Incidents",
    subtitle: "Track incident reports, narratives, and investigation workflow.",
    primaryAction: "Create Incident",
    secondaryAction: "Open Investigations",
    stats: [
      { label: "Open Incidents", value: "31", change: "+4 today", tone: "warning" },
      { label: "Closed This Week", value: "74", change: "+12%", tone: "positive" },
      { label: "Report Backlog", value: "5", change: "Needs completion", tone: "critical" },
      { label: "Avg Closure Time", value: "19h", change: "-3h", tone: "positive" },
    ],
    tableTitle: "Incident Workflow",
    tableColumns: ["Incident #", "Type", "Lead", "Last Update", "Status"],
    tableRows: [
      ["INC-2602-431", "Structure Fire", "Capt. Ortiz", "09:10", "Active"],
      ["INC-2602-428", "Medical Assist", "Lt. Bell", "08:44", "Pending Report"],
      ["INC-2602-422", "HazMat", "Capt. Miles", "07:58", "Investigation"],
      ["INC-2602-416", "Vehicle Fire", "Lt. Gomez", "07:30", "Closed"],
      ["INC-2602-409", "Alarm", "Capt. Ray", "06:55", "Closed"],
    ],
    alertsTitle: "Incident Alerts",
    alerts: [
      {
        title: "Narrative pending",
        detail: "INC-2602-428 requires narrative before shift close.",
        time: "11m ago",
        tone: "warning",
      },
      {
        title: "Investigation escalation",
        detail: "INC-2602-422 escalated for follow-up evidence intake.",
        time: "27m ago",
        tone: "critical",
      },
      {
        title: "Closure velocity",
        detail: "Incident closure time remains under target.",
        time: "1h ago",
        tone: "positive",
      },
    ],
    activityTitle: "Incident Timeline",
    activity: [
      "INC-2602-431 command notes updated by Capt. Ortiz.",
      "Investigation packet uploaded for INC-2602-422.",
      "Two incidents moved from report pending to closed.",
      "Automatic NERIS type mapping ran for all new incidents.",
    ],
  },
  maintenance: {
    title: "Maintenance",
    subtitle: "Service schedules, work orders, and compliance checkpoints.",
    primaryAction: "Create Work Order",
    secondaryAction: "View PM Dashboard",
    stats: [
      { label: "Open Work Orders", value: "28", change: "+3 today", tone: "warning" },
      { label: "Completed This Week", value: "53", change: "+8%", tone: "positive" },
      { label: "Critical Items", value: "4", change: "Immediate repair", tone: "critical" },
      { label: "PM On-Time Rate", value: "93.8%", change: "+1.1%", tone: "positive" },
    ],
    tableTitle: "Maintenance Board",
    tableColumns: ["Work Order", "Asset", "Assigned To", "Due", "Status"],
    tableRows: [
      ["WO-6402", "Engine 1 Pump", "Fleet Team", "Feb 19", "In Progress"],
      ["WO-6398", "Station 2 HVAC", "Facilities", "Feb 20", "Scheduled"],
      ["WO-6394", "Medic 4 Power Cot", "Vendor", "Feb 18", "Urgent"],
      ["WO-6389", "Ladder 6 Lighting", "Fleet Team", "Feb 17", "Completed"],
      ["WO-6384", "HQ Bay Door", "Facilities", "Feb 21", "Awaiting Parts"],
    ],
    alertsTitle: "Maintenance Alerts",
    alerts: [
      {
        title: "Critical medical equipment",
        detail: "Medic 4 power cot repair has urgent designation.",
        time: "5m ago",
        tone: "critical",
      },
      {
        title: "PM schedule drift",
        detail: "Three preventive checks moved past due by 24h.",
        time: "16m ago",
        tone: "warning",
      },
      {
        title: "Vendor SLA met",
        detail: "Average vendor response is within contract SLA.",
        time: "47m ago",
        tone: "positive",
      },
    ],
    activityTitle: "Maintenance Activity",
    activity: [
      "WO-6398 accepted by facilities supervisor.",
      "Fleet team logged initial diagnostics for Engine 1 pump.",
      "PM checklist auto-generated for next seven days.",
      "Vendor appointment confirmed for HQ bay door hardware.",
    ],
  },
  meetings: {
    title: "Meetings",
    subtitle: "Command, business, and shift meetings with action tracking.",
    primaryAction: "Schedule Meeting",
    secondaryAction: "Publish Agenda",
    stats: [
      { label: "Upcoming Meetings", value: "12", change: "+2 this week", tone: "positive" },
      { label: "Draft Agendas", value: "5", change: "Needs owner review", tone: "warning" },
      { label: "Overdue Action Items", value: "6", change: "Follow-up needed", tone: "critical" },
      { label: "Attendance Avg", value: "92%", change: "+4%", tone: "positive" },
    ],
    tableTitle: "Meeting Schedule",
    tableColumns: ["Meeting", "Date", "Owner", "Location", "Status"],
    tableRows: [
      ["Command Staff", "Feb 19 08:00", "Chief Mason", "HQ Boardroom", "Confirmed"],
      ["Training Committee", "Feb 20 14:00", "Capt. Reid", "Station 1", "Draft Agenda"],
      ["Quarterly Budget", "Feb 21 10:00", "Admin Office", "HQ", "Confirmed"],
      ["Safety Review", "Feb 22 09:30", "Lt. Holt", "Virtual", "Pending"],
      ["Apparatus Planning", "Feb 24 13:30", "Fleet Lead", "HQ", "Confirmed"],
    ],
    alertsTitle: "Meeting Alerts",
    alerts: [
      {
        title: "Action item overdue",
        detail: "Safety Review corrective action #14 is 3 days overdue.",
        time: "14m ago",
        tone: "critical",
      },
      {
        title: "Agenda approval needed",
        detail: "Training Committee agenda awaiting command approval.",
        time: "24m ago",
        tone: "warning",
      },
      {
        title: "Attendance improving",
        detail: "Command Staff attendance exceeded quarterly goal.",
        time: "56m ago",
        tone: "positive",
      },
    ],
    activityTitle: "Meeting Activity",
    activity: [
      "Minutes uploaded for prior week command meeting.",
      "Budget packet attached for Quarterly Budget meeting.",
      "Action item owners reassigned to shift captains.",
      "Calendar sync updated with all confirmed meetings.",
    ],
  },
  messages: {
    title: "Messages",
    subtitle: "Internal communications across members, groups, and shifts.",
    primaryAction: "New Message",
    secondaryAction: "Create Group",
    stats: [
      { label: "Unread Messages", value: "37", change: "+5 since 08:00", tone: "warning" },
      { label: "Broadcasts Sent Today", value: "9", change: "+2", tone: "positive" },
      { label: "Urgent Threads", value: "3", change: "Priority watch", tone: "critical" },
      { label: "Average Response", value: "11m", change: "-2m", tone: "positive" },
    ],
    tableTitle: "Message Threads",
    tableColumns: ["Thread", "Participants", "Last Message", "Priority", "Status"],
    tableRows: [
      ["Shift Coverage", "A Shift Captains", "08:52", "Normal", "Open"],
      ["Hydrant Repair Updates", "Maintenance + Ops", "08:47", "High", "Open"],
      ["Event Staffing", "Training + Outreach", "08:21", "Normal", "Open"],
      ["CAD Relay Notice", "Dispatch Team", "07:58", "Urgent", "Flagged"],
      ["Station 2 Supplies", "Logistics", "07:44", "Normal", "Resolved"],
    ],
    alertsTitle: "Messaging Alerts",
    alerts: [
      {
        title: "Urgent thread flagged",
        detail: "CAD Relay Notice requires acknowledgement from all users.",
        time: "9m ago",
        tone: "critical",
      },
      {
        title: "Unread threshold",
        detail: "Unread count exceeded configured threshold of 30.",
        time: "19m ago",
        tone: "warning",
      },
      {
        title: "Delivery health",
        detail: "Message delivery and push notifications are healthy.",
        time: "41m ago",
        tone: "positive",
      },
    ],
    activityTitle: "Messaging Activity",
    activity: [
      "Broadcast sent for station weather advisory.",
      "Group created for hydrant maintenance strike team.",
      "Three urgent acknowledgements received from C Shift.",
      "Template library updated with storm response messages.",
    ],
  },
  personnel: {
    title: "Personnel",
    subtitle: "Member records, staffing allocations, and role management.",
    primaryAction: "Add Personnel",
    secondaryAction: "Open Shift Scheduler",
    stats: [
      { label: "Active Personnel", value: "186", change: "+4 this quarter", tone: "positive" },
      { label: "Open Positions", value: "7", change: "Recruiting", tone: "warning" },
      { label: "Expired Credentials", value: "3", change: "Immediate update", tone: "critical" },
      { label: "Shift Fill Rate", value: "96%", change: "+1.7%", tone: "positive" },
    ],
    tableTitle: "Personnel Roster",
    tableColumns: ["Name", "Rank", "Station", "Shift", "Status"],
    tableRows: [
      ["Alex Martinez", "Captain", "Station 1", "A", "On Duty"],
      ["Jordan Bell", "Lieutenant", "Station 3", "B", "On Duty"],
      ["Sam Patel", "Firefighter/EMT", "Station 2", "C", "Leave Pending"],
      ["Taylor Nguyen", "Engineer", "Station 1", "A", "On Duty"],
      ["Morgan Hayes", "Paramedic", "Medic 4", "B", "Training"],
    ],
    alertsTitle: "Personnel Alerts",
    alerts: [
      {
        title: "Credential exception",
        detail: "Three members have credentials expiring this week.",
        time: "6m ago",
        tone: "critical",
      },
      {
        title: "Shift staffing risk",
        detail: "B Shift is one person below ideal staffing level.",
        time: "17m ago",
        tone: "warning",
      },
      {
        title: "Roster sync complete",
        detail: "Personnel updates synced from HR integration.",
        time: "1h ago",
        tone: "positive",
      },
    ],
    activityTitle: "Personnel Activity",
    activity: [
      "New probationary firefighter added to Station 2.",
      "Leave request approved for two C Shift members.",
      "Role permissions updated for training officers.",
      "Shift bid results posted for next schedule cycle.",
    ],
  },
  vendors: {
    title: "Vendors",
    subtitle: "Service providers, procurement contacts, and vendor lifecycle.",
    primaryAction: "Add Vendor",
    secondaryAction: "Review Contracts",
    stats: [
      { label: "Active Vendors", value: "84", change: "+3 this month", tone: "positive" },
      { label: "Contracts Expiring", value: "9", change: "Renewal review", tone: "warning" },
      { label: "At-Risk Vendors", value: "2", change: "Performance alerts", tone: "critical" },
      { label: "On-Time Delivery", value: "93%", change: "+2%", tone: "positive" },
    ],
    tableTitle: "Vendor Directory",
    tableColumns: ["Vendor", "Category", "Primary Contact", "Contract End", "Status"],
    tableRows: [
      ["Metro Fleet Services", "Apparatus Service", "D. Cortez", "2026-09-30", "Active"],
      ["West Supply Co.", "Medical Supplies", "R. Lewis", "2026-05-12", "Renewal Window"],
      ["Civic Fuel Depot", "Fuel", "A. Coleman", "2027-01-01", "Active"],
      ["StationTech Systems", "Software", "S. Adler", "2026-03-31", "Performance Review"],
      ["Rapid Door & Gate", "Facilities", "N. Evans", "2026-11-15", "Active"],
    ],
    alertsTitle: "Vendor Alerts",
    alerts: [
      {
        title: "Contract nearing expiration",
        detail: "West Supply Co. enters renewal window in 45 days.",
        time: "13m ago",
        tone: "warning",
      },
      {
        title: "Performance issue",
        detail: "StationTech Systems has two unresolved SLA breaches.",
        time: "26m ago",
        tone: "critical",
      },
      {
        title: "Delivery trend improved",
        detail: "On-time delivery rate has increased month-over-month.",
        time: "49m ago",
        tone: "positive",
      },
    ],
    activityTitle: "Vendor Activity",
    activity: [
      "New fuel rate sheet uploaded by Civic Fuel Depot.",
      "Contract amendment drafted for Metro Fleet Services.",
      "Vendor scorecards recalculated for Q1 review.",
      "Facilities vendor contact list synced to messaging groups.",
    ],
  },
};

export const DASHBOARD_STATS: ModuleStat[] = [
  { label: "Active Incidents", value: "11", change: "+2 in the last hour", tone: "warning" },
  { label: "Units In Service", value: "27 / 30", change: "3 in maintenance", tone: "neutral" },
  { label: "Open Checklists", value: "39", change: "11 overdue items", tone: "critical" },
  { label: "Unread Messages", value: "37", change: "9 marked urgent", tone: "warning" },
];

export const DASHBOARD_DISPATCH_ROWS: string[][] = [
  ["D-260218-101", "Medical", "412 River St", "Engine 2, Medic 4", "En Route"],
  ["D-260218-099", "Alarm", "95 Oak Ave", "Engine 1, Ladder 6", "On Scene"],
  ["D-260218-094", "MVC", "Hwy 62 MM 17", "Rescue 3", "Transport"],
  ["D-260218-082", "Structure Fire", "16 Harbor Ln", "2 Alarm Assignment", "Command"],
];

export const DASHBOARD_CERTIFICATIONS: Array<{
  member: string;
  certification: string;
  expiresIn: string;
  tone: Tone;
}> = [
  { member: "P. Williams", certification: "Driver Operator", expiresIn: "6 days", tone: "critical" },
  { member: "R. Singh", certification: "HazMat Ops", expiresIn: "10 days", tone: "warning" },
  { member: "J. Thompson", certification: "EMT-B", expiresIn: "14 days", tone: "warning" },
  { member: "N. Adams", certification: "Instructor I", expiresIn: "22 days", tone: "neutral" },
];

export const DASHBOARD_READINESS: Array<{
  label: string;
  complete: number;
  total: number;
}> = [
  { label: "Apparatus Checks", complete: 21, total: 24 },
  { label: "PPE Verification", complete: 58, total: 64 },
  { label: "Station Opening", complete: 12, total: 12 },
  { label: "Hydrant Inspections", complete: 38, total: 52 },
];

export const DASHBOARD_TIMELINE: ModuleAlert[] = [
  {
    title: "Critical call escalation",
    detail: "Dispatch D-260218-082 moved to second alarm.",
    time: "5m ago",
    tone: "critical",
  },
  {
    title: "Maintenance update",
    detail: "Generator G-3 repair ETA confirmed for 13:00.",
    time: "16m ago",
    tone: "warning",
  },
  {
    title: "Checklist completion",
    detail: "Station 3 opening checklist marked complete.",
    time: "24m ago",
    tone: "positive",
  },
  {
    title: "Personnel alert",
    detail: "One credential nearing expiration threshold.",
    time: "31m ago",
    tone: "warning",
  },
  {
    title: "Data synchronization",
    detail: "CAD relay and roster sync completed successfully.",
    time: "52m ago",
    tone: "positive",
  },
];

export const SUBMENU_BUILD_NOTES: string[] = [
  "API contract and endpoint wiring for this submenu",
  "Data table filters, sorting, and export actions",
  "Create/Edit flows with validation and audit history",
  "Permission guardrails based on role access levels",
];

const MODULES_BY_PATH_LENGTH = [...NAV_MODULES].sort(
  (left, right) => right.path.length - left.path.length,
);

export function getModuleByPath(pathname: string): NavModule | undefined {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return MODULES_BY_PATH_LENGTH.find(
    (module) =>
      normalized === module.path ||
      normalized.startsWith(`${module.path}/`),
  );
}

export function getSubmenuLabel(pathname: string): string | undefined {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const module = getModuleByPath(normalized);
  if (!module) {
    return undefined;
  }

  return module.submenu.find((link) => link.path === normalized)?.label;
}

