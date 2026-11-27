/**
 * Fire Prevention: properties, their contacts, and call history by address.
 * Import is in preventionImport.mjs and pre-plans in preventionPrePlans.mjs.
 * Any member who can view incidents can read them (incidents.view); adding, editing and deleting
 * need prevention.manage (both mapped in permissionForRequest). Every query filters on request.tenant.id.
 *
 * The saved latitude and longitude are the pin a member placed or dragged, never a stored Google result.
 * Street View is saved as a camera position only; the picture always loads live from Google.
 */
import { PublicError } from "../http/publicError.mjs";
import { normalizeAddress } from "./addressMatch.mjs";
import { parseCoordinate } from "./mapsGeometry.mjs";
import { actorOf, detailsOf, formatDateOnly, oneOf, sendError, tenantIdOf, text } from "./moduleHelpers.mjs";
import { CONTACT_ROLES, OCCUPANCY_TYPES, PROPERTY_TYPES } from "./preventionDefaults.mjs";

const MAX_PHOTO_CHARS = 700_000;
const PHOTO_PREFIXES = ["data:image/jpeg", "data:image/jpg", "data:image/png", "data:image/webp"];

const LIST_SELECT = {
  id: true,
  name: true,
  address: true,
  unit: true,
  city: true,
  state: true,
  postalCode: true,
  propertyType: true,
  occupancyType: true,
  squareFeet: true,
  yearBuilt: true,
  latitude: true,
  longitude: true,
  updatedAt: true,
};

function has(body, key) {
  return Object.prototype.hasOwnProperty.call(body ?? {}, key);
}

function stamp(value) {
  return value instanceof Date ? value.toISOString() : "";
}

function wholeNumber(value, label, min, max) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new PublicError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return number;
}

function optionalNumber(value, label, min, max) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new PublicError(`${label} is not valid.`);
  return Math.round(number * 1000) / 1000;
}

function optionalCoordinate(value, label, min, max) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return parseCoordinate(value, label, min, max);
}

function cleanPhoto(value) {
  const dataUrl = String(value ?? "");
  if (!dataUrl) return "";
  const header = dataUrl.slice(0, Math.max(dataUrl.indexOf(","), 0)).toLowerCase();
  if (!PHOTO_PREFIXES.some((prefix) => header.startsWith(prefix))) {
    throw new PublicError("The building photo must be a JPEG, PNG or WebP picture.");
  }
  if (dataUrl.length > MAX_PHOTO_CHARS) {
    throw new PublicError("The building photo is too large. Pick a smaller picture.");
  }
  return dataUrl;
}

export function contactName(contact) {
  const person = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  return person || contact.businessName;
}

/** The owner shown in the properties list: the primary Owner, else any Owner, else the primary contact. */
function ownerNameOf(contacts) {
  const owners = contacts.filter((contact) => contact.role === "Owner");
  const pick =
    owners.find((contact) => contact.isPrimary) ?? owners[0] ?? contacts.find((contact) => contact.isPrimary) ?? null;
  return pick ? contactName(pick) : "";
}

function sortContacts(contacts) {
  return [...contacts].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return contactName(a).localeCompare(contactName(b));
  });
}

function serializeContact(row) {
  const details = detailsOf(row);
  return {
    id: row.id,
    propertyId: row.propertyId,
    firstName: row.firstName,
    lastName: row.lastName,
    businessName: row.businessName,
    role: row.role,
    isPrimary: row.isPrimary === true,
    phone: row.phone,
    email: row.email,
    addressStreet: row.addressStreet,
    addressUnit: row.addressUnit,
    addressCity: row.addressCity,
    addressState: row.addressState,
    addressZip: row.addressZip,
    notes: text(details.notes, 4000),
  };
}

function serializeSummary(row, contacts) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    unit: row.unit,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    propertyType: row.propertyType,
    occupancyType: row.occupancyType,
    squareFeet: row.squareFeet ?? null,
    yearBuilt: row.yearBuilt ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    ownerName: ownerNameOf(contacts),
    contactCount: contacts.length,
    updatedAt: stamp(row.updatedAt),
  };
}

function serializePrePlanSummary(row) {
  return {
    id: row.id,
    title: row.title,
    template: row.template,
    reviewedOn: formatDateOnly(row.reviewedOn),
    updatedAt: stamp(row.updatedAt),
  };
}

function serializeDetail(row, contacts, prePlans) {
  const details = detailsOf(row);
  return {
    ...serializeSummary(row, contacts),
    streetViewPanoId: row.streetViewPanoId,
    streetViewHeading: row.streetViewHeading ?? null,
    streetViewPitch: row.streetViewPitch ?? null,
    streetViewZoom: row.streetViewZoom ?? null,
    photo: row.photoRef,
    notes: text(details.notes, 8000),
    createdAt: stamp(row.createdAt),
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    contacts: sortContacts(contacts).map(serializeContact),
    prePlans: [...prePlans]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(serializePrePlanSummary),
  };
}

export function propertyFields(body, { partial, previousDetails }) {
  const data = {};
  const want = (key) => !partial || has(body, key);
  if (want("name")) data.name = text(body.name, 200);
  if (want("address")) {
    data.address = text(body.address, 300);
    data.normalizedAddress = normalizeAddress(data.address);
  }
  if (want("unit")) data.unit = text(body.unit, 60);
  if (want("city")) data.city = text(body.city, 120);
  if (want("state")) data.state = text(body.state, 40);
  if (want("postalCode")) data.postalCode = text(body.postalCode, 20);
  if (want("propertyType")) data.propertyType = oneOf(body.propertyType, PROPERTY_TYPES, "residential");
  if (want("occupancyType")) data.occupancyType = oneOf(body.occupancyType, OCCUPANCY_TYPES, "");
  if (want("squareFeet")) data.squareFeet = wholeNumber(body.squareFeet, "Square footage", 0, 100_000_000);
  if (want("yearBuilt")) {
    data.yearBuilt = wholeNumber(body.yearBuilt, "Year built", 1600, new Date().getUTCFullYear() + 5);
  }
  if (want("latitude")) data.latitude = optionalCoordinate(body.latitude, "Latitude", -90, 90);
  if (want("longitude")) data.longitude = optionalCoordinate(body.longitude, "Longitude", -180, 180);
  if (want("streetViewPanoId")) data.streetViewPanoId = text(body.streetViewPanoId, 200);
  if (want("streetViewHeading")) data.streetViewHeading = optionalNumber(body.streetViewHeading, "Street View heading", -360, 360);
  if (want("streetViewPitch")) data.streetViewPitch = optionalNumber(body.streetViewPitch, "Street View pitch", -90, 90);
  if (want("streetViewZoom")) data.streetViewZoom = optionalNumber(body.streetViewZoom, "Street View zoom", 0, 5);
  if (want("photo")) data.photoRef = cleanPhoto(body.photo);
  if (want("notes")) data.detailsJson = { ...previousDetails, notes: text(body.notes, 8000) };
  return data;
}

export function assertCoordinatesPaired(latitude, longitude) {
  if ((latitude == null) !== (longitude == null)) {
    throw new PublicError("Enter both latitude and longitude, or leave both blank.");
  }
}

export function contactFields(body, { partial, previousDetails }) {
  const data = {};
  const want = (key) => !partial || has(body, key);
  if (want("firstName")) data.firstName = text(body.firstName, 120);
  if (want("lastName")) data.lastName = text(body.lastName, 120);
  if (want("businessName")) data.businessName = text(body.businessName, 200);
  if (want("role")) data.role = oneOf(body.role, CONTACT_ROLES, "");
  if (want("isPrimary")) data.isPrimary = body.isPrimary === true;
  if (want("phone")) data.phone = text(body.phone, 40);
  if (want("email")) data.email = text(body.email, 200);
  if (want("addressStreet")) data.addressStreet = text(body.addressStreet, 300);
  if (want("addressUnit")) data.addressUnit = text(body.addressUnit, 60);
  if (want("addressCity")) data.addressCity = text(body.addressCity, 120);
  if (want("addressState")) data.addressState = text(body.addressState, 40);
  if (want("addressZip")) data.addressZip = text(body.addressZip, 20);
  if (want("notes")) data.detailsJson = { ...previousDetails, notes: text(body.notes, 4000) };
  return data;
}

async function contactsFor(prisma, tenantId, propertyIds) {
  if (propertyIds.length === 0) return [];
  return prisma.propertyContact.findMany({
    where: { tenantId, deletedAt: null, propertyId: { in: propertyIds } },
  });
}

async function loadDetail(prisma, tenantId, id) {
  const row = await prisma.property.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!row) return null;
  const contacts = await contactsFor(prisma, tenantId, [row.id]);
  const prePlans = await prisma.prePlan.findMany({
    where: { tenantId, propertyId: row.id, deletedAt: null },
    select: { id: true, title: true, template: true, reviewedOn: true, updatedAt: true },
  });
  return serializeDetail(row, contacts, prePlans);
}

/** Same building when the cleaned call address equals the property's, or starts with it (a city left on without a comma). */
export function addressMatches(propertyAddress, callAddress) {
  if (!propertyAddress || !callAddress) return false;
  return callAddress === propertyAddress || callAddress.startsWith(`${propertyAddress} `);
}

/** Only one primary contact per property. */
async function clearOtherPrimaries(prisma, tenantId, propertyId, keepId, actor) {
  await prisma.propertyContact.updateMany({
    where: { tenantId, propertyId, deletedAt: null, isPrimary: true, id: { not: keepId } },
    data: { isPrimary: false, updatedBy: actor },
  });
}

export function register(app, prisma) {
  app.get("/api/prevention/properties", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const rows = await prisma.property.findMany({
        where: { tenantId, deletedAt: null },
        select: LIST_SELECT,
        orderBy: { address: "asc" },
      });
      const contacts = await contactsFor(prisma, tenantId, rows.map((row) => row.id));
      const byProperty = new Map();
      for (const contact of contacts) {
        const list = byProperty.get(contact.propertyId) ?? [];
        list.push(contact);
        byProperty.set(contact.propertyId, list);
      }
      response.json({ ok: true, data: rows.map((row) => serializeSummary(row, byProperty.get(row.id) ?? [])) });
    } catch (error) {
      sendError(response, error, "Could not load properties.");
    }
  });

  app.get("/api/prevention/properties/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const detail = await loadDetail(prisma, tenantId, request.params.id);
      if (!detail) {
        response.status(404).json({ ok: false, message: "That property was not found." });
        return;
      }
      response.json({ ok: true, data: detail });
    } catch (error) {
      sendError(response, error, "Could not load the property.");
    }
  });

  app.get("/api/prevention/properties/:id/incidents", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const property = await prisma.property.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
        select: { id: true, normalizedAddress: true },
      });
      if (!property) {
        response.status(404).json({ ok: false, message: "That property was not found." });
        return;
      }
      const incidents = await prisma.incident.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          incidentNumber: true,
          dispatchNumber: true,
          incidentType: true,
          address: true,
          receivedAt: true,
          currentState: true,
          createdAt: true,
        },
      });
      const matched = incidents
        .filter((row) => addressMatches(property.normalizedAddress, normalizeAddress(row.address)))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const counts = new Map();
      for (const row of matched) {
        const type = row.incidentType || "Unknown";
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
      response.json({
        ok: true,
        data: {
          incidents: matched.map((row) => ({
            id: row.id,
            incidentNumber: row.incidentNumber ?? "",
            dispatchNumber: row.dispatchNumber ?? "",
            incidentType: row.incidentType,
            address: row.address,
            receivedAt: row.receivedAt,
            currentState: row.currentState,
            createdAt: stamp(row.createdAt),
          })),
          countsByType: [...counts.entries()]
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
        },
      });
    } catch (error) {
      sendError(response, error, "Could not load the call history.");
    }
  });

  app.post("/api/prevention/properties", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const data = propertyFields(request.body ?? {}, { partial: false, previousDetails: {} });
      if (!data.address) throw new PublicError("Enter the property's street address.");
      assertCoordinatesPaired(data.latitude, data.longitude);
      const created = await prisma.property.create({
        data: { ...data, tenantId, createdBy: actor, updatedBy: actor },
      });
      response.status(201).json({ ok: true, data: await loadDetail(prisma, tenantId, created.id) });
    } catch (error) {
      sendError(response, error, "Could not save the property.");
    }
  });

  app.patch("/api/prevention/properties/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const current = await prisma.property.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
      });
      if (!current) {
        response.status(404).json({ ok: false, message: "That property was not found." });
        return;
      }
      const data = propertyFields(request.body ?? {}, { partial: true, previousDetails: detailsOf(current) });
      if (data.address === "") throw new PublicError("Enter the property's street address.");
      assertCoordinatesPaired(
        has(data, "latitude") ? data.latitude : current.latitude,
        has(data, "longitude") ? data.longitude : current.longitude,
      );
      await prisma.property.updateMany({
        where: { id: current.id, tenantId, deletedAt: null },
        data: { ...data, updatedBy: actor },
      });
      response.json({ ok: true, data: await loadDetail(prisma, tenantId, current.id) });
    } catch (error) {
      sendError(response, error, "Could not save the property.");
    }
  });

  app.delete("/api/prevention/properties/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const result = await prisma.property.updateMany({
        where: { id: request.params.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      if (result.count === 0) {
        response.status(404).json({ ok: false, message: "That property was not found." });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      sendError(response, error, "Could not delete the property.");
    }
  });

  app.post("/api/prevention/properties/:id/contacts", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const property = await prisma.property.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!property) {
        response.status(404).json({ ok: false, message: "That property was not found." });
        return;
      }
      const data = contactFields(request.body ?? {}, { partial: false, previousDetails: {} });
      if (!contactName(data)) throw new PublicError("Enter a name or a business name for the contact.");
      const created = await prisma.propertyContact.create({
        data: { ...data, tenantId, propertyId: property.id, createdBy: actor, updatedBy: actor },
      });
      if (created.isPrimary) await clearOtherPrimaries(prisma, tenantId, property.id, created.id, actor);
      response.status(201).json({ ok: true, data: await loadDetail(prisma, tenantId, property.id) });
    } catch (error) {
      sendError(response, error, "Could not save the contact.");
    }
  });

  app.patch("/api/prevention/contacts/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const actor = actorOf(request);
      const current = await prisma.propertyContact.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
      });
      if (!current) {
        response.status(404).json({ ok: false, message: "That contact was not found." });
        return;
      }
      const data = contactFields(request.body ?? {}, { partial: true, previousDetails: detailsOf(current) });
      if (!contactName({ ...current, ...data })) {
        throw new PublicError("Enter a name or a business name for the contact.");
      }
      await prisma.propertyContact.updateMany({
        where: { id: current.id, tenantId, deletedAt: null },
        data: { ...data, updatedBy: actor },
      });
      if (data.isPrimary === true) await clearOtherPrimaries(prisma, tenantId, current.propertyId, current.id, actor);
      response.json({ ok: true, data: await loadDetail(prisma, tenantId, current.propertyId) });
    } catch (error) {
      sendError(response, error, "Could not save the contact.");
    }
  });

  app.delete("/api/prevention/contacts/:id", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const current = await prisma.propertyContact.findFirst({
        where: { id: request.params.id, tenantId, deletedAt: null },
        select: { id: true, propertyId: true },
      });
      if (!current) {
        response.status(404).json({ ok: false, message: "That contact was not found." });
        return;
      }
      await prisma.propertyContact.updateMany({
        where: { id: current.id, tenantId, deletedAt: null },
        data: { deletedAt: new Date(), updatedBy: actorOf(request) },
      });
      response.json({ ok: true, data: await loadDetail(prisma, tenantId, current.propertyId) });
    } catch (error) {
      sendError(response, error, "Could not delete the contact.");
    }
  });
}
