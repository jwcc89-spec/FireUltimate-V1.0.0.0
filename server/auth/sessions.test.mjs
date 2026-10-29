import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import bcrypt from "bcryptjs";
import { PUBLIC_API_ROUTES } from "./sessions.mjs";

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

    const crossed = await call("/api/auth/session", {
      cookie: first.pair,
      forwardedHost: "other.test",
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

    const otherLogin = await call("/api/auth/login", {
      method: "POST",
      requestOrigin: "https://other.test",
      forwardedHost: "other.test",
      body: { username: "chief", password },
    });
    assert.equal(otherLogin.status, 200);
    const otherCookie = sessionCookie(otherLogin.setCookie);
    assert.match(otherCookie.line, /Secure/i);
    assert.doesNotMatch(otherCookie.line, /Max-Age/i);

    const loggedOut = await call("/api/auth/logout", {
      method: "POST",
      cookie: otherCookie.pair,
      requestOrigin: "https://other.test",
      forwardedHost: "other.test",
      body: {},
    });
    assert.equal(loggedOut.status, 200);
    const afterLogout = await call("/api/users", {
      cookie: otherCookie.pair,
      forwardedHost: "other.test",
    });
    assert.equal(afterLogout.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
}, { timeout: 180000 });
