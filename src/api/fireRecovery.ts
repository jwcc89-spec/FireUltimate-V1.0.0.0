/**
 * Fire Recovery USA incident billing API (tenant-scoped).
 */

export interface FireRecoveryIncidentApi {
  id: string;
  callNumber: string;
  trackingId: string;
  incidentType: string;
  incidentDateLabel: string;
  lastSubmitAt: string | null;
  lastSubmitOk: boolean;
  lastSubmitError: string;
  exportDateLabel: string;
  amountDue: string;
  invoiceAmountDue: string;
  amountPaid: string;
  invoiceId: string;
  invoiceStatus: string;
  invoiceAmount: string;
  invoiceSubmitDate: string;
  lastPaymentDate: string;
  paymentPlan: string;
  billingFetchedAt: string | null;
}

export interface FireRecoverySettingsApi {
  subscriptionKeyMasked: string;
  departmentName: string;
  apiUsername: string;
  passwordIsSet: boolean;
}

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const json = (await res.json()) as { ok?: boolean; data?: T; message?: string };
  if (!res.ok) {
    const error = new Error(json?.message ?? `HTTP ${res.status}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return json.data as T;
}

function isHiddenBilling(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 403);
}

export async function getFireRecoveryIncidents(): Promise<FireRecoveryIncidentApi[]> {
  try {
    const data = await apiJson<FireRecoveryIncidentApi[]>("/api/fire-recovery/incidents");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (isHiddenBilling(error)) return [];
    throw error;
  }
}

export async function getFireRecoveryIncident(
  callNumber: string,
): Promise<FireRecoveryIncidentApi | null> {
  try {
    return await apiJson<FireRecoveryIncidentApi>(
      `/api/fire-recovery/incidents/${encodeURIComponent(callNumber)}`,
    );
  } catch {
    return null;
  }
}

export async function postFireRecoverySubmit(callNumber: string): Promise<FireRecoveryIncidentApi> {
  return apiJson<FireRecoveryIncidentApi>("/api/fire-recovery/submit", {
    method: "POST",
    body: JSON.stringify({ callNumber }),
  });
}

export async function postFireRecoveryBillingStatus(
  callNumber: string,
): Promise<FireRecoveryIncidentApi> {
  return apiJson<FireRecoveryIncidentApi>("/api/fire-recovery/billing-status", {
    method: "POST",
    body: JSON.stringify({ callNumber }),
  });
}

export async function getFireRecoverySettings(): Promise<FireRecoverySettingsApi> {
  return apiJson<FireRecoverySettingsApi>("/api/fire-recovery/settings");
}

export async function patchFireRecoverySettings(payload: {
  fireRecoverySubscriptionKey?: string;
  fireRecoveryDepartmentName?: string;
  fireRecoveryApiUsername?: string;
  fireRecoveryApiPassword?: string;
}): Promise<FireRecoverySettingsApi> {
  return apiJson<FireRecoverySettingsApi>("/api/fire-recovery/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
