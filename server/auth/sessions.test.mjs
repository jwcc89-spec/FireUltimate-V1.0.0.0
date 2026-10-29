import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import test from "node:test";
import bcrypt from "bcryptjs";
import { PUBLIC_API_ROUTES, normalizeRole, publicHostname } from "./sessions.mjs";

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
  assert.equal(publicHostname({ headers: { host: "alpha.test", "x-forwarded-host": "bravo.test" } }), "alpha.test");
  process.env.TRUST_PROXY = "1";
  assert.equal(publicHostname({ headers: { host: "alpha.test", "x-forwarded-host": "spoof.test, render.test" } }), "render.test");
  delete process.env.TRUST_PROXY;
  assert.equal(normalizeRole("super_admin"), "superadmin");
  assert.equal(normalizeRole("sub-admin"), "subadmin");
  assert.deepEqual([...PUBLIC_API_ROUTES].sort(), [...APPROVED_PUBLIC].sort());

  execFileSync("npx", ["prisma", "generate"], { stdio: "inherit", env: process.env });
  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });

  const { app, prisma, clearLoginLockouts } = await import("../neris-proxy.mjs");
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

  async function call(path, { method = "GET", cookie = "", requestOrigin = "", forwardedHost = "", body } = {}) {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    if (requestOrigin) headers.origin = requestOrigin;
    if (forwardedHost) headers["x-forwarded-host"] = forwardedHost;
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
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}, { timeout: 180000 });
