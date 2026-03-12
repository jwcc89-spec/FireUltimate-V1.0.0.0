# Active Context Snapshot (submenu/neris-golive-cifpd)

## Current branch
- `submenu/neris-golive-cifpd`

## Current focus
- NERIS go-live for tenant cifpdil: verify the newly implemented Incident setup + editable incident workflow in staging, then promote to production.

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
- Latest live endpoint checks (2026-03-11):
  - Staging `tenant/context`: OK (tenant resolves to `cifpdil`).
  - Staging `neris/health`: OK, `baseUrl=api-test`, `hasTenantEntityId=false`.
  - Staging `debug/entity-check?nerisId=FD17075450`: OK for entity query/path.
  - Production `tenant/context`: OK.
  - Production `neris/health`: OK (`baseUrl=api`).
  - Production `debug/entity-check`: **missing route** (`Cannot GET`) because production deploy still tracks `main` and branch work is not merged yet.
- Latest UX implementation status (this branch, not yet staging-verified by user):
  - Added `Incidents Setup` section under `Admin Functions -> Department Details`.
  - Added configurable option lists for `incidentType`, `priority`, `stillDistrict`, `currentState`, and `reportedBy` (when in dropdown mode).
  - Added `reportedBy` mode toggle (`fill-in` vs dropdown).
  - Added required/non-required checkboxes per Create Incident field.
  - `Create Incident` now opens a modal with all required go-live fields and supports partial save when fields are not marked required.
  - Incident Detail now provides editable input boxes for all requested fields with Save action.
  - `Incident #` display now resolves from `incidentNumber` (fallback to `callNumber`) in incident and NERIS queues.
  - NERIS form now seeds `incident_internal_id` from queue `incidentNumber`, and updates queue `incidentNumber`/`dispatchNumber` when those NERIS fields change.

## Current blocker / status
- No code blocker in local branch.
- NERIS support confirmed the production client/entity enrollment is active (`3f104b60-f7cf-437e-b79c-868fe6489f31` <-> `FD17075450`) and no pending vendor-side action remains.
- Deployment gate remains: production is behind branch changes until PR to `main` is merged and deployed.
- Product verification gate remains: staging user validation is still required for the new Incident setup/modal/detail edit flow before promotion.

## External dependency status
- Remaining dependencies are deployment/environment readiness only (staging/prod release + migration + final live credential sanity checks).

## Now vs Later
- **Now**:
  - confirm/save tenant entity source so staging `hasTenantEntityId=true`,
  - validate staging UX for:
    - Admin `Incidents Setup` configuration save/load,
    - Create Incident modal field behavior (required toggles + reportedBy mode),
    - Incident Detail edit + save behavior,
    - incident number linkage across Incidents queue, NERIS queue, and NERIS form,
  - run staging validate/export proof.
- **Later**:
  - move incident table preferences (column widths/order/visibility) to backend per-user persistence so settings sync across devices and browsers,
  - PR branch -> `main`, deploy production, verify production endpoints,
  - run first controlled production export and 24-48h stabilization monitoring.

## Last session (2026-03-12)
- Branch confirmed; preflight and continuity docs read.
- Lint and full build run: both pass.
- Confirmed Incident Detail editable inputs + Save are already implemented in `IncidentCallDetailPage` (App.tsx). GO_LIVE_CHECKPOINT “not yet built” wording is outdated for current code.
- Next: user confirms scope (accept as-is → staging validation) or requests scope changes; then staging entity config + UX validation + validate/export.

## Recent key commits (latest first)
- `894757f` updated cursavesinfo
- `f731957` docs: add architecture, data model, lifecycle, integrations; agent guardrails and project context
- `27a795b` remaining files not commit from auto cursor, go live plan etc

## Next agent should do this first
1. Read `cursoragent-context.md`.
2. Read this file.
3. Read:
   - `agent-handoffs/branches/submenu--neris-golive-cifpd/docs/NERIS_GO_LIVE_CIFPDIL_PLAN.md`
   - `agent-handoffs/branches/submenu--neris-golive-cifpd/docs/NERIS_WAITING_AND_POST_SUPPORT_STEPS.md`
   - `agent-handoffs/branches/submenu--neris-golive-cifpd/docs/NERIS_RENDER_SOURCE_OF_TRUTH.md`
   - `agent-handoffs/branches/submenu--neris-golive-cifpd/docs/GO_LIVE_CHECKPOINT_AND_NEXT_STEPS.md`
4. Read latest note in `agent-handoffs/branches/submenu--neris-golive-cifpd/sessions/`.
5. Confirm branch with user and execute next step:
   - Confirm mandatory Incident Detail editable input scope with user.
   - Implement in small batch, run lint, and validate staging click-to-edit + NERIS form flow.
   - Only after staging pass, proceed to PR/production promotion steps.
