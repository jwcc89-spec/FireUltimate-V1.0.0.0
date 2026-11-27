import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { permissionForRequest } from "../auth/permissions.mjs";
import { DEFAULT_INSPECTION_SECTIONS } from "./inspectionDefaults.mjs";
import { register as registerInspections } from "./inspections.mjs";
import { register as registerMaintenance } from "./maintenance.mjs";
import { register as registerParts } from "./parts.mjs";

/** In-memory stand-in for the Prisma calls the inspection and maintenance routes make. */
function createFakePrisma() {
  const tables = {
    maintenanceRecord: [],
    maintenanceType: [],
    vendor: [],
    maintenanceCost: [],
    pmSchedule: [],
    equipment: [],
    comment: [],
    checklistTemplate: [],
    checklistTemplateVersion: [],
    checklistSubmission: [],
    part: [],
    partTransaction: [],
  };
  let nextId = 1;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, expected]) => {
      if (expected === null) return row[key] == null;
      if (expected && typeof expected === "object" && "startsWith" in expected) {
        return String(row[key] ?? "").startsWith(expected.startsWith);
      }
      if (expected && typeof expected === "object" && "in" in expected) return expected.in.includes(row[key]);
      return row[key] === expected;
    });
  const sortRows = (rows, orderBy) => {
    const first = Array.isArray(orderBy) ? orderBy[0] : orderBy;
    if (!first) return rows;
    const [key, direction] = Object.entries(first)[0];
    const value = (row) => (row[key] instanceof Date ? row[key].toISOString() : String(row[key] ?? ""));
    return [...rows].sort((a, b) => value(a).localeCompare(value(b)) * (direction === "desc" ? -1 : 1));
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
    const now = new Date(Date.now() + nextId);
    const row = { id: `id${nextId++}`, deletedAt: null, createdAt: now, updatedAt: now, ...data };
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
    updateMany: async ({ where, data }) => {
      const rows = tables[name].filter((row) => matches(row, where));
      for (const row of rows) Object.assign(row, data, { updatedAt: new Date() });
      return { count: rows.length };
    },
  });
  const prisma = {
    tables,
    rolePermission: { findUnique: async () => null },
    departmentDetails: { findUnique: async () => ({ payloadJson: {} }) },
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
  registerMaintenance(app, prisma);
  registerParts(app, prisma);
  registerInspections(app, prisma);
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

test("inspections seed the default checklist and stay inside the department", async () => {
  const { prisma, call, close } = await startServer();
  try {
    const template = await call("GET", "/api/inspections/template");
    assert.equal(template.json.data.sections.length, 8);
    assert.equal(template.json.data.sections[5].defaultNa, true);
    await call("GET", "/api/inspections/template");
    assert.equal(prisma.tables.checklistTemplate.filter((row) => row.tenantId === "tenantA").length, 1);

    const types = await call("GET", "/api/maintenance/types");
    const deficiency = types.json.data.find((type) => type.name === "Deficiency");
    const record = await call("POST", "/api/maintenance/records", {
      body: { assets: [{ ref: "E1", label: "Engine 1" }], typeId: deficiency.id, description: "Left mirror cracked" },
    });
    const mirrorItem = DEFAULT_INSPECTION_SECTIONS[3].items[1].id;
    const otherDeptRecord = await call("POST", "/api/maintenance/records", { tenant: "tenantB", body: { description: "x" } });

    const missing = await call("POST", "/api/inspections", { body: { subjectRef: "E1", completedOn: "2026-11-25" } });
    assert.equal(missing.status, 400);
    const noReadings = await call("POST", "/api/inspections", {
      body: { subjectRef: "E1", completedOn: "2026-11-25", completedByName: "Alice Adams", details: { officer: "Lt. Brown" } },
    });
    assert.equal(noReadings.status, 400);
    assert.match(noReadings.json.message, /Station, Mileage, Engine Hours, Pump Hours/);

    const saved = await call("POST", "/api/inspections", {
      body: {
        subjectRef: "E1",
        completedOn: "2026-11-25",
        completedByName: "Alice Adams",
        results: {
          [mirrorItem]: { result: "X", recordId: record.json.data.id },
          "engine-1": { result: "OK" },
          "engine-2": { result: "X", recordId: otherDeptRecord.json.data.id },
          "made-up": { result: "OK" },
          "engine-3": { result: "maybe" },
        },
        details: { officer: "Lt. Brown", station: "Station 1", readings: { mileage: 45300, engineHours: 3370, pumpHours: 812 } },
      },
    });
    assert.equal(saved.status, 201);
    assert.match(saved.json.data.submissionNumber, /^INS-\d{2}-0001$/);
    assert.equal(saved.json.data.repairCount, 2);
    assert.deepEqual(Object.keys(saved.json.data.results).sort(), ["body-2", "engine-1", "engine-2"]);
    assert.equal(saved.json.data.results["engine-2"].recordId, "");

    const list = await call("GET", "/api/inspections");
    assert.equal(list.json.data.length, 1);
    assert.deepEqual((await call("GET", "/api/inspections", { tenant: "tenantB" })).json.data, []);
    assert.equal((await call("GET", `/api/inspections/${saved.json.data.id}`, { tenant: "tenantB" })).status, 404);
    assert.equal((await call("GET", `/api/inspections/${saved.json.data.id}`)).json.data.sections.length, 8);

    const open = await call("GET", "/api/inspections/open-deficiencies?unit=E1");
    assert.equal(open.json.data.byItem[mirrorItem].recordId, record.json.data.id);
    assert.equal(open.json.data.deficiencies.length, 1);

    const status = await call("GET", "/api/maintenance/apparatus-status");
    assert.equal(status.json.data.find((unit) => unit.unitId === "E1").readings.engineHours, 3370);

    await call("PATCH", `/api/maintenance/records/${record.json.data.id}`, {
      user: "chief",
      role: "admin",
      body: { status: "Completed", performedByName: "Alice Adams", readings: { mileage: 45300, engineHours: 3370 } },
    });
    const afterFix = await call("GET", "/api/inspections/open-deficiencies?unit=E1");
    assert.deepEqual(afterFix.json.data.byItem, {});
  } finally {
    await close();
  }
});

test("parts stock goes up when received and down when used on a record", async () => {
  const { call, close } = await startServer();
  try {
    const vendor = await call("POST", "/api/maintenance/vendors", { role: "admin", body: { name: "Midwest Fire" } });
    const part = await call("POST", "/api/maintenance/parts", {
      body: { partNumber: "LF-9009", description: "Oil filter", vendorId: vendor.json.data.id, unitCost: "18.5", reorderLevel: 2 },
    });
    assert.equal(part.status, 201);
    assert.equal(part.json.data.onHand, 0);
    const partId = part.json.data.id;

    const crossVendor = await call("POST", "/api/maintenance/parts", {
      tenant: "tenantB",
      body: { partNumber: "x", vendorId: vendor.json.data.id },
    });
    assert.equal(crossVendor.status, 400);

    const received = await call("POST", `/api/maintenance/parts/${partId}/stock`, {
      role: "admin",
      body: { kind: "received", quantity: 10, unitCost: 20 },
    });
    assert.equal(received.json.data.onHand, 10);
    assert.equal(received.json.data.unitCost, 20);
    assert.equal(
      (await call("POST", `/api/maintenance/parts/${partId}/stock`, { role: "admin", body: { kind: "received", quantity: -3 } })).status,
      400,
    );

    const record = await call("POST", "/api/maintenance/records", {
      body: { assets: [{ ref: "E1", label: "Engine 1" }], description: "Oil change", parts: [{ partId, quantity: 1 }] },
    });
    assert.equal(record.status, 201);
    assert.deepEqual(record.json.data.parts.map((entry) => [entry.partNumber, entry.quantity, entry.unitCost]), [["LF-9009", 1, 20]]);
    let parts = (await call("GET", "/api/maintenance/parts")).json.data;
    assert.equal(parts[0].onHand, 9);

    const edited = await call("PATCH", `/api/maintenance/records/${record.json.data.id}`, {
      body: { parts: [{ partId, quantity: 2 }] },
    });
    assert.equal(edited.json.data.parts[0].quantity, 2);
    parts = (await call("GET", "/api/maintenance/parts")).json.data;
    assert.equal(parts[0].onHand, 8);

    const otherDept = await call("POST", "/api/maintenance/records", {
      tenant: "tenantB",
      body: { description: "x", parts: [{ partId, quantity: 1 }] },
    });
    assert.equal(otherDept.status, 400);
    assert.deepEqual((await call("GET", "/api/maintenance/parts", { tenant: "tenantB" })).json.data, []);
    assert.equal(
      (await call("POST", `/api/maintenance/parts/${partId}/stock`, { tenant: "tenantB", role: "admin", body: { quantity: 5 } })).status,
      404,
    );
  } finally {
    await close();
  }
});

test("inspection and parts routes map to the right permissions", () => {
  assert.equal(permissionForRequest("POST", "/api/maintenance/parts"), "maintenance.submit");
  assert.equal(permissionForRequest("PATCH", "/api/maintenance/parts/abc"), "maintenance.manage");
  assert.equal(permissionForRequest("POST", "/api/maintenance/parts/abc/stock"), "maintenance.manage");
  assert.equal(permissionForRequest("GET", "/api/maintenance/parts/transactions"), null);
  assert.equal(permissionForRequest("GET", "/api/inspections"), null);
  assert.equal(permissionForRequest("POST", "/api/inspections"), "maintenance.submit");
  assert.equal(permissionForRequest("DELETE", "/api/inspections/abc"), "maintenance.manage");
});

test("equipment on the inspected unit joins Special Equipment and keeps its own repair records", async () => {
  const { prisma, call, close } = await startServer();
  try {
    const equipment = (id, tenantId, locationRef, status = "In Service") =>
      prisma.tables.equipment.push({ id, tenantId, name: `Saw ${id}`, serialNumber: "", locationRef, status, deletedAt: null });
    equipment("saw1", "tenantA", "E1");
    equipment("retired", "tenantA", "E1", "Retired");
    equipment("onT2", "tenantA", "T2");
    equipment("otherDept", "tenantB", "E1");

    const listed = await call("GET", "/api/inspections/unit-equipment?unit=E1");
    assert.deepEqual(listed.json.data, [{ id: "equipment-saw1", label: "Saw saw1", equipmentId: "saw1" }]);

    const types = await call("GET", "/api/maintenance/types");
    const deficiency = types.json.data.find((type) => type.name === "Deficiency");
    const repair = await call("POST", "/api/maintenance/records", {
      body: { assetKind: "equipment", assets: [{ kind: "equipment", ref: "saw1", label: "Saw saw1" }], typeId: deficiency.id, description: "Chain dull" },
    });
    assert.equal(repair.status, 201);

    const saved = await call("POST", "/api/inspections", {
      body: {
        subjectRef: "E1",
        completedOn: "2026-11-26",
        completedByName: "Alice Adams",
        details: { officer: "Lt. Brown", station: "Station 1", readings: { mileage: 1, engineHours: 1, pumpHours: 1 } },
        results: {
          "equipment-saw1": { result: "X", note: "", recordId: repair.json.data.id },
          "equipment-onT2": { result: "OK", note: "" },
        },
      },
    });
    assert.equal(saved.status, 201);
    assert.deepEqual(Object.keys(saved.json.data.results), ["equipment-saw1"]);

    const report = await call("GET", `/api/inspections/${saved.json.data.id}`);
    const special = report.json.data.sections.find((section) => section.id === "special");
    assert.equal(special.items.at(-1).id, "equipment-saw1");
    assert.equal(special.items.at(-1).equipmentId, "saw1");

    const open = await call("GET", "/api/inspections/open-deficiencies?unit=E1");
    assert.equal(open.json.data.byItem["equipment-saw1"].recordId, repair.json.data.id);
    assert.equal(open.json.data.byItem["equipment-saw1"].assetKind, "equipment");
    assert.deepEqual((await call("GET", "/api/inspections/unit-equipment?unit=E1", { tenant: "tenantB" })).json.data.map((item) => item.equipmentId), [
      "otherDept",
    ]);
  } finally {
    await close();
  }
});
