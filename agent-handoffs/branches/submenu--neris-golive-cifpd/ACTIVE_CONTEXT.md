# Active Context Snapshot (submenu/neris-golive-cifpd)

## Current branch
- `submenu/neris-golive-cifpd`

## Current focus
- **CAD email ingest:** Verified (test to cifpdil@cad.fireultimate.app works; DB + Render). Next: switch Worker to production (B11 in EMAIL_AND_CAD_SETUP.md) before giving address to dispatch; waiting on sample CAD email for parsing/auto-fill.
- **NERIS cross-browser (Phase 1):** Implemented this session (2026-03-14). Export history is now stored on the server; app fetches on login and POSTs after each export. **User must run the migration once** — see `docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md` “Steps for you.” Phase 2 (drafts on server) is optional and not done.
- NERIS go-live for tenant cifpdil remains: staging verification, then production promotion when ready.

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
- No code blocker. Latest work (this session): Dispatch Parsing Settings (submenu, GET /api/cad/emails, page to view incoming CAD emails); NERIS Edit Times Clear button order fix (Enroute); doc updates (EMAIL_AND_CAD_SETUP, CAD_EMAIL_PARSING_AND_INCIDENT_AUTOCREATE_PLAN, task-2 plan). All committed and pushed.
- User must run migration `20260314000000_add_neris_export_history` once if not yet run (see NERIS_CROSS_BROWSER_FINDINGS.md).
- NERIS support confirmed production client/entity enrollment active. Deployment gate: production behind branch until PR to `main`; staging validation still required before promotion.

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

## Last session (2026-03-14)
- **NERIS cross-browser Phase 1:** Implemented server-side export history. Added `NerisExportHistory` table (Prisma + migration `20260314000000_add_neris_export_history`), GET/POST `/api/neris/export-history`, client API and App state; NERIS Exports/Details/Report Form use server data when available. Beginner-friendly “Steps for you” added to NERIS_CROSS_BROWSER_FINDINGS.md (run migration once; no commit/push this session per user).
- **Docs (earlier in conversation):** Consolidated three CAD/email guides into **EMAIL_AND_CAD_SETUP.md**; added B11 (Worker staging→production). GO_LIVE and PRIORITY refs updated. Two commits already pushed (docs; then GIT_WORKTREE, package files).

## Previous session (2026-03-12)
- Branch confirmed; preflight and continuity docs read. Lint and build pass. Incident Detail editable + Save confirmed in code. User testing plan and STAGING_TEST_CHECKLIST_DETAILED.md added. CAD email ingest Part 2+3 implemented (Worker, /api/cad/inbound-email, CadEmailIngest). NERIS cross-browser findings doc added; priority updated.

## Recent key commits (latest first)
- `f6f9bfc` Handoff: ACTIVE_CONTEXT recent commit hash
- `63e66a3` Dispatch Parsing Settings + doc/handoff updates (session end)
- `f3ac5ad` Edit Times: place Clear button to the right of each time header
- `eb4c21a` Edit Times: HH:mm:ss format + Clear buttons
- `527b292` NERIS Edit Times: validation rules + doc note
- `2911eca` Edit Times: fix cursor jumping; doc: where to view CAD emails

## Next-step checklist (detailed)

**Current priority:** See `docs/PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED.md`. CAD ingest verified; in-app email viewing (Dispatch Parsing Settings) implemented. NERIS cross-browser Phase 1 in branch (run migration if not done).

**CAD (you):** Switch Worker to production (EMAIL_AND_CAD_SETUP.md §B11); give cifpdil@cad.fireultimate.app to dispatch. View incoming emails in **Admin Functions → Dispatch Parsing Settings**. Parsing/auto-fill module to be built next (CAD_EMAIL_PARSING_AND_INCIDENT_AUTOCREATE_PLAN.md).

**NERIS cross-browser (you, once):** Run migration for Phase 1 — see `docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md` “Steps for you.” Use same DATABASE_URL as your API (e.g. Render); then redeploy API if needed. Test: export in Browser A, check NERIS Exports in Browser B.

**When ready:** Commit and push Phase 1 changes (prisma schema + migration, server routes, src/api/nerisExportHistory.ts, App.tsx wiring, NERIS_CROSS_BROWSER_FINDINGS.md).

**Staging/incident testing:** `docs/procedures/STAGING_TEST_CHECKLIST_DETAILED.md` (A1–A5). Incident Detail editable + Save already in code.

## Next agent should do this first
1. Read `.cursor/project-context.md` (or `cursoragent-context.md` if present).
2. Read this file (**ACTIVE_CONTEXT.md**).
3. Read **docs/PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED.md** and **docs/procedures/EMAIL_AND_CAD_SETUP.md** (and **docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md** if working on NERIS cross-browser).
4. Read **docs/agent-execution-contract.md**, **docs/task-2-multitenant-domain-plan.md**, **docs/later-changes-backlog.md** (see COPY_PASTE_START_PROMPT.md for full list).
5. Read latest note in **agent-handoffs/branches/submenu--neris-golive-cifpd/sessions/**.
6. Continue from user’s current blocker only (CAD deploy/Part 4, or NERIS cross-browser, or staging tests). Do not redo completed work.
