import type { DashboardItem, DashboardWidgetId } from "../../api/dashboard";

export const DASHBOARD_COLS = 12;
export const DASHBOARD_ROW_HEIGHT = 56;

export interface WidgetInfo {
  id: DashboardWidgetId;
  title: string;
  description: string;
  /** Size used when the widget is added. */
  w: number;
  h: number;
}

export const WIDGETS: WidgetInfo[] = [
  { id: "clock", title: "Clock", description: "Large 24-hour clock and date.", w: 3, h: 2 },
  { id: "callStats", title: "Call Stats", description: "Calls today, this week and this year, and reports not yet exported.", w: 9, h: 2 },
  { id: "incidents", title: "Incidents", description: "Newest calls first.", w: 6, h: 5 },
  { id: "map", title: "Last Call Map", description: "The newest call with nearby markers.", w: 6, h: 5 },
  { id: "onDuty", title: "On Duty", description: "Who is on the schedule right now, by unit.", w: 4, h: 5 },
  { id: "apparatus", title: "Apparatus Status", description: "In Service and Out of Service units.", w: 4, h: 5 },
  { id: "maintenance", title: "Open Maintenance", description: "Open, overdue and out-of-service maintenance.", w: 4, h: 4 },
  { id: "checksDue", title: "Checks Due", description: "Checklists due or overdue today.", w: 4, h: 4 },
  { id: "trades", title: "Trades - Active Requests", description: "Shift trades waiting on someone.", w: 4, h: 4 },
  { id: "calendar", title: "Calendar", description: "Scheduled events by month.", w: 4, h: 7 },
  { id: "quickLinks", title: "Quick Links", description: "Shortcuts to common pages.", w: 4, h: 4 },
  { id: "dtbs", title: "DTB's Due", description: "Daily Training Bulletins to acknowledge.", w: 4, h: 3 },
];

export const WIDGET_BY_ID = new Map(WIDGETS.map((widget) => [widget.id, widget]));

/** Puts a new widget below everything else, at its default size. */
export function addWidget(items: DashboardItem[], id: DashboardWidgetId): DashboardItem[] {
  const info = WIDGET_BY_ID.get(id);
  if (!info || items.some((item) => item.i === id)) return items;
  const bottom = items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  return [...items, { i: id, x: 0, y: bottom, w: info.w, h: info.h }];
}

/** Narrow screens show one column in the saved order (top to bottom, then left to right). */
export function stackedLayout(items: DashboardItem[]): DashboardItem[] {
  let y = 0;
  return [...items]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((item) => {
      const placed = { ...item, x: 0, w: 1, y };
      y += item.h;
      return placed;
    });
}

export function sameLayout(a: DashboardItem[], b: DashboardItem[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((item) => [item.i, item]));
  return a.every((item) => {
    const other = byId.get(item.i);
    return other != null && other.x === item.x && other.y === item.y && other.w === item.w && other.h === item.h;
  });
}

/** Where a widget's title links to. */
export const WIDGET_LINKS: Partial<Record<DashboardWidgetId, string>> = {
  incidents: "/incidents-mapping/incidents",
  map: "/incidents-mapping/map-view",
  onDuty: "/personnel/schedule",
  apparatus: "/apparatus",
  maintenance: "/apparatus/maintenance-logs",
  checksDue: "/file-center/checklists",
  trades: "/personnel/trades#active-requests",
};
