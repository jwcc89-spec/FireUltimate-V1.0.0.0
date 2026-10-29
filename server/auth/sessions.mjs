import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "fu_session";
/** Signed out after this long with no activity. Measured from the last request. */
export const SESSION_IDLE_MS = 60 * 60 * 1000;
export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
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
  const value = String(role ?? "").trim().toLowerCase();
  return ROLES.has(value) ? value : "user";
}

export function clearLoginLockouts() {
  loginFailures.clear();
}

function failureKey(tenantId, username) {
  return `${tenantId}\n${String(username ?? "").trim().toLowerCase()}`;
}

export function loginLockStatus(tenantId, username) {
  const key = failureKey(tenantId, username);
  const row = loginFailures.get(key);
  if (!row) return { locked: false };
  if (row.lockedUntil && row.lockedUntil > Date.now()) {
    return { locked: true, retryAt: row.lockedUntil };
  }
  if (row.lockedUntil && row.lockedUntil <= Date.now()) {
    loginFailures.delete(key);
  }
  return { locked: false };
}

export function noteLoginFailure(tenantId, username) {
  const key = failureKey(tenantId, username);
  const row = loginFailures.get(key) ?? { count: 0, lockedUntil: 0 };
  if (row.lockedUntil && row.lockedUntil > Date.now()) {
    return { locked: true, retryAt: row.lockedUntil };
  }
  const count = row.count + 1;
  const lockedUntil = count >= LOGIN_FAILURE_LIMIT ? Date.now() + LOGIN_LOCK_MS : 0;
  loginFailures.set(key, { count, lockedUntil });
  return { locked: lockedUntil > 0, retryAt: lockedUntil };
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

export function requestHostname(request) {
  return (
    request.tenant?.host ||
    hostnameOf(request.headers["x-forwarded-host"]) ||
    hostnameOf(request.headers.host) ||
    ""
  );
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
