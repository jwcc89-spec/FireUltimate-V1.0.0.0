import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { permissionForRequest } from "../auth/permissions.mjs";
import { register } from "./maintenance.mjs";
import { DEFAULT_MAINTENANCE_TYPES } from "./maintenanceDefaults.mjs";

/** In-memory stand-in for the Prisma calls the maintenance routes make. */
function createFakePrisma() {
  const tables = {
    maintenanceRecord: [],
    maintenanceType: [],
    vendor: [],
    maintenanceCost: [],
    pmSchedule: [],
    equipment: [],
    comment: [],
    checklistSubmission: [],
    part: [],
    partTransaction: [],
  };
  let nextId = 1;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, expected]) => {
      if (expected === null) return row[key] == null;
      if (expected && typeof expected === "object" && !(expected instanceof Date)) {
        if ("startsWith" in expected) return String(row[key] ?? "").startsWith(expected.startsWith);
        if (Array.isArray(expected.in)) return expected.in.includes(row[key]);
        if ("not" in expected) return row[key] !== expected.not;
      }
      return row[key] === expected;
    });
  const sortRows = (rows, orderBy) => {
    const first = Array.isArray(orderBy) ? orderBy[0] : orderBy;
    if (!first) return rows;
    const [key, direction] = Object.entries(first)[0];
    return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (direction === "desc" ? -1 : 1));
  };
  const withIncludes = (name, row, include) => {
    if (!row || !include || name !== "maintenanceRecord") return row;
    return {
      ...row,
      type: tables.maintenanceType.find((entry) => entry.id === row.typeId) ?? null,
      vendor: tables.vendor.find((entry) => entry.id === row.vendorId) ?? null,
      costs: tables.maintenanceCost.filter((cost) => cost.recordId === row.id && cost.deletedAt == null),
    };
  };
  const insert = (name, data) => {
    const now = new Date();
    const row = { id: `id${nextId++}`, deletedAt: null, createdAt: now, updatedAt: now, ...data };
    if (name === "maintenanceRecord" && row.recordNumber) {
      const duplicate = tables.maintenanceRecord.some(
        (entry) => entry.tenantId === row.tenantId && entry.recordNumber === row.recordNumber,
      );
      if (duplicate) throw Object.assign(new Error("unique"), { code: "P2002" });
    }
    tables[name].push(row);
    return row;
  };
  const model = (name) => ({
    findMany: async ({ where, orderBy, include } = {}) =>
      sortRows(tables[name].filter((row) => matches(row, where)), orderBy).map((row) => withIncludes(name, row, include)),
    findFirst: async ({ where, orderBy, include } = {}) =>
      withIncludes(name, sortRows(tables[name].filter((row) => matches(row, where)), orderBy)[0] ?? null, include),
    count: async ({ where } = {}) => tables[name].filter((row) => matches(row, where)).length,
    create: async ({ data, include }) => {
      const { costs, ...rest } = data;
      const row = insert(name, rest);
      for (const cost of costs?.create ?? []) insert("maintenanceCost", { ...cost, recordId: row.id });
      return withIncludes(name, row, include);
    },
    createMany: async ({ data }) => {
      for (const entry of data) insert(name, entry);
      return { count: data.length };
    },
    update: async ({ where, data }) => {
      const row = tables[name].find((entry) => entry.id === where.id);
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    updateMany: async ({ where, data }) => {
      const rows = tables[name].filter((row) => matches(row, where));
      for (const row of rows) Object.assign(row, data, { updatedAt: new Date() });
      return { count: rows.length };
    },
  });
  const prisma = {
    tables,
    rolePermission: { findUnique: async () => null },
    departmentDetails: {
      findUnique: async () => ({ payloadJson: { userFullNames: { alice: "Alice Adams" } } }),
    },
  };
  for (const name of Object.keys(tables)) prisma[name] = model(name);
  prisma.$transaction = async (work) => work(prisma);
  return prisma;
}

async function startServer() {
  const prisma = createFakePrisma();
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  app.use((request, _response, next) => {
    request.tenant = { id: request.get("x-tenant"), slug: request.get("x-tenant") };
    request.auth = { userId: request.get("x-user"), username: request.get("x-user"), role: request.get("x-role") };
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

test("maintenance routes keep each department's records separate", async () => {
  const { call, close } = await startServer();
  try {
    const created = await call("POST", "/api/maintenance/records", {
      body: { assetKind: "apparatus", description: "Knox box cable", assets: [{ ref: "E1", label: "Engine 1" }] },
    });
    assert.equal(created.status, 201);
    assert.match(created.json.data.recordNumber, /^\d{2}-0001$/);
    assert.equal(created.json.data.assetRef, "E1");
    const id = created.json.data.id;

    const second = await call("POST", "/api/maintenance/records", { body: { description: "Second" } });
    assert.match(second.json.data.recordNumber, /-0002$/);

    const otherList = await call("GET", "/api/maintenance/records?assetKind=apparatus", { tenant: "tenantB", role: "admin" });
    assert.deepEqual(otherList.json.data, []);
    assert.equal((await call("GET", `/api/maintenance/records/${id}`, { tenant: "tenantB", role: "admin" })).status, 404);
    assert.equal(
      (await call("PATCH", `/api/maintenance/records/${id}`, { tenant: "tenantB", role: "admin", body: { description: "x" } })).status,
      404,
    );
    assert.equal(
      (await call("POST", `/api/maintenance/records/${id}/comments`, { tenant: "tenantB", body: { body: "hi" } })).status,
      404,
    );
    assert.equal((await call("DELETE", `/api/maintenance/records/${id}`, { tenant: "tenantB", role: "admin" })).status, 404);

    const ownList = await call("GET", "/api/maintenance/records?assetKind=apparatus");
    assert.equal(ownList.json.data.length, 2);

    const comment = await call("POST", `/api/maintenance/records/${id}/comments`, { body: { body: "Ordered parts" } });
    assert.equal(comment.status, 201);
    assert.equal(comment.json.data.authorName, "Alice Adams");
  } finally {
    await close();
  }
});

test("only maintenance managers can close, reopen or change someone else's record", async () => {
  const { call, close } = await startServer();
  try {
    const created = await call("POST", "/api/maintenance/records", {
      body: {
        description: "Brake noise",
        status: "Parts Ordered",
        assignedTo: "Bob Brown",
        outOfService: true,
        outOfServiceAt: "2026-11-24T14:30:00.000Z",
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.data.status, "Parts Ordered");
    assert.equal(created.json.data.assignedTo, "Bob Brown");
    assert.equal(created.json.data.outOfServiceAt, "2026-11-24T14:30:00.000Z");
    assert.equal(created.json.data.completedAt, "");
    const id = created.json.data.id;

    const closedByUser = await call("PATCH", `/api/maintenance/records/${id}`, { body: { status: "Completed" } });
    assert.equal(closedByUser.status, 403);

    const otherUser = await call("PATCH", `/api/maintenance/records/${id}`, { user: "bob", body: { description: "x" } });
    assert.equal(otherUser.status, 403);

    const ownEdit = await call("PATCH", `/api/maintenance/records/${id}`, {
      body: { priority: "High", costs: [{ description: "Pads", amount: 120.5 }] },
    });
    assert.equal(ownEdit.status, 200);
    assert.equal(ownEdit.json.data.costTotal, 120.5);

    const missingDetails = await call("PATCH", `/api/maintenance/records/${id}`, {
      user: "chief",
      role: "admin",
      body: { status: "Completed" },
    });
    assert.equal(missingDetails.status, 400);

    const noReadings = await call("PATCH", `/api/maintenance/records/${id}`, {
      user: "chief",
      role: "admin",
      body: { status: "Completed", performedByName: "Alice Adams" },
    });
    assert.equal(noReadings.status, 400);
    assert.match(noReadings.json.message, /Mileage and Engine Hours/);

    const completed = await call("PATCH", `/api/maintenance/records/${id}`, {
      user: "chief",
      role: "admin",
      body: {
        status: "Completed",
        completedDate: "2026-11-25",
        performedByName: "Alice Adams",
        readings: { mileage: "45210", engineHours: 3365.5, pumpHours: "" },
        oilChange: { oilType: "15W-40", quarts: "24", filterPartNumber: "LF9009", extra: "dropped" },
      },
    });
    assert.equal(completed.status, 200);
    assert.deepEqual(completed.json.data.oilChange, { oilType: "15W-40", quarts: 24, filterPartNumber: "LF9009" });
    assert.deepEqual(completed.json.data.readings, { mileage: 45210, engineHours: 3365.5, pumpHours: null });
    assert.equal(completed.json.data.completedDate, "2026-11-25");
    assert.ok(completed.json.data.completedAt > "2026-11-24T14:30:00.000Z");
    assert.equal(completed.json.data.outOfServiceAt, "2026-11-24T14:30:00.000Z");

    const reopenByUser = await call("PATCH", `/api/maintenance/records/${id}`, { body: { status: "Open" } });
    assert.equal(reopenByUser.status, 403);

    const reopened = await call("PATCH", `/api/maintenance/records/${id}`, {
      user: "chief",
      role: "admin",
      body: { status: "Open" },
    });
    assert.equal(reopened.json.data.completedAt, "");
    assert.equal(reopened.json.data.completedDate, "");

    const stampedToday = await call("PATCH", `/api/maintenance/records/${id}`, {
      user: "chief",
      role: "admin",
      body: { status: "Completed" },
    });
    assert.equal(stampedToday.status, 200);
    assert.match(stampedToday.json.data.completedDate, /^\d{4}-\d{2}-\d{2}$/);

    const createClosed = await call("POST", "/api/maintenance/records", { body: { status: "Completed" } });
    assert.equal(createClosed.status, 403);
  } finally {
    await close();
  }
});

test("each department gets its own copy of the default types", async () => {
  const { call, close } = await startServer();
  try {
    const typesA = await call("GET", "/api/maintenance/types");
    assert.equal(typesA.json.data.length, DEFAULT_MAINTENANCE_TYPES.length);
    const typesB = await call("GET", "/api/maintenance/types", { tenant: "tenantB" });
    assert.equal(typesB.json.data.length, DEFAULT_MAINTENANCE_TYPES.length);

    const target = typesA.json.data[0];
    await call("PATCH", `/api/maintenance/types/${target.id}`, { role: "admin", body: { enabled: false } });
    const typesBAfter = await call("GET", "/api/maintenance/types", { tenant: "tenantB" });
    assert.ok(typesBAfter.json.data.every((type) => type.enabled));
    assert.equal(
      (await call("PATCH", `/api/maintenance/types/${target.id}`, { tenant: "tenantB", role: "admin", body: { enabled: false } })).status,
      404,
    );

    assert.equal((await call("DELETE", `/api/maintenance/types/${target.id}`, { role: "admin" })).status, 400);

    const typesAgain = await call("GET", "/api/maintenance/types");
    assert.equal(typesAgain.json.data.length, DEFAULT_MAINTENANCE_TYPES.length);
  } finally {
    await close();
  }
});

test("apparatus status comes from open out-of-service records, per department", async () => {
  const { call, close } = await startServer();
  try {
    const types = await call("GET", "/api/maintenance/types");
    const deficiency = types.json.data.find((type) => type.name === "Deficiency");
    assert.ok(deficiency);
    const record = await call("POST", "/api/maintenance/records", {
      body: {
        assets: [{ ref: "E1", label: "Engine 1" }],
        typeId: deficiency.id,
        description: "Coolant leak",
        outOfService: true,
        outOfServiceAt: "2026-11-20T08:00:00.000Z",
        readings: { mileage: 1000, engineHours: 200 },
      },
    });
    await call("POST", "/api/maintenance/records", {
      body: { assets: [{ ref: "L1", label: "Ladder 1" }], description: "Mirror", readings: { mileage: 50 } },
    });

    const status = await call("GET", "/api/maintenance/apparatus-status");
    const engine = status.json.data.find((unit) => unit.unitId === "E1");
    assert.equal(engine.status, "Out of Service");
    assert.equal(engine.outOfServiceRecordId, record.json.data.id);
    assert.equal(engine.openDeficiencies, 1);
    assert.equal(engine.readings.engineHours, 200);
    const ladder = status.json.data.find((unit) => unit.unitId === "L1");
    assert.equal(ladder.status, "In Service");
    assert.equal(ladder.readings.mileage, 50);
    assert.equal(ladder.readings.engineHours, null);

    assert.deepEqual((await call("GET", "/api/maintenance/apparatus-status", { tenant: "tenantB" })).json.data, []);

    await call("PATCH", `/api/maintenance/records/${record.json.data.id}`, {
      user: "chief",
      role: "admin",
      body: { status: "Completed", performedByName: "Alice Adams" },
    });
    const after = await call("GET", "/api/maintenance/apparatus-status");
    assert.equal(after.json.data.find((unit) => unit.unitId === "E1").status, "In Service");
  } finally {
    await close();
  }
});

test("PM tasks track by hours or date and reset when the ticket is completed", async () => {
  const { call, close } = await startServer();
  try {
    const noInterval = await call("POST", "/api/maintenance/schedules", {
      role: "admin",
      body: { name: "Oil change", assetRef: "E1", trackingBasis: "engineHours" },
    });
    assert.equal(noInterval.status, 400);

    const oil = await call("POST", "/api/maintenance/schedules", {
      role: "admin",
      body: {
        name: "Oil change",
        assetRef: "E1",
        trackingBasis: "engineHours",
        intervalValue: "250",
        lastServiceReading: "3100",
        earlyWarning: 25,
      },
    });
    assert.equal(oil.status, 201);
    assert.equal(oil.json.data.intervalValue, 250);
    assert.equal(oil.json.data.lastServiceReading, 3100);
    const ladder = await call("POST", "/api/maintenance/schedules", {
      role: "admin",
      body: { name: "Ladder test", assetRef: "E1", trackingBasis: "date", frequency: "Annual" },
    });
    const otherDept = await call("POST", "/api/maintenance/schedules", {
      tenant: "tenantB",
      role: "admin",
      body: { name: "Other", assetRef: "E1", trackingBasis: "mileage", intervalValue: 5000, lastServiceReading: 10 },
    });

    const record = await call("POST", "/api/maintenance/records", {
      body: {
        assets: [{ ref: "E1", label: "Engine 1" }],
        description: "Service",
        pmPerformed: [
          { scheduleId: oil.json.data.id, reading: "" },
          { scheduleId: ladder.json.data.id },
          { scheduleId: otherDept.json.data.id, reading: 99 },
        ],
      },
    });
    assert.equal(record.json.data.pmPerformed.length, 3);

    const completed = await call("PATCH", `/api/maintenance/records/${record.json.data.id}`, {
      user: "chief",
      role: "admin",
      body: {
        status: "Completed",
        completedDate: "2026-11-25",
        performedByName: "Alice Adams",
        readings: { mileage: 45210, engineHours: 3352 },
      },
    });
    assert.equal(completed.status, 200);

    const schedules = (await call("GET", "/api/maintenance/schedules")).json.data;
    const oilAfter = schedules.find((row) => row.id === oil.json.data.id);
    assert.equal(oilAfter.lastServiceReading, 3352);
    assert.equal(oilAfter.lastServiceDate, "2026-11-25");
    const ladderAfter = schedules.find((row) => row.id === ladder.json.data.id);
    assert.equal(ladderAfter.nextDueAt, "2027-11-25");
    const otherAfter = (await call("GET", "/api/maintenance/schedules", { tenant: "tenantB" })).json.data[0];
    assert.equal(otherAfter.lastServiceReading, 10);
  } finally {
    await close();
  }
});

test("vendors and equipment are scoped to the department", async () => {
  const { call, close } = await startServer();
  try {
    const vendor = await call("POST", "/api/maintenance/vendors", { role: "admin", body: { name: "Midwest Fire" } });
    assert.equal(vendor.status, 201);
    assert.deepEqual((await call("GET", "/api/maintenance/vendors", { tenant: "tenantB" })).json.data, []);
    assert.equal(
      (await call("PATCH", `/api/maintenance/vendors/${vendor.json.data.id}`, { tenant: "tenantB", body: { name: "x" } })).status,
      404,
    );
    const crossVendor = await call("POST", "/api/maintenance/records", {
      tenant: "tenantB",
      body: { vendorId: vendor.json.data.id },
    });
    assert.equal(crossVendor.status, 400);

    const item = await call("POST", "/api/equipment", { role: "admin", body: { name: "SCBA 12", status: "Bogus" } });
    assert.equal(item.json.data.status, "In Service");
    assert.deepEqual((await call("GET", "/api/equipment", { tenant: "tenantB" })).json.data, []);

    const types = await call("GET", "/api/maintenance/types");
    const deficiency = types.json.data.find((type) => type.name === "Deficiency");
    const ticket = await call("POST", "/api/maintenance/records", {
      body: {
        assetKind: "equipment",
        assets: [{ kind: "equipment", ref: item.json.data.id, label: "SCBA 12" }],
        typeId: deficiency.id,
        description: "Pack leak",
        outOfService: true,
      },
    });
    assert.equal(ticket.status, 201);
    const listed = await call("GET", "/api/equipment");
    assert.equal(listed.json.data.find((row) => row.id === item.json.data.id).status, "Out of Service");

    await call("PATCH", `/api/maintenance/records/${ticket.json.data.id}`, {
      role: "admin",
      body: { outOfService: false, status: "Completed", performedByKind: "personnel", performedByName: "Alice" },
    });
    const cleared = await call("GET", "/api/equipment");
    assert.equal(cleared.json.data.find((row) => row.id === item.json.data.id).status, "In Service");
  } finally {
    await close();
  }
});

test("maintenance routes map to the right permissions", () => {
  assert.equal(permissionForRequest("GET", "/api/maintenance/records"), null);
  assert.equal(permissionForRequest("POST", "/api/maintenance/records"), "maintenance.submit");
  assert.equal(permissionForRequest("PATCH", "/api/maintenance/records/abc"), "maintenance.submit");
  assert.equal(permissionForRequest("POST", "/api/maintenance/records/abc/comments"), "maintenance.submit");
  assert.equal(permissionForRequest("DELETE", "/api/maintenance/records/abc"), "maintenance.manage");
  assert.equal(permissionForRequest("GET", "/api/maintenance/types"), null);
  assert.equal(permissionForRequest("POST", "/api/maintenance/types"), "maintenance.manage");
  assert.equal(permissionForRequest("PATCH", "/api/maintenance/vendors/abc"), "maintenance.manage");
  assert.equal(permissionForRequest("DELETE", "/api/maintenance/schedules/abc"), "maintenance.manage");
  assert.equal(permissionForRequest("POST", "/api/equipment"), "maintenance.manage");
  assert.equal(permissionForRequest("GET", "/api/equipment"), null);
});
