import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import test from "node:test";
import bcrypt from "bcryptjs";
import { encryptSecret } from "../crypto/secretBox.mjs";
import { permissionForRequest } from "./permissions.mjs";
import {
  LOGIN_FAILURE_LIMIT,
  LOGIN_FAILURE_MAP_MAX,
  LOGIN_LOCK_MS,
  LOGIN_PASSWORD_MAX,
  LOGIN_USERNAME_MAX,
  PUBLIC_API_ROUTES,
  clearLoginLockouts,
  loginCredentialsOversized,
  loginFailureCount,
  loginLockStatus,
  normalizeRole,
  noteLoginFailure,
  noteLoginSuccess,
  originAllowed,
  publicHostname,
  revokeAllSessions,
} from "./sessions.mjs";

const DATABASE_URL = "postgresql://fu:fu@127.0.0.1:5432/fu_session_test?sslmode=disable";
const databaseHost = new URL(DATABASE_URL).hostname;
if (databaseHost !== "127.0.0.1" && databaseHost !== "localhost") {
  throw new Error("Refusing to run session tests against a non-local database.");
}

process.env.DATABASE_URL = DATABASE_URL;
process.env.NODE_ENV = "test";
delete process.env.CAD_INGEST_SECRET;

const APPROVED_PUBLIC = new Set([
  "POST /api/auth/login",
  "GET /api/tenant/context",
  "POST /api/cad/inbound-email",
]);

test("server sign-in passes", async () => {
  // Known gap D5: originAllowed compares hostnames only. A different scheme or
  // port on the same host is accepted. HTTPS-only at Cloudflare limits this
  // until Stage C. A different host is still refused.
  assert.equal(
    originAllowed({
      headers: { host: "dept.test", origin: "https://dept.test:444" },
      tenant: { host: "dept.test" },
    }),
    true,
    "D5 known gap: scheme and port are ignored",
  );
  assert.equal(
    originAllowed({
      headers: { host: "dept.test", origin: "https://evil.test" },
      tenant: { host: "dept.test" },
    }),
    false,
  );

  clearLoginLockouts();
  assert.equal(loginCredentialsOversized("a".repeat(LOGIN_USERNAME_MAX + 1), "secret"), true);
  assert.equal(loginCredentialsOversized("chief", "p".repeat(LOGIN_PASSWORD_MAX + 1)), true);
  assert.equal(loginCredentialsOversized("a".repeat(50_000), "secret"), true);
  assert.equal(loginCredentialsOversized("a".repeat(LOGIN_USERNAME_MAX), "p".repeat(LOGIN_PASSWORD_MAX)), false);
  assert.equal(loginFailureCount(), 0);

  for (let attempt = 1; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
    const result = noteLoginFailure("memory", "bob");
    assert.equal(result.locked, false, `attempt ${attempt} should not lock`);
  }
  const fifth = noteLoginFailure("memory", "bob");
  assert.equal(fifth.locked, true);
  assert.equal(loginLockStatus("memory", "bob").locked, true);
  noteLoginSuccess("memory", "bob");
  assert.equal(loginLockStatus("memory", "bob").locked, false);
  noteLoginFailure("memory", "bob");
  assert.equal(loginLockStatus("memory", "bob").locked, false);

  clearLoginLockouts();
  for (let index = 0; index < 20_000; index += 1) {
    noteLoginFailure("flood", `user-${index}`);
  }
  assert.equal(loginFailureCount(), LOGIN_FAILURE_MAP_MAX);

  clearLoginLockouts();
  const stamp = 1_700_000_000_000;
  for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
    noteLoginFailure("dept", "victim", stamp);
  }
  assert.equal(loginLockStatus("dept", "victim", stamp).locked, true);
  for (let index = 0; index < 20_000; index += 1) {
    noteLoginFailure("dept", `other-${index}`, stamp);
  }
  assert.equal(loginFailureCount(), LOGIN_FAILURE_MAP_MAX);
  assert.equal(loginLockStatus("dept", "victim", stamp).locked, true);

  clearLoginLockouts();
  for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
    noteLoginFailure("dept", "old-lock", stamp);
  }
  for (let index = 0; index < LOGIN_FAILURE_MAP_MAX - 1; index += 1) {
    noteLoginFailure("dept", `fill-${index}`, stamp);
  }
  assert.equal(loginFailureCount(), LOGIN_FAILURE_MAP_MAX);
  const later = stamp + LOGIN_LOCK_MS + 1;
  const afterExpiry = noteLoginFailure("dept", "after-expiry", later);
  assert.equal(afterExpiry.deferred, false);
  assert.equal(loginLockStatus("dept", "old-lock", later).locked, false);
  assert.ok(loginFailureCount() <= LOGIN_FAILURE_MAP_MAX);

  clearLoginLockouts();
  for (let index = 0; index < LOGIN_FAILURE_MAP_MAX; index += 1) {
    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
      noteLoginFailure("dept", `locked-${index}`, stamp);
    }
  }
  assert.equal(loginFailureCount(), LOGIN_FAILURE_MAP_MAX);
  const deferred = noteLoginFailure("dept", "stranger", stamp);
  assert.equal(deferred.deferred, true);
  assert.equal(loginFailureCount(), LOGIN_FAILURE_MAP_MAX);
  assert.equal(loginLockStatus("dept", "locked-0", stamp).locked, true);
  clearLoginLockouts();

  assert.equal(publicHostname({ headers: { host: "alpha.test", "x-forwarded-host": "bravo.test" } }), "alpha.test");
  process.env.TRUST_PROXY = "1";
  assert.equal(publicHostname({ headers: { host: "alpha.test", "x-forwarded-host": "spoof.test, render.test" } }), "render.test");
  delete process.env.TRUST_PROXY;
  assert.equal(normalizeRole("super_admin"), "superadmin");
  assert.equal(normalizeRole("sub-admin"), "subadmin");
  assert.deepEqual([...PUBLIC_API_ROUTES].sort(), [...APPROVED_PUBLIC].sort());

  execFileSync("npx", ["prisma", "generate"], { stdio: "inherit", env: process.env });
  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });

  const { app, prisma } = await import("../neris-proxy.mjs");
  clearLoginLockouts();

  const password = "Password1!";
  const passwordHash = await bcrypt.hash(password, 4);
  await prisma.tenant.deleteMany();
  const demo = await prisma.tenant.create({
    data: { slug: "demo", name: "Demo Fire", status: "active" },
  });
  await prisma.departmentDetails.create({
    data: { tenantId: demo.id, departmentName: "Demo Fire", payloadJson: {} },
  });
  const user = await prisma.user.create({
    data: { tenantId: demo.id, username: "chief", passwordHash, role: "user" },
  });
  const ff = await prisma.user.create({
    data: { tenantId: demo.id, username: "ff", passwordHash, role: "user" },
  });
  const other = await prisma.tenant.create({
    data: { slug: "other", name: "Other Fire", status: "active" },
  });
  await prisma.tenantDomain.create({
    data: { tenantId: other.id, hostname: "other.test", isPrimary: true },
  });
  await prisma.user.create({
    data: { tenantId: other.id, username: "chief", passwordHash, role: "admin" },
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const origin = base;

  async function call(path, { method = "GET", cookie = "", requestOrigin = "", forwardedHost = "", extraHeaders = null, body } = {}) {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    if (requestOrigin) headers.origin = requestOrigin;
    if (forwardedHost) headers["x-forwarded-host"] = forwardedHost;
    if (extraHeaders) Object.assign(headers, extraHeaders);
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    const setCookie = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
    return { status: response.status, json, setCookie };
  }

  function callHost(path, { method = "GET", host, cookie = "", requestOrigin = "", body } = {}) {
    return new Promise((resolve, reject) => {
      const payload = body !== undefined ? JSON.stringify(body) : null;
      const headers = { host };
      if (cookie) headers.cookie = cookie;
      if (requestOrigin) headers.origin = requestOrigin;
      if (payload) {
        headers["content-type"] = "application/json";
        headers["content-length"] = Buffer.byteLength(payload);
      }
      const req = http.request(
        { hostname: "127.0.0.1", port, path, method, headers },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            let json = {};
            try {
              json = text ? JSON.parse(text) : {};
            } catch {
              json = {};
            }
            const setCookie = res.headers["set-cookie"];
            resolve({
              status: res.statusCode,
              json,
              setCookie: Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [],
            });
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  function sessionCookie(setCookie) {
    const line = setCookie.find((item) => item.startsWith("fu_session="));
    assert.ok(line, `expected a sign-in cookie, got ${setCookie.join(" | ")}`);
    return { pair: line.split(";")[0], line };
  }

  try {
    const source = readFileSync(new URL("../neris-proxy.mjs", import.meta.url), "utf8");
    const routes = [...source.matchAll(/app\.(get|post|patch|put|delete)\(\s*["']([^"']+)["']/g)];
    assert.ok(routes.length >= 45, `expected at least 45 API routes, found ${routes.length}`);
    for (const match of routes) {
      const method = match[1].toUpperCase();
      const pattern = match[2];
      if (!pattern.startsWith("/api")) continue;
      const path = pattern.replace(/:[A-Za-z0-9_]+/g, "missing");
      const response = await call(path, { method, body: method === "GET" ? undefined : {} });
      const label = `${method} ${pattern}`;
      if (pattern.startsWith("/api/admin") || APPROVED_PUBLIC.has(`${method} ${pattern}`)) {
        assert.notEqual(response.json.code, "AUTH_REQUIRED", label);
      } else {
        assert.equal(response.status, 401, `${label} -> ${response.status}`);
        assert.equal(response.json.code, "AUTH_REQUIRED", label);
      }
    }

    const login = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "chief", password },
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.user.role, "user");
    const first = sessionCookie(login.setCookie);
    assert.match(first.line, /HttpOnly/i);
    assert.match(first.line, /SameSite=Strict/i);
    assert.doesNotMatch(first.line, /Max-Age/i);
    assert.doesNotMatch(first.line, /Expires=/i);
    assert.doesNotMatch(first.line, /Domain=/i);

    const who = await call("/api/auth/session", { cookie: first.pair });
    assert.equal(who.status, 200);
    assert.equal(who.json.user.username, "chief");
    assert.equal(who.json.user.role, "user");

    const missing = await call("/api/users");
    assert.equal(missing.status, 401);
    assert.equal(missing.json.code, "AUTH_REQUIRED");

    const spoofed = await call("/api/tenant/context", { forwardedHost: "other.test" });
    assert.equal(spoofed.status, 200);
    assert.equal(spoofed.json.tenant.slug, "demo");
    const crossed = await callHost("/api/auth/session", {
      host: "other.test",
      cookie: first.pair,
    });
    assert.equal(crossed.status, 401);

    const madeUp = await call("/api/auth/session", { cookie: "fu_session=not-a-real-session" });
    assert.equal(madeUp.status, 401);
    assert.equal(madeUp.json.code, "AUTH_REQUIRED");
    const realToken = decodeURIComponent(first.pair.slice("fu_session=".length));
    const tamperedToken = `${realToken.slice(0, -1)}${realToken.endsWith("a") ? "b" : "a"}`;
    const tampered = await call("/api/auth/session", { cookie: `fu_session=${encodeURIComponent(tamperedToken)}` });
    assert.equal(tampered.status, 401);
    assert.equal(tampered.json.code, "AUTH_REQUIRED");
    assert.equal((await call("/api/auth/session", { cookie: first.pair })).status, 200);

    const cancelLogin = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "chief", password },
    });
    assert.equal(cancelLogin.status, 200);
    const cancelCookie = sessionCookie(cancelLogin.setCookie);
    const cancelToken = decodeURIComponent(cancelCookie.pair.slice("fu_session=".length));
    const cancelRow = await prisma.session.findUnique({
      where: { tokenHash: createHash("sha256").update(cancelToken).digest("hex") },
    });
    assert.ok(cancelRow, "expected the extra sign-in to be stored");
    await prisma.session.update({
      where: { id: cancelRow.id },
      data: { revokedAt: new Date() },
    });
    const cancelled = await call("/api/auth/session", { cookie: cancelCookie.pair });
    assert.equal(cancelled.status, 401);
    assert.equal(cancelled.json.code, "AUTH_REQUIRED");
    assert.equal((await call("/api/auth/session", { cookie: first.pair })).status, 200);

    const portGapLogin = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "chief", password },
    });
    assert.equal(portGapLogin.status, 200);
    const portGapCookie = sessionCookie(portGapLogin.setCookie);
    const portGap = await call("/api/auth/logout", {
      method: "POST",
      cookie: portGapCookie.pair,
      requestOrigin: "http://127.0.0.1:9",
      body: {},
    });
    assert.equal(portGap.status, 200, "D5 known gap: origin port is ignored");
    const schemeGap = await call("/api/auth/change-password", {
      method: "POST",
      cookie: first.pair,
      requestOrigin: `https://127.0.0.1:${port}`,
      body: { currentPassword: "wrong-password", newPassword: "Password9!" },
    });
    assert.equal(schemeGap.status, 401, "D5 known gap: origin scheme is ignored");
    assert.match(schemeGap.json.message, /Current password is incorrect/);

    const evil = await call("/api/auth/logout", {
      method: "POST",
      cookie: first.pair,
      requestOrigin: "https://evil.example",
      body: {},
    });
    assert.equal(evil.status, 403);
    const stillSignedIn = await call("/api/auth/session", { cookie: first.pair });
    assert.equal(stillSignedIn.status, 200);

    await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
    const promoted = await call("/api/auth/session", { cookie: first.pair });
    assert.equal(promoted.status, 200);
    assert.equal(promoted.json.user.role, "admin");

    const ffLogin = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "ff", password },
    });
    assert.equal(ffLogin.status, 200);
    assert.equal(ffLogin.json.user.role, "user");
    const ffCookie = sessionCookie(ffLogin.setCookie);
    const deniedIncident = await call("/api/incidents", {
      method: "POST",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: { incidentType: "Not allowed" },
    });
    assert.equal(deniedIncident.status, 403);
    assert.equal(deniedIncident.json.code, "FORBIDDEN");
    const deniedExport = await call("/api/neris/export", {
      method: "POST",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: {},
    });
    assert.equal(deniedExport.status, 403);
    assert.equal(deniedExport.json.code, "FORBIDDEN");
    const deniedBilling = await call("/api/fire-recovery/submit", {
      method: "POST",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: { callNumber: "1" },
    });
    assert.equal(deniedBilling.status, 403);
    const deniedUser = await call("/api/users", {
      method: "POST",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: { username: "newbie", password: "Password1!", userType: "User", name: "New Person" },
    });
    assert.equal(deniedUser.status, 403);

    const adminIncident = await call("/api/incidents", {
      method: "POST",
      cookie: first.pair,
      requestOrigin: origin,
      body: { incidentType: "Admin created" },
    });
    assert.equal(adminIncident.status, 201);
    const deniedSuper = await call("/api/users", {
      method: "POST",
      cookie: first.pair,
      requestOrigin: origin,
      body: { username: "boss", password: "Password1!", userType: "Super Admin", name: "Boss" },
    });
    assert.equal(deniedSuper.status, 403);
    const createdUser = await call("/api/users", {
      method: "POST",
      cookie: first.pair,
      requestOrigin: origin,
      body: { username: "newbie", password: "Password1!", userType: "User", name: "New Person" },
    });
    assert.equal(createdUser.status, 201);
    const audit = await prisma.accountAuditLog.findFirst({
      where: { tenantId: demo.id, targetUsername: "newbie", action: "create" },
    });
    assert.ok(audit);
    assert.equal(audit.actorUsername, "chief");
    assert.doesNotMatch(`${audit.detail} ${audit.action}`, /Password1/);
    const keptSettings = await call("/api/department-details", {
      method: "POST",
      cookie: first.pair,
      requestOrigin: origin,
      body: { departmentName: "Demo Fire", userRecords: [] },
    });
    assert.equal(keptSettings.status, 200);
    const ffStillThere = await prisma.user.findUnique({ where: { id: ff.id } });
    assert.ok(ffStillThere);
    const lowered = await call("/api/permissions/policy", {
      method: "PUT",
      cookie: first.pair,
      requestOrigin: origin,
      body: { permission: "incidents.create", minimumRole: "user" },
    });
    assert.equal(lowered.status, 200);
    const ffCreated = await call("/api/incidents", {
      method: "POST",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: { incidentType: "Firefighter created" },
    });
    assert.equal(ffCreated.status, 201);
    const debugChange = await call("/api/permissions/policy", {
      method: "PUT",
      cookie: first.pair,
      requestOrigin: origin,
      body: { permission: "neris.debug", minimumRole: "admin" },
    });
    assert.equal(debugChange.status, 403);
    const renamed = await call(`/api/users/${ff.id}`, {
      method: "PATCH",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: { name: "Firefighter" },
    });
    assert.equal(renamed.status, 200);
    const owner = await prisma.user.create({
      data: { tenantId: demo.id, username: "owner", passwordHash, role: "superadmin" },
    });
    const blockedDelete = await call(`/api/users/${owner.id}`, {
      method: "DELETE",
      cookie: first.pair,
      requestOrigin: origin,
    });
    assert.equal(blockedDelete.status, 403);
    const ownerRemains = await prisma.user.findUnique({ where: { id: owner.id } });
    assert.ok(ownerRemains);

    const demoIncidentId = adminIncident.json.data.id;
    await prisma.incident.update({
      where: { id: demoIncidentId },
      data: { address: "1 Demo Lane" },
    });
    await prisma.tenant.update({ where: { id: demo.id }, data: { nerisEntityId: "FD11111111" } });
    await prisma.tenant.update({ where: { id: other.id }, data: { nerisEntityId: "FD22222222" } });
    await prisma.departmentDetails.update({
      where: { tenantId: demo.id },
      data: { payloadJson: { marker: "DEMO-ONLY" } },
    });
    await prisma.departmentDetails.create({
      data: { tenantId: other.id, departmentName: "Other Fire", payloadJson: { marker: "OTHER-ONLY" } },
    });
    const otherIncident = await prisma.incident.create({
      data: { tenantId: other.id, incidentType: "Other house", address: "9 Bravo Street", currentState: "Draft" },
    });
    await prisma.nerisDraft.create({
      data: { tenantId: demo.id, callNumber: demoIncidentId, payload: { secret: "demo-report" } },
    });
    await prisma.nerisDraft.create({
      data: { tenantId: other.id, callNumber: otherIncident.id, payload: { secret: "other-report" } },
    });
    await prisma.nerisExportHistory.create({
      data: { tenantId: demo.id, callNumber: demoIncidentId, address: "demo-export-marker" },
    });
    await prisma.nerisExportHistory.create({
      data: { tenantId: other.id, callNumber: otherIncident.id, address: "other-export-marker" },
    });
    await prisma.fireRecoveryIncidentBilling.create({
      data: { tenantId: demo.id, callNumber: demoIncidentId, trackingId: "demo-track" },
    });
    await prisma.fireRecoveryIncidentBilling.create({
      data: { tenantId: other.id, callNumber: otherIncident.id, trackingId: "other-track" },
    });
    await prisma.scheduleAssignments.create({
      data: { tenantId: demo.id, shiftType: "A", dateKey: "2026-01-01", assignmentsJson: { marker: "demo-shift" } },
    });
    await prisma.scheduleAssignments.create({
      data: { tenantId: other.id, shiftType: "B", dateKey: "2026-02-02", assignmentsJson: { marker: "other-shift" } },
    });
    await prisma.cadEmailIngest.create({
      data: { tenantId: demo.id, rawBody: "DEMO-CAD-SECRET", toAddress: "demo@cad.test" },
    });
    await prisma.cadEmailIngest.create({
      data: { tenantId: other.id, rawBody: "OTHER-CAD-SECRET", toAddress: "other@cad.test" },
    });

    const bravoLogin = await callHost("/api/auth/login", {
      method: "POST",
      host: "other.test",
      requestOrigin: "https://other.test",
      body: { username: "chief", password },
    });
    assert.equal(bravoLogin.status, 200);
    const bravo = sessionCookie(bravoLogin.setCookie);
    const bravoIncidents = await callHost("/api/incidents", { host: "other.test", cookie: bravo.pair });
    assert.equal(bravoIncidents.status, 200);
    const bravoIncidentText = JSON.stringify(bravoIncidents.json);
    assert.match(bravoIncidentText, /9 Bravo Street/);
    assert.doesNotMatch(bravoIncidentText, /1 Demo Lane/);
    assert.equal((await callHost(`/api/incidents/${demoIncidentId}`, { host: "other.test", cookie: bravo.pair })).status, 404);
    assert.equal((await callHost(`/api/incidents/${demoIncidentId}`, {
      method: "PATCH",
      host: "other.test",
      cookie: bravo.pair,
      requestOrigin: "https://other.test",
      body: { address: "stolen" },
    })).status, 404);
    assert.equal((await callHost(`/api/incidents/${demoIncidentId}`, {
      method: "DELETE",
      host: "other.test",
      cookie: bravo.pair,
      requestOrigin: "https://other.test",
      body: {},
    })).status, 404);
    const demoIncidentRemains = await prisma.incident.findFirst({ where: { id: demoIncidentId, tenantId: demo.id } });
    assert.equal(demoIncidentRemains.address, "1 Demo Lane");
    const bravoUsers = await callHost("/api/users", { host: "other.test", cookie: bravo.pair });
    assert.equal(bravoUsers.json.users.some((row) => row.username === "ff"), false);
    assert.equal((await callHost(`/api/users/${ff.id}`, {
      method: "PATCH",
      host: "other.test",
      cookie: bravo.pair,
      requestOrigin: "https://other.test",
      body: { name: "Stolen" },
    })).status, 404);
    const bravoDetails = await callHost("/api/department-details", { host: "other.test", cookie: bravo.pair });
    assert.equal(bravoDetails.json.data.marker, "OTHER-ONLY");
    assert.equal((await callHost(`/api/neris/drafts/${otherIncident.id}`, { host: "other.test", cookie: bravo.pair })).json.data.secret, "other-report");
    assert.equal((await callHost(`/api/neris/drafts/${demoIncidentId}`, { host: "other.test", cookie: bravo.pair })).status, 404);
    const historyText = JSON.stringify((await callHost("/api/neris/export-history", { host: "other.test", cookie: bravo.pair })).json);
    assert.match(historyText, /other-export-marker/);
    assert.doesNotMatch(historyText, /demo-export-marker/);
    assert.equal((await callHost(`/api/fire-recovery/incidents/${demoIncidentId}`, { host: "other.test", cookie: bravo.pair })).status, 404);
    assert.equal((await callHost(`/api/fire-recovery/incidents/${otherIncident.id}`, { host: "other.test", cookie: bravo.pair })).json.data.trackingId, "other-track");
    const scheduleText = JSON.stringify((await callHost("/api/schedule-assignments", { host: "other.test", cookie: bravo.pair })).json);
    assert.match(scheduleText, /other-shift/);
    assert.doesNotMatch(scheduleText, /demo-shift/);
    const mailText = JSON.stringify((await callHost("/api/cad/emails", { host: "other.test", cookie: bravo.pair })).json);
    assert.match(mailText, /OTHER-CAD-SECRET/);
    assert.doesNotMatch(mailText, /DEMO-CAD-SECRET/);
    assert.equal(JSON.stringify((await callHost("/api/account-audit", { host: "other.test", cookie: bravo.pair })).json).includes("newbie"), false);
    const foreignExport = await callHost("/api/neris/export", {
      method: "POST",
      host: "other.test",
      cookie: bravo.pair,
      requestOrigin: "https://other.test",
      body: { integration: { entityId: "FD11111111" } },
    });
    assert.equal(foreignExport.status, 403);
    assert.equal(foreignExport.json.code, "TENANT_ENTITY_MISMATCH");
    assert.equal((await call(`/api/incidents/${otherIncident.id}`, { cookie: first.pair })).status, 404);
    assert.equal((await callHost("/api/incidents", { host: "other.test", cookie: first.pair })).status, 401);

    const reportIncident = await call("/api/incidents", {
      method: "POST",
      cookie: first.pair,
      requestOrigin: origin,
      body: { incidentType: "Lock test" },
    });
    assert.equal(reportIncident.status, 201);
    const reportId = reportIncident.json.data.id;
    const secretValue = "SHOULD-NOT-APPEAR-IN-HISTORY";
    const createdDraft = await call(`/api/neris/drafts/${reportId}`, {
      method: "PATCH",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: { payload: { reportStatus: "Draft", formValues: { secret_field: secretValue } } },
    });
    assert.equal(createdDraft.status, 200, JSON.stringify(createdDraft.json));
    const reviewed = await call(`/api/neris/drafts/${reportId}`, {
      method: "PATCH",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: {
        baseUpdatedAt: createdDraft.json.updatedAt,
        payload: { reportStatus: "In Review", formValues: { secret_field: secretValue } },
      },
    });
    assert.equal(reviewed.status, 200, JSON.stringify(reviewed.json));
    const lockedEdit = await call(`/api/neris/drafts/${reportId}`, {
      method: "PATCH",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: {
        baseUpdatedAt: reviewed.json.updatedAt,
        payload: { reportStatus: "In Review", formValues: { secret_field: "changed" } },
      },
    });
    assert.equal(lockedEdit.status, 409);
    assert.equal(lockedEdit.json.code, "REPORT_LOCKED");
    const staleSave = await call(`/api/neris/drafts/${reportId}`, {
      method: "PATCH",
      cookie: first.pair,
      requestOrigin: origin,
      body: {
        baseUpdatedAt: createdDraft.json.updatedAt,
        payload: { reportStatus: "In Review", formValues: { secret_field: secretValue } },
      },
    });
    assert.equal(staleSave.status, 409);
    assert.equal(
      staleSave.json.message,
      "Someone else saved this report while you were editing. Reload to see their changes before saving again.",
    );
    const unlocked = await call(`/api/neris/drafts/${reportId}/unlock`, {
      method: "POST",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: { baseUpdatedAt: reviewed.json.updatedAt },
    });
    assert.equal(unlocked.status, 200, JSON.stringify(unlocked.json));
    assert.equal(unlocked.json.data.reportStatus, "Draft");
    const reviewedAgain = await call(`/api/neris/drafts/${reportId}`, {
      method: "PATCH",
      cookie: first.pair,
      requestOrigin: origin,
      body: {
        baseUpdatedAt: unlocked.json.updatedAt,
        payload: { reportStatus: "In Review", formValues: { secret_field: secretValue } },
      },
    });
    assert.equal(reviewedAgain.status, 200, JSON.stringify(reviewedAgain.json));
    const exported = await call(`/api/neris/drafts/${reportId}`, {
      method: "PATCH",
      cookie: first.pair,
      requestOrigin: origin,
      body: {
        baseUpdatedAt: reviewedAgain.json.updatedAt,
        payload: { reportStatus: "Exported", formValues: { secret_field: secretValue } },
      },
    });
    assert.equal(exported.status, 200, JSON.stringify(exported.json));
    const firefighterUnlockExported = await call(`/api/neris/drafts/${reportId}/unlock`, {
      method: "POST",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: { baseUpdatedAt: exported.json.updatedAt },
    });
    assert.equal(firefighterUnlockExported.status, 403);
    assert.match(firefighterUnlockExported.json.message, /Only an admin can unlock an exported report/);
    const lockedDelete = await call(`/api/incidents/${reportId}`, {
      method: "DELETE",
      cookie: first.pair,
      requestOrigin: origin,
      body: { deletedReason: "too soon" },
    });
    assert.equal(lockedDelete.status, 409);
    assert.equal(lockedDelete.json.code, "REPORT_LOCKED");
    const adminUnlock = await call(`/api/neris/drafts/${reportId}/unlock`, {
      method: "POST",
      cookie: first.pair,
      requestOrigin: origin,
      body: { baseUpdatedAt: exported.json.updatedAt },
    });
    assert.equal(adminUnlock.status, 200);
    assert.equal(adminUnlock.json.data.reportStatus, "Draft");
    await call("/api/permissions/policy", {
      method: "PUT",
      cookie: first.pair,
      requestOrigin: origin,
      body: { permission: "incidents.delete", minimumRole: "user" },
    });
    const firefighterDelete = await call(`/api/incidents/${reportId}`, {
      method: "DELETE",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: { deletedReason: "no" },
    });
    assert.equal(firefighterDelete.status, 403);
    assert.match(firefighterDelete.json.message, /Only an admin can delete a report/);
    const history = await call(`/api/neris/drafts/${reportId}/history`, { cookie: ffCookie.pair });
    assert.equal(history.status, 200);
    const reportHistoryText = JSON.stringify(history.json);
    assert.match(reportHistoryText, /secret_field/);
    assert.match(reportHistoryText, /reportStatus/);
    assert.doesNotMatch(reportHistoryText, /SHOULD-NOT-APPEAR-IN-HISTORY/);
    const otherHistory = await callHost(`/api/neris/drafts/${reportId}/history`, {
      host: "other.test",
      cookie: bravo.pair,
    });
    assert.equal(JSON.stringify(otherHistory.json).includes("secret_field"), false);
    const deletedReport = await call(`/api/incidents/${reportId}`, {
      method: "DELETE",
      cookie: first.pair,
      requestOrigin: origin,
      body: { deletedReason: "unlocked" },
    });
    assert.equal(deletedReport.status, 200);
    const historyAfterDelete = await call(`/api/neris/drafts/${reportId}/history`, { cookie: first.pair });
    assert.ok(historyAfterDelete.json.data.length > 0);

    const keepIncident = await call("/api/incidents", {
      method: "POST",
      cookie: first.pair,
      requestOrigin: origin,
      body: { incidentType: "Keep me" },
    });
    assert.equal(keepIncident.status, 201);
    const keepId = keepIncident.json.data.id;
    const keepDraft = await call(`/api/neris/drafts/${keepId}`, {
      method: "PATCH",
      cookie: first.pair,
      requestOrigin: origin,
      body: { payload: { reportStatus: "Draft", formValues: { notes: "practice" } } },
    });
    assert.equal(keepDraft.status, 200, JSON.stringify(keepDraft.json));
    const keepReviewed = await call(`/api/neris/drafts/${keepId}`, {
      method: "PATCH",
      cookie: first.pair,
      requestOrigin: origin,
      body: {
        baseUpdatedAt: keepDraft.json.updatedAt,
        payload: { reportStatus: "In Review", formValues: { notes: "practice" } },
      },
    });
    assert.equal(keepReviewed.status, 200);
    const lockedReportDelete = await call(`/api/neris/drafts/${keepId}`, {
      method: "DELETE",
      cookie: first.pair,
      requestOrigin: origin,
    });
    assert.equal(lockedReportDelete.status, 409);
    assert.equal(lockedReportDelete.json.code, "REPORT_LOCKED");
    const keepUnlocked = await call(`/api/neris/drafts/${keepId}/unlock`, {
      method: "POST",
      cookie: first.pair,
      requestOrigin: origin,
      body: { baseUpdatedAt: keepReviewed.json.updatedAt },
    });
    assert.equal(keepUnlocked.status, 200);
    const firefighterReportDelete = await call(`/api/neris/drafts/${keepId}`, {
      method: "DELETE",
      cookie: ffCookie.pair,
      requestOrigin: origin,
    });
    assert.equal(firefighterReportDelete.status, 403);
    assert.match(firefighterReportDelete.json.message, /Only an admin can delete a report/);
    const reportOnlyDelete = await call(`/api/neris/drafts/${keepId}`, {
      method: "DELETE",
      cookie: first.pair,
      requestOrigin: origin,
    });
    assert.equal(reportOnlyDelete.status, 200);
    const draftGone = await call(`/api/neris/drafts/${keepId}`, { cookie: first.pair });
    assert.equal(draftGone.status, 200);
    assert.equal(draftGone.json.data.reportRemoved, true);
    assert.equal(draftGone.json.data.formValues.notes, "practice");
    const incidentKept = await call(`/api/incidents/${keepId}`, { cookie: first.pair });
    assert.equal(incidentKept.status, 200);
    assert.equal(incidentKept.json.data.deletedAt ?? null, null);
    const historyKept = await call(`/api/neris/drafts/${keepId}/history`, { cookie: first.pair });
    assert.ok(historyKept.json.data.length > 0);
    const removedList = await call("/api/neris/removed-reports", { cookie: first.pair });
    assert.equal(removedList.status, 200, JSON.stringify(removedList.json));
    assert.ok(removedList.json.data.callNumbers.includes(keepId));
    const otherRemoved = await callHost("/api/neris/removed-reports", {
      host: "other.test",
      cookie: bravo.pair,
    });
    assert.equal(JSON.stringify(otherRemoved.json.data?.callNumbers ?? []).includes(keepId), false);
    const restarted = await call(`/api/neris/drafts/${keepId}`, {
      method: "PATCH",
      cookie: first.pair,
      requestOrigin: origin,
      body: { payload: { reportStatus: "Draft", formValues: { notes: "again" } } },
    });
    assert.equal(restarted.status, 200, JSON.stringify(restarted.json));
    const removedAfterRestart = await call("/api/neris/removed-reports", { cookie: first.pair });
    assert.equal(removedAfterRestart.json.data.callNumbers.includes(keepId), false);
    const draftBack = await call(`/api/neris/drafts/${keepId}`, { cookie: first.pair });
    assert.equal(draftBack.status, 200);

    const seedIncident = await call("/api/incidents", {
      method: "POST",
      cookie: first.pair,
      requestOrigin: origin,
      body: { incidentType: "Seed test" },
    });
    assert.equal(seedIncident.status, 201);
    const seedId = seedIncident.json.data.id;
    const seededSave = await call(`/api/neris/drafts/${seedId}`, {
      method: "PATCH",
      cookie: first.pair,
      requestOrigin: origin,
      body: {
        payload: {
          reportStatus: "Draft",
          formValues: {
            incident_internal_id: "AUTO-1",
            dispatch_center_id: "0000",
            notes: "typed by hand",
          },
          additionalAidEntries: [],
        },
        seedFormValues: {
          incident_internal_id: "AUTO-1",
          dispatch_center_id: "0000",
          notes: "",
        },
      },
    });
    assert.equal(seededSave.status, 200, JSON.stringify(seededSave.json));
    const seedHistory = await call(`/api/neris/drafts/${seedId}/history`, { cookie: first.pair });
    const seedNames = seedHistory.json.data.flatMap((row) => row.fieldNames);
    assert.ok(seedNames.includes("notes"));
    assert.equal(seedNames.includes("incident_internal_id"), false);
    assert.equal(seedNames.includes("dispatch_center_id"), false);
    assert.equal(seedNames.includes("additionalAidEntries"), false);
    assert.equal(seedNames.includes("reportStatus"), false);
    const editedSeed = await call(`/api/neris/drafts/${seedId}`, {
      method: "PATCH",
      cookie: first.pair,
      requestOrigin: origin,
      body: {
        baseUpdatedAt: seededSave.json.updatedAt,
        payload: {
          reportStatus: "Draft",
          formValues: {
            incident_internal_id: "AUTO-1",
            dispatch_center_id: "0000",
            notes: "edited",
          },
        },
        seedFormValues: {
          incident_internal_id: "AUTO-1",
          dispatch_center_id: "0000",
          notes: "",
        },
      },
    });
    assert.equal(editedSeed.status, 200, JSON.stringify(editedSeed.json));
    const editedHistory = await call(`/api/neris/drafts/${seedId}/history`, { cookie: first.pair });
    assert.deepEqual(editedHistory.json.data[0].fieldNames, ["notes"]);

    const entitySave = await call("/api/neris/settings", {
      method: "PATCH",
      cookie: first.pair,
      requestOrigin: origin,
      body: { vendorCode: "fd33333333" },
    });
    assert.equal(entitySave.status, 200, JSON.stringify(entitySave.json));
    assert.equal(entitySave.json.data.vendorCode, "FD33333333");
    const tenantAfterSave = await prisma.tenant.findUnique({ where: { id: demo.id } });
    assert.equal(tenantAfterSave.nerisEntityId, "FD33333333");
    const staleExport = await call("/api/neris/export", {
      method: "POST",
      cookie: first.pair,
      requestOrigin: origin,
      body: { integration: { entityId: "FD11111111" } },
    });
    assert.equal(staleExport.status, 403);
    assert.equal(staleExport.json.code, "TENANT_ENTITY_MISMATCH");

    const sharedDenied = await call("/api/department-shared-settings", {
      method: "PATCH",
      cookie: ffCookie.pair,
      requestOrigin: origin,
      body: { workflowStates: ["Nope"] },
    });
    assert.equal(sharedDenied.status, 403);
    const tooBigLogo = `data:image/png;base64,${Buffer.alloc(500 * 1024 + 8).toString("base64")}`;
    const tooBig = await call("/api/department-shared-settings", {
      method: "PATCH",
      cookie: first.pair,
      requestOrigin: origin,
      body: { logoDataUrl: tooBigLogo },
    });
    assert.equal(tooBig.status, 400);
    assert.match(tooBig.json.message, /500 KB/);
    const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const sharedSaved = await call("/api/department-shared-settings", {
      method: "PATCH",
      cookie: first.pair,
      requestOrigin: origin,
      body: {
        logoDataUrl: tinyPng,
        workflowStates: ["Demo Only State", "On Scene"],
        submenuVisibility: { "/reporting/neris": false },
        displayCards: { incidents: ["/reporting/neris"] },
      },
    });
    assert.equal(sharedSaved.status, 200, JSON.stringify(sharedSaved.json));
    const sharedRead = await call("/api/department-details", { cookie: ffCookie.pair });
    assert.equal(sharedRead.json.data.sharedDepartmentSettings.workflowStates[0], "Demo Only State");
    assert.equal(sharedRead.json.data.sharedDepartmentSettings.submenuVisibility["/reporting/neris"], false);
    assert.equal(sharedRead.json.data.sharedDepartmentSettings.displayCards.incidents[0], "/reporting/neris");
    assert.equal(sharedRead.json.data.sharedDepartmentSettings.logoDataUrl, tinyPng);
    const detailsPost = await call("/api/department-details", {
      method: "POST",
      cookie: first.pair,
      requestOrigin: origin,
      body: { departmentName: "Demo Fire", marker: "STILL-HERE" },
    });
    assert.equal(detailsPost.status, 200);
    const afterDetailsPost = await call("/api/department-details", { cookie: first.pair });
    assert.equal(afterDetailsPost.json.data.marker, "STILL-HERE");
    assert.equal(afterDetailsPost.json.data.sharedDepartmentSettings.workflowStates[0], "Demo Only State");
    const otherShared = await callHost("/api/department-details", { host: "other.test", cookie: bravo.pair });
    assert.equal(JSON.stringify(otherShared.json).includes("Demo Only State"), false);

    const second = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "chief", password },
    });
    assert.equal(second.status, 200);
    const otherDevice = sessionCookie(second.setCookie);
    const changed = await call("/api/auth/change-password", {
      method: "POST",
      cookie: first.pair,
      requestOrigin: origin,
      body: { username: "someone-else", currentPassword: password, newPassword: "Password2!" },
    });
    assert.equal(changed.status, 200);
    const revoked = await call("/api/auth/session", { cookie: otherDevice.pair });
    assert.equal(revoked.status, 401);
    const kept = await call("/api/auth/session", { cookie: first.pair });
    assert.equal(kept.status, 200);

    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: {
        lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const idle = await call("/api/auth/session", { cookie: first.pair });
    assert.equal(idle.status, 401);

    const deviceOne = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "chief", password: "Password2!" },
    });
    assert.equal(deviceOne.status, 200);
    const deviceOneCookie = sessionCookie(deviceOne.setCookie);
    const deviceTwo = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "chief", password: "Password2!" },
    });
    assert.equal(deviceTwo.status, 200);
    const deviceTwoCookie = sessionCookie(deviceTwo.setCookie);
    await revokeAllSessions(prisma, user.id);
    assert.equal((await call("/api/auth/session", { cookie: deviceOneCookie.pair })).status, 401);
    assert.equal((await call("/api/users", { cookie: deviceTwoCookie.pair })).status, 401);

    clearLoginLockouts();
    const failuresBeforeHuge = loginFailureCount();
    const hugeName = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "u".repeat(50_000), password: "nope" },
    });
    assert.equal(hugeName.status, 401);
    assert.equal(hugeName.json.message, "Invalid username or password.");
    const hugePassword = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "chief", password: "p".repeat(LOGIN_PASSWORD_MAX + 1) },
    });
    assert.equal(hugePassword.status, 401);
    assert.equal(hugePassword.json.message, "Invalid username or password.");
    assert.equal(loginFailureCount(), failuresBeforeHuge);
    assert.equal(loginLockStatus(demo.id, "chief").locked, false);

    const fullStamp = Date.now();
    for (let index = 0; index < LOGIN_FAILURE_MAP_MAX; index += 1) {
      for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
        noteLoginFailure(demo.id, `locked-${index}`, fullStamp);
      }
    }
    const blocked = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "brand-new-person", password: "wrong" },
    });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.json.message, "Too many sign-in attempts. Try again later.");
    const stillWorks = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "chief", password: "Password2!" },
    });
    assert.equal(stillWorks.status, 200);
    clearLoginLockouts();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const failed = await call("/api/auth/login", {
        method: "POST",
        requestOrigin: origin,
        body: { username: "nobody", password: "wrong" },
      });
      assert.equal(failed.status, 401, `failed attempt ${attempt}`);
    }
    const locked = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "nobody", password: "wrong" },
    });
    assert.equal(locked.status, 429);

    const otherLogin = await callHost("/api/auth/login", {
      method: "POST",
      host: "other.test",
      requestOrigin: "https://other.test",
      body: { username: "chief", password },
    });
    assert.equal(otherLogin.status, 200);
    const otherCookie = sessionCookie(otherLogin.setCookie);
    assert.match(otherCookie.line, /Secure/i);
    assert.doesNotMatch(otherCookie.line, /Max-Age/i);

    const loggedOut = await callHost("/api/auth/logout", {
      method: "POST",
      host: "other.test",
      cookie: otherCookie.pair,
      requestOrigin: "https://other.test",
      body: {},
    });
    assert.equal(loggedOut.status, 200);
    const afterLogout = await callHost("/api/users", {
      host: "other.test",
      cookie: otherCookie.pair,
    });
    assert.equal(afterLogout.status, 401);

    delete process.env.CAD_INGEST_SECRET;
    const noSecret = await call("/api/cad/inbound-email", {
      method: "POST",
      body: { from: "a@b.test", to: "demo@cad.fireultimate.app", raw: "" },
    });
    assert.equal(noSecret.status, 503);
    process.env.CAD_INGEST_SECRET = "stage-b-test-secret";
    const missingHeader = await call("/api/cad/inbound-email", {
      method: "POST",
      body: { from: "a@b.test", to: "demo@cad.fireultimate.app", raw: "" },
    });
    assert.equal(missingHeader.status, 401);
    const wrongHeader = await call("/api/cad/inbound-email", {
      method: "POST",
      extraHeaders: { "x-cad-ingest-secret": "wrong" },
      body: { from: "a@b.test", to: "demo@cad.fireultimate.app", raw: "" },
    });
    assert.equal(wrongHeader.status, 401);

    const secretHeader = { "x-cad-ingest-secret": "stage-b-test-secret" };
    const unknownDepartment = await call("/api/cad/inbound-email", {
      method: "POST",
      extraHeaders: secretHeader,
      body: {
        from: "dispatch@co.iroquois.il.us",
        to: "missing-dept@cad.fireultimate.app",
        raw: "hello",
      },
    });
    assert.equal(unknownDepartment.status, 200);
    assert.equal(unknownDepartment.json.rejected, true);
    assert.equal(unknownDepartment.json.code, "cad_allowlist");
    assert.equal(
      await prisma.cadEmailIngest.count({ where: { toAddress: "missing-dept@cad.fireultimate.app" } }),
      0,
    );

    const emptyList = await call("/api/cad/inbound-email", {
      method: "POST",
      extraHeaders: secretHeader,
      body: {
        from: "dispatch@co.iroquois.il.us",
        to: "demo@cad.fireultimate.app",
        raw: "hello",
      },
    });
    assert.equal(emptyList.status, 200);
    assert.equal(emptyList.json.rejected, true);
    assert.equal(
      await prisma.cadEmailIngest.count({ where: { tenantId: demo.id, toAddress: "demo@cad.fireultimate.app" } }),
      0,
    );

    await prisma.cadEmailAllowlistEntry.create({
      data: {
        tenantId: demo.id,
        pattern: "dispatch@co.iroquois.il.us",
        patternType: "exact_email",
        enabled: true,
      },
    });
    const namedSender = "County Dispatch <dispatch@co.iroquois.il.us>";
    const allowedSender = await call("/api/cad/inbound-email", {
      method: "POST",
      extraHeaders: secretHeader,
      body: { from: namedSender, to: "demo@cad.fireultimate.app", raw: "hello" },
    });
    assert.equal(allowedSender.status, 200);
    assert.equal(allowedSender.json.ok, true);
    assert.equal(
      await prisma.cadEmailIngest.count({ where: { tenantId: demo.id, fromAddress: namedSender } }),
      1,
    );

    const personal = await call("/api/cad/inbound-email", {
      method: "POST",
      extraHeaders: secretHeader,
      body: { from: "me@personal.example", to: "demo@cad.fireultimate.app", raw: "nope" },
    });
    assert.equal(personal.status, 200);
    assert.equal(personal.json.rejected, true);
    assert.equal(personal.json.code, "cad_allowlist");
    assert.equal(
      await prisma.cadEmailIngest.count({ where: { tenantId: demo.id, fromAddress: "me@personal.example" } }),
      0,
    );
    delete process.env.CAD_INGEST_SECRET;

    const exportLogin = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "chief", password: "Password2!" },
    });
    assert.equal(exportLogin.status, 200);
    const exportCookie = sessionCookie(exportLogin.setCookie);
    const forgedSuccess = await call("/api/neris/export-history", {
      method: "POST",
      cookie: exportCookie.pair,
      requestOrigin: origin,
      body: {
        callNumber: "FORGED",
        attemptStatus: "success",
        nerisId: "FD33333333|FORGED|1710000000",
        submittedPayloadPreview: "{}",
      },
    });
    assert.equal(forgedSuccess.status, 400);
    assert.match(forgedSuccess.json.message, /failed export/);
    assert.equal(await prisma.nerisExportHistory.count({ where: { tenantId: demo.id, callNumber: "FORGED" } }), 0);

    const browserFailure = await call("/api/neris/export-history", {
      method: "POST",
      cookie: exportCookie.pair,
      requestOrigin: origin,
      body: {
        callNumber: "LOCAL-FAIL",
        attemptStatus: "failed",
        responseDetail: "server-receipt:v1\nstolen",
        responseSummary: "network",
      },
    });
    assert.equal(browserFailure.status, 201);
    assert.equal(browserFailure.json.data.attemptStatus, "failed");
    assert.equal(String(browserFailure.json.data.responseDetail).includes("server-receipt"), false);
    const storedFailure = await prisma.nerisExportHistory.findFirst({
      where: { tenantId: demo.id, callNumber: "LOCAL-FAIL" },
    });
    assert.equal(String(storedFailure.responseDetail).includes("server-receipt"), false);

    const originalFetch = globalThis.fetch;
    let nerisMode = "error";
    let frLoginMode = "ok";
    globalThis.fetch = async (url, init) => {
      const target = String(url);
      if (target.startsWith("http://127.0.0.1") || target.startsWith("http://localhost")) {
        return originalFetch(url, init);
      }
      if (target.includes("/incident/")) {
        if (nerisMode === "error") {
          return new Response(JSON.stringify({ detail: "NERIS rejected the incident" }), {
            status: 422,
            statusText: "Unprocessable Entity",
          });
        }
        return new Response(JSON.stringify({ neris_id: "FD33333333|2026|1710000000" }), {
          status: 201,
          statusText: "Created",
        });
      }
      if (target.includes("LoginAndGetJWTToken")) {
        if (frLoginMode === "echo") {
          return new Response(JSON.stringify({ message: `rejected ${init?.body ? String(init.body) : ""}` }), {
            status: 401,
          });
        }
        return new Response(JSON.stringify({ LoginAndGetJWTTokenResult: "jwt-test" }), { status: 200 });
      }
      if (target.includes("addincident")) {
        return new Response(JSON.stringify({ Done: { TrackingId: "track-1" } }), { status: 200 });
      }
      return new Response("unexpected upstream", { status: 500, statusText: "Error" });
    };
    process.env.NERIS_STATIC_ACCESS_TOKEN = "test-token";
    process.env.NERIS_BASE_URL = "https://neris.invalid/v1";
    process.env.FIRE_RECOVERY_CREDENTIAL_KEY = "practice-test-key";
    const exportBody = {
      callNumber: "26-RECEIPT",
      reportStatus: "In Review",
      formValues: {
        incident_internal_id: "26-RECEIPT",
        primary_incident_type: "FIRE",
        fd_neris_id: "FD33333333",
      },
      incidentSnapshot: { incidentType: "Outside fire", address: "1 Practice Lane" },
      integration: { entityId: "FD33333333", clientUtcOffsetMinutes: 300 },
    };
    try {
      const nerisError = await call("/api/neris/export", {
        method: "POST",
        cookie: exportCookie.pair,
        requestOrigin: origin,
        body: { ...exportBody, callNumber: "26-NERIS-ERROR" },
      });
      assert.equal(nerisError.status, 422, JSON.stringify(nerisError.json));
      assert.equal(nerisError.json.exportRecorded, true);
      const errorRow = await prisma.nerisExportHistory.findFirst({
        where: { tenantId: demo.id, callNumber: "26-NERIS-ERROR" },
      });
      assert.equal(errorRow.attemptStatus, "failed");
      assert.equal(errorRow.reportWriterName, "chief");
      assert.ok(String(errorRow.responseDetail).startsWith("server-receipt:v1"));
      assert.equal(
        await prisma.nerisExportHistory.count({ where: { tenantId: demo.id, callNumber: "26-NERIS-ERROR" } }),
        1,
      );

      nerisMode = "success";
      const nerisOk = await call("/api/neris/export", {
        method: "POST",
        cookie: exportCookie.pair,
        requestOrigin: origin,
        body: exportBody,
      });
      assert.equal(nerisOk.status, 201, JSON.stringify(nerisOk.json));
      assert.equal(nerisOk.json.exportRecorded, true);
      assert.equal(nerisOk.json.neris.neris_id, "FD33333333|2026|1710000000");
      const successRow = await prisma.nerisExportHistory.findFirst({
        where: { tenantId: demo.id, callNumber: "26-RECEIPT", attemptStatus: "success" },
      });
      assert.equal(successRow.nerisId, "FD33333333|2026|1710000000");
      assert.equal(successRow.reportWriterName, "chief");
      assert.ok(String(successRow.responseDetail).startsWith("server-receipt:v1"));
      assert.ok(String(successRow.submittedPayloadPreview).startsWith("{"));
      const listed = await call("/api/neris/export-history", { cookie: exportCookie.pair });
      const listedRow = listed.json.data.find((row) => row.callNumber === "26-RECEIPT");
      assert.equal(String(listedRow.responseDetail).includes("server-receipt"), false);
      assert.equal(listedRow.nerisId, "FD33333333|2026|1710000000");

      await prisma.nerisExportHistory.create({
        data: {
          tenantId: demo.id,
          callNumber: "FAKE-SUCCESS",
          attemptStatus: "success",
          nerisId: "FD33333333|FAKE|1710000000",
          submittedPayloadPreview: "{}",
          responseDetail: "browser-wrote-this",
        },
      });
      await prisma.tenant.update({
        where: { id: demo.id },
        data: {
          fireRecoveryDepartmentName: "Demo Fire",
          fireRecoveryApiUsername: "sandbox-user",
          fireRecoveryApiPassword: encryptSecret("sandbox-pass"),
        },
      });
      const fakeBill = await call("/api/fire-recovery/submit", {
        method: "POST",
        cookie: exportCookie.pair,
        requestOrigin: origin,
        body: { callNumber: "FAKE-SUCCESS" },
      });
      assert.equal(fakeBill.status, 400);
      assert.match(fakeBill.json.message, /No successful NERIS export/);
      const realBill = await call("/api/fire-recovery/submit", {
        method: "POST",
        cookie: exportCookie.pair,
        requestOrigin: origin,
        body: { callNumber: "26-RECEIPT" },
      });
      assert.equal(realBill.status, 201, JSON.stringify(realBill.json));
      assert.equal(realBill.json.data.trackingId, "track-1");

      await prisma.tenant.update({
        where: { id: demo.id },
        data: { fireRecoveryApiPassword: "Readable-Secret-9" },
      });
      const plainBill = await call("/api/fire-recovery/submit", {
        method: "POST",
        cookie: exportCookie.pair,
        requestOrigin: origin,
        body: { callNumber: "26-RECEIPT" },
      });
      assert.equal(plainBill.status, 400);
      assert.equal(plainBill.json.message, "re-enter the password");
      assert.equal(JSON.stringify(plainBill.json).includes("Readable-Secret-9"), false);

      const leakPassword = "Leak-Check-Pw-42";
      const savedPassword = await call("/api/fire-recovery/settings", {
        method: "PATCH",
        cookie: exportCookie.pair,
        requestOrigin: origin,
        body: { fireRecoveryApiPassword: leakPassword },
      });
      assert.equal(savedPassword.status, 200, JSON.stringify(savedPassword.json));
      assert.equal(savedPassword.json.data.passwordIsSet, true);
      assert.equal(JSON.stringify(savedPassword.json).includes(leakPassword), false);
      const storedPassword = await prisma.tenant.findUnique({ where: { id: demo.id } });
      assert.ok(String(storedPassword.fireRecoveryApiPassword).startsWith("enc:v1:"));
      assert.equal(String(storedPassword.fireRecoveryApiPassword).includes(leakPassword), false);
      const settingsRead = await call("/api/fire-recovery/settings", { cookie: exportCookie.pair });
      assert.equal(settingsRead.json.data.passwordIsSet, true);
      assert.equal(JSON.stringify(settingsRead.json).includes(leakPassword), false);

      frLoginMode = "echo";
      const leaked = await call("/api/fire-recovery/submit", {
        method: "POST",
        cookie: exportCookie.pair,
        requestOrigin: origin,
        body: { callNumber: "26-RECEIPT" },
      });
      assert.equal(leaked.status, 400);
      assert.equal(JSON.stringify(leaked.json).includes(leakPassword), false);
      const billingRow = await prisma.fireRecoveryIncidentBilling.findUnique({
        where: { tenantId_callNumber: { tenantId: demo.id, callNumber: "26-RECEIPT" } },
      });
      assert.equal(String(billingRow.lastSubmitError).includes(leakPassword), false);

      process.env.FIRE_RECOVERY_CREDENTIAL_KEY = "wrong-key";
      const wrongKey = await call("/api/fire-recovery/submit", {
        method: "POST",
        cookie: exportCookie.pair,
        requestOrigin: origin,
        body: { callNumber: "26-RECEIPT" },
      });
      assert.equal(wrongKey.status, 400);
      assert.equal(wrongKey.json.message, "re-enter the password");
      assert.equal(JSON.stringify(wrongKey.json).includes(leakPassword), false);
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.NERIS_STATIC_ACCESS_TOKEN;
      delete process.env.NERIS_BASE_URL;
      delete process.env.FIRE_RECOVERY_CREDENTIAL_KEY;
    }

    assert.equal(permissionForRequest("GET", "/api/fire-recovery/incidents"), "billing.view");
    assert.equal(permissionForRequest("GET", "/api/fire-recovery/incidents/26-1"), "billing.view");
    assert.equal(permissionForRequest("POST", "/api/fire-recovery/submit"), "billing.submit");
    const billingUser = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "ff", password },
    });
    assert.equal(billingUser.status, 200);
    const billingUserCookie = sessionCookie(billingUser.setCookie);
    const hiddenList = await call("/api/fire-recovery/incidents", { cookie: billingUserCookie.pair });
    assert.equal(hiddenList.status, 403);
    assert.equal(hiddenList.json.code, "FORBIDDEN");
    const hiddenOne = await call(`/api/fire-recovery/incidents/${demoIncidentId}`, {
      cookie: billingUserCookie.pair,
    });
    assert.equal(hiddenOne.status, 403);
    const billingAdmin = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: origin,
      body: { username: "chief", password: "Password2!" },
    });
    assert.equal(billingAdmin.status, 200);
    const billingAdminCookie = sessionCookie(billingAdmin.setCookie);
    const visibleList = await call("/api/fire-recovery/incidents", { cookie: billingAdminCookie.pair });
    assert.equal(visibleList.status, 200);
    assert.equal(visibleList.json.ok, true);
    const visibleOne = await call(`/api/fire-recovery/incidents/${demoIncidentId}`, {
      cookie: billingAdminCookie.pair,
    });
    assert.equal(visibleOne.status, 200);
    assert.equal(visibleOne.json.data.trackingId, "demo-track");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}, { timeout: 180000 });
