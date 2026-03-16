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

const fetchOptions: RequestInit = { credentials: "include" };

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...fetchOptions,
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const json = (await res.json()) as { ok?: boolean; data?: T; message?: string };
  if (!res.ok) {
    throw new Error(json?.message ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

/**
 * Fetch the NERIS draft for an incident. Returns null if no draft exists (404).
 * Sends credentials so the same tenant/session is used in every browser.
 */
export async function getNerisDraft(callNumber: string): Promise<NerisDraftPayload | null> {
  const encoded = encodeURIComponent(callNumber);
  const res = await fetch(`/api/neris/drafts/${encoded}`, { credentials: "include" });
  if (res.status === 404) return null;
  const json = (await res.json()) as { ok?: boolean; data?: NerisDraftPayload; message?: string };
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  return json.data ?? null;
}

/**
 * Save (upsert) the NERIS draft for an incident.
 */
export async function patchNerisDraft(
  callNumber: string,
  draft: NerisDraftPayload,
): Promise<NerisDraftPayload> {
  const encoded = encodeURIComponent(callNumber);
  const data = await apiJson<NerisDraftPayload>(`/api/neris/drafts/${encoded}`, {
    method: "PATCH",
    body: JSON.stringify(draft),
  });
  return data;
}
