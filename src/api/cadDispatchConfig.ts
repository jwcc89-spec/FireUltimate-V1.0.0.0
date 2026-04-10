/**
 * CAD dispatch parsing config + sender allowlist (tenant-scoped).
 * UI wiring in later batches; APIs available after migration + deploy.
 */

import type { CadRule } from "../cadDispatch/ruleEngine.ts";

export interface CadParsingConfig {
  enableIncidentCreation: boolean;
  messageRules: CadRule[];
  incidentRules: CadRule[];
  incidentFieldMap: Record<string, unknown>;
  incidentNumberExtract: Record<string, unknown> | null;
}

export interface CadAllowlistEntry {
  id: string;
  pattern: string;
  patternType: string;
  enabled: boolean;
  sortOrder: number;
}

/** Body for PATCH /api/cad/allowlist (server replaces all rows; ids are returned). */
export type CadAllowlistEntryInput = {
  pattern: string;
  patternType?: string;
  enabled?: boolean;
  sortOrder?: number;
};

async function parseJson<T>(
  res: Response,
): Promise<{ ok: boolean; data?: T; message?: string }> {
  const json = (await res.json()) as { ok?: boolean; data?: T; message?: string };
  return { ok: Boolean(json.ok), data: json.data, message: json.message };
}

export async function getCadParsingConfig(): Promise<CadParsingConfig> {
  const res = await fetch("/api/cad/parsing-config", { credentials: "include" });
  const json = await parseJson<CadParsingConfig>(res);
  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.message ?? `HTTP ${res.status}`);
  }
  return json.data;
}

export async function patchCadParsingConfig(
  partial: Partial<CadParsingConfig>,
): Promise<CadParsingConfig> {
  const res = await fetch("/api/cad/parsing-config", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partial),
  });
  const json = await parseJson<CadParsingConfig>(res);
  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.message ?? `HTTP ${res.status}`);
  }
  return json.data;
}

export async function getCadAllowlist(): Promise<CadAllowlistEntry[]> {
  const res = await fetch("/api/cad/allowlist", { credentials: "include" });
  const json = await parseJson<{ entries: CadAllowlistEntry[] }>(res);
  if (!res.ok || !json.ok || !json.data?.entries) {
    throw new Error(json.message ?? `HTTP ${res.status}`);
  }
  return json.data.entries;
}

export async function patchCadAllowlist(entries: CadAllowlistEntryInput[]): Promise<
  CadAllowlistEntry[]
> {
  const res = await fetch("/api/cad/allowlist", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  const json = await parseJson<{ entries: CadAllowlistEntry[] }>(res);
  if (!res.ok || !json.ok || !json.data?.entries) {
    throw new Error(json.message ?? `HTTP ${res.status}`);
  }
  return json.data.entries;
}
