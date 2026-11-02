import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import http from "node:http";
import test from "node:test";
import bcrypt from "bcryptjs";
import { Client } from "pg";

const DATABASE_URL = "postgresql://fu:fu@127.0.0.1:5432/fu_session_test?sslmode=disable";
const databaseHost = new URL(DATABASE_URL).hostname;
if (databaseHost !== "127.0.0.1" && databaseHost !== "localhost") {
  throw new Error("Refusing to run Fire Recovery tests against a non-local database.");
}

process.env.DATABASE_URL = DATABASE_URL;
process.env.NODE_ENV = "test";
process.env.FIRE_RECOVERY_CREDENTIAL_KEY = "practice-test-key";
delete process.env.FIRE_RECOVERY_MODE;
delete process.env.CAD_INGEST_SECRET;

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function startVendor() {
  const calls = { login: 0, bill: 0, departments: [] };
  let mode = "success";
  const server = http.createServer(async (request, response) => {
    const url = request.url || "";
    const raw = await readBody(request);
    if (url.includes("LoginAndGetJWTToken")) {
      calls.login += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ LoginAndGetJWTTokenResult: "jwt-test" }));
      return;
    }
    if (url.includes("addincident")) {
      calls.bill += 1;
      try {
        const parsed = JSON.parse(raw || "{}");
        calls.departments.push(parsed?.IncidentToBillPayload?.NERISDepartmentId ?? "");
      } catch {
        calls.departments.push("");
      }
      if (mode === "timeout") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      if (mode === "http400") {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ message: "Refused" }));
        return;
      }
      if (mode === "http500") {
        response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ message: "Down" }));
        return;
      }
      if (mode === "nostatus") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ Done: { "API Response": { Status: 0, Message: "No" } } }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          Done: { TrackingId: "track-w6", "API Response": { Status: 1, Message: "Success" } },
        }),
      );
      return;
    }
    response.writeHead(404);
    response.end();
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        calls,
        setMode(next) {
          mode = next;
        },
        port: server.address().port,
      });
    });
  });
}

test("fake vendor proves one bill per incident", async (t) => {
  const lockClient = new Client({ connectionString: DATABASE_URL });
  await lockClient.connect();
  await lockClient.query("SELECT pg_advisory_lock(424242)");
  t.after(async () => {
    await lockClient.query("SELECT pg_advisory_unlock(424242)").catch(() => {});
    await lockClient.end().catch(() => {});
  });

  const vendor = await startVendor();
  process.env.FIRE_RECOVERY_BASE_URL = `http://127.0.0.1:${vendor.port}`;
  process.env.FIRE_RECOVERY_POST_TIMEOUT_MS = "400";
  t.after(() => {
    vendor.server.close();
    delete process.env.FIRE_RECOVERY_BASE_URL;
    delete process.env.FIRE_RECOVERY_POST_TIMEOUT_MS;
    delete process.env.FIRE_RECOVERY_MODE;
    delete process.env.FIRE_RECOVERY_CREDENTIAL_KEY;
  });

  execFileSync("npx", ["prisma", "generate"], { stdio: "inherit", env: process.env });
  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });

  const { app, prisma } = await import("./neris-proxy.mjs");
  const { encryptSecret } = await import("./crypto/secretBox.mjs");
  t.after(async () => {
    await prisma.$disconnect();
  });

  const password = "Password1!";
  const passwordHash = await bcrypt.hash(password, 4);
  await prisma.tenant.deleteMany();
  const demo = await prisma.tenant.create({
    data: {
      slug: "demo",
      name: "Demo Fire",
      status: "active",
      nerisEntityId: "FD33333333",
      fireRecoveryDepartmentName: "Demo Fire",
      fireRecoveryApiUsername: "sandbox-user",
      fireRecoveryApiPassword: encryptSecret("sandbox-pass"),
    },
  });
  await prisma.departmentDetails.create({
    data: { tenantId: demo.id, departmentName: "Demo Fire", payloadJson: {} },
  });
  await prisma.user.create({
    data: { tenantId: demo.id, username: "chief", passwordHash, role: "admin" },
  });
  const other = await prisma.tenant.create({
    data: {
      slug: "other",
      name: "Other Fire",
      status: "active",
      nerisEntityId: "FD44444444",
      fireRecoveryDepartmentName: "Other Fire",
      fireRecoveryApiUsername: "other-user",
      fireRecoveryApiPassword: encryptSecret("other-pass"),
    },
  });
  await prisma.tenantDomain.create({
    data: { tenantId: other.id, hostname: "other.test", isPrimary: true },
  });
  await prisma.departmentDetails.create({
    data: { tenantId: other.id, departmentName: "Other Fire", payloadJson: {} },
  });
  await prisma.user.create({
    data: { tenantId: other.id, username: "chief", passwordHash, role: "admin" },
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  function call(path, { method = "GET", cookie = "", host = "127.0.0.1", origin = "", body } = {}) {
    return new Promise((resolve, reject) => {
      const payload = body !== undefined ? JSON.stringify(body) : null;
      const headers = { host };
      if (cookie) headers.cookie = cookie;
      if (origin) headers.origin = origin;
      if (payload) {
        headers["content-type"] = "application/json";
        headers["content-length"] = Buffer.byteLength(payload);
      }
      const request = http.request({ hostname: "127.0.0.1", port, path, method, headers }, (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = {};
          try {
            json = text ? JSON.parse(text) : {};
          } catch {
            json = {};
          }
          const setCookie = response.headers["set-cookie"];
          resolve({
            status: response.statusCode,
            json,
            setCookie: Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [],
          });
        });
      });
      request.on("error", reject);
      if (payload) request.write(payload);
      request.end();
    });
  }

  const login = await call("/api/auth/login", {
    method: "POST",
    origin: base,
    body: { username: "chief", password },
  });
  assert.equal(login.status, 200, JSON.stringify(login.json));
  const cookie = login.setCookie.find((item) => item.startsWith("fu_session="))?.split(";")[0] ?? "";
  assert.ok(cookie);

  const otherLogin = await call("/api/auth/login", {
    method: "POST",
    host: "other.test",
    origin: "http://other.test",
    body: { username: "chief", password },
  });
  assert.equal(otherLogin.status, 200, JSON.stringify(otherLogin.json));
  const otherCookie = otherLogin.setCookie.find((item) => item.startsWith("fu_session="))?.split(";")[0] ?? "";
  assert.ok(otherCookie);

  const party = {
    id: "p1",
    firstName: "Ada",
    lastName: "Lane",
    street: "1 Main",
    city: "Crescent",
    state: "IL",
    zip: "60922",
    uninsured: true,
    vehicleMake: "Ford",
    vehicleModel: "Focus",
  };

  async function seed(callNumber, { firstName = "Ada" } = {}) {
    await prisma.nerisExportHistory.create({
      data: {
        tenantId: demo.id,
        callNumber,
        attemptStatus: "success",
        nerisId: `FD33333333|${callNumber}|1710000000`,
        reportWriterName: "chief",
        submittedPayloadPreview: "{}",
        responseDetail: "server-receipt:v1\nok",
      },
    });
    await prisma.nerisDraft.upsert({
      where: { tenantId_callNumber: { tenantId: demo.id, callNumber } },
      create: {
        tenantId: demo.id,
        callNumber,
        payload: draftPayload(callNumber, firstName),
      },
      update: { payload: draftPayload(callNumber, firstName) },
    });
  }

  function draftPayload(callNumber, firstName) {
    return {
      reportStatus: "Exported",
      formValues: {
        primary_incident_type: "MEDICAL: INJURY: MOTOR_VEHICLE_COLLISION",
        incident_onset_date: "2026-11-01",
        incident_time_call_arrival: "14:05",
        incident_time_clear: "15:10",
        incident_internal_id: callNumber,
        incident_location_address: "1 Main, Crescent, IL 60922",
        location_state: "IL",
        location_postal_code: "60922",
        resource_units_json: JSON.stringify([{ unitId: "1871", personnel: "Ada Lane", isCanceledEnroute: false }]),
        fire_recovery_billing_json: JSON.stringify({
          version: 1,
          runType: "MOTOR_VEHICLE",
          lawEnforcementReportNumber: "",
          nerisCode: "",
          parties: [{ ...party, firstName }],
        }),
      },
    };
  }

  async function submit(callNumber, session = cookie, host = "") {
    const preview = await call("/api/fire-recovery/preview", {
      method: "POST",
      cookie: session,
      host,
      origin: host ? `http://${host}` : base,
      body: { callNumber },
    });
    assert.equal(preview.status, 200, JSON.stringify(preview.json));
    const sent = await call("/api/fire-recovery/submit", {
      method: "POST",
      cookie: session,
      host,
      origin: host ? `http://${host}` : base,
      body: { callNumber, previewHash: preview.json.data.previewHash },
    });
    return { preview, sent };
  }

  process.env.FIRE_RECOVERY_MODE = "sandbox";
  await seed("W6-SENT");
  const [left, right] = await Promise.all([submit("W6-SENT"), submit("W6-SENT")]);
  const sentOne = [left, right].find((result) => result.sent.status === 201);
  const blockedOne = [left, right].find((result) => result.sent.status === 409);
  assert.ok(sentOne, JSON.stringify([left.sent, right.sent]));
  assert.ok(blockedOne, JSON.stringify([left.sent, right.sent]));
  assert.equal(sentOne.sent.json.data.submitStatus, "sent");
  assert.equal(sentOne.sent.json.data.trackingId, "track-w6");
  assert.equal(sentOne.preview.json.data.departmentId, "FD12345678");
  assert.match(sentOne.preview.json.data.banner, /SANDBOX/);
  assert.equal(vendor.calls.bill, 1);
  assert.equal(vendor.calls.departments[0], "FD12345678");
  const again = await submit("W6-SENT");
  assert.equal(again.sent.status, 409, JSON.stringify(again.sent.json));
  assert.match(again.sent.json.message, /Already sent/);
  assert.equal(vendor.calls.bill, 1);

  vendor.setMode("http400");
  await seed("W6-FAIL");
  const refused = await submit("W6-FAIL");
  assert.equal(refused.sent.status, 400, JSON.stringify(refused.sent.json));
  assert.equal(refused.sent.json.data.submitStatus, "failed");
  assert.equal(refused.sent.json.data.trackingId, "");
  const billsAfterFail = vendor.calls.bill;
  assert.equal(billsAfterFail, 2);

  vendor.setMode("http500");
  await seed("W6-REVIEW");
  const down = await submit("W6-REVIEW");
  assert.equal(down.sent.status, 409, JSON.stringify(down.sent.json));
  assert.equal(down.sent.json.data.submitStatus, "needs_review");
  const blocked = await submit("W6-REVIEW");
  assert.equal(blocked.sent.status, 409);
  assert.match(blocked.sent.json.message, /Already sent/);
  assert.equal(vendor.calls.bill, billsAfterFail + 1);

  vendor.setMode("timeout");
  await seed("W6-SLOW");
  const slow = await submit("W6-SLOW");
  assert.equal(slow.sent.status, 409, JSON.stringify(slow.sent.json));
  assert.equal(slow.sent.json.data.submitStatus, "needs_review");
  assert.match(slow.sent.json.message, /did not answer in time/);

  vendor.setMode("nostatus");
  await seed("W6-UNCLEAR");
  const unclear = await submit("W6-UNCLEAR");
  assert.equal(unclear.sent.status, 409, JSON.stringify(unclear.sent.json));
  assert.equal(unclear.sent.json.data.submitStatus, "needs_review");
  assert.match(unclear.sent.json.message, /Status 1/);

  vendor.setMode("success");
  const beforeGap = vendor.calls.bill;
  await seed("W6-GAP", { firstName: "" });
  const gapPreview = await call("/api/fire-recovery/preview", {
    method: "POST",
    cookie,
    origin: base,
    body: { callNumber: "W6-GAP" },
  });
  assert.equal(gapPreview.status, 200, JSON.stringify(gapPreview.json));
  const gap = await call("/api/fire-recovery/submit", {
    method: "POST",
    cookie,
    origin: base,
    body: { callNumber: "W6-GAP", previewHash: gapPreview.json.data.previewHash },
  });
  assert.equal(gap.status, 400, JSON.stringify(gap.json));
  assert.match(gap.json.message, /First Name/);
  assert.equal(vendor.calls.bill, beforeGap);

  const beforeOther = vendor.calls.bill;
  const stolen = await call("/api/fire-recovery/submit", {
    method: "POST",
    cookie: otherCookie,
    host: "other.test",
    origin: "http://other.test",
    body: { callNumber: "W6-SENT", previewHash: "not-this-departments-bill" },
  });
  assert.equal(stolen.status, 400, JSON.stringify(stolen.json));
  assert.match(stolen.json.message, /No successful NERIS export/);
  assert.equal(vendor.calls.bill, beforeOther);
  const demoRow = await prisma.fireRecoveryIncidentBilling.findUnique({
    where: { tenantId_callNumber: { tenantId: demo.id, callNumber: "W6-SENT" } },
  });
  assert.equal(demoRow.submitStatus, "sent");
  assert.equal(demoRow.trackingId, "track-w6");

  await seed("W6-MODE");
  delete process.env.FIRE_RECOVERY_MODE;
  const offPreview = await call("/api/fire-recovery/preview", {
    method: "POST",
    cookie,
    origin: base,
    body: { callNumber: "W6-MODE" },
  });
  assert.equal(offPreview.status, 200, JSON.stringify(offPreview.json));
  assert.match(offPreview.json.data.banner, /switched off/);
  const off = await call("/api/fire-recovery/submit", {
    method: "POST",
    cookie,
    origin: base,
    body: { callNumber: "W6-MODE", previewHash: offPreview.json.data.previewHash },
  });
  assert.equal(off.status, 400, JSON.stringify(off.json));
  assert.match(off.json.message, /switched off/);
  assert.equal(vendor.calls.bill, beforeOther);

  process.env.FIRE_RECOVERY_MODE = "live";
  await prisma.tenant.update({ where: { id: demo.id }, data: { nerisEntityId: "FD12345678" } });
  const liveSandbox = await submit("W6-MODE");
  assert.equal(liveSandbox.sent.status, 400, JSON.stringify(liveSandbox.sent.json));
  assert.match(liveSandbox.sent.json.message, /FD12345678/);
  assert.equal(vendor.calls.bill, beforeOther);

  await prisma.tenant.update({ where: { id: demo.id }, data: { nerisEntityId: "FD33333333" } });
  const live = await submit("W6-MODE");
  assert.equal(live.sent.status, 201, JSON.stringify(live.sent.json));
  assert.equal(vendor.calls.departments.at(-1), "FD33333333");
  assert.match(live.preview.json.data.banner, /LIVE/);
});
