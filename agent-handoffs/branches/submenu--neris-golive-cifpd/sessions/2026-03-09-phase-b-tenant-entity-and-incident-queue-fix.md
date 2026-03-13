# Session Note - Phase B tenant entity support + live queue wiring

## Branch
- `submenu/neris-golive-cifpd`

## Why this session happened
- User reported two immediate blockers:
  - `Create Incident` button did not work in `Incidents / Mapping | Incidents`.
  - Incident queue expectations: NERIS queue should reflect real incidents, not sample fixtures.
- User then stepped away and asked agent to continue through Phase B backend tenant entity support.

## What was changed

### 1) Incident queue and Create Incident flow (frontend)
- File: `src/App.tsx`
- Added host-scoped live queue storage:
  - `INCIDENT_QUEUE_STORAGE_KEY_PREFIX`
  - `getIncidentQueueStorageKey()`
  - `readIncidentQueue()` / `writeIncidentQueue()`
  - `normalizeIncidentSummary()`
- Added app-level incident state and creation handler:
  - `incidentCalls` state in `App()`
  - `handleCreateIncidentCall()` generates a unique `I-YYYYMMDD-HHMMSS` incident id and pushes a new row.
- Wired route and page props so Incidents and NERIS pages share same queue source:
  - `RouteResolver` now receives `incidentCalls` + `onCreateIncidentCall`.
  - `IncidentsListPage`, `NerisReportingPage`, `NerisExportsPage`, and details pages use shared queue data for live tenants.
- Fixed non-functional button:
  - `Create Incident` now has `onClick={handleCreateIncident}` and navigates to the newly created incident.
- Kept demo behavior:
  - demo tenants still use `INCIDENT_CALLS` fixtures.
  - live tenants use queue storage and no longer show sample rows in Incidents queue.

### 2) Phase B backend tenant-scoped NERIS entity support
- File: `server/neris-proxy.mjs`
- Added tenant-scoped DB-backed entity flow:
  - `resolveTenantEntityId()` now reads `Tenant.nerisEntityId` first.
  - Backward-compatible fallback reads from Department Details payload JSON (`vendorCode`, `nerisEntityId`, etc.), and backfills `Tenant.nerisEntityId`.
- Fail-closed behavior retained for tenant traffic:
  - `resolveEntityIdFromRequest()` does **not** fallback to global env entity when tenant context exists.
  - validate/export/debug endpoints use tenant-aware resolution.
- Department details write sync:
  - `POST /api/department-details` now syncs valid payload-derived entity IDs into `Tenant.nerisEntityId`.
- Health endpoint:
  - `GET /api/neris/health` now returns `hasTenantEntityId`.
- Admin tenant create:
  - optional `nerisEntityId` accepted + validated on `POST /api/admin/tenants`.
- Tenant context object:
  - middleware now includes `nerisEntityId` on `request.tenant`.

### 3) Prisma data model and migration
- File: `prisma/schema.prisma`
  - Added optional `Tenant.nerisEntityId String?`.
- File: `prisma/migrations/20260310120000_add_tenant_neris_entity_id/migration.sql`
  - `ALTER TABLE "Tenant" ADD COLUMN "nerisEntityId" TEXT;`

### 4) Error messaging cleanup
- File: `src/pages/NerisReportFormPage.tsx`
- Updated missing entity guidance to tenant-scoped wording:
  - points to Department Details or explicit `integration.entityId`.

## Validation run
- `npm run build` -> passed.
- `node --check server/neris-proxy.mjs` -> passed.
- `npx prisma generate` -> passed.
- `ReadLints` for touched frontend files -> no lints.

## Now vs Later

### NOW (while waiting on NERIS support)
- Deploy this branch to staging and apply migration `20260310120000_add_tenant_neris_entity_id`.
- Verify `Create Incident` and queue mirroring between Incidents and NERIS pages.
- Verify `/api/neris/health` (`hasClientCredentials`, `hasDefaultEntityId:false`, `hasTenantEntityId`).
- Continue daily `/api/neris/debug/entities` check for `FD17075450`.
- Use runbook: `docs/NERIS_WAITING_AND_POST_SUPPORT_STEPS.md`.

### LATER (after NERIS confirms authorization)
- Reconfirm entity appears in `accessibleEntityIds`.
- Execute staging validate/export proof.
- Run controlled first production export for `cifpdil`.
- Monitor and verify via debug incident retrieval checks.

