# Active Context Snapshot (submenu/neris-golive-cifpd)

## Current branch
- `submenu/neris-golive-cifpd`

## Current focus
- NERIS go-live for tenant cifpdil: complete staging validation and move to controlled production export using NERIS-confirmed entity/enrollment checks.

## Latest known status
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
- Updated backend debug flow to match NERIS support guidance:
  - `/api/neris/debug/entities` now clearly reports that `GET /entity` is a directory listing endpoint.
  - Added `/api/neris/debug/entity-check` to run:
    - `GET /entity?neris_id=<id>`
    - `GET /entity/<id>`
    - `GET /account/enrollment/<clientId>`
  - 403 troubleshooting now references entity IDs returned by `GET /entity` as informational, not canonical authorization truth.
- Updated branch runbooks/checklists to use `debug/entity-check` for entity verification.
- Validation completed locally:
  - `npm run lint` passes.
  - `node --check server/neris-proxy.mjs` passes.

## Current blocker / status
- No code blocker in local branch.
- NERIS support confirmed the production client/entity enrollment is active (`3f104b60-f7cf-437e-b79c-868fe6489f31` <-> `FD17075450`) and no pending vendor-side action remains.
- Needs deployment + migration apply on staging/prod before tenant DB-backed entity resolution is active in hosted env.

## External dependency status
- Remaining dependencies are deployment/environment readiness only (staging/prod release + migration + final live credential sanity checks).

## Now vs Later
- **Now**: deploy current branch, apply migration, verify `debug/entity-check`, queue workflow, and validate/export in staging.
- **Later**: run controlled first production export and 24-48h stabilization monitoring.

## Recent key commits (latest first)
- `b62238a` Implement tenant-scoped NERIS entity resolution and live incident queue wiring.
- `06f5ef8` Advance CIFPDIL NERIS go-live prep and tenant handoff docs.
- `6c831b8` Merge pull request #15 from jwcc89-spec/submenu/departmentdetails-ui

## Next agent should do this first
1. Read `cursoragent-context.md`.
2. Read this file.
3. Read `agent-handoffs/branches/submenu--neris-golive-cifpd/docs/NERIS_GO_LIVE_CIFPDIL_PLAN.md` and `agent-handoffs/branches/submenu--neris-golive-cifpd/docs/NERIS_WAITING_AND_POST_SUPPORT_STEPS.md`.
4. Read latest note in `agent-handoffs/branches/submenu--neris-golive-cifpd/sessions/`.
5. Confirm branch with user and execute next step:
   - Deploy current working tree changes and run migration in target env.
   - Verify `GET /api/neris/health` reports `hasTenantEntityId` as expected per tenant.
   - Verify `GET /api/neris/debug/entity-check?nerisId=FD17075450` on staging.
   - Verify `Create Incident` + NERIS queue flow on `cifpdil.staging.fireultimate.app`.
   - Run staged validate/export proof, then controlled production export.
