/**
 * NERIS draft API. Persists report drafts on the server for cross-browser sync.
 */

/** Draft payload stored on server (matches NerisStoredDraft shape). */
export interface NerisDraftPayload {
  formValues?: Record<string, string>;
  reportStatus?: string;
  lastSavedAt?: string;
  additionalAidEntries?: Array<{ aidDirection?: string; aidType?: string; aidDepartment?: string }>;
  additionalNonFdAidEntries?: Array<{ aidType?: string }>;
}

export interface NerisDraftRecord {
  draft: NerisDraftPayload;
  updatedAt: string;
}

export interface NerisReportChangeEntry {
  id: string;
  createdAt: string;
  actorUsername: string;
  fieldNames: string[];
}

const fetchOptions: RequestInit = { credentials: "include" };

async function readJson(res: Response): Promise<{ ok?: boolean; data?: unknown; message?: string; updatedAt?: string }> {
  return (await res.json()) as { ok?: boolean; data?: unknown; message?: string; updatedAt?: string };
}

/**
 * Fetch the NERIS draft for an incident. Returns null if no draft exists (404).
 * Sends credentials so the same tenant/session is used in every browser.
 */
export async function getNerisDraft(callNumber: string): Promise<NerisDraftRecord | null> {
  const encoded = encodeURIComponent(callNumber);
  const res = await fetch(`/api/neris/drafts/${encoded}`, { credentials: "include" });
  if (res.status === 404) return null;
  const json = await readJson(res);
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  return {
    draft: (json.data ?? {}) as NerisDraftPayload,
    updatedAt: typeof json.updatedAt === "string" ? json.updatedAt : "",
  };
}

/**
 * Save (upsert) the NERIS draft for an incident.
 * baseUpdatedAt is the updatedAt from the last load or save. The server refuses the save if someone else saved first.
 */
export async function patchNerisDraft(
  callNumber: string,
  draft: NerisDraftPayload,
  baseUpdatedAt = "",
): Promise<NerisDraftRecord> {
  const encoded = encodeURIComponent(callNumber);
  const res = await fetch(`/api/neris/drafts/${encoded}`, {
    ...fetchOptions,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: draft, baseUpdatedAt }),
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  return {
    draft: (json.data ?? draft) as NerisDraftPayload,
    updatedAt: typeof json.updatedAt === "string" ? json.updatedAt : baseUpdatedAt,
  };
}

export async function unlockNerisDraft(callNumber: string, baseUpdatedAt: string): Promise<NerisDraftRecord> {
  const encoded = encodeURIComponent(callNumber);
  const res = await fetch(`/api/neris/drafts/${encoded}/unlock`, {
    ...fetchOptions,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUpdatedAt }),
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  return {
    draft: (json.data ?? {}) as NerisDraftPayload,
    updatedAt: typeof json.updatedAt === "string" ? json.updatedAt : "",
  };
}

export async function getNerisDraftHistory(callNumber: string): Promise<NerisReportChangeEntry[]> {
  const encoded = encodeURIComponent(callNumber);
  const res = await fetch(`/api/neris/drafts/${encoded}/history`, { credentials: "include" });
  const json = await readJson(res);
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  return Array.isArray(json.data) ? (json.data as NerisReportChangeEntry[]) : [];
}
