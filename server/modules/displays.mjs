/**
 * Station display boards, announcements and board events.
 * Boards only read calls, crews and apparatus status. Changing boards, announcements and
 * events needs displays.manage; reading a board's feed needs incidents.view (permissionForRequest).
 * Every query filters on request.tenant.id.
 */
import { PublicError } from "../http/publicError.mjs";
import { allApparatusPlacements, readTradeDepartment, scheduleSnapshotFromRows } from "../trades/eligibility.mjs";
import { clearOldIncidentPoints, ensureIncidentPoint, savedPoint } from "./incidentLocation.mjs";
import { apparatusStatusFor } from "./maintenance.mjs";
import { censusGeocode, pointInGeofences } from "./mapsGeometry.mjs";
import { actorOf, detailsOf, oneOf, sendError, tenantIdOf, text } from "./moduleHelpers.mjs";

export const BOARD_PANELS = ["apparatus", "onDuty", "incidents", "events", "messages"];
const CALL_FILTERS = ["all", "districts"];
const FEED_INCIDENTS = 10;
const PULSE_INCIDENTS = 5;
const DISTRICT_LOOKUPS_PER_FEED = 3;
const EVENT_LOOKBACK_MS = 6 * 60 * 60 * 1000;

function iso(value) {
  return value instanceof Date ? value.toISOString() : "";
}

function payloadOf(details) {
  const raw = details?.payloadJson;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

function records(raw) {
  return Array.isArray(raw) ? raw.filter((entry) => entry && typeof entry === "object") : [];
}

function sameText(left, right) {
  return text(left, 300).toLowerCase() === text(right, 300).toLowerCase();
}

function parseTimestamp(value, label, { required = false } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    if (required) throw new PublicError(`Enter ${label}.`);
    return null;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new PublicError(`${label[0].toUpperCase()}${label.slice(1)} is not a valid date and time.`);
  return date;
}

function panelsOf(layoutJson) {
  const saved = layoutJson && typeof layoutJson === "object" && layoutJson.panels && typeof layoutJson.panels === "object" ? layoutJson.panels : {};
  return Object.fromEntries(BOARD_PANELS.map((key) => [key, saved[key] !== false]));
}

/** The board area below the header is an 8 by 8 grid. Each panel covers at least 2 by 2 squares. */
export const GRID_SIZE = 8;
const MIN_SPAN = 2;
export const DEFAULT_GRID = {
  apparatus: { x: 0, y: 0, w: 2, h: 5 },
  onDuty: { x: 0, y: 5, w: 2, h: 3 },
  incidents: { x: 2, y: 0, w: 4, h: 8 },
  events: { x: 6, y: 0, w: 2, h: 4 },
  messages: { x: 6, y: 4, w: 2, h: 4 },
};

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Validates a layout sent by the layout editor. Missing means the default. */
export function readGrid(raw) {
  if (raw == null) return { ...DEFAULT_GRID };
  if (typeof raw !== "object" || Array.isArray(raw)) throw new PublicError("The board layout is not valid.");
  const grid = {};
  for (const key of BOARD_PANELS) {
    const cell = raw[key];
    if (cell == null) continue;
    const box = { x: Number(cell.x), y: Number(cell.y), w: Number(cell.w), h: Number(cell.h) };
    if (!Object.values(box).every(Number.isInteger)) throw new PublicError("The board layout is not valid.");
    if (box.x < 0 || box.y < 0 || box.w < MIN_SPAN || box.h < MIN_SPAN || box.x + box.w > GRID_SIZE || box.y + box.h > GRID_SIZE) {
      throw new PublicError("Each panel must be at least 2 by 2 squares and stay inside the 8 by 8 board.");
    }
    for (const [other, placed] of Object.entries(grid)) {
      if (overlaps(box, placed)) throw new PublicError(`The ${key} and ${other} panels overlap.`);
    }
    grid[key] = box;
  }
  return grid;
}

function gridOf(layoutJson) {
  try {
    return readGrid(layoutJson && typeof layoutJson === "object" ? layoutJson.grid : null);
  } catch {
    return { ...DEFAULT_GRID };
  }
}

function stationAddress(payload, stationName) {
  if (!stationName) return "";
  const station = records(payload.stationRecords).find((entry) => sameText(entry.name, stationName));
  return station ? [station.address, station.city, station.state].map((part) => text(part, 120)).filter(Boolean).join(", ") : "";
}

function serializeBoard(row) {
  return {
    id: row.id,
    name: row.name,
    stationName: row.stationName,
    callFilter: row.callFilter,
    filterGeofenceIds: Array.isArray(row.filterGeofenceIds) ? row.filterGeofenceIds : [],
    takeoverSeconds: row.takeoverSeconds,
    soundOn: row.soundOn,
    panels: panelsOf(row.layoutJson),
    layout: gridOf(row.layoutJson),
    updatedAt: iso(row.updatedAt),
    updatedBy: row.updatedBy,
  };
}

async function readBoard(prisma, tenantId, body) {
  const name = text(body.name, 120);
  if (!name) throw new PublicError("Enter a name for the board.");
  const seconds = Number(body.takeoverSeconds ?? 60);
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 600) {
    throw new PublicError("Takeover seconds must be a whole number from 10 to 600.");
  }
  const callFilter = oneOf(body.callFilter, CALL_FILTERS, "all");
  const requested = Array.isArray(body.filterGeofenceIds)
    ? [...new Set(body.filterGeofenceIds.map((id) => text(id, 60)).filter(Boolean))].slice(0, 50)
    : [];
  if (requested.length > 0) {
    const found = await prisma.geofence.findMany({
      where: { tenantId, deletedAt: null, id: { in: requested } },
      select: { id: true },
    });
    if (found.length !== requested.length) throw new PublicError("A chosen district was not found.");
  }
  if (callFilter === "districts" && requested.length === 0) {
    throw new PublicError("Choose at least one district, or show all department calls.");
  }
  const panels = body.panels && typeof body.panels === "object" ? body.panels : {};
  return {
    name,
    stationName: text(body.stationName, 120),
    callFilter,
    filterGeofenceIds: callFilter === "districts" ? requested : [],
    takeoverSeconds: seconds,
    soundOn: body.soundOn !== false,
    layoutJson: {
      panels: Object.fromEntries(BOARD_PANELS.map((key) => [key, panels[key] !== false])),
      grid: readGrid(body.layout),
    },
  };
}

function serializeAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    important: row.important,
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    updatedAt: iso(row.updatedAt),
    updatedBy: row.updatedBy,
  };
}

function readAnnouncement(body) {
  const title = text(body.title, 200);
  if (!title) throw new PublicError("Enter a title for the message.");
  const startsAt = parseTimestamp(body.startsAt, "the start");
  const endsAt = parseTimestamp(body.endsAt, "the end");
  if (startsAt && endsAt && endsAt < startsAt) throw new PublicError("The end must be after the start.");
  return { title, body: text(body.body, 2000), important: body.important === true, startsAt, endsAt };
}

function serializeEvent(row) {
  const details = detailsOf(row);
  return {
    id: row.id,
    title: row.title,
    startsAt: iso(row.startsAt),
    location: text(details.location, 200),
    notes: text(details.notes, 1000),
    updatedAt: iso(row.updatedAt),
    updatedBy: row.updatedBy,
  };
}

function readEvent(body) {
  const title = text(body.title, 200);
  if (!title) throw new PublicError("Enter a title for the event.");
  return {
    title,
    startsAt: parseTimestamp(body.startsAt, "a start date and time", { required: true }),
    detailsJson: { location: text(body.location, 200), notes: text(body.notes, 1000) },
  };
}

function registerList(app, prisma, { path, model, label, read, serialize, orderBy, skipGet = false }) {
  if (!skipGet) {
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
  }

  app.post(path, async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const data = await read(prisma, tenantId, request.body ?? {});
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
      const data = await read(prisma, tenantId, request.body ?? {});
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

async function departmentInfo(prisma, request) {
  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId: request.tenant.id },
    select: { departmentName: true, payloadJson: true },
  });
  const payload = payloadOf(details);
  const shared = payload.sharedDepartmentSettings && typeof payload.sharedDepartmentSettings === "object" ? payload.sharedDepartmentSettings : {};
  return {
    payload,
    name: text(details?.departmentName, 200) || text(request.tenant?.name, 200) || "Fire Department",
    logoDataUrl: typeof shared.logoDataUrl === "string" && shared.logoDataUrl.startsWith("data:image/") ? shared.logoDataUrl : "",
  };
}

function boardDate(query, now) {
  const raw = String(query.date ?? "").trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date(now).toISOString().slice(0, 10);
  const minuteRaw = Number(query.minute);
  const fallbackMinute = new Date(now).getUTCHours() * 60 + new Date(now).getUTCMinutes();
  const minute = Number.isInteger(minuteRaw) && minuteRaw >= 0 && minuteRaw < 1440 ? minuteRaw : fallbackMinute;
  const [year, month, day] = date.split("-").map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  return { date, yesterday, minute };
}

/** Department apparatus with In Service / Out of Service from maintenance. A board with a station shows that station's units. */
export function boardApparatus(payload, statusRows, stationName) {
  const stationByUnit = new Map();
  for (const record of records(payload.schedulerApparatusRecords)) {
    const name = text(record.apparatus, 120);
    if (name && text(record.station, 120)) stationByUnit.set(name.toLowerCase(), text(record.station, 120));
  }
  const master = records(payload.masterApparatusRecords);
  const source = master.length > 0 ? master : records(payload.apparatusRecords);
  const seen = new Set();
  const units = [];
  for (const record of source) {
    const unitId = text(record.unitId, 120);
    const commonName = text(record.commonName, 120);
    const key = unitId || commonName;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    units.push({
      unitId: key,
      label: commonName && unitId && commonName !== unitId ? `${unitId} - ${commonName}` : key,
      station: stationByUnit.get(unitId.toLowerCase()) ?? stationByUnit.get(commonName.toLowerCase()) ?? "",
    });
  }
  for (const status of statusRows) {
    if (!seen.has(status.unitId)) {
      seen.add(status.unitId);
      units.push({ unitId: status.unitId, label: status.unitId, station: "" });
    }
  }
  const atStation = stationName ? units.filter((unit) => sameText(unit.station, stationName)) : [];
  const shown = atStation.length > 0 ? atStation : units;
  const statusById = new Map(statusRows.map((row) => [row.unitId, row]));
  return shown
    .map((unit) => {
      const status = statusById.get(unit.unitId);
      return {
        ...unit,
        status: status?.status ?? "In Service",
        outOfServiceSince: status?.outOfServiceSince ?? "",
        outOfServiceReason: status?.outOfServiceReason ?? "",
      };
    })
    .sort((a, b) => a.unitId.localeCompare(b.unitId, undefined, { numeric: true }));
}

/** Crew on the schedule right now, by apparatus. A shift that started yesterday and runs past midnight counts. */
export function boardOnDuty(payload, scheduleRows, { date, yesterday, minute }, stationName) {
  const department = readTradeDepartment(payload);
  const { assignments, slotSegments } = scheduleSnapshotFromRows(scheduleRows);
  const seats = [
    ...allApparatusPlacements(date, assignments, slotSegments, department.shiftEntries).filter(
      (seat) => seat.start <= minute && minute < seat.end,
    ),
    ...allApparatusPlacements(yesterday, assignments, slotSegments, department.shiftEntries).filter(
      (seat) => seat.start <= minute + 1440 && minute + 1440 < seat.end,
    ),
  ];
  const stationByUnit = new Map();
  for (const record of records(payload.schedulerApparatusRecords)) {
    const name = text(record.apparatus, 120);
    if (name) stationByUnit.set(name, text(record.station, 120));
  }
  const byUnit = new Map();
  const shifts = new Set();
  for (const seat of seats.sort((a, b) => a.slotIndex - b.slotIndex)) {
    const station = stationByUnit.get(seat.unitId) ?? "";
    if (stationName && station && !sameText(station, stationName)) continue;
    if (!byUnit.has(seat.unitId)) byUnit.set(seat.unitId, { unit: seat.unitId, station, people: [] });
    const entry = byUnit.get(seat.unitId);
    if (!entry.people.some((name) => sameText(name, seat.name))) entry.people.push(seat.name);
    if (seat.shiftType) shifts.add(seat.shiftType);
  }
  return { shifts: [...shifts].sort(), units: [...byUnit.values()] };
}

function serializeFeedIncident(row, point, districtUnknown) {
  return {
    id: row.id,
    incidentNumber: row.incidentNumber ?? "",
    incidentType: row.incidentType ?? "",
    priority: row.priority ?? "",
    address: row.address ?? "",
    stillDistrict: row.stillDistrict ?? "",
    assignedUnits: row.assignedUnits ?? "",
    receivedAt: row.receivedAt ?? "",
    currentState: row.currentState ?? "",
    createdAt: iso(row.createdAt),
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    districtUnknown,
  };
}

/**
 * Calls for the board, newest first. A district board keeps calls whose Census point is inside a chosen
 * district, or whose district text names one. A call with no point yet stays on the board, marked, so a
 * failed address lookup never hides a call.
 */
async function boardIncidents(prisma, tenantId, board, payload, geocode, now) {
  const rows = await prisma.incident.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  if (board.callFilter !== "districts" || board.filterGeofenceIds.length === 0) {
    return rows.slice(0, FEED_INCIDENTS).map((row) => serializeFeedIncident(row, savedPoint(row, now), false));
  }
  const districts = await prisma.geofence.findMany({
    where: { tenantId, deletedAt: null, id: { in: board.filterGeofenceIds } },
  });
  let lookups = DISTRICT_LOOKUPS_PER_FEED;
  const kept = [];
  for (const row of rows) {
    if (kept.length >= FEED_INCIDENTS) break;
    let point = savedPoint(row, now);
    if (!point && lookups > 0) {
      lookups -= 1;
      point = await ensureIncidentPoint(prisma, tenantId, row, { geocode, payload, now });
    }
    const namedDistrict = districts.some((area) => row.stillDistrict && sameText(area.name, row.stillDistrict));
    if (point) {
      if (namedDistrict || pointInGeofences(point.latitude, point.longitude, districts).length > 0) {
        kept.push(serializeFeedIncident(row, point, false));
      }
    } else {
      kept.push(serializeFeedIncident(row, null, !namedDistrict));
    }
  }
  return kept;
}

export function register(app, prisma, { geocode = censusGeocode } = {}) {
  app.get("/api/displays/boards", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const rows = await prisma.displayBoard.findMany({ where: { tenantId, deletedAt: null }, orderBy: { name: "asc" } });
      response.json({ ok: true, data: rows.map(serializeBoard) });
    } catch (error) {
      sendError(response, error, "Could not load display boards.");
    }
  });

  app.get("/api/displays/boards/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const row = await prisma.displayBoard.findFirst({ where: { id: request.params.id, tenantId, deletedAt: null } });
      if (!row) {
        response.status(404).json({ ok: false, message: "That display board was not found." });
        return;
      }
      const department = await departmentInfo(prisma, request);
      response.json({
        ok: true,
        data: {
          board: serializeBoard(row),
          department: { name: department.name, logoDataUrl: department.logoDataUrl },
          stationAddress: stationAddress(department.payload, row.stationName),
        },
      });
    } catch (error) {
      sendError(response, error, "Could not load the display board.");
    }
  });

  app.get("/api/displays/boards/:id/feed", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const board = await prisma.displayBoard.findFirst({ where: { id: request.params.id, tenantId, deletedAt: null } });
      if (!board) {
        response.status(404).json({ ok: false, message: "That display board was not found." });
        return;
      }
      const now = Date.now();
      const when = boardDate(request.query, now);
      const department = await departmentInfo(prisma, request);
      await clearOldIncidentPoints(prisma, tenantId, now);
      const [statusRows, scheduleRows, incidents, eventRows, announcementRows] = await Promise.all([
        apparatusStatusFor(prisma, tenantId),
        prisma.scheduleAssignments.findMany({
          where: { tenantId, dateKey: { in: [when.date, when.yesterday] } },
          select: { shiftType: true, dateKey: true, assignmentsJson: true },
        }),
        boardIncidents(prisma, tenantId, board, department.payload, geocode, now),
        prisma.displayEvent.findMany({
          where: { tenantId, deletedAt: null, startsAt: { gte: new Date(now - EVENT_LOOKBACK_MS) } },
          orderBy: { startsAt: "asc" },
          take: 8,
        }),
        prisma.announcement.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 50 }),
      ]);
      const announcements = announcementRows
        .filter((row) => (!row.startsAt || row.startsAt.getTime() <= now) && (!row.endsAt || row.endsAt.getTime() >= now))
        .sort((a, b) => Number(b.important) - Number(a.important))
        .map(serializeAnnouncement);
      response.json({
        ok: true,
        data: {
          serverTime: new Date(now).toISOString(),
          apparatus: boardApparatus(department.payload, statusRows, board.stationName),
          onDuty: boardOnDuty(department.payload, scheduleRows, when, board.stationName),
          incidents,
          events: eventRows.map(serializeEvent),
          announcements,
        },
      });
    } catch (error) {
      sendError(response, error, "Could not load the display board.");
    }
  });

  /** The newest few calls only, so a board can check every few seconds and open the takeover without loading the full feed. */
  app.get("/api/displays/boards/:id/pulse", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const board = await prisma.displayBoard.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!board) {
        response.status(404).json({ ok: false, message: "That display board was not found." });
        return;
      }
      const now = Date.now();
      const rows = await prisma.incident.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: PULSE_INCIDENTS,
      });
      response.json({ ok: true, data: { latest: rows.map((row) => serializeFeedIncident(row, savedPoint(row, now), false)) } });
    } catch (error) {
      sendError(response, error, "Could not check for new calls.");
    }
  });

  app.post("/api/maps/incident-location", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const incidentId = text(request.body?.incidentId, 60);
      const row = incidentId
        ? await prisma.incident.findFirst({ where: { id: incidentId, tenantId, deletedAt: null } })
        : null;
      if (!row) {
        response.status(404).json({ ok: false, message: "That call was not found." });
        return;
      }
      const department = await departmentInfo(prisma, request);
      const point = await ensureIncidentPoint(prisma, tenantId, row, { geocode, payload: department.payload });
      response.json({
        ok: true,
        data: { address: row.address ?? "", latitude: point?.latitude ?? null, longitude: point?.longitude ?? null },
      });
    } catch (error) {
      sendError(response, error, "Could not place the call on the map.");
    }
  });

  registerList(app, prisma, {
    path: "/api/displays/boards",
    model: "displayBoard",
    label: "display board",
    read: readBoard,
    serialize: serializeBoard,
    orderBy: { name: "asc" },
    skipGet: true,
  });
  registerList(app, prisma, {
    path: "/api/displays/announcements",
    model: "announcement",
    label: "message",
    read: (_prisma, _tenantId, body) => readAnnouncement(body),
    serialize: serializeAnnouncement,
    orderBy: { createdAt: "desc" },
  });
  registerList(app, prisma, {
    path: "/api/displays/events",
    model: "displayEvent",
    label: "event",
    read: (_prisma, _tenantId, body) => readEvent(body),
    serialize: serializeEvent,
    orderBy: { startsAt: "desc" },
  });
}
