/**
 * Pre-plans for properties: Basic and Complex templates, every field optional.
 * The field answers live in detailsJson as { fieldId: "text" } so fields can be added without a database change.
 * Reading needs incidents.view; adding, editing and deleting need prevention.manage. Every query filters on tenant.
 */
import { PublicError } from "../http/publicError.mjs";
import {
  actorOf,
  detailsOf,
  formatDateOnly,
  oneOf,
  parseDateOnly,
  sendError,
  tenantIdOf,
  text,
} from "./moduleHelpers.mjs";

const TEMPLATES = ["basic", "complex"];
const MAX_FIELDS = 200;
const MAX_FIELD_CHARS = 4000;

function stamp(value) {
  return value instanceof Date ? value.toISOString() : "";
}

export function cleanAnswers(raw) {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) throw new PublicError("Pre-plan answers are not valid.");
  const answers = {};
  for (const [key, value] of Object.entries(raw).slice(0, MAX_FIELDS)) {
    if (!/^[A-Za-z0-9_]{1,60}$/.test(key)) continue;
    const cleaned = text(value, MAX_FIELD_CHARS);
    if (cleaned) answers[key] = cleaned;
  }
  return answers;
}

function serialize(row, property) {
  const details = detailsOf(row);
  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyName: property?.name ?? "",
    propertyAddress: property?.address ?? "",
    propertyType: property?.propertyType ?? "",
    title: row.title,
    template: row.template,
    reviewedOn: formatDateOnly(row.reviewedOn),
    answers: details.answers && typeof details.answers === "object" ? details.answers : {},
    updatedAt: stamp(row.updatedAt),
    updatedBy: row.updatedBy,
  };
}

function fields(body, partial) {
  const has = (key) => !partial || Object.prototype.hasOwnProperty.call(body ?? {}, key);
  const data = {};
  if (has("title")) data.title = text(body.title, 200) || "Pre-Plan";
  if (has("template")) data.template = oneOf(body.template, TEMPLATES, "basic");
  if (has("reviewedOn")) data.reviewedOn = parseDateOnly(body.reviewedOn, "Last reviewed");
  if (has("answers")) data.detailsJson = { answers: cleanAnswers(body.answers) };
  return data;
}

async function propertyFor(prisma, tenantId, propertyId) {
  return prisma.property.findFirst({
    where: { id: propertyId, tenantId, deletedAt: null },
    select: { id: true, name: true, address: true, propertyType: true },
  });
}

export function register(app, prisma) {
  app.get("/api/prevention/preplans", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const rows = await prisma.prePlan.findMany({ where: { tenantId, deletedAt: null } });
      const properties = await prisma.property.findMany({
        where: { tenantId, deletedAt: null, id: { in: [...new Set(rows.map((row) => row.propertyId))] } },
        select: { id: true, name: true, address: true, propertyType: true },
      });
      const byId = new Map(properties.map((row) => [row.id, row]));
      const data = rows
        .filter((row) => byId.has(row.propertyId))
        .map((row) => {
          const item = serialize(row, byId.get(row.propertyId));
          delete item.answers;
          return item;
        });
      response.json({ ok: true, data });
    } catch (error) {
      sendError(response, error, "Could not load pre-plans.");
    }
  });

  app.get("/api/prevention/preplans/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const row = await prisma.prePlan.findFirst({ where: { id: request.params.id, tenantId, deletedAt: null } });
      const property = row ? await propertyFor(prisma, tenantId, row.propertyId) : null;
      if (!row || !property) {
        response.status(404).json({ ok: false, message: "That pre-plan was not found." });
        return;
      }
      response.json({ ok: true, data: serialize(row, property) });
    } catch (error) {
      sendError(response, error, "Could not load the pre-plan.");
    }
  });

  app.post("/api/prevention/properties/:id/preplans", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const property = await propertyFor(prisma, tenantId, request.params.id);
      if (!property) {
        response.status(404).json({ ok: false, message: "That property was not found." });
        return;
      }
      const actor = actorOf(request);
      const created = await prisma.prePlan.create({
        data: { ...fields(request.body ?? {}, false), tenantId, propertyId: property.id, createdBy: actor, updatedBy: actor },
      });
      response.status(201).json({ ok: true, data: serialize(created, property) });
    } catch (error) {
      sendError(response, error, "Could not save the pre-plan.");
    }
  });

  app.patch("/api/prevention/preplans/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const current = await prisma.prePlan.findFirst({ where: { id: request.params.id, tenantId, deletedAt: null } });
      const property = current ? await propertyFor(prisma, tenantId, current.propertyId) : null;
      if (!current || !property) {
        response.status(404).json({ ok: false, message: "That pre-plan was not found." });
        return;
      }
      await prisma.prePlan.updateMany({
        where: { id: current.id, tenantId, deletedAt: null },
        data: { ...fields(request.body ?? {}, true), updatedBy: actorOf(request) },
      });
      const row = await prisma.prePlan.findFirst({ where: { id: current.id, tenantId } });
      response.json({ ok: true, data: serialize(row, property) });
    } catch (error) {
      sendError(response, error, "Could not save the pre-plan.");
    }
  });

  app.delete("/api/prevention/preplans/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.prePlan.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) {
        response.status(404).json({ ok: false, message: "That pre-plan was not found." });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the pre-plan.");
    }
  });
}
