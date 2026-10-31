/**
 * Department-wide settings stored on the server: logo, workflow states, submenu visibility, and submenu cards.
 * Incident list layout and sidebar width stay on each computer.
 */

export interface SharedDepartmentSettings {
  logoDataUrl?: string;
  workflowStates?: string[];
  submenuVisibility?: Record<string, boolean>;
  displayCards?: Record<string, string[]>;
}

let chain: Promise<void> = Promise.resolve();

export function patchSharedDepartmentSettings(
  partial: SharedDepartmentSettings,
): Promise<SharedDepartmentSettings> {
  const run = chain.then(async () => {
    const res = await fetch("/api/department-shared-settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    const json = (await res.json()) as { ok?: boolean; data?: SharedDepartmentSettings; message?: string };
    if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
    return json.data ?? partial;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
