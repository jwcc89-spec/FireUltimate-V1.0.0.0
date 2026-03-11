# Active Context Snapshot (submenu/neris-golive-cifpd)

## Current branch
- `submenu/neris-golive-cifpd`

## Current focus
- NERIS go-live for tenant cifpdil: live tenant creation, NERIS_BASE_URL switch to production, form fields alignment, and successful live report push.

## Latest known status
- Local working tree now contains uncommitted Phase B + queue plumbing changes in:
  - `server/neris-proxy.mjs`
  - `src/App.tsx`
  - `src/pages/NerisReportFormPage.tsx`
  - `prisma/schema.prisma`
  - `prisma/migrations/20260310120000_add_tenant_neris_entity_id/migration.sql`
- Implemented incident queue fix for live tenants:
  - `Incidents / Mapping | Incidents` now uses tenant-local queue storage (host-scoped localStorage key).
  - `Create Incident` now works and creates a live queue row, then opens incident detail.
  - `Reporting | NERIS` and `Reporting | NERIS | Exports` now read from the same queue source as Incidents.
  - Live tenants no longer show fixture sample rows in Incidents queue.
- Implemented Phase B tenant-scoped backend NERIS entity support:
  - Added `Tenant.nerisEntityId` (Prisma schema + SQL migration).
  - `POST /api/department-details` now syncs a valid entity ID into `Tenant.nerisEntityId` when present in payload.
  - Entity resolution for validate/export/debug now prioritizes tenant entity and fails closed for tenant traffic (no env fallback for tenant requests).
  - `/api/neris/health` now exposes `hasTenantEntityId`.
- Updated frontend error copy in `NerisReportFormPage` to point users to tenant-scoped Department Details entity config.
- Added step-by-step wait/after-support runbook:
  - `agent-handoffs/branches/submenu--neris-golive-cifpd/docs/NERIS_WAITING_AND_POST_SUPPORT_STEPS.md`
- Validation completed locally:
  - `npm run build` passes.
  - `node --check server/neris-proxy.mjs` passes.
  - `npx prisma generate` passes.

## Current blocker / status
- No code blocker in local branch.
- External blocker remains: waiting on NERIS support to authorize entity `FD17075450` for client id `3f104b60-f7cf-437e-b79c-868fe6489f31`.
- Needs deployment + migration apply on staging/prod before tenant DB-backed entity resolution is active in hosted env.

## External dependency status
- NERIS production credentials (Entity ID, Client ID/Secret) must be obtained from NERIS for live API. DNS/SSL for cifpdil.fireultimate.app if not already in place.

## Now vs Later
- **Now**: deploy Phase B changes + apply migration + verify queue workflow and health/debug endpoints in staging.
- **Later**: after NERIS confirms entity authorization, run staging export proof then controlled production export.

## Recent key commits (latest first)
- `6c831b8` Merge pull request #15 from jwcc89-spec/submenu/departmentdetails-ui

## Next agent should do this first
1. Read `cursoragent-context.md`.
2. Read this file.
3. Read `docs/NERIS_GO_LIVE_CIFPDIL_PLAN.md` and **Phase 1 runbook:** `docs/PHASE_1_CIFPDIL_TENANT_LIVE.md`.
4. Read latest note in `agent-handoffs/branches/submenu--neris-golive-cifpd/sessions/`.
5. Confirm branch with user and execute next step:
   - Deploy current working tree changes and run migration in target env.
   - Verify `GET /api/neris/health` reports `hasTenantEntityId` as expected per tenant.
   - Verify `Create Incident` + NERIS queue flow on `cifpdil.staging.fireultimate.app`.
   - Run live export checks immediately after NERIS confirms entity authorization.
