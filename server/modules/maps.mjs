/**
 * Map markers, marker types, and geofences.
 * Reads, address lookup, and district checks are open to any signed-in member.
 * Creating, moving, and deleting markers and geofences requires maps.manage
 * (mapped in permissionForRequest). Every query filters on request.tenant.id.
 *
 * Coordinates saved here are pins the department placed, or Census points used
 * only for the district check. Google geocodes are not stored.
 */
import { PublicError } from "../http/publicError.mjs";
import { DEFAULT_MARKER_TYPES, GEOFENCE_KINDS, MARKER_ICONS } from "./mapDefaults.mjs";
import { censusGeocode, normalizeGeometry, parseCoordinate, pointInGeofences } from "./mapsGeometry.mjs";
import {
  actorOf,
  detailsOf,
  isUniqueViolation,
  oneOf,
  sendError,
  tenantIdOf,
  text,
} from "./moduleHelpers.mjs";

const MAX_DOCUMENT_CHARS = 2_000_000;
const MAX_DOCUMENTS_TOTAL_CHARS = 3_000_000;
const DOCUMENT_PREFIXES = ["data:application/pdf", "data:image/jpeg", "data:image/jpg", "data:image/png", "data:image/webp"];

function colorOf(value, fallback) {
  const raw = String(value ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [red, green, blue] = raw.slice(1).split("");
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
  }
  return fallback;
}

function parseFlow(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 20000) {
    throw new PublicError("Flow must be a number of gallons per minute, or left blank.");
  }
  return Math.round(number);
}

function cleanDocuments(raw, previous, actor) {
  if (!Array.isArray(raw)) return Array.isArray(previous) ? previous : [];
  const previousById = new Map((Array.isArray(previous) ? previous : []).map((item) => [item.id, item]));
  const documents = [];
  let total = 0;
  for (const entry of raw.slice(0, 8)) {
    const kept = entry?.id ? previousById.get(String(entry.id)) : null;
    if (kept) {
      documents.push(kept);
      total += String(kept.dataUrl ?? "").length;
      continue;
    }
    const dataUrl = String(entry?.dataUrl ?? "");
    const header = dataUrl.slice(0, dataUrl.indexOf(",")).toLowerCase();
    if (!DOCUMENT_PREFIXES.some((prefix) => header.startsWith(prefix))) {
      throw new PublicError("Documents must be a PDF or a picture.");
    }
    if (dataUrl.length > MAX_DOCUMENT_CHARS) {
      throw new PublicError("Each document must be smaller than about 1.5 MB for now.");
    }
    total += dataUrl.length;
    documents.push({
      id: `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: text(entry?.name, 200) || "Document",
      type: text(entry?.type, 100),
      size: Number(entry?.size) || 0,
      dataUrl,
      addedBy: actor,
      addedAt: new Date().toISOString(),
    });
  }
  if (total > MAX_DOCUMENTS_TOTAL_CHARS) {
    throw new PublicError("Documents on one record must total less than about 2 MB for now.");
  }
  return documents;
}

async function nameDirectory(prisma, tenantId) {
  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId },
    select: { payloadJson: true },
  });
  const names = details?.payloadJson?.userFullNames;
  const directory = new Map();
  if (names && typeof names === "object" && !Array.isArray(names)) {
    for (const [username, fullName] of Object.entries(names)) {
      const cleaned = text(fullName, 200);
      if (username.trim() && cleaned) directory.set(username.trim().toLowerCase(), cleaned);
    }
  }
  return directory;
}

function displayName(directory, username) {
  const raw = text(username, 200);
  return directory.get(raw.toLowerCase()) || raw;
}

function stamp(value) {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function serializeType(row) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    isSystem: row.isSystem === true,
  };
}

function serializeMarker(row, directory, departmentName) {
  const details = detailsOf(row);
  const type = row.markerType && row.markerType.deletedAt == null ? row.markerType : null;
  return {
    id: row.id,
    markerTypeId: type?.id ?? "",
    typeName: type?.name ?? "",
    icon: type?.icon ?? "marker",
    color: type?.color ?? "#2563eb",
    latitude: row.latitude,
    longitude: row.longitude,
    label: row.label,
    notes: text(details.notes, 4000),
    address: text(details.address, 300),
    flowGpm: typeof details.flowGpm === "number" ? details.flowGpm : null,
    documents: Array.isArray(details.documents) ? details.documents : [],
    updatedAt: stamp(row.updatedAt),
    updatedByName: displayName(directory, row.updatedBy),
    departmentName,
  };
}

function serializeGeofence(row, directory, departmentName, parentName = "") {
  const details = detailsOf(row);
  const feature = row.geometryJson;
  const geometry = feature?.type === "Feature" ? feature.geometry : feature;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    color: row.color,
    parentId: row.parentId ?? "",
    parentName,
    geometry,
    linkedPropertyId: row.linkedPropertyId,
    linkedPrePlanId: row.linkedPrePlanId,
    documents: Array.isArray(details.documents) ? details.documents : [],
    updatedAt: stamp(row.updatedAt),
    updatedByName: displayName(directory, row.updatedBy),
    departmentName,
  };
}

function shortGeofence(row) {
  return { id: row.id, name: row.name, kind: row.kind, color: row.color };
}

async function ensureDefaultTypes(prisma, tenantId) {
  const existing = await prisma.mapMarkerType.findMany({ where: { tenantId }, select: { name: true } });
  const names = new Set(existing.map((row) => row.name.trim().toLowerCase()));
  const missing = DEFAULT_MARKER_TYPES.filter((item) => !names.has(item.name.toLowerCase()));
  if (missing.length === 0) return;
  await prisma.mapMarkerType.createMany({
    data: missing.map((item) => ({
      tenantId,
      name: item.name,
      icon: item.icon,
      color: item.color,
      isSystem: true,
      createdBy: "system",
      updatedBy: "system",
    })),
    skipDuplicates: true,
  });
}

async function assertParent(prisma, tenantId, parentId, selfId) {
  if (!parentId) return;
  if (parentId === selfId) throw new PublicError("An area cannot be inside itself.");
  let current = parentId;
  const seen = new Set();
  for (let depth = 0; depth < 12; depth += 1) {
    if (current === selfId) throw new PublicError("An area cannot be inside itself.");
    if (seen.has(current)) return;
    seen.add(current);
    const row = await prisma.geofence.findFirst({
      where: { id: current, tenantId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!row) throw new PublicError("The parent area was not found.");
    if (!row.parentId) return;
    current = row.parentId;
  }
  throw new PublicError("That area is nested too deeply.");
}

async function parentNames(prisma, tenantId, rows) {
  const ids = rows.map((row) => row.parentId).filter(Boolean);
  if (ids.length === 0) return new Map();
  const parents = await prisma.geofence.findMany({
    where: { tenantId, deletedAt: null, id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(parents.map((row) => [row.id, row.name]));
}

function markerFields(body, { partial, previous, actor }) {
  const has = (key) => Object.prototype.hasOwnProperty.call(body ?? {}, key);
  const data = {};
  const details = { ...previous };
  let detailsChanged = false;
  if (!partial || has("label")) data.label = text(body.label, 200);
  if (!partial || has("latitude")) data.latitude = parseCoordinate(body.latitude, "Latitude", -90, 90);
  if (!partial || has("longitude")) data.longitude = parseCoordinate(body.longitude, "Longitude", -180, 180);
  if (!partial || has("markerTypeId")) data.markerTypeId = text(body.markerTypeId, 80) || null;
  if (!partial || has("notes")) {
    details.notes = text(body.notes, 4000);
    detailsChanged = true;
  }
  if (!partial || has("address")) {
    details.address = text(body.address, 300);
    detailsChanged = true;
  }
  if (!partial || has("flowGpm")) {
    details.flowGpm = parseFlow(body.flowGpm);
    detailsChanged = true;
  }
  if (!partial || has("documents")) {
    details.documents = cleanDocuments(body.documents, previous.documents, actor);
    detailsChanged = true;
  }
  if (!partial || detailsChanged) data.detailsJson = details;
  return data;
}

function geofenceFields(body, { partial, previous, actor }) {
  const has = (key) => Object.prototype.hasOwnProperty.call(body ?? {}, key);
  const data = {};
  const details = { ...previous };
  let detailsChanged = false;
  if (!partial || has("name")) data.name = text(body.name, 200);
  if (!partial || has("description")) data.description = text(body.description, 4000);
  if (!partial || has("kind")) data.kind = oneOf(body.kind, GEOFENCE_KINDS, "custom");
  if (!partial || has("color")) data.color = colorOf(body.color, "#dc2626");
  if (!partial || has("parentId")) data.parentId = text(body.parentId, 80) || null;
  if (!partial || has("geometry")) data.geometryJson = normalizeGeometry(body.geometry);
  if (!partial || has("linkedPropertyId")) data.linkedPropertyId = text(body.linkedPropertyId, 80);
  if (!partial || has("linkedPrePlanId")) data.linkedPrePlanId = text(body.linkedPrePlanId, 80);
  if (!partial || has("documents")) {
    details.documents = cleanDocuments(body.documents, previous.documents, actor);
    detailsChanged = true;
  }
  if (!partial || detailsChanged) data.detailsJson = details;
  return data;
}

export function register(app, prisma) {
  app.get("/api/maps/marker-types", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      await ensureDefaultTypes(prisma, tenantId);
      const rows = await prisma.mapMarkerType.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { name: "asc" },
      });
      response.json({ ok: true, data: rows.map(serializeType) });
    } catch (error) {
      sendError(response, error, "Could not load marker types.");
    }
  });

  app.post("/api/maps/marker-types", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const name = text(request.body?.name, 120);
      if (!name) throw new PublicError("Enter a name for the marker type.");
      const data = {
        name,
        icon: oneOf(request.body?.icon, MARKER_ICONS, "marker"),
        color: colorOf(request.body?.color, "#2563eb"),
      };
      const previous = await prisma.mapMarkerType.findFirst({ where: { tenantId, name } });
      if (previous && !previous.deletedAt) {
        response.status(409).json({ ok: false, message: "A marker type with that name already exists." });
        return;
      }
      const row = previous
        ? await prisma.mapMarkerType.update({
            where: { id: previous.id },
            data: { ...data, deletedAt: null, updatedBy: actor },
          })
        : await prisma.mapMarkerType.create({
            data: { ...data, tenantId, isSystem: false, createdBy: actor, updatedBy: actor },
          });
      response.status(201).json({ ok: true, data: serializeType(row) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        response.status(409).json({ ok: false, message: "A marker type with that name already exists." });
        return;
      }
      sendError(response, error, "Could not save the marker type.");
    }
  });

  app.patch("/api/maps/marker-types/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const body = request.body ?? {};
      const data = { updatedBy: actorOf(request) };
      if (Object.prototype.hasOwnProperty.call(body, "name")) {
        data.name = text(body.name, 120);
        if (!data.name) throw new PublicError("Enter a name for the marker type.");
      }
      if (Object.prototype.hasOwnProperty.call(body, "icon")) data.icon = oneOf(body.icon, MARKER_ICONS, "marker");
      if (Object.prototype.hasOwnProperty.call(body, "color")) data.color = colorOf(body.color, "#2563eb");
      const result = await prisma.mapMarkerType.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data,
      });
      if (result.count === 0) {
        response.status(404).json({ ok: false, message: "That marker type was not found." });
        return;
      }
      const row = await prisma.mapMarkerType.findFirst({ where: { id: request.params.id, tenantId } });
      response.json({ ok: true, data: serializeType(row) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        response.status(409).json({ ok: false, message: "A marker type with that name already exists." });
        return;
      }
      sendError(response, error, "Could not save the marker type.");
    }
  });

  app.delete("/api/maps/marker-types/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const inUse = await prisma.mapMarker.count({
        where: { tenantId, markerTypeId: request.params.id, deletedAt: null },
      });
      if (inUse > 0) {
        throw new PublicError("Move or delete the markers that use this type first.");
      }
      const result = await prisma.mapMarkerType.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) {
        response.status(404).json({ ok: false, message: "That marker type was not found." });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the marker type.");
    }
  });

  app.get("/api/maps/markers", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const directory = await nameDirectory(prisma, tenantId);
      const rows = await prisma.mapMarker.findMany({
        where: { tenantId, deletedAt: null },
        include: { markerType: true },
        orderBy: { label: "asc" },
      });
      const departmentName = text(request.tenant?.name, 200);
      response.json({ ok: true, data: rows.map((row) => serializeMarker(row, directory, departmentName)) });
    } catch (error) {
      sendError(response, error, "Could not load markers.");
    }
  });

  app.post("/api/maps/markers", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const data = markerFields(request.body, { partial: false, previous: {}, actor });
      if (!data.label) throw new PublicError("Enter a name for the marker.");
      if (data.markerTypeId) {
        const type = await prisma.mapMarkerType.findFirst({
          where: { id: data.markerTypeId, tenantId, deletedAt: null },
          select: { id: true },
        });
        if (!type) throw new PublicError("That marker type was not found.");
      }
      const created = await prisma.mapMarker.create({
        data: { ...data, tenantId, createdBy: actor, updatedBy: actor },
      });
      const row = await prisma.mapMarker.findFirst({
        where: { id: created.id, tenantId },
        include: { markerType: true },
      });
      const directory = await nameDirectory(prisma, tenantId);
      response.status(201).json({
        ok: true,
        data: serializeMarker(row, directory, text(request.tenant?.name, 200)),
      });
    } catch (error) {
      sendError(response, error, "Could not save the marker.");
    }
  });

  app.patch("/api/maps/markers/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const current = await prisma.mapMarker.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
      });
      if (!current) {
        response.status(404).json({ ok: false, message: "That marker was not found." });
        return;
      }
      const data = markerFields(request.body, { partial: true, previous: detailsOf(current), actor });
      if (data.label === "") throw new PublicError("Enter a name for the marker.");
      if (data.markerTypeId) {
        const type = await prisma.mapMarkerType.findFirst({
          where: { id: data.markerTypeId, tenantId, deletedAt: null },
          select: { id: true },
        });
        if (!type) throw new PublicError("That marker type was not found.");
      }
      await prisma.mapMarker.updateMany({
        where: { id: current.id, tenantId, deletedAt: null },
        data: { ...data, updatedBy: actor },
      });
      const row = await prisma.mapMarker.findFirst({
        where: { id: current.id, tenantId },
        include: { markerType: true },
      });
      const directory = await nameDirectory(prisma, tenantId);
      response.json({ ok: true, data: serializeMarker(row, directory, text(request.tenant?.name, 200)) });
    } catch (error) {
      sendError(response, error, "Could not save the marker.");
    }
  });

  app.delete("/api/maps/markers/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.mapMarker.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) {
        response.status(404).json({ ok: false, message: "That marker was not found." });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the marker.");
    }
  });

  app.get("/api/geofences", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const directory = await nameDirectory(prisma, tenantId);
      const rows = await prisma.geofence.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { name: "asc" },
      });
      const names = await parentNames(prisma, tenantId, rows);
      const departmentName = text(request.tenant?.name, 200);
      response.json({
        ok: true,
        data: rows.map((row) => serializeGeofence(row, directory, departmentName, names.get(row.parentId) ?? "")),
      });
    } catch (error) {
      sendError(response, error, "Could not load geofences.");
    }
  });

  app.post("/api/geofences", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const data = geofenceFields(request.body, { partial: false, previous: {}, actor });
      if (!data.name) throw new PublicError("Enter a name for the area.");
      if (!data.geometryJson) throw new PublicError("Draw an area before saving.");
      await assertParent(prisma, tenantId, data.parentId, null);
      const created = await prisma.geofence.create({
        data: { ...data, tenantId, createdBy: actor, updatedBy: actor },
      });
      const directory = await nameDirectory(prisma, tenantId);
      const parent = data.parentId
        ? await prisma.geofence.findFirst({ where: { id: data.parentId, tenantId, deletedAt: null }, select: { name: true } })
        : null;
      response.status(201).json({
        ok: true,
        data: serializeGeofence(created, directory, text(request.tenant?.name, 200), parent?.name ?? ""),
      });
    } catch (error) {
      sendError(response, error, "Could not save the area.");
    }
  });

  app.patch("/api/geofences/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const current = await prisma.geofence.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
      });
      if (!current) {
        response.status(404).json({ ok: false, message: "That area was not found." });
        return;
      }
      const data = geofenceFields(request.body, { partial: true, previous: detailsOf(current), actor });
      if (data.name === "") throw new PublicError("Enter a name for the area.");
      if (Object.prototype.hasOwnProperty.call(data, "parentId")) {
        await assertParent(prisma, tenantId, data.parentId, current.id);
      }
      await prisma.geofence.updateMany({
        where: { id: current.id, tenantId, deletedAt: null },
        data: { ...data, updatedBy: actor },
      });
      const row = await prisma.geofence.findFirst({ where: { id: current.id, tenantId } });
      const directory = await nameDirectory(prisma, tenantId);
      const parentId = row.parentId;
      const parent = parentId
        ? await prisma.geofence.findFirst({ where: { id: parentId, tenantId, deletedAt: null }, select: { name: true } })
        : null;
      response.json({
        ok: true,
        data: serializeGeofence(row, directory, text(request.tenant?.name, 200), parent?.name ?? ""),
      });
    } catch (error) {
      sendError(response, error, "Could not save the area.");
    }
  });

  app.delete("/api/geofences/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const existing = await prisma.geofence.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        response.status(404).json({ ok: false, message: "That area was not found." });
        return;
      }
      await prisma.geofence.updateMany({
        where: { tenantId, parentId: existing.id, deletedAt: null },
        data: { parentId: null, updatedBy: actor },
      });
      await prisma.geofence.updateMany({
        where: { id: existing.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actor },
      });
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the area.");
    }
  });

  app.post("/api/maps/geocode", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await censusGeocode(request.body?.address);
      response.json({ ok: true, data: result });
    } catch (error) {
      sendError(response, error, "Could not look up that address.");
    }
  });

  app.post("/api/maps/district", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const body = request.body ?? {};
      let latitude = null;
      let longitude = null;
      let matchedAddress = "";
      let source = "manual";
      const address = text(body.address, 300);
      if (address) {
        const lookedUp = await censusGeocode(address);
        latitude = lookedUp.latitude;
        longitude = lookedUp.longitude;
        matchedAddress = lookedUp.matchedAddress;
        source = "census";
      } else if (body.latitude !== undefined || body.longitude !== undefined) {
        latitude = parseCoordinate(body.latitude, "Latitude", -90, 90);
        longitude = parseCoordinate(body.longitude, "Longitude", -180, 180);
        source = "manual";
      } else {
        throw new PublicError("Enter an address, or drop a pin, to check the district.");
      }
      const rows = await prisma.geofence.findMany({ where: { tenantId, deletedAt: null } });
      const matches = pointInGeofences(latitude, longitude, rows).map(shortGeofence);
      const districts = rows.filter((row) => row.kind === "district").map(shortGeofence);
      response.json({
        ok: true,
        data: { latitude, longitude, matchedAddress, source, matches, districts },
      });
    } catch (error) {
      sendError(response, error, "Could not check the district.");
    }
  });
}
