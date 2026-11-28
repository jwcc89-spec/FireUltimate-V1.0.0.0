/**
 * Bulk property import from the spreadsheet template, one property per row.
 * POST /api/prevention/properties/import with { rows, commit, skipDuplicates }.
 * Without commit it only checks the rows (the preview). Needs prevention.manage; every query filters on tenant.
 * Rows without latitude and longitude are saved without a pin; nothing is looked up in bulk.
 */
import { randomUUID } from "node:crypto";
import { PublicError } from "../http/publicError.mjs";
import { normalizeAddress } from "./addressMatch.mjs";
import { actorOf, sendError, tenantIdOf, text } from "./moduleHelpers.mjs";
import { assertCoordinatesPaired, contactFields, propertyFields } from "./prevention.mjs";
import { OCCUPANCY_TYPES, PROPERTY_TYPES } from "./preventionDefaults.mjs";

export const MAX_IMPORT_ROWS = 1000;

const OWNER_KEYS = ["ownerFirstName", "ownerLastName", "ownerBusinessName", "ownerPhone", "ownerEmail"];

function duplicateKey(normalized, unit) {
  return `${normalized}|${String(unit ?? "").trim().toUpperCase()}`;
}

/** Turns one spreadsheet row into the same fields a person would type, with friendly errors. */
export function checkRow(raw) {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const typeText = text(row.propertyType, 40).toLowerCase();
  if (typeText && !PROPERTY_TYPES.includes(typeText)) {
    throw new PublicError("Property Type must be Residential or Commercial.");
  }
  const occupancyText = text(row.occupancyType, 80);
  const occupancy = OCCUPANCY_TYPES.find((entry) => entry.toLowerCase() === occupancyText.toLowerCase()) ?? "";
  if (occupancyText && !occupancy) throw new PublicError(`Occupancy Type "${occupancyText}" is not in the list.`);
  const property = propertyFields(
    { ...row, propertyType: typeText || "residential", occupancyType: occupancy, photo: "", streetViewPanoId: "" },
    { partial: false, previousDetails: {} },
  );
  if (!property.address) throw new PublicError("Address is empty.");
  assertCoordinatesPaired(property.latitude, property.longitude);
  const hasOwner = OWNER_KEYS.some((key) => text(row[key], 200));
  const owner = hasOwner
    ? contactFields(
        {
          firstName: row.ownerFirstName,
          lastName: row.ownerLastName,
          businessName: row.ownerBusinessName,
          phone: row.ownerPhone,
          email: row.ownerEmail,
          role: "Owner",
          isPrimary: true,
        },
        { partial: false, previousDetails: {} },
      )
    : null;
  if (owner && !owner.firstName && !owner.lastName && !owner.businessName) {
    throw new PublicError("The owner needs a first, last or business name.");
  }
  return { property, owner };
}

export function register(app, prisma) {
  app.post("/api/prevention/properties/import", async (request, response) => {
    const tenantId = tenantIdOf(request, response);
    if (!tenantId) return;
    try {
      const rows = request.body?.rows;
      if (!Array.isArray(rows) || rows.length === 0) throw new PublicError("The file has no property rows.");
      if (rows.length > MAX_IMPORT_ROWS) {
        throw new PublicError(`Import up to ${MAX_IMPORT_ROWS} properties at a time.`);
      }
      const commit = request.body?.commit === true;
      const skipDuplicates = request.body?.skipDuplicates !== false;
      const existing = await prisma.property.findMany({
        where: { tenantId, deletedAt: null },
        select: { normalizedAddress: true, unit: true },
      });
      const known = new Set(existing.map((row) => duplicateKey(row.normalizedAddress, row.unit)));
      const seen = new Set();
      const results = rows.map((raw, index) => {
        try {
          const checked = checkRow(raw);
          const key = duplicateKey(normalizeAddress(checked.property.address), checked.property.unit);
          const duplicate = known.has(key) ? "existing" : seen.has(key) ? "file" : "";
          seen.add(key);
          return { index, ok: true, error: "", duplicate, address: checked.property.address, checked };
        } catch (error) {
          const message = error instanceof PublicError ? error.message : "This row could not be read.";
          return { index, ok: false, error: message, duplicate: "", address: text(raw?.address, 300), checked: null };
        }
      });

      let created = 0;
      if (commit) {
        const actor = actorOf(request);
        const toSave = results.filter((result) => result.ok && !(skipDuplicates && result.duplicate));
        const properties = [];
        const contacts = [];
        for (const result of toSave) {
          const id = randomUUID();
          properties.push({ ...result.checked.property, id, tenantId, createdBy: actor, updatedBy: actor });
          if (result.checked.owner) {
            contacts.push({ ...result.checked.owner, id: randomUUID(), tenantId, propertyId: id, createdBy: actor, updatedBy: actor });
          }
        }
        const writes = [];
        if (properties.length > 0) writes.push(prisma.property.createMany({ data: properties }));
        if (contacts.length > 0) writes.push(prisma.propertyContact.createMany({ data: contacts }));
        if (writes.length > 0) await prisma.$transaction(writes);
        created = properties.length;
      }

      response.json({
        ok: true,
        data: {
          committed: commit,
          created,
          rows: results.map(({ index, ok, error, duplicate, address }) => ({ index, ok, error, duplicate, address })),
        },
      });
    } catch (error) {
      sendError(response, error, "Could not import the properties.");
    }
  });
}
