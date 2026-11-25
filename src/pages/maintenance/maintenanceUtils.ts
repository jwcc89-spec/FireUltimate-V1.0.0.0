import {
  OPEN_MAINTENANCE_STATUSES,
  type MaintenanceRecordSummary,
} from "../../api/maintenance";
import type { NerisValueOption } from "../../nerisMetadata";

export type Tone = "positive" | "warning" | "critical" | "neutral";

export function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDaysKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** YYYY-MM-DD to MM/DD/YYYY. */
export function formatDateKey(dateKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "";
  const [year, month, day] = dateKey.split("-");
  return `${month}/${day}/${year}`;
}

/** ISO timestamp to MM/DD/YYYY HH:MM in 24-hour local time. */
export function formatTimestamp24(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function isOpenStatus(status: string): boolean {
  return (OPEN_MAINTENANCE_STATUSES as readonly string[]).includes(status);
}

export function isOverdue(record: MaintenanceRecordSummary, today = todayKey()): boolean {
  return isOpenStatus(record.status) && Boolean(record.dueDate) && record.dueDate < today;
}

export function statusTone(status: string): Tone {
  if (status === "Completed") return "positive";
  if (status === "Cancelled") return "neutral";
  if (status === "In Progress" || status === "Assigned") return "warning";
  return "critical";
}

export function priorityTone(priority: string): Tone {
  if (priority === "Urgent") return "critical";
  if (priority === "High" || priority === "Medium") return "warning";
  return "neutral";
}

export function toOptions(values: readonly string[]): NerisValueOption[] {
  return values.map((value) => ({ value, label: value }));
}

export function assetsText(record: MaintenanceRecordSummary): string {
  return record.assets.map((asset) => asset.label || asset.ref).join(", ");
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Plain-language names for the NFPA standards used by the default types. */
export const NFPA_STANDARD_NAMES: Record<string, string> = {
  "NFPA 10": "Fire Extinguishers",
  "NFPA 1851": "PPE Ensemble",
  "NFPA 1852": "SCBA",
  "NFPA 1911": "Apparatus Service Testing",
  "NFPA 1932": "Ground Ladders",
  "NFPA 1936": "Powered Rescue Tools",
  "NFPA 1962": "Hose, Nozzles and Appliances",
  "NFPA 1989": "Breathing Air Quality",
  DOT: "Cylinder Hydrostatic Testing",
};
