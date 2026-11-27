/**
 * Inventory checklists: templates (versioned), kits, assignments and completed checks.
 * Reads are open to any signed-in member. Completing a check needs inventory.complete; building
 * templates, kits and assignments, and reviewing or deleting checks, needs inventory.manage
 * (all mapped in permissionForRequest).
 *
 * Checklist templates share the ChecklistTemplate tables with apparatus inspections, told apart by
 * subjectKind "checklist".
 */
import { PublicError } from "../http/publicError.mjs";
import {
  actorOf,
  detailsOf,
  formatDateOnly,
  isUniqueViolation,
  oneOf,
  parseDateOnly,
  sendError,
  tenantIdOf,
  text,
} from "./moduleHelpers.mjs";

const SUBJECT_KIND = "checklist";
export const ITEM_TYPES = ["check", "yesno", "quantity", "number", "expiration", "date", "select", "text"];
export const TARGET_KINDS = ["apparatus", "station", "kit", "none"];
export const FREQUENCIES = ["once", "shift", "daily", "weekly", "monthly"];
const CHECK_VALUES = ["OK", "Fail", "NA"];
const YESNO_VALUES = ["Yes", "No"];
const ID_PATTERN = /^[a-z0-9-]{1,40}$/;
const MAX_SECTIONS = 30;
const MAX_ITEMS = 150;
const DAY_MS = 24 * 60 * 60 * 1000;

function finiteOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Checks a template's sections and items. Ids are made on the client so saved results keep pointing at them. */
export function cleanSections(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw new PublicError("Add at least one section with one item.");
  if (raw.length > MAX_SECTIONS) throw new PublicError(`A template can have up to ${MAX_SECTIONS} sections.`);
  const seen = new Set();
  const uniqueId = (value, label) => {
    const id = String(value ?? "").trim();
    if (!ID_PATTERN.test(id) || seen.has(id)) throw new PublicError(`${label} has a missing or repeated id.`);
    seen.add(id);
    return id;
  };
  let itemCount = 0;
  const sections = raw.map((section, sectionIndex) => {
    const title = text(section?.title, 200) || `Section ${sectionIndex + 1}`;
    const items = Array.isArray(section?.items) ? section.items : [];
    if (items.length === 0) throw new PublicError(`Add at least one item to "${title}".`);
    itemCount += items.length;
    return {
      id: uniqueId(section?.id, `Section "${title}"`),
      title,
      items: items.map((item) => {
        const label = text(item?.label, 300);
        if (!label) throw new PublicError(`Every item in "${title}" needs a label.`);
        const type = oneOf(item?.type, ITEM_TYPES, "check");
        const cleaned = { id: uniqueId(item?.id, `Item "${label}"`), label, type, required: item?.required !== false };
        if (type === "quantity") {
          const par = finiteOrNull(item?.par);
          if (par === null || par < 0 || !Number.isInteger(par)) throw new PublicError(`Set a whole-number par for "${label}".`);
          cleaned.par = par;
        }
        if (type === "number") {
          cleaned.min = finiteOrNull(item?.min);
          cleaned.max = finiteOrNull(item?.max);
          if (cleaned.min !== null && cleaned.max !== null && cleaned.min > cleaned.max) {
            throw new PublicError(`The low limit for "${label}" is above its high limit.`);
          }
        }
        if (type === "select") {
          const options = (Array.isArray(item?.options) ? item.options : []).map((option) => text(option, 100)).filter(Boolean);
          if (options.length < 2) throw new PublicError(`Give "${label}" at least two choices.`);
          cleaned.options = [...new Set(options)].slice(0, 20);
        }
        return cleaned;
      }),
    };
  });
  if (itemCount > MAX_ITEMS) throw new PublicError(`A template can have up to ${MAX_ITEMS} items.`);
  return sections;
}

function sectionsOf(version) {
  return Array.isArray(version?.itemsJson) ? version.itemsJson : [];
}

/**
 * Checks one answer against its item and says why it needs attention, if it does.
 * Returns { value, flag } where flag is "", "Failed", "Short", "Out of range" or "Expired".
 */
export function scoreItem(item, rawValue, completedOn) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return { value: "", flag: "" };
  switch (item.type) {
    case "check": {
      const value = oneOf(raw, CHECK_VALUES, "");
      if (!value) throw new PublicError(`"${item.label}" must be OK, Fail or N/A.`);
      return { value, flag: value === "Fail" ? "Failed" : "" };
    }
    case "yesno": {
      const value = oneOf(raw, YESNO_VALUES, "");
      if (!value) throw new PublicError(`"${item.label}" must be Yes or No.`);
      return { value, flag: "" };
    }
    case "quantity": {
      const count = Number(raw);
      if (!Number.isInteger(count) || count < 0) throw new PublicError(`"${item.label}" must be a whole number of 0 or more.`);
      return { value: String(count), flag: typeof item.par === "number" && count < item.par ? "Short" : "" };
    }
    case "number": {
      const number = Number(raw);
      if (!Number.isFinite(number)) throw new PublicError(`"${item.label}" must be a number.`);
      const low = typeof item.min === "number" && number < item.min;
      const high = typeof item.max === "number" && number > item.max;
      return { value: String(number), flag: low || high ? "Out of range" : "" };
    }
    case "expiration":
    case "date": {
      const date = parseDateOnly(raw, `"${item.label}"`);
      const expired = item.type === "expiration" && date.getTime() < completedOn.getTime();
      return { value: formatDateOnly(date), flag: expired ? "Expired" : "" };
    }
    case "select": {
      const value = oneOf(raw, item.options ?? [], "");
      if (!value) throw new PublicError(`Pick one of the choices for "${item.label}".`);
      return { value, flag: "" };
    }
    default:
      return { value: text(raw, 1000), flag: "" };
  }
}

// ----- Due dates -----

function dateKeyOf(query) {
  const raw = String(query?.date ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
}

function utcDate(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

/** The first day of the current period for a frequency. "shift" counts as a day until shift times are wired in. */
function periodStart(frequency, today) {
  if (frequency === "weekly") {
    const weekday = (today.getUTCDay() + 6) % 7;
    return new Date(today.getTime() - weekday * DAY_MS);
  }
  if (frequency === "monthly") return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return today;
}

function previousPeriodStart(frequency, start) {
  if (frequency === "weekly") return new Date(start.getTime() - 7 * DAY_MS);
  if (frequency === "monthly") return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  return new Date(start.getTime() - DAY_MS);
}

/** Due, Overdue (the last period was missed too), Complete, Scheduled or Paused, with the date the current period began. */
export function assignmentStatus(row, todayKey) {
  const today = utcDate(todayKey);
  const startsOn = row.startsOn;
  const last = row.lastCompletedOn;
  if (!row.active) return { status: "Paused", dueOn: "" };
  if (startsOn.getTime() > today.getTime()) return { status: "Scheduled", dueOn: formatDateOnly(startsOn) };
  if (row.frequency === "once") {
    if (last) return { status: "Complete", dueOn: formatDateOnly(startsOn) };
    return { status: startsOn.getTime() < today.getTime() ? "Overdue" : "Due", dueOn: formatDateOnly(startsOn) };
  }
  const start = periodStart(row.frequency, today);
  if (last && last.getTime() >= start.getTime()) return { status: "Complete", dueOn: formatDateOnly(start) };
  const previous = previousPeriodStart(row.frequency, start);
  const missedLast = previous.getTime() >= startsOn.getTime() && (!last || last.getTime() < previous.getTime());
  return { status: missedLast ? "Overdue" : "Due", dueOn: formatDateOnly(start) };
}

// ----- Serializers -----

function serializeTemplate(template, version) {
  return {
    id: template.id,
    name: template.name,
    enabled: template.enabled,
    version: version?.version ?? 0,
    versionId: version?.id ?? "",
    sections: sectionsOf(version),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function serializeKit(row) {
  return {
    id: row.id,
    name: row.name,
    kitType: row.kitType,
    locationRef: row.locationRef,
    notes: text(detailsOf(row).notes, 2000),
  };
}

function targetLabel(kind, ref, kitsById) {
  if (kind === "none") return "";
  if (kind === "kit") return kitsById.get(ref)?.name ?? "Removed kit";
  return ref;
}

function serializeAssignment(row, templatesById, kitsById, todayKey) {
  return {
    id: row.id,
    templateId: row.templateId,
    templateName: templatesById.get(row.templateId)?.name ?? "",
    targetKind: row.targetKind,
    targetRef: row.targetRef,
    targetLabel: targetLabel(row.targetKind, row.targetRef, kitsById),
    assignedTo: row.assignedTo,
    frequency: row.frequency,
    startsOn: formatDateOnly(row.startsOn),
    active: row.active,
    lastCompletedOn: formatDateOnly(row.lastCompletedOn),
    ...assignmentStatus(row, todayKey),
  };
}

function serializeSubmission(row, { includeDetail = false } = {}) {
  const details = detailsOf(row);
  const base = {
    id: row.id,
    submissionNumber: row.submissionNumber,
    templateId: row.templateId,
    templateName: text(details.templateName, 200),
    assignmentId: text(details.assignmentId, 60),
    targetKind: text(details.targetKind, 20) || "none",
    targetRef: row.subjectRef,
    targetLabel: text(details.targetLabel, 200),
    completedOn: formatDateOnly(row.completedOn),
    completedByName: row.completedByName,
    status: row.status,
    flagCount: row.repairCount,
    flags: Array.isArray(details.flags) ? details.flags : [],
    reviewedBy: text(details.reviewedBy, 200),
    createdAt: row.createdAt.toISOString(),
  };
  if (!includeDetail) return base;
  return { ...base, notes: text(details.notes, 4000), results: row.resultsJson ?? {} };
}

// ----- Lookups -----

async function checklistTemplate(prisma, tenantId, id) {
  const template = await prisma.checklistTemplate.findFirst({
    where: { id: text(id, 60), tenantId, subjectKind: SUBJECT_KIND, deletedAt: null },
  });
  if (!template) throw new PublicError("That checklist template was not found.");
  return template;
}

async function latestVersion(prisma, tenantId, templateId) {
  return prisma.checklistTemplateVersion.findFirst({ where: { tenantId, templateId }, orderBy: { version: "desc" } });
}

async function kitMap(prisma, tenantId) {
  const kits = await prisma.kit.findMany({ where: { tenantId, deletedAt: null } });
  return new Map(kits.map((kit) => [kit.id, kit]));
}

async function templateMap(prisma, tenantId) {
  const templates = await prisma.checklistTemplate.findMany({ where: { tenantId, subjectKind: SUBJECT_KIND } });
  return new Map(templates.map((template) => [template.id, template]));
}

async function readTarget(prisma, tenantId, body) {
  const targetKind = oneOf(body?.targetKind, TARGET_KINDS, "none");
  const targetRef = targetKind === "none" ? "" : text(body?.targetRef, 200);
  if (targetKind !== "none" && !targetRef) throw new PublicError("Pick what the checklist is for.");
  if (targetKind === "kit") {
    const kit = await prisma.kit.findFirst({ where: { id: targetRef, tenantId, deletedAt: null }, select: { id: true } });
    if (!kit) throw new PublicError("That kit was not found.");
  }
  return { targetKind, targetRef };
}

async function nextSubmissionNumber(prisma, tenantId) {
  const prefix = `CHK-${String(new Date().getUTCFullYear()).slice(-2)}-`;
  const last = await prisma.checklistSubmission.findFirst({
    where: { tenantId, submissionNumber: { startsWith: prefix } },
    orderBy: { submissionNumber: "desc" },
    select: { submissionNumber: true },
  });
  const lastNumber = Number(last?.submissionNumber.slice(prefix.length)) || 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

function notFound(response, label) {
  response.status(404).json({ ok: false, message: `That ${label} was not found.` });
}

export function register(app, prisma) {
  // ----- Templates -----

  app.get("/api/checklists/templates", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const templates = await prisma.checklistTemplate.findMany({
        where: { tenantId, subjectKind: SUBJECT_KIND, deletedAt: null },
        orderBy: { name: "asc" },
      });
      const versions = await prisma.checklistTemplateVersion.findMany({
        where: { tenantId, templateId: { in: templates.map((template) => template.id) } },
        orderBy: { version: "desc" },
      });
      const latest = new Map();
      for (const version of versions) if (!latest.has(version.templateId)) latest.set(version.templateId, version);
      response.json({ ok: true, data: templates.map((template) => serializeTemplate(template, latest.get(template.id))) });
    } catch (error) {
      sendError(response, error, "Could not load checklist templates.");
    }
  });

  app.post("/api/checklists/templates", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const name = text(request.body?.name, 200);
      if (!name) throw new PublicError("Enter a template name.");
      const sections = cleanSections(request.body?.sections);
      const actor = actorOf(request);
      const { template, version } = await prisma.$transaction(async (tx) => {
        const created = await tx.checklistTemplate.create({
          data: { tenantId, name, subjectKind: SUBJECT_KIND, enabled: request.body?.enabled !== false, createdBy: actor, updatedBy: actor },
        });
        const firstVersion = await tx.checklistTemplateVersion.create({
          data: { tenantId, templateId: created.id, version: 1, itemsJson: sections, createdBy: actor },
        });
        return { template: created, version: firstVersion };
      });
      response.status(201).json({ ok: true, data: serializeTemplate(template, version) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        response.status(400).json({ ok: false, message: "A template with that name already exists." });
        return;
      }
      sendError(response, error, "Could not save the template.");
    }
  });

  app.patch("/api/checklists/templates/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const template = await checklistTemplate(prisma, tenantId, request.params.id);
      const name = text(request.body?.name, 200);
      if (!name) throw new PublicError("Enter a template name.");
      const sections = cleanSections(request.body?.sections);
      const actor = actorOf(request);
      const current = await latestVersion(prisma, tenantId, template.id);
      const changed = JSON.stringify(sectionsOf(current)) !== JSON.stringify(sections);
      const version = await prisma.$transaction(async (tx) => {
        await tx.checklistTemplate.updateMany({
          where: { id: template.id, tenantId },
          data: { name, enabled: request.body?.enabled !== false, updatedBy: actor },
        });
        if (!changed) return current;
        return tx.checklistTemplateVersion.create({
          data: { tenantId, templateId: template.id, version: (current?.version ?? 0) + 1, itemsJson: sections, createdBy: actor },
        });
      });
      const updated = await checklistTemplate(prisma, tenantId, template.id);
      response.json({ ok: true, data: serializeTemplate(updated, version) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        response.status(400).json({ ok: false, message: "A template with that name already exists." });
        return;
      }
      sendError(response, error, "Could not save the template.");
    }
  });

  app.delete("/api/checklists/templates/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const template = await checklistTemplate(prisma, tenantId, request.params.id);
      const now = new Date();
      // Frees the name for a new template; completed checks keep pointing at the old one.
      await prisma.checklistTemplate.updateMany({
        where: { id: template.id, tenantId },
        data: { deletedAt: now, name: `${template.name} (deleted ${now.toISOString()})`.slice(0, 300), updatedBy: actorOf(request) },
      });
      await prisma.checklistAssignment.updateMany({
        where: { tenantId, templateId: template.id, deletedAt: null },
        data: { deletedAt: now, updatedBy: actorOf(request) },
      });
      response.json({ ok: true });
    } catch (error) {
      if (error instanceof PublicError) {
        notFound(response, "checklist template");
        return;
      }
      sendError(response, error, "Could not delete the template.");
    }
  });

  // ----- Kits -----

  const readKit = (body) => {
    const name = text(body?.name, 200);
    if (!name) throw new PublicError("Enter a kit name.");
    return {
      name,
      kitType: text(body?.kitType, 120),
      locationRef: text(body?.locationRef, 200),
      detailsJson: { notes: text(body?.notes, 2000) },
    };
  };

  app.get("/api/checklists/kits", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const rows = await prisma.kit.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: "asc" } });
      response.json({ ok: true, data: rows.map(serializeKit) });
    } catch (error) {
      sendError(response, error, "Could not load kits.");
    }
  });

  app.post("/api/checklists/kits", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const row = await prisma.kit.create({ data: { tenantId, ...readKit(request.body), createdBy: actor, updatedBy: actor } });
      response.status(201).json({ ok: true, data: serializeKit(row) });
    } catch (error) {
      sendError(response, error, "Could not save the kit.");
    }
  });

  app.patch("/api/checklists/kits/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const data = readKit(request.body);
      const result = await prisma.kit.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { ...data, updatedBy: actorOf(request) },
      });
      if (result.count === 0) return notFound(response, "kit");
      const row = await prisma.kit.findFirst({ where: { id: request.params.id, tenantId } });
      response.json({ ok: true, data: serializeKit(row) });
    } catch (error) {
      sendError(response, error, "Could not save the kit.");
    }
  });

  app.delete("/api/checklists/kits/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.kit.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) return notFound(response, "kit");
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the kit.");
    }
  });

  // ----- Assignments -----

  const readAssignment = async (tenantId, body) => {
    const template = await checklistTemplate(prisma, tenantId, body?.templateId);
    const startsOn = parseDateOnly(body?.startsOn, "Starts On");
    if (!startsOn) throw new PublicError("Enter the date the checklist starts.");
    return {
      templateId: template.id,
      ...(await readTarget(prisma, tenantId, body)),
      assignedTo: text(body?.assignedTo, 200),
      frequency: oneOf(body?.frequency, FREQUENCIES, "daily"),
      startsOn,
      active: body?.active !== false,
    };
  };

  const listAssignments = async (tenantId, todayKey, where = {}) => {
    const [rows, templatesById, kitsById] = await Promise.all([
      prisma.checklistAssignment.findMany({ where: { tenantId, deletedAt: null, ...where }, orderBy: { createdAt: "asc" } }),
      templateMap(prisma, tenantId),
      kitMap(prisma, tenantId),
    ]);
    return rows.map((row) => serializeAssignment(row, templatesById, kitsById, todayKey));
  };

  app.get("/api/checklists/assignments", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      response.json({ ok: true, data: await listAssignments(tenantId, dateKeyOf(request.query)) });
    } catch (error) {
      sendError(response, error, "Could not load checklist assignments.");
    }
  });

  app.post("/api/checklists/assignments", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const row = await prisma.checklistAssignment.create({
        data: { tenantId, ...(await readAssignment(tenantId, request.body)), createdBy: actor, updatedBy: actor },
      });
      const [saved] = await listAssignments(tenantId, dateKeyOf(request.query), { id: row.id });
      response.status(201).json({ ok: true, data: saved });
    } catch (error) {
      sendError(response, error, "Could not save the assignment.");
    }
  });

  app.patch("/api/checklists/assignments/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const data = await readAssignment(tenantId, request.body);
      const result = await prisma.checklistAssignment.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { ...data, updatedBy: actorOf(request) },
      });
      if (result.count === 0) return notFound(response, "assignment");
      const [saved] = await listAssignments(tenantId, dateKeyOf(request.query), { id: request.params.id });
      response.json({ ok: true, data: saved });
    } catch (error) {
      sendError(response, error, "Could not save the assignment.");
    }
  });

  app.delete("/api/checklists/assignments/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.checklistAssignment.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) return notFound(response, "assignment");
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the assignment.");
    }
  });

  // ----- Completed checks -----

  app.get("/api/checklists/submissions", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const status = text(request.query.status, 20);
      const rows = await prisma.checklistSubmission.findMany({
        where: { tenantId, deletedAt: null, subjectKind: SUBJECT_KIND, ...(status ? { status } : {}) },
        orderBy: [{ completedOn: "desc" }, { createdAt: "desc" }],
        take: 300,
      });
      response.json({ ok: true, data: rows.map((row) => serializeSubmission(row)) });
    } catch (error) {
      sendError(response, error, "Could not load completed checklists.");
    }
  });

  app.get("/api/checklists/submissions/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const row = await prisma.checklistSubmission.findFirst({
        where: { id: request.params.id, tenantId, subjectKind: SUBJECT_KIND, deletedAt: null },
      });
      if (!row) return notFound(response, "checklist");
      const version = await prisma.checklistTemplateVersion.findFirst({ where: { id: row.templateVersionId, tenantId } });
      response.json({ ok: true, data: { ...serializeSubmission(row, { includeDetail: true }), sections: sectionsOf(version) } });
    } catch (error) {
      sendError(response, error, "Could not load the checklist.");
    }
  });

  app.post("/api/checklists/submissions", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const body = request.body ?? {};
      const actor = actorOf(request);
      const signatureName = text(body.signatureName, 200);
      if (!signatureName) throw new PublicError("Type your name to sign the checklist.");
      // Demo rule: the PIN must be entered. It is not stored or compared until PIN storage is built.
      if (!String(body.pin ?? "").trim()) throw new PublicError("Enter your PIN to sign the checklist.");
      const completedOn = parseDateOnly(body.completedOn, "Date") ?? utcDate(new Date().toISOString().slice(0, 10));

      let assignment = null;
      if (body.assignmentId) {
        assignment = await prisma.checklistAssignment.findFirst({
          where: { id: text(body.assignmentId, 60), tenantId, deletedAt: null },
        });
        if (!assignment) throw new PublicError("That assignment was not found.");
      }
      const template = await checklistTemplate(prisma, tenantId, assignment?.templateId ?? body.templateId);
      if (!template.enabled) throw new PublicError("That checklist template is turned off.");
      const version = await latestVersion(prisma, tenantId, template.id);
      const target = assignment
        ? { targetKind: assignment.targetKind, targetRef: assignment.targetRef }
        : await readTarget(prisma, tenantId, body);
      const kitsById = target.targetKind === "kit" ? await kitMap(prisma, tenantId) : new Map();

      const source = body.results && typeof body.results === "object" && !Array.isArray(body.results) ? body.results : {};
      const results = {};
      const flags = [];
      const missing = [];
      for (const item of sectionsOf(version).flatMap((section) => section.items ?? [])) {
        const entry = source[item.id];
        const { value, flag } = scoreItem(item, entry?.value, completedOn);
        if (!value) {
          if (item.required) missing.push(item.label);
          continue;
        }
        results[item.id] = { value, note: text(entry?.note, 500), flag };
        if (flag) flags.push({ itemId: item.id, label: item.label, reason: flag });
      }
      if (missing.length > 0) {
        const shown = missing.slice(0, 5).join(", ");
        throw new PublicError(`Answer the required items: ${shown}${missing.length > 5 ? ` and ${missing.length - 5} more` : ""}.`);
      }

      let created = null;
      for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
        try {
          created = await prisma.checklistSubmission.create({
            data: {
              tenantId,
              submissionNumber: await nextSubmissionNumber(prisma, tenantId),
              templateId: template.id,
              templateVersionId: version.id,
              subjectKind: SUBJECT_KIND,
              subjectRef: target.targetRef,
              completedOn,
              completedByName: signatureName,
              status: flags.length > 0 ? "Flagged" : "Submitted",
              repairCount: flags.length,
              resultsJson: results,
              detailsJson: {
                templateName: template.name,
                assignmentId: assignment?.id ?? "",
                targetKind: target.targetKind,
                targetLabel: targetLabel(target.targetKind, target.targetRef, kitsById),
                notes: text(body.notes, 4000),
                flags,
              },
              createdBy: actor,
              updatedBy: actor,
            },
          });
        } catch (error) {
          if (!isUniqueViolation(error) || attempt === 2) throw error;
        }
      }
      if (assignment && (!assignment.lastCompletedOn || assignment.lastCompletedOn.getTime() < completedOn.getTime())) {
        await prisma.checklistAssignment.updateMany({
          where: { id: assignment.id, tenantId },
          data: { lastCompletedOn: completedOn, updatedBy: actor },
        });
      }
      response.status(201).json({ ok: true, data: serializeSubmission(created, { includeDetail: true }) });
    } catch (error) {
      sendError(response, error, "Could not save the checklist.");
    }
  });

  app.patch("/api/checklists/submissions/:id/review", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const row = await prisma.checklistSubmission.findFirst({
        where: { id: request.params.id, tenantId, subjectKind: SUBJECT_KIND, deletedAt: null },
      });
      if (!row) return notFound(response, "checklist");
      const actor = actorOf(request);
      await prisma.checklistSubmission.updateMany({
        where: { id: row.id, tenantId },
        data: {
          status: "Reviewed",
          detailsJson: { ...detailsOf(row), reviewedBy: actor, reviewedAt: new Date().toISOString() },
          updatedBy: actor,
        },
      });
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not mark the checklist reviewed.");
    }
  });

  app.delete("/api/checklists/submissions/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.checklistSubmission.updateMany({
        where: { id: request.params.id, tenantId, subjectKind: SUBJECT_KIND, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) return notFound(response, "checklist");
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the checklist.");
    }
  });
}
