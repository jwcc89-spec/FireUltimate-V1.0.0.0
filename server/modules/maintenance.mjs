/**
 * Apparatus and equipment maintenance: records, types, vendors, PM schedules and the equipment registry.
 * Reads are open to any signed-in member of the department. Writes are mapped in permissionForRequest;
 * closing, reopening or changing someone else's record also needs maintenance.manage (checked here).
 */
import { PublicError } from "../http/publicError.mjs";
import { DEFAULT_MAINTENANCE_TYPES } from "./maintenanceDefaults.mjs";
import {
  actorOf,
  assertBelongsToTenant,
  canManage,
  decimalOrNull,
  detailsOf,
  formatDateOnly,
  fullNameFor,
  isUniqueViolation,
  oneOf,
  parseDateOnly,
  parseDecimal,
  sendError,
  tenantIdOf,
  text,
} from "./moduleHelpers.mjs";

const OPEN_STATUSES = ["Open", "Assigned", "In Progress", "Parts Ordered"];
const CLOSED_STATUSES = ["Completed", "Cancelled"];
const RECORD_STATUSES = [...OPEN_STATUSES, ...CLOSED_STATUSES];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const ASSET_KINDS = ["apparatus", "equipment"];
const PERFORMED_BY_KINDS = ["personnel", "vendor"];
const TYPE_CATEGORIES = ["Preventive", "Corrective"];
const FREQUENCIES = ["", "Weekly", "Monthly", "Quarterly", "Semi-Annual", "Annual", "5 Years"];
const EQUIPMENT_STATUSES = ["In Service", "Out of Service", "Retired"];
const COMMENT_OWNER_TYPE = "maintenanceRecord";
const MAX_ATTACHMENT_CHARS = 2_000_000;
const MAX_ATTACHMENTS_TOTAL_CHARS = 3_000_000;

const PM_BASES = ["date", "engineHours", "pumpHours", "mileage"];
const FREQUENCY_MONTHS = { Monthly: 1, Quarterly: 3, "Semi-Annual": 6, Annual: 12, "5 Years": 60 };

function addFrequency(date, frequency) {
  const next = new Date(date.getTime());
  if (frequency === "Weekly") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + (FREQUENCY_MONTHS[frequency] ?? 12));
  return next;
}

/** PM tasks the person completing a ticket checked as done: [{ scheduleId, reading }]. */
function cleanPmPerformed(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const rows = [];
  for (const entry of raw.slice(0, 50)) {
    const scheduleId = text(entry?.scheduleId, 60);
    if (!scheduleId || seen.has(scheduleId)) continue;
    seen.add(scheduleId);
    rows.push({ scheduleId, reading: parseDecimal(entry?.reading, "The PM reading") });
  }
  return rows;
}

/**
 * Resets the PM tasks checked on a ticket that just became Completed. Reading-based tasks take the
 * reading typed on the PM line, or else the ticket's reading for that meter.
 */
async function applyPmPerformed(tx, { tenantId, actor, assetRefs, pmPerformed, readings, completedDate }) {
  for (const entry of pmPerformed) {
    const schedule = await tx.pmSchedule.findFirst({
      where: { id: entry.scheduleId, tenantId, deletedAt: null },
    });
    if (!schedule || (schedule.assetRef && !assetRefs.includes(schedule.assetRef))) continue;
    const data = { lastServiceDate: completedDate, updatedBy: actor };
    if (schedule.trackingBasis === "date") {
      data.nextDueAt = addFrequency(completedDate, schedule.frequency);
    } else {
      const reading = entry.reading ?? readings[schedule.trackingBasis] ?? null;
      if (reading === null) {
        throw new PublicError(`Enter the reading for the PM task "${schedule.name}" before completing.`);
      }
      data.lastServiceReading = reading;
    }
    await tx.pmSchedule.updateMany({ where: { id: schedule.id, tenantId }, data });
  }
}

const READING_FIELDS = [
  ["mileage", "Mileage"],
  ["engineHours", "Engine Hours"],
  ["pumpHours", "Pump Hours"],
];

/** Odometer and hour meter readings: { mileage, engineHours, pumpHours }, each a number or null. */
function cleanReadings(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const readings = {};
  for (const [key, label] of READING_FIELDS) {
    const value = source[key];
    if (value === null || value === undefined || String(value).trim() === "") {
      readings[key] = null;
      continue;
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 10_000_000) {
      throw new PublicError(`${label} must be a number of 0 or more.`);
    }
    readings[key] = Math.round(number * 10) / 10;
  }
  return readings;
}

export function readingsOf(details) {
  return cleanReadings(details.readings);
}

function missingReadingsError(assetKind, readings) {
  if (assetKind !== "apparatus") return null;
  if (readings.mileage === null || readings.engineHours === null) {
    return "Enter the Mileage and Engine Hours before completing this record.";
  }
  return null;
}

function parseTimestamp(value, label) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new PublicError(`${label} must be a date and time.`);
  return date.toISOString();
}

// ----- Records -----

function cleanAssets(raw, assetKind) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const assets = [];
  for (const entry of raw.slice(0, 50)) {
    const ref = text(entry?.ref, 200);
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    assets.push({ kind: assetKind, ref, label: text(entry?.label, 200) || ref });
  }
  return assets;
}

function cleanAttachments(raw, previous, actor) {
  if (!Array.isArray(raw)) return previous;
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const attachments = [];
  let total = 0;
  for (const entry of raw.slice(0, 20)) {
    const kept = entry?.id ? previousById.get(String(entry.id)) : null;
    if (kept) {
      attachments.push(kept);
      total += kept.dataUrl.length;
      continue;
    }
    const dataUrl = String(entry?.dataUrl ?? "");
    if (!dataUrl.startsWith("data:")) continue;
    if (dataUrl.length > MAX_ATTACHMENT_CHARS) {
      throw new PublicError("Each attachment must be smaller than about 1.5 MB for now.");
    }
    total += dataUrl.length;
    attachments.push({
      id: `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: text(entry?.name, 200) || "Attachment",
      type: text(entry?.type, 100),
      size: Number(entry?.size) || 0,
      dataUrl,
      addedBy: actor,
      addedAt: new Date().toISOString(),
    });
  }
  if (total > MAX_ATTACHMENTS_TOTAL_CHARS) {
    throw new PublicError("Attachments on one record must total less than about 2 MB for now.");
  }
  return attachments;
}

function cleanCosts(raw) {
  if (!Array.isArray(raw)) return null;
  return raw.slice(0, 100).map((entry) => {
    const amount = Number(entry?.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) {
      throw new PublicError("Each cost amount must be a number of 0 or more.");
    }
    return {
      description: text(entry?.description, 300),
      amount: Math.round(amount * 100) / 100,
      vendorId: text(entry?.vendorId, 60) || null,
    };
  });
}

function serializeRecord(row, { includeDetail = false } = {}) {
  const details = detailsOf(row);
  const attachments = Array.isArray(details.attachments) ? details.attachments : [];
  const costs = (row.costs ?? []).filter((cost) => !cost.deletedAt);
  const base = {
    id: row.id,
    recordNumber: row.recordNumber,
    assetKind: row.assetKind,
    assetRef: row.assetRef,
    assets: Array.isArray(details.assets) ? details.assets : [],
    typeId: row.typeId ?? "",
    typeName: row.type?.name ?? "",
    typeCategory: row.type?.category ?? "",
    nfpaStandard: row.type?.nfpaStandard ?? "",
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: formatDateOnly(row.dueDate),
    completedDate: formatDateOnly(row.completedDate),
    performedByKind: row.performedByKind,
    performedByName: row.performedByName,
    vendorId: row.vendorId ?? "",
    vendorName: row.vendor?.name ?? "",
    outOfService: row.outOfService,
    outOfServiceAt: text(details.outOfServiceAt, 40),
    completedAt: text(details.completedAt, 40),
    assignedTo: text(details.assignedTo, 200),
    readings: readingsOf(details),
    pmPerformed: cleanPmPerformed(details.pmPerformed),
    location: text(details.location, 200),
    locationDetails: text(details.locationDetails, 300),
    costTotal: costs.reduce((sum, cost) => sum + Number(cost.amount), 0),
    costLines: costs.map((cost) => ({ amount: Number(cost.amount), vendorId: cost.vendorId ?? "" })),
    attachmentCount: attachments.length,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  };
  if (!includeDetail) return base;
  return {
    ...base,
    costs: costs.map((cost) => ({
      id: cost.id,
      description: cost.description,
      amount: Number(cost.amount),
      vendorId: cost.vendorId ?? "",
    })),
    attachments,
  };
}

const RECORD_INCLUDE = {
  type: { select: { name: true, category: true, nfpaStandard: true } },
  vendor: { select: { name: true } },
  costs: { where: { deletedAt: null }, select: { id: true, amount: true, description: true, vendorId: true, deletedAt: true } },
};

async function nextRecordNumber(prisma, tenantId) {
  const prefix = `${String(new Date().getUTCFullYear()).slice(-2)}-`;
  const last = await prisma.maintenanceRecord.findFirst({
    where: { tenantId, recordNumber: { startsWith: prefix } },
    orderBy: { recordNumber: "desc" },
    select: { recordNumber: true },
  });
  const lastNumber = last ? Number.parseInt(last.recordNumber.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

function closeRequirementsError(status, performedByKind, performedByName, vendorId) {
  if (status !== "Completed") return null;
  if (performedByKind === "vendor" ? !vendorId : !performedByName) {
    return "Enter who performed the work before completing this record.";
  }
  return null;
}

async function loadCommentsFor(prisma, tenantId, recordId) {
  const rows = await prisma.comment.findMany({
    where: { tenantId, ownerType: COMMENT_OWNER_TYPE, ownerId: recordId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    authorName: row.authorName,
    createdAt: row.createdAt.toISOString(),
  }));
}

function registerRecordRoutes(app, prisma) {
  app.get("/api/maintenance/records", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const assetKind = ASSET_KINDS.includes(String(request.query.assetKind)) ? String(request.query.assetKind) : null;
      const rows = await prisma.maintenanceRecord.findMany({
        where: { tenantId, deletedAt: null, ...(assetKind ? { assetKind } : {}) },
        include: RECORD_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
      response.json({ ok: true, data: rows.map((row) => serializeRecord(row)) });
    } catch (error) {
      sendError(response, error, "Could not load maintenance records.");
    }
  });

  /**
   * Current status of each apparatus, worked out from maintenance records: out of service while an open
   * record is marked Out of Service. Display boards and dashboards should read status from here.
   */
  app.get("/api/maintenance/apparatus-status", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const rows = await prisma.maintenanceRecord.findMany({
        where: { tenantId, deletedAt: null, assetKind: "apparatus" },
        include: { type: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      const units = new Map();
      const unitFor = (ref) => {
        if (!units.has(ref)) {
          units.set(ref, {
            unitId: ref,
            status: "In Service",
            outOfServiceSince: "",
            outOfServiceRecordId: "",
            outOfServiceRecordNumber: "",
            outOfServiceReason: "",
            openRecords: 0,
            openDeficiencies: 0,
            readings: { mileage: null, engineHours: null, pumpHours: null, recordedAt: "" },
          });
        }
        return units.get(ref);
      };
      const applyReadings = (unit, readings, readAt) => {
        for (const key of ["mileage", "engineHours", "pumpHours"]) {
          const timeKey = `${key}At`;
          if (readings[key] !== null && readAt >= (unit.readings[timeKey] ?? "")) {
            unit.readings[key] = readings[key];
            unit.readings[timeKey] = readAt;
            if (readAt > unit.readings.recordedAt) unit.readings.recordedAt = readAt;
          }
        }
      };
      for (const row of rows) {
        const details = detailsOf(row);
        const refs = (Array.isArray(details.assets) ? details.assets : []).map((asset) => text(asset?.ref, 200)).filter(Boolean);
        const open = OPEN_STATUSES.includes(row.status);
        const readings = readingsOf(details);
        const readAt = text(details.completedAt, 40) || row.updatedAt.toISOString();
        for (const ref of refs) {
          const unit = unitFor(ref);
          if (open) {
            unit.openRecords += 1;
            if (row.type?.name === "Deficiency") unit.openDeficiencies += 1;
            if (row.outOfService) {
              const since = text(details.outOfServiceAt, 40) || row.createdAt.toISOString();
              if (!unit.outOfServiceSince || since < unit.outOfServiceSince) {
                unit.status = "Out of Service";
                unit.outOfServiceSince = since;
                unit.outOfServiceRecordId = row.id;
                unit.outOfServiceRecordNumber = row.recordNumber;
                unit.outOfServiceReason = text(row.description, 200);
              }
            }
          }
          applyReadings(unit, readings, readAt);
        }
      }
      const inspections = await prisma.checklistSubmission.findMany({
        where: { tenantId, deletedAt: null, subjectKind: "apparatus" },
        select: { subjectRef: true, detailsJson: true, createdAt: true },
      });
      for (const inspection of inspections) {
        const ref = text(inspection.subjectRef, 200);
        if (ref) applyReadings(unitFor(ref), readingsOf(detailsOf(inspection)), inspection.createdAt.toISOString());
      }
      const data = Array.from(units.values()).map((unit) => ({
        ...unit,
        readings: {
          mileage: unit.readings.mileage,
          engineHours: unit.readings.engineHours,
          pumpHours: unit.readings.pumpHours,
          recordedAt: unit.readings.recordedAt,
        },
      }));
      response.json({ ok: true, data });
    } catch (error) {
      sendError(response, error, "Could not load apparatus status.");
    }
  });

  app.get("/api/maintenance/records/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const row = await prisma.maintenanceRecord.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
        include: RECORD_INCLUDE,
      });
      if (!row) {
        response.status(404).json({ ok: false, message: "Maintenance record not found." });
        return;
      }
      const comments = await loadCommentsFor(prisma, tenantId, row.id);
      response.json({ ok: true, data: { ...serializeRecord(row, { includeDetail: true }), comments } });
    } catch (error) {
      sendError(response, error, "Could not load the maintenance record.");
    }
  });

  app.post("/api/maintenance/records", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const body = request.body ?? {};
      const actor = actorOf(request);
      const assetKind = oneOf(body.assetKind, ASSET_KINDS, "apparatus");
      const status = oneOf(body.status, RECORD_STATUSES, "Open");
      if (CLOSED_STATUSES.includes(status) && !(await canManage(prisma, request))) {
        response.status(403).json({ ok: false, code: "FORBIDDEN", message: "Only people who manage maintenance can close a record." });
        return;
      }
      const typeId = text(body.typeId, 60) || null;
      const vendorId = text(body.vendorId, 60) || null;
      await assertBelongsToTenant(prisma, "maintenanceType", typeId, tenantId, "The category");
      await assertBelongsToTenant(prisma, "vendor", vendorId, tenantId, "The vendor");
      const assets = cleanAssets(body.assets, assetKind);
      const costs = cleanCosts(body.costs) ?? [];
      for (const cost of costs) await assertBelongsToTenant(prisma, "vendor", cost.vendorId, tenantId, "The cost vendor");
      const performedByKind = oneOf(body.performedByKind, PERFORMED_BY_KINDS, "personnel");
      const performedByName = text(body.performedByName, 200);
      const closeError = closeRequirementsError(status, performedByKind, performedByName, vendorId);
      if (closeError) throw new PublicError(closeError);
      const completing = status === "Completed";
      const readings = cleanReadings(body.readings);
      const readingsError = completing ? missingReadingsError(assetKind, readings) : null;
      if (readingsError) throw new PublicError(readingsError);
      const completedDate = completing
        ? parseDateOnly(body.completedDate, "Completed Date") ?? parseDateOnly(new Date().toISOString().slice(0, 10), "Completed Date")
        : null;
      const outOfService = body.outOfService === true;
      const details = {
        assets,
        assignedTo: text(body.assignedTo, 200),
        readings,
        pmPerformed: cleanPmPerformed(body.pmPerformed),
        outOfServiceAt: outOfService ? parseTimestamp(body.outOfServiceAt, "Taken Out of Service") || new Date().toISOString() : "",
        completedAt: completing ? new Date().toISOString() : "",
        location: text(body.location, 200),
        locationDetails: text(body.locationDetails, 300),
        attachments: cleanAttachments(body.attachments, [], actor),
      };

      let created = null;
      for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
        const recordNumber = await nextRecordNumber(prisma, tenantId);
        try {
          created = await prisma.$transaction(async (tx) => {
            const row = await tx.maintenanceRecord.create({
            data: {
              tenantId,
              recordNumber,
              assetKind,
              assetRef: assets[0]?.ref ?? "",
              typeId,
              description: text(body.description, 4000),
              status,
              priority: oneOf(body.priority, PRIORITIES, "Medium"),
              dueDate: parseDateOnly(body.dueDate, "Due Date"),
              completedDate,
              performedByKind,
              performedByName,
              vendorId,
              outOfService,
              detailsJson: details,
              createdBy: actor,
              updatedBy: actor,
              costs: {
                create: costs.map((cost) => ({ ...cost, tenantId, createdBy: actor, updatedBy: actor })),
              },
            },
            include: RECORD_INCLUDE,
            });
            if (completing) {
              await applyPmPerformed(tx, {
                tenantId,
                actor,
                assetRefs: assets.map((asset) => asset.ref),
                pmPerformed: details.pmPerformed,
                readings,
                completedDate,
              });
            }
            return row;
          });
        } catch (error) {
          if (!isUniqueViolation(error) || attempt === 2) throw error;
        }
      }
      response.status(201).json({ ok: true, data: { ...serializeRecord(created, { includeDetail: true }), comments: [] } });
    } catch (error) {
      sendError(response, error, "Could not save the maintenance record.");
    }
  });

  app.patch("/api/maintenance/records/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const body = request.body ?? {};
      const actor = actorOf(request);
      const existing = await prisma.maintenanceRecord.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
      });
      if (!existing) {
        response.status(404).json({ ok: false, message: "Maintenance record not found." });
        return;
      }
      const status = body.status === undefined ? existing.status : oneOf(body.status, RECORD_STATUSES, existing.status);
      const wasClosed = CLOSED_STATUSES.includes(existing.status);
      const closing = CLOSED_STATUSES.includes(status) && status !== existing.status;
      const completingNow = status === "Completed" && existing.status !== "Completed";
      const ownRecord = existing.createdBy === actor;
      if ((wasClosed || closing || !ownRecord) && !(await canManage(prisma, request))) {
        response.status(403).json({
          ok: false,
          code: "FORBIDDEN",
          message: "Only people who manage maintenance can close or reopen a record, or change someone else's record. You can still add a comment.",
        });
        return;
      }

      const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
      const previousDetails = detailsOf(existing);
      const data = { status, updatedBy: actor };
      if (has("typeId")) {
        data.typeId = text(body.typeId, 60) || null;
        await assertBelongsToTenant(prisma, "maintenanceType", data.typeId, tenantId, "The category");
      }
      if (has("vendorId")) {
        data.vendorId = text(body.vendorId, 60) || null;
        await assertBelongsToTenant(prisma, "vendor", data.vendorId, tenantId, "The vendor");
      }
      if (has("description")) data.description = text(body.description, 4000);
      if (has("priority")) data.priority = oneOf(body.priority, PRIORITIES, existing.priority);
      if (has("dueDate")) data.dueDate = parseDateOnly(body.dueDate, "Due Date");
      if (has("completedDate")) data.completedDate = parseDateOnly(body.completedDate, "Completed Date");
      if (has("performedByKind")) data.performedByKind = oneOf(body.performedByKind, PERFORMED_BY_KINDS, existing.performedByKind);
      if (has("performedByName")) data.performedByName = text(body.performedByName, 200);
      if (has("outOfService")) data.outOfService = body.outOfService === true;

      const nextDetails = { ...previousDetails };
      if (has("assets")) {
        nextDetails.assets = cleanAssets(body.assets, existing.assetKind);
        data.assetRef = nextDetails.assets[0]?.ref ?? "";
      }
      if (has("assignedTo")) nextDetails.assignedTo = text(body.assignedTo, 200);
      if (has("readings")) nextDetails.readings = cleanReadings(body.readings);
      if (has("pmPerformed")) nextDetails.pmPerformed = cleanPmPerformed(body.pmPerformed);
      if (completingNow) {
        const readingsError = missingReadingsError(existing.assetKind, readingsOf(nextDetails));
        if (readingsError) throw new PublicError(readingsError);
      }
      if (has("outOfServiceAt")) nextDetails.outOfServiceAt = parseTimestamp(body.outOfServiceAt, "Taken Out of Service");
      const outOfService = data.outOfService ?? existing.outOfService;
      if (outOfService && !nextDetails.outOfServiceAt) nextDetails.outOfServiceAt = new Date().toISOString();
      if (!outOfService && has("outOfService")) nextDetails.outOfServiceAt = "";
      if (completingNow) {
        nextDetails.completedAt = new Date().toISOString();
        data.completedDate =
          parseDateOnly(body.completedDate, "Completed Date") ??
          parseDateOnly(new Date().toISOString().slice(0, 10), "Completed Date");
      } else if (wasClosed && OPEN_STATUSES.includes(status)) {
        nextDetails.completedAt = "";
        data.completedDate = null;
      }
      if (has("location")) nextDetails.location = text(body.location, 200);
      if (has("locationDetails")) nextDetails.locationDetails = text(body.locationDetails, 300);
      if (has("attachments")) {
        const previousAttachments = Array.isArray(previousDetails.attachments) ? previousDetails.attachments : [];
        nextDetails.attachments = cleanAttachments(body.attachments, previousAttachments, actor);
      }
      data.detailsJson = nextDetails;

      const closeError = closeRequirementsError(
        status,
        data.performedByKind ?? existing.performedByKind,
        data.performedByName ?? existing.performedByName,
        data.vendorId === undefined ? existing.vendorId : data.vendorId,
      );
      if (closeError) throw new PublicError(closeError);

      const costs = cleanCosts(body.costs);
      if (costs) {
        for (const cost of costs) await assertBelongsToTenant(prisma, "vendor", cost.vendorId, tenantId, "The cost vendor");
      }
      const now = new Date();
      const updated = await prisma.$transaction(async (tx) => {
        if (costs) {
          await tx.maintenanceCost.updateMany({
            where: { tenantId, recordId: existing.id, deletedAt: null },
            data: { deletedAt: now, updatedBy: actor },
          });
          if (costs.length > 0) {
            await tx.maintenanceCost.createMany({
              data: costs.map((cost) => ({ ...cost, tenantId, recordId: existing.id, createdBy: actor, updatedBy: actor })),
            });
          }
        }
        await tx.maintenanceRecord.updateMany({ where: { id: existing.id, tenantId }, data });
        if (completingNow) {
          await applyPmPerformed(tx, {
            tenantId,
            actor,
            assetRefs: [
              data.assetRef ?? existing.assetRef,
              ...(Array.isArray(nextDetails.assets) ? nextDetails.assets.map((asset) => asset?.ref) : []),
            ].filter(Boolean),
            pmPerformed: cleanPmPerformed(nextDetails.pmPerformed),
            readings: readingsOf(nextDetails),
            completedDate: data.completedDate,
          });
        }
        return tx.maintenanceRecord.findFirst({ where: { id: existing.id, tenantId }, include: RECORD_INCLUDE });
      });
      const comments = await loadCommentsFor(prisma, tenantId, existing.id);
      response.json({ ok: true, data: { ...serializeRecord(updated, { includeDetail: true }), comments } });
    } catch (error) {
      sendError(response, error, "Could not save the maintenance record.");
    }
  });

  app.delete("/api/maintenance/records/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.maintenanceRecord.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) {
        response.status(404).json({ ok: false, message: "Maintenance record not found." });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the maintenance record.");
    }
  });

  app.post("/api/maintenance/records/:id/comments", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const body = text(request.body?.body, 4000);
      if (!body) throw new PublicError("Type a comment first.");
      const record = await prisma.maintenanceRecord.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!record) {
        response.status(404).json({ ok: false, message: "Maintenance record not found." });
        return;
      }
      const username = actorOf(request);
      const row = await prisma.comment.create({
        data: {
          tenantId,
          ownerType: COMMENT_OWNER_TYPE,
          ownerId: record.id,
          body,
          authorUserId: request.auth?.userId ?? null,
          authorName: await fullNameFor(prisma, tenantId, username),
        },
      });
      response.status(201).json({
        ok: true,
        data: { id: row.id, body: row.body, authorName: row.authorName, createdAt: row.createdAt.toISOString() },
      });
    } catch (error) {
      sendError(response, error, "Could not save the comment.");
    }
  });
}

// ----- Types -----

function serializeType(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    nfpaStandard: row.nfpaStandard,
    defaultFrequency: row.defaultFrequency,
    description: row.description,
    isSystem: row.isSystem,
    enabled: row.enabled,
  };
}

/** Adds any default type the department doesn't have a row for yet, so new defaults reach existing departments. */
async function ensureDefaultTypes(prisma, tenantId) {
  const existing = await prisma.maintenanceType.findMany({ where: { tenantId }, select: { name: true } });
  const names = new Set(existing.map((row) => row.name.trim().toLowerCase()));
  const missing = DEFAULT_MAINTENANCE_TYPES.filter((item) => !names.has(item.name.toLowerCase()));
  if (missing.length === 0) return;
  await prisma.maintenanceType.createMany({
    data: missing.map((item) => ({
      tenantId,
      name: item.name,
      category: item.category,
      nfpaStandard: item.nfpaStandard ?? "",
      defaultFrequency: item.defaultFrequency ?? "",
      description: item.description ?? "",
      isSystem: true,
      enabled: true,
      createdBy: "system",
      updatedBy: "system",
    })),
    skipDuplicates: true,
  });
}

function typeFieldsFrom(body, { allowName }) {
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
  const data = {};
  if (allowName && has("name")) data.name = text(body.name, 120);
  if (has("category")) data.category = oneOf(body.category, TYPE_CATEGORIES, "Preventive");
  if (has("nfpaStandard")) data.nfpaStandard = text(body.nfpaStandard, 60);
  if (has("defaultFrequency")) data.defaultFrequency = oneOf(body.defaultFrequency, FREQUENCIES, "");
  if (has("description")) data.description = text(body.description, 300);
  if (has("enabled")) data.enabled = body.enabled === true;
  return data;
}

function registerTypeRoutes(app, prisma) {
  app.get("/api/maintenance/types", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      await ensureDefaultTypes(prisma, tenantId);
      const rows = await prisma.maintenanceType.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: [{ category: "desc" }, { name: "asc" }],
      });
      response.json({ ok: true, data: rows.map(serializeType) });
    } catch (error) {
      sendError(response, error, "Could not load maintenance types.");
    }
  });

  app.post("/api/maintenance/types", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const data = typeFieldsFrom(request.body ?? {}, { allowName: true });
      if (!data.name) throw new PublicError("Enter a name for the type.");
      const previous = await prisma.maintenanceType.findFirst({ where: { tenantId, name: data.name } });
      if (previous && !previous.deletedAt) {
        response.status(409).json({ ok: false, message: "A type with that name already exists." });
        return;
      }
      const row = previous
        ? await prisma.maintenanceType.update({
            where: { id: previous.id },
            data: { ...data, enabled: data.enabled ?? true, deletedAt: null, updatedBy: actor },
          })
        : await prisma.maintenanceType.create({
            data: { ...data, tenantId, isSystem: false, createdBy: actor, updatedBy: actor },
          });
      response.status(201).json({ ok: true, data: serializeType(row) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        response.status(409).json({ ok: false, message: "A type with that name already exists." });
        return;
      }
      sendError(response, error, "Could not save the type.");
    }
  });

  app.patch("/api/maintenance/types/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const existing = await prisma.maintenanceType.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
      });
      if (!existing) {
        response.status(404).json({ ok: false, message: "Type not found." });
        return;
      }
      const data = typeFieldsFrom(request.body ?? {}, { allowName: !existing.isSystem });
      if (data.name === "") throw new PublicError("Enter a name for the type.");
      await prisma.maintenanceType.updateMany({
        where: { id: existing.id, tenantId },
        data: { ...data, updatedBy: actorOf(request) },
      });
      const row = await prisma.maintenanceType.findFirst({ where: { id: existing.id, tenantId } });
      response.json({ ok: true, data: serializeType(row) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        response.status(409).json({ ok: false, message: "A type with that name already exists." });
        return;
      }
      sendError(response, error, "Could not save the type.");
    }
  });

  app.delete("/api/maintenance/types/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const existing = await prisma.maintenanceType.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
      });
      if (!existing) {
        response.status(404).json({ ok: false, message: "Type not found." });
        return;
      }
      if (existing.isSystem) throw new PublicError("Default types can be turned off but not deleted.");
      await prisma.maintenanceType.updateMany({
        where: { id: existing.id, tenantId },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the type.");
    }
  });
}

// ----- Vendors, PM schedules and equipment (simple lists) -----

function registerSimpleList(app, prisma, { path, model, label, fields, serialize, orderBy, validate }) {
  const readFields = (body, { partial }) => {
    const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
    const data = {};
    for (const field of fields) {
      if (partial && !has(field.key)) continue;
      const value = body[field.key];
      if (field.kind === "bool") data[field.key] = value === undefined ? (field.fallback ?? false) : value === true;
      else if (field.kind === "date") data[field.key] = parseDateOnly(value, field.label);
      else if (field.kind === "enum") data[field.key] = oneOf(value, field.values, field.fallback);
      else if (field.kind === "id") data[field.key] = text(value, 60) || null;
      else if (field.kind === "decimal") data[field.key] = parseDecimal(value, field.label);
      else data[field.key] = text(value, field.max ?? 300);
    }
    return data;
  };

  app.get(path, async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const rows = await prisma[model].findMany({ where: { tenantId, deletedAt: null }, orderBy });
      response.json({ ok: true, data: rows.map(serialize) });
    } catch (error) {
      sendError(response, error, `Could not load ${label}s.`);
    }
  });

  app.post(path, async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const data = readFields(request.body ?? {}, { partial: false });
      if (!data.name) throw new PublicError(`Enter a name for the ${label}.`);
      await validate?.(prisma, tenantId, data);
      const row = await prisma[model].create({ data: { ...data, tenantId, createdBy: actor, updatedBy: actor } });
      response.status(201).json({ ok: true, data: serialize(row) });
    } catch (error) {
      sendError(response, error, `Could not save the ${label}.`);
    }
  });

  app.patch(`${path}/:id`, async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const data = readFields(request.body ?? {}, { partial: true });
      if (data.name === "") throw new PublicError(`Enter a name for the ${label}.`);
      await validate?.(prisma, tenantId, data);
      const result = await prisma[model].updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { ...data, updatedBy: actorOf(request) },
      });
      if (result.count === 0) {
        response.status(404).json({ ok: false, message: `That ${label} was not found.` });
        return;
      }
      const row = await prisma[model].findFirst({ where: { id: request.params.id, tenantId } });
      response.json({ ok: true, data: serialize(row) });
    } catch (error) {
      sendError(response, error, `Could not save the ${label}.`);
    }
  });

  app.delete(`${path}/:id`, async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma[model].updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) {
        response.status(404).json({ ok: false, message: `That ${label} was not found.` });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, `Could not delete the ${label}.`);
    }
  });
}

export function register(app, prisma) {
  registerRecordRoutes(app, prisma);
  registerTypeRoutes(app, prisma);

  registerSimpleList(app, prisma, {
    path: "/api/maintenance/vendors",
    model: "vendor",
    label: "vendor",
    orderBy: { name: "asc" },
    fields: [
      { key: "name", max: 200 },
      { key: "contact", max: 200 },
      { key: "phone", max: 60 },
      { key: "email", max: 200 },
      { key: "website", max: 300 },
      { key: "services", max: 500 },
    ],
    serialize: (row) => ({
      id: row.id,
      name: row.name,
      contact: row.contact,
      phone: row.phone,
      email: row.email,
      website: row.website,
      services: row.services,
    }),
  });

  registerSimpleList(app, prisma, {
    path: "/api/maintenance/schedules",
    model: "pmSchedule",
    label: "schedule",
    orderBy: [{ nextDueAt: "asc" }, { name: "asc" }],
    fields: [
      { key: "name", max: 200 },
      { key: "typeId", kind: "id" },
      { key: "assetKind", kind: "enum", values: ASSET_KINDS, fallback: "apparatus" },
      { key: "assetRef", max: 200 },
      { key: "frequency", kind: "enum", values: FREQUENCIES.filter(Boolean), fallback: "Annual" },
      { key: "nextDueAt", kind: "date", label: "Next Due" },
      { key: "trackingBasis", kind: "enum", values: PM_BASES, fallback: "date" },
      { key: "intervalValue", kind: "decimal", label: "Interval" },
      { key: "lastServiceReading", kind: "decimal", label: "Last Service Reading" },
      { key: "lastServiceDate", kind: "date", label: "Last Service Date" },
      { key: "earlyWarning", kind: "decimal", label: "Early Warning" },
      { key: "active", kind: "bool", fallback: true },
    ],
    validate: async (db, tenantId, data) => {
      await assertBelongsToTenant(db, "maintenanceType", data.typeId, tenantId, "The category");
      if (data.trackingBasis && data.trackingBasis !== "date" && !(data.intervalValue > 0)) {
        throw new PublicError("Enter the interval (hours or miles between services).");
      }
    },
    serialize: (row) => ({
      id: row.id,
      name: row.name,
      typeId: row.typeId ?? "",
      assetKind: row.assetKind,
      assetRef: row.assetRef,
      frequency: row.frequency,
      nextDueAt: formatDateOnly(row.nextDueAt),
      trackingBasis: row.trackingBasis ?? "date",
      intervalValue: decimalOrNull(row.intervalValue),
      lastServiceReading: decimalOrNull(row.lastServiceReading),
      lastServiceDate: formatDateOnly(row.lastServiceDate),
      earlyWarning: decimalOrNull(row.earlyWarning),
      active: row.active,
    }),
  });

  registerSimpleList(app, prisma, {
    path: "/api/equipment",
    model: "equipment",
    label: "equipment item",
    orderBy: { name: "asc" },
    fields: [
      { key: "name", max: 200 },
      { key: "equipmentType", max: 120 },
      { key: "serialNumber", max: 120 },
      { key: "locationRef", max: 200 },
      { key: "status", kind: "enum", values: EQUIPMENT_STATUSES, fallback: "In Service" },
    ],
    serialize: (row) => ({
      id: row.id,
      name: row.name,
      equipmentType: row.equipmentType,
      serialNumber: row.serialNumber,
      locationRef: row.locationRef,
      status: row.status,
    }),
  });
}
