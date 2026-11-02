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
 * Obtain JWT using tenant-stored Fire Recovery login only (no .env fallback).
 * @param {{ username: string, password: string }} credentials
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function getFireRecoveryJwt(credentials, signal) {
  const u = trimValue(credentials?.username);
  const p = trimValue(credentials?.password);
  if (!u || !p) {
    throw new Error(
      "Fire Recovery username and password must be set for this tenant under Admin Functions → Setup/Configuration → Fire Recovery.",
    );
  }
  const cred = { username: u, password: p };
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
    signal,
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
 * Add NERIS Incident for Billing. Returns the raw HTTP result so the caller can
 * mark Sent, Failed, or Needs review without treating every error as a failed bill.
 * @param {string} jwt
 * @param {Record<string, unknown>} payload
 * @param {number} [timeoutMs]
 */
export async function postAddNerisIncidentForBilling(jwt, payload, timeoutMs = 45000) {
  const baseUrl = getFireRecoveryBaseUrl();
  const url = `${baseUrl.replace(/\/$/, "")}/Primary/restapi/rhpublicapi/flows/v2apis/incidents/rms/addincident`;
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: timeout,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { httpStatus: res.status, json, timedOut: false, networkError: false };
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return { httpStatus: 0, json: null, timedOut, networkError: !timedOut };
  }
}

/**
 * @param {string} jwt
 * @param {string} trackingId
 * @returns {Promise<Record<string, unknown>>}
 */
export async function postIncidentBillingStatus(jwt, trackingId, timeoutMs = 45000) {
  const baseUrl = getFireRecoveryBaseUrl();
  const url = `${baseUrl.replace(/\/$/, "")}/Primary/restapi/rhpublicapi/flows/incidentbillingstatus/getbillingstatusforincident`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
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
