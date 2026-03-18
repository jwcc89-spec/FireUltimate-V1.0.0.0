export type RoleKey = string;

const DEFAULT_ROLE_LEVELS: Record<string, number> = {
  user: 10,
  subadmin: 30,
  admin: 40,
  superadmin: 50,
};

export function getRoleLevel(role: RoleKey | null | undefined): number {
  const key = String(role ?? "")
    .trim()
    .toLowerCase();
  if (!key) return DEFAULT_ROLE_LEVELS.user;
  return DEFAULT_ROLE_LEVELS[key] ?? DEFAULT_ROLE_LEVELS.user;
}

export function hasAtLeastRole(
  role: RoleKey | null | undefined,
  minimumRole: RoleKey,
): boolean {
  return getRoleLevel(role) >= getRoleLevel(minimumRole);
}

export function isAdminOrHigher(role: RoleKey | null | undefined): boolean {
  return hasAtLeastRole(role, "admin");
}

export function isSuperadmin(role: RoleKey | null | undefined): boolean {
  return String(role ?? "").trim().toLowerCase() === "superadmin";
}

