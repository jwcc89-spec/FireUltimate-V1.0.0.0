# Active Context Snapshot (submenu/neris-golive-cifpd)

## Current branch
- `submenu/neris-golive-cifpd`

## Current focus
- NERIS go-live for tenant cifpdil: live tenant creation, NERIS_BASE_URL switch to production, form fields alignment, and successful live report push.

## Latest known status
- Latest commit: `6c831b8` - Merge pull request #15 from jwcc89-spec/submenu/departmentdetails-ui
- Read submenu--departmentdetails-ui and submenu--neris-all ACTIVE_CONTEXT, session notes, and conversations (styling/routing + NERIS form/proxy, Department NERIS ID auto-fill from Admin Vendor/Department Code).
- Created plan: `agent-handoffs/branches/submenu--neris-golive-cifpd/docs/NERIS_GO_LIVE_CIFPDIL_PLAN.md` (live cifpdil tenant, NERIS URL same for all tenants, step-by-step directions).
- Patched `scripts/tenant-create.ts` to load `DATABASE_URL` from `.env` and `.env.server` (safer for Phase 1 tenant creation).
- Added docs: `docs/PHASE_1_CIFPDIL_TENANT_LIVE.md` and `docs/TENANTS_NERIS_AND_BRANCHES_EXPLAINED.md`; updated plan phases and verification wording.
- Executed Phase 1 discovery and tenant/domain updates against configured DB:
  - `cifpdil` tenant already existed and was `active`.
  - Added production domain `cifpdil.fireultimate.app` as `isPrimary: false`.
- Deferred to `Later` backlog: wildcard DNS onboarding and Cloudflare proxied-mode hardening (to run after live NERIS cutover stability).
- Added onboarding runbook: `docs/TENANT_ONBOARDING_CHECKLIST.md` for repeatable department setup (intake -> tenant/domain -> Render env -> NERIS checks -> first export).
- Phase A safety checks verified from terminal:
  - `https://cifpdil.fireultimate.app/api/neris/health` -> `hasDefaultEntityId: false` (fail-closed posture in prod).
  - `https://cifpdil.fireultimate.app/api/tenant/context` -> host resolves to `cifpdil`.
  - `https://cifpdil.fireultimate.app/api/neris/debug/entities` still does **not** include `FD17075450` (awaiting NERIS authorization mapping).
- Staging branch routing now points to `submenu/neris-golive-cifpd` and `cifpdil.staging.fireultimate.app` resolves to tenant `cifpdil`.
- Implemented code change in `src/App.tsx`: NERIS queue/export sample incidents are now demo-tenant only (non-demo/live tenants show empty-state guidance instead of fixture rows).
- End-of-session reminder: if staging `NERIS_BASE_URL` is temporarily switched away from `api-test`, switch it back before closeout.

## Current blocker / status
- No code blocker. Waiting on NERIS support to authorize entity `FD17075450` for client id `3f104b60-f7cf-437e-b79c-868fe6489f31`.
- Staging still shows missing NERIS credentials in health (`hasClientCredentials: false`) and still has a default entity id in that environment; staging env sync is pending.

## External dependency status
- NERIS production credentials (Entity ID, Client ID/Secret) must be obtained from NERIS for live API. DNS/SSL for cifpdil.fireultimate.app if not already in place.

## Recent key commits (latest first)
- `6c831b8` Merge pull request #15 from jwcc89-spec/submenu/departmentdetails-ui

## Next agent should do this first
1. Read `cursoragent-context.md`.
2. Read this file.
3. Read `docs/NERIS_GO_LIVE_CIFPDIL_PLAN.md` and **Phase 1 runbook:** `docs/PHASE_1_CIFPDIL_TENANT_LIVE.md`.
4. Read latest note in `agent-handoffs/branches/submenu--neris-golive-cifpd/sessions/`.
5. Confirm branch with user and execute next step:
   - Finish staging env sync (`api-test` base URL + client credentials, remove default entity fallback),
   - continue Phase B tenant-specific entity work,
   - then run live export checks when NERIS confirms authorization.
