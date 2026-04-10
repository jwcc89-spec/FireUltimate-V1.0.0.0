/**
 * Fire Recovery USA HTTP client (JWT + Recovery Hub endpoints).
 */

function trimValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getFireRecoveryBaseUrl() {
  return trimValue(process.env.FIRE_RECOVERY_BASE_URL) || "https://process.firerecoveryusa.com";
}

/**
 * @returns {{ username: string, password: string } | null}
 */
export function getFireRecoveryApiCredentials() {
  const username = trimValue(process.env.FIRE_RECOVERY_API_USERNAME);
  const password = trimValue(process.env.FIRE_RECOVERY_API_PASSWORD);
  if (!username || !password) return null;
  return { username, password };
}

/**
 * @returns {Promise<string>}
 */
export async function getFireRecoveryJwt() {
  const cred = getFireRecoveryApiCredentials();
  if (!cred) {
    throw new Error(
      "Fire Recovery API credentials are not configured. Set FIRE_RECOVERY_API_USERNAME and FIRE_RECOVERY_API_PASSWORD in .env.server.",
    );
  }
  const baseUrl = getFireRecoveryBaseUrl();
  const url = `${baseUrl.replace(/\/$/, "")}/Primary/REST/AccountService/LoginAndGetJWTToken`;
  const basic = Buffer.from(`${cred.username}:${cred.password}`, "utf8").toString("base64");
  const body = JSON.stringify({
    userName: cred.username,
    password: cred.password,
    outputtype: "Json",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Fire Recovery login returned non-JSON (HTTP ${res.status}).`);
  }
  if (!res.ok) {
    throw new Error(
      json?.message || json?.error || `Fire Recovery login failed (HTTP ${res.status}).`,
    );
  }
  const token = trimValue(json?.LoginAndGetJWTTokenResult);
  if (!token) {
    throw new Error("Fire Recovery login did not return LoginAndGetJWTTokenResult.");
  }
  return token;
}

/**
 * Add NERIS Incident for Billing (vendor-preferred flow).
 * @param {string} jwt
 * @param {Record<string, unknown>} payload — buildNerisIncidentForBillingPayload output
 * @returns {Promise<{ trackingId: string, raw: unknown }>}
 */
export async function postAddNerisIncidentForBilling(jwt, payload) {
  const baseUrl = getFireRecoveryBaseUrl();
  const url = `${baseUrl.replace(/\/$/, "")}/Primary/restapi/rhpublicapi/flows/v2apis/incidents/rms/addincident`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Fire Recovery Add NERIS Incident for Billing returned non-JSON (HTTP ${res.status}).`,
    );
  }
  if (!res.ok) {
    const err =
      json?.Done?.error ||
      json?.message ||
      json?.error ||
      text.slice(0, 500) ||
      `HTTP ${res.status}`;
    throw new Error(String(err));
  }
  const trackingId = trimValue(json?.Done?.TrackingId);
  const apiResp = json?.Done?.["API Response"];
  if (!trackingId) {
    const msg =
      (apiResp && typeof apiResp === "object" && trimValue(apiResp.Message)) ||
      trimValue(json?.message) ||
      text.slice(0, 500) ||
      "Fire Recovery did not return Done.TrackingId.";
    throw new Error(msg);
  }
  return { trackingId, raw: json };
}

/**
 * @param {string} jwt
 * @param {string} trackingId
 * @returns {Promise<Record<string, unknown>>}
 */
export async function postIncidentBillingStatus(jwt, trackingId) {
  const baseUrl = getFireRecoveryBaseUrl();
  const url = `${baseUrl.replace(/\/$/, "")}/Primary/restapi/rhpublicapi/flows/incidentbillingstatus/getbillingstatusforincident`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      IncidentBillingStatus: {
        IncidentTrackingID: trackingId,
      },
    }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Fire Recovery billing status returned non-JSON (HTTP ${res.status}).`);
  }
  if (!res.ok) {
    const err = json?.Done?.error || json?.message || text.slice(0, 500) || `HTTP ${res.status}`;
    throw new Error(String(err));
  }
  const resp = json?.Done?.IncidentBillingStatusResponse;
  if (!resp || typeof resp !== "object") {
    throw new Error("Fire Recovery billing status missing Done.IncidentBillingStatusResponse.");
  }
  return /** @type {Record<string, unknown>} */ (resp);
}
