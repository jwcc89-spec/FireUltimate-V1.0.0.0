/** Dashboard layouts (per member, plus a department default) and the dashboard summary. */
import type { BoardApparatus, BoardFeed } from "./displays";
import { apiJson, send } from "./maintenance";

export type DashboardWidgetId =
  | "clock"
  | "callStats"
  | "incidents"
  | "onDuty"
  | "apparatus"
  | "maintenance"
  | "checksDue"
  | "trades"
  | "calendar"
  | "map"
  | "quickLinks"
  | "dtbs";

/** One widget's spot on the 12-column grid. */
export interface DashboardItem {
  i: DashboardWidgetId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardLayoutResult {
  items: DashboardItem[];
  /** Whose layout this is: the member's own, the department default, or the built-in one. */
  source: "user" | "department" | "builtIn";
  hasDepartmentDefault: boolean;
  canSetDefault: boolean;
}

export interface DashboardMaintenanceRecord {
  id: string;
  recordNumber: string;
  description: string;
  assetKind: "apparatus" | "equipment";
  assetRef: string;
  status: string;
  priority: string;
  dueDate: string;
  outOfService: boolean;
}

export interface DashboardSummary {
  serverTime: string;
  apparatus: BoardApparatus[];
  onDuty: BoardFeed["onDuty"];
  maintenance: { open: number; overdue: number; outOfService: number; recent: DashboardMaintenanceRecord[] };
}

const layoutBody = (items: DashboardItem[]) => ({ items: items.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })) });

export const getDashboardLayout = () => apiJson<DashboardLayoutResult>("/api/dashboard/layout");
export const saveDashboardLayout = (items: DashboardItem[]) =>
  apiJson<DashboardLayoutResult>("/api/dashboard/layout", send("PUT", layoutBody(items)));
export const resetDashboardLayout = () => apiJson<DashboardLayoutResult>("/api/dashboard/layout", send("DELETE"));
export const saveDepartmentDashboardLayout = (items: DashboardItem[]) =>
  apiJson<DashboardLayoutResult>("/api/dashboard/layout/default", send("PUT", layoutBody(items)));

/** Sends this device's local date and minute so "on duty now" follows the department's clock. */
export function getDashboardSummary(now: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const minute = now.getHours() * 60 + now.getMinutes();
  return apiJson<DashboardSummary>(`/api/dashboard/summary?date=${date}&minute=${minute}`);
}
