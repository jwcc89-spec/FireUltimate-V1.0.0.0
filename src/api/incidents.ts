/**
 * Incident API client. Uses relative URLs so the same host (tenant) is used.
 * Maps server response shape to IncidentCallSummary (callNumber = server id).
 */
import type { IncidentCallSummary } from "../appData";

export interface IncidentApiResponse {
  id: string;
  callNumber: string;
  incidentNumber?: string;
  dispatchNumber?: string;
  incident_internal_id?: string;
  dispatch_internal_id?: string;
  incidentType?: string;
  priority?: string;
  address?: string;
  stillDistrict?: string;
  assignedUnits?: string;
  reportedBy?: string;
  callbackNumber?: string;
  dispatchNotes?: string;
  initialDispatchCode?: string;
  currentState?: string;
  receivedAt?: string;
  dispatchInfo?: string;
  lastUpdated?: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
  nerisReportStatus?: string;
}

function mapApiToSummary(data: IncidentApiResponse): IncidentCallSummary {
  const lastUpdated =
    data.lastUpdated ?? data.updatedAt ?? "";
  return {
    callNumber: data.id ?? data.callNumber ?? "",
    incident_internal_id: data.incident_internal_id ?? data.incidentNumber ?? "",
    dispatch_internal_id: data.dispatch_internal_id ?? data.dispatchNumber ?? "",
    incidentNumber: data.incidentNumber ?? data.incident_internal_id ?? "",
    dispatchNumber: data.dispatchNumber ?? data.dispatch_internal_id ?? "",
    deletedAt: data.deletedAt ?? undefined,
    deletedBy: data.deletedBy ?? undefined,
    deletedReason: data.deletedReason ?? undefined,
    incidentType: data.incidentType ?? "Unknown",
    priority: data.priority ?? "3",
    address: data.address ?? "Unknown",
    stillDistrict: data.stillDistrict ?? "Unknown",
    assignedUnits: data.assignedUnits ?? "",
    reportedBy: data.reportedBy ?? undefined,
    callbackNumber: data.callbackNumber ?? undefined,
    dispatchNotes: data.dispatchNotes ?? undefined,
    initialDispatchCode: data.initialDispatchCode ?? undefined,
    currentState: data.currentState ?? "Draft",
    lastUpdated: lastUpdated || "Just now",
    receivedAt: data.receivedAt ?? "",
    dispatchInfo: data.dispatchInfo ?? "",
    nerisReportStatus: data.nerisReportStatus ?? undefined,
  };
}

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const json = (await res.json()) as { ok?: boolean; data?: T; message?: string };
  if (!res.ok) {
    throw new Error(json?.message ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

export async function getIncidentList(includeDeleted = false): Promise<IncidentCallSummary[]> {
  const q = includeDeleted ? "?includeDeleted=true" : "";
  const data = await apiJson<IncidentApiResponse[]>(`/api/incidents${q}`);
  if (!Array.isArray(data)) return [];
  return data.map(mapApiToSummary);
}

export async function getIncident(id: string): Promise<IncidentCallSummary | null> {
  try {
    const data = await apiJson<IncidentApiResponse>(`/api/incidents/${encodeURIComponent(id)}`);
    return data ? mapApiToSummary(data) : null;
  } catch {
    return null;
  }
}

export interface CreateIncidentBody {
  incidentNumber?: string;
  dispatchNumber?: string;
  incidentType?: string;
  priority?: string;
  address?: string;
  stillDistrict?: string;
  assignedUnits?: string;
  reportedBy?: string;
  callbackNumber?: string;
  dispatchNotes?: string;
  initialDispatchCode?: string;
  currentState?: string;
  receivedAt?: string;
  dispatchInfo?: string;
  deletedAt?: string | null;
}

export async function createIncident(body: CreateIncidentBody): Promise<IncidentCallSummary> {
  const data = await apiJson<IncidentApiResponse>("/api/incidents", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapApiToSummary(data);
}

export async function updateIncident(
  id: string,
  patch: Partial<CreateIncidentBody>
): Promise<IncidentCallSummary> {
  const data = await apiJson<IncidentApiResponse>(`/api/incidents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return mapApiToSummary(data);
}

export async function deleteIncident(
  id: string,
  options?: { deletedBy?: string; deletedReason?: string }
): Promise<IncidentCallSummary> {
  const data = await apiJson<IncidentApiResponse>(`/api/incidents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify(options ?? {}),
  });
  return mapApiToSummary(data);
}
