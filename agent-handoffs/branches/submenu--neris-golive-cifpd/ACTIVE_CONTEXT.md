# Active Context Snapshot (submenu/neris-golive-cifpd)

## Current branch
- `submenu/neris-golive-cifpd`

## Current focus (2026-03-20)
- **Personnel Schedule (2026-03-19):** Segmentation + per-segment OT + OT roster filter + duplicate-segment grey-out + calendar/qual fixes committed on this branch. Spec: `docs/plans/SCHEDULE_OVERTIME_IMPLEMENTATION_SPEC.md`. Session: `sessions/2026-03-19-schedule-segmentation-ux-session-end.md`.
- **CAD:** **Receiving** path verified (emails stored). **Next:** parsing / auto-create incident (`#29`, `CAD_EMAIL_PARSING_AND_INCIDENT_AUTOCREATE_PLAN.md`). **Then** point Worker `CAD_INGEST_API_URL` to production (B11 in `EMAIL_AND_CAD_SETUP.md`).
- **NERIS cross-browser:** Phases 1–3 done. **View Exports Report Status** complete (staging): list shows **Exported** after successful submit, matches queue. See `NERIS_CROSS_BROWSER_FINDINGS.md`.
- **Incident Detail:** Go-live item #1 verified — edits persist via API across browsers.
- NERIS go-live for tenant cifpdil: continue staging/prod promotion as planned.

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
- **NERIS Resources module (2026-03):** Resources list now shows **only incident-assigned apparatus** (not all department apparatus). Default list is built from `incidentAssignedResourceUnitOptions` (detail.apparatus + parseAssignedUnits(detail.assignedUnits)); Add-unit dropdown still offers full department list. Effect that applied default resource units now runs **once per incident** when there is no persisted draft (`hasAppliedDefaultResourceUnitsForCall` ref); it no longer overwrites state after delete or expand/collapse, so delete removes the unit and the arrow toggle works.
- **Incident Detail lock when NERIS In Review/Exported:** When the NERIS report for an incident is In Review or Exported, Edit Incident (Incident Detail) is now locked: Assigned Units and all other incident fields are read-only or disabled; Save and Delete are disabled; a message explains that editing is locked until the report is back to Draft. Uses `readNerisDraft(callNumber)?.reportStatus` in `IncidentCallDetailPage` (`App.tsx`).

## Current blocker / status
- No code blocker. **2026-03-20:** Docs + `App.tsx` View Exports Report Status fix committed on this branch; verify in two browsers after deploy.
- User chose Option B: Worker stays on staging until parsing is dialed in; then switch `CAD_INGEST_API_URL` to production.
- User must run migration `20260314000000_add_neris_export_history` once if not yet run (see NERIS_CROSS_BROWSER_FINDINGS.md).
- NERIS support confirmed production client/entity enrollment active. Deployment gate: production behind branch until PR to `main`; staging validation still required before promotion.

## External dependency status
- Remaining dependencies are deployment/environment readiness only (staging/prod release + migration + final live credential sanity checks).

## Now vs Later
- **Now**:
  - Commit + push 2026-03-18 work (local-only CORE + docs) on `submenu/neris-golive-cifpd`,
  - confirm/save tenant entity source so staging `hasTenantEntityId=true`,
  - validate staging UX (Incidents Setup, Create Incident, Incident Detail, NERIS aid list with locals),
  - run staging validate/export proof,
  - dial in CAD email parsing (Dispatch Parsing Settings shows extracted dispatch content).
- **Later**:
  - Aid: exclude/grey tenant’s own FD in CORE list (#8); optional server allowlist check on export,
  - switch Worker **CAD_INGEST_API_URL** to production when parsing ready (per user choice),
  - move incident table preferences to backend per-user persistence,
  - PR branch -> `main`, deploy production, verify production endpoints,
  - run first controlled production export and 24-48h stabilization monitoring.

## Last session (2026-03-19 — Personnel Schedule segmentation)
- **Scope:** Timed segments per apparatus/support slot, `ScheduleSegment.overtime`, full OT roster (`name`+`shift` in Scheduler Personnel), qualification + calendar behavior for segmented slots, red **×** segment remove, **greyed** shift-dropdown options when a person is already on another segment of the same slot (OT segment uses full roster), drag-drop aligned with same rule, removed visible **“Segment”** label (tooltip + `aria-label` remain).
- **Files (high level):** `PersonnelSchedulePage.tsx`, `PersonnelScheduleDayBlockModal.tsx`, `scheduleUtils.ts`, `scheduleStorage.ts`, `scheduleDomain.ts`, `App.css`, `App.tsx`; docs: `SCHEDULE_OVERTIME_IMPLEMENTATION_SPEC.md`, `task-2-multitenant-domain-plan.md` (pointer), `seed-and-tenant-reference.md`, `TENANT_ONBOARDING_CHECKLIST.md` (scheduler bullets).
- **Verify:** `npm run lint`, `npm run build`.

## Previous session (Incident lock when NERIS In Review/Exported)
- **Edit Incident lock:** When NERIS report is In Review or Exported, Incident Detail form is locked: Assigned Units (and all fields) read-only/disabled; Save and Delete disabled; message shown. File: `App.tsx` (`IncidentCallDetailPage`). User to test: set a report to In Review or Exported, open that incident’s Edit Incident — form and apparatus add/remove should be locked.

## Previous session (2026-03-12 — handoff only)
- **COPY_PASTE_START_PROMPT:** Expanded so “read the COPY_PASTE_START_PROMPT for this branch” fully orients a new agent. Added numbered doc list (1–15), BACKLOG_INCIDENTS_NERIS_UX, GO_LIVE_CHECKPOINT, ROLE_HIERARCHY; “when touching” architecture/data/incidents/integrations; branch rules aligned. Commit `c210d42` pushed. Session note: `sessions/2026-03-12-copy-paste-start-prompt-handoff.md`. Summary: `conversations/2026-03-12-copy-paste-start-prompt-session-summary.md`.

## Previous session (2026-03-18)
- **NERIS CORE Aid department:** (1) Confirmed name-only labels in UI; export still uses FD/FM ID (commit `f757f52`). (2) **Local-only mutual aid** in CORE: Department Details local-only rows now appear in "Aid department name(s)" dropdown; `readConfiguredMutualAidAidDepartmentOptions()` in `mutualAidAllowlist.ts`; synthetic `LOCAL_AID_OPT:*` value (not sent as `department_neris_id`). (3) Docs: PRIORITY (11.3a–d, session summary), BACKLOG (status on aid/FIRE/24h), task-2 pointer, session handoff; conversation summary in `conversations/2026-03-18-session-summary.md`.
- **Uncommitted (before end-of-session commit):** `src/mutualAidAllowlist.ts`, `src/pages/NerisReportFormPage.tsx` (local-only); PRIORITY, BACKLOG, task-2, sessions/2026-03-18-mutual-aid-department-details.md.

## Previous session (2026-03-16)
- **CAD email UI:** Decode base64; extract plain-text dispatch content from MIME so Dispatch Parsing Settings shows usable CAD text first.
- **Docs/scripts:** CREATE_SUPERADMIN_PRODUCTION.md + create-superadmin.ts; STAGING_VS_PROD; GIT_WORKTREE Option A/B. User chose Option B (Worker on staging until parsing ready).

## Previous session (2026-03-14)
- **NERIS cross-browser Phase 1:** Implemented server-side export history. Added `NerisExportHistory` table (Prisma + migration `20260314000000_add_neris_export_history`), GET/POST `/api/neris/export-history`, client API and App state; NERIS Exports/Details/Report Form use server data when available. Beginner-friendly “Steps for you” added to NERIS_CROSS_BROWSER_FINDINGS.md (run migration once; no commit/push this session per user).
- **Docs (earlier in conversation):** Consolidated three CAD/email guides into **EMAIL_AND_CAD_SETUP.md**; added B11 (Worker staging→production). GO_LIVE and PRIORITY refs updated. Two commits already pushed (docs; then GIT_WORKTREE, package files).

## Previous session (2026-03-12)
- Branch confirmed; preflight and continuity docs read. Lint and build pass. Incident Detail editable + Save confirmed in code. User testing plan and STAGING_TEST_CHECKLIST_DETAILED.md added. CAD email ingest Part 2+3 implemented (Worker, /api/cad/inbound-email, CadEmailIngest). NERIS cross-browser findings doc added; priority updated.

## Recent key commits (latest first)
- `2507a93` feat(schedule): segmentation, OT roster, duplicate grey-out, handoff docs
- `c210d42` docs(handoff): expand COPY_PASTE_START_PROMPT with full doc list and when-to-read
- `f757f52` NERIS CORE: aid department dropdown shows name only (export still uses FD ID)
- `4f65b55` feat(ui): extract plain-text dispatch content from MIME base64 in CAD emails
- `162b38c` feat(docs+ui): CAD email decode, superadmin script, staging vs prod notes
- `f6f9bfc` Handoff: ACTIVE_CONTEXT recent commit hash
- `63e66a3` Dispatch Parsing Settings + doc/handoff updates (session end)
- `f3ac5ad` Edit Times: place Clear button to the right of each time header
- `eb4c21a` Edit Times: HH:mm:ss format + Clear buttons
- `527b292` NERIS Edit Times: validation rules + doc note
- `2911eca` Edit Times: fix cursor jumping; doc: where to view CAD emails

## Next-step checklist (detailed)

**Current priority:** See `docs/PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED.md`. CAD ingest verified; in-app email viewing (Dispatch Parsing Settings) implemented. NERIS cross-browser Phase 1 in branch (run migration if not done).

**CAD (you):** For now Worker stays on staging (Option B) until parsing is dialed in; then set CAD_INGEST_API_URL to production (EMAIL_AND_CAD_SETUP.md §B11). View incoming emails in **Admin Functions → Dispatch Parsing Settings** (dispatch content now extracted from MIME). Parsing/auto-fill module next (CAD_EMAIL_PARSING_AND_INCIDENT_AUTOCREATE_PLAN.md).

**NERIS cross-browser (you, once):** Run migration for Phase 1 — see `docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md` “Steps for you.” Use same DATABASE_URL as your API (e.g. Render); then redeploy API if needed. Test: export in Browser A, check NERIS Exports in Browser B.

**When ready:** Commit and push Phase 1 changes (prisma schema + migration, server routes, src/api/nerisExportHistory.ts, App.tsx wiring, NERIS_CROSS_BROWSER_FINDINGS.md).

**Staging/incident testing:** `docs/procedures/STAGING_TEST_CHECKLIST_DETAILED.md` (A1–A5). Incident Detail editable + Save already in code.

## Next agent should do this first
1. Read **COPY_PASTE_START_PROMPT.md** (or user message: “read the COPY_PASTE_START_PROMPT for this branch”), then the docs it lists.
2. Read `.cursor/project-context.md` (or `cursoragent-context.md` if present) and this file (**ACTIVE_CONTEXT.md**).
3. Read **docs/PRIORITY_WHAT_NEEDS_TO_BE_COMPLETED.md** and **docs/procedures/EMAIL_AND_CAD_SETUP.md** (and **docs/procedures/NERIS_CROSS_BROWSER_FINDINGS.md** if working on NERIS cross-browser).
4. Read **docs/agent-execution-contract.md**, **docs/task-2-multitenant-domain-plan.md**, **docs/later-changes-backlog.md** (see COPY_PASTE_START_PROMPT.md for full list).
5. Read **sessions/2026-03-12-copy-paste-start-prompt-handoff.md** and **conversations/2026-03-12-copy-paste-start-prompt-session-summary.md** (and earlier sessions/conversations as needed).
6. Continue from user’s current blocker only (CAD, NERIS cross-browser, staging tests, or next PRIORITY item). Do not redo completed work.
