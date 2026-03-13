import bcrypt from "bcryptjs";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

let databaseUrl = trimValue(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL in .env.server");
}

// Use explicit sslmode=verify-full to satisfy pg’s future SSL semantics and silence the security warning.
databaseUrl = databaseUrl
  .replace(/\bsslmode=prefer\b/, "sslmode=verify-full")
  .replace(/\bsslmode=require\b/, "sslmode=verify-full")
  .replace(/\bsslmode=verify-ca\b/, "sslmode=verify-full");

const prismaAdapter = new PrismaPg(
  new Pool({
    connectionString: databaseUrl,
  }),
);

const prisma = new PrismaClient({ adapter: prismaAdapter });


const app = express();
app.use(express.json({ limit: "4mb" }));

const DEFAULT_NERIS_BASE_URL = "https://api.neris.fsri.org/v1";
const DEFAULT_PROXY_PORT = 8787;
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const NERIS_ENTITY_ID_PATTERN = /^(FD|VN|FM|FA)\d{8}$/;
const NERIS_DEPARTMENT_ID_PATTERN = /^FD\d{8}$/;
const NERIS_AID_DEPARTMENT_ID_PATTERN = /^(FD|FM)\d{8}$/;
const NERIS_INCIDENT_ID_PATTERN = /^FD\d{8}\|[\w\-:]+\|\d{10}$/;
const NERIS_STATE_CODES = new Set([
  "AL",
  "AK",
  "AS",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "FM",
  "GA",
  "GU",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MH",
  "MN",
  "MS",
  "MO",
  "MP",
  "MT",
  "NA",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "PR",
  "PW",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UM",
  "UT",
  "VT",
  "VA",
  "VI",
  "WA",
  "WV",
  "WI",
  "WY",
]);
const NERIS_STATE_NAME_TO_CODE = {
  ALABAMA: "AL",
  ALASKA: "AK",
  "AMERICAN SAMOA": "AS",
  ARIZONA: "AZ",
  ARKANSAS: "AR",
  CALIFORNIA: "CA",
  COLORADO: "CO",
  CONNECTICUT: "CT",
  DELAWARE: "DE",
  "DISTRICT OF COLUMBIA": "DC",
  FLORIDA: "FL",
  "FEDERATED STATES OF MICRONESIA": "FM",
  GEORGIA: "GA",
  GUAM: "GU",
  HAWAII: "HI",
  IDAHO: "ID",
  ILLINOIS: "IL",
  INDIANA: "IN",
  IOWA: "IA",
  KANSAS: "KS",
  KENTUCKY: "KY",
  LOUISIANA: "LA",
  MAINE: "ME",
  MARYLAND: "MD",
  MASSACHUSETTS: "MA",
  MICHIGAN: "MI",
  "MARSHALL ISLANDS": "MH",
  MINNESOTA: "MN",
  MISSISSIPPI: "MS",
  MISSOURI: "MO",
  "NORTHERN MARIANA ISLANDS": "MP",
  MONTANA: "MT",
  NEBRASKA: "NE",
  NEVADA: "NV",
  "NEW HAMPSHIRE": "NH",
  "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM",
  "NEW YORK": "NY",
  "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND",
  OHIO: "OH",
  OKLAHOMA: "OK",
  OREGON: "OR",
  PENNSYLVANIA: "PA",
  "PUERTO RICO": "PR",
  PALAU: "PW",
  "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD",
  TENNESSEE: "TN",
  TEXAS: "TX",
  "UNITED STATES MINOR OUTLYING ISLANDS": "UM",
  UTAH: "UT",
  VERMONT: "VT",
  VIRGINIA: "VA",
  "VIRGIN ISLANDS": "VI",
  WASHINGTON: "WA",
  "WEST VIRGINIA": "WV",
  WISCONSIN: "WI",
  WYOMING: "WY",
 };

let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;

function trimValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** NERIS rejects incident_number (internal_id) when it contains spaces or other invalid chars. Normalize to allowed format. */
function sanitizeNerisIncidentNumber(value) {
  if (value == null || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const replaced = trimmed.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_\-]/g, "");
  return replaced || trimmed.replace(/\s+/g, "_");
}

const BCRYPT_SALT_ROUNDS = 12;
function isBcryptHash(value) {
  return typeof value === "string" && value.length > 0 && value.startsWith("$2");
}
async function verifyPassword(plain, stored) {
  if (!stored || typeof stored !== "string") return false;
  if (isBcryptHash(stored)) return bcrypt.compare(plain, stored);
  return plain === stored;
}
async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
}

function validatePasswordPolicy(password) {
  const value = String(password ?? "");
  if (value.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[a-z]/.test(value)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/[A-Z]/.test(value)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[0-9]/.test(value)) {
    return "Password must include at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return "Password must include at least one special character.";
  }
  return null;
}

function mapUserTypeToRole(userType) {
  const normalized = trimValue(userType).toLowerCase();
  return normalized.includes("admin") ? "admin" : "user";
}

async function hashAndSyncTenantUsers(tenantId, payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.userRecords)) {
    return payload;
  }

  const incomingUserRecords = payload.userRecords;
  const existingUsers = await prisma.user.findMany({
    where: { tenantId },
  });
  const existingUsersByUsername = new Map(
    existingUsers.map((user) => [user.username.trim().toLowerCase(), user]),
  );

  const seenUsernames = new Set();
  const nextUserRecords = [];

  for (const candidate of incomingUserRecords) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const normalizedName = trimValue(candidate.name);
    const normalizedUsername = trimValue(candidate.username).toLowerCase();
    const userType = trimValue(candidate.userType) || "User";
    if (!normalizedUsername) {
      continue;
    }

    const existingUser = existingUsersByUsername.get(normalizedUsername);
    const incomingPassword = String(candidate.password ?? "").trim();
    let passwordHash = "";

    if (incomingPassword) {
      passwordHash = isBcryptHash(incomingPassword)
        ? incomingPassword
        : await hashPassword(incomingPassword);
    } else if (existingUser?.passwordHash) {
      // Preserve existing hash when editing non-password user fields.
      passwordHash = String(existingUser.passwordHash);
    } else {
      // Skip users that have no password and no existing hash.
      continue;
    }

    await prisma.user.upsert({
      where: {
        tenantId_username: {
          tenantId,
          username: normalizedUsername,
        },
      },
      update: {
        role: mapUserTypeToRole(userType),
        passwordHash,
      },
      create: {
        tenantId,
        username: normalizedUsername,
        role: mapUserTypeToRole(userType),
        passwordHash,
      },
    });

    seenUsernames.add(normalizedUsername);
    nextUserRecords.push({
      ...candidate,
      name: normalizedName,
      username: normalizedUsername,
      userType,
      // Store hashed passwords in DepartmentDetails payload.
      password: passwordHash,
    });
  }

  // Keep auth table aligned with Department Access user list.
  await prisma.user.deleteMany({
    where: {
      tenantId,
      username: {
        notIn: Array.from(seenUsernames),
      },
    },
  });

  return {
    ...payload,
    userRecords: nextUserRecords,
  };
}

function normalizeHostname(hostname) {
  const value = trimValue(hostname).toLowerCase();
  if (!value) {
    return "";
  }
  const first = value.split(",")[0]?.trim() || "";
  return first.split(":")[0] || "";
}

function normalizeEnumValue(rawValue) {
  const trimmed = trimValue(rawValue);
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes("||")) {
    return trimmed;
  }
  return trimmed
    .split(":")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join("||");
}

function csvToEnumValues(rawValue) {
  const normalized = trimValue(rawValue);
  if (!normalized) {
    return [];
  }
  return Array.from(
    new Set(
      normalized
        .split(",")
        .map((entry) => normalizeEnumValue(entry))
        .filter((entry) => entry.length > 0),
    ),
  );
}

function parseJsonArray(rawValue) {
  const normalized = trimValue(rawValue);
  if (!normalized) {
    return [];
  }
  try {
    const parsed = JSON.parse(normalized);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseLocalDateTimeWithOffset(value, utcOffsetMinutes) {
  const trimmed = trimValue(value);
  const localMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!localMatch) {
    return "";
  }
  const year = Number.parseInt(localMatch[1] ?? "", 10);
  const month = Number.parseInt(localMatch[2] ?? "", 10);
  const day = Number.parseInt(localMatch[3] ?? "", 10);
  const hour = Number.parseInt(localMatch[4] ?? "", 10);
  const minute = Number.parseInt(localMatch[5] ?? "", 10);
  const second = Number.parseInt(localMatch[6] ?? "0", 10);
  if (
    [year, month, day, hour, minute, second].some((numberValue) =>
      Number.isNaN(numberValue),
    )
  ) {
    return "";
  }
  const normalizedOffset =
    Number.isFinite(utcOffsetMinutes) && Math.abs(utcOffsetMinutes) <= 840
      ? utcOffsetMinutes
      : 0;
  const utcTimestampMs =
    Date.UTC(year, month - 1, day, hour, minute, second) +
    normalizedOffset * 60 * 1000;
  const parsed = new Date(utcTimestampMs);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString();
}

function toIsoDateTime(value, fallbackIsoDateTime, utcOffsetMinutes = 0) {
  const trimmed = trimValue(value);
  if (!trimmed) {
    return fallbackIsoDateTime;
  }
  const localWithOffset = parseLocalDateTimeWithOffset(trimmed, utcOffsetMinutes);
  if (localWithOffset) {
    return localWithOffset;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackIsoDateTime;
  }
  return parsed.toISOString();
}

function toIsoDateTimeOrNull(value, utcOffsetMinutes = 0) {
  const trimmed = trimValue(value);
  if (!trimmed) {
    return null;
  }
  const localWithOffset = parseLocalDateTimeWithOffset(trimmed, utcOffsetMinutes);
  if (localWithOffset) {
    return localWithOffset;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function toIsoDateTimeFromDateAndTime(dateValue, timeValue, utcOffsetMinutes = 0) {
  const date = trimValue(dateValue);
  const time = trimValue(timeValue);
  if (!date || !time) {
    return null;
  }
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return toIsoDateTimeOrNull(`${date}T${normalizedTime}`, utcOffsetMinutes);
}

function yesNoToBoolean(value) {
  const normalized = trimValue(value).toUpperCase();
  if (normalized === "YES") {
    return true;
  }
  if (normalized === "NO") {
    return false;
  }
  return null;
}

function normalizeAidDepartmentId(rawValue, fallbackEntityId) {
  const trimmed = trimValue(rawValue);
  if (NERIS_AID_DEPARTMENT_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }
  if (
    trimmed.toUpperCase().startsWith("FD_") &&
    NERIS_AID_DEPARTMENT_ID_PATTERN.test(trimValue(fallbackEntityId))
  ) {
    return trimValue(fallbackEntityId);
  }
  return "";
}

function normalizeStateCode(rawValue, fallbackValue) {
  const fallback = trimValue(fallbackValue).toUpperCase();
  const fallbackNormalized = NERIS_STATE_CODES.has(fallback) ? fallback : "NY";
  const raw = trimValue(rawValue);
  if (!raw) {
    return fallbackNormalized;
  }

  const compactRaw = raw.replace(/[.,]/g, " ").trim();
  const segments = compactRaw
    .split(/\s+/)
    .map((segment) => segment.trim().toUpperCase())
    .filter((segment) => segment.length > 0);

  for (const segment of segments) {
    if (NERIS_STATE_CODES.has(segment)) {
      return segment;
    }
  }

  const alphaWords = compactRaw
    .split(/[^A-Za-z]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  for (let index = 0; index < alphaWords.length; index += 1) {
    const single = alphaWords[index]?.toUpperCase();
    if (single && NERIS_STATE_NAME_TO_CODE[single]) {
      return NERIS_STATE_NAME_TO_CODE[single];
    }
    const pair = `${alphaWords[index] ?? ""} ${alphaWords[index + 1] ?? ""}`
      .trim()
      .toUpperCase();
    if (pair && NERIS_STATE_NAME_TO_CODE[pair]) {
      return NERIS_STATE_NAME_TO_CODE[pair];
    }
    const triple = `${alphaWords[index] ?? ""} ${alphaWords[index + 1] ?? ""} ${alphaWords[index + 2] ?? ""}`
      .trim()
      .toUpperCase();
    if (triple && NERIS_STATE_NAME_TO_CODE[triple]) {
      return NERIS_STATE_NAME_TO_CODE[triple];
    }
  }

  return fallbackNormalized;
}

function parseLocationFromAddress(addressValue, fallbackState, fallbackCountry) {
  const rawAddress = trimValue(addressValue);
  const parts = rawAddress
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const street = parts[0] || "UNKNOWN";
  const city = parts[1] || "UNKNOWN";
  const stateSource =
    parts[2] ||
    parts[parts.length - 1] ||
    rawAddress ||
    fallbackState ||
    "NY";
  const state = normalizeStateCode(stateSource, fallbackState);

  return {
    street,
    incorporated_municipality: city,
    state,
    country: fallbackCountry || "US",
  };
}

function normalizeCountryCode(rawValue, fallbackCountry) {
  const value = trimValue(rawValue).toUpperCase();
  if (value.length === 2) {
    return value;
  }
  const fallback = trimValue(fallbackCountry).toUpperCase();
  if (fallback.length === 2) {
    return fallback;
  }
  return "US";
}

function firstAssignedUnit(rawValue) {
  const normalized = trimValue(rawValue);
  if (!normalized) {
    return "";
  }
  return normalized
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)[0] ?? "";
}

function parseUnitList(rawValue) {
  const normalized = trimValue(rawValue);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(/[,\n\r;]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function toNonNegativeInt(value) {
  const parsed = Number.parseInt(trimValue(value), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function extractUnitResponses(formValues, incidentSnapshot, utcOffsetMinutes = 0) {
  const unitsFromJson = [];
  const staffingByUnitId = new Map();
  const responseModeByUnitId = new Map();
  const transportModeByUnitId = new Map();
  const dispatchTimeByUnitId = new Map();
  const enrouteTimeByUnitId = new Map();
  const stagingTimeByUnitId = new Map();
  const onSceneTimeByUnitId = new Map();
  const clearTimeByUnitId = new Map();
  const canceledEnrouteByUnitId = new Map();
  const explicitCanceledEnrouteByUnitId = new Map();
  const resourceUnitsJsonRaw = trimValue(formValues.resource_units_json);
  const defaultUnitDispatchTime = toIsoDateTimeOrNull(
    formValues.incident_time_unit_dispatched,
    utcOffsetMinutes,
  );
  const defaultUnitEnrouteTime = toIsoDateTimeOrNull(
    formValues.incident_time_unit_enroute,
    utcOffsetMinutes,
  );
  const defaultUnitStagingTime = toIsoDateTimeOrNull(
    formValues.incident_time_unit_staged,
    utcOffsetMinutes,
  );
  const defaultUnitOnSceneTime = toIsoDateTimeOrNull(
    formValues.incident_time_unit_on_scene,
    utcOffsetMinutes,
  );
  const defaultUnitClearTime = toIsoDateTimeOrNull(
    formValues.incident_time_unit_clear,
    utcOffsetMinutes,
  );
  const defaultUnitCanceledTime = toIsoDateTimeOrNull(
    formValues.incident_time_unit_canceled,
    utcOffsetMinutes,
  );
  if (resourceUnitsJsonRaw) {
    try {
      const parsed = JSON.parse(resourceUnitsJsonRaw);
      if (Array.isArray(parsed)) {
        parsed.forEach((entry) => {
          if (!entry || typeof entry !== "object") {
            return;
          }
          const unitId = trimValue(entry.unitId);
          if (!unitId) {
            return;
          }
          unitsFromJson.push(unitId);
          const staffingCandidate = toNonNegativeInt(String(entry.staffing ?? ""));
          if (staffingCandidate !== null) {
            staffingByUnitId.set(unitId, staffingCandidate);
          }

          const responseModeCandidate = normalizeEnumValue(entry.responseMode);
          if (responseModeCandidate) {
            responseModeByUnitId.set(unitId, responseModeCandidate);
          }
          const transportModeCandidate = normalizeEnumValue(entry.transportMode);
          if (transportModeCandidate) {
            transportModeByUnitId.set(unitId, transportModeCandidate);
          }

          const dispatchTimeCandidate = toIsoDateTimeOrNull(entry.dispatchTime, utcOffsetMinutes);
          if (dispatchTimeCandidate) {
            dispatchTimeByUnitId.set(unitId, dispatchTimeCandidate);
          }
          const enrouteTimeCandidate = toIsoDateTimeOrNull(entry.enrouteTime, utcOffsetMinutes);
          if (enrouteTimeCandidate) {
            enrouteTimeByUnitId.set(unitId, enrouteTimeCandidate);
          }
          const stagingTimeCandidate = toIsoDateTimeOrNull(entry.stagingTime, utcOffsetMinutes);
          if (stagingTimeCandidate) {
            stagingTimeByUnitId.set(unitId, stagingTimeCandidate);
          }
          const onSceneTimeCandidate = toIsoDateTimeOrNull(entry.onSceneTime, utcOffsetMinutes);
          if (onSceneTimeCandidate) {
            onSceneTimeByUnitId.set(unitId, onSceneTimeCandidate);
          }
          const clearTimeCandidate = toIsoDateTimeOrNull(entry.clearTime, utcOffsetMinutes);
          if (clearTimeCandidate) {
            clearTimeByUnitId.set(unitId, clearTimeCandidate);
          }
          const canceledTimeCandidate = toIsoDateTimeOrNull(entry.canceledTime, utcOffsetMinutes);
          if (canceledTimeCandidate) {
            explicitCanceledEnrouteByUnitId.set(unitId, canceledTimeCandidate);
          }
          if (entry.isCanceledEnroute === true) {
            const canceledTimestamp =
              canceledTimeCandidate ||
              enrouteTimeCandidate ||
              dispatchTimeCandidate ||
              defaultUnitCanceledTime ||
              defaultUnitEnrouteTime;
            if (canceledTimestamp) {
              canceledEnrouteByUnitId.set(unitId, canceledTimestamp);
            }
          }
        });
      }
    } catch {
      // Ignore malformed serialized unit data and rely on other fields.
    }
  }

  const primaryUnitId = trimValue(formValues.resource_primary_unit_id);
  const additionalUnits = parseUnitList(formValues.resource_additional_units);
  const assignedUnits = parseUnitList(incidentSnapshot.assignedUnits);
  const fallbackReportedUnitId = firstAssignedUnit(incidentSnapshot.assignedUnits);
  const primaryResponseMode = normalizeEnumValue(formValues.resource_primary_unit_response_mode);

  const orderedUnitIds = Array.from(
    new Set([
      ...unitsFromJson,
      primaryUnitId,
      ...additionalUnits,
      ...assignedUnits,
      fallbackReportedUnitId,
    ].filter((unitId) => unitId.length > 0)),
  );

  const primaryStaffing = toNonNegativeInt(formValues.resource_primary_unit_staffing);
  if (primaryUnitId && primaryStaffing !== null && !staffingByUnitId.has(primaryUnitId)) {
    staffingByUnitId.set(primaryUnitId, primaryStaffing);
  }
  if (primaryUnitId && primaryResponseMode && !responseModeByUnitId.has(primaryUnitId)) {
    responseModeByUnitId.set(primaryUnitId, primaryResponseMode);
  }

  if (primaryUnitId && defaultUnitDispatchTime && !dispatchTimeByUnitId.has(primaryUnitId)) {
    dispatchTimeByUnitId.set(primaryUnitId, defaultUnitDispatchTime);
  }
  if (primaryUnitId && defaultUnitEnrouteTime && !enrouteTimeByUnitId.has(primaryUnitId)) {
    enrouteTimeByUnitId.set(primaryUnitId, defaultUnitEnrouteTime);
  }
  if (primaryUnitId && defaultUnitStagingTime && !stagingTimeByUnitId.has(primaryUnitId)) {
    stagingTimeByUnitId.set(primaryUnitId, defaultUnitStagingTime);
  }
  if (primaryUnitId && defaultUnitOnSceneTime && !onSceneTimeByUnitId.has(primaryUnitId)) {
    onSceneTimeByUnitId.set(primaryUnitId, defaultUnitOnSceneTime);
  }
  if (primaryUnitId && defaultUnitClearTime && !clearTimeByUnitId.has(primaryUnitId)) {
    clearTimeByUnitId.set(primaryUnitId, defaultUnitClearTime);
  }
  if (primaryUnitId && defaultUnitCanceledTime && !canceledEnrouteByUnitId.has(primaryUnitId)) {
    canceledEnrouteByUnitId.set(primaryUnitId, defaultUnitCanceledTime);
  }

  if (!orderedUnitIds.length) {
    return [{ reported_unit_id: "UNSPECIFIED_UNIT" }];
  }

  return orderedUnitIds.map((unitId) => {
    const response = {
      reported_unit_id: unitId,
    };
    const staffing = staffingByUnitId.get(unitId);
    if (typeof staffing === "number") {
      response.staffing = staffing;
    }
    const responseMode = responseModeByUnitId.get(unitId);
    if (responseMode) {
      response.response_mode = responseMode;
    }
    const transportMode = transportModeByUnitId.get(unitId);
    if (transportMode) {
      response.transport_mode = transportMode;
    }
    const dispatchTime = dispatchTimeByUnitId.get(unitId);
    if (dispatchTime) {
      response.dispatch = dispatchTime;
    }
    const enrouteTime = enrouteTimeByUnitId.get(unitId);
    if (enrouteTime) {
      response.enroute_to_scene = enrouteTime;
    }
    const stagingTime = stagingTimeByUnitId.get(unitId);
    if (stagingTime) {
      response.staging = stagingTime;
    }
    const onSceneTime = onSceneTimeByUnitId.get(unitId);
    if (onSceneTime) {
      response.on_scene = onSceneTime;
    }
    const clearTime = clearTimeByUnitId.get(unitId);
    if (clearTime) {
      response.unit_clear = clearTime;
    }
    const canceledTime = canceledEnrouteByUnitId.get(unitId);
    if (canceledTime) {
      response.canceled_enroute = canceledTime;
    }
    const explicitCanceledTime = explicitCanceledEnrouteByUnitId.get(unitId);
    if (explicitCanceledTime) {
      response.canceled_enroute = explicitCanceledTime;
    }
    return response;
  });
}

function getProxyConfig() {
  const baseUrl = trimValue(process.env.NERIS_BASE_URL) || DEFAULT_NERIS_BASE_URL;
  const grantType = trimValue(process.env.NERIS_GRANT_TYPE) || "client_credentials";
  return {
    // Render-style platforms provide PORT; keep NERIS_PROXY_PORT as local override.
    proxyPort:
      Number.parseInt(process.env.PORT || "", 10) ||
      Number.parseInt(process.env.NERIS_PROXY_PORT || "", 10) ||
      DEFAULT_PROXY_PORT,
    baseUrl,
    tokenUrl: `${baseUrl}/token`,
    createIncidentUrlPrefix: `${baseUrl}/incident`,
    staticAccessToken: trimValue(process.env.NERIS_STATIC_ACCESS_TOKEN),
    clientId: trimValue(process.env.NERIS_CLIENT_ID),
    clientSecret: trimValue(process.env.NERIS_CLIENT_SECRET),
    username: trimValue(process.env.NERIS_USERNAME),
    password: trimValue(process.env.NERIS_PASSWORD),
    grantType,
    tokenScope: trimValue(process.env.NERIS_TOKEN_SCOPE),
    defaultEntityId: trimValue(process.env.NERIS_ENTITY_ID),
    defaultDepartmentNerisId: trimValue(process.env.NERIS_DEPARTMENT_NERIS_ID),
    defaultState: trimValue(process.env.NERIS_DEFAULT_STATE) || "NY",
    defaultCountry: trimValue(process.env.NERIS_DEFAULT_COUNTRY) || "US",
  };
}

async function parseResponseBody(response) {
  const responseText = await response.text();
  if (!responseText) {
    return null;
  }
  try {
    return JSON.parse(responseText);
  } catch {
    return { raw: responseText };
  }
}

async function getAccessToken(config) {
  if (config.staticAccessToken) {
    return config.staticAccessToken;
  }

  const now = Date.now();
  if (
    cachedAccessToken &&
    cachedAccessTokenExpiresAt > now + TOKEN_REFRESH_BUFFER_MS
  ) {
    return cachedAccessToken;
  }

  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "Missing server auth config. Set NERIS_CLIENT_ID and NERIS_CLIENT_SECRET in .env.server (or set NERIS_STATIC_ACCESS_TOKEN).",
    );
  }
  if (config.grantType === "password" && (!config.username || !config.password)) {
    throw new Error(
      "Grant type password requires NERIS_USERNAME and NERIS_PASSWORD in .env.server.",
    );
  }

  const tokenBody = new URLSearchParams();
  tokenBody.set("grant_type", config.grantType);
  if (config.grantType === "password") {
    tokenBody.set("username", config.username);
    tokenBody.set("password", config.password);
  }
  if (config.tokenScope) {
    tokenBody.set("scope", config.tokenScope);
  }

  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
    "base64",
  );

  const tokenResponse = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenBody.toString(),
  });

  const tokenResponseBody = await parseResponseBody(tokenResponse);
  if (!tokenResponse.ok) {
    const tokenBodyError =
      tokenResponseBody && typeof tokenResponseBody === "object"
        ? trimValue(tokenResponseBody.error)
        : "";
    const isInvalidClient = tokenBodyError === "invalid_client";
    const usingProdBaseUrl = config.baseUrl.includes("api.neris.fsri.org/v1");
    const usingTestBaseUrl = config.baseUrl.includes("api-test.neris.fsri.org/v1");
    const hint = isInvalidClient
      ? usingProdBaseUrl
        ? " Hint: test credentials usually require NERIS_BASE_URL=https://api-test.neris.fsri.org/v1 in .env.server. Restart proxy after updating."
        : usingTestBaseUrl
          ? " Hint: verify NERIS_CLIENT_ID and NERIS_CLIENT_SECRET are for the test environment and are copied exactly."
          : " Hint: verify NERIS_BASE_URL and OAuth client credentials belong to the same NERIS environment."
      : "";
    throw new Error(
      `Token request failed (${tokenResponse.status} ${tokenResponse.statusText}). ${JSON.stringify(
        tokenResponseBody ?? {},
      )}${hint}`,
    );
  }

  if (!tokenResponseBody || typeof tokenResponseBody !== "object") {
    throw new Error("Token response was empty or invalid.");
  }

  const accessToken = trimValue(tokenResponseBody.access_token);
  if (!accessToken) {
    const challengeName = trimValue(tokenResponseBody.challenge_name);
    if (challengeName) {
      throw new Error(
        `Token flow requires additional challenge step (${challengeName}). Complete challenge auth in backend flow first.`,
      );
    }
    throw new Error("Token response did not include access_token.");
  }

  const expiresInSeconds = Number.parseInt(
    String(tokenResponseBody.expires_in ?? "900"),
    10,
  );
  cachedAccessToken = accessToken;
  cachedAccessTokenExpiresAt = now + Math.max(expiresInSeconds, 60) * 1_000;

  return accessToken;
}

async function fetchAccessibleEntities(config, accessToken) {
  const entitiesResponse = await fetch(`${config.baseUrl}/entity`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const entitiesBody = await parseResponseBody(entitiesResponse);
  if (!entitiesResponse.ok) {
    return {
      ok: false,
      status: entitiesResponse.status,
      statusText: entitiesResponse.statusText,
      body: entitiesBody,
      entityIds: [],
    };
  }
  const entities = Array.isArray(entitiesBody?.entities) ? entitiesBody.entities : [];
  const entityIds = entities
    .map((entity) =>
      entity && typeof entity === "object" ? trimValue(entity.neris_id) : "",
    )
    .filter((entityId) => entityId.length > 0);
  return {
    ok: true,
    status: entitiesResponse.status,
    statusText: entitiesResponse.statusText,
    body: entitiesBody,
    entityIds,
  };
}

async function fetchEntityByNerisIdQuery(config, accessToken, nerisId) {
  const url = `${config.baseUrl}/entity?neris_id=${encodeURIComponent(nerisId)}`;
  const apiResponse = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const body = await parseResponseBody(apiResponse);
  return {
    ok: apiResponse.ok,
    status: apiResponse.status,
    statusText: apiResponse.statusText,
    url,
    body,
  };
}

async function fetchEntityByPath(config, accessToken, nerisId) {
  const url = `${config.baseUrl}/entity/${encodeURIComponent(nerisId)}`;
  const apiResponse = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const body = await parseResponseBody(apiResponse);
  return {
    ok: apiResponse.ok,
    status: apiResponse.status,
    statusText: apiResponse.statusText,
    url,
    body,
  };
}

async function fetchIntegrationEnrollment(config, accessToken) {
  const clientId = trimValue(config.clientId);
  if (!clientId) {
    return {
      ok: false,
      skipped: true,
      status: 0,
      statusText: "Client ID unavailable",
      url: "",
      body: {
        message:
          "Skipped enrollment lookup because NERIS_CLIENT_ID is not configured on the server.",
      },
    };
  }
  const url = `${config.baseUrl}/account/enrollment/${encodeURIComponent(clientId)}`;
  const apiResponse = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const body = await parseResponseBody(apiResponse);
  return {
    ok: apiResponse.ok,
    skipped: false,
    status: apiResponse.status,
    statusText: apiResponse.statusText,
    url,
    body,
  };
}

function buildIncidentPayload(exportRequestBody, config, entityId) {
  const body = exportRequestBody && typeof exportRequestBody === "object" ? exportRequestBody : {};
  const formValues =
    body.formValues && typeof body.formValues === "object" ? body.formValues : {};
  const integration =
    body.integration && typeof body.integration === "object" ? body.integration : {};
  const incidentSnapshot =
    body.incidentSnapshot && typeof body.incidentSnapshot === "object"
      ? body.incidentSnapshot
      : {};
  const clientUtcOffsetMinutesRaw = Number.parseInt(
    String(integration.clientUtcOffsetMinutes ?? ""),
    10,
  );
  const clientUtcOffsetMinutes =
    Number.isFinite(clientUtcOffsetMinutesRaw) && Math.abs(clientUtcOffsetMinutesRaw) <= 840
      ? clientUtcOffsetMinutesRaw
      : 0;

  const callNumber = trimValue(body.callNumber);
  const incidentNumber = trimValue(formValues.incident_internal_id) || callNumber;
  const dispatchIncidentNumber =
    trimValue(formValues.dispatch_internal_id) || incidentNumber || callNumber;
  const reportDepartmentNerisId = trimValue(formValues.fd_neris_id);
  const configDepartmentNerisId = trimValue(config.defaultDepartmentNerisId);
  let departmentNerisId = NERIS_DEPARTMENT_ID_PATTERN.test(reportDepartmentNerisId)
    ? reportDepartmentNerisId
    : NERIS_DEPARTMENT_ID_PATTERN.test(configDepartmentNerisId)
      ? configDepartmentNerisId
      : "";
  if (!departmentNerisId && entityId.startsWith("FD") && NERIS_DEPARTMENT_ID_PATTERN.test(entityId)) {
    departmentNerisId = entityId;
  }
  const primaryIncidentType = normalizeEnumValue(formValues.primary_incident_type);

  if (!NERIS_ENTITY_ID_PATTERN.test(entityId)) {
    throw new Error(
      `Invalid entity ID format (${entityId}). Expected FD########, VN########, FM########, or FA########.`,
    );
  }
  if (!departmentNerisId) {
    throw new Error(
      "Missing or invalid department NERIS ID. Use FD######## format in report field 'Department NERIS ID' (or set NERIS_DEPARTMENT_NERIS_ID on server).",
    );
  }
  if (entityId.startsWith("FD") && departmentNerisId !== entityId) {
    // FD entity exports should post under the same fire department ID.
    departmentNerisId = entityId;
  }
  if (!incidentNumber) {
    throw new Error("Missing incident number.");
  }
  if (!dispatchIncidentNumber) {
    throw new Error("Missing dispatch incident number.");
  }
  if (!primaryIncidentType) {
    throw new Error("Missing primary incident type.");
  }

  const nowIso = new Date().toISOString();
  const onsetDateTimeIso = toIsoDateTimeFromDateAndTime(
    formValues.incident_onset_date,
    formValues.incident_onset_time,
    clientUtcOffsetMinutes,
  );
  const callCreate = toIsoDateTime(
    formValues.incident_time_call_create,
    onsetDateTimeIso || nowIso,
    clientUtcOffsetMinutes,
  );
  const callAnswered = toIsoDateTime(
    formValues.incident_time_call_answered,
    callCreate,
    clientUtcOffsetMinutes,
  );
  const callArrival = toIsoDateTime(
    formValues.incident_time_call_arrival,
    callAnswered,
    clientUtcOffsetMinutes,
  );

  const baseLocation = parseLocationFromAddress(
    trimValue(formValues.incident_location_address) || trimValue(incidentSnapshot.address),
    config.defaultState,
    config.defaultCountry,
  );
  const dispatchLocation = parseLocationFromAddress(
    trimValue(formValues.dispatch_location_address) ||
      trimValue(formValues.incident_location_address) ||
      trimValue(incidentSnapshot.address),
    config.defaultState,
    config.defaultCountry,
  );
  const normalizedLocationState = normalizeStateCode(
    trimValue(formValues.location_state) || baseLocation.state,
    config.defaultState,
  );
  const normalizedLocationCountry = normalizeCountryCode(
    trimValue(formValues.location_country) || baseLocation.country,
    config.defaultCountry,
  );
  baseLocation.state = normalizedLocationState;
  baseLocation.country = normalizedLocationCountry;
  dispatchLocation.state = normalizedLocationState;
  dispatchLocation.country = normalizedLocationCountry;

  const postalCode = trimValue(formValues.location_postal_code);
  if (postalCode) {
    baseLocation.postal_code = postalCode;
    dispatchLocation.postal_code = postalCode;
  }
  const county = trimValue(formValues.location_county);
  if (county) {
    baseLocation.county = county;
    dispatchLocation.county = county;
  }
  const placeType = normalizeEnumValue(formValues.location_place_type);
  if (placeType) {
    baseLocation.place_type = placeType;
    dispatchLocation.place_type = placeType;
  }
  const directionOfTravel = normalizeEnumValue(formValues.location_direction_of_travel);
  if (directionOfTravel) {
    baseLocation.direction_of_travel = directionOfTravel;
    dispatchLocation.direction_of_travel = directionOfTravel;
  }
  const crossStreetType = normalizeEnumValue(formValues.location_cross_street_type);
  const crossStreetName = trimValue(formValues.location_cross_street_name);
  if (crossStreetType || crossStreetName) {
    const crossStreetPayload = [
      {
        cross_street_modifier: crossStreetType || undefined,
        street: crossStreetName || undefined,
      },
    ];
    baseLocation.cross_streets = crossStreetPayload;
    dispatchLocation.cross_streets = crossStreetPayload;
  }

  const additionalIncidentTypes = csvToEnumValues(formValues.additional_incident_types)
    .filter((entry) => entry !== primaryIncidentType)
    .slice(0, 2);
  const incidentTypes = [
    {
      primary: true,
      type: primaryIncidentType,
    },
    ...additionalIncidentTypes.map((entry) => ({
      primary: false,
      type: entry,
    })),
  ];

  const specialModifiers = csvToEnumValues(formValues.special_incident_modifiers);
  const actionValues = csvToEnumValues(formValues.incident_actions_taken);
  const noActionValue = normalizeEnumValue(formValues.incident_noaction);
  let actionsTactics = null;
  if (actionValues.length > 0) {
    actionsTactics = {
      action_noaction: {
        type: "ACTION",
        actions: actionValues,
      },
    };
  } else if (noActionValue) {
    actionsTactics = {
      action_noaction: {
        type: "NOACTION",
        noaction_type: noActionValue,
      },
    };
  }

  const peoplePresent = yesNoToBoolean(formValues.incident_people_present);
  const displacedCount = toNonNegativeInt(formValues.incident_displaced_number);
  const displacementCauses = csvToEnumValues(formValues.incident_displaced_cause);
  const outcomeNarrative = trimValue(formValues.narrative_outcome);
  const impedimentNarrative = trimValue(formValues.narrative_obstacles);

  const locationUse = {};
  const locationUsePrimary = normalizeEnumValue(formValues.location_use_primary);
  const locationUseSecondary = normalizeEnumValue(formValues.location_use_secondary);
  const locationVacancyCause = normalizeEnumValue(formValues.location_vacancy_cause);
  const locationInUse = yesNoToBoolean(formValues.location_in_use);
  const locationUsedAsIntended = yesNoToBoolean(formValues.location_used_as_intended);
  if (locationUsePrimary) {
    locationUse.use_type = locationUsePrimary;
  }
  if (locationUseSecondary) {
    locationUse.secondary_use = locationUseSecondary;
  }
  if (locationVacancyCause) {
    locationUse.vacancy_cause = locationVacancyCause;
  }
  if (typeof locationInUse === "boolean") {
    const inUsePayload = {
      in_use: locationInUse,
    };
    if (locationInUse && typeof locationUsedAsIntended === "boolean") {
      inUsePayload.intended = locationUsedAsIntended;
    }
    locationUse.in_use = inUsePayload;
  }

  const unitResponses = extractUnitResponses(formValues, incidentSnapshot, clientUtcOffsetMinutes);

  // NERIS 422: call_arrival must not be after call_create. Normalize so arrival <= create.
  const callArrivalNormalized =
    callArrival && callCreate && callArrival > callCreate ? callCreate : callArrival;

  const dispatchPayload = {
    incident_number: sanitizeNerisIncidentNumber(dispatchIncidentNumber),
    call_arrival: callArrivalNormalized,
    call_answered: callAnswered,
    call_create: callCreate,
    location: dispatchLocation,
    unit_responses: unitResponses,
  };

  const determinantCode = trimValue(formValues.dispatch_determinate_code);
  if (determinantCode) {
    dispatchPayload.determinant_code = determinantCode;
  }
  const incidentCode = trimValue(formValues.initial_dispatch_code);
  if (incidentCode) {
    dispatchPayload.incident_code = incidentCode;
  }
  const disposition = trimValue(formValues.dispatch_final_disposition);
  if (disposition) {
    dispatchPayload.disposition = disposition;
  }
  const automaticAlarm = trimValue(formValues.dispatch_automatic_alarm).toUpperCase();
  if (automaticAlarm === "YES") {
    dispatchPayload.automatic_alarm = true;
  }
  if (automaticAlarm === "NO") {
    dispatchPayload.automatic_alarm = false;
  }
  const dispatchCenterId = trimValue(formValues.dispatch_center_id);
  if (dispatchCenterId) {
    dispatchPayload.center_id = dispatchCenterId;
  }
  const incidentClearTime = toIsoDateTimeOrNull(
    formValues.incident_time_clear || formValues.time_incident_clear,
    clientUtcOffsetMinutes,
  );
  if (incidentClearTime) {
    dispatchPayload.incident_clear = incidentClearTime;
  }

  const aidAgencyType = trimValue(formValues.incident_aid_agency_type).toUpperCase();
  const additionalNonFdAidEntries = Array.isArray(body.additionalNonFdAidEntries)
    ? body.additionalNonFdAidEntries
    : [];
  const nonFdAids =
    aidAgencyType === "NON_FD_AID"
      ? Array.from(
          new Set(
            [
              ...csvToEnumValues(formValues.incident_aid_nonfd),
              ...additionalNonFdAidEntries
                .map((entry) =>
                  entry && typeof entry === "object"
                    ? normalizeEnumValue(entry.aidType)
                    : "",
                )
                .filter((entry) => entry.length > 0),
            ].filter((entry) => entry.length > 0),
          ),
        )
      : [];

  const aidEntries = [];
  if (aidAgencyType === "FIRE_DEPARTMENT") {
    const direction = normalizeEnumValue(formValues.incident_aid_direction);
    const aidType = normalizeEnumValue(formValues.incident_aid_type);
    const department = normalizeAidDepartmentId(formValues.incident_aid_department_name, entityId);
    if (direction && aidType && department) {
      aidEntries.push({
        department_neris_id: department,
        aid_type: aidType,
        aid_direction: direction,
      });
    }
  }
  const additionalAidEntries = Array.isArray(body.additionalAidEntries)
    ? body.additionalAidEntries
    : [];
  additionalAidEntries.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const direction = normalizeEnumValue(entry.aidDirection);
    const aidType = normalizeEnumValue(entry.aidType);
    const department = normalizeAidDepartmentId(entry.aidDepartment, entityId);
    if (!direction || !aidType || !department) {
      return;
    }
    aidEntries.push({
      department_neris_id: department,
      aid_type: aidType,
      aid_direction: direction,
    });
  });

  const uniqueAidEntries = Array.from(
    new Map(
      aidEntries.map((entry) => [
        `${entry.department_neris_id}|${entry.aid_type}|${entry.aid_direction}`,
        entry,
      ]),
    ).values(),
  );

  const basePayload = {
    department_neris_id: departmentNerisId,
    incident_number: sanitizeNerisIncidentNumber(incidentNumber),
    location: baseLocation,
  };
  if (typeof peoplePresent === "boolean") {
    basePayload.people_present = peoplePresent;
  }
  if (typeof displacedCount === "number") {
    basePayload.displacement_count = displacedCount;
  }
  if (displacementCauses.length > 0) {
    basePayload.displacement_causes = displacementCauses;
  }
  if (outcomeNarrative) {
    basePayload.outcome_narrative = outcomeNarrative;
  }
  if (impedimentNarrative) {
    basePayload.impediment_narrative = impedimentNarrative;
  }
  if (Object.keys(locationUse).length > 0) {
    basePayload.location_use = locationUse;
  }

  const isHazsitIncident = primaryIncidentType.startsWith("HAZSIT||");
  const isMedicalIncident = primaryIncidentType.startsWith("MEDICAL||");
  const hazsitDisposition = normalizeEnumValue(formValues.emerg_haz_disposition);
  const hazsitEvacuatedCount = toNonNegativeInt(formValues.emerg_haz_evacuated_count);
  let hazsitPayload = null;
  if (
    isHazsitIncident &&
    hazsitDisposition &&
    typeof hazsitEvacuatedCount === "number"
  ) {
    hazsitPayload = {
      evacuated: hazsitEvacuatedCount,
      disposition: hazsitDisposition,
    };
    const chemicalName = trimValue(formValues.emerg_haz_chemical_name);
    const chemicalDot = normalizeEnumValue(formValues.emerg_haz_chemical_dot);
    if (chemicalName && chemicalDot) {
      hazsitPayload.chemicals = [
        {
          name: chemicalName,
          dot_class: chemicalDot,
          release_occurred: false,
        },
      ];
    }
  }

  const electricHazards = parseJsonArray(formValues.emerging_haz_electrocution_items_json)
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const type = normalizeEnumValue(item.electricalHazardType);
      if (!type) {
        return null;
      }
      const suppressionTypes = csvToEnumValues(item.suppressionMethods);
      const hazardPayload = {
        type,
      };
      if (suppressionTypes.length > 0) {
        hazardPayload.fire_details = [
          {
            suppression_types: suppressionTypes,
          },
        ];
      }
      return hazardPayload;
    })
    .filter((entry) => entry);

  const powergenHazards = parseJsonArray(formValues.emerging_haz_power_generation_items_json)
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const pvType = normalizeEnumValue(item.photovoltaicHazardType);
      if (!pvType) {
        return null;
      }
      const sourceOrTarget = normalizeEnumValue(item.pvSourceTarget);
      return {
        pv_other: {
          type: "PHOTOVOLTAICS",
          pv_type: pvType,
          source_or_target: sourceOrTarget || undefined,
        },
      };
    })
    .filter((entry) => entry);

  const medicalEvaluation = normalizeEnumValue(formValues.medical_patient_care_evaluation);
  const medicalStatus = normalizeEnumValue(formValues.medical_patient_status);
  const medicalTransport = normalizeEnumValue(formValues.medical_transport_disposition);
  const medicalReportId = trimValue(formValues.medical_patient_care_report_id);
  const medicalPatientCount = toNonNegativeInt(formValues.medical_patient_count);
  const medicalDetails =
    isMedicalIncident && (medicalEvaluation || medicalStatus || medicalTransport || medicalReportId)
      ? Array.from(
          {
            length:
              typeof medicalPatientCount === "number" && medicalPatientCount > 0
                ? medicalPatientCount
                : 1,
          },
          () => {
            const detail = {
              patient_care_evaluation: medicalEvaluation,
            };
            if (medicalStatus) {
              detail.patient_status = medicalStatus;
            }
            if (medicalTransport) {
              detail.transport_disposition = medicalTransport;
            }
            if (medicalReportId) {
              detail.patient_care_report_id = medicalReportId;
            }
            return detail;
          },
        )
      : [];

  const payload = {
    base: basePayload,
    incident_types: incidentTypes,
    dispatch: dispatchPayload,
  };
  if (specialModifiers.length > 0) {
    payload.special_modifiers = specialModifiers;
  }
  if (actionsTactics) {
    payload.actions_tactics = actionsTactics;
  }
  // NERIS 422: Aid department NERIS ID cannot be the same as the incident base department. Strip self-aid.
  const baseDepartmentId = trimValue(departmentNerisId);
  const aidsFiltered = uniqueAidEntries.filter(
    (entry) => trimValue(entry.department_neris_id) !== baseDepartmentId,
  );
  if (aidsFiltered.length > 0) {
    payload.aids = aidsFiltered;
  }
  if (nonFdAids.length > 0) {
    payload.nonfd_aids = nonFdAids;
  }
  if (hazsitPayload) {
    payload.hazsit_detail = hazsitPayload;
  }
  if (electricHazards.length > 0) {
    payload.electric_hazards = electricHazards;
  }
  if (powergenHazards.length > 0) {
    payload.powergen_hazards = powergenHazards;
  }
  if (medicalDetails.length > 0) {
    payload.medical_details = medicalDetails;
  }

  return payload;
}

app.get("/api/neris/health", async (request, response) => {
  const config = getProxyConfig();
  const requiresUserCredentials = config.grantType === "password";
  const tenantId = trimValue(request.tenant?.id);
  const tenantEntityId = tenantId ? await resolveTenantEntityId(tenantId) : "";
  response.json({
    ok: true,
    proxyPort: config.proxyPort,
    baseUrl: config.baseUrl,
    grantType: config.grantType,
    requiresUserCredentials,
    createIncidentUrlPrefix: config.createIncidentUrlPrefix,
    usingStaticToken: Boolean(config.staticAccessToken),
    hasClientCredentials: Boolean(config.clientId && config.clientSecret),
    hasUserCredentials: Boolean(config.username && config.password),
    hasDefaultEntityId: Boolean(config.defaultEntityId),
    hasDefaultDepartmentNerisId: Boolean(config.defaultDepartmentNerisId),
    hasTenantEntityId: Boolean(tenantEntityId),
  });
});

const PLATFORM_ADMIN_KEY = trimValue(process.env.PLATFORM_ADMIN_KEY);
const ADMIN_STATUSES = new Set(["sandbox", "trial", "active", "suspended", "archived"]);

function requirePlatformAdmin(request, response, next) {
  if (!request.path.startsWith("/api/admin")) {
    return next();
  }
  const key = trimValue(request.headers["x-platform-admin-key"] ?? request.headers["authorization"]?.replace(/^Bearer\s+/i, ""));
  if (!PLATFORM_ADMIN_KEY || key !== PLATFORM_ADMIN_KEY) {
    response.status(403).json({ ok: false, message: "Platform admin key required." });
    return;
  }
  next();
}

app.use(requirePlatformAdmin);

app.post("/api/admin/tenants", async (request, response) => {
  try {
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const slug = trimValue(body.slug).toLowerCase();
    const name = trimValue(body.name);
    const hostname = trimValue(body.hostname).toLowerCase();
    const status = trimValue(body.status).toLowerCase() || "trial";
    const adminUsername = trimValue(body.adminUsername).toLowerCase();
    const adminPassword = String(body.adminPassword ?? "").trim();
    const nerisEntityId = trimValue(body.nerisEntityId).toUpperCase();

    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      response.status(400).json({ ok: false, message: "slug required; lowercase letters, numbers, hyphens only." });
      return;
    }
    if (!name) {
      response.status(400).json({ ok: false, message: "name required." });
      return;
    }
    if (!hostname) {
      response.status(400).json({ ok: false, message: "hostname required." });
      return;
    }
    if (!ADMIN_STATUSES.has(status)) {
      response.status(400).json({ ok: false, message: `status must be one of: ${[...ADMIN_STATUSES].join(", ")}` });
      return;
    }
    if (!adminUsername) {
      response.status(400).json({ ok: false, message: "adminUsername required." });
      return;
    }
    if (!adminPassword) {
      response.status(400).json({ ok: false, message: "adminPassword required." });
      return;
    }
    if (nerisEntityId && !NERIS_ENTITY_ID_PATTERN.test(nerisEntityId)) {
      response.status(400).json({
        ok: false,
        message:
          "nerisEntityId must match FD########, VN########, FM########, or FA########.",
      });
      return;
    }

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      response.status(409).json({ ok: false, message: `Tenant slug "${slug}" already exists.` });
      return;
    }
    const existingDomain = await prisma.tenantDomain.findUnique({ where: { hostname } });
    if (existingDomain) {
      response.status(409).json({ ok: false, message: `Hostname "${hostname}" already assigned.` });
      return;
    }

    const passwordHash = await hashPassword(adminPassword);
    const tenant = await prisma.tenant.create({
      data: { slug, name, status, nerisEntityId: nerisEntityId || null },
    });
    await prisma.tenantDomain.create({ data: { tenantId: tenant.id, hostname, isPrimary: true } });
    await prisma.departmentDetails.create({
      data: { tenantId: tenant.id, departmentName: name, payloadJson: {} },
    });
    await prisma.user.create({
      data: { tenantId: tenant.id, username: adminUsername, passwordHash, role: "admin" },
    });

    response.status(201).json({
      ok: true,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        hostname,
        nerisEntityId: trimValue(tenant.nerisEntityId),
      },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected error creating tenant.",
    });
  }
});

app.post("/api/admin/tenants/:tenantId/domains", async (request, response) => {
  try {
    const tenantId = trimValue(request.params.tenantId);
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const hostname = trimValue(body.hostname).toLowerCase();
    const isPrimary = Boolean(body.isPrimary);

    if (!tenantId) {
      response.status(400).json({ ok: false, message: "tenantId required." });
      return;
    }
    if (!hostname) {
      response.status(400).json({ ok: false, message: "hostname required." });
      return;
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      response.status(404).json({ ok: false, message: "Tenant not found." });
      return;
    }
    const existingDomain = await prisma.tenantDomain.findUnique({ where: { hostname } });
    if (existingDomain) {
      response.status(409).json({ ok: false, message: `Hostname "${hostname}" already assigned.` });
      return;
    }

    const domain = await prisma.tenantDomain.create({
      data: { tenantId, hostname, isPrimary },
    });
    response.status(201).json({ ok: true, domain: { id: domain.id, hostname, isPrimary } });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected error adding domain.",
    });
  }
});

app.use(async (request, response, next) => {
  try {
    // CAD inbound email is called by the Cloudflare Worker; tenant is derived from body.to (e.g. cifpdil@cad.fireultimate.app).
    if (request.method === "POST" && request.path === "/api/cad/inbound-email") {
      next();
      return;
    }

    const host =
      normalizeHostname(request.headers["x-forwarded-host"]) ||
      normalizeHostname(request.headers.host) ||
      normalizeHostname(request.hostname);

    const localHosts = new Set(["localhost", "127.0.0.1"]);
    if (localHosts.has(host)) {
      const demoTenant = await prisma.tenant.findUnique({
        where: { slug: "demo" },
      });
      if (!demoTenant) {
        response.status(500).json({ ok: false, message: "Demo tenant not found." });
        return;
      }
      request.tenant = {
        id: demoTenant.id,
        slug: demoTenant.slug,
        name: demoTenant.name,
        host,
        nerisEntityId: trimValue(demoTenant.nerisEntityId),
      };
      next();
      return;
    }

    const domain = await prisma.tenantDomain.findUnique({
      where: { hostname: host },
      include: { tenant: true },
    });

    if (!domain || !domain.tenant) {
      response.status(404).json({
        ok: false,
        message: `Unknown tenant domain: ${host || "(empty host)"}`,
      });
      return;
    }

    request.tenant = {
      id: domain.tenant.id,
      slug: domain.tenant.slug,
      name: domain.tenant.name,
      host,
      nerisEntityId: trimValue(domain.tenant.nerisEntityId),
    };
    next();
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Tenant resolution failed.",
    });
  }
});

app.get("/api/tenant/context", (request, response) => {
  response.json({
    ok: true,
    tenant: request.tenant ?? null,
  });
});

// ----- /api/cad/inbound-email (CAD email ingest from Cloudflare Worker; tenant from body.to) -----
const CAD_INGEST_SECRET = trimValue(process.env.CAD_INGEST_SECRET);

app.post("/api/cad/inbound-email", async (request, response) => {
  try {
    if (CAD_INGEST_SECRET) {
      const secret = trimValue(request.headers["x-cad-ingest-secret"]);
      if (secret !== CAD_INGEST_SECRET) {
        response.status(401).json({ ok: false, message: "Unauthorized." });
        return;
      }
    }

    const body = request.body && typeof request.body === "object" ? request.body : {};
    const fromAddress = typeof body.from === "string" ? body.from.trim() : "";
    const toAddress = typeof body.to === "string" ? body.to.trim() : "";
    const rawBody = typeof body.raw === "string" ? body.raw : "";
    const headersJson =
      body.headers && typeof body.headers === "object" ? body.headers : null;

    let tenantId = null;
    const atIndex = toAddress.indexOf("@");
    if (atIndex > 0) {
      const localPart = toAddress.slice(0, atIndex).trim().toLowerCase();
      if (localPart) {
        const tenant = await prisma.tenant.findUnique({
          where: { slug: localPart },
        });
        if (tenant) tenantId = tenant.id;
      }
    }

    await prisma.cadEmailIngest.create({
      data: {
        tenantId,
        fromAddress,
        toAddress,
        rawBody,
        headersJson,
      },
    });

    response.status(200).json({ ok: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "CAD inbound email store failed.",
    });
  }
});

// ----- /api/incidents (tenant-scoped; Incident table) -----
function incidentRowToApi(row) {
  if (!row) return null;
  const deletedAt =
    row.deletedAt instanceof Date ? row.deletedAt.toISOString() : (row.deletedAt ?? "");
  return {
    id: row.id,
    callNumber: row.id,
    incidentNumber: row.incidentNumber ?? "",
    dispatchNumber: row.dispatchNumber ?? "",
    incident_internal_id: row.incidentNumber ?? "",
    dispatch_internal_id: row.dispatchNumber ?? "",
    incidentType: row.incidentType ?? "",
    priority: row.priority ?? "",
    address: row.address ?? "",
    stillDistrict: row.stillDistrict ?? "",
    assignedUnits: row.assignedUnits ?? "",
    reportedBy: row.reportedBy ?? "",
    callbackNumber: row.callbackNumber ?? "",
    dispatchNotes: row.dispatchNotes ?? "",
    currentState: row.currentState ?? "Draft",
    receivedAt: row.receivedAt ?? "",
    dispatchInfo: row.dispatchInfo ?? "",
    apparatusJson: row.apparatusJson ?? null,
    mapReference: row.mapReference ?? "",
    deletedAt: deletedAt || undefined,
    deletedBy: row.deletedBy ?? undefined,
    deletedReason: row.deletedReason ?? undefined,
    lastUpdated: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt ?? "",
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt ?? "",
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt ?? "",
  };
}

app.get("/api/incidents", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const includeDeleted = request.query.includeDeleted === "true";
    const where = { tenantId };
    if (!includeDeleted) {
      where.deletedAt = null;
    }
    const rows = await prisma.incident.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    const data = rows.map(incidentRowToApi);
    response.json({ ok: true, data });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected incidents list error.",
    });
  }
});

app.post("/api/incidents", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const incident = await prisma.incident.create({
      data: {
        tenantId,
        incidentNumber: trimValue(body.incidentNumber) || null,
        dispatchNumber: trimValue(body.dispatchNumber) || null,
        incidentType: trimValue(body.incidentType) || "",
        priority: trimValue(body.priority) || "",
        address: trimValue(body.address) || "",
        stillDistrict: trimValue(body.stillDistrict) || "",
        assignedUnits: trimValue(body.assignedUnits) || "",
        reportedBy: trimValue(body.reportedBy) || null,
        callbackNumber: trimValue(body.callbackNumber) || null,
        dispatchNotes: trimValue(body.dispatchNotes) || null,
        currentState: trimValue(body.currentState) || "Draft",
        receivedAt: trimValue(body.receivedAt) || "",
        dispatchInfo: trimValue(body.dispatchInfo) || "",
        apparatusJson:
          body.apparatusJson != null && typeof body.apparatusJson === "object"
            ? body.apparatusJson
            : Array.isArray(body.apparatus)
              ? body.apparatus
              : null,
        mapReference: trimValue(body.mapReference) || null,
      },
    });
    response.status(201).json({ ok: true, data: incidentRowToApi(incident) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected incident create error.",
    });
  }
});

app.get("/api/incidents/:id", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    const id = trimValue(request.params.id);
    if (!tenantId || !id) {
      response.status(400).json({ ok: false, message: "Missing tenant context or incident id." });
      return;
    }
    const incident = await prisma.incident.findFirst({
      where: { id, tenantId },
    });
    if (!incident) {
      response.status(404).json({ ok: false, message: "Incident not found." });
      return;
    }
    response.json({ ok: true, data: incidentRowToApi(incident) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected incident get error.",
    });
  }
});

app.patch("/api/incidents/:id", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    const id = trimValue(request.params.id);
    if (!tenantId || !id) {
      response.status(400).json({ ok: false, message: "Missing tenant context or incident id." });
      return;
    }
    const existing = await prisma.incident.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      response.status(404).json({ ok: false, message: "Incident not found." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const update = {};
    if (body.incidentNumber !== undefined) update.incidentNumber = trimValue(body.incidentNumber) || null;
    if (body.dispatchNumber !== undefined) update.dispatchNumber = trimValue(body.dispatchNumber) || null;
    if (body.incidentType !== undefined) update.incidentType = trimValue(body.incidentType) || "";
    if (body.priority !== undefined) update.priority = trimValue(body.priority) || "";
    if (body.address !== undefined) update.address = trimValue(body.address) || "";
    if (body.stillDistrict !== undefined) update.stillDistrict = trimValue(body.stillDistrict) || "";
    if (body.assignedUnits !== undefined) update.assignedUnits = trimValue(body.assignedUnits) || "";
    if (body.reportedBy !== undefined) update.reportedBy = trimValue(body.reportedBy) || null;
    if (body.callbackNumber !== undefined) update.callbackNumber = trimValue(body.callbackNumber) || null;
    if (body.dispatchNotes !== undefined) update.dispatchNotes = trimValue(body.dispatchNotes) || null;
    if (body.currentState !== undefined) update.currentState = trimValue(body.currentState) || "Draft";
    if (body.receivedAt !== undefined) update.receivedAt = trimValue(body.receivedAt) || "";
    if (body.dispatchInfo !== undefined) update.dispatchInfo = trimValue(body.dispatchInfo) || "";
    if (body.mapReference !== undefined) update.mapReference = trimValue(body.mapReference) || null;
    if (body.deletedBy !== undefined) update.deletedBy = trimValue(body.deletedBy) || null;
    if (body.deletedReason !== undefined) update.deletedReason = trimValue(body.deletedReason) || null;
    if (body.deletedAt !== undefined) {
      const v = body.deletedAt;
      update.deletedAt = v === null || v === "" ? null : v instanceof Date ? v : new Date(v);
    }
    if (body.apparatusJson !== undefined || body.apparatus !== undefined) {
      const v = body.apparatusJson ?? body.apparatus;
      update.apparatusJson = v == null ? null : (typeof v === "object" ? v : null);
    }
    const updated = await prisma.incident.update({
      where: { id },
      data: update,
    });
    response.json({ ok: true, data: incidentRowToApi(updated) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected incident update error.",
    });
  }
});

app.delete("/api/incidents/:id", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    const id = trimValue(request.params.id);
    if (!tenantId || !id) {
      response.status(400).json({ ok: false, message: "Missing tenant context or incident id." });
      return;
    }
    const existing = await prisma.incident.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      response.status(404).json({ ok: false, message: "Incident not found." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const deletedBy = trimValue(body.deletedBy) || null;
    const deletedReason = trimValue(body.deletedReason) || null;
    const updated = await prisma.incident.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        deletedReason,
      },
    });
    response.json({ ok: true, data: incidentRowToApi(updated) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected incident delete error.",
    });
  }
});

// ----- /api/department-details -----
app.get("/api/department-details", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({
        ok: false,
        message: "Missing tenant context.",
      });
      return;
    }
    const details = await prisma.departmentDetails.findUnique({
      where: { tenantId },
    });
    const raw =
      details?.payloadJson && typeof details.payloadJson === "object"
        ? details.payloadJson
        : {};
    const { userRecords: _auth, ...data } = raw;
    response.json({ ok: true, data });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unexpected department details read error.",
    });
  }
});

app.post("/api/auth/login", (request, response) => {
  const body = request.body && typeof request.body === "object" ? request.body : {};
  const submittedUsername = String(body.username ?? "").trim().toLowerCase();
  const submittedPassword = String(body.password ?? "");
  const tenantId = request.tenant?.id;
  if (!submittedUsername || !submittedPassword) {
    response.status(400).json({
      ok: false,
      message: "Username and password are required.",
    });
    return;
  }
  if (!tenantId) {
    response.status(400).json({
      ok: false,
      message: "Missing tenant context.",
    });
    return;
  }

  (async () => {
    // Preferred path: tenant-scoped users table.
    const dbUser = await prisma.user.findUnique({
      where: {
        tenantId_username: {
          tenantId,
          username: submittedUsername,
        },
      },
    });

    if (dbUser) {
      const storedHash = String(dbUser.passwordHash ?? "");
      const valid = await verifyPassword(submittedPassword, storedHash);
      if (!valid) {
        response.status(401).json({
          ok: false,
          message: "Invalid username or password.",
        });
        return;
      }
      // Auto-upgrade: if still plaintext, re-save as bcrypt hash (non-blocking).
      if (!isBcryptHash(storedHash)) {
        hashPassword(submittedPassword).then((hash) => {
          prisma.user.update({
            where: { id: dbUser.id },
            data: { passwordHash: hash },
          }).catch(() => {});
        });
      }
      response.status(200).json({
        ok: true,
        user: {
          name: dbUser.username,
          userType: dbUser.role.toLowerCase() === "admin" ? "Admin" : "User",
          username: dbUser.username,
        },
      });
      return;
    }

    response.status(401).json({
      ok: false,
      message: "Invalid username or password.",
    });
  })().catch((error) => {
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Unexpected login service error.",
    });
  });
});

app.post("/api/auth/change-password", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const username = trimValue(String(body.username ?? "")).toLowerCase();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (!username || !currentPassword || !newPassword) {
      response.status(400).json({
        ok: false,
        message: "Username, current password, and new password are required.",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { tenantId_username: { tenantId, username } },
    });
    if (!user) {
      response.status(404).json({ ok: false, message: "User not found." });
      return;
    }
    const currentOk = await verifyPassword(currentPassword, String(user.passwordHash ?? ""));
    if (!currentOk) {
      response.status(401).json({ ok: false, message: "Current password is incorrect." });
      return;
    }
    if (currentPassword === newPassword) {
      response.status(400).json({
        ok: false,
        message: "New password must be different from current password.",
      });
      return;
    }
    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) {
      response.status(400).json({ ok: false, message: policyError });
      return;
    }
    const nextHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: nextHash },
    });
    response.status(200).json({ ok: true, message: "Password updated." });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Unexpected change-password error.",
    });
  }
});

app.post("/api/department-details", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({
        ok: false,
        message: "Missing tenant context.",
      });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const payloadWithSyncedUsers = await hashAndSyncTenantUsers(tenantId, body);
    const { userRecords: _dropped, ...payloadWithoutAuth } = payloadWithSyncedUsers;
    const existingDetails = await prisma.departmentDetails.findUnique({
      where: { tenantId },
      select: { payloadJson: true },
    });
    const existingPayload =
      existingDetails?.payloadJson && typeof existingDetails.payloadJson === "object"
        ? existingDetails.payloadJson
        : {};
    const payloadToStore = _dropped !== undefined ? payloadWithoutAuth : payloadWithSyncedUsers;
    const tenantEntityIdFromPayload = readTenantEntityIdFromDepartmentPayload(payloadToStore);
    // Keep non-auth user profile metadata when saving department details.
    if (
      existingPayload.userFullNames &&
      payloadToStore.userFullNames === undefined &&
      typeof existingPayload.userFullNames === "object" &&
      !Array.isArray(existingPayload.userFullNames)
    ) {
      payloadToStore.userFullNames = existingPayload.userFullNames;
    }
    if (
      existingPayload.userTypeLabels &&
      payloadToStore.userTypeLabels === undefined &&
      typeof existingPayload.userTypeLabels === "object" &&
      !Array.isArray(existingPayload.userTypeLabels)
    ) {
      payloadToStore.userTypeLabels = existingPayload.userTypeLabels;
    }
    await prisma.departmentDetails.upsert({
      where: { tenantId },
      update: {
        payloadJson: payloadToStore,
        departmentName: trimValue(body.departmentName) || undefined,
      },
      create: {
        tenantId,
        departmentName: trimValue(body.departmentName) || request.tenant?.name || "Unknown",
        payloadJson: payloadToStore,
      },
    });
    if (tenantEntityIdFromPayload) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { nerisEntityId: tenantEntityIdFromPayload },
      });
    }
    response.status(200).json({ ok: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unexpected department details write error.",
    });
  }
});

app.get("/api/schedule-assignments", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }

    const rows = await prisma.scheduleAssignments.findMany({
      where: { tenantId },
      select: { shiftType: true, dateKey: true, assignmentsJson: true },
    });

    const assignments = {};
    const overtimeSplit = {};

    for (const row of rows) {
      const storageKey = `${row.shiftType}::${row.dateKey}`;
      const payload =
        row.assignmentsJson && typeof row.assignmentsJson === "object"
          ? row.assignmentsJson
          : {};

      // Backward compatible read: legacy rows may store assignments map directly.
      const rowAssignments =
        payload.assignments && typeof payload.assignments === "object"
          ? payload.assignments
          : payload;
      const rowOvertime =
        payload.overtimeSplit && typeof payload.overtimeSplit === "object"
          ? payload.overtimeSplit
          : {};

      assignments[storageKey] = rowAssignments;
      overtimeSplit[storageKey] = rowOvertime;
    }

    response.json({
      ok: true,
      assignments,
      overtimeSplit,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unexpected schedule assignments read error.",
    });
  }
});

app.post("/api/schedule-assignments", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }

    const body = request.body && typeof request.body === "object" ? request.body : {};
    const assignmentsInput =
      body.assignments && typeof body.assignments === "object" ? body.assignments : {};
    const overtimeInput =
      body.overtimeSplit && typeof body.overtimeSplit === "object" ? body.overtimeSplit : {};

    const parsedRows = [];
    for (const [storageKey, assignmentValue] of Object.entries(assignmentsInput)) {
      const key = trimValue(storageKey);
      if (!key.includes("::")) {
        continue;
      }
      const [shiftTypeRaw, dateKeyRaw] = key.split("::");
      const shiftType = trimValue(shiftTypeRaw);
      const dateKey = trimValue(dateKeyRaw);
      if (!shiftType || !dateKey) {
        continue;
      }
      const overtimeValue =
        overtimeInput && typeof overtimeInput === "object" ? overtimeInput[key] : {};

      parsedRows.push({
        shiftType,
        dateKey,
        assignmentsJson: {
          assignments:
            assignmentValue && typeof assignmentValue === "object" ? assignmentValue : {},
          overtimeSplit:
            overtimeValue && typeof overtimeValue === "object" ? overtimeValue : {},
        },
      });
    }

    const validCompositeKeys = new Set(
      parsedRows.map((row) => `${row.shiftType}::${row.dateKey}`),
    );
    const existingRows = await prisma.scheduleAssignments.findMany({
      where: { tenantId },
      select: { id: true, shiftType: true, dateKey: true },
    });

    const deletions = existingRows
      .filter((row) => !validCompositeKeys.has(`${row.shiftType}::${row.dateKey}`))
      .map((row) => row.id);

    await prisma.$transaction([
      ...deletions.map((id) =>
        prisma.scheduleAssignments.delete({
          where: { id },
        }),
      ),
      ...parsedRows.map((row) =>
        prisma.scheduleAssignments.upsert({
          where: {
            tenantId_shiftType_dateKey: {
              tenantId,
              shiftType: row.shiftType,
              dateKey: row.dateKey,
            },
          },
          update: { assignmentsJson: row.assignmentsJson },
          create: {
            tenantId,
            shiftType: row.shiftType,
            dateKey: row.dateKey,
            assignmentsJson: row.assignmentsJson,
          },
        }),
      ),
    ]);

    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unexpected schedule assignments write error.",
    });
  }
});

// ----- /api/users (tenant-scoped; auth in User table only, not in payloadJson) -----
// Non-auth user profile metadata (e.g. full name) is stored separately in DepartmentDetails payload.

async function getTenantUserFullNameMap(tenantId) {
  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId },
    select: { payloadJson: true },
  });
  const payload =
    details?.payloadJson && typeof details.payloadJson === "object"
      ? details.payloadJson
      : {};
  const candidateMap = payload.userFullNames;
  if (!candidateMap || typeof candidateMap !== "object" || Array.isArray(candidateMap)) {
    return {};
  }
  const nextMap = {};
  for (const [rawUsername, rawName] of Object.entries(candidateMap)) {
    const username = trimValue(rawUsername).toLowerCase();
    const fullName = trimValue(String(rawName ?? ""));
    if (username && fullName) {
      nextMap[username] = fullName;
    }
  }
  return nextMap;
}

async function getTenantUserTypeLabelMap(tenantId) {
  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId },
    select: { payloadJson: true },
  });
  const payload =
    details?.payloadJson && typeof details.payloadJson === "object"
      ? details.payloadJson
      : {};
  const candidateMap = payload.userTypeLabels;
  if (!candidateMap || typeof candidateMap !== "object" || Array.isArray(candidateMap)) {
    return {};
  }
  const nextMap = {};
  for (const [rawUsername, rawUserType] of Object.entries(candidateMap)) {
    const username = trimValue(rawUsername).toLowerCase();
    const userType = trimValue(String(rawUserType ?? ""));
    if (username && userType) {
      nextMap[username] = userType;
    }
  }
  return nextMap;
}

async function setTenantUserFullName(tenantId, username, fullName, previousUsername) {
  const normalizedUsername = trimValue(username).toLowerCase();
  if (!normalizedUsername) {
    return;
  }
  const normalizedPreviousUsername = trimValue(previousUsername).toLowerCase();
  const normalizedFullName = trimValue(fullName);

  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId },
  });
  const payload =
    details?.payloadJson && typeof details.payloadJson === "object"
      ? details.payloadJson
      : {};
  const currentMap =
    payload.userFullNames && typeof payload.userFullNames === "object" && !Array.isArray(payload.userFullNames)
      ? payload.userFullNames
      : {};
  const nextMap = { ...currentMap };
  if (normalizedPreviousUsername && normalizedPreviousUsername !== normalizedUsername) {
    delete nextMap[normalizedPreviousUsername];
  }
  if (normalizedFullName) {
    nextMap[normalizedUsername] = normalizedFullName;
  } else {
    delete nextMap[normalizedUsername];
  }
  const nextPayload = { ...payload };
  if (Object.keys(nextMap).length > 0) {
    nextPayload.userFullNames = nextMap;
  } else {
    delete nextPayload.userFullNames;
  }

  await prisma.departmentDetails.upsert({
    where: { tenantId },
    update: { payloadJson: nextPayload },
    create: { tenantId, payloadJson: nextPayload },
  });
}

async function setTenantUserTypeLabel(tenantId, username, userTypeLabel, previousUsername) {
  const normalizedUsername = trimValue(username).toLowerCase();
  if (!normalizedUsername) {
    return;
  }
  const normalizedPreviousUsername = trimValue(previousUsername).toLowerCase();
  const normalizedUserTypeLabel = trimValue(userTypeLabel);

  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId },
  });
  const payload =
    details?.payloadJson && typeof details.payloadJson === "object"
      ? details.payloadJson
      : {};
  const currentMap =
    payload.userTypeLabels &&
    typeof payload.userTypeLabels === "object" &&
    !Array.isArray(payload.userTypeLabels)
      ? payload.userTypeLabels
      : {};
  const nextMap = { ...currentMap };
  if (normalizedPreviousUsername && normalizedPreviousUsername !== normalizedUsername) {
    delete nextMap[normalizedPreviousUsername];
  }
  if (normalizedUserTypeLabel) {
    nextMap[normalizedUsername] = normalizedUserTypeLabel;
  } else {
    delete nextMap[normalizedUsername];
  }
  const nextPayload = { ...payload };
  if (Object.keys(nextMap).length > 0) {
    nextPayload.userTypeLabels = nextMap;
  } else {
    delete nextPayload.userTypeLabels;
  }

  await prisma.departmentDetails.upsert({
    where: { tenantId },
    update: { payloadJson: nextPayload },
    create: { tenantId, payloadJson: nextPayload },
  });
}

async function removeTenantUserFullName(tenantId, username) {
  const normalizedUsername = trimValue(username).toLowerCase();
  if (!normalizedUsername) {
    return;
  }
  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId },
  });
  if (!details || !details.payloadJson || typeof details.payloadJson !== "object") {
    return;
  }
  const payload = details.payloadJson;
  const currentMap =
    payload.userFullNames && typeof payload.userFullNames === "object" && !Array.isArray(payload.userFullNames)
      ? payload.userFullNames
      : {};
  if (!currentMap[normalizedUsername]) {
    return;
  }
  const nextMap = { ...currentMap };
  delete nextMap[normalizedUsername];
  const nextPayload = { ...payload };
  if (Object.keys(nextMap).length > 0) {
    nextPayload.userFullNames = nextMap;
  } else {
    delete nextPayload.userFullNames;
  }
  await prisma.departmentDetails.update({
    where: { tenantId },
    data: { payloadJson: nextPayload },
  });
}

async function removeTenantUserTypeLabel(tenantId, username) {
  const normalizedUsername = trimValue(username).toLowerCase();
  if (!normalizedUsername) {
    return;
  }
  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId },
  });
  if (!details || !details.payloadJson || typeof details.payloadJson !== "object") {
    return;
  }
  const payload = details.payloadJson;
  const currentMap =
    payload.userTypeLabels &&
    typeof payload.userTypeLabels === "object" &&
    !Array.isArray(payload.userTypeLabels)
      ? payload.userTypeLabels
      : {};
  if (!currentMap[normalizedUsername]) {
    return;
  }
  const nextMap = { ...currentMap };
  delete nextMap[normalizedUsername];
  const nextPayload = { ...payload };
  if (Object.keys(nextMap).length > 0) {
    nextPayload.userTypeLabels = nextMap;
  } else {
    delete nextPayload.userTypeLabels;
  }
  await prisma.departmentDetails.update({
    where: { tenantId },
    data: { payloadJson: nextPayload },
  });
}

function toUserResponse(user, fullNameMap = {}, userTypeLabelMap = {}) {
  const normalizedUsername = trimValue(user.username).toLowerCase();
  return {
    id: user.id,
    username: user.username,
    userType:
      userTypeLabelMap[normalizedUsername] ||
      (user.role?.toLowerCase() === "admin" ? "Admin" : "User"),
    name: fullNameMap[normalizedUsername] || user.username,
  };
}

app.get("/api/users", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, username: true, role: true },
      orderBy: { username: "asc" },
    });
    const fullNameMap = await getTenantUserFullNameMap(tenantId);
    const userTypeLabelMap = await getTenantUserTypeLabelMap(tenantId);
    response.json({
      ok: true,
      users: users.map((user) => toUserResponse(user, fullNameMap, userTypeLabelMap)),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Unexpected users list error.",
    });
  }
});

app.post("/api/users", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const username = trimValue(String(body.username ?? "")).toLowerCase();
    const password = String(body.password ?? "").trim();
    const userType = trimValue(body.userType) || "User";
    const fullName = trimValue(String(body.name ?? "")) || username;
    if (!username) {
      response.status(400).json({ ok: false, message: "Username is required." });
      return;
    }
    if (!password) {
      response.status(400).json({ ok: false, message: "Password is required for new users." });
      return;
    }
    const passwordPolicyError = validatePasswordPolicy(password);
    if (passwordPolicyError) {
      response.status(400).json({ ok: false, message: passwordPolicyError });
      return;
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        tenantId,
        username,
        passwordHash,
        role: mapUserTypeToRole(userType),
      },
    });
    await setTenantUserFullName(tenantId, username, fullName);
    await setTenantUserTypeLabel(tenantId, username, userType);
    response.status(201).json({
      ok: true,
      user: toUserResponse(user, { [username]: fullName }, { [username]: userType }),
    });
  } catch (error) {
    if (error?.code === "P2002") {
      response.status(409).json({ ok: false, message: "A user with that username already exists." });
      return;
    }
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Unexpected user create error.",
    });
  }
});

app.patch("/api/users/:id", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const id = trimValue(request.params.id);
    if (!id) {
      response.status(400).json({ ok: false, message: "User id is required." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const existing = await prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      response.status(404).json({ ok: false, message: "User not found." });
      return;
    }
    const fullNameMap = await getTenantUserFullNameMap(tenantId);
    const userTypeLabelMap = await getTenantUserTypeLabelMap(tenantId);
    const existingFullName =
      trimValue(fullNameMap[trimValue(existing.username).toLowerCase()]) || existing.username;
    const nextFullName =
      body.name !== undefined ? trimValue(String(body.name ?? "")) : existingFullName;
    const existingUserTypeLabel =
      trimValue(userTypeLabelMap[trimValue(existing.username).toLowerCase()]) ||
      (existing.role?.toLowerCase() === "admin" ? "Admin" : "User");
    const nextUserTypeLabel =
      body.userType !== undefined ? trimValue(String(body.userType ?? "")) : existingUserTypeLabel;
    const updates = {};
    if (body.username !== undefined) {
      updates.username = trimValue(String(body.username)).toLowerCase();
      if (!updates.username) {
        response.status(400).json({ ok: false, message: "Username cannot be empty." });
        return;
      }
    }
    if (body.userType !== undefined) {
      updates.role = mapUserTypeToRole(trimValue(body.userType) || "User");
    }
    if (body.password !== undefined && String(body.password).trim()) {
      const nextPassword = String(body.password).trim();
      const passwordPolicyError = validatePasswordPolicy(nextPassword);
      if (passwordPolicyError) {
        response.status(400).json({ ok: false, message: passwordPolicyError });
        return;
      }
      updates.passwordHash = await hashPassword(nextPassword);
    }
    const user = await prisma.user.update({
      where: { id },
      data: updates,
    });
    const nextUsername = trimValue(user.username).toLowerCase();
    await setTenantUserFullName(
      tenantId,
      nextUsername,
      nextFullName || nextUsername,
      trimValue(existing.username).toLowerCase(),
    );
    await setTenantUserTypeLabel(
      tenantId,
      nextUsername,
      nextUserTypeLabel || (user.role?.toLowerCase() === "admin" ? "Admin" : "User"),
      trimValue(existing.username).toLowerCase(),
    );
    response.json({
      ok: true,
      user: toUserResponse(
        user,
        { [nextUsername]: nextFullName || nextUsername },
        {
          [nextUsername]:
            nextUserTypeLabel || (user.role?.toLowerCase() === "admin" ? "Admin" : "User"),
        },
      ),
    });
  } catch (error) {
    if (error?.code === "P2002") {
      response.status(409).json({ ok: false, message: "A user with that username already exists." });
      return;
    }
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Unexpected user update error.",
    });
  }
});

app.post("/api/users/:id/reset-password", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const id = trimValue(request.params.id);
    if (!id) {
      response.status(400).json({ ok: false, message: "User id is required." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const newPassword = String(body.newPassword ?? "").trim();
    if (!newPassword) {
      response.status(400).json({ ok: false, message: "New password is required." });
      return;
    }
    const passwordPolicyError = validatePasswordPolicy(newPassword);
    if (passwordPolicyError) {
      response.status(400).json({ ok: false, message: passwordPolicyError });
      return;
    }
    const existing = await prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) {
      response.status(404).json({ ok: false, message: "User not found." });
      return;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    response.status(200).json({ ok: true, message: "Password reset." });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Unexpected reset-password error.",
    });
  }
});

app.delete("/api/users/:id", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const id = trimValue(request.params.id);
    if (!id) {
      response.status(400).json({ ok: false, message: "User id is required." });
      return;
    }
    const existing = await prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      response.status(404).json({ ok: false, message: "User not found." });
      return;
    }
    await prisma.user.delete({ where: { id } });
    await removeTenantUserFullName(tenantId, existing.username);
    await removeTenantUserTypeLabel(tenantId, existing.username);
    response.status(204).send();
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Unexpected user delete error.",
    });
  }
});

app.get("/api/neris/debug/entities", async (request, response) => {
  const config = getProxyConfig();
  try {
    const accessToken = await getAccessToken(config);
    const entitiesResult = await fetchAccessibleEntities(config, accessToken);
    response.status(entitiesResult.status).json({
      ok: entitiesResult.ok,
      status: entitiesResult.status,
      statusText: entitiesResult.statusText,
      note:
        "NERIS support clarified GET /entity is a directory listing endpoint, not a canonical 'authorized entities' endpoint.",
      entityListNerisIds: entitiesResult.entityIds,
      entityListCount: entitiesResult.entityIds.length,
      upstreamRequest: {
        method: "GET",
        url: `${config.baseUrl}/entity`,
        headers: ["Authorization: Bearer <access_token>"],
      },
      // Backward-compatibility for existing UI and docs.
      accessibleEntityIds: entitiesResult.entityIds,
      neris: entitiesResult.body,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected proxy debug error.",
    });
  }
});

app.get("/api/neris/debug/entity-check", async (request, response) => {
  const config = getProxyConfig();
  const requestedNerisId =
    readQueryValue(request.query.nerisId) ||
    readQueryValue(request.query.neris_id) ||
    (await resolveEntityIdFromRequest({}, request.headers, config, request.tenant));
  if (!requestedNerisId) {
    response.status(400).json({
      ok: false,
      message:
        "Missing NERIS entity ID. Provide ?nerisId=FD######## or set this tenant's NERIS entity ID in Department Details.",
    });
    return;
  }
  if (!NERIS_ENTITY_ID_PATTERN.test(requestedNerisId)) {
    response.status(400).json({
      ok: false,
      message:
        "Invalid entity ID format. Expected FD########, VN########, FM########, or FA########.",
      submittedEntityId: requestedNerisId,
    });
    return;
  }

  try {
    const accessToken = await getAccessToken(config);
    const [queryLookup, pathLookup, enrollmentLookup] = await Promise.all([
      fetchEntityByNerisIdQuery(config, accessToken, requestedNerisId),
      fetchEntityByPath(config, accessToken, requestedNerisId),
      fetchIntegrationEnrollment(config, accessToken),
    ]);
    const overallOk = queryLookup.ok || pathLookup.ok;
    const summary = {
      entityFoundViaQuery: queryLookup.ok,
      entityFoundViaPath: pathLookup.ok,
      enrollmentLookupOk: enrollmentLookup.ok,
      enrollmentLookupSkipped: Boolean(enrollmentLookup.skipped),
    };
    response.status(overallOk ? 200 : 502).json({
      ok: overallOk,
      submittedEntityId: requestedNerisId,
      note:
        "This endpoint follows NERIS support guidance: validate by querying /entity?neris_id=... and /entity/{neris_id}, and optionally inspect /account/enrollment/{clientId}.",
      summary,
      requestTemplates: {
        entityQuery: `GET ${config.baseUrl}/entity?neris_id=${requestedNerisId}`,
        entityPath: `GET ${config.baseUrl}/entity/${requestedNerisId}`,
        enrollment: trimValue(config.clientId)
          ? `GET ${config.baseUrl}/account/enrollment/${trimValue(config.clientId)}`
          : "Unavailable: NERIS_CLIENT_ID missing on server config.",
        authHeader: "Authorization: Bearer <access_token>",
      },
      checks: {
        entityByQueryParam: queryLookup,
        entityByPathParam: pathLookup,
        enrollmentByClientId: enrollmentLookup,
      },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Unexpected entity-check debug error.",
      submittedEntityId: requestedNerisId,
    });
  }
});

function readQueryValue(queryValue) {
  if (Array.isArray(queryValue)) {
    return trimValue(queryValue[0]);
  }
  return trimValue(queryValue);
}

function readNestedStringValue(source, pathSegments) {
  let cursor = source;
  for (const segment of pathSegments) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
      return "";
    }
    cursor = cursor[segment];
  }
  return trimValue(cursor);
}

function readTenantEntityIdFromDepartmentPayload(payloadJson) {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) {
    return "";
  }
  const candidates = [
    readNestedStringValue(payloadJson, ["nerisEntityId"]),
    readNestedStringValue(payloadJson, ["vendorCode"]),
    readNestedStringValue(payloadJson, ["departmentNerisId"]),
    readNestedStringValue(payloadJson, ["fd_neris_id"]),
    readNestedStringValue(payloadJson, ["neris", "entityId"]),
    readNestedStringValue(payloadJson, ["nerisExportSettings", "entityId"]),
    readNestedStringValue(payloadJson, ["nerisExportSettings", "vendorCode"]),
  ].filter(Boolean);
  const exactMatch = candidates.find((value) => NERIS_ENTITY_ID_PATTERN.test(value));
  return exactMatch || "";
}

async function resolveTenantEntityId(tenantId) {
  if (!tenantId) {
    return "";
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nerisEntityId: true },
  });
  const tenantEntityId = trimValue(tenant?.nerisEntityId);
  if (tenantEntityId && NERIS_ENTITY_ID_PATTERN.test(tenantEntityId)) {
    return tenantEntityId;
  }
  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId },
    select: { payloadJson: true },
  });
  const fallbackEntityId = readTenantEntityIdFromDepartmentPayload(details?.payloadJson);
  if (
    fallbackEntityId &&
    fallbackEntityId !== tenantEntityId &&
    NERIS_ENTITY_ID_PATTERN.test(fallbackEntityId)
  ) {
    // Keep tenant-level field populated during migration from payload-backed values.
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { nerisEntityId: fallbackEntityId },
    });
  }
  return fallbackEntityId;
}

app.get("/api/neris/debug/incident", async (request, response) => {
  const config = getProxyConfig();
  const requestedIncidentNerisId =
    readQueryValue(request.query.incidentNerisId) ||
    readQueryValue(request.query.nerisId) ||
    readQueryValue(request.query.incidentId);
  const incidentEntityFromId = NERIS_INCIDENT_ID_PATTERN.test(requestedIncidentNerisId)
    ? requestedIncidentNerisId.split("|")[0]
    : "";
  const resolvedTenantEntityId = await resolveEntityIdFromRequest(
    {},
    request.headers,
    config,
    request.tenant,
  );
  const requestedEntityId =
    readQueryValue(request.query.entityId) || incidentEntityFromId || resolvedTenantEntityId;

  if (!requestedEntityId) {
    response.status(400).json({
      ok: false,
      message:
        "Missing NERIS entity ID. Provide ?entityId=... or set this tenant's NERIS entity ID in Department Details.",
    });
    return;
  }
  if (!NERIS_ENTITY_ID_PATTERN.test(requestedEntityId)) {
    response.status(400).json({
      ok: false,
      message:
        "Invalid entity ID format. Expected FD########, VN########, FM########, or FA########.",
      submittedEntityId: requestedEntityId,
    });
    return;
  }
  if (!requestedIncidentNerisId) {
    response.status(400).json({
      ok: false,
      message:
        "Missing incident NERIS ID. Provide ?incidentNerisId=FD########|incident-number|##########.",
      submittedEntityId: requestedEntityId,
    });
    return;
  }
  if (!NERIS_INCIDENT_ID_PATTERN.test(requestedIncidentNerisId)) {
    response.status(400).json({
      ok: false,
      message:
        "Invalid incident NERIS ID format. Expected FD########|incident-number|##########.",
      submittedEntityId: requestedEntityId,
      incidentNerisId: requestedIncidentNerisId,
    });
    return;
  }
  if (incidentEntityFromId && incidentEntityFromId !== requestedEntityId) {
    response.status(400).json({
      ok: false,
      message:
        "Entity mismatch. incidentNerisId prefix does not match submitted entityId.",
      submittedEntityId: requestedEntityId,
      incidentNerisId: requestedIncidentNerisId,
    });
    return;
  }

  try {
    const accessToken = await getAccessToken(config);
    const nerisResponse = await fetch(
      `${config.createIncidentUrlPrefix}/${encodeURIComponent(requestedEntityId)}/${encodeURIComponent(
        requestedIncidentNerisId,
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    const nerisResponseBody = await parseResponseBody(nerisResponse);
    let troubleshooting = null;
    if (nerisResponse.status === 403) {
      const entitiesResult = await fetchAccessibleEntities(config, accessToken);
      const entityIsAccessible = entitiesResult.entityIds.includes(requestedEntityId);
      troubleshooting = {
        message: entityIsAccessible
          ? "Token can list this entity, but read permission is denied for incident retrieval."
          : "Token may not be authorized for submittedEntityId. Compare submittedEntityId against entityNerisIds returned by GET /entity (directory list; not a canonical authorization endpoint).",
        entityNerisIdsFromEntityList: entitiesResult.entityIds,
        accessibleEntityIds: entitiesResult.entityIds,
        entitiesLookupStatus: entitiesResult.status,
        entityIsAccessible,
      };
    }

    response.status(nerisResponse.status).json({
      ok: nerisResponse.ok,
      status: nerisResponse.status,
      statusText: nerisResponse.statusText,
      submittedEntityId: requestedEntityId,
      incidentNerisId: requestedIncidentNerisId,
      neris: nerisResponseBody,
      troubleshooting,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Unexpected proxy get-incident debug error.",
      submittedEntityId: requestedEntityId,
      incidentNerisId: requestedIncidentNerisId,
    });
  }
});

async function resolveEntityIdFromRequest(requestBody, requestHeaders, config, tenant) {
  const integration =
    requestBody?.integration && typeof requestBody.integration === "object"
      ? requestBody.integration
      : {};
  const headerEntityId =
    trimValue(requestHeaders["x-neris-entity-id"]) ||
    trimValue(requestHeaders["x-neris-vendor-code"]);
  const bodyEntityId = trimValue(integration.entityId);
  if (bodyEntityId) {
    return bodyEntityId;
  }
  if (headerEntityId) {
    return headerEntityId;
  }

  const tenantId = trimValue(tenant?.id);
  const tenantEntityIdFromContext = trimValue(tenant?.nerisEntityId);
  if (tenantEntityIdFromContext && NERIS_ENTITY_ID_PATTERN.test(tenantEntityIdFromContext)) {
    return tenantEntityIdFromContext;
  }
  if (tenantId) {
    const tenantEntityId = await resolveTenantEntityId(tenantId);
    // Fail-closed for tenant traffic: never fallback to global env value.
    return tenantEntityId;
  }

  return config.defaultEntityId;
}

function readNerisDetailString(responseBody) {
  if (!responseBody || typeof responseBody !== "object") {
    return "";
  }
  const detail = responseBody.detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    try {
      return JSON.stringify(detail);
    } catch {
      return "";
    }
  }
  if (typeof responseBody.raw === "string") {
    return responseBody.raw;
  }
  return "";
}

function parseIncidentNerisIdsFromText(rawText) {
  const text = trimValue(rawText);
  if (!text) {
    return [];
  }
  const matches = text.match(/FD\d{8}\|[\w\-:]+\|\d{10}/g);
  if (!matches) {
    return [];
  }
  return Array.from(new Set(matches.map((entry) => trimValue(entry)).filter(Boolean)));
}

function collectIncidentNerisIdHints(exportRequestBody, createResponseBody) {
  const hints = [];
  const body =
    exportRequestBody && typeof exportRequestBody === "object" ? exportRequestBody : {};
  const integration =
    body.integration && typeof body.integration === "object" ? body.integration : {};
  const formValues =
    body.formValues && typeof body.formValues === "object" ? body.formValues : {};

  const integrationIncidentNerisId = trimValue(integration.existingIncidentNerisId);
  if (integrationIncidentNerisId) {
    hints.push({
      value: integrationIncidentNerisId,
      source: "integration.existingIncidentNerisId",
    });
  }

  const formIncidentNerisId = trimValue(formValues.incident_neris_id);
  if (formIncidentNerisId) {
    hints.push({
      value: formIncidentNerisId,
      source: "formValues.incident_neris_id",
    });
  }

  const directIncidentNerisId = trimValue(body.incidentNerisId);
  if (directIncidentNerisId) {
    hints.push({
      value: directIncidentNerisId,
      source: "body.incidentNerisId",
    });
  }

  const createDetail = readNerisDetailString(createResponseBody);
  parseIncidentNerisIdsFromText(createDetail).forEach((value) => {
    hints.push({
      value,
      source: "createResponse.detail",
    });
  });

  if (
    createResponseBody &&
    typeof createResponseBody === "object" &&
    typeof createResponseBody.neris_id === "string"
  ) {
    hints.push({
      value: trimValue(createResponseBody.neris_id),
      source: "createResponse.neris_id",
    });
  }

  const unique = new Map();
  hints.forEach((hint) => {
    if (!hint.value || !NERIS_INCIDENT_ID_PATTERN.test(hint.value)) {
      return;
    }
    if (!unique.has(hint.value)) {
      unique.set(hint.value, hint);
    }
  });
  return Array.from(unique.values());
}

function selectIncidentNerisIdHint(hints, entityId) {
  if (!Array.isArray(hints) || hints.length === 0) {
    return null;
  }
  const preferredByEntity = hints.find((hint) => hint.value.startsWith(`${entityId}|`));
  return preferredByEntity || hints[0] || null;
}

function shouldAttemptCreateConflictFallback(createStatus, createResponseBody) {
  if (createStatus !== 409) {
    return false;
  }
  const detail = readNerisDetailString(createResponseBody).toLowerCase();
  if (!detail) {
    return false;
  }
  return detail.includes("cannot be resubmitted") || detail.includes("status of approved");
}

app.post("/api/neris/validate", async (request, response) => {
  const config = getProxyConfig();
  const entityId = await resolveEntityIdFromRequest(
    request.body,
    request.headers,
    config,
    request.tenant,
  );

  if (!entityId) {
    response.status(400).json({
      ok: false,
      message:
        "Missing NERIS entity ID. Set this tenant's NERIS entity in Department Details or pass integration.entityId.",
    });
    return;
  }
  if (!NERIS_ENTITY_ID_PATTERN.test(entityId)) {
    response.status(400).json({
      ok: false,
      message:
        "Invalid NERIS entity ID format. Expected FD########, VN########, FM########, or FA########.",
      submittedEntityId: entityId,
    });
    return;
  }

  try {
    const payload = buildIncidentPayload(request.body, config, entityId);
    const accessToken = await getAccessToken(config);

    const nerisResponse = await fetch(
      `${config.createIncidentUrlPrefix}/${encodeURIComponent(entityId)}/validate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const nerisResponseBody = await parseResponseBody(nerisResponse);
    let troubleshooting = null;
    if (nerisResponse.status === 403) {
      const entitiesResult = await fetchAccessibleEntities(config, accessToken);
      const submittedDepartmentNerisId =
        payload?.base && typeof payload.base === "object"
          ? trimValue(payload.base.department_neris_id)
          : "";
      const entityIsAccessible = entitiesResult.entityIds.includes(entityId);
      troubleshooting = {
        message: entityIsAccessible
          ? "Token can list this entity, but validate permission is denied. Confirm account role/enrollment allows validate/create actions for this entity."
          : "Token may not be authorized for submittedEntityId. Compare submittedEntityId against entityNerisIds returned by GET /entity (directory list; not a canonical authorization endpoint).",
        entityNerisIdsFromEntityList: entitiesResult.entityIds,
        accessibleEntityIds: entitiesResult.entityIds,
        entitiesLookupStatus: entitiesResult.status,
        submittedDepartmentNerisId,
        entityIsAccessible,
      };
    }

    response.status(nerisResponse.status).json({
      ok: nerisResponse.ok,
      status: nerisResponse.status,
      statusText: nerisResponse.statusText,
      neris: nerisResponseBody,
      submittedEntityId: entityId,
      submittedPayload: payload,
      troubleshooting,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected proxy validate error.",
    });
  }
});

app.post("/api/neris/export", async (request, response) => {
  const config = getProxyConfig();
  const entityId = await resolveEntityIdFromRequest(
    request.body,
    request.headers,
    config,
    request.tenant,
  );

  if (!entityId) {
    response.status(400).json({
      ok: false,
      message:
        "Missing NERIS entity ID. Set this tenant's NERIS entity in Department Details or pass integration.entityId.",
    });
    return;
  }
  if (!NERIS_ENTITY_ID_PATTERN.test(entityId)) {
    response.status(400).json({
      ok: false,
      message:
        "Invalid NERIS entity ID format. Expected FD########, VN########, FM########, or FA########.",
      submittedEntityId: entityId,
    });
    return;
  }

  try {
    const payload = buildIncidentPayload(request.body, config, entityId);
    const accessToken = await getAccessToken(config);
    const requestHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    const createResponse = await fetch(
      `${config.createIncidentUrlPrefix}/${encodeURIComponent(entityId)}`,
      {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(payload),
      },
    );
    const createResponseBody = await parseResponseBody(createResponse);

    const integration =
      request.body?.integration && typeof request.body.integration === "object"
        ? request.body.integration
        : {};
    const allowFallbackUpdate =
      typeof integration.allowUpdateFallback === "boolean"
        ? integration.allowUpdateFallback
        : true;
    const fallback = {
      allowed: allowFallbackUpdate,
      attempted: false,
      succeeded: false,
      strategy: "create-then-put-on-409",
      reason: "",
      usedIncidentNerisId: "",
      usedIncidentNerisIdSource: "",
      candidateIncidentNerisIds: [],
      createStatus: createResponse.status,
      createStatusText: createResponse.statusText,
      createDetail: readNerisDetailString(createResponseBody),
      updateStatus: null,
      updateStatusText: "",
      updateDetail: "",
    };

    let finalResponse = createResponse;
    let finalResponseBody = createResponseBody;

    if (
      allowFallbackUpdate &&
      shouldAttemptCreateConflictFallback(createResponse.status, createResponseBody)
    ) {
      const incidentNerisIdHints = collectIncidentNerisIdHints(
        request.body,
        createResponseBody,
      );
      fallback.attempted = true;
      fallback.candidateIncidentNerisIds = incidentNerisIdHints.map((hint) => hint.value);
      fallback.reason = "create-returned-409-cannot-be-resubmitted";
      const selectedHint = selectIncidentNerisIdHint(incidentNerisIdHints, entityId);
      if (selectedHint) {
        fallback.usedIncidentNerisId = selectedHint.value;
        fallback.usedIncidentNerisIdSource = selectedHint.source;
        const updateResponse = await fetch(
          `${config.createIncidentUrlPrefix}/${encodeURIComponent(entityId)}/${encodeURIComponent(
            selectedHint.value,
          )}`,
          {
            method: "PUT",
            headers: requestHeaders,
            body: JSON.stringify(payload),
          },
        );
        const updateResponseBody = await parseResponseBody(updateResponse);
        fallback.updateStatus = updateResponse.status;
        fallback.updateStatusText = updateResponse.statusText;
        fallback.updateDetail = readNerisDetailString(updateResponseBody);
        finalResponse = updateResponse;
        finalResponseBody = updateResponseBody;
        if (updateResponse.ok) {
          fallback.succeeded = true;
        }
      } else {
        fallback.reason = `${fallback.reason};missing-valid-incident-neris-id-hint`;
      }
    }

    let troubleshooting = null;
    if (finalResponse.status === 403 || createResponse.status === 403) {
      const entitiesResult = await fetchAccessibleEntities(config, accessToken);
      const submittedDepartmentNerisId =
        payload?.base && typeof payload.base === "object"
          ? trimValue(payload.base.department_neris_id)
          : "";
      const entityIsAccessible = entitiesResult.entityIds.includes(entityId);
      troubleshooting = {
        message: entityIsAccessible
          ? "Token can list this entity, but create/update permission is denied. Confirm account role/enrollment allows incident write actions for this entity."
          : "Token may not be authorized for submittedEntityId. Compare submittedEntityId against entityNerisIds returned by GET /entity (directory list; not a canonical authorization endpoint).",
        entityNerisIdsFromEntityList: entitiesResult.entityIds,
        accessibleEntityIds: entitiesResult.entityIds,
        entitiesLookupStatus: entitiesResult.status,
        submittedDepartmentNerisId,
        entityIsAccessible,
      };
    }
    response.status(finalResponse.status).json({
      ok: finalResponse.ok,
      status: finalResponse.status,
      statusText: finalResponse.statusText,
      neris: finalResponseBody,
      submittedEntityId: entityId,
      submittedPayload: payload,
      troubleshooting,
      fallback,
      createResult: {
        status: createResponse.status,
        statusText: createResponse.statusText,
        neris: createResponseBody,
      },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected proxy error.",
    });
  }
});

const config = getProxyConfig();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistDir = path.resolve(__dirname, "../dist");
const frontendIndexPath = path.join(frontendDistDir, "index.html");
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

if (hasFrontendBuild) {
  app.use(express.static(frontendDistDir));
  app.get(/^\/(?!api(?:\/|$)).*/, (request, response) => {
    response.sendFile(frontendIndexPath);
  });
} else {
  app.get("/", (_request, response) => {
    response.status(404).send("Frontend build not found. Run `npm run build` before starting staging web UI.");
  });
}

app.listen(config.proxyPort, () => {
  console.log(`NERIS proxy listening on http://localhost:${config.proxyPort}`);
  console.log(`NERIS base URL: ${config.baseUrl}`);
  if (hasFrontendBuild) {
    console.log(`Frontend build detected at ${frontendDistDir} and served by proxy.`);
  }
});
