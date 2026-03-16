/**
 * NERIS export settings API. Persists Customization (e.g. NERIS Entity ID) on the server for cross-browser sync.
 */

export interface NerisSettingsPayload {
  exportUrl: string;
  vendorCode: string;
  vendorHeaderName: string;
  secretKey: string;
  authHeaderName: string;
  authScheme: string;
  contentType: string;
  apiVersionHeaderName: string;
  apiVersionHeaderValue: string;
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
 * Fetch NERIS export settings for the current tenant. Use to seed or override client state so settings sync across browsers.
 */
export async function getNerisSettings(): Promise<NerisSettingsPayload> {
  return apiJson<NerisSettingsPayload>("/api/neris/settings");
}

/**
 * Save NERIS export settings for the current tenant. Merges with existing server-side settings.
 */
export async function patchNerisSettings(
  settings: Partial<NerisSettingsPayload>,
): Promise<NerisSettingsPayload> {
  return apiJson<NerisSettingsPayload>("/api/neris/settings", {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}
