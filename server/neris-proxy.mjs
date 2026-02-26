import express from "express";
import fs from "fs";
import path from "path";

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
    proxyPort: Number.parseInt(process.env.NERIS_PROXY_PORT || "", 10) || DEFAULT_PROXY_PORT,
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

  const dispatchPayload = {
    incident_number: dispatchIncidentNumber,
    call_arrival: callArrival,
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
    incident_number: incidentNumber,
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
  if (uniqueAidEntries.length > 0) {
    payload.aids = uniqueAidEntries;
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

app.get("/api/neris/health", (request, response) => {
  const config = getProxyConfig();
  const requiresUserCredentials = config.grantType === "password";
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
  });
});

const DEPARTMENT_DETAILS_FILE = path.resolve(
  process.cwd(),
  "data",
  "department-details.json",
);

function readDepartmentDetailsFromFile() {
  try {
    if (fs.existsSync(DEPARTMENT_DETAILS_FILE)) {
      const raw = fs.readFileSync(DEPARTMENT_DETAILS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    }
  } catch {
    // Ignore read errors; return empty.
  }
  return {};
}

function writeDepartmentDetailsToFile(data) {
  const dir = path.dirname(DEPARTMENT_DETAILS_FILE);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DEPARTMENT_DETAILS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

app.get("/api/department-details", (request, response) => {
  const data = readDepartmentDetailsFromFile();
  response.json({ ok: true, data });
});

app.post("/api/department-details", (request, response) => {
  const body = request.body && typeof request.body === "object" ? request.body : {};
  const success = writeDepartmentDetailsToFile(body);
  if (success) {
    response.status(200).json({ ok: true });
  } else {
    response.status(500).json({ ok: false, message: "Failed to write department details." });
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

function readQueryValue(queryValue) {
  if (Array.isArray(queryValue)) {
    return trimValue(queryValue[0]);
  }
  return trimValue(queryValue);
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
  const requestedEntityId =
    readQueryValue(request.query.entityId) || incidentEntityFromId || config.defaultEntityId;

  if (!requestedEntityId) {
    response.status(400).json({
      ok: false,
      message:
        "Missing NERIS entity ID. Provide ?entityId=... or set NERIS_ENTITY_ID in .env.server.",
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
          : "Token is not authorized for submittedEntityId. Compare submittedEntityId against accessibleEntityIds from this token.",
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

function resolveEntityIdFromRequest(requestBody, requestHeaders, config) {
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
  const config = getProxyConfig();
  const entityId = resolveEntityIdFromRequest(request.body, request.headers, config);

  if (!entityId) {
    response.status(400).json({
      ok: false,
      message:
        "Missing NERIS entity ID. Set Vendor/Department code in Customization OR set NERIS_ENTITY_ID in .env.server.",
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
          : "Token is not authorized for submittedEntityId. Compare submittedEntityId against accessibleEntityIds from this token.",
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
  const entityId = resolveEntityIdFromRequest(request.body, request.headers, config);

  if (!entityId) {
    response.status(400).json({
      ok: false,
      message:
        "Missing NERIS entity ID. Set Vendor/Department code in Customization OR set NERIS_ENTITY_ID in .env.server.",
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
          : "Token is not authorized for submittedEntityId. Compare submittedEntityId against accessibleEntityIds from this token.",
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
app.listen(config.proxyPort, () => {
  console.log(`NERIS proxy listening on http://localhost:${config.proxyPort}`);
  console.log(`NERIS base URL: ${config.baseUrl}`);
});
