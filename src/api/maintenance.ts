/** Maintenance, vendors, PM schedules and equipment registry API client. */

export type MaintenanceAssetKind = "apparatus" | "equipment";

export const OPEN_MAINTENANCE_STATUSES = ["Open", "Assigned", "In Progress"] as const;
export const MAINTENANCE_STATUSES = [...OPEN_MAINTENANCE_STATUSES, "Completed", "Cancelled"] as const;
export const MAINTENANCE_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export const MAINTENANCE_FREQUENCIES = ["Weekly", "Monthly", "Quarterly", "Semi-Annual", "Annual", "5 Years"] as const;
export const EQUIPMENT_STATUSES = ["In Service", "Out of Service", "Retired"] as const;

export interface MaintenanceAsset {
  kind: MaintenanceAssetKind;
  ref: string;
  label: string;
}

export interface MaintenanceCostLine {
  id?: string;
  description: string;
  amount: number;
  vendorId: string;
}

export interface MaintenanceAttachment {
  id?: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  addedBy?: string;
  addedAt?: string;
}

export interface MaintenanceComment {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

export interface MaintenanceRecordSummary {
  id: string;
  recordNumber: string;
  assetKind: MaintenanceAssetKind;
  assetRef: string;
  assets: MaintenanceAsset[];
  typeId: string;
  typeName: string;
  typeCategory: string;
  nfpaStandard: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  completedDate: string;
  performedByKind: "personnel" | "vendor";
  performedByName: string;
  vendorId: string;
  vendorName: string;
  outOfService: boolean;
  location: string;
  locationDetails: string;
  costTotal: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface MaintenanceRecordDetail extends MaintenanceRecordSummary {
  costs: MaintenanceCostLine[];
  attachments: MaintenanceAttachment[];
  comments: MaintenanceComment[];
}

export interface MaintenanceRecordInput {
  assetKind: MaintenanceAssetKind;
  assets: MaintenanceAsset[];
  typeId: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  completedDate: string;
  performedByKind: "personnel" | "vendor";
  performedByName: string;
  vendorId: string;
  outOfService: boolean;
  location: string;
  locationDetails: string;
  costs: MaintenanceCostLine[];
  attachments: MaintenanceAttachment[];
}

export interface MaintenanceType {
  id: string;
  name: string;
  category: string;
  nfpaStandard: string;
  defaultFrequency: string;
  description: string;
  isSystem: boolean;
  enabled: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  website: string;
  services: string;
}

export interface PmSchedule {
  id: string;
  name: string;
  typeId: string;
  assetKind: MaintenanceAssetKind;
  assetRef: string;
  frequency: string;
  nextDueAt: string;
  active: boolean;
}

export interface EquipmentItem {
  id: string;
  name: string;
  equipmentType: string;
  serialNumber: string;
  locationRef: string;
  status: string;
}

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const json = (await response.json().catch(() => null)) as { data?: T; message?: string } | null;
  if (!response.ok) {
    throw new Error(json?.message ?? `Request failed (${response.status}).`);
  }
  return json?.data as T;
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const getMaintenanceRecords = (assetKind: MaintenanceAssetKind) =>
  apiJson<MaintenanceRecordSummary[]>(`/api/maintenance/records?assetKind=${assetKind}`);
export const getMaintenanceRecord = (id: string) =>
  apiJson<MaintenanceRecordDetail>(`/api/maintenance/records/${encodeURIComponent(id)}`);
export const createMaintenanceRecord = (input: MaintenanceRecordInput) =>
  apiJson<MaintenanceRecordDetail>("/api/maintenance/records", send("POST", input));
export const updateMaintenanceRecord = (id: string, input: Partial<MaintenanceRecordInput>) =>
  apiJson<MaintenanceRecordDetail>(`/api/maintenance/records/${encodeURIComponent(id)}`, send("PATCH", input));
export const deleteMaintenanceRecord = (id: string) =>
  apiJson<void>(`/api/maintenance/records/${encodeURIComponent(id)}`, send("DELETE"));
export const addMaintenanceComment = (id: string, body: string) =>
  apiJson<MaintenanceComment>(
    `/api/maintenance/records/${encodeURIComponent(id)}/comments`,
    send("POST", { body }),
  );

export const getMaintenanceTypes = () => apiJson<MaintenanceType[]>("/api/maintenance/types");
export const createMaintenanceType = (input: Partial<MaintenanceType>) =>
  apiJson<MaintenanceType>("/api/maintenance/types", send("POST", input));
export const updateMaintenanceType = (id: string, input: Partial<MaintenanceType>) =>
  apiJson<MaintenanceType>(`/api/maintenance/types/${encodeURIComponent(id)}`, send("PATCH", input));
export const deleteMaintenanceType = (id: string) =>
  apiJson<void>(`/api/maintenance/types/${encodeURIComponent(id)}`, send("DELETE"));

export const getVendors = () => apiJson<Vendor[]>("/api/maintenance/vendors");
export const createVendor = (input: Omit<Vendor, "id">) =>
  apiJson<Vendor>("/api/maintenance/vendors", send("POST", input));
export const updateVendor = (id: string, input: Omit<Vendor, "id">) =>
  apiJson<Vendor>(`/api/maintenance/vendors/${encodeURIComponent(id)}`, send("PATCH", input));
export const deleteVendor = (id: string) =>
  apiJson<void>(`/api/maintenance/vendors/${encodeURIComponent(id)}`, send("DELETE"));

export const getPmSchedules = () => apiJson<PmSchedule[]>("/api/maintenance/schedules");
export const createPmSchedule = (input: Omit<PmSchedule, "id">) =>
  apiJson<PmSchedule>("/api/maintenance/schedules", send("POST", input));
export const updatePmSchedule = (id: string, input: Omit<PmSchedule, "id">) =>
  apiJson<PmSchedule>(`/api/maintenance/schedules/${encodeURIComponent(id)}`, send("PATCH", input));
export const deletePmSchedule = (id: string) =>
  apiJson<void>(`/api/maintenance/schedules/${encodeURIComponent(id)}`, send("DELETE"));

export const getEquipment = () => apiJson<EquipmentItem[]>("/api/equipment");
export const createEquipment = (input: Omit<EquipmentItem, "id">) =>
  apiJson<EquipmentItem>("/api/equipment", send("POST", input));
export const updateEquipment = (id: string, input: Omit<EquipmentItem, "id">) =>
  apiJson<EquipmentItem>(`/api/equipment/${encodeURIComponent(id)}`, send("PATCH", input));
export const deleteEquipment = (id: string) =>
  apiJson<void>(`/api/equipment/${encodeURIComponent(id)}`, send("DELETE"));
