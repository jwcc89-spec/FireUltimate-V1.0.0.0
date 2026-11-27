/**
 * Dashboard layouts and the dashboard summary.
 * Any signed-in member saves or resets their own layout. Setting the department default needs
 * displays.manage (permissionForRequest). The summary only reads. Every query filters on request.tenant.id.
 */
import { minimumRoleFor, roleLevel } from "../auth/permissions.mjs";
import { PublicError } from "../http/publicError.mjs";
import { boardApparatus, boardDate, boardOnDuty } from "./displays.mjs";
import { apparatusStatusFor, OPEN_STATUSES } from "./maintenance.mjs";
import { actorOf, formatDateOnly, sendError, tenantIdOf, text } from "./moduleHelpers.mjs";

export const DASHBOARD_WIDGETS = [
  "clock",
  "callStats",
  "incidents",
  "onDuty",
  "apparatus",
  "maintenance",
  "checksDue",
  "trades",
  "calendar",
  "map",
  "quickLinks",
  "dtbs",
];

/** The grid is 12 columns wide. Rows grow downward as needed. */
export const DASHBOARD_COLS = 12;
const MIN_W = 2;
const MIN_H = 2;
const MAX_H = 16;
const MAX_Y = 500;
const DEPARTMENT_DEFAULT = "";
const RECENT_OPEN_RECORDS = 6;

export const BUILT_IN_LAYOUT = [
  { i: "clock", x: 0, y: 0, w: 3, h: 2 },
  { i: "callStats", x: 3, y: 0, w: 9, h: 2 },
  { i: "incidents", x: 0, y: 2, w: 6, h: 5 },
  { i: "map", x: 6, y: 2, w: 6, h: 5 },
  { i: "onDuty", x: 0, y: 7, w: 4, h: 5 },
  { i: "apparatus", x: 4, y: 7, w: 4, h: 5 },
  { i: "calendar", x: 8, y: 7, w: 4, h: 7 },
  { i: "trades", x: 0, y: 12, w: 4, h: 4 },
  { i: "checksDue", x: 4, y: 12, w: 4, h: 4 },
  { i: "maintenance", x: 8, y: 14, w: 4, h: 4 },
];

/** Checks a layout sent by the dashboard editor. Widgets are known, listed once, and stay inside the 12 columns. */
export function readLayout(raw) {
  const items = raw && typeof raw === "object" && !Array.isArray(raw) ? raw.items : raw;
  if (!Array.isArray(items)) throw new PublicError("The dashboard layout is not valid.");
  if (items.length > DASHBOARD_WIDGETS.length) throw new PublicError("The dashboard layout has too many widgets.");
  const seen = new Set();
  return items.map((item) => {
    const id = text(item?.i, 40);
    if (!DASHBOARD_WIDGETS.includes(id)) throw new PublicError("The dashboard layout has an unknown widget.");
    if (seen.has(id)) throw new PublicError("Each widget can only be on the dashboard once.");
    seen.add(id);
    const box = { x: Number(item.x), y: Number(item.y), w: Number(item.w), h: Number(item.h) };
    if (!Object.values(box).every(Number.isInteger)) throw new PublicError("The dashboard layout is not valid.");
    if (box.w < MIN_W || box.h < MIN_H || box.h > MAX_H || box.x < 0 || box.y < 0 || box.y > MAX_Y || box.x + box.w > DASHBOARD_COLS) {
      throw new PublicError("Each widget must be at least 2 by 2 and stay inside the 12 dashboard columns.");
    }
    return { i: id, ...box };
  });
}

function storedLayout(row) {
  if (!row) return null;
  try {
    return readLayout(row.layoutJson);
  } catch {
    return null;
  }
}

async function canSetDefault(prisma, request) {
  const minimum = await minimumRoleFor(prisma, request.tenant.id, "displays.manage");
  return minimum != null && roleLevel(request.auth?.role) >= roleLevel(minimum);
}

function userIdOf(request, response) {
  const userId = text(request.auth?.userId, 100);
  if (!userId) {
    response.status(400).json({ ok: false, message: "Sign in with a department account to save a dashboard layout." });
    return null;
  }
  return userId;
}

async function saveLayout(prisma, tenantId, userId, items, actor) {
  const layoutJson = { items };
  await prisma.dashboardLayout.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    create: { tenantId, userId, layoutJson, createdBy: actor, updatedBy: actor },
    update: { layoutJson, deletedAt: null, updatedBy: actor },
  });
}

async function removeLayout(prisma, tenantId, userId, actor) {
  await prisma.dashboardLayout.updateMany({
    where: { tenantId, userId, deletedAt: null },
    data: { deletedAt: new Date(), updatedBy: actor },
  });
}

async function layoutFor(prisma, request, tenantId) {
  const userId = text(request.auth?.userId, 100);
  const rows = await prisma.dashboardLayout.findMany({
    where: { tenantId, deletedAt: null, userId: { in: userId ? [userId, DEPARTMENT_DEFAULT] : [DEPARTMENT_DEFAULT] } },
  });
  const mine = userId ? storedLayout(rows.find((row) => row.userId === userId)) : null;
  const department = storedLayout(rows.find((row) => row.userId === DEPARTMENT_DEFAULT));
  const source = mine ? "user" : department ? "department" : "builtIn";
  return {
    items: mine ?? department ?? BUILT_IN_LAYOUT,
    source,
    hasDepartmentDefault: Boolean(department),
    canSetDefault: await canSetDefault(prisma, request),
  };
}

function payloadOf(details) {
  const raw = details?.payloadJson;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

/** Open maintenance counts and the newest open records, for the Open Maintenance widget. */
export async function maintenanceSummary(prisma, tenantId, todayKey) {
  const rows = await prisma.maintenanceRecord.findMany({
    where: { tenantId, deletedAt: null, status: { in: OPEN_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      recordNumber: true,
      description: true,
      assetKind: true,
      assetRef: true,
      status: true,
      priority: true,
      dueDate: true,
      outOfService: true,
    },
  });
  const overdue = rows.filter((row) => row.dueDate && formatDateOnly(row.dueDate) < todayKey).length;
  return {
    open: rows.length,
    overdue,
    outOfService: rows.filter((row) => row.outOfService).length,
    recent: rows.slice(0, RECENT_OPEN_RECORDS).map((row) => ({
      id: row.id,
      recordNumber: row.recordNumber,
      description: row.description ?? "",
      assetKind: row.assetKind,
      assetRef: row.assetRef,
      status: row.status,
      priority: row.priority,
      dueDate: formatDateOnly(row.dueDate),
      outOfService: row.outOfService,
    })),
  };
}

export function register(app, prisma) {
  app.get("/api/dashboard/layout", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      response.json({ ok: true, data: await layoutFor(prisma, request, tenantId) });
    } catch (error) {
      sendError(response, error, "Could not load the dashboard layout.");
    }
  });

  app.put("/api/dashboard/layout", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    const userId = userIdOf(request, response);
    if (!userId) return;
    try {
      await saveLayout(prisma, tenantId, userId, readLayout(request.body), actorOf(request));
      response.json({ ok: true, data: await layoutFor(prisma, request, tenantId) });
    } catch (error) {
      sendError(response, error, "Could not save the dashboard layout.");
    }
  });

  /** Clears this member's own layout so they see the department default again. */
  app.delete("/api/dashboard/layout", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    const userId = userIdOf(request, response);
    if (!userId) return;
    try {
      await removeLayout(prisma, tenantId, userId, actorOf(request));
      response.json({ ok: true, data: await layoutFor(prisma, request, tenantId) });
    } catch (error) {
      sendError(response, error, "Could not reset the dashboard layout.");
    }
  });

  app.put("/api/dashboard/layout/default", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      await saveLayout(prisma, tenantId, DEPARTMENT_DEFAULT, readLayout(request.body), actorOf(request));
      response.json({ ok: true, data: await layoutFor(prisma, request, tenantId) });
    } catch (error) {
      sendError(response, error, "Could not save the department default layout.");
    }
  });

  app.delete("/api/dashboard/layout/default", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      await removeLayout(prisma, tenantId, DEPARTMENT_DEFAULT, actorOf(request));
      response.json({ ok: true, data: await layoutFor(prisma, request, tenantId) });
    } catch (error) {
      sendError(response, error, "Could not clear the department default layout.");
    }
  });

  /** Apparatus status, crew on duty now (every station) and open maintenance in one call. */
  app.get("/api/dashboard/summary", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const now = Date.now();
      const when = boardDate(request.query, now);
      const [details, statusRows, scheduleRows, maintenance] = await Promise.all([
        prisma.departmentDetails.findUnique({ where: { tenantId }, select: { payloadJson: true } }),
        apparatusStatusFor(prisma, tenantId),
        prisma.scheduleAssignments.findMany({
          where: { tenantId, dateKey: { in: [when.date, when.yesterday] } },
          select: { shiftType: true, dateKey: true, assignmentsJson: true },
        }),
        maintenanceSummary(prisma, tenantId, when.date),
      ]);
      const payload = payloadOf(details);
      response.json({
        ok: true,
        data: {
          serverTime: new Date(now).toISOString(),
          apparatus: boardApparatus(payload, statusRows, ""),
          onDuty: boardOnDuty(payload, scheduleRows, when, ""),
          maintenance,
        },
      });
    } catch (error) {
      sendError(response, error, "Could not load the dashboard.");
    }
  });
}
