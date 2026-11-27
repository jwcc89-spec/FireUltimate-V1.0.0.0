/**
 * Apparatus inspections, stored as checklist submissions against a versioned checklist template.
 * Reads are open to any signed-in member; submitting needs maintenance.submit and deleting needs
 * maintenance.manage (both mapped in permissionForRequest).
 */
import { PublicError } from "../http/publicError.mjs";
import { DEFAULT_INSPECTION_SECTIONS, DEFAULT_INSPECTION_TEMPLATE_NAME } from "./inspectionDefaults.mjs";
import { readingsOf } from "./maintenance.mjs";
import {
  actorOf,
  detailsOf,
  formatDateOnly,
  isUniqueViolation,
  oneOf,
  parseDateOnly,
  parseDecimal,
  sendError,
  tenantIdOf,
  text,
} from "./moduleHelpers.mjs";

const RESULTS = ["OK", "X", "O", "NA"];
const OPEN_RECORD_STATUSES = ["Open", "Assigned", "In Progress", "Parts Ordered"];
/** Equipment List items kept on the inspected unit are added as rows to this section. */
const EQUIPMENT_SECTION_ID = "special";
const EQUIPMENT_ITEM_PREFIX = "equipment-";

/** Equipment List items on a unit, as inspection rows. Retired items are left out. */
async function unitEquipment(prisma, tenantId, unit) {
  const rows = await prisma.equipment.findMany({
    where: { tenantId, deletedAt: null, locationRef: unit },
    orderBy: { name: "asc" },
  });
  return rows
    .filter((row) => row.status !== "Retired")
    .map((row) => ({
      id: `${EQUIPMENT_ITEM_PREFIX}${row.id}`,
      label: row.serialNumber ? `${row.name} (${row.serialNumber})` : row.name,
      equipmentId: row.id,
    }));
}

/** Adds equipment rows to the Special Equipment section (or a new section if a template has none). */
function withEquipment(sections, equipmentItems) {
  if (equipmentItems.length === 0) return sections;
  if (!sections.some((section) => section.id === EQUIPMENT_SECTION_ID)) {
    return [...sections, { id: EQUIPMENT_SECTION_ID, title: "Special Equipment", defaultNa: false, items: equipmentItems }];
  }
  return sections.map((section) =>
    section.id === EQUIPMENT_SECTION_ID ? { ...section, items: [...(section.items ?? []), ...equipmentItems] } : section,
  );
}

function savedEquipmentItems(row) {
  const saved = detailsOf(row).equipmentItems;
  return Array.isArray(saved)
    ? saved
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ({ id: text(entry.id, 80), label: text(entry.label, 300), equipmentId: text(entry.equipmentId, 60) }))
        .filter((entry) => entry.id.startsWith(EQUIPMENT_ITEM_PREFIX))
    : [];
}

/** Seeds the default template (version 1) for the department the first time inspections are used. */
async function ensureDefaultTemplate(prisma, tenantId) {
  const find = () =>
    prisma.checklistTemplate.findFirst({
      where: { tenantId, name: DEFAULT_INSPECTION_TEMPLATE_NAME, deletedAt: null },
    });
  let template = await find();
  if (!template) {
    try {
      template = await prisma.$transaction(async (tx) => {
        const created = await tx.checklistTemplate.create({
          data: { tenantId, name: DEFAULT_INSPECTION_TEMPLATE_NAME, subjectKind: "apparatus", isSystem: true, createdBy: "system" },
        });
        await tx.checklistTemplateVersion.create({
          data: { tenantId, templateId: created.id, version: 1, itemsJson: DEFAULT_INSPECTION_SECTIONS, createdBy: "system" },
        });
        return created;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      template = await find();
    }
  }
  const version = await prisma.checklistTemplateVersion.findFirst({
    where: { tenantId, templateId: template.id },
    orderBy: { version: "desc" },
  });
  return { template, version };
}

function sectionsOf(version) {
  return Array.isArray(version?.itemsJson) ? version.itemsJson : [];
}

function serializeTemplate({ template, version }) {
  return { templateId: template.id, versionId: version.id, version: version.version, name: template.name, sections: sectionsOf(version) };
}

function cleanResults(raw, itemIds) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const results = {};
  for (const [itemId, entry] of Object.entries(source)) {
    if (!itemIds.has(itemId)) continue;
    const result = oneOf(entry?.result, RESULTS, "");
    if (!result) continue;
    results[itemId] = { result, note: text(entry?.note, 500), recordId: text(entry?.recordId, 60) };
  }
  return results;
}

function cleanDetails(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const readings = source.readings && typeof source.readings === "object" ? source.readings : {};
  return {
    officer: text(source.officer, 200),
    station: text(source.station, 200),
    vehicleMake: text(source.vehicleMake, 200),
    readings: {
      mileage: parseDecimal(readings.mileage, "Mileage"),
      engineHours: parseDecimal(readings.engineHours, "Engine Hours"),
      pumpHours: parseDecimal(readings.pumpHours, "Pump Hours"),
      generatorHours: parseDecimal(readings.generatorHours, "Generator Hours"),
    },
    lastServiceMileage: parseDecimal(source.lastServiceMileage, "Last Service Mileage"),
    lastServiceEngineHours: parseDecimal(source.lastServiceEngineHours, "Last Service Engine Hours"),
    comments: text(source.comments, 4000),
  };
}

function serializeSubmission(row, { includeDetail = false } = {}) {
  const details = detailsOf(row);
  const base = {
    id: row.id,
    submissionNumber: row.submissionNumber,
    subjectRef: row.subjectRef,
    completedOn: formatDateOnly(row.completedOn),
    completedByName: row.completedByName,
    repairCount: row.repairCount,
    status: row.status,
    readings: { ...readingsOf(details), generatorHours: details.readings?.generatorHours ?? null },
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  };
  if (!includeDetail) return base;
  return { ...base, details: cleanDetails(details), results: row.resultsJson ?? {} };
}

async function nextSubmissionNumber(prisma, tenantId) {
  const prefix = `INS-${String(new Date().getUTCFullYear()).slice(-2)}-`;
  const last = await prisma.checklistSubmission.findFirst({
    where: { tenantId, submissionNumber: { startsWith: prefix } },
    orderBy: { submissionNumber: "desc" },
    select: { submissionNumber: true },
  });
  const lastNumber = Number(last?.submissionNumber.slice(prefix.length)) || 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

export function register(app, prisma) {
  app.get("/api/inspections/template", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      response.json({ ok: true, data: serializeTemplate(await ensureDefaultTemplate(prisma, tenantId)) });
    } catch (error) {
      sendError(response, error, "Could not load the inspection checklist.");
    }
  });

  app.get("/api/inspections", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const unit = text(request.query.unit, 200);
      const rows = await prisma.checklistSubmission.findMany({
        where: { tenantId, deletedAt: null, subjectKind: "apparatus", ...(unit ? { subjectRef: unit } : {}) },
        orderBy: [{ completedOn: "desc" }, { createdAt: "desc" }],
      });
      response.json({ ok: true, data: rows.map((row) => serializeSubmission(row)) });
    } catch (error) {
      sendError(response, error, "Could not load inspections.");
    }
  });

  /**
   * Deficiencies still open for a unit: by checklist item (from earlier inspections' X results) and
   * every open Deficiency record on the unit, so the next inspection can show what isn't fixed yet.
   */
  app.get("/api/inspections/open-deficiencies", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const unit = text(request.query.unit, 200);
      if (!unit) throw new PublicError("Pick an apparatus.");
      const equipmentIds = new Set((await unitEquipment(prisma, tenantId, unit)).map((item) => item.equipmentId));
      const openRecords = (
        await prisma.maintenanceRecord.findMany({
          where: { tenantId, deletedAt: null, assetKind: { in: ["apparatus", "equipment"] } },
          include: { type: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        })
      ).filter((record) => {
        if (!OPEN_RECORD_STATUSES.includes(record.status)) return false;
        const refs = (Array.isArray(detailsOf(record).assets) ? detailsOf(record).assets : []).map((asset) => asset?.ref);
        if (record.assetKind === "equipment") return [record.assetRef, ...refs].some((ref) => equipmentIds.has(ref));
        return record.assetRef === unit || refs.includes(unit);
      });
      const openById = new Map(openRecords.map((record) => [record.id, record]));
      const submissions = await prisma.checklistSubmission.findMany({
        where: { tenantId, deletedAt: null, subjectKind: "apparatus", subjectRef: unit },
        orderBy: { createdAt: "asc" },
        select: { resultsJson: true },
      });
      const byItem = {};
      for (const submission of submissions) {
        const results = submission.resultsJson && typeof submission.resultsJson === "object" ? submission.resultsJson : {};
        for (const [itemId, entry] of Object.entries(results)) {
          const record = openById.get(entry?.recordId);
          if (entry?.result === "X" && record) {
            byItem[itemId] = {
              recordId: record.id,
              recordNumber: record.recordNumber,
              description: text(record.description, 200),
              assetKind: record.assetKind,
            };
          }
        }
      }
      const deficiencies = openRecords
        .filter((record) => record.type?.name === "Deficiency")
        .map((record) => ({
          recordId: record.id,
          recordNumber: record.recordNumber,
          description: text(record.description, 200),
          assetKind: record.assetKind,
        }));
      response.json({ ok: true, data: { byItem, deficiencies } });
    } catch (error) {
      sendError(response, error, "Could not load open deficiencies.");
    }
  });

  app.get("/api/inspections/unit-equipment", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const unit = text(request.query.unit, 200);
      if (!unit) throw new PublicError("Pick an apparatus.");
      response.json({ ok: true, data: await unitEquipment(prisma, tenantId, unit) });
    } catch (error) {
      sendError(response, error, "Could not load the equipment on this unit.");
    }
  });

  app.get("/api/inspections/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const row = await prisma.checklistSubmission.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
      });
      if (!row) {
        response.status(404).json({ ok: false, message: "That inspection was not found." });
        return;
      }
      const version = await prisma.checklistTemplateVersion.findFirst({
        where: { id: row.templateVersionId, tenantId },
      });
      response.json({
        ok: true,
        data: {
          ...serializeSubmission(row, { includeDetail: true }),
          sections: withEquipment(sectionsOf(version), savedEquipmentItems(row)),
        },
      });
    } catch (error) {
      sendError(response, error, "Could not load the inspection.");
    }
  });

  app.post("/api/inspections", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const body = request.body ?? {};
      const actor = actorOf(request);
      const subjectRef = text(body.subjectRef, 200);
      if (!subjectRef) throw new PublicError("Pick the apparatus that was inspected.");
      const completedOn = parseDateOnly(body.completedOn, "Inspection Date");
      if (!completedOn) throw new PublicError("Enter the inspection date.");
      const completedByName = text(body.completedByName, 200);
      if (!completedByName) throw new PublicError("Enter the firefighter / driver who did the inspection.");

      const { template, version } = await ensureDefaultTemplate(prisma, tenantId);
      const onUnit = await unitEquipment(prisma, tenantId, subjectRef);
      const itemIds = new Set(
        withEquipment(sectionsOf(version), onUnit).flatMap((section) => (section.items ?? []).map((item) => item.id)),
      );
      const results = cleanResults(body.results, itemIds);
      const equipmentItems = onUnit.filter((item) => results[item.id]);
      const recordIds = [...new Set(Object.values(results).map((entry) => entry.recordId).filter(Boolean))];
      if (recordIds.length > 0) {
        const found = await prisma.maintenanceRecord.findMany({
          where: { tenantId, deletedAt: null, id: { in: recordIds } },
          select: { id: true },
        });
        const foundIds = new Set(found.map((row) => row.id));
        for (const entry of Object.values(results)) {
          if (entry.recordId && !foundIds.has(entry.recordId)) entry.recordId = "";
        }
      }
      const details = cleanDetails(body.details);
      const missing = [
        !details.officer && "Officer / OOR",
        !details.station && "Station",
        details.readings.mileage === null && "Mileage",
        details.readings.engineHours === null && "Engine Hours",
        details.readings.pumpHours === null && "Pump Hours",
      ].filter(Boolean);
      if (missing.length > 0) throw new PublicError(`Fill in the required fields: ${missing.join(", ")}.`);
      const repairCount = Object.values(results).filter((entry) => entry.result === "X").length;

      let created = null;
      for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
        try {
          created = await prisma.checklistSubmission.create({
            data: {
              tenantId,
              submissionNumber: await nextSubmissionNumber(prisma, tenantId),
              templateId: template.id,
              templateVersionId: version.id,
              subjectKind: "apparatus",
              subjectRef,
              completedOn,
              completedByName,
              status: "Submitted",
              repairCount,
              resultsJson: results,
              detailsJson: { ...details, equipmentItems },
              createdBy: actor,
              updatedBy: actor,
            },
          });
        } catch (error) {
          if (!isUniqueViolation(error) || attempt === 2) throw error;
        }
      }
      response.status(201).json({ ok: true, data: serializeSubmission(created, { includeDetail: true }) });
    } catch (error) {
      sendError(response, error, "Could not save the inspection.");
    }
  });

  app.delete("/api/inspections/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.checklistSubmission.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) {
        response.status(404).json({ ok: false, message: "That inspection was not found." });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the inspection.");
    }
  });
}
