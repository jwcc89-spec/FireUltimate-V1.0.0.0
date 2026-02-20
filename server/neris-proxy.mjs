import express from "express";

const app = express();
app.use(express.json({ limit: "4mb" }));

const DEFAULT_NERIS_BASE_URL = "https://api.neris.fsri.org/v1";
const DEFAULT_PROXY_PORT = 8787;
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const NERIS_ENTITY_ID_PATTERN = /^(FD|VN|FM|FA)\d{8}$/;
const NERIS_DEPARTMENT_ID_PATTERN = /^FD\d{8}$/;

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

function toIsoDateTime(value, fallbackIsoDateTime) {
  const trimmed = trimValue(value);
  if (!trimmed) {
    return fallbackIsoDateTime;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackIsoDateTime;
  }
  return parsed.toISOString();
}

function parseLocationFromAddress(addressValue, fallbackState, fallbackCountry) {
  const rawAddress = trimValue(addressValue);
  const parts = rawAddress
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const street = parts[0] || "UNKNOWN";
  const city = parts[1] || "UNKNOWN";
  const stateAndZip = parts[2] || fallbackState || "NY";
  const state = stateAndZip.split(/\s+/)[0] || fallbackState || "NY";

  return {
    street,
    incorporated_municipality: city,
    state,
    country: fallbackCountry || "US",
  };
}

function getProxyConfig() {
  const baseUrl = trimValue(process.env.NERIS_BASE_URL) || DEFAULT_NERIS_BASE_URL;
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
    grantType: trimValue(process.env.NERIS_GRANT_TYPE) || "password",
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

  if (!config.clientId || !config.clientSecret || !config.username || !config.password) {
    throw new Error(
      "Missing server auth config. Set NERIS_CLIENT_ID, NERIS_CLIENT_SECRET, NERIS_USERNAME, and NERIS_PASSWORD in .env.server (or set NERIS_STATIC_ACCESS_TOKEN).",
    );
  }

  const tokenBody = new URLSearchParams();
  tokenBody.set("grant_type", config.grantType);
  tokenBody.set("username", config.username);
  tokenBody.set("password", config.password);

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
    throw new Error(
      `Token request failed (${tokenResponse.status} ${tokenResponse.statusText}). ${JSON.stringify(
        tokenResponseBody ?? {},
      )}`,
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
  const incidentSnapshot =
    body.incidentSnapshot && typeof body.incidentSnapshot === "object"
      ? body.incidentSnapshot
      : {};

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
  const callCreate = toIsoDateTime(formValues.incident_time_call_create, nowIso);
  const callAnswered = toIsoDateTime(formValues.incident_time_call_answered, callCreate);
  const callArrival = toIsoDateTime(formValues.incident_time_call_arrival, callAnswered);

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

  const primaryUnitId = trimValue(formValues.resource_primary_unit_id);
  const staffingRaw = trimValue(formValues.resource_primary_unit_staffing);
  const staffing = Number.parseInt(staffingRaw, 10);
  const unitResponse = {};
  if (primaryUnitId) {
    unitResponse.reported_unit_id = primaryUnitId;
  }
  if (!Number.isNaN(staffing) && staffing >= 0) {
    unitResponse.staffing = staffing;
  }
  const unitResponses = [unitResponse];

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

  return {
    base: {
      department_neris_id: departmentNerisId,
      incident_number: incidentNumber,
      location: baseLocation,
    },
    incident_types: incidentTypes,
    dispatch: dispatchPayload,
  };
}

app.get("/api/neris/health", (request, response) => {
  const config = getProxyConfig();
  response.json({
    ok: true,
    proxyPort: config.proxyPort,
    baseUrl: config.baseUrl,
    createIncidentUrlPrefix: config.createIncidentUrlPrefix,
    usingStaticToken: Boolean(config.staticAccessToken),
    hasClientCredentials: Boolean(config.clientId && config.clientSecret),
    hasUserCredentials: Boolean(config.username && config.password),
    hasDefaultEntityId: Boolean(config.defaultEntityId),
    hasDefaultDepartmentNerisId: Boolean(config.defaultDepartmentNerisId),
  });
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

app.post("/api/neris/export", async (request, response) => {
  const config = getProxyConfig();
  const integration =
    request.body?.integration && typeof request.body.integration === "object"
      ? request.body.integration
      : {};
  const headerEntityId =
    trimValue(request.headers["x-neris-entity-id"]) ||
    trimValue(request.headers["x-neris-vendor-code"]);
  const bodyEntityId = trimValue(integration.entityId);
  const entityId = bodyEntityId || headerEntityId || config.defaultEntityId;

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
      `${config.createIncidentUrlPrefix}/${encodeURIComponent(entityId)}`,
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
          ? "Token can list this entity, but create permission is denied. Confirm account role/enrollment allows incident creation for this entity."
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
      message: error instanceof Error ? error.message : "Unexpected proxy error.",
    });
  }
});

const config = getProxyConfig();
app.listen(config.proxyPort, () => {
  console.log(`NERIS proxy listening on http://localhost:${config.proxyPort}`);
  console.log(`NERIS base URL: ${config.baseUrl}`);
});
