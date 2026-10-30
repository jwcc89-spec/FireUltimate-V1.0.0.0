/** Named actions and the lowest role allowed to do each one, until a department changes it. */

export const PERMISSIONS = [
  { key: "users.manage", label: "Manage accounts", minimumRole: "admin" },
  { key: "settings.department", label: "Change department settings", minimumRole: "admin" },
  { key: "incidents.view", label: "View incidents", minimumRole: "user" },
  { key: "incidents.create", label: "Create or edit an incident by hand", minimumRole: "admin" },
  { key: "incidents.delete", label: "Delete an incident", minimumRole: "admin" },
  { key: "reports.edit", label: "Edit NERIS report drafts", minimumRole: "user" },
  { key: "neris.export", label: "Send a NERIS report", minimumRole: "admin" },
  { key: "neris.settings", label: "Change NERIS settings", minimumRole: "admin" },
  { key: "neris.debug", label: "Use NERIS debug tools", minimumRole: "superadmin" },
  { key: "billing.submit", label: "Send a NERIS report for billing", minimumRole: "admin" },
  { key: "billing.settings", label: "Change Fire Recovery settings", minimumRole: "admin" },
  { key: "cad.rules", label: "Change CAD rules", minimumRole: "admin" },
  { key: "cad.emails.view", label: "View CAD emails", minimumRole: "admin" },
  { key: "schedule.edit", label: "Edit the schedule", minimumRole: "user" },
];

const PERMISSION_BY_KEY = new Map(PERMISSIONS.map((item) => [item.key, item]));

export const ROLE_LEVEL = {
  user: 10,
  subadmin: 30,
  admin: 40,
  superadmin: 50,
};

export function parseRole(role) {
  const value = String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (value === "super_admin") return "superadmin";
  if (value === "sub_admin") return "subadmin";
  if (value === "user" || value === "subadmin" || value === "admin" || value === "superadmin") {
    return value;
  }
  return null;
}

export function canonicalRole(role) {
  return parseRole(role) ?? "user";
}

export function roleLevel(role) {
  return ROLE_LEVEL[canonicalRole(role)] ?? ROLE_LEVEL.user;
}

export function permissionForRequest(method, path, body) {
  const verb = String(method || "").toUpperCase();
  const route = String(path || "").split("?")[0];

  if (verb === "GET" && route === "/api/permissions") return null;
  if ((verb === "GET" || verb === "PUT") && route === "/api/permissions/policy") {
    return "settings.department";
  }
  if (verb === "GET" && route === "/api/account-audit") return "users.manage";

  if (verb === "POST" && route === "/api/users") return "users.manage";
  if (verb === "PATCH" && /^\/api\/users\/[^/]+$/.test(route)) return "users.manage";
  if (verb === "DELETE" && /^\/api\/users\/[^/]+$/.test(route)) return "users.manage";
  if (verb === "POST" && /^\/api\/users\/[^/]+\/reset-password$/.test(route)) return "users.manage";

  if (verb === "POST" && route === "/api/department-details") return "settings.department";

  if (verb === "GET" && (route === "/api/incidents" || /^\/api\/incidents\/[^/]+$/.test(route))) {
    return "incidents.view";
  }
  if (verb === "POST" && route === "/api/incidents") return "incidents.create";
  if (verb === "DELETE" && /^\/api\/incidents\/[^/]+$/.test(route)) return "incidents.delete";
  if (verb === "PATCH" && /^\/api\/incidents\/[^/]+$/.test(route)) {
    if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "deletedAt")) {
      return "incidents.delete";
    }
    return "incidents.create";
  }

  if ((verb === "GET" || verb === "PATCH") && /^\/api\/neris\/drafts\/[^/]+$/.test(route)) {
    return "reports.edit";
  }
  if (verb === "GET" && /^\/api\/neris\/drafts\/[^/]+\/history$/.test(route)) {
    return "reports.edit";
  }
  if (verb === "POST" && /^\/api\/neris\/drafts\/[^/]+\/unlock$/.test(route)) {
    return "reports.edit";
  }
  if (verb === "PATCH" && route === "/api/department-shared-settings") {
    return "settings.department";
  }
  if (
    verb === "POST" &&
    (route === "/api/neris/export" || route === "/api/neris/validate" || route === "/api/neris/export-history")
  ) {
    return "neris.export";
  }
  if (verb === "PATCH" && route === "/api/neris/settings") return "neris.settings";
  if (route === "/api/neris/debug" || route.startsWith("/api/neris/debug/")) return "neris.debug";

  if (verb === "POST" && (route === "/api/fire-recovery/submit" || route === "/api/fire-recovery/billing-status")) {
    return "billing.submit";
  }
  if ((verb === "GET" || verb === "PATCH") && route === "/api/fire-recovery/settings") {
    return "billing.settings";
  }

  if (verb === "GET" && (route === "/api/cad/emails" || route.startsWith("/api/cad/emails/"))) {
    return "cad.emails.view";
  }
  if ((verb === "GET" || verb === "PATCH") && (route === "/api/cad/parsing-config" || route === "/api/cad/allowlist")) {
    return "cad.rules";
  }

  if (verb === "POST" && route === "/api/schedule-assignments") return "schedule.edit";
  return null;
}

/** A person may change their own display name without the manage-accounts permission. */
export function isSelfNameOnlyUserPatch(method, path, body, auth) {
  if (String(method || "").toUpperCase() !== "PATCH") return false;
  const match = String(path || "").match(/^\/api\/users\/([^/]+)$/);
  if (!match || !auth || auth.userId !== match[1]) return false;
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return keys.length > 0 && keys.every((key) => key === "name");
}

export async function loadPolicy(prisma, tenantId, actorRole) {
  const rows = await prisma.rolePermission.findMany({ where: { tenantId } });
  const overrides = new Map(rows.map((row) => [row.permission, parseRole(row.minimumRole)]));
  const policy = PERMISSIONS.map((item) => {
    const stored = overrides.get(item.key);
    const minimumRole = stored ?? item.minimumRole;
    return {
      permission: item.key,
      label: item.label,
      minimumRole,
      defaultMinimumRole: item.minimumRole,
    };
  });
  const grants = {};
  for (const item of policy) {
    grants[item.permission] = roleLevel(actorRole) >= roleLevel(item.minimumRole);
  }
  return { policy, grants };
}

export async function minimumRoleFor(prisma, tenantId, permission) {
  const known = PERMISSION_BY_KEY.get(permission);
  if (!known) return null;
  const row = await prisma.rolePermission.findUnique({
    where: { tenantId_permission: { tenantId, permission } },
  });
  return parseRole(row?.minimumRole) ?? known.minimumRole;
}

export function policyChangeError(actorRole, currentMinimum, nextMinimum) {
  if (roleLevel(actorRole) < roleLevel(currentMinimum)) {
    return "You cannot change a permission you do not have.";
  }
  if (roleLevel(nextMinimum) > roleLevel(actorRole)) {
    return "You cannot set a permission above your own role.";
  }
  return null;
}

async function countWithRole(prisma, tenantId, role) {
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { role: true },
  });
  return users.filter((row) => canonicalRole(row.role) === role).length;
}

export async function accountChangeError(prisma, tenantId, actor, change) {
  if (!actor?.userId) return "Sign in required.";
  const action = change.action;
  const target = change.target ?? null;
  const actorRole = canonicalRole(actor.role);
  const actorLevel = roleLevel(actorRole);
  const targetRole = target ? canonicalRole(target.role) : null;
  const self = Boolean(target && actor.userId === target.id);
  const nextRole =
    action === "delete" ? null : canonicalRole(change.nextRole ?? targetRole ?? "user");

  if ((action === "create" || action === "update") && roleLevel(nextRole) > actorLevel) {
    return "You cannot assign a role above your own.";
  }
  if (action === "update" && self && targetRole && roleLevel(nextRole) > roleLevel(targetRole)) {
    return "You cannot raise your own role.";
  }
  if (target && !self && targetRole === "superadmin" && actorRole !== "superadmin") {
    return "Admins cannot change or delete a superadmin.";
  }
  if (target && !self && actorRole === "subadmin" && roleLevel(targetRole) >= actorLevel) {
    return "A subadmin cannot change or delete another subadmin or a higher role.";
  }
  if (target && !self && roleLevel(targetRole) > actorLevel) {
    return "You cannot change an account above your own role.";
  }

  const removesSuperadmin =
    targetRole === "superadmin" && (action === "delete" || nextRole !== "superadmin");
  const removesAdmin =
    targetRole === "admin" && (action === "delete" || (action === "update" && nextRole !== "admin"));
  if (removesSuperadmin) {
    const count = await countWithRole(prisma, tenantId, "superadmin");
    if (count <= 1) return "This department must keep at least one superadmin.";
  }
  if (removesAdmin) {
    const count = await countWithRole(prisma, tenantId, "admin");
    if (count <= 1) return "This department must keep at least one admin.";
  }
  return null;
}

function safeDetail(detail) {
  return String(detail ?? "")
    .replace(/password\s*[:=]\s*\S+/gi, "password=[removed]")
    .slice(0, 500);
}

export async function writeAccountAudit(prisma, entry) {
  await prisma.accountAuditLog.create({
    data: {
      tenantId: entry.tenantId,
      actorUserId: entry.actorUserId || null,
      actorUsername: String(entry.actorUsername || "").slice(0, 200),
      action: String(entry.action || "").slice(0, 40),
      targetUsername: String(entry.targetUsername || "").slice(0, 200),
      detail: safeDetail(entry.detail),
    },
  });
}
