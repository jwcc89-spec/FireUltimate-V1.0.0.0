import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { permissionForRequest } from "../auth/permissions.mjs";
import { register } from "./displays.mjs";
import { normalizeGeometry } from "./mapsGeometry.mjs";

const SQUARE = {
  type: "Polygon",
  coordinates: [
    [
      [-87.87, 41.11],
      [-87.85, 41.11],
      [-87.85, 41.13],
      [-87.87, 41.13],
    ],
  ],
};

const PAYLOAD = {
  masterApparatusRecords: [{ unitId: "E1" }, { unitId: "T2" }],
  schedulerApparatusRecords: [
    { apparatus: "E1", station: "Station 1", minimumPersonnel: 2, maximumPersonnel: 3 },
    { apparatus: "T2", station: "Station 2", minimumPersonnel: 2, maximumPersonnel: 3 },
  ],
  shiftInformationEntries: [{ shiftType: "A Shift", startTime: "07:00", shiftDuration: 24 }],
  stationRecords: [{ name: "Station 1", city: "Kankakee", state: "IL" }],
};

function compare(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "boolean" || typeof b === "boolean") return Number(a) - Number(b);
  return String(a ?? "").localeCompare(String(b ?? ""));
}

/** In-memory stand-in for the Prisma calls the display routes make. */
function createFakePrisma() {
  const tables = {
    displayBoard: [],
    announcement: [],
    displayEvent: [],
    geofence: [],
    incident: [],
    maintenanceRecord: [],
    checklistSubmission: [],
    scheduleAssignments: [],
  };
  let nextId = 1;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, expected]) => {
      if (expected === null) return row[key] == null;
      if (expected && typeof expected === "object" && !(expected instanceof Date)) {
        if (Array.isArray(expected.in)) return expected.in.includes(row[key]);
        if (expected.gte instanceof Date) return row[key] instanceof Date && row[key] >= expected.gte;
        if (expected.lt instanceof Date) return row[key] instanceof Date && row[key] < expected.lt;
      }
      return row[key] === expected;
    });
  const pick = (row, select) => (select ? Object.fromEntries(Object.keys(select).map((key) => [key, row[key]])) : row);
  const model = (name) => ({
    findMany: async ({ where, orderBy, select, take } = {}) => {
      let rows = tables[name].filter((row) => matches(row, where));
      if (orderBy) {
        const [key, direction] = Object.entries(orderBy)[0];
        rows = [...rows].sort((a, b) => compare(a[key], b[key]) * (direction === "desc" ? -1 : 1));
      }
      if (take) rows = rows.slice(0, take);
      return rows.map((row) => pick(row, select));
    },
    findFirst: async ({ where } = {}) => tables[name].find((row) => matches(row, where)) ?? null,
    create: async ({ data }) => {
      const now = new Date();
      const row = { id: `id${nextId++}`, deletedAt: null, createdAt: now, updatedAt: now, ...data };
      tables[name].push(row);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const rows = tables[name].filter((row) => matches(row, where));
      for (const row of rows) Object.assign(row, { updatedAt: new Date() }, data);
      return { count: rows.length };
    },
  });
  const prisma = {
    tables,
    departmentDetails: {
      findUnique: async ({ where }) =>
        where.tenantId === "tenantA" ? { departmentName: "Kankakee Fire", payloadJson: PAYLOAD } : null,
    },
  };
  for (const name of Object.keys(tables)) prisma[name] = model(name);
  return prisma;
}

async function startServer(geocode) {
  const prisma = createFakePrisma();
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.tenant = { id: request.get("x-tenant"), slug: request.get("x-tenant"), name: request.get("x-tenant") };
    request.auth = { userId: "alice", username: "alice", role: "admin" };
    next();
  });
  register(app, prisma, { geocode });
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

test("display permissions: boards are managed by admins, the feed needs incident access", () => {
  assert.equal(permissionForRequest("GET", "/api/displays/boards"), null);
  assert.equal(permissionForRequest("GET", "/api/displays/boards/abc"), null);
  assert.equal(permissionForRequest("GET", "/api/displays/boards/abc/feed"), "incidents.view");
  assert.equal(permissionForRequest("POST", "/api/displays/boards"), "displays.manage");
  assert.equal(permissionForRequest("PATCH", "/api/displays/boards/abc"), "displays.manage");
  assert.equal(permissionForRequest("DELETE", "/api/displays/announcements/abc"), "displays.manage");
  assert.equal(permissionForRequest("POST", "/api/displays/events"), "displays.manage");
  assert.equal(permissionForRequest("POST", "/api/maps/incident-location"), "incidents.view");
});

test("a board shows its station's units, the crew on duty now, and current messages", async () => {
  const { prisma, call, close } = await startServer(async () => {
    throw new Error("no lookups on an all-calls board");
  });
  try {
    prisma.tables.maintenanceRecord.push({
      id: "mr1",
      tenantId: "tenantA",
      assetKind: "apparatus",
      status: "Open",
      outOfService: true,
      recordNumber: "26-0001",
      description: "Pump seal leak",
      detailsJson: { assets: [{ kind: "apparatus", ref: "T2" }], outOfServiceAt: "2026-11-25T12:00:00.000Z" },
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      type: { name: "Repair" },
    });
    prisma.tables.scheduleAssignments.push({
      tenantId: "tenantA",
      shiftType: "A Shift",
      dateKey: "2026-11-25",
      assignmentsJson: { assignments: { E1: ["Alice Adams", "Bob Brown"], T2: ["Cara Cole"] } },
    });

    const created = await call("POST", "/api/displays/boards", { body: { name: "Station 1 TV", stationName: "Station 1" } });
    assert.equal(created.status, 201);
    assert.equal(created.json.data.takeoverSeconds, 60);
    assert.equal(created.json.data.soundOn, true);
    const boardId = created.json.data.id;
    const allBoard = (await call("POST", "/api/displays/boards", { body: { name: "Hall" } })).json.data;

    await call("POST", "/api/displays/announcements", { body: { title: "Hydrant flushing", important: true } });
    await call("POST", "/api/displays/announcements", {
      body: { title: "Old drill", startsAt: "2020-01-01T10:00:00.000Z", endsAt: "2020-01-02T10:00:00.000Z" },
    });
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await call("POST", "/api/displays/events", { body: { title: "Training", startsAt: soon, location: "Station 1" } });

    const overnight = await call("GET", `/api/displays/boards/${boardId}/feed?date=2026-11-26&minute=180`);
    assert.equal(overnight.status, 200);
    assert.deepEqual(overnight.json.data.apparatus.map((unit) => unit.unitId), ["E1"]);
    assert.deepEqual(overnight.json.data.onDuty.units, [{ unit: "E1", station: "Station 1", people: ["Alice Adams", "Bob Brown"] }]);
    assert.deepEqual(overnight.json.data.onDuty.shifts, ["A Shift"]);
    assert.deepEqual(overnight.json.data.announcements.map((item) => item.title), ["Hydrant flushing"]);
    assert.equal(overnight.json.data.events[0].location, "Station 1");

    const offShift = await call("GET", `/api/displays/boards/${boardId}/feed?date=2026-11-27&minute=600`);
    assert.deepEqual(offShift.json.data.onDuty.units, []);

    const hall = await call("GET", `/api/displays/boards/${allBoard.id}/feed?date=2026-11-25&minute=600`);
    const truck = hall.json.data.apparatus.find((unit) => unit.unitId === "T2");
    assert.equal(truck.status, "Out of Service");
    assert.equal(truck.outOfServiceReason, "Pump seal leak");
    assert.equal(hall.json.data.onDuty.units.length, 2);

    const detail = await call("GET", `/api/displays/boards/${boardId}`);
    assert.equal(detail.json.data.department.name, "Kankakee Fire");

    assert.equal((await call("GET", `/api/displays/boards/${boardId}/feed`, { tenant: "tenantB" })).status, 404);
    assert.equal((await call("GET", `/api/displays/boards/${boardId}`, { tenant: "tenantB" })).status, 404);
    assert.deepEqual((await call("GET", "/api/displays/boards", { tenant: "tenantB" })).json.data, []);
    assert.deepEqual((await call("GET", "/api/displays/announcements", { tenant: "tenantB" })).json.data, []);
    assert.equal((await call("PATCH", `/api/displays/boards/${boardId}`, { tenant: "tenantB", body: { name: "Nope" } })).status, 404);
    assert.equal((await call("DELETE", `/api/displays/boards/${boardId}`, { tenant: "tenantB" })).status, 404);

    const badSeconds = await call("PATCH", `/api/displays/boards/${boardId}`, { body: { name: "Station 1 TV", takeoverSeconds: 2 } });
    assert.equal(badSeconds.status, 400);
    const noDistrict = await call("PATCH", `/api/displays/boards/${boardId}`, { body: { name: "Station 1 TV", callFilter: "districts" } });
    assert.equal(noDistrict.status, 400);
  } finally {
    await close();
  }
});

test("a district board keeps calls inside its districts and never hides a call it could not place", async () => {
  const lookups = [];
  const { prisma, call, close } = await startServer(async (address) => {
    lookups.push(address);
    if (address.startsWith("100 Inside")) return { latitude: 41.12, longitude: -87.86 };
    if (address.startsWith("200 Outside")) return { latitude: 42, longitude: -88 };
    throw new Error("No map point");
  });
  try {
    prisma.tables.geofence.push(
      { id: "g1", tenantId: "tenantA", name: "North", kind: "district", geometryJson: normalizeGeometry(SQUARE), deletedAt: null },
      { id: "gB", tenantId: "tenantB", name: "Other", kind: "district", geometryJson: normalizeGeometry(SQUARE), deletedAt: null },
    );
    const edited = new Date("2026-11-25T10:00:00.000Z");
    const addIncident = (id, address, minutesAgo) =>
      prisma.tables.incident.push({
        id,
        tenantId: "tenantA",
        address,
        incidentType: "Structure Fire",
        stillDistrict: "",
        deletedAt: null,
        latitude: null,
        longitude: null,
        geocodedAt: null,
        createdAt: new Date(Date.now() - minutesAgo * 60000),
        updatedAt: edited,
      });
    addIncident("inside", "100 Inside St", 1);
    addIncident("outside", "200 Outside St", 2);
    addIncident("nowhere", "300 Lost Rd", 3);

    const otherTenantDistrict = await call("POST", "/api/displays/boards", {
      body: { name: "North TV", callFilter: "districts", filterGeofenceIds: ["gB"] },
    });
    assert.equal(otherTenantDistrict.status, 400);

    const board = (
      await call("POST", "/api/displays/boards", { body: { name: "North TV", callFilter: "districts", filterGeofenceIds: ["g1"] } })
    ).json.data;
    const feed = await call("GET", `/api/displays/boards/${board.id}/feed?date=2026-11-25&minute=600`);
    assert.equal(feed.status, 200);
    const shown = feed.json.data.incidents.map((incident) => [incident.id, incident.districtUnknown]);
    assert.deepEqual(shown, [
      ["inside", false],
      ["nowhere", true],
    ]);
    assert.equal(lookups[0], "100 Inside St, Kankakee, IL");

    const saved = prisma.tables.incident.find((row) => row.id === "inside");
    assert.equal(saved.latitude, 41.12);
    assert.ok(saved.geocodedAt instanceof Date);
    assert.equal(saved.updatedAt.getTime(), edited.getTime());

    const located = await call("POST", "/api/maps/incident-location", { body: { incidentId: "inside" } });
    assert.equal(located.json.data.latitude, 41.12);
    assert.equal(lookups.length, 3);
    const hidden = await call("POST", "/api/maps/incident-location", { tenant: "tenantB", body: { incidentId: "inside" } });
    assert.equal(hidden.status, 404);
  } finally {
    await close();
  }
});
