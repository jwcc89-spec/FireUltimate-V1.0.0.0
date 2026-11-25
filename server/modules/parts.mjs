/**
 * Parts inventory. Quantity on hand is the sum of a part's transactions: received (+), used on a
 * maintenance record (-) and adjusted (+/-). Adding a part needs maintenance.submit so whoever fills out
 * a ticket can add one; editing, receiving and adjusting stock need maintenance.manage.
 */
import { PublicError } from "../http/publicError.mjs";
import {
  actorOf,
  assertBelongsToTenant,
  sendError,
  tenantIdOf,
  text,
} from "./moduleHelpers.mjs";

const MAX_QUANTITY = 100_000;

function parseMoney(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 10_000_000) {
    throw new PublicError(`${label} must be a number of 0 or more.`);
  }
  return Math.round(number * 100) / 100;
}

function parseQuantity(value, label, { allowNegative = false } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number === 0 || Math.abs(number) > MAX_QUANTITY || (!allowNegative && number < 0)) {
    throw new PublicError(`${label} must be a whole number${allowNegative ? " other than 0" : " of 1 or more"}.`);
  }
  return number;
}

function partFields(body, { partial }) {
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
  const data = {};
  if (!partial || has("partNumber")) data.partNumber = text(body.partNumber, 120);
  if (!partial || has("description")) data.description = text(body.description, 300);
  if (!partial || has("vendorId")) data.vendorId = text(body.vendorId, 60) || null;
  if (!partial || has("unitCost")) data.unitCost = parseMoney(body.unitCost, "Unit Cost");
  if (!partial || has("reorderLevel")) {
    const level = Number(body.reorderLevel ?? 0);
    if (!Number.isInteger(level) || level < 0 || level > MAX_QUANTITY) throw new PublicError("Reorder At must be a whole number.");
    data.reorderLevel = level;
  }
  if (!partial || has("storageLocation")) data.storageLocation = text(body.storageLocation, 200);
  return data;
}

function serializePart(row, onHand) {
  return {
    id: row.id,
    partNumber: row.partNumber,
    description: row.description,
    vendorId: row.vendorId ?? "",
    vendorName: row.vendor?.name ?? "",
    unitCost: Number(row.unitCost ?? 0),
    reorderLevel: row.reorderLevel,
    storageLocation: row.storageLocation,
    onHand,
  };
}

function serializeTransaction(row) {
  return {
    id: row.id,
    partId: row.partId,
    kind: row.kind,
    quantity: row.quantity,
    unitCost: Number(row.unitCost ?? 0),
    recordId: row.recordId ?? "",
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  };
}

async function onHandByPart(prisma, tenantId) {
  const rows = await prisma.partTransaction.findMany({
    where: { tenantId, deletedAt: null },
    select: { partId: true, quantity: true },
  });
  const totals = new Map();
  for (const row of rows) totals.set(row.partId, (totals.get(row.partId) ?? 0) + row.quantity);
  return totals;
}

async function loadPart(prisma, tenantId, id) {
  const row = await prisma.part.findFirst({ where: { id, tenantId, deletedAt: null }, include: { vendor: { select: { name: true } } } });
  if (!row) return null;
  const totals = await onHandByPart(prisma, tenantId);
  return serializePart(row, totals.get(row.id) ?? 0);
}

/** Parts used on a maintenance record, from the request body: [{ partId, quantity }]. Null when not sent. */
export function cleanPartsUsed(raw) {
  if (!Array.isArray(raw)) return null;
  const byPart = new Map();
  for (const entry of raw.slice(0, 100)) {
    const partId = text(entry?.partId, 60);
    if (!partId) continue;
    const quantity = parseQuantity(entry?.quantity, "Each part quantity");
    byPart.set(partId, (byPart.get(partId) ?? 0) + quantity);
  }
  return Array.from(byPart, ([partId, quantity]) => ({ partId, quantity }));
}

/** Replaces a record's "used" stock rows. Run inside the record's transaction. */
export async function replaceRecordParts(tx, { tenantId, recordId, actor, partsUsed }) {
  const parts = partsUsed.length
    ? await tx.part.findMany({ where: { tenantId, deletedAt: null, id: { in: partsUsed.map((entry) => entry.partId) } } })
    : [];
  const partById = new Map(parts.map((part) => [part.id, part]));
  for (const entry of partsUsed) {
    if (!partById.has(entry.partId)) throw new PublicError("A part on this record was not found.");
  }
  const previous = await tx.partTransaction.findMany({
    where: { tenantId, recordId, kind: "used", deletedAt: null },
    select: { partId: true, unitCost: true },
  });
  const previousCost = new Map(previous.map((row) => [row.partId, row.unitCost]));
  await tx.partTransaction.updateMany({
    where: { tenantId, recordId, kind: "used", deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (partsUsed.length > 0) {
    await tx.partTransaction.createMany({
      data: partsUsed.map((entry) => ({
        tenantId,
        partId: entry.partId,
        kind: "used",
        quantity: -entry.quantity,
        unitCost: previousCost.get(entry.partId) ?? partById.get(entry.partId).unitCost,
        recordId,
        createdBy: actor,
      })),
    });
  }
}

/** Parts used on a record, for the record detail. */
export async function loadRecordParts(prisma, tenantId, recordId) {
  const rows = await prisma.partTransaction.findMany({
    where: { tenantId, recordId, kind: "used", deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) return [];
  const parts = await prisma.part.findMany({ where: { tenantId, id: { in: rows.map((row) => row.partId) } } });
  const partById = new Map(parts.map((part) => [part.id, part]));
  return rows.map((row) => ({
    partId: row.partId,
    partNumber: partById.get(row.partId)?.partNumber ?? "",
    description: partById.get(row.partId)?.description ?? "",
    quantity: -row.quantity,
    unitCost: Number(row.unitCost ?? 0),
  }));
}

export function register(app, prisma) {
  app.get("/api/maintenance/parts", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const rows = await prisma.part.findMany({
        where: { tenantId, deletedAt: null },
        include: { vendor: { select: { name: true } } },
        orderBy: { partNumber: "asc" },
      });
      const totals = await onHandByPart(prisma, tenantId);
      response.json({ ok: true, data: rows.map((row) => serializePart(row, totals.get(row.id) ?? 0)) });
    } catch (error) {
      sendError(response, error, "Could not load parts.");
    }
  });

  app.get("/api/maintenance/parts/transactions", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const rows = await prisma.partTransaction.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      response.json({ ok: true, data: rows.map(serializeTransaction) });
    } catch (error) {
      sendError(response, error, "Could not load part history.");
    }
  });

  app.post("/api/maintenance/parts", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const data = partFields(request.body ?? {}, { partial: false });
      if (!data.partNumber && !data.description) throw new PublicError("Enter a part number or description.");
      await assertBelongsToTenant(prisma, "vendor", data.vendorId, tenantId, "The vendor");
      const row = await prisma.part.create({ data: { ...data, tenantId, createdBy: actor, updatedBy: actor } });
      response.status(201).json({ ok: true, data: await loadPart(prisma, tenantId, row.id) });
    } catch (error) {
      sendError(response, error, "Could not save the part.");
    }
  });

  app.patch("/api/maintenance/parts/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const data = partFields(request.body ?? {}, { partial: true });
      if (data.vendorId) await assertBelongsToTenant(prisma, "vendor", data.vendorId, tenantId, "The vendor");
      const result = await prisma.part.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { ...data, updatedBy: actorOf(request) },
      });
      if (result.count === 0) {
        response.status(404).json({ ok: false, message: "That part was not found." });
        return;
      }
      response.json({ ok: true, data: await loadPart(prisma, tenantId, request.params.id) });
    } catch (error) {
      sendError(response, error, "Could not save the part.");
    }
  });

  app.delete("/api/maintenance/parts/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.part.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) {
        response.status(404).json({ ok: false, message: "That part was not found." });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the part.");
    }
  });

  app.post("/api/maintenance/parts/:id/stock", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const body = request.body ?? {};
      const kind = body.kind === "adjusted" ? "adjusted" : "received";
      const quantity = parseQuantity(body.quantity, "Quantity", { allowNegative: kind === "adjusted" });
      const part = await prisma.part.findFirst({ where: { id: request.params.id, tenantId, deletedAt: null } });
      if (!part) {
        response.status(404).json({ ok: false, message: "That part was not found." });
        return;
      }
      const actor = actorOf(request);
      const unitCost = kind === "received" && body.unitCost !== undefined && body.unitCost !== "" ? parseMoney(body.unitCost, "Unit Cost") : Number(part.unitCost ?? 0);
      await prisma.$transaction(async (tx) => {
        await tx.partTransaction.create({
          data: { tenantId, partId: part.id, kind, quantity, unitCost, note: text(body.note, 300), createdBy: actor },
        });
        if (kind === "received" && unitCost !== Number(part.unitCost ?? 0)) {
          await tx.part.updateMany({ where: { id: part.id, tenantId }, data: { unitCost, updatedBy: actor } });
        }
      });
      response.status(201).json({ ok: true, data: await loadPart(prisma, tenantId, part.id) });
    } catch (error) {
      sendError(response, error, "Could not update stock.");
    }
  });
}
