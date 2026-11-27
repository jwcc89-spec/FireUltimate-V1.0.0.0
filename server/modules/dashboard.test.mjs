import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { permissionForRequest } from "../auth/permissions.mjs";
import { BUILT_IN_LAYOUT, readLayout, register } from "./dashboard.mjs";

const PAYLOAD = {
  masterApparatusRecords: [{ unitId: "E1" }, { unitId: "T2" }],
  schedulerApparatusRecords: [
    { apparatus: "E1", station: "Station 1", minimumPersonnel: 2, maximumPersonnel: 3 },
    { apparatus: "T2", station: "Station 2", minimumPersonnel: 2, maximumPersonnel: 3 },
  ],
  shiftInformationEntries: [{ shiftType: "A Shift", startTime: "07:00", shiftDuration: 24 }],
};

/** In-memory stand-in for the Prisma calls the dashboard routes make. */
function createFakePrisma() {
  const tables = { dashboardLayout: [], maintenanceRecord: [], checklistSubmission: [], scheduleAssignments: [] };
  let nextId = 1;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, expected]) => {
      if (expected === null) return row[key] == null;
      if (expected && typeof expected === "object" && Array.isArray(expected.in)) return expected.in.includes(row[key]);
      return row[key] === expected;
    });
  const pick = (row, select) => (select ? Object.fromEntries(Object.keys(select).map((key) => [key, row[key]])) : row);
  const model = (name) => ({
    findMany: async ({ where, select } = {}) => tables[name].filter((row) => matches(row, where)).map((row) => pick(row, select)),
    upsert: async ({ where, create, update }) => {
      const key = Object.values(where)[0];
      const row = tables[name].find((entry) => entry.tenantId === key.tenantId && entry.userId === key.userId);
      if (row) return Object.assign(row, update, { updatedAt: new Date() });
      const created = { id: `id${nextId++}`, deletedAt: null, createdAt: new Date(), updatedAt: new Date(), ...create };
      tables[name].push(created);
      return created;
    },
    updateMany: async ({ where, data }) => {
      const rows = tables[name].filter((row) => matches(row, where));
      for (const row of rows) Object.assign(row, data);
      return { count: rows.length };
    },
  });
  const prisma = {
    tables,
    departmentDetails: {
      findUnique: async ({ where }) => (where.tenantId === "tenantA" ? { payloadJson: PAYLOAD } : null),
    },
    rolePermission: { findUnique: async () => null },
  };
  for (const name of Object.keys(tables)) prisma[name] = model(name);
  return prisma;
}

async function startServer() {
  const prisma = createFakePrisma();
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    const user = request.get("x-user") || "alice";
    request.tenant = { id: request.get("x-tenant"), slug: request.get("x-tenant") };
    request.auth = { userId: user, username: user, role: request.get("x-role") || "user" };
    next();
  });
  register(app, prisma);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { tenant = "tenantA", user = "alice", role = "user", body } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-tenant": tenant, "x-user": user, "x-role": role },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  };
  return { prisma, call, close: () => new Promise((resolve) => server.close(resolve)) };
}

const MINE = { items: [{ i: "clock", x: 0, y: 0, w: 4, h: 2 }, { i: "trades", x: 4, y: 0, w: 4, h: 4 }] };
const DEPARTMENT = { items: [{ i: "calendar", x: 0, y: 0, w: 6, h: 6 }] };

test("dashboard permissions: own layout is open to members, the department default needs displays.manage", () => {
  assert.equal(permissionForRequest("GET", "/api/dashboard/layout"), null);
  assert.equal(permissionForRequest("PUT", "/api/dashboard/layout"), null);
  assert.equal(permissionForRequest("DELETE", "/api/dashboard/layout"), null);
  assert.equal(permissionForRequest("GET", "/api/dashboard/summary"), null);
  assert.equal(permissionForRequest("PUT", "/api/dashboard/layout/default"), "displays.manage");
  assert.equal(permissionForRequest("DELETE", "/api/dashboard/layout/default"), "displays.manage");
});

test("layouts fall back from mine to the department default to the built-in layout", async () => {
  const { call, close } = await startServer();
  try {
    const first = await call("GET", "/api/dashboard/layout");
    assert.equal(first.json.data.source, "builtIn");
    assert.deepEqual(first.json.data.items, BUILT_IN_LAYOUT);
    assert.equal(first.json.data.canSetDefault, false);
    assert.equal((await call("GET", "/api/dashboard/layout", { role: "admin" })).json.data.canSetDefault, true);

    assert.equal((await call("PUT", "/api/dashboard/layout/default", { role: "admin", body: DEPARTMENT })).status, 200);
    const withDefault = await call("GET", "/api/dashboard/layout");
    assert.equal(withDefault.json.data.source, "department");
    assert.equal(withDefault.json.data.items[0].i, "calendar");

    const saved = await call("PUT", "/api/dashboard/layout", { body: MINE });
    assert.equal(saved.status, 200);
    assert.equal(saved.json.data.source, "user");
    assert.deepEqual(saved.json.data.items.map((item) => item.i), ["clock", "trades"]);

    // Bob still sees the department default; Alice's save only wrote her own row.
    assert.equal((await call("GET", "/api/dashboard/layout", { user: "bob" })).json.data.source, "department");

    const reset = await call("DELETE", "/api/dashboard/layout");
    assert.equal(reset.json.data.source, "department");
    const resaved = await call("PUT", "/api/dashboard/layout", { body: MINE });
    assert.equal(resaved.json.data.source, "user");

    await call("DELETE", "/api/dashboard/layout/default", { role: "admin" });
    assert.equal((await call("GET", "/api/dashboard/layout", { user: "bob" })).json.data.source, "builtIn");
  } finally {
    await close();
  }
});

test("another department never sees this department's layouts", async () => {
  const { prisma, call, close } = await startServer();
  try {
    await call("PUT", "/api/dashboard/layout/default", { role: "admin", body: DEPARTMENT });
    await call("PUT", "/api/dashboard/layout", { body: MINE });
    const other = await call("GET", "/api/dashboard/layout", { tenant: "tenantB" });
    assert.equal(other.json.data.source, "builtIn");
    await call("DELETE", "/api/dashboard/layout", { tenant: "tenantB" });
    assert.equal(prisma.tables.dashboardLayout.filter((row) => row.deletedAt === null).length, 2);
    assert.ok(prisma.tables.dashboardLayout.every((row) => row.tenantId === "tenantA"));
  } finally {
    await close();
  }
});

test("bad layouts are refused", async () => {
  assert.throws(() => readLayout({ items: [{ i: "nope", x: 0, y: 0, w: 2, h: 2 }] }), /unknown widget/);
  assert.throws(() => readLayout({ items: [{ i: "clock", x: 0, y: 0, w: 2, h: 2 }, { i: "clock", x: 2, y: 0, w: 2, h: 2 }] }), /once/);
  assert.throws(() => readLayout({ items: [{ i: "clock", x: 11, y: 0, w: 2, h: 2 }] }), /12 dashboard columns/);
  assert.throws(() => readLayout({ items: [{ i: "clock", x: 0, y: 0, w: 1, h: 2 }] }), /at least 2 by 2/);
  assert.throws(() => readLayout("not a layout"), /not valid/);
  assert.deepEqual(readLayout({ items: [] }), []);

  const { call, close } = await startServer();
  try {
    const refused = await call("PUT", "/api/dashboard/layout", { body: { items: [{ i: "clock", x: 0, y: 0, w: 20, h: 2 }] } });
    assert.equal(refused.status, 400);
  } finally {
    await close();
  }
});

test("the summary lists every unit, open maintenance and overdue counts for this department only", async () => {
  const { prisma, call, close } = await startServer();
  try {
    const base = { deletedAt: null, createdAt: new Date(), updatedAt: new Date(), type: { name: "Repair" } };
    prisma.tables.maintenanceRecord.push(
      {
        ...base,
        id: "mr1",
        tenantId: "tenantA",
        assetKind: "apparatus",
        assetRef: "T2",
        recordNumber: "26-0001",
        description: "Pump seal leak",
        status: "Open",
        priority: "High",
        dueDate: new Date("2020-01-01T00:00:00.000Z"),
        outOfService: true,
        detailsJson: { assets: [{ kind: "apparatus", ref: "T2" }] },
      },
      {
        ...base,
        id: "mr2",
        tenantId: "tenantB",
        assetKind: "apparatus",
        assetRef: "E9",
        recordNumber: "26-0001",
        description: "Other department",
        status: "Open",
        priority: "Low",
        dueDate: null,
        outOfService: false,
        detailsJson: {},
      },
    );
    const summary = await call("GET", "/api/dashboard/summary?date=2026-11-26&minute=600");
    assert.equal(summary.status, 200);
    const data = summary.json.data;
    assert.deepEqual(data.apparatus.map((unit) => unit.unitId), ["E1", "T2"]);
    assert.equal(data.apparatus.find((unit) => unit.unitId === "T2").status, "Out of Service");
    assert.equal(data.maintenance.open, 1);
    assert.equal(data.maintenance.overdue, 1);
    assert.equal(data.maintenance.outOfService, 1);
    assert.equal(data.maintenance.recent[0].recordNumber, "26-0001");
    assert.equal(data.maintenance.recent[0].description, "Pump seal leak");
  } finally {
    await close();
  }
});
