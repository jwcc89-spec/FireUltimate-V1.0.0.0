/**
 * Fire Recovery sandbox switch (Phase C Wave 1, decision D-3).
 * Read FIRE_RECOVERY_MODE on every submit. No database change.
 *
 * sandbox — always send FD12345678
 * live — send the department's NERIS Entity ID, and refuse FD12345678
 * unset or anything else — refuse every submit
 */

export const FIRE_RECOVERY_SANDBOX_DEPARTMENT_ID = "FD12345678";

/** Same shape as NERIS_ENTITY_ID_PATTERN in server/neris-proxy.mjs. */
const NERIS_ENTITY_ID_PATTERN = /^(FD|VN|FM|FA)\d{8}$/;

const LIVE_ENTITY_MESSAGE =
  "Set this tenant's NERIS Entity ID (FD########) in Admin Functions → Setup/Configuration → NERIS Configuration → NERIS Export Configuration, and the Fire Recovery department name under Admin Functions → Setup/Configuration → Fire Recovery, before submitting.";

const LIVE_SANDBOX_MESSAGE =
  "Live Fire Recovery refuses the sandbox department ID FD12345678. Set this department's NERIS Entity ID before submitting a real bill.";

const SWITCHED_OFF_MESSAGE = "Fire Recovery is switched off on this server.";

function trimValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {"sandbox" | "live" | "off"}
 */
export function readFireRecoveryMode(env = process.env) {
  const raw = trimValue(env.FIRE_RECOVERY_MODE).toLowerCase();
  if (raw === "sandbox" || raw === "live") return raw;
  return "off";
}

/**
 * @param {"sandbox" | "live" | "off"} mode
 * @returns {string}
 */
export function fireRecoveryModeBanner(mode) {
  if (mode === "sandbox") return "SANDBOX — Fire Recovery will not bill this.";
  if (mode === "live") return "LIVE — this creates a real bill.";
  return SWITCHED_OFF_MESSAGE;
}

/**
 * The only department ID a submit is allowed to send.
 * Sandbox never returns the tenant's own NERIS Entity ID.
 *
 * @param {"sandbox" | "live" | "off"} mode
 * @param {unknown} nerisEntityId
 * @returns {{ ok: true, departmentId: string, message: "" } | { ok: false, departmentId: "", message: string }}
 */
export function resolveFireRecoveryDepartmentId(mode, nerisEntityId) {
  if (mode === "sandbox") {
    return { ok: true, departmentId: FIRE_RECOVERY_SANDBOX_DEPARTMENT_ID, message: "" };
  }
  if (mode === "live") {
    const id = trimValue(nerisEntityId);
    if (id === FIRE_RECOVERY_SANDBOX_DEPARTMENT_ID) {
      return { ok: false, departmentId: "", message: LIVE_SANDBOX_MESSAGE };
    }
    if (!NERIS_ENTITY_ID_PATTERN.test(id)) {
      return { ok: false, departmentId: "", message: LIVE_ENTITY_MESSAGE };
    }
    return { ok: true, departmentId: id, message: "" };
  }
  return { ok: false, departmentId: "", message: SWITCHED_OFF_MESSAGE };
}
