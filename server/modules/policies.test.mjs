import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { permissionForRequest } from "../auth/permissions.mjs";
import { contentTextOf, periodOf, readAttachment, readContent, register, runRandomRules } from "./policies.mjs";

const DOC = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Purpose and Scope" }] },
    { type: "paragraph", content: [{ type: "text", text: "Members keep the hydrant map current." }] },
  ],
};

function compare(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

/** In-memory stand-in for the Prisma calls the policy routes make. */
function createFakePrisma() {
  const tables = {
    policyCategory: [],
    policy: [],
    policyVersion: [],
    policyAssignment: [],
    policyAcknowledgment: [],
    policyTemplate: [],
    policyRandomRule: [],
    user: [
      { id: "u-admin", tenantId: "tenantA", username: "chief" },
      { id: "u-alice", tenantId: "tenantA", username: "alice" },
      { id: "u-bob", tenantId: "tenantA", username: "bob" },
      { id: "u-zed", tenantId: "tenantB", username: "zed" },
    ],
  };
  let nextId = 1;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, expected]) => {
      if (expected === null) return row[key] == null;
      if (expected && typeof expected === "object" && !(expected instanceof Date) && Array.isArray(expected.in)) return expected.in.includes(row[key]);
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
    findFirst: async ({ where, select } = {}) => {
      const row = tables[name].find((entry) => matches(entry, where));
      return row ? pick(row, select) : null;
    },
    create: async ({ data }) => {
      if (name === "policyAcknowledgment" && tables[name].some((row) => ["tenantId", "policyId", "version", "userId"].every((key) => row[key] === data[key]))) {
        throw Object.assign(new Error("duplicate"), { code: "P2002" });
      }
      const now = new Date();
      const defaults = {
        policy: { status: "draft", currentVersion: 0, ackVersion: 0, requiresAck: true, sortOrder: 0, publishedAt: null, categoryId: null, effectiveDate: null },
        policyAssignment: { deletedAt: null, templateId: null, ruleId: null, periodKey: "", dueDate: null, assignedBy: "" },
        policyAcknowledgment: { acknowledgedAt: now },
      }[name];
      const row = { id: `id${nextId++}`, deletedAt: null, createdAt: now, updatedAt: now, ...defaults, ...data };
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
        where.tenantId === "tenantA" ? { payloadJson: { userFullNames: { chief: "Pat Chief", alice: "Alice Adams" } } } : null,
    },
    rolePermission: { findUnique: async () => null },
  };
  for (const name of Object.keys(tables)) prisma[name] = model(name);
  return prisma;
}

const USERS = { chief: { userId: "u-admin", role: "admin" }, alice: { userId: "u-alice", role: "user" }, bob: { userId: "u-bob", role: "user" } };

async function startServer() {
  const prisma = createFakePrisma();
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  app.use((request, _response, next) => {
    const username = request.get("x-user") || "chief";
    request.tenant = { id: request.get("x-tenant"), slug: request.get("x-tenant") };
    request.auth = { username, ...(USERS[username] ?? { userId: `u-${username}`, role: "user" }) };
    next();
  });
  register(app, prisma);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { tenant = "tenantA", user = "chief", body } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-tenant": tenant, "x-user": user },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  };
  return { prisma, call, close: () => new Promise((resolve) => server.close(resolve)) };
}

test("policy permissions: members read and acknowledge, managers write, publish and assign", () => {
  assert.equal(permissionForRequest("GET", "/api/policies"), null);
  assert.equal(permissionForRequest("GET", "/api/policies/home"), null);
  assert.equal(permissionForRequest("GET", "/api/policies/abc"), null);
  assert.equal(permissionForRequest("GET", "/api/policies/categories"), null);
  assert.equal(permissionForRequest("POST", "/api/policies/abc/acknowledge"), "policies.acknowledge");
  assert.equal(permissionForRequest("POST", "/api/policies"), "policies.manage");
  assert.equal(permissionForRequest("PATCH", "/api/policies/abc"), "policies.manage");
  assert.equal(permissionForRequest("DELETE", "/api/policies/abc"), "policies.manage");
  assert.equal(permissionForRequest("POST", "/api/policies/abc/publish"), "policies.manage");
  assert.equal(permissionForRequest("GET", "/api/policies/abc/status"), "policies.manage");
  assert.equal(permissionForRequest("POST", "/api/policies/categories"), "policies.manage");
  assert.equal(permissionForRequest("GET", "/api/policies/people"), "policies.manage");
  assert.equal(permissionForRequest("GET", "/api/policies/assignments"), "policies.manage");
  assert.equal(permissionForRequest("POST", "/api/policies/templates/abc/assign"), "policies.manage");
  assert.equal(permissionForRequest("PATCH", "/api/policies/rules/abc"), "policies.manage");
});

test("content checks and plain text for search", () => {
  assert.equal(contentTextOf(DOC), "Purpose and Scope\nMembers keep the hydrant map current.");
  assert.throws(() => readContent({ type: "paragraph" }), /not valid/);
  assert.equal(readContent(null), null);
  assert.throws(() => readAttachment({ dataUrl: "data:image/png;base64,AAAA" }), /Only PDF/);
  assert.equal(readAttachment({ name: "a.pdf", dataUrl: "data:application/pdf;base64,AAAA" }).name, "a.pdf");
  assert.equal(readAttachment({}), null);
});

test("publishing assigns everyone, members acknowledge, and a republish asks again unless it is minor", async () => {
  const { call, close } = await startServer();
  try {
    const chapter = await call("POST", "/api/policies/categories", { body: { number: 2, title: "Organization and Administration" } });
    assert.equal(chapter.status, 201);
    const created = await call("POST", "/api/policies", {
      body: { number: "201", title: "Emergency Action Plan", categoryId: chapter.json.data.id, content: DOC },
    });
    assert.equal(created.status, 201);
    const id = created.json.data.id;

    assert.equal((await call("GET", "/api/policies", { user: "alice" })).json.data.length, 0);
    assert.equal((await call("GET", `/api/policies/${id}`, { user: "alice" })).status, 404);
    assert.equal((await call("GET", "/api/policies")).json.data[0].status, "draft");

    const published = await call("POST", `/api/policies/${id}/publish`, { body: {} });
    assert.equal(published.status, 200);
    assert.equal(published.json.data.currentVersion, 1);
    assert.equal(published.json.data.ackVersion, 1);

    let home = (await call("GET", "/api/policies/home", { user: "alice" })).json.data;
    assert.deepEqual(home.needed.map((row) => row.number), ["201"]);
    const detail = (await call("GET", `/api/policies/${id}`, { user: "alice" })).json.data;
    assert.equal(detail.published.content.type, "doc");
    assert.equal(detail.draft, null);

    const acked = await call("POST", `/api/policies/${id}/acknowledge`, { user: "alice" });
    assert.equal(acked.json.data.myAck, "acknowledged");
    assert.equal((await call("POST", `/api/policies/${id}/acknowledge`, { user: "alice" })).status, 200);
    home = (await call("GET", "/api/policies/home", { user: "alice" })).json.data;
    assert.equal(home.needed.length, 0);
    assert.equal(home.acknowledged.length, 1);

    await call("PATCH", `/api/policies/${id}`, { body: { number: "201", title: "Emergency Action Plan", categoryId: chapter.json.data.id, content: DOC } });
    await call("POST", `/api/policies/${id}/publish`, { body: { requireReack: false, changeNote: "Typo" } });
    assert.equal((await call("GET", `/api/policies/${id}`, { user: "alice" })).json.data.myAck, "acknowledged");

    await call("PATCH", `/api/policies/${id}`, { body: { number: "201", title: "Emergency Action Plan", categoryId: chapter.json.data.id, content: DOC } });
    const third = await call("POST", `/api/policies/${id}/publish`, { body: {} });
    assert.equal(third.json.data.ackVersion, 3);
    assert.equal((await call("GET", `/api/policies/${id}`, { user: "alice" })).json.data.myAck, "needed");

    const status = (await call("GET", `/api/policies/${id}/status`)).json.data;
    assert.equal(status.find((row) => row.userId === "u-alice").status, "Pending");
    assert.equal(status.find((row) => row.userId === "u-alice").acknowledgedVersion, 1);
    assert.ok(status.every((row) => row.userId !== "u-zed"));

    assert.equal((await call("GET", "/api/policies?q=hydrant", { user: "alice" })).json.data.length, 1);
    assert.equal((await call("GET", "/api/policies?q=ladder", { user: "alice" })).json.data.length, 0);
    assert.equal((await call("DELETE", `/api/policies/categories/${chapter.json.data.id}`)).status, 400);
  } finally {
    await close();
  }
});

test("another department cannot see, change or acknowledge this department's policies", async () => {
  const { call, close } = await startServer();
  try {
    const id = (await call("POST", "/api/policies", { body: { number: "100", title: "Mission", content: DOC } })).json.data.id;
    await call("POST", `/api/policies/${id}/publish`, { body: {} });
    assert.equal((await call("GET", "/api/policies", { tenant: "tenantB" })).json.data.length, 0);
    assert.equal((await call("GET", `/api/policies/${id}`, { tenant: "tenantB" })).status, 404);
    assert.equal((await call("POST", `/api/policies/${id}/acknowledge`, { tenant: "tenantB", user: "zed" })).status, 404);
    assert.equal((await call("PATCH", `/api/policies/${id}`, { tenant: "tenantB", body: { title: "Hijack" } })).status, 404);
    assert.equal((await call("POST", `/api/policies/${id}/publish`, { tenant: "tenantB", body: {} })).status, 404);
    assert.equal((await call("GET", "/api/policies/categories", { tenant: "tenantB" })).json.data.length, 0);
    const people = (await call("GET", "/api/policies/people")).json.data;
    assert.deepEqual(people.map((row) => row.name).sort(), ["Alice Adams", "Pat Chief", "bob"]);
  } finally {
    await close();
  }
});

test("assigning to people and through templates", async () => {
  const { call, close } = await startServer();
  try {
    const id = (await call("POST", "/api/policies", { body: { kind: "dtb", number: "DTB-1", title: "Ladder throws", content: DOC } })).json.data.id;
    await call("POST", `/api/policies/${id}/publish`, { body: { assignEveryone: false } });
    assert.equal((await call("GET", "/api/policies/home", { user: "alice" })).json.data.dtbs.length, 0);

    const assigned = await call("POST", "/api/policies/assignments", { body: { policyIds: [id], userIds: ["u-alice"], dueDate: "2026-12-01" } });
    assert.equal(assigned.json.data.created, 1);
    assert.equal((await call("POST", "/api/policies/assignments", { body: { policyIds: [id], userIds: ["u-alice"] } })).json.data.created, 0);
    const aliceHome = (await call("GET", "/api/policies/home", { user: "alice" })).json.data;
    assert.equal(aliceHome.dtbs[0].dueDate, "2026-12-01");
    assert.equal((await call("GET", "/api/policies/home", { user: "bob" })).json.data.dtbs.length, 0);
    assert.equal((await call("POST", "/api/policies/assignments", { body: { policyIds: [id], userIds: ["u-zed"] } })).status, 400);

    const template = await call("POST", "/api/policies/templates", { body: { name: "Rookie Policies", policyIds: [id] } });
    assert.equal(template.status, 201);
    const viaTemplate = await call("POST", `/api/policies/templates/${template.json.data.id}/assign`, { body: { userIds: ["u-bob"] } });
    assert.equal(viaTemplate.json.data.created, 1);
    assert.equal((await call("GET", "/api/policies/home", { user: "bob" })).json.data.dtbs.length, 1);
  } finally {
    await close();
  }
});

test("random rules pick once per period and prefer policies not picked before", async () => {
  const { prisma, call, close } = await startServer();
  try {
    const ids = [];
    for (const number of ["D1", "D2", "D3"]) {
      const id = (await call("POST", "/api/policies", { body: { kind: "dtb", number, title: number, content: DOC } })).json.data.id;
      await call("POST", `/api/policies/${id}/publish`, { body: { assignEveryone: false } });
      ids.push(id);
    }
    const rule = await call("POST", "/api/policies/rules", { body: { name: "Weekly DTB", kind: "dtb", count: 2, period: "week" } });
    assert.equal(rule.status, 201);

    const monday = new Date("2026-11-23T12:00:00.000Z");
    assert.deepEqual(periodOf("week", monday).key, "W2026-11-23");
    assert.equal(periodOf("week", new Date("2026-11-29T12:00:00.000Z")).key, "W2026-11-23");
    assert.equal(periodOf("month", monday).key, "2026-11");

    await runRandomRules(prisma, "tenantA", monday, () => 0.5);
    const firstWeek = prisma.tables.policyAssignment.filter((row) => row.source === "rule");
    assert.equal(firstWeek.length, 2);
    assert.ok(firstWeek.every((row) => row.userId === "" && row.periodKey === "W2026-11-23"));
    await runRandomRules(prisma, "tenantA", new Date("2026-11-25T12:00:00.000Z"), () => 0.5);
    assert.equal(prisma.tables.policyAssignment.filter((row) => row.source === "rule").length, 2);

    await runRandomRules(prisma, "tenantA", new Date("2026-11-30T12:00:00.000Z"), () => 0.5);
    const nextWeek = prisma.tables.policyAssignment.filter((row) => row.periodKey === "W2026-11-30");
    const unpicked = ids.find((id) => !firstWeek.some((row) => row.policyId === id));
    assert.ok(nextWeek.some((row) => row.policyId === unpicked));
    await runRandomRules(prisma, "tenantB", monday);
    assert.ok(prisma.tables.policyAssignment.every((row) => row.tenantId === "tenantA"));
  } finally {
    await close();
  }
});
