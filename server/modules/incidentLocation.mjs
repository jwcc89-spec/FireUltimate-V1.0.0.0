/**
 * Map point for a call address, cached on the incident for at most 30 days.
 * The point comes from the US Census geocoder, so district checks may use it.
 * Writing the point keeps the incident's updatedAt, so the call does not look edited.
 */
import { text } from "./moduleHelpers.mjs";

const POINT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 30 * 60 * 1000;
const CLEANUP_EVERY_MS = 60 * 60 * 1000;
const failedLookups = new Map();
const lastCleanup = new Map();

/** A saved point counts only while it is under 30 days old and the call has not been edited since. */
export function savedPoint(row, now = Date.now()) {
  if (row?.latitude == null || row?.longitude == null || !(row.geocodedAt instanceof Date)) return null;
  const geocodedAt = row.geocodedAt.getTime();
  if (now - geocodedAt > POINT_MAX_AGE_MS) return null;
  if (row.updatedAt instanceof Date && row.updatedAt.getTime() > geocodedAt) return null;
  return { latitude: row.latitude, longitude: row.longitude };
}

/** Adds the department's city and state when the call address is only a street. */
export function addressForLookup(address, payload) {
  const street = text(address, 300);
  if (street.length < 5 || street.toLowerCase() === "unknown") return "";
  if (street.includes(",") || /\b\d{5}\b/.test(street)) return street;
  const stations = Array.isArray(payload?.stationRecords) ? payload.stationRecords : [];
  const home = stations.find((station) => text(station?.city, 100) && text(station?.state, 40));
  return home ? `${street}, ${text(home.city, 100)}, ${text(home.state, 40)}` : street;
}

export async function ensureIncidentPoint(prisma, tenantId, row, { geocode, payload, now = Date.now() }) {
  const saved = savedPoint(row, now);
  if (saved) return saved;
  const address = addressForLookup(row.address, payload);
  if (!address) return null;
  const key = `${tenantId}:${address.toLowerCase()}`;
  const failedAt = failedLookups.get(key);
  if (failedAt && now - failedAt < RETRY_AFTER_FAILURE_MS) return null;
  let found;
  try {
    found = await geocode(address);
  } catch {
    if (failedLookups.size > 2000) failedLookups.clear();
    failedLookups.set(key, now);
    return null;
  }
  const geocodedAt = new Date(now);
  await prisma.incident.updateMany({
    where: { id: row.id, tenantId },
    data: { latitude: found.latitude, longitude: found.longitude, geocodedAt, updatedAt: row.updatedAt },
  });
  row.latitude = found.latitude;
  row.longitude = found.longitude;
  row.geocodedAt = geocodedAt;
  return { latitude: found.latitude, longitude: found.longitude };
}

/** Clears points older than 30 days, at most once an hour per department. */
export async function clearOldIncidentPoints(prisma, tenantId, now = Date.now()) {
  const last = lastCleanup.get(tenantId) ?? 0;
  if (now - last < CLEANUP_EVERY_MS) return 0;
  lastCleanup.set(tenantId, now);
  const stale = await prisma.incident.findMany({
    where: { tenantId, geocodedAt: { lt: new Date(now - POINT_MAX_AGE_MS) } },
    select: { id: true, updatedAt: true },
  });
  for (const row of stale) {
    await prisma.incident.updateMany({
      where: { id: row.id, tenantId },
      data: { latitude: null, longitude: null, geocodedAt: null, updatedAt: row.updatedAt },
    });
  }
  return stale.length;
}
