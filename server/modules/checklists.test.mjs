import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { permissionForRequest } from "../auth/permissions.mjs";
import { assignmentStatus, register } from "./checklists.mjs";

/** In-memory stand-in for the Prisma calls the checklist routes make. */
function createFakePrisma() {
  const tables = { checklistTemplate: [], checklistTemplateVersion: [], checklistAssignment: [], checklistSubmission: [], kit: [] };
  let nextId = 1;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, expected]) => {
      if (expected === null) return row[key] == null;
      if (expected && typeof expected === "object" && !(expected instanceof Date)) {
        if ("startsWith" in expected) return String(row[key] ?? "").startsWith(expected.startsWith);
        if (Array.isArray(expected.in)) return expected.in.includes(row[key]);
      }
      return row[key] === expected;
    });
  const sortRows = (rows, orderBy) => {
    const first = Array.isArray(orderBy) ? orderBy[0] : orderBy;
    if (!first) return rows;
    const [key, direction] = Object.entries(first)[0];
    const value = (row) => (row[key] instanceof Date ? row[key].toISOString() : typeof row[key] === "number" ? String(row[key]).padStart(8, "0") : String(row[key] ?? ""));
    return [...rows].sort((a, b) => value(a).localeCompare(value(b)) * (direction === "desc" ? -1 : 1));
  };
  const model = (name) => ({
    findMany: async ({ where, orderBy, take } = {}) => {
      const rows = sortRows(tables[name].filter((row) => matches(row, where)), orderBy);
      return take ? rows.slice(0, take) : rows;
    },
    findFirst: async ({ where, orderBy } = {}) => sortRows(tables[name].filter((row) => matches(row, where)), orderBy)[0] ?? null,
    create: async ({ data }) => {
      if (name === "checklistTemplate" && tables[name].some((row) => row.tenantId === data.tenantId && row.name === data.name)) {
        throw Object.assign(new Error("unique"), { code: "P2002" });
      }
      const now = new Date(Date.now() + nextId);
      const row = { id: `id${nextId++}`, deletedAt: null, createdAt: now, updatedAt: now, enabled: true, active: true, lastCompletedOn: null, ...data };
      tables[name].push(row);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const rows = tables[name].filter((row) => matches(row, where));
      for (const row of rows) Object.assign(row, data, { updatedAt: new Date() });
      return { count: rows.length };
    },
  });
  const prisma = { tables };
  for (const name of Object.keys(tables)) prisma[name] = model(name);
  prisma.$transaction = async (work) => work(prisma);
  return prisma;
}

async function startServer() {
  const prisma = createFakePrisma();
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.tenant = { id: request.get("x-tenant"), slug: request.get("x-tenant") };
    request.auth = { userId: "alice", username: "alice", role: "admin" };
    next();
  });
  register(app, prisma);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { tenant = "tenantA", body } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-tenant": tenant },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  };
  return { prisma, call, close: () => new Promise((resolve) => server.close(resolve)) };
}

const SECTIONS = [
  {
    id: "s1",
    title: "Airway",
    items: [
      { id: "i1", label: "BVM present", type: "check" },
      { id: "i2", label: "OPA set", type: "quantity", par: 4 },
      { id: "i3", label: "O2 bottle PSI", type: "number", min: 1000, max: 2200 },
      { id: "i4", label: "Epi expiration", type: "expiration" },
      { id: "i5", label: "Seal color", type: "select", options: ["Red", "Yellow"] },
      { id: "i6", label: "Notes", type: "text", required: false },
    ],
  },
];

test("checklist permissions: users complete checks, admins build and review", () => {
  assert.equal(permissionForRequest("GET", "/api/checklists/templates"), null);
  assert.equal(permissionForRequest("GET", "/api/checklists/submissions/abc"), null);
  assert.equal(permissionForRequest("POST", "/api/checklists/submissions"), "inventory.complete");
  assert.equal(permissionForRequest("PATCH", "/api/checklists/submissions/abc/review"), "inventory.manage");
  assert.equal(permissionForRequest("DELETE", "/api/checklists/submissions/abc"), "inventory.manage");
  assert.equal(permissionForRequest("POST", "/api/checklists/templates"), "inventory.manage");
  assert.equal(permissionForRequest("PATCH", "/api/checklists/assignments/abc"), "inventory.manage");
  assert.equal(permissionForRequest("DELETE", "/api/checklists/kits/abc"), "inventory.manage");
});

test("assignment status follows the frequency and the last completed date", () => {
  const row = (frequency, startsOn, lastCompletedOn = null) => ({
    frequency,
    active: true,
    startsOn: new Date(`${startsOn}T00:00:00.000Z`),
    lastCompletedOn: lastCompletedOn ? new Date(`${lastCompletedOn}T00:00:00.000Z`) : null,
  });
  assert.deepEqual(assignmentStatus(row("daily", "2026-11-26"), "2026-11-26"), { status: "Due", dueOn: "2026-11-26" });
  assert.equal(assignmentStatus(row("daily", "2026-11-20", "2026-11-24"), "2026-11-26").status, "Overdue");
  assert.equal(assignmentStatus(row("daily", "2026-11-20", "2026-11-25"), "2026-11-26").status, "Due");
  assert.equal(assignmentStatus(row("daily", "2026-11-20", "2026-11-26"), "2026-11-26").status, "Complete");
  // 2026-11-26 is a Thursday, so the week began Monday 2026-11-23.
  assert.deepEqual(assignmentStatus(row("weekly", "2026-11-01", "2026-11-23"), "2026-11-26"), { status: "Complete", dueOn: "2026-11-23" });
  assert.equal(assignmentStatus(row("weekly", "2026-11-01", "2026-11-10"), "2026-11-26").status, "Overdue");
  assert.equal(assignmentStatus(row("monthly", "2026-11-01", "2026-10-31"), "2026-11-26").status, "Due");
  assert.equal(assignmentStatus(row("once", "2026-11-25"), "2026-11-26").status, "Overdue");
  assert.equal(assignmentStatus(row("once", "2026-12-01"), "2026-11-26").status, "Scheduled");
  assert.equal(assignmentStatus({ ...row("daily", "2026-11-01"), active: false }, "2026-11-26").status, "Paused");
});

test("a completed check flags failed, short, out-of-range and expired items and stays in its department", async () => {
  const { prisma, call, close } = await startServer();
  try {
    assert.equal((await call("POST", "/api/checklists/templates", { body: { name: "Jump Bag", sections: [] } })).status, 400);
    const bad = await call("POST", "/api/checklists/templates", {
      body: { name: "Jump Bag", sections: [{ id: "s1", title: "A", items: [{ id: "i1", label: "OPA", type: "quantity" }] }] },
    });
    assert.match(bad.json.message, /par/);

    const template = (await call("POST", "/api/checklists/templates", { body: { name: "Jump Bag", sections: SECTIONS } })).json.data;
    assert.equal(template.version, 1);
    assert.equal((await call("POST", "/api/checklists/templates", { body: { name: "Jump Bag", sections: SECTIONS } })).status, 400);

    const kit = (await call("POST", "/api/checklists/kits", { body: { name: "Medic 1 Jump Bag", kitType: "EMS", locationRef: "M1" } })).json.data;
    const otherKit = (await call("POST", "/api/checklists/kits", { tenant: "tenantB", body: { name: "Theirs" } })).json.data;
    const crossTenant = await call("POST", "/api/checklists/assignments", {
      body: { templateId: template.id, targetKind: "kit", targetRef: otherKit.id, startsOn: "2026-11-26" },
    });
    assert.equal(crossTenant.status, 400);

    const assignment = (
      await call("POST", "/api/checklists/assignments?date=2026-11-26", {
        body: { templateId: template.id, targetKind: "kit", targetRef: kit.id, frequency: "daily", startsOn: "2026-11-26", assignedTo: "Alice Adams" },
      })
    ).json.data;
    assert.equal(assignment.status, "Due");
    assert.equal(assignment.targetLabel, "Medic 1 Jump Bag");

    const answers = {
      i1: { value: "Fail", note: "Mask torn" },
      i2: { value: "3" },
      i3: { value: "800" },
      i4: { value: "2026-11-01" },
      i5: { value: "Red" },
    };
    const noPin = await call("POST", "/api/checklists/submissions", {
      body: { assignmentId: assignment.id, signatureName: "Alice Adams", completedOn: "2026-11-26", results: answers },
    });
    assert.equal(noPin.status, 400);
    const missing = await call("POST", "/api/checklists/submissions", {
      body: { assignmentId: assignment.id, signatureName: "Alice Adams", pin: "1234", completedOn: "2026-11-26", results: { i1: { value: "OK" } } },
    });
    assert.match(missing.json.message, /OPA set, O2 bottle PSI, Epi expiration, Seal color/);

    const saved = await call("POST", "/api/checklists/submissions", {
      body: { assignmentId: assignment.id, signatureName: "Alice Adams", pin: "1234", completedOn: "2026-11-26", results: answers },
    });
    assert.equal(saved.status, 201);
    assert.equal(saved.json.data.status, "Flagged");
    assert.deepEqual(saved.json.data.flags.map((flag) => flag.reason), ["Failed", "Short", "Out of range", "Expired"]);
    assert.equal(saved.json.data.targetLabel, "Medic 1 Jump Bag");
    assert.match(saved.json.data.submissionNumber, /^CHK-\d{2}-0001$/);
    assert.equal(JSON.stringify(prisma.tables.checklistSubmission[0]).includes("1234"), false);

    const after = (await call("GET", "/api/checklists/assignments?date=2026-11-26")).json.data[0];
    assert.equal(after.status, "Complete");
    assert.equal((await call("GET", "/api/checklists/submissions?status=Flagged")).json.data.length, 1);

    const edited = await call("PATCH", `/api/checklists/templates/${template.id}`, {
      body: { name: "Jump Bag", sections: [{ ...SECTIONS[0], items: [...SECTIONS[0].items, { id: "i7", label: "Gloves", type: "yesno" }] }] },
    });
    assert.equal(edited.json.data.version, 2);
    const report = await call("GET", `/api/checklists/submissions/${saved.json.data.id}`);
    assert.equal(report.json.data.sections[0].items.length, 6);

    assert.equal((await call("PATCH", `/api/checklists/submissions/${saved.json.data.id}/review`)).status, 200);
    assert.equal((await call("GET", "/api/checklists/submissions?status=Flagged")).json.data.length, 0);

    assert.equal((await call("GET", `/api/checklists/submissions/${saved.json.data.id}`, { tenant: "tenantB" })).status, 404);
    assert.deepEqual((await call("GET", "/api/checklists/templates", { tenant: "tenantB" })).json.data, []);
    assert.deepEqual((await call("GET", "/api/checklists/assignments", { tenant: "tenantB" })).json.data, []);
    assert.equal((await call("DELETE", `/api/checklists/kits/${kit.id}`, { tenant: "tenantB" })).status, 404);
    assert.equal(
      (await call("POST", "/api/checklists/submissions", { tenant: "tenantB", body: { templateId: template.id, signatureName: "x", pin: "1" } })).status,
      400,
    );

    assert.equal((await call("DELETE", `/api/checklists/templates/${template.id}`)).status, 200);
    assert.deepEqual((await call("GET", "/api/checklists/assignments")).json.data, []);
    assert.equal((await call("POST", "/api/checklists/templates", { body: { name: "Jump Bag", sections: SECTIONS } })).status, 201);
  } finally {
    await close();
  }
});
