/**
 * NERIS export history API. The server writes a record after NERIS replies.
 * The browser may post only a failed attempt, for errors that never reached NERIS.
 */

export interface NerisExportRecordApi {
  id: string;
  callNumber: string;
  incidentType: string;
  address: string;
  exportedAtIso: string;
  exportedAtLabel: string;
  attemptStatus: "success" | "failed";
  httpStatus: number;
  httpStatusText: string;
  statusLabel: string;
  reportStatusAtExport: string;
  validatorName: string;
  reportWriterName: string;
  submittedEntityId: string;
  submittedDepartmentNerisId: string;
  nerisId: string;
  responseSummary: string;
  responseDetail: string;
  submittedPayloadPreview: string;
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

export async function getNerisExportHistory(limit = 100, offset = 0): Promise<NerisExportRecordApi[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const data = await apiJson<NerisExportRecordApi[]>(`/api/neris/export-history?${params}`);
  if (!Array.isArray(data)) return [];
  return data;
}

export async function postNerisExportRecord(
  record: Omit<NerisExportRecordApi, "id"> & { id?: string },
): Promise<NerisExportRecordApi> {
  const data = await apiJson<NerisExportRecordApi>("/api/neris/export-history", {
    method: "POST",
    body: JSON.stringify(record),
  });
  return data;
}
