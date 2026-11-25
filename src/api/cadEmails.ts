/**
 * CAD email ingest API — list incoming emails for Dispatch Parsing Settings.
 */

export interface CadEmailIngestRow {
  id: string;
  fromAddress: string;
  toAddress: string;
  rawBody: string;
  headersJson: unknown;
  /** Filled at ingest when message rules run (Batch H). */
  parsedMessageText: string;
  createdAt: string;
}

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const json = (await res.json()) as { ok?: boolean; data?: T; message?: string };
  if (!res.ok) {
    throw new Error(json?.message ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

export function cadEmailIngestNotice(
  headers: unknown,
): { status: "failed" | "warning"; message: string } | null {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return null;
  const notice = (headers as { _fuIngest?: { status?: unknown; message?: unknown } })._fuIngest;
  if (!notice || (notice.status !== "failed" && notice.status !== "warning")) return null;
  return {
    status: notice.status,
    message: typeof notice.message === "string" ? notice.message : "",
  };
}

export async function getCadEmails(
  limit = 50,
  offset = 0,
): Promise<CadEmailIngestRow[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const data = await apiJson<CadEmailIngestRow[]>(`/api/cad/emails?${params}`);
  if (!Array.isArray(data)) return [];
  return data;
}
