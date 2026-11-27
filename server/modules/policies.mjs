/**
 * Policy manual, Daily Training Bulletins (DTBs), acknowledgments, assignments, templates and random rules.
 * Any signed-in member reads published policies. Acknowledging needs policies.acknowledge; writing,
 * publishing and assigning need policies.manage (permissionForRequest). Every query filters on request.tenant.id.
 */
import { minimumRoleFor, roleLevel } from "../auth/permissions.mjs";
import { PublicError } from "../http/publicError.mjs";
import { actorOf, formatDateOnly, fullNameFor, oneOf, parseDateOnly, sendError, tenantIdOf, text } from "./moduleHelpers.mjs";

const POLICY_KINDS = ["policy", "dtb"];
const CATEGORY_KINDS = ["manual", "dtb"];
const RULE_PERIODS = ["week", "month"];
const MAX_CONTENT_CHARS = 400_000;
const MAX_TEXT_CHARS = 200_000;
/** About 2.5 MB of PDF once encoded, which keeps a save under the server's 4 MB request limit. */
const MAX_ATTACHMENT_CHARS = 3_500_000;
const RULE_RUN_GAP_MS = 60_000;
const lastRuleRun = new Map();

function iso(value) {
  return value instanceof Date ? value.toISOString() : "";
}

function list(raw) {
  return Array.isArray(raw) ? raw : [];
}

function notFound(response, label) {
  response.status(404).json({ ok: false, message: `That ${label} was not found.` });
}

async function canManage(prisma, request) {
  const minimum = await minimumRoleFor(prisma, request.tenant.id, "policies.manage");
  return minimum != null && roleLevel(request.auth?.role) >= roleLevel(minimum);
}

function userIdOf(request) {
  return text(request.auth?.userId, 100);
}

// ----- Content -----

/** An editor document (TipTap JSON). It is rendered by the editor's own schema, never as raw HTML. */
export function readContent(raw) {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw) || raw.type !== "doc") throw new PublicError("The policy text is not valid.");
  if (JSON.stringify(raw).length > MAX_CONTENT_CHARS) throw new PublicError("The policy text is too long.");
  return raw;
}

/** Plain text of an editor document, one line per block, for search. */
export function contentTextOf(doc) {
  const lines = [];
  let line = "";
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "text" && typeof node.text === "string") line += node.text;
    for (const child of list(node.content)) walk(child);
    if (node.type !== "text" && line.trim() && ["paragraph", "heading", "listItem", "blockquote", "codeBlock"].includes(node.type)) {
      lines.push(line.trim());
      line = "";
    }
  };
  walk(doc);
  if (line.trim()) lines.push(line.trim());
  return lines.join("\n").slice(0, MAX_TEXT_CHARS);
}

export function readAttachment(raw) {
  if (raw == null || (typeof raw === "object" && !raw.dataUrl)) return null;
  const dataUrl = String(raw?.dataUrl ?? "");
  if (!dataUrl.startsWith("data:application/pdf;base64,")) throw new PublicError("Only PDF files can be attached to a policy.");
  if (dataUrl.length > MAX_ATTACHMENT_CHARS) throw new PublicError("The PDF must be 2.5 MB or smaller.");
  return { name: text(raw.name, 200) || "policy.pdf", size: Number(raw.size) || 0, dataUrl };
}

function attachmentInfo(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return value.dataUrl ? { name: text(value.name, 200), size: Number(value.size) || 0 } : null;
}

// ----- Acknowledgment state -----

/** This member's assignments and acknowledgments, so each policy can say "needed" or "acknowledged". */
async function ackContext(prisma, tenantId, userId) {
  if (!userId) return { assigned: new Map(), acked: new Map() };
  const [assignments, acks] = await Promise.all([
    prisma.policyAssignment.findMany({
      where: { tenantId, deletedAt: null, userId: { in: [userId, ""] } },
      select: { policyId: true, dueDate: true, createdAt: true, source: true },
    }),
    prisma.policyAcknowledgment.findMany({ where: { tenantId, userId }, select: { policyId: true, version: true, acknowledgedAt: true } }),
  ]);
  const assigned = new Map();
  for (const row of assignments) {
    const previous = assigned.get(row.policyId);
    if (!previous || (row.dueDate && (!previous.dueDate || row.dueDate < previous.dueDate))) assigned.set(row.policyId, row);
  }
  const acked = new Map();
  for (const row of acks) {
    const previous = acked.get(row.policyId);
    if (!previous || row.version > previous.version) acked.set(row.policyId, row);
  }
  return { assigned, acked };
}

function ackState(policy, context) {
  if (policy.status !== "published" || !policy.requiresAck || policy.ackVersion < 1) return { myAck: "none", acknowledgedAt: "", dueDate: "" };
  const assignment = context.assigned.get(policy.id);
  const ack = context.acked.get(policy.id);
  if (ack && ack.version >= policy.ackVersion) return { myAck: "acknowledged", acknowledgedAt: iso(ack.acknowledgedAt), dueDate: "" };
  if (!assignment) return { myAck: "none", acknowledgedAt: "", dueDate: "" };
  return { myAck: "needed", acknowledgedAt: "", dueDate: formatDateOnly(assignment.dueDate), assignedAt: iso(assignment.createdAt) };
}

function serializePolicy(row, context) {
  const draft = row.draftJson && typeof row.draftJson === "object" ? row.draftJson : {};
  return {
    id: row.id,
    kind: row.kind,
    categoryId: row.categoryId ?? "",
    number: row.number,
    title: row.title,
    status: row.status,
    currentVersion: row.currentVersion,
    ackVersion: row.ackVersion,
    publishedAt: iso(row.publishedAt),
    effectiveDate: formatDateOnly(row.effectiveDate),
    requiresAck: row.requiresAck,
    hasDraft: Boolean(draft.content || draft.attachment),
    updatedAt: iso(row.updatedAt),
    updatedBy: row.updatedBy,
    ...ackState(row, context),
  };
}

function comparePolicies(a, b) {
  return a.number.localeCompare(b.number, undefined, { numeric: true }) || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
}

// ----- Random rules -----

function pad(value) {
  return String(value).padStart(2, "0");
}

/** The week (starting Monday) or month a date falls in, and the last day of it. */
export function periodOf(period, date) {
  if (period === "month") {
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    return { key: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`, end };
  }
  const day = (date.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day));
  const end = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
  return { key: `W${formatDateOnly(monday)}`, end };
}

/**
 * Gives each active rule its picks for the current week or month, the first time anyone opens Policies in that period.
 * Policies this rule has not picked before come first.
 */
export async function runRandomRules(prisma, tenantId, now = new Date(), random = Math.random) {
  const rules = await prisma.policyRandomRule.findMany({ where: { tenantId, deletedAt: null, active: true } });
  for (const rule of rules) {
    const { key, end } = periodOf(rule.period, now);
    const already = await prisma.policyAssignment.findMany({
      where: { tenantId, ruleId: rule.id, periodKey: key },
      select: { id: true },
    });
    if (already.length > 0) continue;
    const categoryIds = list(rule.categoryIds).map((id) => text(id, 60)).filter(Boolean);
    const candidates = await prisma.policy.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: "published",
        kind: rule.kind,
        requiresAck: true,
        ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
      },
      select: { id: true },
    });
    if (candidates.length === 0) continue;
    const used = new Set(
      (await prisma.policyAssignment.findMany({ where: { tenantId, ruleId: rule.id }, select: { policyId: true } })).map((row) => row.policyId),
    );
    const shuffled = candidates.map((row) => ({ id: row.id, order: (used.has(row.id) ? 1 : 0) + random() })).sort((a, b) => a.order - b.order);
    const picks = shuffled.slice(0, Math.max(1, rule.count));
    const userIds = list(rule.userIds).map((id) => text(id, 100)).filter(Boolean);
    for (const pick of picks) {
      for (const userId of userIds.length > 0 ? userIds : [""]) {
        await prisma.policyAssignment.create({
          data: { tenantId, policyId: pick.id, userId, source: "rule", ruleId: rule.id, periodKey: key, dueDate: end, assignedBy: rule.name },
        });
      }
    }
  }
}

async function runRulesIfDue(prisma, tenantId) {
  const last = lastRuleRun.get(tenantId) ?? 0;
  if (Date.now() - last < RULE_RUN_GAP_MS) return;
  lastRuleRun.set(tenantId, Date.now());
  await runRandomRules(prisma, tenantId);
}

// ----- Readers -----

function readCategory(body) {
  const title = text(body?.title, 200);
  if (!title) throw new PublicError("Enter a chapter title.");
  const number = Number(body?.number ?? 0);
  if (!Number.isInteger(number) || number < 0 || number > 999) throw new PublicError("The chapter number must be a whole number from 0 to 999.");
  return { kind: oneOf(body?.kind, CATEGORY_KINDS, "manual"), number, title, sortOrder: Number.isInteger(body?.sortOrder) ? body.sortOrder : 0 };
}

async function readPolicy(prisma, tenantId, body) {
  const title = text(body?.title, 300);
  if (!title) throw new PublicError("Enter a title.");
  const categoryId = text(body?.categoryId, 60) || null;
  if (categoryId) {
    const category = await prisma.policyCategory.findFirst({ where: { id: categoryId, tenantId, deletedAt: null }, select: { id: true } });
    if (!category) throw new PublicError("That chapter was not found.");
  }
  const content = readContent(body?.content);
  const attachment = readAttachment(body?.attachment);
  return {
    kind: oneOf(body?.kind, POLICY_KINDS, "policy"),
    categoryId,
    number: text(body?.number, 30),
    title,
    effectiveDate: parseDateOnly(body?.effectiveDate, "Effective Date"),
    requiresAck: body?.requiresAck !== false,
    draftJson: { ...(content ? { content } : {}), ...(attachment ? { attachment } : {}) },
  };
}

async function usersOf(prisma, tenantId) {
  const [users, details] = await Promise.all([
    prisma.user.findMany({ where: { tenantId }, select: { id: true, username: true }, orderBy: { username: "asc" } }),
    prisma.departmentDetails.findUnique({ where: { tenantId }, select: { payloadJson: true } }),
  ]);
  const names = details?.payloadJson?.userFullNames;
  const lookup = new Map(
    names && typeof names === "object" && !Array.isArray(names)
      ? Object.entries(names).map(([key, value]) => [key.trim().toLowerCase(), text(value, 200)])
      : [],
  );
  return users.map((user) => ({ id: user.id, username: user.username, name: lookup.get(user.username.toLowerCase()) || user.username }));
}

async function readAssignTargets(prisma, tenantId, body) {
  const requested = [...new Set(list(body?.userIds).map((id) => text(id, 100)))];
  if (requested.length === 0) throw new PublicError("Choose who to assign it to.");
  const everyone = requested.includes("");
  const people = requested.filter(Boolean);
  if (people.length > 0) {
    const found = await prisma.user.findMany({ where: { tenantId, id: { in: people } }, select: { id: true } });
    if (found.length !== people.length) throw new PublicError("A chosen person was not found.");
  }
  return { userIds: everyone ? [""] : people, dueDate: parseDateOnly(body?.dueDate, "Due Date") };
}

async function publishedPolicyIds(prisma, tenantId, ids) {
  const wanted = [...new Set(list(ids).map((id) => text(id, 60)).filter(Boolean))].slice(0, 200);
  if (wanted.length === 0) return [];
  const found = await prisma.policy.findMany({ where: { tenantId, deletedAt: null, id: { in: wanted } }, select: { id: true } });
  if (found.length !== wanted.length) throw new PublicError("A chosen policy was not found.");
  return wanted;
}

async function createAssignments(prisma, tenantId, policyIds, { userIds, dueDate }, extra) {
  const existing = await prisma.policyAssignment.findMany({
    where: { tenantId, deletedAt: null, policyId: { in: policyIds }, userId: { in: userIds } },
    select: { policyId: true, userId: true },
  });
  const taken = new Set(existing.map((row) => `${row.policyId}\n${row.userId}`));
  let created = 0;
  for (const policyId of policyIds) {
    for (const userId of userIds) {
      if (taken.has(`${policyId}\n${userId}`)) continue;
      await prisma.policyAssignment.create({ data: { tenantId, policyId, userId, dueDate, ...extra } });
      created += 1;
    }
  }
  return created;
}

function serializeTemplate(row) {
  return { id: row.id, name: row.name, policyIds: list(row.policyIds), updatedAt: iso(row.updatedAt), updatedBy: row.updatedBy };
}

function serializeRule(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    count: row.count,
    period: row.period,
    categoryIds: list(row.categoryIds),
    userIds: list(row.userIds),
    active: row.active,
    updatedAt: iso(row.updatedAt),
    updatedBy: row.updatedBy,
  };
}

function readRule(body) {
  const name = text(body?.name, 200);
  if (!name) throw new PublicError("Enter a name for the rule.");
  const count = Number(body?.count ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new PublicError("Pick from 1 to 20 each period.");
  return {
    name,
    kind: oneOf(body?.kind, POLICY_KINDS, "dtb"),
    count,
    period: oneOf(body?.period, RULE_PERIODS, "week"),
    categoryIds: [...new Set(list(body?.categoryIds).map((id) => text(id, 60)).filter(Boolean))].slice(0, 50),
    userIds: [...new Set(list(body?.userIds).map((id) => text(id, 100)).filter(Boolean))].slice(0, 500),
    active: body?.active !== false,
  };
}

export function register(app, prisma) {
  // ----- Chapters -----

  app.get("/api/policies/categories", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const kind = CATEGORY_KINDS.includes(String(request.query.kind)) ? String(request.query.kind) : null;
      const rows = await prisma.policyCategory.findMany({ where: { tenantId, deletedAt: null, ...(kind ? { kind } : {}) } });
      rows.sort((a, b) => a.number - b.number || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
      response.json({
        ok: true,
        data: rows.map((row) => ({ id: row.id, kind: row.kind, number: row.number, title: row.title, sortOrder: row.sortOrder })),
      });
    } catch (error) {
      sendError(response, error, "Could not load the chapters.");
    }
  });

  app.post("/api/policies/categories", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const row = await prisma.policyCategory.create({ data: { tenantId, ...readCategory(request.body), createdBy: actor, updatedBy: actor } });
      response.status(201).json({ ok: true, data: { id: row.id, kind: row.kind, number: row.number, title: row.title, sortOrder: row.sortOrder } });
    } catch (error) {
      sendError(response, error, "Could not save the chapter.");
    }
  });

  app.patch("/api/policies/categories/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.policyCategory.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { ...readCategory(request.body), updatedBy: actorOf(request) },
      });
      if (result.count === 0) return notFound(response, "chapter");
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not save the chapter.");
    }
  });

  app.delete("/api/policies/categories/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const inUse = await prisma.policy.findFirst({ where: { tenantId, categoryId: request.params.id, deletedAt: null }, select: { id: true } });
      if (inUse) throw new PublicError("Move or delete this chapter's policies first.");
      const result = await prisma.policyCategory.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) return notFound(response, "chapter");
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the chapter.");
    }
  });

  // ----- Home -----

  app.get("/api/policies/home", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      await runRulesIfDue(prisma, tenantId);
      const [rows, context] = await Promise.all([
        prisma.policy.findMany({ where: { tenantId, deletedAt: null, status: "published" } }),
        ackContext(prisma, tenantId, userIdOf(request)),
      ]);
      const policies = rows.map((row) => serializePolicy(row, context));
      const newestFirst = (a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || "");
      const byAck = (a, b) => (b.acknowledgedAt || "").localeCompare(a.acknowledgedAt || "");
      response.json({
        ok: true,
        data: {
          needed: policies.filter((row) => row.kind === "policy" && row.myAck === "needed").sort(newestFirst),
          acknowledged: policies.filter((row) => row.kind === "policy" && row.myAck === "acknowledged").sort(byAck).slice(0, 25),
          dtbs: policies.filter((row) => row.kind === "dtb" && row.myAck === "needed").sort(newestFirst),
          dtbsDone: policies.filter((row) => row.kind === "dtb" && row.myAck === "acknowledged").sort(byAck).slice(0, 10),
        },
      });
    } catch (error) {
      sendError(response, error, "Could not load policies.");
    }
  });

  // ----- People, assignments, templates and rules (policies.manage) -----

  app.get("/api/policies/people", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      response.json({ ok: true, data: (await usersOf(prisma, tenantId)).map(({ id, name }) => ({ id, name })) });
    } catch (error) {
      sendError(response, error, "Could not load people.");
    }
  });

  app.get("/api/policies/assignments", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const policyId = text(request.query.policyId, 60);
      const rows = await prisma.policyAssignment.findMany({
        where: { tenantId, deletedAt: null, ...(policyId ? { policyId } : {}) },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      response.json({
        ok: true,
        data: rows.map((row) => ({
          id: row.id,
          policyId: row.policyId,
          userId: row.userId,
          source: row.source,
          periodKey: row.periodKey,
          dueDate: formatDateOnly(row.dueDate),
          assignedBy: row.assignedBy,
          createdAt: iso(row.createdAt),
        })),
      });
    } catch (error) {
      sendError(response, error, "Could not load assignments.");
    }
  });

  app.post("/api/policies/assignments", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const policyIds = await publishedPolicyIds(prisma, tenantId, request.body?.policyIds);
      if (policyIds.length === 0) throw new PublicError("Choose at least one policy.");
      const targets = await readAssignTargets(prisma, tenantId, request.body);
      const created = await createAssignments(prisma, tenantId, policyIds, targets, { source: "manual", assignedBy: actorOf(request) });
      response.status(201).json({ ok: true, data: { created } });
    } catch (error) {
      sendError(response, error, "Could not assign.");
    }
  });

  app.delete("/api/policies/assignments/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.policyAssignment.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (result.count === 0) return notFound(response, "assignment");
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not remove the assignment.");
    }
  });

  app.get("/api/policies/templates", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const rows = await prisma.policyTemplate.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: "asc" } });
      response.json({ ok: true, data: rows.map(serializeTemplate) });
    } catch (error) {
      sendError(response, error, "Could not load templates.");
    }
  });

  const readTemplate = async (tenantId, body) => {
    const name = text(body?.name, 200);
    if (!name) throw new PublicError("Enter a name for the template.");
    return { name, policyIds: await publishedPolicyIds(prisma, tenantId, body?.policyIds) };
  };

  app.post("/api/policies/templates", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const row = await prisma.policyTemplate.create({
        data: { tenantId, ...(await readTemplate(tenantId, request.body)), createdBy: actor, updatedBy: actor },
      });
      response.status(201).json({ ok: true, data: serializeTemplate(row) });
    } catch (error) {
      sendError(response, error, "Could not save the template.");
    }
  });

  app.patch("/api/policies/templates/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.policyTemplate.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { ...(await readTemplate(tenantId, request.body)), updatedBy: actorOf(request) },
      });
      if (result.count === 0) return notFound(response, "template");
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not save the template.");
    }
  });

  app.delete("/api/policies/templates/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.policyTemplate.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) return notFound(response, "template");
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the template.");
    }
  });

  app.post("/api/policies/templates/:id/assign", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const template = await prisma.policyTemplate.findFirst({ where: { id: request.params.id, tenantId, deletedAt: null } });
      if (!template) return notFound(response, "template");
      const policies = await prisma.policy.findMany({
        where: { tenantId, deletedAt: null, status: "published", id: { in: list(template.policyIds) } },
        select: { id: true },
      });
      if (policies.length === 0) throw new PublicError("This template has no published policies yet.");
      const targets = await readAssignTargets(prisma, tenantId, request.body);
      const created = await createAssignments(
        prisma,
        tenantId,
        policies.map((row) => row.id),
        targets,
        { source: "template", templateId: template.id, assignedBy: actorOf(request) },
      );
      response.status(201).json({ ok: true, data: { created } });
    } catch (error) {
      sendError(response, error, "Could not assign the template.");
    }
  });

  app.get("/api/policies/rules", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const rows = await prisma.policyRandomRule.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: "asc" } });
      response.json({ ok: true, data: rows.map(serializeRule) });
    } catch (error) {
      sendError(response, error, "Could not load rules.");
    }
  });

  app.post("/api/policies/rules", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const row = await prisma.policyRandomRule.create({ data: { tenantId, ...readRule(request.body), createdBy: actor, updatedBy: actor } });
      lastRuleRun.delete(tenantId);
      response.status(201).json({ ok: true, data: serializeRule(row) });
    } catch (error) {
      sendError(response, error, "Could not save the rule.");
    }
  });

  app.patch("/api/policies/rules/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.policyRandomRule.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { ...readRule(request.body), updatedBy: actorOf(request) },
      });
      if (result.count === 0) return notFound(response, "rule");
      lastRuleRun.delete(tenantId);
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not save the rule.");
    }
  });

  app.delete("/api/policies/rules/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.policyRandomRule.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) return notFound(response, "rule");
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the rule.");
    }
  });

  // ----- Policies -----

  app.get("/api/policies", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const manager = await canManage(prisma, request);
      const kind = POLICY_KINDS.includes(String(request.query.kind)) ? String(request.query.kind) : null;
      if (kind === "dtb") await runRulesIfDue(prisma, tenantId);
      const [rows, context] = await Promise.all([
        prisma.policy.findMany({
          where: { tenantId, deletedAt: null, ...(kind ? { kind } : {}), ...(manager ? {} : { status: "published" }) },
        }),
        ackContext(prisma, tenantId, userIdOf(request)),
      ]);
      let shown = rows;
      const query = text(request.query.q, 200).toLowerCase();
      if (query) {
        const versions = await prisma.policyVersion.findMany({
          where: { tenantId, policyId: { in: rows.map((row) => row.id) } },
          select: { policyId: true, version: true, contentText: true },
        });
        const current = new Map(rows.map((row) => [row.id, row.currentVersion]));
        const textHits = new Set(
          versions.filter((row) => row.version === current.get(row.policyId) && row.contentText.toLowerCase().includes(query)).map((row) => row.policyId),
        );
        shown = rows.filter((row) => textHits.has(row.id) || `${row.number} ${row.title}`.toLowerCase().includes(query));
      }
      response.json({ ok: true, canManage: manager, data: [...shown].sort(comparePolicies).map((row) => serializePolicy(row, context)) });
    } catch (error) {
      sendError(response, error, "Could not load policies.");
    }
  });

  app.post("/api/policies", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const row = await prisma.policy.create({ data: { tenantId, ...(await readPolicy(prisma, tenantId, request.body)), createdBy: actor, updatedBy: actor } });
      response.status(201).json({ ok: true, data: serializePolicy(row, { assigned: new Map(), acked: new Map() }) });
    } catch (error) {
      sendError(response, error, "Could not save the policy.");
    }
  });

  app.get("/api/policies/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const manager = await canManage(prisma, request);
      const row = await prisma.policy.findFirst({ where: { id: request.params.id, tenantId, deletedAt: null } });
      if (!row || (!manager && row.status !== "published")) return notFound(response, "policy");
      const [versions, context] = await Promise.all([
        prisma.policyVersion.findMany({ where: { tenantId, policyId: row.id }, orderBy: { version: "desc" } }),
        ackContext(prisma, tenantId, userIdOf(request)),
      ]);
      const current = versions.find((version) => version.version === row.currentVersion) ?? null;
      const draft = row.draftJson && typeof row.draftJson === "object" ? row.draftJson : {};
      response.json({
        ok: true,
        data: {
          ...serializePolicy(row, context),
          canManage: manager,
          published: current
            ? {
                version: current.version,
                content: current.contentJson && typeof current.contentJson === "object" && current.contentJson.type === "doc" ? current.contentJson : null,
                attachment: attachmentInfo(current.attachmentJson),
                publishedAt: iso(current.publishedAt),
                publishedBy: current.publishedBy,
                changeNote: current.changeNote,
              }
            : null,
          draft: manager ? { content: draft.content ?? null, attachment: attachmentInfo(draft.attachment) } : null,
          history: versions.map((version) => ({
            version: version.version,
            publishedAt: iso(version.publishedAt),
            publishedBy: version.publishedBy,
            changeNote: version.changeNote,
            requireReack: version.requireReack,
          })),
        },
      });
    } catch (error) {
      sendError(response, error, "Could not load the policy.");
    }
  });

  /** The attached PDF of the published version (or the draft, for managers), as a data URL. */
  app.get("/api/policies/:id/attachment", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const manager = await canManage(prisma, request);
      const row = await prisma.policy.findFirst({ where: { id: request.params.id, tenantId, deletedAt: null } });
      if (!row || (!manager && row.status !== "published")) return notFound(response, "policy");
      let attachment = null;
      if (manager && request.query.draft === "1") {
        attachment = row.draftJson?.attachment ?? null;
      } else {
        const version = await prisma.policyVersion.findFirst({ where: { tenantId, policyId: row.id, version: row.currentVersion } });
        attachment = version?.attachmentJson?.dataUrl ? version.attachmentJson : null;
      }
      if (!attachment?.dataUrl) return notFound(response, "PDF");
      response.json({ ok: true, data: { name: text(attachment.name, 200), dataUrl: attachment.dataUrl } });
    } catch (error) {
      sendError(response, error, "Could not load the PDF.");
    }
  });

  app.patch("/api/policies/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const existing = await prisma.policy.findFirst({ where: { id: request.params.id, tenantId, deletedAt: null } });
      if (!existing) return notFound(response, "policy");
      const data = await readPolicy(prisma, tenantId, request.body);
      const keepAttachment = request.body?.keepAttachment === true && existing.draftJson?.attachment && !data.draftJson.attachment;
      if (keepAttachment) data.draftJson.attachment = existing.draftJson.attachment;
      const archived = request.body?.archived === true;
      const status = archived ? "archived" : existing.currentVersion > 0 ? "published" : "draft";
      await prisma.policy.updateMany({ where: { id: existing.id, tenantId }, data: { ...data, status, updatedBy: actorOf(request) } });
      const row = await prisma.policy.findFirst({ where: { id: existing.id, tenantId } });
      response.json({ ok: true, data: serializePolicy(row, await ackContext(prisma, tenantId, userIdOf(request))) });
    } catch (error) {
      sendError(response, error, "Could not save the policy.");
    }
  });

  app.delete("/api/policies/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.policy.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) return notFound(response, "policy");
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the policy.");
    }
  });

  /**
   * Publishes the draft as a new version. The first publish, and any republish not marked minor, makes everyone
   * acknowledge again. Publishing assigns the policy to everyone unless assignEveryone is false.
   */
  app.post("/api/policies/:id/publish", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const existing = await prisma.policy.findFirst({ where: { id: request.params.id, tenantId, deletedAt: null } });
      if (!existing) return notFound(response, "policy");
      const draft = existing.draftJson && typeof existing.draftJson === "object" ? existing.draftJson : {};
      const previous =
        existing.currentVersion > 0
          ? await prisma.policyVersion.findFirst({ where: { tenantId, policyId: existing.id, version: existing.currentVersion } })
          : null;
      const content = readContent(draft.content ?? null) ?? (previous?.contentJson?.type === "doc" ? previous.contentJson : null);
      const attachment = draft.attachment?.dataUrl ? draft.attachment : previous?.attachmentJson?.dataUrl ? previous.attachmentJson : null;
      const contentText = content ? contentTextOf(content) : "";
      if (!contentText && !attachment) throw new PublicError("Write the policy or attach a PDF before publishing.");
      const version = existing.currentVersion + 1;
      const requireReack = existing.currentVersion === 0 || request.body?.requireReack !== false;
      const actor = actorOf(request);
      const now = new Date();
      await prisma.policyVersion.create({
        data: {
          tenantId,
          policyId: existing.id,
          version,
          contentJson: content ?? {},
          contentText,
          attachmentJson: attachment ?? {},
          requireReack,
          changeNote: text(request.body?.changeNote, 500),
          publishedAt: now,
          publishedBy: await fullNameFor(prisma, tenantId, actor),
        },
      });
      await prisma.policy.updateMany({
        where: { id: existing.id, tenantId },
        data: {
          status: "published",
          currentVersion: version,
          ackVersion: requireReack ? version : existing.ackVersion,
          publishedAt: now,
          draftJson: {},
          updatedBy: actor,
        },
      });
      if (existing.requiresAck && request.body?.assignEveryone !== false) {
        await createAssignments(prisma, tenantId, [existing.id], { userIds: [""], dueDate: null }, { source: "publish", assignedBy: actor });
      }
      const row = await prisma.policy.findFirst({ where: { id: existing.id, tenantId } });
      response.json({ ok: true, data: serializePolicy(row, await ackContext(prisma, tenantId, userIdOf(request))) });
    } catch (error) {
      sendError(response, error, "Could not publish the policy.");
    }
  });

  app.post("/api/policies/:id/acknowledge", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    const userId = userIdOf(request);
    if (!userId) {
      response.status(400).json({ ok: false, message: "Sign in with a department account to acknowledge." });
      return;
    }
    try {
      const row = await prisma.policy.findFirst({ where: { id: request.params.id, tenantId, deletedAt: null, status: "published" } });
      if (!row) return notFound(response, "policy");
      if (!row.requiresAck || row.ackVersion < 1) throw new PublicError("This policy does not need an acknowledgment.");
      const already = await prisma.policyAcknowledgment.findFirst({ where: { tenantId, policyId: row.id, userId, version: row.ackVersion } });
      if (!already) {
        try {
          await prisma.policyAcknowledgment.create({
            data: { tenantId, policyId: row.id, version: row.ackVersion, userId, userName: await fullNameFor(prisma, tenantId, actorOf(request)) },
          });
        } catch (error) {
          if (error?.code !== "P2002") throw error;
        }
      }
      response.json({ ok: true, data: serializePolicy(row, await ackContext(prisma, tenantId, userId)) });
    } catch (error) {
      sendError(response, error, "Could not save the acknowledgment.");
    }
  });

  /** Everyone in the department and whether they have acknowledged the version that counts. */
  app.get("/api/policies/:id/status", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const row = await prisma.policy.findFirst({ where: { id: request.params.id, tenantId, deletedAt: null } });
      if (!row) return notFound(response, "policy");
      const [people, assignments, acks] = await Promise.all([
        usersOf(prisma, tenantId),
        prisma.policyAssignment.findMany({ where: { tenantId, policyId: row.id, deletedAt: null }, select: { userId: true, dueDate: true } }),
        prisma.policyAcknowledgment.findMany({ where: { tenantId, policyId: row.id }, select: { userId: true, version: true, acknowledgedAt: true } }),
      ]);
      const everyone = assignments.some((assignment) => assignment.userId === "");
      const assigned = new Set(assignments.map((assignment) => assignment.userId));
      const latest = new Map();
      for (const ack of acks) {
        const previous = latest.get(ack.userId);
        if (!previous || ack.version > previous.version) latest.set(ack.userId, ack);
      }
      response.json({
        ok: true,
        data: people.map((person) => {
          const ack = latest.get(person.id);
          const done = ack && ack.version >= row.ackVersion && row.ackVersion > 0;
          return {
            userId: person.id,
            name: person.name,
            assigned: everyone || assigned.has(person.id),
            status: done ? "Acknowledged" : everyone || assigned.has(person.id) ? "Pending" : "Not assigned",
            acknowledgedAt: done ? iso(ack.acknowledgedAt) : "",
            acknowledgedVersion: ack?.version ?? 0,
          };
        }),
      });
    } catch (error) {
      sendError(response, error, "Could not load who has acknowledged.");
    }
  });
}

