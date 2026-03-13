# Incident API — Example requests (Step 3)

**Base URL (recommended):** `https://cifpdil.staging.fireultimate.app` for staging (no local proxy needed).  
**Local:** `http://localhost:8787` if running `npm run proxy` and testing locally.  
**Tenant:** The server resolves tenant from the request **Host** header. For staging use the same host as the base URL (e.g. `cifpdil.staging.fireultimate.app`). For local curl without custom domains, use `Host: localhost` (maps to **demo** tenant).

---

## 1. List incidents (GET)

Returns incidents for the current tenant. Soft-deleted are excluded unless `?includeDeleted=true`.

```bash
curl -s -X GET "https://cifpdil.staging.fireultimate.app/api/incidents" \
  -H "Content-Type: application/json"
```

**Success:** `200` and `{ "ok": true, "data": [ ... ] }`. `data` is an array of incident objects (each has `id`, `callNumber`, `incidentNumber`, `address`, etc.).

---

## 2. Create incident (POST)

Creates an incident; server assigns `id` (incident_id).

```bash
curl -s -X POST "https://cifpdil.staging.fireultimate.app/api/incidents" \
  -H "Content-Type: application/json" \
  -d '{
    "incidentNumber": "CAD-12345",
    "dispatchNumber": "D-12345",
    "incidentType": "Structure Fire",
    "priority": "3",
    "address": "123 Main St",
    "stillDistrict": "District 1",
    "assignedUnits": "E1, L1",
    "currentState": "Draft",
    "receivedAt": "12:00:00",
    "dispatchInfo": "Manual create from API test"
  }'
```

**Success:** `201` and `{ "ok": true, "data": { "id": "...", "callNumber": "...", ... } }`. Use `data.id` as the incident id (top left / URLs).

---

## 3. Get one incident (GET by id)

```bash
# Replace INCIDENT_ID with the id from create or list
curl -s -X GET "https://cifpdil.staging.fireultimate.app/api/incidents/INCIDENT_ID" \
  -H "Content-Type: application/json"
```

**Success:** `200` and `{ "ok": true, "data": { ... } }`. **404** if not found or wrong tenant.

---

## 4. Update incident (PATCH)

Partial update. Send only the fields you want to change.

```bash
curl -s -X PATCH "https://cifpdil.staging.fireultimate.app/api/incidents/INCIDENT_ID" \
  -H "Content-Type: application/json" \
  -d '{"address": "456 Oak Ave", "currentState": "Dispatched"}'
```

**Success:** `200` and `{ "ok": true, "data": { ... } }` with the updated incident.

---

## 5. Soft-delete (DELETE)

Sets `deletedAt` (and optional `deletedBy`, `deletedReason`). Incident stays in DB but is excluded from list unless `?includeDeleted=true`.

```bash
curl -s -X DELETE "https://cifpdil.staging.fireultimate.app/api/incidents/INCIDENT_ID" \
  -H "Content-Type: application/json" \
  -d '{"deletedBy": "admin", "deletedReason": "Duplicate"}'
```

**Success:** `200` and `{ "ok": true, "data": { ... } }` with `deletedAt` set.

---

## Quick test order

1. **List** (expect empty or existing): `GET /api/incidents`  
2. **Create** one: `POST /api/incidents` with body above  
3. **List** again: you should see the new incident  
4. **Get one**: `GET /api/incidents/<id-from-create>`  
5. **Update**: `PATCH /api/incidents/<id>` with a field change  
6. **List** with `?includeDeleted=true` after a delete to see soft-deleted items
