import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "fu_session";
/** Signed out after this long with no activity. Measured from the last request. */
export const SESSION_IDLE_MS = 60 * 60 * 1000;
export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
/** Usernames longer than this are refused and not stored. Matches the sign-in cap. */
export const LOGIN_USERNAME_MAX = 100;
/** Passwords longer than this are refused and not stored. */
export const LOGIN_PASSWORD_MAX = 256;
/** Failed-sign-in rows kept in memory. A real account's row is never dropped to make room. */
export const LOGIN_FAILURE_MAP_MAX = 10_000;
const ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;

const ROLES = new Set(["user", "subadmin", "admin", "superadmin"]);

/** Routes that do not require a signed-in person. Everything else under /api does. */
export const PUBLIC_API_ROUTES = new Set([
  "POST /api/auth/login",
  "GET /api/tenant/context",
  "POST /api/cad/inbound-email",
]);

const loginFailures = new Map();

export function normalizeRole(role) {
  const value = String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (value === "super_admin") return "superadmin";
  if (value === "sub_admin") return "subadmin";
  return ROLES.has(value) ? value : "user";
}

export function clearLoginLockouts() {
  loginFailures.clear();
}

export function loginFailureCount() {
  return loginFailures.size;
}

/** True when the submitted text is too large to store or check. */
export function loginCredentialsOversized(username, password) {
  const name = typeof username === "string" ? username : String(username ?? "");
  const pass = typeof password === "string" ? password : String(password ?? "");
  return name.length > LOGIN_USERNAME_MAX || pass.length > LOGIN_PASSWORD_MAX;
}

function failureKey(tenantId, username) {
  return `${tenantId}\n${String(username ?? "").trim().toLowerCase()}`;
}

function sweepExpiredLoginFailures(now) {
  for (const [key, row] of loginFailures) {
    const lockExpired = row.lockedUntil && row.lockedUntil <= now;
    const lastFailedAt = row.lastFailedAt ?? row.createdAt ?? 0;
    const countExpired = !row.lockedUntil && now - lastFailedAt >= LOGIN_LOCK_MS;
    if (lockExpired || countExpired) loginFailures.delete(key);
  }
}

/** Drops one row for a name that is not a real account. Real accounts and active locks stay. */
function evictUnknownLoginFailure(now) {
  let oldestKey = "";
  let oldestAt = Infinity;
  let found = false;
  for (const [key, row] of loginFailures) {
    if (row.knownAccount) continue;
    if (row.lockedUntil && row.lockedUntil > now) continue;
    const createdAt = row.createdAt ?? 0;
    if (!found || createdAt < oldestAt) {
      found = true;
      oldestAt = createdAt;
      oldestKey = key;
    }
  }
  if (!found) return false;
  loginFailures.delete(oldestKey);
  return true;
}

export function loginLockStatus(tenantId, username, now = Date.now()) {
  sweepExpiredLoginFailures(now);
  const row = loginFailures.get(failureKey(tenantId, username));
  if (!row) return { locked: false };
  if (row.lockedUntil && row.lockedUntil > now) {
    return { locked: true, retryAt: row.lockedUntil };
  }
  return { locked: false };
}

export function noteLoginFailure(tenantId, username, now = Date.now(), options = {}) {
  sweepExpiredLoginFailures(now);
  const key = failureKey(tenantId, username);
  const existing = loginFailures.get(key);
  if (existing?.lockedUntil && existing.lockedUntil > now) {
    return { locked: true, retryAt: existing.lockedUntil, deferred: false };
  }
  if (!existing && loginFailures.size >= LOGIN_FAILURE_MAP_MAX) {
    const madeRoom = evictUnknownLoginFailure(now);
    if (!madeRoom) {
      return { locked: false, retryAt: 0, deferred: true };
    }
  }
  const row = loginFailures.get(key) ?? { count: 0, lockedUntil: 0, createdAt: now, knownAccount: false };
  const count = row.count + 1;
  const lockedUntil = count >= LOGIN_FAILURE_LIMIT ? now + LOGIN_LOCK_MS : 0;
  loginFailures.set(key, {
    count,
    lockedUntil,
    createdAt: row.createdAt ?? now,
    lastFailedAt: now,
    knownAccount: row.knownAccount === true || options.knownAccount === true,
  });
  return { locked: lockedUntil > now, retryAt: lockedUntil, deferred: false };
}

export function noteLoginSuccess(tenantId, username) {
  loginFailures.delete(failureKey(tenantId, username));
}

function hostnameOf(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return "";
  const first = raw.split(",")[0]?.trim() || "";
  return first.split(":")[0] || "";
}

/** Right-most name. A trusted proxy appends its own value at the end. */
function nearestForwardedHostname(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return "";
  const parts = raw
    .split(",")
    .map((part) => part.trim().split(":")[0])
    .filter(Boolean);
  return parts[parts.length - 1] || "";
}

/**
 * The department address for this request.
 * A visitor can set X-Forwarded-Host themselves, so it is ignored unless
 * TRUST_PROXY=1. Set that only on Render, and only if Render replaces the
 * header. Everywhere else, including this practice copy, the Host header is used.
 */
export function publicHostname(request) {
  const direct = hostnameOf(request.headers?.host);
  if (process.env.TRUST_PROXY !== "1") return direct;
  return nearestForwardedHostname(request.headers?.["x-forwarded-host"]) || direct;
}

export function requestHostname(request) {
  return request.tenant?.host || publicHostname(request);
}

export function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/** State-changing requests must come from the department's own address. */
export function originAllowed(request) {
  const origin = typeof request.headers.origin === "string" ? request.headers.origin.trim() : "";
  if (!origin) return false;
  let originHost = "";
  try {
    originHost = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  const expected = requestHostname(request);
  return Boolean(expected) && originHost === expected;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(request, name) {
  const header = request.headers.cookie;
  if (!header || typeof header !== "string") return "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return "";
}

function cookieOptions(request) {
  return {
    httpOnly: true,
    secure: !isLocalHostname(requestHostname(request)),
    sameSite: "strict",
    path: "/",
  };
}

export function applySessionCookie(response, token, request) {
  response.cookie(SESSION_COOKIE_NAME, token, cookieOptions(request));
}

export function clearSessionCookie(response, request) {
  response.clearCookie(SESSION_COOKIE_NAME, cookieOptions(request));
}

export async function createSession(prisma, { tenantId, userId }) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      tenantId,
      userId,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + SESSION_IDLE_MS),
    },
  });
  prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => {});
  return token;
}

export async function revokeOtherSessions(prisma, userId, keepSessionId = null) {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(keepSessionId ? { id: { not: keepSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(prisma, userId) {
  await revokeOtherSessions(prisma, userId, null);
}

export async function readAuthFromRequest(prisma, request) {
  const tenantId = request.tenant?.id;
  if (!tenantId) return null;
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session || session.tenantId !== tenantId || session.revokedAt) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) return null;
  const user = await prisma.user.findFirst({
    where: { id: session.userId, tenantId },
    select: { id: true, username: true, role: true },
  });
  if (!user) return null;
  if (now - session.lastActiveAt.getTime() >= ACTIVITY_WRITE_INTERVAL_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: {
        lastActiveAt: new Date(now),
        expiresAt: new Date(now + SESSION_IDLE_MS),
      },
    });
  }
  return {
    sessionId: session.id,
    userId: user.id,
    username: user.username,
    role: normalizeRole(user.role),
  };
}
