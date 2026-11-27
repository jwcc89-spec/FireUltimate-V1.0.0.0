import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { permissionForRequest } from "../auth/permissions.mjs";
import { normalizeAddress } from "./addressMatch.mjs";
import { register } from "./prevention.mjs";

/** In-memory stand-in for the Prisma calls the prevention routes make. */
function createFakePrisma() {
  const tables = { property: [], propertyContact: [] };
  let nextId = 1;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, expected]) => {
      if (expected === null) return row[key] == null;
      if (expected && typeof expected === "object" && Array.isArray(expected.in)) return expected.in.includes(row[key]);
      if (expected && typeof expected === "object" && "not" in expected) return row[key] !== expected.not;
      return row[key] === expected;
    });
  const pick = (row, select) =>
    !row || !select ? row : Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]));
  const model = (name) => ({
    findMany: async ({ where, select } = {}) => tables[name].filter((row) => matches(row, where)).map((row) => pick(row, select)),
    findFirst: async ({ where, select } = {}) => pick(tables[name].find((row) => matches(row, where)) ?? null, select),
    create: async ({ data }) => {
      const now = new Date();
      const row = { id: `id${nextId++}`, deletedAt: null, createdAt: now, updatedAt: now, detailsJson: {}, ...data };
      tables[name].push(row);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const rows = tables[name].filter((row) => matches(row, where));
      for (const row of rows) Object.assign(row, data, { updatedAt: new Date() });
      return { count: rows.length };
    },
  });
  const prisma = {};
  for (const name of Object.keys(tables)) prisma[name] = model(name);
  return { prisma, tables };
}

async function startServer() {
  const { prisma, tables } = createFakePrisma();
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  app.use((request, _response, next) => {
    request.tenant = { id: request.get("x-tenant"), slug: request.get("x-tenant"), name: "Kankakee Fire" };
    request.auth = { userId: "u1", username: "alice", role: "admin" };
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
  return { call, tables, close: () => new Promise((resolve) => server.close(resolve)) };
}

test("prevention permissions: members who view calls can read, managers change", () => {
  assert.equal(permissionForRequest("GET", "/api/prevention/properties"), "incidents.view");
  assert.equal(permissionForRequest("GET", "/api/prevention/properties/abc"), "incidents.view");
  assert.equal(permissionForRequest("POST", "/api/prevention/properties"), "prevention.manage");
  assert.equal(permissionForRequest("PATCH", "/api/prevention/properties/abc"), "prevention.manage");
  assert.equal(permissionForRequest("DELETE", "/api/prevention/properties/abc"), "prevention.manage");
  assert.equal(permissionForRequest("POST", "/api/prevention/properties/abc/contacts"), "prevention.manage");
  assert.equal(permissionForRequest("PATCH", "/api/prevention/contacts/abc"), "prevention.manage");
  assert.equal(permissionForRequest("DELETE", "/api/prevention/contacts/abc"), "prevention.manage");
});

test("addresses are cleaned the same way however they were typed", () => {
  assert.equal(normalizeAddress("401 Maple Street"), "401 MAPLE ST");
  assert.equal(normalizeAddress("401 maple st., Apt 2B, Watseka IL"), "401 MAPLE ST");
  assert.equal(normalizeAddress("1995 South Schuyler Avenue #4"), "1995 S SCHUYLER AVE");
  assert.equal(normalizeAddress("55 Meadowview Ctr Suite 100"), "55 MEADOWVIEW CTR");
  assert.equal(normalizeAddress(""), "");
});

test("properties and contacts stay inside their own department", async () => {
  const { call, tables, close } = await startServer();
  try {
    const missing = await call("POST", "/api/prevention/properties", { body: { address: "  " } });
    assert.equal(missing.status, 400);

    const created = await call("POST", "/api/prevention/properties", {
      body: {
        name: "Meadowview Theatre",
        address: "55 Meadowview Center",
        city: "Kankakee",
        state: "IL",
        postalCode: "60901",
        propertyType: "commercial",
        occupancyType: "Assembly",
        squareFeet: "12,500",
        yearBuilt: 1987,
        latitude: 41.12,
        longitude: -87.86,
        streetViewPanoId: "pano123",
        streetViewHeading: 90,
        streetViewPitch: 5,
        notes: "Knox box at the north door",
      },
    });
    assert.equal(created.status, 201);
    const property = created.json.data;
    assert.equal(property.propertyType, "commercial");
    assert.equal(property.squareFeet, 12500);
    assert.equal(property.notes, "Knox box at the north door");
    assert.equal(tables.property[0].normalizedAddress, "55 MEADOWVIEW CTR");

    const halfPin = await call("PATCH", `/api/prevention/properties/${property.id}`, { body: { latitude: "" } });
    assert.equal(halfPin.status, 400);
    const badPhoto = await call("PATCH", `/api/prevention/properties/${property.id}`, { body: { photo: "data:text/html,<b>" } });
    assert.equal(badPhoto.status, 400);

    const owner = await call("POST", `/api/prevention/properties/${property.id}/contacts`, {
      body: { firstName: "Hailey", lastName: "Siegel", role: "Owner", isPrimary: true, phone: "815-555-0100" },
    });
    assert.equal(owner.status, 201);
    const manager = await call("POST", `/api/prevention/properties/${property.id}/contacts`, {
      body: { firstName: "Pen", lastName: "Harvick", role: "Manager", isPrimary: true },
    });
    assert.equal(manager.status, 201);
    const contacts = manager.json.data.contacts;
    assert.equal(contacts.filter((contact) => contact.isPrimary).length, 1);
    assert.equal(contacts[0].firstName, "Pen");
    assert.equal(manager.json.data.ownerName, "Hailey Siegel");

    const list = await call("GET", "/api/prevention/properties");
    assert.equal(list.json.data.length, 1);
    assert.equal(list.json.data[0].ownerName, "Hailey Siegel");
    assert.equal(list.json.data[0].contactCount, 2);
    assert.equal("photo" in list.json.data[0], false);

    const otherList = await call("GET", "/api/prevention/properties", { tenant: "tenantB" });
    assert.deepEqual(otherList.json.data, []);
    assert.equal((await call("GET", `/api/prevention/properties/${property.id}`, { tenant: "tenantB" })).status, 404);
    assert.equal(
      (await call("PATCH", `/api/prevention/properties/${property.id}`, { tenant: "tenantB", body: { name: "Nope" } })).status,
      404,
    );
    assert.equal((await call("DELETE", `/api/prevention/properties/${property.id}`, { tenant: "tenantB" })).status, 404);
    const contactId = contacts[0].id;
    assert.equal(
      (await call("POST", `/api/prevention/properties/${property.id}/contacts`, { tenant: "tenantB", body: { firstName: "X" } })).status,
      404,
    );
    assert.equal(
      (await call("PATCH", `/api/prevention/contacts/${contactId}`, { tenant: "tenantB", body: { firstName: "X" } })).status,
      404,
    );
    assert.equal((await call("DELETE", `/api/prevention/contacts/${contactId}`, { tenant: "tenantB" })).status, 404);

    const removedContact = await call("DELETE", `/api/prevention/contacts/${contactId}`);
    assert.equal(removedContact.json.data.contacts.length, 1);
    assert.equal((await call("DELETE", `/api/prevention/properties/${property.id}`)).status, 200);
    assert.deepEqual((await call("GET", "/api/prevention/properties")).json.data, []);
  } finally {
    await close();
  }
});
