import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { permissionForRequest } from "../auth/permissions.mjs";
import { register } from "./maps.mjs";
import { censusGeocode, normalizeGeometry, pointInGeofences } from "./mapsGeometry.mjs";

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

/** In-memory stand-in for the Prisma calls the map routes make. */
function createFakePrisma() {
  const tables = { mapMarkerType: [], mapMarker: [], geofence: [] };
  let nextId = 1;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, expected]) => {
      if (expected === null) return row[key] == null;
      if (expected && typeof expected === "object" && Array.isArray(expected.in)) return expected.in.includes(row[key]);
      return row[key] === expected;
    });
  const sortRows = (rows, orderBy) => {
    if (!orderBy) return rows;
    const [key, direction] = Object.entries(orderBy)[0];
    return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (direction === "desc" ? -1 : 1));
  };
  const withIncludes = (name, row, include) => {
    if (!row || !include || name !== "mapMarker") return row;
    return {
      ...row,
      markerType: tables.mapMarkerType.find((entry) => entry.id === row.markerTypeId) ?? null,
    };
  };
  const insert = (name, data) => {
    const now = new Date();
    const row = { id: `id${nextId++}`, deletedAt: null, createdAt: now, updatedAt: now, ...data };
    if (name === "mapMarkerType" && row.deletedAt == null) {
      const duplicate = tables.mapMarkerType.some(
        (entry) => entry.tenantId === row.tenantId && entry.name === row.name && entry.deletedAt == null && entry.id !== row.id,
      );
      if (duplicate) throw Object.assign(new Error("unique"), { code: "P2002" });
    }
    tables[name].push(row);
    return row;
  };
  const model = (name) => ({
    findMany: async ({ where, orderBy, include, select } = {}) =>
      sortRows(tables[name].filter((row) => matches(row, where)), orderBy).map((row) => {
        const full = withIncludes(name, row, include);
        if (!select) return full;
        return Object.fromEntries(Object.keys(select).map((key) => [key, full[key]]));
      }),
    findFirst: async ({ where, include, select } = {}) => {
      const row = tables[name].find((entry) => matches(entry, where)) ?? null;
      const full = withIncludes(name, row, include);
      if (!full || !select) return full;
      return Object.fromEntries(Object.keys(select).map((key) => [key, full[key]]));
    },
    count: async ({ where } = {}) => tables[name].filter((row) => matches(row, where)).length,
    create: async ({ data }) => insert(name, data),
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
    departmentDetails: { findUnique: async () => ({ payloadJson: { userFullNames: { alice: "Alice Adams" } } }) },
  };
  for (const name of Object.keys(tables)) prisma[name] = model(name);
  return prisma;
}

async function startServer() {
  const prisma = createFakePrisma();
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  app.use((request, _response, next) => {
    request.tenant = { id: request.get("x-tenant"), slug: request.get("x-tenant"), name: "Kankakee Fire" };
    request.auth = { userId: request.get("x-user"), username: request.get("x-user"), role: request.get("x-role") };
    next();
  });
  register(app, prisma);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { tenant = "tenantA", user = "alice", role = "admin", body } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-tenant": tenant, "x-user": user, "x-role": role },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  };
  return { call, close: () => new Promise((resolve) => server.close(resolve)) };
}

test("map permissions let every signed-in member look, and only managers change the map", () => {
  assert.equal(permissionForRequest("GET", "/api/maps/markers"), null);
  assert.equal(permissionForRequest("GET", "/api/maps/marker-types"), null);
  assert.equal(permissionForRequest("GET", "/api/geofences"), null);
  assert.equal(permissionForRequest("POST", "/api/maps/geocode"), null);
  assert.equal(permissionForRequest("POST", "/api/maps/district"), null);
  assert.equal(permissionForRequest("POST", "/api/maps/markers"), "maps.manage");
  assert.equal(permissionForRequest("PATCH", "/api/maps/markers/abc"), "maps.manage");
  assert.equal(permissionForRequest("DELETE", "/api/maps/marker-types/abc"), "maps.manage");
  assert.equal(permissionForRequest("DELETE", "/api/geofences/abc"), "maps.manage");
});

test("an outline left open is closed, and a point inside it is found", () => {
  const feature = normalizeGeometry(SQUARE);
  assert.equal(feature.geometry.coordinates[0].length, 5);
  assert.equal(pointInGeofences(41.12, -87.86, [{ geometryJson: feature }]).length, 1);
  assert.equal(pointInGeofences(42, -88, [{ geometryJson: feature }]).length, 0);
  assert.throws(() => normalizeGeometry({ type: "LineString", coordinates: [] }), /area/);
});

test("census lookup reads the matched point and says when nothing matched", async () => {
  const found = await censusGeocode("1995 S Schuyler Ave", async () => ({
    ok: true,
    json: async () => ({ result: { addressMatches: [{ matchedAddress: "1995 S SCHUYLER AVE", coordinates: { x: -87.86, y: 41.12 } }] } }),
  }));
  assert.equal(found.source, "census");
  assert.equal(found.latitude, 41.12);
  assert.equal(found.longitude, -87.86);
  await assert.rejects(
    () => censusGeocode("1995 S Schuyler Ave", async () => ({ ok: true, json: async () => ({ result: { addressMatches: [] } }) })),
    /No map point/,
  );
});

test("map routes keep each department's markers and areas separate", async () => {
  const { call, close } = await startServer();
  try {
    const types = await call("GET", "/api/maps/marker-types");
    assert.equal(types.status, 200);
    const hydrant = types.json.data.find((item) => item.name === "Hydrant");
    assert.ok(hydrant);

    const created = await call("POST", "/api/maps/markers", {
      body: { label: "Main St hydrant", markerTypeId: hydrant.id, latitude: 41.12, longitude: -87.86, notes: "Blue top", flowGpm: 400 },
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.data.icon, "hydrant");
    assert.equal(created.json.data.updatedByName, "Alice Adams");
    assert.equal(created.json.data.departmentName, "Kankakee Fire");
    const id = created.json.data.id;

    const otherList = await call("GET", "/api/maps/markers", { tenant: "tenantB" });
    assert.deepEqual(otherList.json.data, []);
    assert.equal((await call("PATCH", `/api/maps/markers/${id}`, { tenant: "tenantB", body: { label: "Nope" } })).status, 404);
    assert.equal((await call("DELETE", `/api/maps/markers/${id}`, { tenant: "tenantB" })).status, 404);

    const blocked = await call("DELETE", `/api/maps/marker-types/${hydrant.id}`);
    assert.equal(blocked.status, 400);

    const area = await call("POST", "/api/geofences", {
      body: { name: "North", kind: "district", color: "#dc2626", geometry: SQUARE, description: "1995 S Schuyler" },
    });
    assert.equal(area.status, 201);
    assert.equal(area.json.data.geometry.type, "Polygon");
    const child = await call("POST", "/api/geofences", {
      body: { name: "Trailer park", kind: "subsection", parentId: area.json.data.id, geometry: SQUARE },
    });
    assert.equal(child.status, 201);
    assert.equal(child.json.data.parentName, "North");

    const inside = await call("POST", "/api/maps/district", { body: { latitude: 41.12, longitude: -87.86 } });
    assert.equal(inside.status, 200);
    assert.equal(inside.json.data.source, "manual");
    assert.equal(inside.json.data.matches.length, 2);
    const outside = await call("POST", "/api/maps/district", { tenant: "tenantB", body: { latitude: 41.12, longitude: -87.86 } });
    assert.deepEqual(outside.json.data.matches, []);

    const bad = await call("POST", "/api/geofences", { body: { name: "Line", geometry: { type: "LineString", coordinates: [] } } });
    assert.equal(bad.status, 400);

    const otherAreas = await call("GET", "/api/geofences", { tenant: "tenantB" });
    assert.deepEqual(otherAreas.json.data, []);
    assert.equal((await call("DELETE", `/api/geofences/${area.json.data.id}`, { tenant: "tenantB" })).status, 404);
  } finally {
    await close();
  }
});
