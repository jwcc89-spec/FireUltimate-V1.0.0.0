import bcrypt from "bcryptjs";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import {
  getDispatchPlainTextFromRawBody,
  parseCadRulesJson,
  runCadRulePipeline,
} from "./cadDispatchRuleEngine.mjs";
import { cadIngestGuard, configuredCadIngestSecret } from "./cad/ingestGuard.mjs";
import {
  buildFireRecoveryPayload,
  isMotorVehicleIncident,
  missingFireRecoveryFields,
  missingRecommendedFireRecoveryFields,
  extractIncidentMetadataFromExportPayload,
} from "./fireRecoveryMapping.mjs";
import {
  getFireRecoveryJwt,
  postAddNerisIncidentForBilling,
  postIncidentBillingStatus,
} from "./fireRecoveryClient.mjs";
import {
  fireRecoveryModeBanner,
  readFireRecoveryMode,
  resolveFireRecoveryDepartmentId,
} from "./fireRecoveryMode.mjs";
import {
  classifyVendorReply,
  displaySubmitStatus,
  nextTrackingId,
  previewHash,
} from "./fireRecoverySubmit.mjs";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./crypto/secretBox.mjs";
import { PublicError, publicErrorMessage } from "./http/publicError.mjs";
import {
  PUBLIC_API_ROUTES,
  applySessionCookie,
  clearLoginLockouts,
  clearSessionCookie,
  createSession,
  loginCredentialsOversized,
  loginLockStatus,
  noteLoginFailure,
  noteLoginSuccess,
  normalizeRole,
  originAllowed,
  publicHostname,
  readAuthFromRequest,
  revokeAllSessions,
  revokeOtherSessions,
} from "./auth/sessions.mjs";
import {
  PERMISSIONS,
  accountChangeError,
  canonicalRole,
  isSelfNameOnlyUserPatch,
  loadPolicy,
  minimumRoleFor,
  parseRole,
  permissionForRequest,
  policyChangeError,
  roleLevel,
  writeAccountAudit,
} from "./auth/permissions.mjs";
import { tradeRequestBlockReasonFromStored } from "./trades/eligibility.mjs";
import { applyAcceptedTrade, rowsFromScheduleChange } from "./trades/applySchedule.mjs";

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
// /API/users and /api/users/ must not reach the real handlers.
app.set("case sensitive routing", true);
app.set("strict routing", true);
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

function chicagoLocalStamp(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
}

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
  const normalized = trimValue(userType).toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "super_admin" || normalized === "superadmin") return "superadmin";
  if (normalized === "sub_admin" || normalized === "subadmin") return "subadmin";
  if (normalized === "admin" || normalized.includes("admin")) return "admin";
  return "user";
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
    throw new PublicError(
      "Missing server auth config. Set NERIS_CLIENT_ID and NERIS_CLIENT_SECRET in .env.server (or set NERIS_STATIC_ACCESS_TOKEN).",
    );
  }
  if (config.grantType === "password" && (!config.username || !config.password)) {
    throw new PublicError(
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
    throw new PublicError(
      `Token request failed (${tokenResponse.status} ${tokenResponse.statusText}). ${JSON.stringify(
        tokenResponseBody ?? {},
      )}${hint}`,
    );
  }

  if (!tokenResponseBody || typeof tokenResponseBody !== "object") {
    throw new PublicError("Token response was empty or invalid.");
  }

  const accessToken = trimValue(tokenResponseBody.access_token);
  if (!accessToken) {
    const challengeName = trimValue(tokenResponseBody.challenge_name);
    if (challengeName) {
      throw new PublicError(
        `Token flow requires additional challenge step (${challengeName}). Complete challenge auth in backend flow first.`,
      );
    }
    throw new PublicError("Token response did not include access_token.");
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

const NERIS_ENTITY_DIRECTORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
let cachedNerisEntityDirectory = null;

async function fetchEntityDirectoryPage(config, accessToken, pageNumber, pageSize) {
  const url = new URL(`${config.baseUrl}/entity`);
  url.searchParams.set("page_number", String(pageNumber));
  url.searchParams.set("page_size", String(pageSize));
  const apiResponse = await fetch(url.toString(), {
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
    url: url.toString(),
    body,
  };
}

async function refreshNerisEntityDirectoryCache(config) {
  const accessToken = await getAccessToken(config);
  // NERIS GET /entity rejects page_size > 100 (422 validation).
  const pageSize = 100;
  const firstPage = await fetchEntityDirectoryPage(config, accessToken, 1, pageSize);
  if (!firstPage.ok) {
    return {
      ok: false,
      status: firstPage.status,
      statusText: firstPage.statusText,
      body: firstPage.body,
    };
  }

  const firstBody = firstPage.body && typeof firstPage.body === "object" ? firstPage.body : {};
  const pageCount = Number.parseInt(String(firstBody.page_count ?? "1"), 10);
  const totalCount = Number.parseInt(String(firstBody.total_count ?? "0"), 10);
  const entities = Array.isArray(firstBody.entities) ? firstBody.entities : [];

  const pages = [];
  for (let pageNumber = 2; pageNumber <= Math.max(pageCount, 1); pageNumber += 1) {
    pages.push(fetchEntityDirectoryPage(config, accessToken, pageNumber, pageSize));
  }
  const remainingPages = pages.length ? await Promise.all(pages) : [];
  for (const page of remainingPages) {
    if (!page.ok) {
      // Keep existing cache if present; report error to caller.
      return {
        ok: false,
        status: page.status,
        statusText: page.statusText,
        body: page.body,
      };
    }
    const body = page.body && typeof page.body === "object" ? page.body : {};
    const pageEntities = Array.isArray(body.entities) ? body.entities : [];
    entities.push(...pageEntities);
  }

  const normalized = entities
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const candidate = entry;
      const nerisId = trimValue(candidate.neris_id);
      const name = trimValue(candidate.name);
      if (!nerisId || !name) {
        return null;
      }
      return {
        nerisId,
        name,
        state: trimValue(candidate.state),
        city: trimValue(candidate.city),
        addressLine1: trimValue(candidate.address_line_1),
        zipCode: trimValue(candidate.zip_code),
        lastModified: trimValue(candidate.last_modified),
      };
    })
    .filter(Boolean);

  cachedNerisEntityDirectory = {
    fetchedAtIso: new Date().toISOString(),
    baseUrl: config.baseUrl,
    totalCount,
    pageCount: Math.max(pageCount, 1),
    entities: normalized,
  };

  return { ok: true, status: 200, statusText: "OK", body: cachedNerisEntityDirectory };
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
    throw new PublicError(
      `Invalid entity ID format (${entityId}). Expected FD########, VN########, FM########, or FA########.`,
    );
  }
  if (!departmentNerisId) {
    throw new PublicError(
      "Missing or invalid department NERIS ID. Use FD######## format in report field 'Department NERIS ID' (or set NERIS_DEPARTMENT_NERIS_ID on server).",
    );
  }
  if (entityId.startsWith("FD") && departmentNerisId !== entityId) {
    // FD entity exports should post under the same fire department ID.
    departmentNerisId = entityId;
  }
  if (!incidentNumber) {
    throw new PublicError("Missing incident number.");
  }
  if (!dispatchIncidentNumber) {
    throw new PublicError("Missing dispatch incident number.");
  }
  if (!primaryIncidentType) {
    throw new PublicError("Missing primary incident type.");
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
    trimValue(formValues.incident_location_state) ||
      trimValue(formValues.location_state) ||
      baseLocation.state,
    config.defaultState,
  );
  const normalizedDispatchState = normalizeStateCode(
    dispatchLocation.state || trimValue(formValues.location_state),
    config.defaultState,
  );
  const normalizedLocationCountry = normalizeCountryCode(
    trimValue(formValues.location_country) || baseLocation.country || "US",
    config.defaultCountry || "US",
  );
  baseLocation.state = normalizedLocationState;
  baseLocation.country = normalizedLocationCountry;
  dispatchLocation.state = normalizedDispatchState;
  dispatchLocation.country = normalizedLocationCountry;

  const incidentStreet = trimValue(formValues.incident_location_street);
  const incidentCity = trimValue(formValues.incident_location_city);
  if (incidentStreet) baseLocation.street = incidentStreet;
  if (incidentCity) baseLocation.incorporated_municipality = incidentCity;
  const postalCode =
    trimValue(formValues.incident_location_zip) || trimValue(formValues.location_postal_code);
  if (postalCode) {
    baseLocation.postal_code = postalCode;
  }
  const dispatchPostalCode =
    trimValue(formValues.dispatch_location_address).match(/\b\d{5}(?:-\d{4})?\b/)?.[0] ?? "";
  if (dispatchPostalCode) {
    dispatchLocation.postal_code = dispatchPostalCode;
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

const PLATFORM_ADMIN_KEY = trimValue(process.env.PLATFORM_ADMIN_KEY);
const ADMIN_STATUSES = new Set(["sandbox", "trial", "active", "suspended", "archived"]);

/** API path with one trailing slash removed. Empty when the path is not under /api. Letters after /api keep their case. */
function canonicalApiPath(path) {
  const exact = String(path || "").split("?")[0];
  if (!exact.toLowerCase().startsWith("/api")) return "";
  const trimmed = exact.length > 1 && exact.endsWith("/") ? exact.slice(0, -1) : exact;
  return `/api${trimmed.slice(4)}`;
}

function requirePlatformAdmin(request, response, next) {
  if (!request.path.toLowerCase().startsWith("/api/admin")) {
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
      message: publicErrorMessage(error, "Unexpected error creating tenant."),
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
      message: publicErrorMessage(error, "Unexpected error adding domain."),
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

    const host = publicHostname(request) || normalizeHostname(request.hostname);

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
      message: publicErrorMessage(error, "Tenant resolution failed."),
    });
  }
});

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

app.use(async (request, response, next) => {
  try {
    const exactPath = String(request.path || "").split("?")[0];
    const canonical = canonicalApiPath(exactPath);
    if (!canonical) {
      next();
      return;
    }
    // A different letter case or a trailing slash is not the real route.
    if (exactPath !== canonical) {
      response.status(404).json({ ok: false, message: "Not found." });
      return;
    }
    // Program-owner tools keep the platform admin key. CAD inbound keeps its shared secret.
    if (exactPath.startsWith("/api/admin") || exactPath === "/api/cad/inbound-email") {
      next();
      return;
    }
    const routeMethod = request.method === "HEAD" ? "GET" : request.method;
    const routeKey = `${routeMethod} ${exactPath}`;
    const isPublic = PUBLIC_API_ROUTES.has(routeKey);
    const mutating = MUTATING_METHODS.has(request.method);
    if (isPublic) {
      if (mutating && !originAllowed(request)) {
        response.status(403).json({
          ok: false,
          message: "This action must come from the department's own website.",
        });
        return;
      }
      next();
      return;
    }
    const auth = await readAuthFromRequest(prisma, request);
    if (!auth) {
      clearSessionCookie(response, request);
      response.status(401).json({
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Sign in required.",
      });
      return;
    }
    if (mutating && !originAllowed(request)) {
      response.status(403).json({
        ok: false,
        message: "This action must come from the department's own website.",
      });
      return;
    }
    request.auth = auth;
    next();
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Sign-in check failed."),
    });
  }
});

app.use(async (request, response, next) => {
  try {
    if (!request.auth) {
      next();
      return;
    }
    let permission = permissionForRequest(request.method, request.path, request.body);
    if (
      permission === "users.manage" &&
      isSelfNameOnlyUserPatch(request.method, request.path, request.body, request.auth)
    ) {
      permission = null;
    }
    if (permission === "schedule.edit") {
      const scheduleMinimum = await minimumRoleFor(prisma, request.tenant.id, permission);
      const scheduleAllowed =
        scheduleMinimum != null && roleLevel(request.auth.role) >= roleLevel(scheduleMinimum);
      request.scheduleSelfServeOnly = !scheduleAllowed;
      next();
      return;
    }
    if (!permission) {
      next();
      return;
    }
    const minimumRole = await minimumRoleFor(prisma, request.tenant.id, permission);
    const allowed = minimumRole != null && roleLevel(request.auth.role) >= roleLevel(minimumRole);
    if (!allowed) {
      response.status(403).json({
        ok: false,
        code: "FORBIDDEN",
        message: "You do not have permission to do that.",
      });
      return;
    }
    next();
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Permission check failed."),
    });
  }
});

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

app.get("/api/auth/session", async (request, response) => {
  const tenantId = request.tenant?.id;
  const fullNameMap = tenantId ? await getTenantUserFullNameMap(tenantId) : {};
  const username = request.auth.username;
  const name = trimValue(fullNameMap[username.toLowerCase()]) || username;
  response.json({
    ok: true,
    user: {
      username,
      name,
      role: request.auth.role,
    },
  });
});

app.post("/api/auth/logout", async (request, response) => {
  if (request.auth?.sessionId) {
    await prisma.session.update({
      where: { id: request.auth.sessionId },
      data: { revokedAt: new Date() },
    }).catch(() => {});
  }
  clearSessionCookie(response, request);
  response.json({ ok: true });
});

app.get("/api/permissions", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const { grants } = await loadPolicy(prisma, tenantId, request.auth.role);
    response.json({ ok: true, role: canonicalRole(request.auth.role), grants });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Could not load permissions."),
    });
  }
});

app.get("/api/permissions/policy", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const { policy } = await loadPolicy(prisma, tenantId, request.auth.role);
    response.json({ ok: true, role: canonicalRole(request.auth.role), policy });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Could not load the permission list."),
    });
  }
});

app.put("/api/permissions/policy", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const permission = trimValue(body.permission);
    const known = PERMISSIONS.some((item) => item.key === permission);
    if (!known) {
      response.status(400).json({ ok: false, message: "Unknown permission." });
      return;
    }
    const nextMinimum = parseRole(body.minimumRole);
    if (!nextMinimum) {
      response.status(400).json({ ok: false, message: "Unknown role." });
      return;
    }
    const currentMinimum = await minimumRoleFor(prisma, tenantId, permission);
    const denial = policyChangeError(request.auth.role, currentMinimum, nextMinimum);
    if (denial) {
      response.status(403).json({ ok: false, code: "FORBIDDEN", message: denial });
      return;
    }
    await prisma.rolePermission.upsert({
      where: { tenantId_permission: { tenantId, permission } },
      update: { minimumRole: nextMinimum },
      create: { tenantId, permission, minimumRole: nextMinimum },
    });
    const { policy } = await loadPolicy(prisma, tenantId, request.auth.role);
    response.json({ ok: true, role: canonicalRole(request.auth.role), policy });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Could not save the permission."),
    });
  }
});

app.get("/api/account-audit", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const entries = await prisma.accountAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        actorUsername: true,
        action: true,
        targetUsername: true,
        detail: true,
        createdAt: true,
      },
    });
    response.json({ ok: true, entries });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Could not load the account log."),
    });
  }
});

app.get("/api/tenant/context", (request, response) => {
  response.json({
    ok: true,
    tenant: request.tenant ?? null,
  });
});

// ----- CAD inbound allowlist: unknown department or an empty sender list accepts no one -----
function extractEmailFromCadFromField(fromRaw) {
  const s = trimValue(fromRaw);
  if (!s) return "";
  const angle = s.match(/<([^>]+)>/);
  const candidate = angle ? trimValue(angle[1]) : s;
  const emailMatch = candidate.match(/([^\s<>]+@[^\s<>]+)/);
  return emailMatch ? trimValue(emailMatch[1]).toLowerCase() : candidate.toLowerCase();
}

function emailLocalPartDomain(emailLower) {
  const at = emailLower.lastIndexOf("@");
  if (at <= 0) return { local: "", domain: "" };
  return {
    local: emailLower.slice(0, at),
    domain: emailLower.slice(at + 1),
  };
}

function matchesCadDomainSuffix(emailDomainLower, patternRaw) {
  const p = trimValue(patternRaw).toLowerCase();
  if (!p || !emailDomainLower) return false;
  return emailDomainLower === p || emailDomainLower.endsWith("." + p);
}

function cadFromMatchesAllowlistEntry(fromRaw, emailLower, pattern, patternType) {
  const p = trimValue(pattern);
  if (!p) return false;
  const type = trimValue(patternType).toLowerCase() || "domain_suffix";
  if (type === "exact_email") {
    return emailLower === p.toLowerCase();
  }
  if (type === "domain_suffix") {
    const { domain } = emailLocalPartDomain(emailLower);
    return matchesCadDomainSuffix(domain, p);
  }
  if (type === "regex") {
    try {
      const re = new RegExp(p, "i");
      return re.test(fromRaw) || (emailLower && re.test(emailLower));
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * @returns {Promise<{ allowed: boolean }>}
 * Unknown department or an empty enabled-sender list accepts no one.
 */
async function cadInboundAllowlistDecision(tenantId, fromAddress) {
  if (!tenantId) {
    return { allowed: false };
  }
  const entries = await prisma.cadEmailAllowlistEntry.findMany({
    where: { tenantId, enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { pattern: true, patternType: true },
  });
  if (entries.length === 0) {
    return { allowed: false };
  }
  const emailLower = extractEmailFromCadFromField(fromAddress);
  const fromRaw = typeof fromAddress === "string" ? fromAddress : "";
  for (const e of entries) {
    if (cadFromMatchesAllowlistEntry(fromRaw, emailLower, e.pattern, e.patternType)) {
      return { allowed: true };
    }
  }
  return { allowed: false };
}

// ----- CAD ingest → message pipeline (Batch H): message rules → parsedMessageText on CadEmailIngest -----

const CAD_MESSAGE_TEXT_MAX = 50000;

async function cadIngestApplyMessagePipeline(tenantId, rawBody, emailRowId) {
  if (!tenantId || !emailRowId) return;
  try {
    const settings = await prisma.cadParsingSettings.findUnique({
      where: { tenantId },
    });
    if (!settings) return;

    let rules;
    try {
      rules = parseCadRulesJson(settings.messageRulesJson);
    } catch (e) {
      console.warn("[CAD ingest] message rules invalid:", e instanceof Error ? e.message : e);
      return;
    }

    const plain = getDispatchPlainTextFromRawBody(rawBody);
    if (!plain) {
      await prisma.cadEmailIngest.updateMany({
        where: { id: emailRowId, tenantId },
        data: { parsedMessageText: "" },
      });
      return;
    }

    const result = runCadRulePipeline(plain, rules);
    const text = result.ok ? result.text : plain;
    const slice = trimValue(String(text)).slice(0, CAD_MESSAGE_TEXT_MAX);
    if (!result.ok) {
      console.warn("[CAD ingest] message rule pipeline failed:", result.error);
    }
    await prisma.cadEmailIngest.updateMany({
      where: { id: emailRowId, tenantId },
      data: { parsedMessageText: slice },
    });
  } catch (e) {
    console.warn("[CAD ingest] message pipeline error:", e instanceof Error ? e.message : e);
  }
}

// ----- CAD ingest → incident automation (Batch G): after rules, create/update Incident by merge key -----

const CAD_INCIDENT_FIELD_MAP_TARGETS = new Set([
  "address",
  "incidentType",
  "priority",
  "stillDistrict",
  "assignedUnits",
  "reportedBy",
  "callbackNumber",
  "dispatchNotes",
  "mapReference",
  "dispatchInfo",
  "receivedAt",
]);

function extractCadIncidentMergeKey(slots, incidentNumberExtract) {
  if (
    incidentNumberExtract &&
    typeof incidentNumberExtract === "object" &&
    !Array.isArray(incidentNumberExtract)
  ) {
    const slotName = trimValue(incidentNumberExtract.slot);
    if (slotName && slots[slotName]) return trimValue(String(slots[slotName]));
  }
  if (slots.cfs) return trimValue(String(slots.cfs));
  if (slots.incidentNumber) return trimValue(String(slots.incidentNumber));
  return "";
}

function buildCadMappedIncidentFields(slots, fieldMap, pipelineText) {
  const data = {};
  if (fieldMap && typeof fieldMap === "object" && !Array.isArray(fieldMap)) {
    for (const [slotKey, targetRaw] of Object.entries(fieldMap)) {
      const target = trimValue(String(targetRaw));
      if (!CAD_INCIDENT_FIELD_MAP_TARGETS.has(target)) continue;
      const v = slots[slotKey];
      if (v == null || trimValue(String(v)) === "") continue;
      data[target] = trimValue(String(v));
    }
  }
  if (!data.dispatchNotes && pipelineText) {
    data.dispatchNotes = pipelineText.slice(0, 12000);
  }
  return data;
}

/**
 * Loads tenant parsing settings; if enableIncidentCreation and rules yield a merge key, creates or updates Incident.
 * Errors are logged; ingest HTTP response stays successful if email row was stored.
 */
async function cadIngestApplyIncidentAutomation(tenantId, rawBody) {
  if (!tenantId) return;

  const settings = await prisma.cadParsingSettings.findUnique({
    where: { tenantId },
  });
  if (!settings || !settings.enableIncidentCreation) return;

  const plain = getDispatchPlainTextFromRawBody(rawBody);
  if (!plain) return;

  let rules;
  try {
    rules = parseCadRulesJson(settings.incidentRulesJson);
  } catch (e) {
    console.warn("[CAD ingest] incident rules invalid:", e instanceof Error ? e.message : e);
    return;
  }

  const result = runCadRulePipeline(plain, rules);
  if (!result.ok) {
    console.warn("[CAD ingest] rule pipeline failed:", result.error);
    return;
  }

  const fieldMap =
    settings.incidentFieldMapJson &&
    typeof settings.incidentFieldMapJson === "object" &&
    !Array.isArray(settings.incidentFieldMapJson)
      ? settings.incidentFieldMapJson
      : {};

  const mergeKey = extractCadIncidentMergeKey(result.slots, settings.incidentNumberExtractJson);
  if (!mergeKey) {
    console.warn(
      "[CAD ingest] no incident merge key in slots (set incidentNumberExtract.slot or extract slot cfs / incidentNumber).",
    );
    return;
  }

  const mapped = buildCadMappedIncidentFields(result.slots, fieldMap, result.text);

  const existing = await prisma.incident.findFirst({
    where: { tenantId, incidentNumber: mergeKey, deletedAt: null },
  });

  if (existing) {
    const newBlock = trimValue(mapped.dispatchNotes) || trimValue(result.text) || "";
    const combined = [trimValue(existing.dispatchNotes), newBlock].filter(Boolean).join("\n\n--- CAD dispatch ---\n");
    const updateData = {
      dispatchNotes: combined.slice(0, 20000),
    };
    if (trimValue(mapped.address)) updateData.address = mapped.address;
    if (trimValue(mapped.incidentType)) updateData.incidentType = mapped.incidentType;
    if (trimValue(mapped.priority)) updateData.priority = mapped.priority;
    if (trimValue(mapped.stillDistrict)) updateData.stillDistrict = mapped.stillDistrict;
    if (trimValue(mapped.assignedUnits)) updateData.assignedUnits = mapped.assignedUnits;
    if (trimValue(mapped.reportedBy)) updateData.reportedBy = mapped.reportedBy;
    if (trimValue(mapped.callbackNumber)) updateData.callbackNumber = mapped.callbackNumber;
    if (trimValue(mapped.mapReference)) updateData.mapReference = mapped.mapReference;
    if (trimValue(mapped.dispatchInfo)) updateData.dispatchInfo = mapped.dispatchInfo;
    if (trimValue(mapped.receivedAt)) updateData.receivedAt = mapped.receivedAt;
    await prisma.incident.update({
      where: { id: existing.id },
      data: updateData,
    });
    return;
  }

  await prisma.incident.create({
    data: {
      tenantId,
      incidentNumber: mergeKey,
      dispatchNumber: mergeKey,
      incidentType: trimValue(mapped.incidentType) || "",
      priority: trimValue(mapped.priority) || "",
      address: trimValue(mapped.address) || "",
      stillDistrict: trimValue(mapped.stillDistrict) || "",
      assignedUnits: trimValue(mapped.assignedUnits) || "",
      reportedBy: trimValue(mapped.reportedBy) || null,
      callbackNumber: trimValue(mapped.callbackNumber) || null,
      dispatchNotes: trimValue(mapped.dispatchNotes) || null,
      mapReference: trimValue(mapped.mapReference) || null,
      currentState: "Draft",
      receivedAt: trimValue(mapped.receivedAt) || "",
      dispatchInfo: trimValue(mapped.dispatchInfo) || "CAD email ingest",
    },
  });
}

// ----- /api/cad/inbound-email (CAD email ingest from Cloudflare Worker; tenant from body.to) -----
app.post("/api/cad/inbound-email", async (request, response) => {
  try {
    const guard = cadIngestGuard(request);
    if (!guard.ok) {
      response.status(guard.status).json({ ok: false, message: guard.message });
      return;
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

    const allow = await cadInboundAllowlistDecision(tenantId, fromAddress);
    if (!allow.allowed) {
      response.status(200).json({
        ok: false,
        rejected: true,
        code: "cad_allowlist",
        message: "Sender is not allowed by CAD allowlist.",
      });
      return;
    }

    const ingestRow = await prisma.cadEmailIngest.create({
      data: {
        tenantId,
        fromAddress,
        toAddress,
        rawBody,
        headersJson,
      },
      select: { id: true },
    });

    try {
      await cadIngestApplyMessagePipeline(tenantId, rawBody, ingestRow.id);
    } catch (msgErr) {
      console.error("[CAD ingest] message pipeline error:", msgErr);
    }

    try {
      await cadIngestApplyIncidentAutomation(tenantId, rawBody);
    } catch (autoErr) {
      console.error("[CAD ingest] incident automation error:", autoErr);
    }

    response.status(200).json({ ok: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "CAD inbound email store failed."),
    });
  }
});

// ----- GET /api/cad/emails (tenant-scoped list for Dispatch Parsing Settings UI) -----
app.get("/api/cad/emails", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(401).json({ ok: false, message: "Tenant required." });
      return;
    }
    const limit = Math.min(parseInt(request.query.limit, 10) || 50, 200);
    const offset = Math.max(0, parseInt(request.query.offset, 10) || 0);
    const rows = await prisma.cadEmailIngest.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        fromAddress: true,
        toAddress: true,
        rawBody: true,
        headersJson: true,
        parsedMessageText: true,
        createdAt: true,
      },
    });
    const list = rows.map((r) => ({
      id: r.id,
      fromAddress: r.fromAddress ?? "",
      toAddress: r.toAddress ?? "",
      rawBody: r.rawBody ?? "",
      headersJson: r.headersJson ?? null,
      parsedMessageText: r.parsedMessageText ?? "",
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ""),
    }));
    response.json({ ok: true, data: list });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Failed to list CAD emails."),
    });
  }
});

const CAD_ALLOWLIST_PATTERN_TYPES = new Set(["domain_suffix", "exact_email", "regex"]);
const CAD_ALLOWLIST_MAX_ENTRIES = 200;
const CAD_ALLOWLIST_PATTERN_MAX_LEN = 500;

function defaultCadParsingConfigApi() {
  return {
    enableIncidentCreation: false,
    messageRules: [],
    incidentRules: [],
    incidentFieldMap: {},
    incidentNumberExtract: null,
  };
}

function cadParsingRowToApi(row) {
  const msg = row.messageRulesJson;
  const inc = row.incidentRulesJson;
  const map = row.incidentFieldMapJson;
  const ext = row.incidentNumberExtractJson;
  return {
    enableIncidentCreation: Boolean(row.enableIncidentCreation),
    messageRules: Array.isArray(msg) ? msg : [],
    incidentRules: Array.isArray(inc) ? inc : [],
    incidentFieldMap: map && typeof map === "object" && !Array.isArray(map) ? map : {},
    incidentNumberExtract:
      ext !== null && ext !== undefined && typeof ext === "object" && !Array.isArray(ext)
        ? ext
        : null,
  };
}

// ----- GET/PATCH /api/cad/parsing-config (tenant-scoped; Dispatch Parsing admin) -----
app.get("/api/cad/parsing-config", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const row = await prisma.cadParsingSettings.findUnique({
      where: { tenantId },
    });
    if (!row) {
      response.json({ ok: true, data: defaultCadParsingConfigApi() });
      return;
    }
    response.json({ ok: true, data: cadParsingRowToApi(row) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Failed to load CAD parsing config."),
    });
  }
});

app.patch("/api/cad/parsing-config", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const existing = await prisma.cadParsingSettings.findUnique({
      where: { tenantId },
    });
    const base = existing ? cadParsingRowToApi(existing) : defaultCadParsingConfigApi();

    let enableIncidentCreation = base.enableIncidentCreation;
    if (typeof body.enableIncidentCreation === "boolean") {
      enableIncidentCreation = body.enableIncidentCreation;
    }

    let messageRules = base.messageRules;
    if (body.messageRules !== undefined) {
      if (!Array.isArray(body.messageRules)) {
        response.status(400).json({ ok: false, message: "messageRules must be an array." });
        return;
      }
      messageRules = body.messageRules;
    }

    let incidentRules = base.incidentRules;
    if (body.incidentRules !== undefined) {
      if (!Array.isArray(body.incidentRules)) {
        response.status(400).json({ ok: false, message: "incidentRules must be an array." });
        return;
      }
      incidentRules = body.incidentRules;
    }

    let incidentFieldMap = base.incidentFieldMap;
    if (body.incidentFieldMap !== undefined) {
      if (
        typeof body.incidentFieldMap !== "object" ||
        body.incidentFieldMap === null ||
        Array.isArray(body.incidentFieldMap)
      ) {
        response.status(400).json({ ok: false, message: "incidentFieldMap must be an object." });
        return;
      }
      incidentFieldMap = body.incidentFieldMap;
    }

    let incidentNumberExtract = base.incidentNumberExtract;
    if (Object.prototype.hasOwnProperty.call(body, "incidentNumberExtract")) {
      if (body.incidentNumberExtract === null) {
        incidentNumberExtract = null;
      } else if (
        typeof body.incidentNumberExtract === "object" &&
        !Array.isArray(body.incidentNumberExtract)
      ) {
        incidentNumberExtract = body.incidentNumberExtract;
      } else {
        response.status(400).json({
          ok: false,
          message: "incidentNumberExtract must be an object or null.",
        });
        return;
      }
    }

    await prisma.cadParsingSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        enableIncidentCreation,
        messageRulesJson: messageRules,
        incidentRulesJson: incidentRules,
        incidentFieldMapJson: incidentFieldMap,
        incidentNumberExtractJson: incidentNumberExtract,
      },
      update: {
        enableIncidentCreation,
        messageRulesJson: messageRules,
        incidentRulesJson: incidentRules,
        incidentFieldMapJson: incidentFieldMap,
        incidentNumberExtractJson: incidentNumberExtract,
      },
    });

    response.json({
      ok: true,
      data: {
        enableIncidentCreation,
        messageRules,
        incidentRules,
        incidentFieldMap,
        incidentNumberExtract,
      },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Failed to save CAD parsing config."),
    });
  }
});

// ----- GET/PATCH /api/cad/allowlist (tenant-scoped; Batch D will enforce on ingest) -----
app.get("/api/cad/allowlist", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const rows = await prisma.cadEmailAllowlistEntry.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const entries = rows.map((r) => ({
      id: r.id,
      pattern: r.pattern,
      patternType: r.patternType,
      enabled: r.enabled,
      sortOrder: r.sortOrder,
    }));
    response.json({ ok: true, data: { entries } });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Failed to load CAD allowlist."),
    });
  }
});

app.patch("/api/cad/allowlist", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    if (!Array.isArray(body.entries)) {
      response.status(400).json({ ok: false, message: "Body must include entries array." });
      return;
    }
    if (body.entries.length > CAD_ALLOWLIST_MAX_ENTRIES) {
      response.status(400).json({
        ok: false,
        message: `At most ${CAD_ALLOWLIST_MAX_ENTRIES} allowlist entries allowed.`,
      });
      return;
    }

    const normalized = [];
    for (let i = 0; i < body.entries.length; i++) {
      const e = body.entries[i];
      if (!e || typeof e !== "object") {
        response.status(400).json({ ok: false, message: `Invalid entry at index ${i}.` });
        return;
      }
      const pattern = trimValue(typeof e.pattern === "string" ? e.pattern : "");
      if (!pattern) {
        response.status(400).json({ ok: false, message: `Empty pattern at index ${i}.` });
        return;
      }
      if (pattern.length > CAD_ALLOWLIST_PATTERN_MAX_LEN) {
        response.status(400).json({
          ok: false,
          message: `Pattern at index ${i} exceeds ${CAD_ALLOWLIST_PATTERN_MAX_LEN} characters.`,
        });
        return;
      }
      const patternType = trimValue(
        typeof e.patternType === "string" ? e.patternType : "domain_suffix",
      );
      if (!CAD_ALLOWLIST_PATTERN_TYPES.has(patternType)) {
        response.status(400).json({
          ok: false,
          message: `Invalid patternType at index ${i}. Use domain_suffix, exact_email, or regex.`,
        });
        return;
      }
      const enabled = typeof e.enabled === "boolean" ? e.enabled : true;
      const sortOrder =
        typeof e.sortOrder === "number" && Number.isFinite(e.sortOrder) ? Math.trunc(e.sortOrder) : i;
      normalized.push({ pattern, patternType, enabled, sortOrder });
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.cadEmailAllowlistEntry.deleteMany({ where: { tenantId } });
      const out = [];
      for (const e of normalized) {
        const row = await tx.cadEmailAllowlistEntry.create({
          data: {
            tenantId,
            pattern: e.pattern,
            patternType: e.patternType,
            enabled: e.enabled,
            sortOrder: e.sortOrder,
          },
        });
        out.push({
          id: row.id,
          pattern: row.pattern,
          patternType: row.patternType,
          enabled: row.enabled,
          sortOrder: row.sortOrder,
        });
      }
      return out;
    });

    response.json({ ok: true, data: { entries: created } });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Failed to save CAD allowlist."),
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
    initialDispatchCode: row.mapReference ?? "",
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
    const callNumbers = rows.map((r) => r.id);
    const drafts =
      callNumbers.length > 0
        ? await prisma.nerisDraft.findMany({
            where: { tenantId, callNumber: { in: callNumbers } },
            select: { callNumber: true, payload: true },
          })
        : [];
    const reportStatusByCall = new Map();
    const primaryIncidentTypeByCall = new Map();
    for (const d of drafts) {
      const payload = d.payload && typeof d.payload === "object" ? d.payload : {};
      if (payload.reportRemoved === true) continue;
      const status =
        typeof payload.reportStatus === "string" && payload.reportStatus.trim()
          ? payload.reportStatus.trim()
          : "Draft";
      reportStatusByCall.set(d.callNumber, status);
      const formValues =
        payload.formValues && typeof payload.formValues === "object" && !Array.isArray(payload.formValues)
          ? payload.formValues
          : {};
      const primaryType = trimValue(formValues.primary_incident_type);
      if (primaryType) primaryIncidentTypeByCall.set(d.callNumber, primaryType);
    }
    const data = rows.map((row) => {
      const api = incidentRowToApi(row);
      api.nerisReportStatus = reportStatusByCall.get(row.id) ?? "Draft";
      api.nerisPrimaryIncidentType = primaryIncidentTypeByCall.get(row.id) ?? "";
      return api;
    });
    response.json({ ok: true, data });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected incidents list error."),
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
        mapReference:
          trimValue(body.initialDispatchCode) || trimValue(body.mapReference) || null,
        currentState: trimValue(body.currentState) || "Draft",
        receivedAt: trimValue(body.receivedAt) || "",
        dispatchInfo: trimValue(body.dispatchInfo) || "",
        apparatusJson:
          body.apparatusJson != null && typeof body.apparatusJson === "object"
            ? body.apparatusJson
            : Array.isArray(body.apparatus)
              ? body.apparatus
              : null,
      },
    });
    response.status(201).json({ ok: true, data: incidentRowToApi(incident) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected incident create error."),
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
      message: publicErrorMessage(error, "Unexpected incident get error."),
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
    if (body.initialDispatchCode !== undefined)
      update.mapReference = trimValue(body.initialDispatchCode) || null;
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
    let updated = existing;
    if (Object.keys(update).length > 0) {
      const written = await prisma.incident.updateMany({
        where: { id, tenantId },
        data: update,
      });
      if (written.count !== 1) {
        response.status(404).json({ ok: false, message: "Incident not found." });
        return;
      }
      updated = await prisma.incident.findFirst({ where: { id, tenantId } });
    }
    response.json({ ok: true, data: incidentRowToApi(updated) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected incident update error."),
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
    const reportCallNumbers = [id];
    const incidentNumber = trimValue(existing.incidentNumber);
    if (incidentNumber && incidentNumber !== id) reportCallNumbers.push(incidentNumber);
    const linkedReports = (
      await prisma.nerisDraft.findMany({
        where: { tenantId, callNumber: { in: reportCallNumbers } },
      })
    ).filter((row) => !isReportRemoved(row.payload));
    if (linkedReports.length > 0 && roleLevel(request.auth?.role) < roleLevel("admin")) {
      response.status(403).json({
        ok: false,
        code: "FORBIDDEN",
        message: "Only an admin can delete a report.",
      });
      return;
    }
    if (linkedReports.some((row) => reportStatusOf(row.payload) !== "Draft")) {
      response.status(409).json({
        ok: false,
        code: "REPORT_LOCKED",
        message: "This report is locked. Unlock it before deleting.",
      });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const deletedBy = trimValue(body.deletedBy) || null;
    const deletedReason = trimValue(body.deletedReason) || null;
    const written = await prisma.incident.updateMany({
      where: { id, tenantId },
      data: {
        deletedAt: new Date(),
        deletedBy,
        deletedReason,
      },
    });
    if (written.count !== 1) {
      response.status(404).json({ ok: false, message: "Incident not found." });
      return;
    }
    const updated = await prisma.incident.findFirst({ where: { id, tenantId } });
    response.json({ ok: true, data: incidentRowToApi(updated) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected incident delete error."),
    });
  }
});

// ----- /api/neris/export-history (NERIS export history, cross-browser) -----
const SERVER_EXPORT_RECEIPT = "server-receipt:v1";

function stampServerExportDetail(detail) {
  return `${SERVER_EXPORT_RECEIPT}\n${String(detail ?? "").slice(0, 8000)}`;
}

function stripServerExportReceipt(detail) {
  const text = String(detail ?? "");
  const prefix = `${SERVER_EXPORT_RECEIPT}\n`;
  if (text.startsWith(prefix)) return text.slice(prefix.length);
  if (text === SERVER_EXPORT_RECEIPT) return "";
  return text;
}

function formatExportClock(date, offsetMinutes) {
  const shift = Number.isFinite(offsetMinutes) ? offsetMinutes : 0;
  const local = new Date(date.getTime() - shift * 60 * 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
}

function nerisIdFromReply(responseBody, fallback) {
  if (responseBody && typeof responseBody === "object" && typeof responseBody.neris_id === "string") {
    const fromBody = trimValue(responseBody.neris_id);
    if (fromBody) return fromBody;
  }
  return trimValue(fallback?.usedIncidentNerisId);
}

/** Prefer department full name when the stored value is a sign-in username. */
function displayNameFromUsernameMap(fullNameMap, usernameOrName) {
  const raw = trimValue(usernameOrName);
  if (!raw) return "";
  const mapped = trimValue(fullNameMap?.[raw.toLowerCase()]);
  return mapped || raw;
}

async function resolveExportReportWriterName(tenantId, auth, requestBody) {
  const body = requestBody && typeof requestBody === "object" ? requestBody : {};
  const fullNameMap = await getTenantUserFullNameMap(tenantId);
  const fromBody = trimValue(body.reportWriterName);
  const fromAuth = trimValue(auth?.username);
  return displayNameFromUsernameMap(fullNameMap, fromBody || fromAuth).slice(0, 200);
}

/**
 * After NERIS accepts an export, mark the saved report Exported on the server.
 * Do not rely on the browser finishing a follow-up draft save (timeouts and races left status on In Review).
 */
async function markNerisDraftExportedAfterSuccess(tenantId, callNumber, nerisId, auth) {
  const trimmedCall = trimValue(callNumber);
  if (!tenantId || !trimmedCall) return;
  const existing = await prisma.nerisDraft.findUnique({
    where: { tenantId_callNumber: { tenantId, callNumber: trimmedCall } },
  });
  if (!existing || isReportRemoved(existing.payload)) return;
  const previous =
    existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? existing.payload
      : {};
  if (reportStatusOf(previous) === "Exported") {
    const prevForm =
      previous.formValues && typeof previous.formValues === "object" && !Array.isArray(previous.formValues)
        ? previous.formValues
        : {};
    const alreadyHasId = trimValue(prevForm.incident_neris_id);
    const nextId = trimValue(nerisId);
    if (!nextId || alreadyHasId === nextId) return;
  }
  const previousForm =
    previous.formValues && typeof previous.formValues === "object" && !Array.isArray(previous.formValues)
      ? previous.formValues
      : {};
  const nextForm = { ...previousForm };
  const nextNerisId = trimValue(nerisId);
  if (nextNerisId) nextForm.incident_neris_id = nextNerisId;
  const nextPayload = {
    ...previous,
    reportRemoved: false,
    reportStatus: "Exported",
    formValues: nextForm,
  };
  await prisma.nerisDraft.update({
    where: { tenantId_callNumber: { tenantId, callNumber: trimmedCall } },
    data: { payload: nextPayload },
  });
  await recordReportChange(tenantId, trimmedCall, auth, ["reportStatus"]);
}

async function writeNerisExportReceipt({
  tenantId,
  auth,
  requestBody,
  entityId,
  payload,
  httpStatus,
  httpStatusText,
  responseBody,
  fallback,
}) {
  const body = requestBody && typeof requestBody === "object" ? requestBody : {};
  const formValues = body.formValues && typeof body.formValues === "object" ? body.formValues : {};
  const snapshot =
    body.incidentSnapshot && typeof body.incidentSnapshot === "object" ? body.incidentSnapshot : {};
  const integration = body.integration && typeof body.integration === "object" ? body.integration : {};
  const offset = Number.parseInt(String(integration.clientUtcOffsetMinutes ?? ""), 10);
  const succeeded = httpStatus >= 200 && httpStatus < 300;
  const now = new Date();
  const detailSource =
    responseBody && typeof responseBody === "object"
      ? JSON.stringify(responseBody)
      : readNerisDetailString(responseBody);
  const summary = readNerisDetailString(responseBody) || `${httpStatus} ${httpStatusText}`.trim();
  let preview = "";
  try {
    preview = JSON.stringify(payload ?? {});
  } catch {
    preview = "";
  }
  const reportWriterName = await resolveExportReportWriterName(tenantId, auth, body);
  const callNumber = trimValue(body.callNumber) ?? "";
  const nerisId = nerisIdFromReply(responseBody, fallback);
  const row = await prisma.nerisExportHistory.create({
    data: {
      tenantId,
      callNumber,
      incidentType: trimValue(snapshot.incidentType) || trimValue(formValues.primary_incident_type) || "",
      address: trimValue(snapshot.address) || trimValue(formValues.incident_location_address) || "",
      exportedAtIso: now.toISOString(),
      exportedAtLabel: formatExportClock(now, offset),
      attemptStatus: succeeded ? "success" : "failed",
      httpStatus,
      httpStatusText: String(httpStatusText ?? "").slice(0, 200),
      statusLabel: `${httpStatus} ${httpStatusText}`.trim(),
      reportStatusAtExport: succeeded ? "Exported" : trimValue(body.reportStatus) || "Draft",
      validatorName: "",
      reportWriterName,
      submittedEntityId: trimValue(entityId) ?? "",
      submittedDepartmentNerisId:
        trimValue(payload?.base?.department_neris_id) || trimValue(formValues.fd_neris_id) || "",
      nerisId,
      responseSummary: summary.slice(0, 2000),
      responseDetail: stampServerExportDetail(detailSource),
      submittedPayloadPreview: preview.slice(0, 200000),
    },
  });
  if (succeeded) {
    try {
      await markNerisDraftExportedAfterSuccess(tenantId, callNumber, nerisId, auth);
    } catch (error) {
      console.error("[NERIS export] Could not mark the report as Exported after a successful send.", {
        callNumber: callNumber.slice(0, 80),
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return row;
}

function nerisExportHistoryRowToApi(row) {
  return {
    id: row.id,
    callNumber: row.callNumber ?? "",
    incidentType: row.incidentType ?? "",
    address: row.address ?? "",
    exportedAtIso: row.exportedAtIso ?? "",
    exportedAtLabel: row.exportedAtLabel ?? "",
    attemptStatus: row.attemptStatus === "failed" ? "failed" : "success",
    httpStatus: typeof row.httpStatus === "number" ? row.httpStatus : 200,
    httpStatusText: row.httpStatusText ?? "",
    statusLabel: row.statusLabel ?? "",
    reportStatusAtExport: row.reportStatusAtExport ?? "",
    validatorName: row.validatorName ?? "",
    reportWriterName: row.reportWriterName ?? "",
    submittedEntityId: row.submittedEntityId ?? "",
    submittedDepartmentNerisId: row.submittedDepartmentNerisId ?? "",
    nerisId: row.nerisId ?? "",
    responseSummary: row.responseSummary ?? "",
    responseDetail: stripServerExportReceipt(row.responseDetail),
    submittedPayloadPreview: row.submittedPayloadPreview ?? "",
  };
}

app.get("/api/neris/export-history", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const limit = Math.min(Math.max(0, parseInt(request.query.limit, 10) || 100), 500);
    const offset = Math.max(0, parseInt(request.query.offset, 10) || 0);
    const rows = await prisma.nerisExportHistory.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
    const data = rows.map(nerisExportHistoryRowToApi);
    response.json({ ok: true, data });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected export history list error."),
    });
  }
});

app.post("/api/neris/export-history", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    if (body.attemptStatus !== "failed") {
      response.status(400).json({
        ok: false,
        message: "The browser can record only a failed export. The server records NERIS replies.",
      });
      return;
    }
    const callNumber = trimValue(body.callNumber) ?? "";
    const incidentType = trimValue(body.incidentType) ?? "";
    const address = trimValue(body.address) ?? "";
    const exportedAtIso = trimValue(body.exportedAtIso) ?? "";
    const exportedAtLabel = trimValue(body.exportedAtLabel) ?? "";
    const attemptStatus = "failed";
    const httpStatus =
      typeof body.httpStatus === "number" && Number.isFinite(body.httpStatus)
        ? body.httpStatus
        : attemptStatus === "failed"
          ? 0
          : 200;
    const httpStatusText = trimValue(body.httpStatusText) ?? "";
    const statusLabel = trimValue(body.statusLabel) ?? "";
    const reportStatusAtExport = trimValue(body.reportStatusAtExport) ?? "";
    const validatorName = trimValue(body.validatorName) ?? "";
    const reportWriterName = trimValue(body.reportWriterName) ?? "";
    const submittedEntityId = trimValue(body.submittedEntityId) ?? "";
    const submittedDepartmentNerisId = trimValue(body.submittedDepartmentNerisId) ?? "";
    const nerisId = trimValue(body.nerisId) ?? "";
    const responseSummary = trimValue(body.responseSummary) ?? "";
    const responseDetail = stripServerExportReceipt(trimValue(body.responseDetail) ?? "");
    const submittedPayloadPreview = trimValue(body.submittedPayloadPreview) ?? "";

    const row = await prisma.nerisExportHistory.create({
      data: {
        tenantId,
        callNumber,
        incidentType,
        address,
        exportedAtIso,
        exportedAtLabel,
        attemptStatus,
        httpStatus,
        httpStatusText,
        statusLabel,
        reportStatusAtExport,
        validatorName,
        reportWriterName,
        submittedEntityId,
        submittedDepartmentNerisId,
        nerisId,
        responseSummary,
        responseDetail,
        submittedPayloadPreview,
      },
    });
    response.status(201).json({ ok: true, data: nerisExportHistoryRowToApi(row) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected export history create error."),
    });
  }
});

const REPORT_CONFLICT_MESSAGE =
  "Someone else saved this report while you were editing. Reload to see their changes before saving again.";
const REPORT_LOCKED_MESSAGE = "This report is locked. Unlock it before saving changes.";
const LOGO_MAX_BYTES = 500 * 1024;

function reportStatusOf(payload) {
  const status = trimValue(payload && typeof payload === "object" ? payload.reportStatus : "");
  if (status === "In Review" || status === "Exported") return status;
  return "Draft";
}

function isReportRemoved(payload) {
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && payload.reportRemoved === true);
}

function removedReportPayload(existing) {
  const previous =
    existing?.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? existing.payload
      : {};
  return { ...previous, reportRemoved: true, reportStatus: "Draft" };
}

function draftPayloadFromBody(body) {
  const source = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const nested =
    source.payload && typeof source.payload === "object" && !Array.isArray(source.payload)
      ? source.payload
      : source;
  const payload = { ...nested };
  delete payload.baseUpdatedAt;
  delete payload.payload;
  delete payload.seedFormValues;
  delete payload.reportRemoved;
  return payload;
}

function seedFormValuesFromBody(body) {
  const source = body && typeof body === "object" && !Array.isArray(body) ? body.seedFormValues : null;
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const seed = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" || typeof value === "number") seed[key] = String(value);
  }
  return seed;
}

function revisionMatches(updatedAt, baseUpdatedAt) {
  const expected = Date.parse(String(baseUpdatedAt ?? ""));
  const actual = updatedAt instanceof Date ? updatedAt.getTime() : Date.parse(String(updatedAt ?? ""));
  return Number.isFinite(expected) && Number.isFinite(actual) && expected === actual;
}

const HISTORY_SKIP_KEYS = new Set([
  "formValues",
  "baseUpdatedAt",
  "lastSavedAt",
  "payload",
  "reportRemoved",
  "seedFormValues",
]);

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isEmptyHistoryValue(value) {
  if (value == null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function changedFieldNames(previous, next, seedFormValues) {
  const prev = plainObject(previous);
  const nxt = plainObject(next);
  const seed = plainObject(seedFormValues);
  const names = new Set();
  const prevForm = plainObject(prev.formValues);
  const nextForm = plainObject(nxt.formValues);
  for (const key of new Set([...Object.keys(prevForm), ...Object.keys(nextForm)])) {
    const previousValue = String(prevForm[key] ?? "");
    const nextValue = String(nextForm[key] ?? "");
    if (previousValue === nextValue) continue;
    const copiedFromIncident =
      !Object.prototype.hasOwnProperty.call(prevForm, key) &&
      Object.prototype.hasOwnProperty.call(seed, key) &&
      String(seed[key] ?? "") === nextValue;
    if (copiedFromIncident) continue;
    names.add(key);
  }
  for (const key of new Set([...Object.keys(prev), ...Object.keys(nxt)])) {
    if (HISTORY_SKIP_KEYS.has(key)) continue;
    if (key === "reportStatus") {
      const nextStatus = trimValue(nxt.reportStatus) || "Draft";
      if (!trimValue(prev.reportStatus) && nextStatus === "Draft") continue;
      if ((trimValue(prev.reportStatus) || "Draft") !== nextStatus) names.add(key);
      continue;
    }
    const prevValue = prev[key] ?? null;
    const nextValue = nxt[key] ?? null;
    if (JSON.stringify(prevValue) === JSON.stringify(nextValue)) continue;
    if (isEmptyHistoryValue(prevValue) && isEmptyHistoryValue(nextValue)) continue;
    names.add(key);
  }
  return [...names].sort();
}

async function recordReportChange(tenantId, callNumber, auth, fieldNames) {
  if (!fieldNames.length) return;
  await prisma.nerisReportChange.create({
    data: {
      tenantId,
      callNumber,
      actorUserId: auth?.userId ?? null,
      actorUsername: trimValue(auth?.username) || "unknown",
      fieldNames,
    },
  });
}

function draftJson(row) {
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
  const updatedAt = row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt);
  return { ok: true, data: payload, updatedAt: updatedAt.toISOString() };
}

function imageDataUrlBytes(dataUrl) {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[1].replace(/\s/g, ""), "base64").length;
  } catch {
    return null;
  }
}

function sharedSettingsPatch(body) {
  const source = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(source, "logoDataUrl")) {
    if (typeof source.logoDataUrl !== "string") {
      return { error: "The department logo must be an image file." };
    }
    const logo = source.logoDataUrl.trim();
    if (logo === "") {
      patch.logoDataUrl = "";
    } else {
      const bytes = imageDataUrlBytes(logo);
      if (bytes === null) return { error: "The department logo must be an image file." };
      if (bytes > LOGO_MAX_BYTES) return { error: "The department logo must be 500 KB or smaller." };
      patch.logoDataUrl = logo;
    }
  }
  if (Object.prototype.hasOwnProperty.call(source, "workflowStates")) {
    if (!Array.isArray(source.workflowStates)) return { error: "Workflow states must be a list." };
    const states = [];
    for (const item of source.workflowStates) {
      const text = trimValue(item);
      if (!text || text.length > 80 || states.includes(text)) continue;
      states.push(text);
      if (states.length >= 40) break;
    }
    if (!states.length) return { error: "Keep at least one workflow state." };
    patch.workflowStates = states;
  }
  if (Object.prototype.hasOwnProperty.call(source, "submenuVisibility")) {
    const raw = source.submenuVisibility;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { error: "Submenu visibility must be a set of on or off choices." };
    }
    const visibility = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value !== "boolean") continue;
      const path = trimValue(key);
      if (!path.startsWith("/") || path.length > 120) continue;
      visibility[path] = value;
    }
    patch.submenuVisibility = visibility;
  }
  if (Object.prototype.hasOwnProperty.call(source, "displayCards")) {
    const raw = source.displayCards;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { error: "Submenu cards must be a list." };
    }
    const cards = {};
    for (const [key, value] of Object.entries(raw)) {
      const menuId = trimValue(key);
      if (!menuId || menuId.length > 40 || !Array.isArray(value)) continue;
      cards[menuId] = value
        .map((item) => trimValue(item))
        .filter((item) => item.startsWith("/") && item.length <= 120)
        .slice(0, 40);
    }
    patch.displayCards = cards;
  }
  return { patch };
}

// Call numbers whose NERIS report was deleted. The incident itself stays.
app.get("/api/neris/removed-reports", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const rows = await prisma.nerisDraft.findMany({
      where: {
        tenantId,
        payload: { path: ["reportRemoved"], equals: true },
      },
      select: { callNumber: true },
    });
    response.json({ ok: true, data: { callNumbers: rows.map((row) => row.callNumber) } });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected removed report list error."),
    });
  }
});

// ----- /api/neris/drafts/:callNumber (NERIS report drafts, cross-browser) -----
app.get("/api/neris/drafts/:callNumber", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const callNumber = trimValue(request.params.callNumber);
    if (!callNumber) {
      response.status(400).json({ ok: false, message: "Missing or empty callNumber." });
      return;
    }
    const row = await prisma.nerisDraft.findUnique({
      where: { tenantId_callNumber: { tenantId, callNumber } },
    });
    if (!row) {
      response.status(404).json({ ok: false, message: "No draft found for this incident." });
      return;
    }
    response.json(draftJson(row));
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected draft get error."),
    });
  }
});

app.get("/api/neris/drafts/:callNumber/history", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const callNumber = trimValue(request.params.callNumber);
    if (!callNumber) {
      response.status(400).json({ ok: false, message: "Missing or empty callNumber." });
      return;
    }
    const rows = await prisma.nerisReportChange.findMany({
      where: { tenantId, callNumber },
      orderBy: { createdAt: "desc" },
    });
    response.json({
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        actorUsername: row.actorUsername,
        fieldNames: Array.isArray(row.fieldNames) ? row.fieldNames.filter((name) => typeof name === "string") : [],
      })),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected report history error."),
    });
  }
});

app.patch("/api/neris/drafts/:callNumber", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const callNumber = trimValue(request.params.callNumber);
    if (!callNumber) {
      response.status(400).json({ ok: false, message: "Missing or empty callNumber." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const payload = draftPayloadFromBody(body);
    const seedFormValues = seedFormValuesFromBody(body);
    const existing = await prisma.nerisDraft.findUnique({
      where: { tenantId_callNumber: { tenantId, callNumber } },
    });
    const removed = Boolean(existing && isReportRemoved(existing.payload));
    const active = existing && !removed ? existing : null;
    const sentRevision = trimValue(body.baseUpdatedAt);
    if (active && !revisionMatches(active.updatedAt, body.baseUpdatedAt)) {
      response.status(409).json({ ok: false, code: "REPORT_CONFLICT", message: REPORT_CONFLICT_MESSAGE });
      return;
    }
    if (removed && sentRevision && !revisionMatches(existing.updatedAt, body.baseUpdatedAt)) {
      response.status(409).json({ ok: false, code: "REPORT_CONFLICT", message: REPORT_CONFLICT_MESSAGE });
      return;
    }
    if (active) {
      const previousStatus = reportStatusOf(active.payload);
      const nextStatus = reportStatusOf(payload);
      const contentChanges = changedFieldNames(active.payload, payload, seedFormValues).filter(
        (name) => name !== "reportStatus",
      );
      if (nextStatus === "Exported" && previousStatus !== "Exported") {
        const minimumRole = await minimumRoleFor(prisma, tenantId, "neris.export");
        if (roleLevel(request.auth?.role) < roleLevel(minimumRole)) {
          response.status(403).json({
            ok: false,
            code: "FORBIDDEN",
            message: "You do not have permission to do that.",
          });
          return;
        }
      }
      if (previousStatus !== "Draft") {
        const markingExported = nextStatus === "Exported" && previousStatus !== "Exported";
        if (!markingExported && (contentChanges.length > 0 || nextStatus !== previousStatus)) {
          response.status(409).json({ ok: false, code: "REPORT_LOCKED", message: REPORT_LOCKED_MESSAGE });
          return;
        }
      }
    }
    const row = await prisma.nerisDraft.upsert({
      where: { tenantId_callNumber: { tenantId, callNumber } },
      create: { tenantId, callNumber, payload },
      update: { payload },
    });
    await recordReportChange(
      tenantId,
      callNumber,
      request.auth,
      changedFieldNames(existing?.payload ?? {}, payload, seedFormValues),
    );
    response.json(draftJson(row));
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected draft save error."),
    });
  }
});

app.post("/api/neris/drafts/:callNumber/unlock", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const callNumber = trimValue(request.params.callNumber);
    if (!callNumber) {
      response.status(400).json({ ok: false, message: "Missing or empty callNumber." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const existing = await prisma.nerisDraft.findUnique({
      where: { tenantId_callNumber: { tenantId, callNumber } },
    });
    if (!existing || isReportRemoved(existing.payload)) {
      response.status(404).json({ ok: false, message: "No draft found for this incident." });
      return;
    }
    if (!revisionMatches(existing.updatedAt, body.baseUpdatedAt)) {
      response.status(409).json({ ok: false, code: "REPORT_CONFLICT", message: REPORT_CONFLICT_MESSAGE });
      return;
    }
    const status = reportStatusOf(existing.payload);
    if (status === "Draft") {
      response.json(draftJson(existing));
      return;
    }
    if (status === "Exported" && roleLevel(request.auth?.role) < roleLevel("admin")) {
      response.status(403).json({
        ok: false,
        code: "FORBIDDEN",
        message: "Only an admin can unlock an exported report.",
      });
      return;
    }
    const previous =
      existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
        ? existing.payload
        : {};
    const row = await prisma.nerisDraft.update({
      where: { tenantId_callNumber: { tenantId, callNumber } },
      data: { payload: { ...previous, reportStatus: "Draft" } },
    });
    await recordReportChange(tenantId, callNumber, request.auth, ["reportStatus"]);
    response.json(draftJson(row));
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected unlock error."),
    });
  }
});

app.delete("/api/neris/drafts/:callNumber", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const callNumber = trimValue(request.params.callNumber);
    if (!callNumber) {
      response.status(400).json({ ok: false, message: "Missing or empty callNumber." });
      return;
    }
    if (roleLevel(request.auth?.role) < roleLevel("admin")) {
      response.status(403).json({
        ok: false,
        code: "FORBIDDEN",
        message: "Only an admin can delete a report.",
      });
      return;
    }
    const existing = await prisma.nerisDraft.findUnique({
      where: { tenantId_callNumber: { tenantId, callNumber } },
    });
    if (existing && !isReportRemoved(existing.payload) && reportStatusOf(existing.payload) !== "Draft") {
      response.status(409).json({
        ok: false,
        code: "REPORT_LOCKED",
        message: "This report is locked. Unlock it before deleting.",
      });
      return;
    }
    await prisma.nerisDraft.upsert({
      where: { tenantId_callNumber: { tenantId, callNumber } },
      create: { tenantId, callNumber, payload: removedReportPayload(existing) },
      update: { payload: removedReportPayload(existing) },
    });
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected report delete error."),
    });
  }
});

app.patch("/api/department-shared-settings", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const parsed = sharedSettingsPatch(request.body);
    if (parsed.error) {
      response.status(400).json({ ok: false, message: parsed.error });
      return;
    }
    if (Object.keys(parsed.patch).length === 0) {
      response.status(400).json({ ok: false, message: "No shared settings were sent." });
      return;
    }
    const details = await prisma.departmentDetails.findUnique({
      where: { tenantId },
      select: { payloadJson: true, departmentName: true },
    });
    const existingPayload =
      details?.payloadJson && typeof details.payloadJson === "object" && !Array.isArray(details.payloadJson)
        ? { ...details.payloadJson }
        : {};
    const current =
      existingPayload.sharedDepartmentSettings &&
      typeof existingPayload.sharedDepartmentSettings === "object" &&
      !Array.isArray(existingPayload.sharedDepartmentSettings)
        ? existingPayload.sharedDepartmentSettings
        : {};
    const shared = { ...current, ...parsed.patch };
    const payloadToStore = { ...existingPayload, sharedDepartmentSettings: shared };
    await prisma.departmentDetails.upsert({
      where: { tenantId },
      update: { payloadJson: payloadToStore },
      create: {
        tenantId,
        departmentName: details?.departmentName || request.tenant?.name || "Unknown",
        payloadJson: payloadToStore,
      },
    });
    response.json({ ok: true, data: shared });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected shared settings error."),
    });
  }
});

// ----- /api/neris/settings (tenant-scoped; stored in DepartmentDetails.payloadJson.nerisExportSettings) -----
const NERIS_SETTINGS_KEYS = [
  "exportUrl",
  "vendorCode",
  "vendorHeaderName",
  "secretKey",
  "authHeaderName",
  "authScheme",
  "contentType",
  "apiVersionHeaderName",
  "apiVersionHeaderValue",
];

function getDefaultNerisSettingsPayload() {
  return {
    exportUrl: "/api/neris/export",
    vendorCode: "",
    vendorHeaderName: "X-NERIS-Entity-ID",
    secretKey: "",
    authHeaderName: "Authorization",
    authScheme: "Bearer",
    contentType: "application/json",
    apiVersionHeaderName: "",
    apiVersionHeaderValue: "",
  };
}

function normalizeNerisSettingsPayload(raw) {
  const defaults = getDefaultNerisSettingsPayload();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const out = { ...defaults };
  for (const key of NERIS_SETTINGS_KEYS) {
    if (typeof raw[key] === "string") out[key] = raw[key];
  }
  return out;
}

app.get("/api/neris/settings", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const details = await prisma.departmentDetails.findUnique({
      where: { tenantId },
      select: { payloadJson: true },
    });
    const payload =
      details?.payloadJson && typeof details.payloadJson === "object"
        ? details.payloadJson
        : {};
    const neris = payload.nerisExportSettings;
    const data = normalizeNerisSettingsPayload(neris);
    response.json({ ok: true, data });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        publicErrorMessage(error, "Unexpected NERIS settings read error."),
    });
  }
});

app.patch("/api/neris/settings", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const details = await prisma.departmentDetails.findUnique({
      where: { tenantId },
      select: { payloadJson: true },
    });
    const existingPayload =
      details?.payloadJson && typeof details.payloadJson === "object"
        ? { ...details.payloadJson }
        : {};
    const existingNeris =
      existingPayload.nerisExportSettings && typeof existingPayload.nerisExportSettings === "object"
        ? existingPayload.nerisExportSettings
        : getDefaultNerisSettingsPayload();
    const merged = { ...existingNeris };
    for (const key of NERIS_SETTINGS_KEYS) {
      if (typeof body[key] === "string") merged[key] = body[key];
    }
    const savedEntityId = trimValue(merged.vendorCode).toUpperCase();
    if (savedEntityId && NERIS_ENTITY_ID_PATTERN.test(savedEntityId)) {
      merged.vendorCode = savedEntityId;
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { nerisEntityId: savedEntityId },
      });
    }
    const payloadToStore = { ...existingPayload, nerisExportSettings: merged };
    await prisma.departmentDetails.upsert({
      where: { tenantId },
      update: { payloadJson: payloadToStore },
      create: {
        tenantId,
        payloadJson: payloadToStore,
      },
    });
    response.json({ ok: true, data: normalizeNerisSettingsPayload(merged) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        publicErrorMessage(error, "Unexpected NERIS settings save error."),
    });
  }
});

// ----- Fire Recovery USA (incident billing) -----
function maskFireRecoverySubscriptionKey(raw) {
  const s = trimValue(raw);
  if (!s) return "";
  if (s.length <= 4) return "****";
  return `****${s.slice(-4)}`;
}

const FIRE_RECOVERY_REENTER = "re-enter the password";

function scrubSecret(message, secret) {
  const text = String(message ?? "");
  const hidden = String(secret ?? "");
  if (!hidden) return text;
  return text.split(hidden).join("[removed]");
}

function publicFireRecoveryMessage(error, secret) {
  const raw = error instanceof Error ? error.message : "Unexpected Fire Recovery error.";
  return scrubSecret(raw, secret);
}

function tenantHasFireRecoveryLogin(tenant) {
  return Boolean(trimValue(tenant?.fireRecoveryApiUsername) && trimValue(tenant?.fireRecoveryApiPassword));
}

async function readFireRecoveryPassword(stored) {
  const value = trimValue(stored);
  if (!value) return "";
  if (!isEncryptedSecret(value)) {
    const error = new Error(FIRE_RECOVERY_REENTER);
    error.code = "SECRET_PLAINTEXT";
    throw error;
  }
  return decryptSecret(value);
}

async function fireRecoveryCredentialsFromTenant(tenant) {
  const username = trimValue(tenant?.fireRecoveryApiUsername);
  const password = await readFireRecoveryPassword(tenant?.fireRecoveryApiPassword);
  if (!username || !password) return null;
  return { username, password };
}

function formatFireRecoveryExportDateLabel(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fireRecoverySettingsData(tenant) {
  const mode = readFireRecoveryMode();
  const resolved = resolveFireRecoveryDepartmentId(mode, tenant?.nerisEntityId);
  return {
    subscriptionKeyMasked: maskFireRecoverySubscriptionKey(tenant?.fireRecoverySubscriptionKey),
    departmentName: trimValue(tenant?.fireRecoveryDepartmentName),
    apiUsername: trimValue(tenant?.fireRecoveryApiUsername),
    passwordIsSet: isEncryptedSecret(tenant?.fireRecoveryApiPassword),
    mode,
    departmentId: resolved.departmentId,
    banner: fireRecoveryModeBanner(mode),
  };
}

function fireRecoveryBillingRowToApi(row) {
  const due = row.invoiceAmountDue ?? "";
  return {
    id: row.id,
    callNumber: row.callNumber,
    trackingId: row.trackingId ?? "",
    incidentType: row.incidentType ?? "",
    incidentDateLabel: row.incidentDateLabel ?? "",
    lastSubmitAt: row.lastSubmitAt ? row.lastSubmitAt.toISOString() : null,
    lastSubmitOk: row.lastSubmitOk,
    lastSubmitError: row.lastSubmitError ?? "",
    exportDateLabel:
      row.lastSubmitOk && row.lastSubmitAt ? formatFireRecoveryExportDateLabel(row.lastSubmitAt) : "",
    amountDue: due,
    invoiceAmountDue: due,
    amountPaid: row.lastPaymentAmount ?? "",
    invoiceId: row.invoiceId ?? "",
    invoiceStatus: row.invoiceStatus ?? "",
    invoiceAmount: row.invoiceAmount ?? "",
    invoiceSubmitDate: row.invoiceSubmitDate ?? "",
    lastPaymentDate: row.lastPaymentDate ?? "",
    paymentPlan: row.paymentPlan ? "Yes" : "No",
    billingFetchedAt: row.billingFetchedAt ? row.billingFetchedAt.toISOString() : null,
    submitStatus: displaySubmitStatus(row),
    submitStartedAt: row.submitStartedAt ? row.submitStartedAt.toISOString() : null,
  };
}

function parseExportPayloadPreview(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

app.get("/api/fire-recovery/settings", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        nerisEntityId: true,
        fireRecoverySubscriptionKey: true,
        fireRecoveryDepartmentName: true,
        fireRecoveryApiUsername: true,
        fireRecoveryApiPassword: true,
      },
    });
    response.json({
      ok: true,
      data: fireRecoverySettingsData(tenant),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        publicErrorMessage(error, "Unexpected Fire Recovery settings read error."),
    });
  }
});

app.patch("/api/fire-recovery/settings", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const subscriptionKey =
      typeof body.fireRecoverySubscriptionKey === "string"
        ? body.fireRecoverySubscriptionKey
        : undefined;
    const departmentName =
      typeof body.fireRecoveryDepartmentName === "string"
        ? body.fireRecoveryDepartmentName
        : undefined;
    const apiUsername =
      typeof body.fireRecoveryApiUsername === "string" ? body.fireRecoveryApiUsername : undefined;
    const apiPassword =
      typeof body.fireRecoveryApiPassword === "string" ? body.fireRecoveryApiPassword : undefined;
    const data = {};
    if (subscriptionKey !== undefined) {
      data.fireRecoverySubscriptionKey = subscriptionKey.trim() || null;
    }
    if (departmentName !== undefined) {
      data.fireRecoveryDepartmentName = departmentName.trim() || null;
    }
    if (apiUsername !== undefined) {
      data.fireRecoveryApiUsername = apiUsername.trim() || null;
    }
    if (apiPassword !== undefined) {
      const trimmedPassword = apiPassword.trim();
      if (!trimmedPassword) {
        data.fireRecoveryApiPassword = null;
      } else {
        try {
          data.fireRecoveryApiPassword = encryptSecret(trimmedPassword);
        } catch (error) {
          response.status(400).json({
            ok: false,
            message: publicFireRecoveryMessage(error, trimmedPassword),
          });
          return;
        }
      }
    }
    if (Object.keys(data).length === 0) {
      response.status(400).json({ ok: false, message: "No Fire Recovery fields to update." });
      return;
    }
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        nerisEntityId: true,
        fireRecoverySubscriptionKey: true,
        fireRecoveryDepartmentName: true,
        fireRecoveryApiUsername: true,
        fireRecoveryApiPassword: true,
      },
    });
    response.json({
      ok: true,
      data: fireRecoverySettingsData(tenant),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicFireRecoveryMessage(error, apiPassword),
    });
  }
});

app.get("/api/fire-recovery/incidents", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const rows = await prisma.fireRecoveryIncidentBilling.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
    response.json({ ok: true, data: rows.map(fireRecoveryBillingRowToApi) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        publicErrorMessage(error, "Unexpected Fire Recovery incidents list error."),
    });
  }
});

app.get("/api/fire-recovery/incidents/:callNumber", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const callNumber = trimValue(request.params.callNumber);
    if (!callNumber) {
      response.status(400).json({ ok: false, message: "Missing call number." });
      return;
    }
    const row = await prisma.fireRecoveryIncidentBilling.findUnique({
      where: { tenantId_callNumber: { tenantId, callNumber } },
    });
    if (!row) {
      response.status(404).json({ ok: false, message: "Fire Recovery row not found for this incident." });
      return;
    }
    response.json({ ok: true, data: fireRecoveryBillingRowToApi(row) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        publicErrorMessage(error, "Unexpected Fire Recovery incident read error."),
    });
  }
});

async function prepareFireRecoveryBill(request) {
  const tenantId = request.tenant?.id;
  if (!tenantId) return { ok: false, status: 400, message: "Missing tenant context." };
  const body = request.body && typeof request.body === "object" ? request.body : {};
  const callNumber = trimValue(body.callNumber);
  if (!callNumber) return { ok: false, status: 400, message: "callNumber is required." };
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      nerisEntityId: true,
      fireRecoveryDepartmentName: true,
      fireRecoveryApiUsername: true,
      fireRecoveryApiPassword: true,
    },
  });
  const mode = readFireRecoveryMode();
  const department = resolveFireRecoveryDepartmentId(mode, tenant?.nerisEntityId);
  if (!tenantHasFireRecoveryLogin(tenant)) {
    return {
      ok: false,
      status: 400,
      message:
        "Fire Recovery username and password are required. Set them under Admin Functions → Setup/Configuration → Fire Recovery for this tenant.",
    };
  }
  const credentials = await fireRecoveryCredentialsFromTenant(tenant);
  if (!credentials) {
    return {
      ok: false,
      status: 400,
      message:
        "Fire Recovery username and password are required. Set them under Admin Functions → Setup/Configuration → Fire Recovery for this tenant.",
    };
  }
  const dept = trimValue(tenant?.fireRecoveryDepartmentName);
  if (!dept) {
    return {
      ok: false,
      status: 400,
      message:
        "Set Fire Recovery department name (Admin Functions → Setup/Configuration → Fire Recovery) before submitting.",
    };
  }
  const latestOk = await prisma.nerisExportHistory.findFirst({
    where: {
      tenantId,
      callNumber,
      attemptStatus: "success",
      responseDetail: { startsWith: SERVER_EXPORT_RECEIPT },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!latestOk?.submittedPayloadPreview) {
    return {
      ok: false,
      status: 400,
      message:
        "No successful NERIS export payload found for this incident. Export the NERIS report successfully first.",
    };
  }
  const nerisId = trimValue(latestOk.nerisId);
  if (!nerisId) {
    return {
      ok: false,
      status: 400,
      message:
        "NERIS incident ID is missing from export history. Re-export the NERIS report so the response includes a NERIS incident id.",
    };
  }
  const parsed = parseExportPayloadPreview(latestOk.submittedPayloadPreview);
  if (!parsed) {
    return { ok: false, status: 400, message: "Stored export payload is not valid JSON; cannot map to Fire Recovery." };
  }
  const draft = await prisma.nerisDraft.findUnique({
    where: { tenantId_callNumber: { tenantId, callNumber } },
  });
  const draftPayload =
    draft?.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload) ? draft.payload : null;
  const draftStatus = trimValue(draftPayload?.reportStatus);
  if (draftStatus !== "Exported" && draftStatus !== "In Review") {
    return { ok: false, status: 400, message: "Export this report to NERIS first." };
  }
  const formValues =
    draftPayload.formValues && typeof draftPayload.formValues === "object" && !Array.isArray(draftPayload.formValues)
      ? draftPayload.formValues
      : {};
  if (!isMotorVehicleIncident(formValues.primary_incident_type, formValues.additional_incident_types)) {
    return { ok: false, status: 400, message: "Fire Recovery billing is only for a motor-vehicle incident." };
  }
  const departmentDetails = await prisma.departmentDetails.findUnique({
    where: { tenantId },
    select: { payloadJson: true },
  });
  const requirementSettings =
    departmentDetails?.payloadJson && typeof departmentDetails.payloadJson === "object"
      ? departmentDetails.payloadJson.fireRecoveryFieldRequirements
      : null;
  const fullNameMap = await getTenantUserFullNameMap(tenantId);
  const reportWriterName = displayNameFromUsernameMap(fullNameMap, latestOk.reportWriterName);
  const missing = missingFireRecoveryFields(formValues, requirementSettings, reportWriterName);
  const departmentId = department.ok ? department.departmentId : "";
  const payload = buildFireRecoveryPayload(
    formValues,
    { nerisId, reportWriterName, callNumber },
    { departmentId, departmentName: dept },
    { submittedAt: chicagoLocalStamp(new Date()) },
  );
  return {
    ok: true,
    tenantId,
    callNumber,
    mode,
    department,
    credentials,
    password: credentials.password,
    formValues,
    requirementSettings,
    missing,
    payload,
    hash: previewHash(payload),
    meta: extractIncidentMetadataFromExportPayload({ formValues }),
    banner: fireRecoveryModeBanner(mode),
    departmentId,
  };
}

function fireRecoveryTimeoutMs(name, fallback) {
  const parsed = Number.parseInt(String(process.env[name] ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function claimFireRecoverySubmitLock(tenantId, callNumber) {
  const now = new Date();
  try {
    await prisma.fireRecoveryIncidentBilling.create({
      data: {
        tenantId,
        callNumber,
        submitStatus: "submitting",
        submitStartedAt: now,
      },
    });
    return true;
  } catch (error) {
    if (error?.code !== "P2002") throw error;
  }
  const updated = await prisma.fireRecoveryIncidentBilling.updateMany({
    where: {
      tenantId,
      callNumber,
      AND: [
        { OR: [{ trackingId: null }, { trackingId: "" }] },
        { submitStatus: { in: ["", "not_sent", "failed"] } },
      ],
    },
    data: {
      submitStatus: "submitting",
      submitStartedAt: now,
      lastSubmitError: "",
    },
  });
  return updated.count === 1;
}

async function saveFireRecoveryOutcome(prepared, outcome) {
  const existing = await prisma.fireRecoveryIncidentBilling.findUnique({
    where: { tenantId_callNumber: { tenantId: prepared.tenantId, callNumber: prepared.callNumber } },
  });
  const now = new Date();
  return prisma.fireRecoveryIncidentBilling.upsert({
    where: { tenantId_callNumber: { tenantId: prepared.tenantId, callNumber: prepared.callNumber } },
    create: {
      tenantId: prepared.tenantId,
      callNumber: prepared.callNumber,
      trackingId: nextTrackingId("", outcome.trackingId),
      lastSubmitAt: now,
      lastSubmitOk: outcome.outcome === "sent",
      lastSubmitError: outcome.message.slice(0, 2000),
      submitStatus: outcome.outcome,
      submitStartedAt: now,
      incidentType: prepared.meta.incidentType,
      incidentDateLabel: prepared.meta.incidentDateLabel,
    },
    update: {
      trackingId: nextTrackingId(existing?.trackingId, outcome.trackingId),
      lastSubmitAt: now,
      lastSubmitOk: outcome.outcome === "sent",
      lastSubmitError: outcome.message.slice(0, 2000),
      submitStatus: outcome.outcome,
      incidentType: prepared.meta.incidentType,
      incidentDateLabel: prepared.meta.incidentDateLabel,
    },
  });
}

app.post("/api/fire-recovery/preview", async (request, response) => {
  try {
    const prepared = await prepareFireRecoveryBill(request);
    if (!prepared.ok) {
      response.status(prepared.status).json({ ok: false, message: prepared.message });
      return;
    }
    response.json({
      ok: true,
      data: {
        previewHash: prepared.hash,
        payload: prepared.payload,
        departmentId: prepared.departmentId,
        mode: prepared.mode,
        banner: prepared.banner,
        missingRequired: prepared.missing,
        missingRecommended: missingRecommendedFireRecoveryFields(prepared.formValues, prepared.requirementSettings),
      },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected Fire Recovery preview error."),
    });
  }
});

app.post("/api/fire-recovery/submit", async (request, response) => {
  let prepared = null;
  let locked = false;
  try {
    prepared = await prepareFireRecoveryBill(request);
    if (!prepared.ok) {
      response.status(prepared.status).json({ ok: false, message: prepared.message });
      return;
    }
    if (!prepared.department.ok) {
      response.status(400).json({ ok: false, message: prepared.department.message });
      return;
    }
    if (prepared.missing.length > 0) {
      response.status(400).json({
        ok: false,
        message: `Fire Recovery billing is missing required fields: ${prepared.missing.join("; ")}.`,
      });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    if (trimValue(body.previewHash) !== prepared.hash) {
      response.status(400).json({
        ok: false,
        message: "The report changed since the preview. Preview again.",
      });
      return;
    }
    locked = await claimFireRecoverySubmitLock(prepared.tenantId, prepared.callNumber);
    if (!locked) {
      response.status(409).json({
        ok: false,
        message: "Already sent, being sent, or needs review.",
      });
      return;
    }
    let jwt;
    try {
      jwt = await getFireRecoveryJwt(
        prepared.credentials,
        AbortSignal.timeout(fireRecoveryTimeoutMs("FIRE_RECOVERY_LOGIN_TIMEOUT_MS", 20000)),
      );
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
      const outcome = timedOut
        ? classifyVendorReply({ timedOut: true })
        : { outcome: "failed", trackingId: "", message: publicFireRecoveryMessage(error, prepared.password) };
      const row = await saveFireRecoveryOutcome(prepared, outcome);
      response.status(timedOut ? 409 : 400).json({
        ok: false,
        message: outcome.message,
        data: fireRecoveryBillingRowToApi(row),
      });
      return;
    }
    const vendor = await postAddNerisIncidentForBilling(
      jwt,
      prepared.payload,
      fireRecoveryTimeoutMs("FIRE_RECOVERY_POST_TIMEOUT_MS", 45000),
    );
    const outcome = classifyVendorReply(vendor);
    const row = await saveFireRecoveryOutcome(prepared, outcome);
    if (outcome.outcome === "sent") {
      response.status(201).json({ ok: true, data: fireRecoveryBillingRowToApi(row) });
      return;
    }
    response.status(outcome.outcome === "failed" ? 400 : 409).json({
      ok: false,
      message: outcome.message,
      data: fireRecoveryBillingRowToApi(row),
    });
  } catch (error) {
    const message = publicFireRecoveryMessage(error, prepared?.password ?? "");
    if (locked && prepared?.ok) {
      try {
        await saveFireRecoveryOutcome(prepared, {
          outcome: "needs_review",
          trackingId: "",
          message,
        });
      } catch {
        // The lock stays. A later read shows a stale Submitting row as Needs review.
      }
      response.status(409).json({ ok: false, message });
      return;
    }
    response.status(400).json({ ok: false, message });
  }
});

app.post("/api/fire-recovery/resolve-review", async (request, response) => {
  try {
    if (roleLevel(request.auth?.role) < roleLevel("admin")) {
      response.status(403).json({ ok: false, code: "FORBIDDEN", message: "You do not have permission to do that." });
      return;
    }
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const callNumber = trimValue(body.callNumber);
    const outcome = trimValue(body.outcome);
    if (!callNumber || (outcome !== "not_received" && outcome !== "received")) {
      response.status(400).json({ ok: false, message: "callNumber and outcome are required." });
      return;
    }
    const existing = await prisma.fireRecoveryIncidentBilling.findUnique({
      where: { tenantId_callNumber: { tenantId, callNumber } },
    });
    if (!existing) {
      response.status(404).json({ ok: false, message: "Fire Recovery row not found for this incident." });
      return;
    }
    const providedTrackingId = trimValue(body.trackingId);
    if (outcome === "received" && !providedTrackingId && !trimValue(existing.trackingId)) {
      response.status(400).json({ ok: false, message: "Enter the tracking ID from Recovery Hub." });
      return;
    }
    const row = await prisma.fireRecoveryIncidentBilling.update({
      where: { tenantId_callNumber: { tenantId, callNumber } },
      data:
        outcome === "received"
          ? {
              submitStatus: "sent",
              lastSubmitOk: true,
              lastSubmitError: "",
              trackingId: nextTrackingId(existing.trackingId, providedTrackingId),
            }
          : {
              submitStatus: "failed",
              lastSubmitOk: false,
              lastSubmitError: "Checked in Recovery Hub: this bill was not received.",
              trackingId: nextTrackingId(existing.trackingId, ""),
            },
    });
    response.json({ ok: true, data: fireRecoveryBillingRowToApi(row) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected Fire Recovery review error."),
    });
  }
});

app.post("/api/fire-recovery/billing-status", async (request, response) => {
  let fireRecoveryPassword = "";
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const callNumber = trimValue(body.callNumber);
    if (!callNumber) {
      response.status(400).json({ ok: false, message: "callNumber is required." });
      return;
    }

    const tenantForJwt = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        fireRecoveryApiUsername: true,
        fireRecoveryApiPassword: true,
      },
    });
    if (!tenantHasFireRecoveryLogin(tenantForJwt)) {
      response.status(400).json({
        ok: false,
        message:
          "Fire Recovery username and password are required. Set them under Admin Functions → Setup/Configuration → Fire Recovery for this tenant.",
      });
      return;
    }
    const statusCredentials = await fireRecoveryCredentialsFromTenant(tenantForJwt);
    fireRecoveryPassword = statusCredentials?.password ?? "";
    if (!statusCredentials) {
      response.status(400).json({
        ok: false,
        message:
          "Fire Recovery username and password are required. Set them under Admin Functions → Setup/Configuration → Fire Recovery for this tenant.",
      });
      return;
    }

    const existing = await prisma.fireRecoveryIncidentBilling.findUnique({
      where: { tenantId_callNumber: { tenantId, callNumber } },
    });
    const trackingId = trimValue(existing?.trackingId);
    if (!trackingId) {
      response.status(400).json({
        ok: false,
        message: "No Fire Recovery tracking ID for this incident. Submit to Fire Recovery first.",
      });
      return;
    }

    const jwt = await getFireRecoveryJwt(statusCredentials);
    const resp = await postIncidentBillingStatus(jwt, trackingId);
    const now = new Date();

    const invoiceAmount =
      resp.InvoiceAmount !== undefined && resp.InvoiceAmount !== null
        ? String(resp.InvoiceAmount)
        : "";
    const invoiceAmountDue =
      resp.InvoiceAmountDue !== undefined && resp.InvoiceAmountDue !== null
        ? String(resp.InvoiceAmountDue)
        : "";
    const lastPaymentAmount =
      resp.LastPaymentAmount !== undefined && resp.LastPaymentAmount !== null
        ? String(resp.LastPaymentAmount)
        : "";
    const lastPaymentDate =
      resp.LastPaymentDate !== undefined && resp.LastPaymentDate !== null
        ? String(resp.LastPaymentDate)
        : "";
    const invoiceSubmitDate =
      resp.InvoiceSubmitDate !== undefined && resp.InvoiceSubmitDate !== null
        ? String(resp.InvoiceSubmitDate)
        : "";
    const paymentPlan = Boolean(resp.PaymentPlan);

    const row = await prisma.fireRecoveryIncidentBilling.update({
      where: { tenantId_callNumber: { tenantId, callNumber } },
      data: {
        invoiceId: trimValue(String(resp.InvoiceID ?? "")),
        invoiceAmount,
        invoiceAmountDue,
        invoiceSubmitDate,
        invoiceStatus: trimValue(String(resp.InvoiceStatus ?? "")),
        lastPaymentDate,
        lastPaymentAmount,
        paymentPlan,
        billingFetchedAt: now,
      },
    });

    response.json({ ok: true, data: fireRecoveryBillingRowToApi(row) });
  } catch (error) {
    response.status(400).json({
      ok: false,
      message: publicFireRecoveryMessage(error, fireRecoveryPassword),
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
      message: publicErrorMessage(error, "Unexpected department details read error."),
    });
  }
});

app.post("/api/auth/login", (request, response) => {
  const body = request.body && typeof request.body === "object" ? request.body : {};
  if (loginCredentialsOversized(body.username, body.password)) {
    response.status(401).json({
      ok: false,
      message: "Invalid username or password.",
    });
    return;
  }
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
    const lock = loginLockStatus(tenantId, submittedUsername);
    if (lock.locked) {
      response.status(429).json({
        ok: false,
        message: "Too many failed sign-in attempts. Try again in 15 minutes.",
      });
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: {
        tenantId_username: {
          tenantId,
          username: submittedUsername,
        },
      },
    });

    const storedHash = dbUser ? String(dbUser.passwordHash ?? "") : "";
    const valid = dbUser ? await verifyPassword(submittedPassword, storedHash) : false;
    if (!dbUser || !valid) {
      const failure = noteLoginFailure(tenantId, submittedUsername, Date.now(), {
        knownAccount: Boolean(dbUser),
      });
      if (failure.deferred) {
        response.status(429).json({
          ok: false,
          message: "Too many sign-in attempts. Try again later.",
        });
        return;
      }
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
    noteLoginSuccess(tenantId, submittedUsername);
    const fullNameMap = await getTenantUserFullNameMap(tenantId);
    const token = await createSession(prisma, { tenantId, userId: dbUser.id });
    applySessionCookie(response, token, request);
    response.status(200).json({
      ok: true,
      user: {
        name: trimValue(fullNameMap[submittedUsername]) || dbUser.username,
        username: dbUser.username,
        role: normalizeRole(dbUser.role),
      },
    });
  })().catch((error) => {
    response.status(500).json({
      ok: false,
      message:
        publicErrorMessage(error, "Unexpected login service error."),
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
    const username = trimValue(request.auth?.username).toLowerCase();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (!username || !currentPassword || !newPassword) {
      response.status(400).json({
        ok: false,
        message: "Current password and new password are required.",
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
    await revokeOtherSessions(prisma, user.id, request.auth?.sessionId ?? null);
    response.status(200).json({ ok: true, message: "Password updated." });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        publicErrorMessage(error, "Unexpected change-password error."),
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
    // Accounts change only through /api/users. Saving department settings never creates, edits, or deletes them.
    const payloadToStore = { ...body };
    delete payloadToStore.userRecords;
    const existingDetails = await prisma.departmentDetails.findUnique({
      where: { tenantId },
      select: { payloadJson: true },
    });
    const existingPayload =
      existingDetails?.payloadJson && typeof existingDetails.payloadJson === "object"
        ? existingDetails.payloadJson
        : {};
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
    if (
      existingPayload.nerisExportSettings &&
      payloadToStore.nerisExportSettings === undefined &&
      typeof existingPayload.nerisExportSettings === "object" &&
      !Array.isArray(existingPayload.nerisExportSettings)
    ) {
      payloadToStore.nerisExportSettings = existingPayload.nerisExportSettings;
    }
    if (
      existingPayload.sharedDepartmentSettings &&
      payloadToStore.sharedDepartmentSettings === undefined &&
      typeof existingPayload.sharedDepartmentSettings === "object" &&
      !Array.isArray(existingPayload.sharedDepartmentSettings)
    ) {
      payloadToStore.sharedDepartmentSettings = existingPayload.sharedDepartmentSettings;
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
      message: publicErrorMessage(error, "Unexpected department details write error."),
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
    const slotSegments = {};

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
      const rowSlotSegments =
        payload.slotSegments && typeof payload.slotSegments === "object"
          ? payload.slotSegments
          : {};

      assignments[storageKey] = rowAssignments;
      overtimeSplit[storageKey] = rowOvertime;
      slotSegments[storageKey] = rowSlotSegments;
    }

    response.json({
      ok: true,
      assignments,
      overtimeSplit,
      slotSegments,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected schedule assignments read error."),
    });
  }
});

function collectScheduleNames(assignments) {
  const names = new Set();
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) return names;
  for (const slots of Object.values(assignments)) {
    if (!Array.isArray(slots)) continue;
    for (const slot of slots) {
      String(slot ?? "")
        .split("||OT||")
        .forEach((part) => {
          const name = part.trim().toLowerCase();
          if (name) names.add(name);
        });
    }
  }
  return names;
}

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
    const slotSegmentsInput =
      body.slotSegments && typeof body.slotSegments === "object" ? body.slotSegments : {};

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
      const slotSegmentsValue =
        slotSegmentsInput && typeof slotSegmentsInput === "object"
          ? slotSegmentsInput[key]
          : {};

      parsedRows.push({
        shiftType,
        dateKey,
        assignmentsJson: {
          assignments:
            assignmentValue && typeof assignmentValue === "object" ? assignmentValue : {},
          overtimeSplit:
            overtimeValue && typeof overtimeValue === "object" ? overtimeValue : {},
          slotSegments:
            slotSegmentsValue && typeof slotSegmentsValue === "object"
              ? slotSegmentsValue
              : {},
        },
      });
    }

    const validCompositeKeys = new Set(
      parsedRows.map((row) => `${row.shiftType}::${row.dateKey}`),
    );
    const existingRows = await prisma.scheduleAssignments.findMany({
      where: { tenantId },
      select: { id: true, shiftType: true, dateKey: true, assignmentsJson: true },
    });

    if (!canSeeAllTrades(request.auth) || request.scheduleSelfServeOnly) {
      const fullNameMap = await getTenantUserFullNameMap(tenantId);
      const requesterUsername = request.auth.username.toLowerCase();
      const requesterName =
        trimValue(fullNameMap[requesterUsername] ?? "") || requesterUsername;
      const details = await prisma.departmentDetails.findUnique({
        where: { tenantId },
        select: { payloadJson: true },
      });
      const payloadRoot =
        details?.payloadJson && typeof details.payloadJson === "object" ? details.payloadJson : {};
      const roster = new Set(
        (Array.isArray(payloadRoot.schedulerPersonnelRecords) ? payloadRoot.schedulerPersonnelRecords : [])
          .map((record) => trimValue(String(record?.name ?? "")).toLowerCase())
          .filter(Boolean),
      );
      const existingByKey = new Map(
        existingRows.map((row) => [`${row.shiftType}::${row.dateKey}`, row]),
      );
      for (const existing of existingRows) {
        const key = `${existing.shiftType}::${existing.dateKey}`;
        if (!validCompositeKeys.has(key)) {
          response.status(403).json({
            ok: false,
            message: "You can fill an open seat. Taking someone off the schedule needs a sub admin to approve.",
          });
          return;
        }
      }
      for (const row of parsedRows) {
        const key = `${row.shiftType}::${row.dateKey}`;
        const existing = existingByKey.get(key);
        const payload =
          existing?.assignmentsJson && typeof existing.assignmentsJson === "object"
            ? existing.assignmentsJson
            : {};
        const previousAssignments =
          payload.assignments && typeof payload.assignments === "object" ? payload.assignments : payload;
        const nextAssignments = row.assignmentsJson.assignments;
        const previousNames = collectScheduleNames(previousAssignments);
        const nextNames = collectScheduleNames(nextAssignments);
        for (const name of previousNames) {
          if (!roster.has(name) || nextNames.has(name)) continue;
          response.status(403).json({
            ok: false,
            message: "You can fill an open seat. Taking someone off the schedule needs a sub admin to approve.",
          });
          return;
        }
        row.assignmentsJson.overtimeSplit =
          payload.overtimeSplit && typeof payload.overtimeSplit === "object" ? payload.overtimeSplit : {};
        const previousSegments =
          payload.slotSegments && typeof payload.slotSegments === "object" ? payload.slotSegments : {};
        const mergedSegments = mergeLimitedUserSlotSegments(
          previousSegments,
          row.assignmentsJson.slotSegments,
          requesterName,
        );
        if (!mergedSegments.ok) {
          response.status(403).json({ ok: false, message: mergedSegments.message });
          return;
        }
        row.assignmentsJson.slotSegments = mergedSegments.segments;
      }
    }

    const deletions = existingRows
      .filter((row) => !validCompositeKeys.has(`${row.shiftType}::${row.dateKey}`))
      .map((row) => row.id);

    await prisma.$transaction([
      prisma.scheduleAssignments.deleteMany({
        where: { tenantId, id: { in: deletions } },
      }),
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
      message: publicErrorMessage(error, "Unexpected schedule assignments write error."),
    });
  }
});

// ----- /api/trades (tenant-scoped; members see their own trades, subadmin and above see all) -----

const TRADE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TRADE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function canSeeAllTrades(auth) {
  return roleLevel(auth?.role) >= roleLevel("subadmin");
}

function isFilledScheduleSegment(segment) {
  if (!segment || typeof segment !== "object") return false;
  const name = trimValue(String(segment.personnelName ?? ""));
  const upper = name.toUpperCase();
  if (!name || upper === "HIRE" || upper === "OPEN") return false;
  if (segment.assigneeType === "hire" || segment.source === "auto_hire") return false;
  const start = Number(segment.startMinutes);
  const end = Number(segment.endMinutes);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

function sameFilledSegment(left, right) {
  return (
    trimValue(String(left.personnelName ?? "")).toLowerCase() ===
      trimValue(String(right.personnelName ?? "")).toLowerCase() &&
    Number(left.startMinutes) === Number(right.startMinutes) &&
    Number(left.endMinutes) === Number(right.endMinutes)
  );
}

function scheduleSegmentsOverlap(left, right) {
  return (
    Math.max(Number(left.startMinutes), Number(right.startMinutes)) <
    Math.min(Number(left.endMinutes), Number(right.endMinutes))
  );
}

function segmentPersonName(segment) {
  return trimValue(String(segment.personnelName ?? "")).toLowerCase();
}

function coverageIncludesSegment(coverSegments, target) {
  const sorted = [...coverSegments].sort(
    (left, right) => Number(left.startMinutes) - Number(right.startMinutes),
  );
  let cursor = Number(target.startMinutes);
  const end = Number(target.endMinutes);
  for (const segment of sorted) {
    const start = Number(segment.startMinutes);
    const segmentEnd = Number(segment.endMinutes);
    if (segmentEnd <= cursor) continue;
    if (start > cursor) return false;
    cursor = segmentEnd;
    if (cursor >= end) return true;
  }
  return cursor >= end;
}

/** A regular user may add only their own name into a time that was empty. They may also join their own pieces into one full shift. */
function mergeLimitedUserSlotSegments(previousRaw, nextRaw, selfName) {
  const self = trimValue(selfName).toLowerCase();
  const filledSlots = (raw) => {
    const map = new Map();
    if (!raw || typeof raw !== "object") return map;
    for (const [unitId, slots] of Object.entries(raw)) {
      if (!Array.isArray(slots)) continue;
      slots.forEach((segments, index) => {
        const filled = (Array.isArray(segments) ? segments : []).filter(isFilledScheduleSegment);
        if (filled.length > 0) map.set(`${unitId}::${index}`, { unitId, index, filled });
      });
    }
    return map;
  };
  const previous = filledSlots(previousRaw);
  const next = filledSlots(nextRaw);
  const merged =
    previousRaw && typeof previousRaw === "object" ? JSON.parse(JSON.stringify(previousRaw)) : {};
  const keys = new Set([...previous.keys(), ...next.keys()]);
  for (const key of keys) {
    const prevSlot = previous.get(key);
    const nextSlot = next.get(key);
    const prevFilled = prevSlot?.filled ?? [];
    const nextFilled = nextSlot?.filled ?? [];
    const unitId = prevSlot?.unitId ?? nextSlot?.unitId;
    const index = prevSlot?.index ?? nextSlot?.index;
    const othersPrev = prevFilled.filter((segment) => segmentPersonName(segment) !== self);
    const selfPrev = prevFilled.filter((segment) => segmentPersonName(segment) === self);
    const othersNext = nextFilled.filter((segment) => segmentPersonName(segment) !== self);
    const selfNext = nextFilled.filter((segment) => segmentPersonName(segment) === self);
    if (
      othersPrev.length !== othersNext.length ||
      othersPrev.some((prevSeg) => !othersNext.some((segment) => sameFilledSegment(prevSeg, segment)))
    ) {
      return {
        ok: false,
        message: "You can fill an open time. You cannot change someone else's hours.",
      };
    }
    if (selfPrev.some((prevSeg) => !coverageIncludesSegment(selfNext, prevSeg))) {
      return {
        ok: false,
        message: "You can fill an open time. You cannot change someone else's hours.",
      };
    }
    if (selfNext.some((segment) => othersPrev.some((other) => scheduleSegmentsOverlap(segment, other)))) {
      return { ok: false, message: "That time is already filled." };
    }
    const selfUnchanged =
      selfPrev.length === selfNext.length &&
      selfPrev.every((prevSeg) => selfNext.some((segment) => sameFilledSegment(prevSeg, segment)));
    if (selfUnchanged) continue;
    if (!Array.isArray(merged[unitId])) merged[unitId] = [];
    const slots = [...merged[unitId]];
    while (slots.length <= index) slots.push([]);
    slots[index] = [...othersNext, ...selfNext].map((segment) => ({
      ...segment,
      personnelName: trimValue(String(segment.personnelName ?? "")),
      assigneeType: "personnel",
      source: segment.source === "trade" ? "trade" : "manual",
      overtime: segment.overtime === true,
    }));
    merged[unitId] = slots;
  }
  return { ok: true, segments: merged };
}

async function readTradeSettings(tenantId) {
  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId },
    select: { payloadJson: true },
  });
  const payload =
    details?.payloadJson && typeof details.payloadJson === "object" ? details.payloadJson : {};
  return {
    adminApproval: payload.tradeAdminApproval === true,
    paybackRequired: payload.tradePaybackRequired === true,
    cancelApproval: payload.tradeCancelApproval !== false,
  };
}

async function loadTradeRoster(tenantId) {
  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId },
    select: { payloadJson: true },
  });
  const payload =
    details?.payloadJson && typeof details.payloadJson === "object" ? details.payloadJson : {};
  const records = Array.isArray(payload.schedulerPersonnelRecords)
    ? payload.schedulerPersonnelRecords
    : [];
  const fullNameMap = await getTenantUserFullNameMap(tenantId);
  const users = await prisma.user.findMany({ where: { tenantId }, select: { username: true } });
  const usernameByName = new Map();
  for (const user of users) {
    const username = user.username.toLowerCase();
    usernameByName.set(username, username);
  }
  for (const [username, fullName] of Object.entries(fullNameMap)) {
    usernameByName.set(fullName.toLowerCase(), username);
  }
  const roster = records
    .map((record) => {
      const name = trimValue(String(record?.name ?? ""));
      return {
        name,
        shift: trimValue(String(record?.shift ?? "").split("|")[0]),
        username: usernameByName.get(name.toLowerCase()) ?? "",
      };
    })
    .filter((entry) => entry.name);
  return { roster, fullNameMap };
}

function toTradeResponse(row) {
  return {
    id: row.id,
    shiftType: row.shiftType,
    requesterUsername: row.requesterUsername,
    requesterName: row.requesterName,
    counterpartUsername: row.counterpartUsername,
    counterpartName: row.counterpartName,
    tradeDate: row.tradeDate,
    startTime: row.startTime,
    endTime: row.endTime,
    paybackRequired: row.paybackRequired,
    paybackDate: row.paybackDate,
    reason: row.reason,
    status: row.status,
    denialReason: row.denialReason,
    cancelRequestedBy: cancelRequesterUsername(row.historyJson),
    statusNote: tradeStatusNote(row.historyJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function cancelRequesterUsername(historyJson) {
  const history = Array.isArray(historyJson) ? historyJson : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.action === "cancel_requested") {
      return String(history[index].by ?? "").trim().toLowerCase();
    }
  }
  return "";
}

function tradeStatusNote(historyJson) {
  const history = Array.isArray(historyJson) ? historyJson : [];
  const latest = history[history.length - 1];
  if (!latest) return "";
  if (latest.action !== "cancel_declined" && latest.action !== "cancel_admin_denied") return "";
  return trimValue(String(latest.note ?? ""));
}

function appendTradeHistory(historyJson, entry) {
  const history = Array.isArray(historyJson) ? historyJson : [];
  return [...history, { at: new Date().toISOString(), ...entry }];
}

app.get("/api/trades", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const username = request.auth.username.toLowerCase();
    const seeAll = canSeeAllTrades(request.auth);
    const rows = await prisma.tradeRequest.findMany({
      where: seeAll
        ? { tenantId }
        : {
            tenantId,
            OR: [{ requesterUsername: username }, { counterpartUsername: username }],
          },
      orderBy: { createdAt: "desc" },
    });
    const fullNameMap = await getTenantUserFullNameMap(tenantId);
    response.json({
      ok: true,
      canSeeAll: seeAll,
      username,
      name: trimValue(fullNameMap[username] ?? "") || username,
      trades: rows.map(toTradeResponse),
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected trades read error."),
    });
  }
});

app.post("/api/trades", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const requesterUsername = request.auth.username.toLowerCase();
    const counterpartName = trimValue(String(body.counterpartName ?? ""));
    const tradeDate = trimValue(String(body.tradeDate ?? ""));
    const startTime = trimValue(String(body.startTime ?? ""));
    const endTime = trimValue(String(body.endTime ?? ""));
    const paybackRequired = body.paybackRequired === true;
    const paybackDate = paybackRequired ? trimValue(String(body.paybackDate ?? "")) : "";
    const reason = trimValue(String(body.reason ?? "")).slice(0, 500);

    const { roster, fullNameMap } = await loadTradeRoster(tenantId);
    const requesterName = trimValue(fullNameMap[requesterUsername] ?? "");
    const requester = roster.find(
      (entry) => entry.username === requesterUsername ||
        (requesterName && entry.name.toLowerCase() === requesterName.toLowerCase()),
    );
    if (!requester) {
      response.status(400).json({
        ok: false,
        message: "Only people listed in Scheduler Settings → Personnel can request trades.",
      });
      return;
    }
    const counterpart = roster.find(
      (entry) => entry.name.toLowerCase() === counterpartName.toLowerCase(),
    );
    if (!counterpart) {
      response.status(400).json({
        ok: false,
        message: "Choose someone from Scheduler Settings → Personnel.",
      });
      return;
    }
    if (!counterpart.username) {
      response.status(400).json({
        ok: false,
        message: `${counterpart.name} has no sign-in account, so they cannot accept a trade.`,
      });
      return;
    }
    if (counterpart.username === requesterUsername) {
      response.status(400).json({ ok: false, message: "You cannot trade with yourself." });
      return;
    }
    if (!TRADE_DATE_PATTERN.test(tradeDate)) {
      response.status(400).json({ ok: false, message: "Enter your assigned date." });
      return;
    }
    if (!TRADE_TIME_PATTERN.test(startTime) || !TRADE_TIME_PATTERN.test(endTime)) {
      response.status(400).json({
        ok: false,
        message: "Enter start and end times in 24-hour format (HH:MM).",
      });
      return;
    }
    if (startTime === endTime) {
      response.status(400).json({ ok: false, message: "Start and end times must differ." });
      return;
    }
    if (paybackRequired && !TRADE_DATE_PATTERN.test(paybackDate)) {
      response.status(400).json({
        ok: false,
        message: "Payback is required, so enter the date you work instead.",
      });
      return;
    }

    const [tradeDetails, scheduleRows] = await Promise.all([
      prisma.departmentDetails.findUnique({
        where: { tenantId },
        select: { payloadJson: true },
      }),
      prisma.scheduleAssignments.findMany({
        where: { tenantId, dateKey: tradeDate },
        select: { shiftType: true, dateKey: true, assignmentsJson: true },
      }),
    ]);
    const tradePayload =
      tradeDetails?.payloadJson && typeof tradeDetails.payloadJson === "object"
        ? tradeDetails.payloadJson
        : {};
    const blockReason = tradeRequestBlockReasonFromStored({
      payload: tradePayload,
      rows: scheduleRows,
      requesterName: requester.name,
      counterpartName: counterpart.name,
      tradeDate,
      startTime,
      endTime,
    });
    if (blockReason) {
      response.status(400).json({ ok: false, message: blockReason });
      return;
    }

    const row = await prisma.tradeRequest.create({
      data: {
        tenantId,
        shiftType: requester.shift,
        requesterUsername,
        requesterName: requester.name,
        counterpartUsername: counterpart.username,
        counterpartName: counterpart.name,
        tradeDate,
        startTime,
        endTime,
        paybackRequired,
        paybackDate,
        reason,
        historyJson: appendTradeHistory([], { by: requesterUsername, action: "requested" }),
      },
    });
    response.json({ ok: true, trade: toTradeResponse(row) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected trade request error."),
    });
  }
});

async function saveAcceptedTrade(tenantId, existing, username, historyAction) {
  const dates = [existing.tradeDate];
  if (existing.paybackRequired && existing.paybackDate) dates.push(existing.paybackDate);
  const [details, scheduleRows] = await Promise.all([
    prisma.departmentDetails.findUnique({
      where: { tenantId },
      select: { payloadJson: true },
    }),
    prisma.scheduleAssignments.findMany({
      where: { tenantId, dateKey: { in: dates } },
      select: { shiftType: true, dateKey: true, assignmentsJson: true },
    }),
  ]);
  const payload =
    details?.payloadJson && typeof details.payloadJson === "object" ? details.payloadJson : {};
  const applied = applyAcceptedTrade({ payload, rows: scheduleRows, trade: existing });
  if (!applied.ok) return applied;
  const saved = await prisma.$transaction([
    ...applied.rows.map((row) =>
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
    prisma.tradeRequest.update({
      where: { id: existing.id },
      data: {
        status: "accepted",
        denialReason: "",
        scheduleChangeJson: applied.scheduleChange,
        historyJson: appendTradeHistory(existing.historyJson, {
          by: username,
          action: historyAction,
        }),
      },
    }),
  ]);
  return { ok: true, trade: toTradeResponse(saved[saved.length - 1]) };
}

async function saveCancelledTrade(tenantId, existing, username, historyAction) {
  const restored = rowsFromScheduleChange(existing.scheduleChangeJson);
  if (!restored.ok) return restored;
  const saved = await prisma.$transaction([
    ...restored.rows.map((row) =>
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
    prisma.tradeRequest.update({
      where: { id: existing.id },
      data: {
        status: "cancelled",
        historyJson: appendTradeHistory(existing.historyJson, {
          by: username,
          action: historyAction,
        }),
      },
    }),
  ]);
  return { ok: true, trade: toTradeResponse(saved[saved.length - 1]) };
}

app.patch("/api/trades/:id", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const username = request.auth.username.toLowerCase();
    const existing = await prisma.tradeRequest.findFirst({
      where: { id: trimValue(request.params.id), tenantId },
    });
    const involved =
      existing &&
      (existing.requesterUsername === username || existing.counterpartUsername === username);
    if (!existing || (!involved && !canSeeAllTrades(request.auth))) {
      response.status(404).json({ ok: false, message: "Trade not found." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const action = trimValue(String(body.action ?? ""));
    const note = trimValue(String(body.denialReason ?? "")).slice(0, 500);

    if (action === "accept" || action === "deny") {
      if (existing.counterpartUsername !== username) {
        response.status(403).json({
          ok: false,
          message: `Only ${existing.counterpartName} can accept or deny this trade.`,
        });
        return;
      }
      if (existing.status !== "requested") {
        response.status(409).json({ ok: false, message: "This trade was already answered." });
        return;
      }
      if (action === "deny" && !note) {
        response.status(400).json({ ok: false, message: "Enter a reason for denying." });
        return;
      }
      const settings = action === "accept" ? await readTradeSettings(tenantId) : null;
      const nextStatus =
        action === "deny" ? "denied" : settings.adminApproval ? "awaiting_admin" : "accepted";
      if (nextStatus === "accepted") {
        const saved = await saveAcceptedTrade(tenantId, existing, username, "accepted");
        if (!saved.ok) {
          response.status(400).json({ ok: false, message: saved.message });
          return;
        }
        response.json(saved);
        return;
      }
      const row = await prisma.tradeRequest.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          denialReason: action === "deny" ? note : "",
          historyJson: appendTradeHistory(existing.historyJson, {
            by: username,
            action: nextStatus,
            note,
          }),
        },
      });
      response.json({ ok: true, trade: toTradeResponse(row) });
      return;
    }

    if (action === "approve" || action === "admin_deny") {
      if (!canSeeAllTrades(request.auth)) {
        response.status(403).json({
          ok: false,
          message: "Only a sub admin or above can approve or deny a trade.",
        });
        return;
      }
      if (existing.status !== "awaiting_admin") {
        response.status(409).json({ ok: false, message: "This trade is not waiting for approval." });
        return;
      }
      if (action === "admin_deny" && !note) {
        response.status(400).json({ ok: false, message: "Enter a reason for denying." });
        return;
      }
      if (action === "approve") {
        const saved = await saveAcceptedTrade(tenantId, existing, username, "approved");
        if (!saved.ok) {
          response.status(400).json({ ok: false, message: saved.message });
          return;
        }
        response.json(saved);
        return;
      }
      const row = await prisma.tradeRequest.update({
        where: { id: existing.id },
        data: {
          status: action === "approve" ? "accepted" : "admin_denied",
          denialReason: action === "admin_deny" ? note : "",
          historyJson: appendTradeHistory(existing.historyJson, {
            by: username,
            action: action === "approve" ? "approved" : "admin_denied",
            note,
          }),
        },
      });
      response.json({ ok: true, trade: toTradeResponse(row) });
      return;
    }

    if (action === "cancel_request") {
      const party =
        existing.requesterUsername === username || existing.counterpartUsername === username;
      if (!party) {
        response.status(403).json({
          ok: false,
          message: "Only the two people in this trade can cancel it.",
        });
        return;
      }
      if (existing.status !== "accepted") {
        response.status(409).json({ ok: false, message: "Only an accepted trade can be cancelled." });
        return;
      }
      const row = await prisma.tradeRequest.update({
        where: { id: existing.id },
        data: {
          status: "cancel_requested",
          historyJson: appendTradeHistory(existing.historyJson, {
            by: username,
            action: "cancel_requested",
          }),
        },
      });
      response.json({ ok: true, trade: toTradeResponse(row) });
      return;
    }

    if (action === "cancel_accept" || action === "cancel_decline") {
      if (existing.status !== "cancel_requested") {
        response.status(409).json({
          ok: false,
          message: "This trade is not waiting for the cancellation to be accepted.",
        });
        return;
      }
      const requestedBy = cancelRequesterUsername(existing.historyJson);
      const otherParty =
        (existing.requesterUsername === username || existing.counterpartUsername === username) &&
        username !== requestedBy;
      if (!otherParty) {
        response.status(403).json({
          ok: false,
          message: "Only the other person in this trade can accept the cancellation.",
        });
        return;
      }
      if (action === "cancel_decline") {
        if (!note) {
          response.status(400).json({ ok: false, message: "Enter a reason for keeping the trade." });
          return;
        }
        const row = await prisma.tradeRequest.update({
          where: { id: existing.id },
          data: {
            status: "accepted",
            historyJson: appendTradeHistory(existing.historyJson, {
              by: username,
              action: "cancel_declined",
              note,
            }),
          },
        });
        response.json({ ok: true, trade: toTradeResponse(row) });
        return;
      }
      const settings = await readTradeSettings(tenantId);
      if (settings.cancelApproval) {
        const row = await prisma.tradeRequest.update({
          where: { id: existing.id },
          data: {
            status: "cancel_awaiting_admin",
            historyJson: appendTradeHistory(existing.historyJson, {
              by: username,
              action: "cancel_accepted",
            }),
          },
        });
        response.json({ ok: true, trade: toTradeResponse(row) });
        return;
      }
      const saved = await saveCancelledTrade(tenantId, existing, username, "cancelled");
      if (!saved.ok) {
        response.status(400).json({ ok: false, message: saved.message });
        return;
      }
      response.json(saved);
      return;
    }

    if (action === "cancel_approve" || action === "cancel_admin_deny") {
      if (!canSeeAllTrades(request.auth)) {
        response.status(403).json({
          ok: false,
          message: "Only a sub admin or above can approve or deny a cancellation.",
        });
        return;
      }
      if (existing.status !== "cancel_awaiting_admin") {
        response.status(409).json({
          ok: false,
          message: "This cancellation is not waiting for approval.",
        });
        return;
      }
      if (action === "cancel_admin_deny" && !note) {
        response.status(400).json({ ok: false, message: "Enter a reason for denying the cancellation." });
        return;
      }
      if (action === "cancel_approve") {
        const saved = await saveCancelledTrade(tenantId, existing, username, "cancel_approved");
        if (!saved.ok) {
          response.status(400).json({ ok: false, message: saved.message });
          return;
        }
        response.json(saved);
        return;
      }
      const row = await prisma.tradeRequest.update({
        where: { id: existing.id },
        data: {
          status: "accepted",
          historyJson: appendTradeHistory(existing.historyJson, {
            by: username,
            action: "cancel_admin_denied",
            note,
          }),
        },
      });
      response.json({ ok: true, trade: toTradeResponse(row) });
      return;
    }

    response.status(400).json({ ok: false, message: "Unknown trade action." });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected trade update error."),
    });
  }
});

// ----- /api/qualification-overrides (tenant-scoped; sub admin and above review) -----

function clockToMinutes(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? ""));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isScheduleLeaveRequest(requiredQualification) {
  const value = String(requiredQualification ?? "");
  return value === "Remove from seat" || value.startsWith("Partial shift ");
}

async function applyPartialShift(tenantId, requestRow) {
  const match = /^Partial shift (\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(requestRow.requiredQualification);
  if (!match) return;
  const startMinutes = clockToMinutes(match[1]);
  const endMinutes = clockToMinutes(match[2]);
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return;
  const existing = await prisma.scheduleAssignments.findUnique({
    where: {
      tenantId_shiftType_dateKey: {
        tenantId,
        shiftType: requestRow.shiftType,
        dateKey: requestRow.dateKey,
      },
    },
  });
  const payload =
    existing?.assignmentsJson && typeof existing.assignmentsJson === "object"
      ? JSON.parse(JSON.stringify(existing.assignmentsJson))
      : {};
  if (!payload.assignments || typeof payload.assignments !== "object") payload.assignments = {};
  if (!payload.overtimeSplit || typeof payload.overtimeSplit !== "object") payload.overtimeSplit = {};
  if (!payload.slotSegments || typeof payload.slotSegments !== "object") payload.slotSegments = {};
  const flags = Array.isArray(payload.overtimeSplit[requestRow.unitId])
    ? [...payload.overtimeSplit[requestRow.unitId]]
    : [];
  while (flags.length <= requestRow.slotIndex) flags.push(false);
  flags[requestRow.slotIndex] = true;
  payload.overtimeSplit[requestRow.unitId] = flags;
  const unitSegments = Array.isArray(payload.slotSegments[requestRow.unitId])
    ? [...payload.slotSegments[requestRow.unitId]]
    : [];
  while (unitSegments.length <= requestRow.slotIndex) unitSegments.push([]);
  const current = Array.isArray(unitSegments[requestRow.slotIndex]) ? unitSegments[requestRow.slotIndex] : [];
  const segmentId = `partial-${requestRow.id}`;
  const assignedNames = String(
    Array.isArray(payload.assignments[requestRow.unitId])
      ? payload.assignments[requestRow.unitId][requestRow.slotIndex] ?? ""
      : "",
  )
    .split("||OT||")
    .map((name) => name.trim())
    .filter((name) => name && name.toLowerCase() !== requestRow.personName.trim().toLowerCase());
  const details = await prisma.departmentDetails.findUnique({
    where: { tenantId },
    select: { payloadJson: true },
  });
  const departmentPayload =
    details?.payloadJson && typeof details.payloadJson === "object" ? details.payloadJson : {};
  const shifts = Array.isArray(departmentPayload.shiftInformationEntries)
    ? departmentPayload.shiftInformationEntries
    : [];
  const shift = shifts.find((entry) => String(entry?.shiftType ?? "") === requestRow.shiftType);
  const shiftStart = clockToMinutes(String(shift?.startTime ?? "")) ?? 8 * 60;
  const shiftHours = Math.max(1, Number(shift?.shiftDuration) || 12);
  const shiftEnd = shiftStart + shiftHours * 60;
  const keptOthers = assignedNames.map((name) => ({
    id: `kept-${requestRow.id}-${name.toLowerCase().replace(/\s+/g, "-")}`,
    assigneeType: "personnel",
    personnelName: name,
    startMinutes: shiftStart,
    endMinutes: shiftEnd,
    source: "manual",
    overtime: false,
  }));
  const keptNames = new Set(assignedNames.map((name) => name.toLowerCase()));
  unitSegments[requestRow.slotIndex] = [
    ...current.filter(
      (item) =>
        item &&
        item.id !== segmentId &&
        !keptNames.has(String(item.personnelName ?? "").trim().toLowerCase()) &&
        String(item.personnelName ?? "").trim().toLowerCase() !== requestRow.personName.trim().toLowerCase(),
    ),
    ...keptOthers,
    {
      id: segmentId,
      assigneeType: "personnel",
      personnelName: requestRow.personName,
      startMinutes,
      endMinutes,
      source: "manual",
      overtime: false,
    },
  ];
  payload.slotSegments[requestRow.unitId] = unitSegments;
  if (existing) {
    await prisma.scheduleAssignments.update({
      where: { id: existing.id },
      data: { assignmentsJson: payload },
    });
    return;
  }
  await prisma.scheduleAssignments.create({
    data: {
      tenantId,
      shiftType: requestRow.shiftType,
      dateKey: requestRow.dateKey,
      assignmentsJson: payload,
    },
  });
}

function toOverrideResponse(row) {
  return {
    id: row.id,
    requesterUsername: row.requesterUsername,
    requesterName: row.requesterName,
    personName: row.personName,
    apparatus: row.apparatus,
    unitId: row.unitId,
    slotIndex: row.slotIndex,
    dateKey: row.dateKey,
    requiredQualification: row.requiredQualification,
    shiftType: row.shiftType,
    status: row.status,
    denialReason: row.denialReason,
  };
}

function slotNamesWithout(slotValue, personName) {
  const target = personName.trim().toLowerCase();
  return String(slotValue ?? "")
    .split("||OT||")
    .map((name) => name.trim())
    .filter((name) => name && name.toLowerCase() !== target)
    .join("||OT||");
}

async function removeOverrideFromSchedule(tenantId, requestRow) {
  const row = await prisma.scheduleAssignments.findUnique({
    where: {
      tenantId_shiftType_dateKey: {
        tenantId,
        shiftType: requestRow.shiftType,
        dateKey: requestRow.dateKey,
      },
    },
  });
  if (!row?.assignmentsJson || typeof row.assignmentsJson !== "object") return;
  const payload = JSON.parse(JSON.stringify(row.assignmentsJson));
  const assignments =
    payload.assignments && typeof payload.assignments === "object" ? payload.assignments : payload;
  const slots = assignments[requestRow.unitId];
  if (Array.isArray(slots) && requestRow.slotIndex >= 0 && requestRow.slotIndex < slots.length) {
    slots[requestRow.slotIndex] = slotNamesWithout(slots[requestRow.slotIndex], requestRow.personName);
  }
  const segmentDay = payload.slotSegments?.[requestRow.unitId];
  if (Array.isArray(segmentDay) && Array.isArray(segmentDay[requestRow.slotIndex])) {
    segmentDay[requestRow.slotIndex] = segmentDay[requestRow.slotIndex].map((segment) => {
      if (!segment || typeof segment !== "object") return segment;
      if (String(segment.personnelName ?? "").trim().toLowerCase() !== requestRow.personName.trim().toLowerCase()) {
        return segment;
      }
      return { ...segment, personnelName: "", assigneeType: "hire" };
    });
  }
  await prisma.scheduleAssignments.update({
    where: { id: row.id },
    data: { assignmentsJson: payload },
  });
}

app.get("/api/qualification-overrides", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const canReview = canSeeAllTrades(request.auth);
    const rows = await prisma.qualificationOverrideRequest.findMany({
      where: {
        tenantId,
        status: { in: ["pending", "approved"] },
      },
      orderBy: { createdAt: "asc" },
    });
    response.json({ ok: true, canReview, requests: rows.map(toOverrideResponse) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected permission request read error."),
    });
  }
});

app.post("/api/qualification-overrides", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const personName = trimValue(String(body.personName ?? ""));
    const dateKey = trimValue(String(body.dateKey ?? ""));
    const unitId = trimValue(String(body.unitId ?? ""));
    const apparatus = trimValue(String(body.apparatus ?? ""));
    const shiftType = trimValue(String(body.shiftType ?? ""));
    const requiredQualification = trimValue(String(body.requiredQualification ?? ""));
    const slotIndex = Math.floor(Number(body.slotIndex));
    if (!personName || !TRADE_DATE_PATTERN.test(dateKey) || !unitId || !requiredQualification || slotIndex < 0) {
      response.status(400).json({ ok: false, message: "The permission request is missing a seat or a date." });
      return;
    }
    const details = await prisma.departmentDetails.findUnique({
      where: { tenantId },
      select: { payloadJson: true },
    });
    const payload =
      details?.payloadJson && typeof details.payloadJson === "object" ? details.payloadJson : {};
    const rules =
      payload.personnelQualificationOverrides && typeof payload.personnelQualificationOverrides === "object"
        ? payload.personnelQualificationOverrides
        : {};
    const rule = rules[requiredQualification];
    const placeNow = body.placeNow === true && canSeeAllTrades(request.auth);
    const removalRequest = requiredQualification === "Remove from seat";
    if (removalRequest) {
      const fullNameMap = await getTenantUserFullNameMap(tenantId);
      const requesterUsername = request.auth.username.toLowerCase();
      const requesterName = trimValue(fullNameMap[requesterUsername] ?? "") || requesterUsername;
      if (personName.toLowerCase() !== requesterName.toLowerCase()) {
        response.status(403).json({ ok: false, message: "You can only request to be removed from your own seat." });
        return;
      }
      const existing = await prisma.qualificationOverrideRequest.findFirst({
        where: { tenantId, personName, dateKey, unitId, slotIndex, status: "pending", requiredQualification: "Remove from seat" },
      });
      if (existing) {
        response.json({ ok: true, request: toOverrideResponse(existing) });
        return;
      }
      const row = await prisma.qualificationOverrideRequest.create({
        data: {
          tenantId,
          requesterUsername,
          requesterName,
          personName,
          apparatus,
          unitId,
          slotIndex,
          dateKey,
          requiredQualification: "Remove from seat",
          shiftType,
          status: "pending",
        },
      });
      response.json({ ok: true, request: toOverrideResponse(row) });
      return;
    }
    const partialMatch = /^Partial shift (\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(requiredQualification);
    if (partialMatch) {
      const startMinutes = clockToMinutes(partialMatch[1]);
      const endMinutes = clockToMinutes(partialMatch[2]);
      if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
        response.status(400).json({
          ok: false,
          message: "Enter a start and end in 24-hour time, with the end later than the start.",
        });
        return;
      }
      const fullNameMap = await getTenantUserFullNameMap(tenantId);
      const requesterUsername = request.auth.username.toLowerCase();
      const requesterName = trimValue(fullNameMap[requesterUsername] ?? "") || requesterUsername;
      if (personName.toLowerCase() !== requesterName.toLowerCase()) {
        response.status(403).json({ ok: false, message: "You can only request a partial shift for yourself." });
        return;
      }
      const existing = await prisma.qualificationOverrideRequest.findFirst({
        where: { tenantId, personName, dateKey, unitId, slotIndex, status: "pending", requiredQualification },
      });
      if (existing) {
        response.json({ ok: true, request: toOverrideResponse(existing) });
        return;
      }
      const partialRow = await prisma.qualificationOverrideRequest.create({
        data: {
          tenantId,
          requesterUsername,
          requesterName,
          personName,
          apparatus,
          unitId,
          slotIndex,
          dateKey,
          requiredQualification,
          shiftType,
          status: "pending",
        },
      });
      response.json({ ok: true, request: toOverrideResponse(partialRow) });
      return;
    }
    const lower = trimValue(String(rule?.lowerQualification ?? ""));
    if (!rule || rule.enabled !== true || !lower) {
      response.status(400).json({
        ok: false,
        message: "This qualification does not allow an admin override.",
      });
      return;
    }
    const records = Array.isArray(payload.schedulerPersonnelRecords) ? payload.schedulerPersonnelRecords : [];
    const person = records.find(
      (entry) => trimValue(String(entry?.name ?? "")).toLowerCase() === personName.toLowerCase(),
    );
    const qualifications = Array.isArray(person?.qualifications)
      ? person.qualifications.map((item) => trimValue(String(item ?? ""))).filter(Boolean)
      : [];
    if (!qualifications.includes(lower)) {
      response.status(400).json({
        ok: false,
        message: `${personName} does not have ${lower}, so this seat cannot be requested.`,
      });
      return;
    }
    const existing = await prisma.qualificationOverrideRequest.findFirst({
      where: { tenantId, personName, dateKey, unitId, slotIndex, status: "pending", requiredQualification },
    });
    if (existing) {
      response.json({ ok: true, request: toOverrideResponse(existing) });
      return;
    }
    const fullNameMap = await getTenantUserFullNameMap(tenantId);
    const requesterUsername = request.auth.username.toLowerCase();
    const row = await prisma.qualificationOverrideRequest.create({
      data: {
        tenantId,
        requesterUsername,
        requesterName: trimValue(fullNameMap[requesterUsername] ?? "") || requesterUsername,
        personName,
        apparatus,
        unitId,
        slotIndex,
        dateKey,
        requiredQualification,
        shiftType,
        status: placeNow ? "approved" : "pending",
      },
    });
    response.json({ ok: true, request: toOverrideResponse(row) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected permission request error."),
    });
  }
});

app.patch("/api/qualification-overrides/:id", async (request, response) => {
  try {
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      response.status(400).json({ ok: false, message: "Missing tenant context." });
      return;
    }
    if (!canSeeAllTrades(request.auth)) {
      response.status(403).json({ ok: false, message: "Only a sub admin or above can approve this request." });
      return;
    }
    const existing = await prisma.qualificationOverrideRequest.findFirst({
      where: { id: request.params.id, tenantId },
    });
    if (!existing || existing.status !== "pending") {
      response.status(404).json({ ok: false, message: "That permission request is no longer waiting." });
      return;
    }
    const action = trimValue(String(request.body?.action ?? ""));
    if (action === "deny") {
      const denialReason = trimValue(String(request.body?.denialReason ?? ""));
      if (!denialReason) {
        response.status(400).json({ ok: false, message: "Enter a reason before denying." });
        return;
      }
      if (!isScheduleLeaveRequest(existing.requiredQualification)) {
        await removeOverrideFromSchedule(tenantId, existing);
      }
      const row = await prisma.qualificationOverrideRequest.update({
        where: { id: existing.id },
        data: { status: "denied", denialReason },
      });
      response.json({ ok: true, request: toOverrideResponse(row) });
      return;
    }
    if (action !== "approve") {
      response.status(400).json({ ok: false, message: "Unknown permission action." });
      return;
    }
    if (existing.requiredQualification.startsWith("Partial shift ")) {
      await applyPartialShift(tenantId, existing);
    } else if (existing.requiredQualification === "Remove from seat") {
      await removeOverrideFromSchedule(tenantId, existing);
    }
    const row = await prisma.qualificationOverrideRequest.update({
      where: { id: existing.id },
      data: { status: "approved", denialReason: "" },
    });
    response.json({ ok: true, request: toOverrideResponse(row) });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected permission update error."),
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

function roleToUserTypeLabel(role) {
  const r = trimValue(role || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (r === "superadmin" || r === "super_admin") return "Super Admin";
  if (r === "subadmin" || r === "sub_admin") return "Subadmin";
  if (r === "admin") return "Admin";
  return "User";
}

async function refuseAccountChange(response, tenantId, actor, change) {
  const denial = await accountChangeError(prisma, tenantId, actor, change);
  if (!denial) return false;
  response.status(403).json({ ok: false, code: "FORBIDDEN", message: denial });
  return true;
}

async function auditAccountChange(tenantId, actor, action, targetUsername, detail) {
  await writeAccountAudit(prisma, {
    tenantId,
    actorUserId: actor?.userId ?? null,
    actorUsername: actor?.username ?? "",
    action,
    targetUsername,
    detail,
  });
}

function toUserResponse(user, fullNameMap = {}, userTypeLabelMap = {}) {
  const normalizedUsername = trimValue(user.username).toLowerCase();
  return {
    id: user.id,
    username: user.username,
    userType:
      userTypeLabelMap[normalizedUsername] || roleToUserTypeLabel(user.role),
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
        publicErrorMessage(error, "Unexpected users list error."),
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
    const nextRole = mapUserTypeToRole(userType);
    if (await refuseAccountChange(response, tenantId, request.auth, {
      action: "create",
      target: null,
      nextRole,
    })) {
      return;
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        tenantId,
        username,
        passwordHash,
        role: nextRole,
      },
    });
    await setTenantUserFullName(tenantId, username, fullName);
    await setTenantUserTypeLabel(tenantId, username, userType);
    await auditAccountChange(
      tenantId,
      request.auth,
      "create",
      username,
      `Created account with role ${nextRole}.`,
    );
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
        publicErrorMessage(error, "Unexpected user create error."),
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
      roleToUserTypeLabel(existing.role);
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
    const nameOnlySelf =
      request.auth?.userId === existing.id &&
      updates.username === undefined &&
      updates.role === undefined &&
      updates.passwordHash === undefined;
    if (!nameOnlySelf) {
      if (await refuseAccountChange(response, tenantId, request.auth, {
        action: "update",
        target: existing,
        nextRole: updates.role ?? existing.role,
      })) {
        return;
      }
    }
    let user = existing;
    if (Object.keys(updates).length > 0) {
      const written = await prisma.user.updateMany({
        where: { id, tenantId },
        data: updates,
      });
      if (written.count !== 1) {
        response.status(404).json({ ok: false, message: "User not found." });
        return;
      }
      user = await prisma.user.findFirst({ where: { id, tenantId } });
    }
    if (updates.passwordHash) {
      const keepSessionId = request.auth?.userId === user.id ? request.auth.sessionId : null;
      await revokeOtherSessions(prisma, user.id, keepSessionId);
    }
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
      nextUserTypeLabel || roleToUserTypeLabel(user.role),
      trimValue(existing.username).toLowerCase(),
    );
    const changes = [];
    if (updates.username) changes.push("Changed username.");
    if (updates.role) changes.push(`Changed role to ${canonicalRole(user.role)}.`);
    if (updates.passwordHash) changes.push("Changed password.");
    if (body.name !== undefined) changes.push("Changed display name.");
    if (body.userType !== undefined && !updates.role) changes.push("Changed user type label.");
    if (changes.length > 0) {
      await auditAccountChange(
        tenantId,
        request.auth,
        "update",
        nextUsername,
        changes.join(" "),
      );
    }
    response.json({
      ok: true,
      user: toUserResponse(
        user,
        { [nextUsername]: nextFullName || nextUsername },
        {
          [nextUsername]:
            nextUserTypeLabel || roleToUserTypeLabel(user.role),
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
        publicErrorMessage(error, "Unexpected user update error."),
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
    });
    if (!existing) {
      response.status(404).json({ ok: false, message: "User not found." });
      return;
    }
    if (await refuseAccountChange(response, tenantId, request.auth, {
      action: "reset-password",
      target: existing,
      nextRole: existing.role,
    })) {
      return;
    }
    const written = await prisma.user.updateMany({
      where: { id: existing.id, tenantId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    if (written.count !== 1) {
      response.status(404).json({ ok: false, message: "User not found." });
      return;
    }
    await revokeAllSessions(prisma, existing.id);
    await auditAccountChange(
      tenantId,
      request.auth,
      "reset-password",
      existing.username,
      "Reset password.",
    );
    response.status(200).json({ ok: true, message: "Password reset." });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        publicErrorMessage(error, "Unexpected reset-password error."),
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
    if (await refuseAccountChange(response, tenantId, request.auth, {
      action: "delete",
      target: existing,
      nextRole: null,
    })) {
      return;
    }
    const removed = await prisma.user.deleteMany({ where: { id, tenantId } });
    if (removed.count !== 1) {
      response.status(404).json({ ok: false, message: "User not found." });
      return;
    }
    await removeTenantUserFullName(tenantId, existing.username);
    await removeTenantUserTypeLabel(tenantId, existing.username);
    await auditAccountChange(
      tenantId,
      request.auth,
      "delete",
      existing.username,
      `Deleted account with role ${canonicalRole(existing.role)}.`,
    );
    response.status(204).send();
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        publicErrorMessage(error, "Unexpected user delete error."),
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
      message: publicErrorMessage(error, "Unexpected proxy debug error."),
    });
  }
});

app.get("/api/neris/entities", async (request, response) => {
  const config = getProxyConfig();
  try {
    const now = Date.now();
    const cachedAtMs = cachedNerisEntityDirectory?.fetchedAtIso
      ? Date.parse(cachedNerisEntityDirectory.fetchedAtIso)
      : 0;
    const isFresh = cachedAtMs && now - cachedAtMs < NERIS_ENTITY_DIRECTORY_CACHE_TTL_MS;

    if (!cachedNerisEntityDirectory) {
      const refreshed = await refreshNerisEntityDirectoryCache(config);
      response.status(refreshed.ok ? 200 : refreshed.status).json({
        ok: refreshed.ok,
        status: refreshed.status,
        statusText: refreshed.statusText,
        cached: Boolean(cachedNerisEntityDirectory),
        refreshed: refreshed.ok,
        neris: refreshed.ok ? cachedNerisEntityDirectory : refreshed.body,
      });
      return;
    }

    response.status(200).json({
      ok: true,
      status: 200,
      statusText: "OK",
      cached: true,
      cacheFresh: Boolean(isFresh),
      cacheTtlMs: NERIS_ENTITY_DIRECTORY_CACHE_TTL_MS,
      neris: cachedNerisEntityDirectory,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        publicErrorMessage(error, "Unexpected NERIS entities error."),
    });
  }
});

app.post("/api/admin/neris/entities/refresh", async (request, response) => {
  const config = getProxyConfig();
  try {
    const refreshed = await refreshNerisEntityDirectoryCache(config);
    response.status(refreshed.ok ? 200 : refreshed.status).json({
      ok: refreshed.ok,
      status: refreshed.status,
      statusText: refreshed.statusText,
      neris: refreshed.ok ? cachedNerisEntityDirectory : refreshed.body,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message:
        publicErrorMessage(error, "Unexpected NERIS entities refresh error."),
    });
  }
});

app.get("/api/neris/debug/entity-check", async (request, response) => {
  if (await rejectForeignNerisEntity(request, response)) return;
  const config = getProxyConfig();
  const requestedNerisId =
    readQueryValue(request.query.nerisId) ||
    readQueryValue(request.query.neris_id) ||
    (await resolveEntityIdFromRequest({}, request.headers, config, request.tenant));
  if (!requestedNerisId) {
    response.status(400).json({
      ok: false,
      message:
        "Missing NERIS entity ID. Provide ?nerisId=FD######## or set it in Admin Functions → Setup/Configuration → NERIS Configuration → NERIS Export Configuration.",
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
        publicErrorMessage(error, "Unexpected entity-check debug error."),
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
  if (await rejectForeignNerisEntity(request, response)) return;
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
        "Missing NERIS entity ID. Provide ?entityId=... or set it in Admin Functions → Setup/Configuration → NERIS Configuration → NERIS Export Configuration.",
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
  const tenantEntityId = trimValue(request.tenant?.id)
    ? await resolveTenantEntityId(request.tenant.id)
    : "";
  if (request.tenant?.id && incidentEntityFromId && incidentEntityFromId !== tenantEntityId) {
    response.status(403).json({
      ok: false,
      code: "TENANT_ENTITY_MISMATCH",
      message: "This department can only use its own NERIS entity ID.",
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
        publicErrorMessage(error, "Unexpected proxy get-incident debug error."),
      submittedEntityId: requestedEntityId,
      incidentNerisId: requestedIncidentNerisId,
    });
  }
});

function clientSuppliedEntityIds(request) {
  const body = request.body && typeof request.body === "object" ? request.body : {};
  const integration =
    body.integration && typeof body.integration === "object" ? body.integration : {};
  const values = [
    integration.entityId,
    request.headers?.["x-neris-entity-id"],
    request.headers?.["x-neris-vendor-code"],
    readQueryValue(request.query?.entityId),
    readQueryValue(request.query?.nerisId),
    readQueryValue(request.query?.neris_id),
  ];
  return values.map((value) => trimValue(value)).filter((value) => NERIS_ENTITY_ID_PATTERN.test(value));
}

/** A department may only act as its own NERIS entity. Returns true when the response was sent. */
async function rejectForeignNerisEntity(request, response) {
  const tenantId = trimValue(request.tenant?.id);
  if (!tenantId) return false;
  const supplied = clientSuppliedEntityIds(request);
  if (supplied.length === 0) return false;
  const tenantEntityId = await resolveTenantEntityId(tenantId);
  if (supplied.every((value) => value === tenantEntityId)) return false;
  response.status(403).json({
    ok: false,
    code: "TENANT_ENTITY_MISMATCH",
    message: "This department can only use its own NERIS entity ID.",
  });
  return true;
}

async function resolveEntityIdFromRequest(requestBody, requestHeaders, config, tenant) {
  const tenantId = trimValue(tenant?.id);
  if (tenantId) {
    const tenantEntityIdFromContext = trimValue(tenant?.nerisEntityId);
    if (tenantEntityIdFromContext && NERIS_ENTITY_ID_PATTERN.test(tenantEntityIdFromContext)) {
      return tenantEntityIdFromContext;
    }
    // Fail-closed for tenant traffic: never use a caller-supplied id or the global env value.
    return resolveTenantEntityId(tenantId);
  }

  const integration =
    requestBody?.integration && typeof requestBody.integration === "object"
      ? requestBody.integration
      : {};
  const headerEntityId =
    trimValue(requestHeaders["x-neris-entity-id"]) ||
    trimValue(requestHeaders["x-neris-vendor-code"]);
  const bodyEntityId = trimValue(integration.entityId);
  return bodyEntityId || headerEntityId || config.defaultEntityId;
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
  if (await rejectForeignNerisEntity(request, response)) return;
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
        "Missing NERIS entity ID. Set it in Admin Functions → Setup/Configuration → NERIS Configuration → NERIS Export Configuration.",
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
      message: publicErrorMessage(error, "Unexpected proxy validate error."),
    });
  }
});

app.post("/api/neris/export", async (request, response) => {
  if (await rejectForeignNerisEntity(request, response)) return;
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
        "Missing NERIS entity ID. Set it in Admin Functions → Setup/Configuration → NERIS Configuration → NERIS Export Configuration.",
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
    let exportRecorded = false;
    try {
      await writeNerisExportReceipt({
        tenantId: request.tenant?.id,
        auth: request.auth,
        requestBody: request.body,
        entityId,
        payload,
        httpStatus: finalResponse.status,
        httpStatusText: finalResponse.statusText,
        responseBody: finalResponseBody,
        fallback,
      });
      exportRecorded = true;
    } catch {
      console.error("[NERIS export] Could not store the export record.");
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
      exportRecorded,
      createResult: {
        status: createResponse.status,
        statusText: createResponse.statusText,
        neris: createResponseBody,
      },
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: publicErrorMessage(error, "Unexpected proxy error."),
    });
  }
});

const config = getProxyConfig();
const __filename = fileURLToPath(import.meta.url);
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === __filename;
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

app.use((request, response, next) => {
  if (!String(request.path || "").toLowerCase().startsWith("/api")) {
    next();
    return;
  }
  response.status(404).json({ ok: false, message: "Not found." });
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  const unreadable = error?.type === "entity.parse.failed" || error instanceof SyntaxError;
  const status = unreadable ? 400 : 500;
  console.error("[request error]", {
    method: request.method,
    path: String(request.path || "").slice(0, 200),
    status,
    type: typeof error?.type === "string" ? error.type : error?.name || "Error",
  });
  response.status(status).json({
    ok: false,
    message: unreadable ? "The request could not be read." : "Something went wrong.",
  });
});

if (invokedDirectly) {
  app.listen(config.proxyPort, () => {
    console.log(`NERIS proxy listening on http://localhost:${config.proxyPort}`);
    console.log(`NERIS base URL: ${config.baseUrl}`);
    if (!configuredCadIngestSecret()) {
      console.warn(
        "[CAD ingest] CAD_INGEST_SECRET is unset — POST /api/cad/inbound-email returns 503 until configured.",
      );
    }
    if (hasFrontendBuild) {
      console.log(`Frontend build detected at ${frontendDistDir} and served by proxy.`);
    }
  });
}

export { app, prisma, clearLoginLockouts };
