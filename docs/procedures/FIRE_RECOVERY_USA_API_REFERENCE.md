# Fire Recovery USA — API and integration reference

This document is the **project-local reference** for integrating Fire Ultimate with **Fire Recovery USA** (Recovery Hub billing). It complements [docs/integrations.md](../integrations.md).

**Primary vendor portal:** [https://doc.firerecoveryusa.com/](https://doc.firerecoveryusa.com/)

**Support:** [support@firerecoveryusa.com](mailto:support@firerecoveryusa.com)

**Scope note (product):** This repo’s near-term work targets **incident billing** flows. **Inspection billing** endpoints are listed briefly at the end for a later phase.

---

## Source of this content

The structured API details below were **captured from the Fire Recovery Postman / published API guide** (2026). If vendor URLs or fields change, update this file and the server integration together.

---

## Hosts and environments

| Environment | Base host (examples in vendor docs) |
|-------------|-------------------------------------|
| **Production** | `https://process.firerecoveryusa.com` |
| **Development / test** | `https://process-dev.firerecoveryusa.com` |

All paths below are appended to the base host (e.g. `.../Primary/REST/...`).

---

## Overview (vendor “Getting Started”)

- **Authentication:** Obtain a **JWT** via **LoginAndGetJWTToken**, then send **`Authorization: Bearer <token>`** on API calls.
- **Recovery Hub API:** Submit **incident** or **inspection** records for billing; on success you receive a **tracking ID** for follow-up (e.g. attachments).
- **Future / roadmap (vendor copy):** “Request billing status in upcoming release” appears in high-level feature bullets for submit flows; separate **Get … Billing Status** endpoints exist below for tracking invoice state.

---

## Authentication

### POST — Login and get JWT

| | |
|--|--|
| **Path** | `/Primary/REST/AccountService/LoginAndGetJWTToken` |
| **Method** | `POST` |
| **Auth** | **HTTP Basic** (username / password from vendor **Welcome** message) |
| **Body** | `Content-Type: text/plain` or as in Postman — JSON object with: `userName`, `password`, `outputtype` = `"Json"` |

**Success (200):** `Content-Type` text/json style; body shape:

```json
{"LoginAndGetJWTTokenResult":"<JWT_TOKEN_STRING>"}
```

**Errors:**

- **401** — Invalid username or password.
- **500** — Server error; retry or contact support.

**Operational notes (vendor):**

- JWT **expires in 7 days**.
- Vendor **recommends generating a token prior to each method call** to avoid expiry during submission.

### Subsequent requests

- Header: **`Authorization: Bearer <token>`**
- **Fire Ultimate:** JWT credentials come from **per-tenant** username/password (**Admin → Setup/Configuration → Fire Recovery**), not from `.env.server`.
- **Add NERIS Incident for Billing** uses Bearer auth only (no `SubscriptionKey` in the body). Some other vendor flows still reference **`SubscriptionKey`** in payloads.

---

## Incident billing (primary integration target)

### Important: legacy vs NERIS incident submit

Vendor documentation states:

- **`AddIncidentForBilling`** (`/Primary/restapi/RH/v2/AddIncidentForBilling`) is **to be deprecated (noted as 2025)**.
- **Fire Ultimate** submits incidents using **Add NERIS Incident for Billing** (below). Legacy `AddIncidentForBilling` is documented here for reference only.

### POST — Add NERIS Incident for Billing (implemented)

| | |
|--|--|
| **Path** | `/Primary/restapi/rhpublicapi/flows/v2apis/incidents/rms/addincident` |
| **Method** | `POST` |
| **Headers** | `Authorization: Bearer <JWT>`, `Content-Type: application/json` |

**Request body (top level):**

- `IncidentToBillPayload` (object)
  - `NERISDepartmentId` (string) — NERIS department identifier (this app uses the tenant **NERIS Entity ID**, e.g. `FD########`).
  - `DepartmentName` (string) — display name for the department.
  - `IncidentsToBill` (object)
    - `incident` (object)
      - `CostRecovery` (object): `PrincipleIncidentType`, `NerisIdIncident`, `IncidentNumber`, `LawEnforcementNumber`, `CatchCreated` (ISO 8601), `TotalPersonnelOnScene`, `FiledBy` (`First`, `Last`, `Middle`), `Parties` (array; may be empty).

**Success response (example shape):**

```json
{
  "Done": {
    "API Response": {
      "ErrorCode": null,
      "Status": 1,
      "Message": "Success"
    },
    "TrackingId": "79cb6800-7814-44ce-aefc-184d8c4ee5a7"
  }
}
```

The **`Done.TrackingId`** value is the **tracking ID** for follow-up (e.g. attachments / billing status), not `Done.id`.

### POST — Add Incident For Billing (legacy path documented)

| | |
|--|--|
| **Path** | `/Primary/restapi/RH/v2/AddIncidentForBilling` |
| **Method** | `POST` |
| **Headers** | `Authorization: Bearer <JWT>`, `Content-Type: application/json` |

**Request body (top level):**

- `IncidentPayloadRequest` (object)
  - `IncidentToBill` (object)
    - `SubscriptionKey` (string)
    - `DepartmentName` (string)
    - `Incident` (object) — large nested structure including:
      - `Location`: Zip, City, Address, State, LocationID
      - `FiledBy`: First, Last, Middle
      - `FirstUnitOnSceneDateTime`, `RespondingUnits[]` (units, actions, times, etc.)
      - `Stations`, `IncidentActionsTaken[]`, `Occupancydata`, `AlarmDateTime`, `IncidentNumber`, `IncidentType` (NFIRS code example e.g. `"322"`), `Narrative`, `Party[]`, and many optional fields (see vendor full schema)

**Success response (example shape):**

```json
{
  "Done": {
    "id": "5d1ba429-cde8-4f05-b511-1234567890",
    "message": "Request processed successfully."
  }
}
```

The **`id`** value is the **incident tracking ID** for attachments and billing status calls.

**Errors (example):**

- **401** — Invalid or expired token; or invalid subscription key (vendor example body may show `Done.code` / `Done.error` such as `"Invalid Subscription Key."`).

### POST — Add Incident Attachment For Billing

| | |
|--|--|
| **Path** | `/Primary/restapi/RH/v2/AddIncidentAttachmentForBilling` |
| **Method** | `POST` |
| **Headers** | `Authorization: Bearer <JWT>` |

**Body (vendor uses raw text / JSON with fields):**

- `outputtype`: `"Json"`
- `IncidentTrackingId`: string (from successful incident submit or lookup)
- `Attachments`: array of `{ "Id", "FileName", "Contents" }` where **Contents** is **base64** (vendor examples use image/PDF-style attachments).

**Success:** Vendor examples show a `Done.message` style confirmation (exact wrapper may vary — align with latest Postman response).

**Errors:**

- **404** — Tracking ID not found: e.g. “The provided Incident tracking ID is invalid.”

### POST — Get Incident Tracking Id

Use when you **do not already have** a tracking ID.

| | |
|--|--|
| **Path** | `/Primary/restapi/RH/v2/GetIncidentForBillingId` |
| **Method** | `POST` |
| **Headers** | `Authorization: Bearer <JWT>` |

**Body (text/JSON):**

- `outputtype`: `"Json"`
- `SubscriptionKey`
- `IncidentNumber`
- `AlarmDatetime` (ISO-style datetime string, e.g. `0001-01-01T00:00:00` in template)

**Success (example):**

```json
{
  "Data": {
    "id": "01f7a420-b27a-4814-a4e6-fc827dd29c32",
    "message": "Request processed successfully."
  }
}
```

**Errors:**

- **404** — e.g. “Incident Not Found. Invalid Incident Number or Alarm Date Time.”

### POST — Get Billing Status for Incident

| | |
|--|--|
| **Path** | `/Primary/restapi/rhpublicapi/flows/incidentbillingstatus/getbillingstatusforincident` |
| **Method** | `POST` |
| **Headers** | `Authorization: Bearer <JWT>`, `Content-Type: application/json` |

**Body:**

```json
{
  "IncidentBillingStatus": {
    "IncidentTrackingID": "<uuid>"
  }
}
```

**Success — `Done.IncidentBillingStatusResponse` fields (vendor):**

- `IncidentTrackingID`, `InvoiceID`, `InvoiceAmount`, `InvoiceAmountDue`, `InvoiceSubmitDate`, `InvoiceStatus`, `LastPaymentDate`, `LastPaymentAmount`, `PaymentPlan` (boolean)

### POST — Get Bulk Billing Status for Incidents

| | |
|--|--|
| **Path** | `/Primary/restapi/rhpublicapi/flows/incidentbillingstatus/getbillingstatusforincidents` |
| **Method** | `POST` |

**Body:**

```json
{
  "BulkIncidentBillingStatus": [
    { "IncidentTrackingID": "<uuid>" }
  ]
}
```

**Success:** `Done.BulkIncidentBillingStatusResponse` — array of per-incident status objects (same financial fields as single call; types may be strings in bulk responses per vendor examples).

---

## Inspection billing (defer — reference only)

Use these when the product is ready to support **inspection** cost recovery. Not required for the first **incident-only** milestone.

| Purpose | Path (under base host) |
|--------|-------------------------|
| Add Inspection For Billing | `/Primary/restapi/rhpublicapi/flows/v2apis/inspections/rms/addinspection` |
| Add Inspection Attachment For Billing | `/Primary/restapi/RH/v2/AddInspectionAttachmentForBilling` |
| Get Inspection Tracking Id | `/Primary/restapi/RH/v2/GetInspectionForBillingId` |
| Get Billing Status for Inspection | `/Primary/restapi/rhpublicapi/flows/inspectionbillingstatus/getbillingstatusforinspection` |
| Get Bulk Billing Status for Inspections | `/Primary/restapi/rhpublicapi/flows/inspectionbillingstatus/getbillingstatusforinspections` |

Inspection bodies are large (occupancy, person-to-bill, violations, fees, etc.). Copy the **current** schema from Postman when implementing this phase.

---

## How this affects the Fire Ultimate build

1. **Server-side JWT:** Cache or fetch JWT per Fire Recovery call (vendor suggests fresh token); store **API username/password** and optional **default base URL** in **`.env.server`**, not in `DepartmentDetails.payloadJson`.
2. **Tenant-visible settings:** **`SubscriptionKey`**, **`DepartmentName`**, and similar **non-secret** identifiers belong in **tenant-scoped** storage (e.g. `Tenant` fields / JSON) once approved — align with **Enable Features → Fire Recovery** UI.
3. **Mapping from NERIS:** Fire Ultimate’s NERIS export payload (`buildIncidentPayload` and form values) must be **mapped** into Fire Recovery’s `Incident` / `IncidentToBill` structure (field names differ from NERIS JSON).
4. **Prefer Add NERIS Incident for Billing** when confirmed with vendor; keep **legacy** path only if needed for transition.
5. **Attachments:** Optional follow-up calls with **base64** content; do not log full payloads in production logs (PHI).

---

## Related docs in this repo

- [docs/integrations.md](../integrations.md)
- [docs/incident-lifecycle.md](../incident-lifecycle.md)
- `server/neris-proxy.mjs`, `.env.server.example`

---

*Last updated: 2026-04-11 — Populated from Postman / API export (incident-first; inspection deferred).*
