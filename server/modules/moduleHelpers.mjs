/** Small request and validation helpers shared by the maintenance, parts and inspection routes. */
import { minimumRoleFor, roleLevel } from "../auth/permissions.mjs";
import { PublicError, publicErrorMessage } from "../http/publicError.mjs";

export function tenantIdOf(request, response) {
  const tenantId = request.tenant?.id;
  if (!tenantId) {
    response.status(400).json({ ok: false, message: "Department not found for this address." });
    return null;
  }
  return tenantId;
}

export function actorOf(request) {
  return String(request.auth?.username ?? "").slice(0, 200);
}

export function text(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export function oneOf(value, allowed, fallback) {
  const candidate = String(value ?? "").trim();
  return allowed.includes(candidate) ? candidate : fallback;
}

export function parseDateOnly(value, label) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new PublicError(`${label} must be a date.`);
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new PublicError(`${label} must be a date.`);
  return date;
}

export function formatDateOnly(date) {
  return date instanceof Date ? date.toISOString().slice(0, 10) : "";
}

export function parseDecimal(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 10_000_000) {
    throw new PublicError(`${label} must be a number of 0 or more.`);
  }
  return Math.round(number * 10) / 10;
}

export function decimalOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

export function detailsOf(row) {
  const raw = row?.detailsJson;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

export async function canManage(prisma, request) {
  const minimum = await minimumRoleFor(prisma, request.tenant.id, "maintenance.manage");
  return minimum != null && roleLevel(request.auth?.role) >= roleLevel(minimum);
}

export async function fullNameFor(prisma, tenantId, username) {
  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId },
    select: { payloadJson: true },
  });
  const names = details?.payloadJson?.userFullNames;
  if (names && typeof names === "object" && !Array.isArray(names)) {
    const match = Object.entries(names).find(
      ([key]) => key.trim().toLowerCase() === username.trim().toLowerCase(),
    );
    const fullName = text(match?.[1], 200);
    if (fullName) return fullName;
  }
  return username;
}

export function sendError(response, error, fallback) {
  const status = error instanceof PublicError ? 400 : 500;
  response.status(status).json({ ok: false, message: publicErrorMessage(error, fallback) });
}

export function isUniqueViolation(error) {
  return error?.code === "P2002";
}

export async function assertBelongsToTenant(prisma, model, id, tenantId, label) {
  if (!id) return;
  const row = await prisma[model].findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } });
  if (!row) throw new PublicError(`${label} was not found.`);
}
