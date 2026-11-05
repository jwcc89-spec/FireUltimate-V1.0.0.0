# Active Context Snapshot (cursor/stage-b-foundation-b5ff)

## System overview (read this first)
- **Platform:** FireUltimate — multi-tenant fire department operations.
- **Architecture:** React frontend (Vite), Node Express backend (`server/neris-proxy.mjs`), PostgreSQL via Prisma 7.10.1. Do not upgrade Prisma.
- **Tenancy:** All tenant data is scoped by `tenantId`. Localhost requests resolve to the `demo` tenant. Tenant is otherwise resolved from the Host header.
- **Details:** See `docs/system_architecture.md` and `docs/data_model.md`.
- **Time format:** All time inputs and displays are 24-hour (military) app-wide.

## Current branch
- `cursor/stage-b-foundation-b5ff` (practice/work branch). Folder slug: `cursor--stage-b-foundation-b5ff`.
- Created from `submenu/neris-golive-cifpd`. Pull request 31 is **merged** into that staging branch: https://github.com/jwcc89-spec/FireUltimate-V1.0.0.0/pull/31. Merge commit `d4bbaee` (2026-11-01, about 1:33 p.m. America/Chicago). The base was `submenu/neris-golive-cifpd`, never `main`.
- Staging runs `submenu/neris-golive-cifpd` (includes weekday/security tip through `b52c3a4` and later). Production `main` is at `6efda0e` (PR #37, 2026-11-04). This practice branch is for Fire Recovery Wave 7/8 notes; do not rebuild Stage B.
- `main` already has Stage B and Stage C Fire Recovery *code*. Leave billing off. Do not set `FIRE_RECOVERY_MODE` or create `FIRE_RECOVERY_CREDENTIAL_KEY` until Wave 7/8.

## Current focus
- **Location follow-up (2026-11-02, late morning America/Chicago).** Incident location has one state and one ZIP. Country and county are in that section. Country defaults to US. State/Territory and Postal code are hidden, and the NERIS payload still gets state, postal code, country, and county. The Motor Vehicle Collision NERIS code box is hidden and uses the Core primary incident type. Incident 12345 first returned 400 because the demo tenant had no NERIS Entity ID. The operator then set it and exported successfully: status Exported, last attempt 201 Created at 11:14:04 America/Chicago. The NERIS Entity ID screen is Admin Functions → Setup/Configuration → NERIS Configuration → NERIS Export Configuration. It is not under a menu named Department Details.
- **Stage C Wave 6 is done on this practice branch (2026-11-02, late morning America/Chicago).** `server/fireRecovery.test.mjs` uses a local pretend vendor. `npm test` passed 44 tests against local `fu_session_test` only. Do not start Wave 5b. Wave 7 is the operator's staging sandbox test in §11.2 of the Phase C plan. Do not click Confirm and send on this Mac. Do not create `FIRE_RECOVERY_CREDENTIAL_KEY` or `FIRE_RECOVERY_MODE` on Render until the operator does Wave 7.
- **Stage C Wave 5 is done on this practice branch (2026-11-02, morning America/Chicago).** Export Details has Preview & Send, an admin Resolve review window, and billing statuses. Core dispatch and incident lines are locked and built from street, city, state, and ZIP. Those four fields collapse with an arrow and sit on two lines. Same as dispatch is beside the Incident location label. Do not click Confirm and send on this Mac. Do not create `FIRE_RECOVERY_CREDENTIAL_KEY` or `FIRE_RECOVERY_MODE` on Render until Wave 7.
- **Security docs hybrid (2026-11-01):** Live open work only → `docs/plans/security-remediation-plan.md`. Completed Parts 0–2B / staging Part 5 / verification snapshots → `docs/completed/SECURITY_REMEDIATION_ARCHIVE_2026-11.md` (frozen; do not treat as the work list).
- **Crescent staging click test passed** on 2026-11-01, about 2:09 p.m. America/Chicago. Stage B is on staging and on production (PR #37 / `6efda0e`, 2026-11-04). Live status: `docs/plans/security-remediation-plan.md`.
- Part 5 staging done 2026-11-01. Part 5 production done 2026-11-04. Backups `backup-2026-11-01-before-stage-b` and `backup-2026-11-04-before-production-weekday` — leave alone. Staging and production build command: `npm ci --engine-strict=false && npm run build`. Do not add a dashboard `NODE_ENV` variable. Do not upgrade Node/Prisma.
- Allowed Senders is on **staging** with Crescent sender `dispatch@co.iroquois.il.us` (id `allow-cifpdil-dispatch-20261101`) — do not delete. Production Crescent allowlist was empty after the 2026-11-04 promote — add before CAD ingest is used. CAD mailbox **`cifpdil@cad.fireultimate.app`**.
- Part 0 / fix 15 **done** (PRs #32 / #33). Fixes 1–14 and Part 3 (5–7) on staging and production — do not rebuild. No Fire Recovery password in production until Wave 7/8. Fix 16 Stage C (not built). Fix 17 = 15-minute lock.
- **Part 4 is deferred** with restrictions in the live security plan.
- Repair plan canvas (live): https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/3b7445ce-b395-4e16-b948-f84dab1ca136
- Repair plan source in the repo: `docs/plans/canvases/repair-plan.canvas.tsx`. The repo copy was updated on 2026-11-01 to say Stage B is on staging. The live canvas was not republished. Republish only if the user asks, using canvas id `3b7445ce-b395-4e16-b948-f84dab1ca136` and the full repo file. Omit the title so "Fire Ultimate repair plan" stays.
- Design canvas (older, not the working plan): https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/a9d0e635-88a9-45c5-89c8-ab93873f7618
- Latest session note: `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/2026-11-02-wave-5-preview.md`
- Latest user summary: `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/conversations/2026-11-01-session-summary.md`
- Older notes through 2026-10-31 stay as the record of those days. Trust this file and the security-plan Status line over any "not released" sentence in an older note.
- Start prompt for the next agent: `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/COPY_PASTE_START_PROMPT.md`

## Latest known status
- Read `git log -1` after pull. Production tip is `6efda0e` on `main`. Do not rebuild the Allowed Senders screen, Part 0, or fixes 1–14.
- Stage A (Steps 1–4) complete. Stage B Steps 5, 6, 7, 8, 9, 9A, and 9B were click-tested on the practice site on October 31, 2026, and on Crescent staging on November 1, 2026 (America/Chicago).
- GitHub Actions (`.github/workflows/ci.yml`) runs lint, build, and `npm test` on Node 20.19.0 against throwaway Postgres. Install is `npm ci --engine-strict=false` because `@prisma/streams-local` (unused by the app) wants Node 22 and `.npmrc` has `engine-strict=true`. Do not change that flag. Do not upgrade Prisma. If Render is still on Node 20 at release, its install needs the same flag.
- `npm test` is CAD unit tests plus `server/auth/sessions.test.mjs`. It refuses any database that is not `postgresql://fu:fu@127.0.0.1:5432/fu_session_test?sslmode=disable`. Never point tests at Neon.

## What the October 31 click-through confirmed
The user tested on the remote desktop browser at `http://localhost:5173` (Vite). Do not send them to port 8787 for the screens; 8787 serves the API and a stale `dist` unless rebuilt.

Passed, and the user said so:
- Change history on a fresh report lists only the field they edited, with readable labels (no underscores). History stores field names, not old/new text.
- Deleting a report removes it from Reporting → NERIS. The incident stays on the Incidents tab. The button label in code is **Open NERIS report**.
- Two-browser save conflict opens a dialog titled **This report was not saved**, with the approved sentence and a Reload button.
- Admin Functions → Customization: editing an existing dispatch workflow state accepts continuous typing.
- Dashboard **Edit display** is at the top right next to Open Calendar and Open Incidents. Any signed-in user can hide Active Calls, Units Available, Pending Reports, Unread Messages, Priority Shortcuts, and Live Alerts. The choice is this computer only (`localStorage` key `fire-ultimate-dashboard-hidden-widgets`). The four stat cards and Live Alerts are sample numbers in `src/appData.ts`. Priority Shortcuts are real routes, still a hideable widget.
- Saving the NERIS Entity ID in Admin Functions fills that ID on the report. This changed the **practice demo tenant only**. Do not revert it. Do not treat it as a change to Crescent.
- Idle sign-out is 60 minutes. Five wrong passwords shows: "Too many failed sign-in attempts. Try again in 15 minutes."

## Practice runtime (this cloud VM)
- Repo: `/workspace`. Branch: `cursor/stage-b-foundation-b5ff`.
- Gitignored `.env.server`: NERIS secrets empty; `DATABASE_URL=postgresql://fu:fu@127.0.0.1:5432/fu_practice?sslmode=disable`. Do not commit `.env.server`. Do not run seed against production or staging.
- tmux session `fu-dev`: Vite on `localhost:5173`. tmux session `fu-proxy`: `npm run proxy` on port 8787. Both were HTTP 200 at the end of the October 31 session. The proxy was restarted once to clear an in-memory login lock. Leave them running.
- This Mac’s `.env.server` points the local API at the staging Neon database. `http://localhost:5173` is the demo department on that database. Username `demo` is an admin there. The saved password is the staging password for that account, and it is not the word `demo`. Do not run `npm run db:seed` against this file; seed would also reset the Crescent admin password. Do not ask the user to paste the password. The user cannot paste into the terminal. If a server is down, the agent fixes it.
- Lockout lives in memory in `server/auth/sessions.mjs` (`loginFailures` Map), not in the database. Restarting the practice proxy clears it and signs people out. Do not restart unless a lock or a crash requires it.
- curl to `127.0.0.1:8787` for a mutating request needs `Origin: http://127.0.0.1:8787` or the server returns 403 "This action must come from the department's own website." Vite listens on `::1:5173`; `curl http://127.0.0.1:5173` can fail while `http://localhost:5173` works. `ss` is not installed; use curl. `/api/health` returning 401 means the proxy is up and auth is on.
- After a client change, tell the user to reload `http://localhost:5173` once.

## Current blocker / status
- Stage B is on staging and production. Next open Fire Recovery work is Wave 7 staging sandbox. Do not add a dashboard `NODE_ENV` variable.
- Session / RolePermission / AccountAuditLog / NerisReportChange / Fire Recovery submit status / TradeRequest / QualificationOverrideRequest exist on staging and production. They are add-only.
- Do not set `TRUST_PROXY=1` until Render is confirmed to replace `X-Forwarded-Host`.
- Do not add `NODE_ENV` as a Render dashboard variable. Render sets `NODE_ENV=production` for the running server only. A dashboard copy is present during `npm install` and the build fails. Keep the admin and demo accounts.
- Do not store auth secrets in `DepartmentDetails.payloadJson`.
- Fire Recovery tests, when they start, use sandbox department ID `FD12345678` only.

## Parked — do not build unless the user asks
Recorded October 31, 2026 on the repair plan (Decisions and Parked & future):
1. **Recover Reports.** Button on Reporting → NERIS, next to Fire Recovery and View Exports. Restores a deleted report with every typed answer. The incident already stays. Do not build it now.
2. **Incident Status is unit status.** On an open incident, Status uses the built-in list Draft, Dispatched, Enroute, On scene, Cleared (`DEFAULT_INCIDENTS_SETUP_CONFIG.currentStateOptions` in `src/App.tsx`, about line 933). New incidents start on Draft. This is not NERIS report status (Draft / In Review / Exported) and it is not the dispatch workflow list in `src/appData.ts` (`DEFAULT_DISPATCH_WORKFLOW_STATES`: Dispatched, Enroute, On scene, Transport, Cleared). Draft should not be a choice. Do not change it while starting Stage C.
3. **Incidents → Configure Table** drag-and-drop does not work (button near `src/App.tsx` line 4331). Column layout stays on each computer.
4. **Submenu Display Settings.** Unchecking a box in Admin Functions → Customization → Submenu Display Settings should hide that item from the **left menu**. Today `submenuVisibility` only filters menu-page cards and Edit Display (`src/App.tsx` about 3501–3522). The left sidebar (`visibleSubmenus`, about 3262) filters by admin role and scheduler, not by those checkboxes. Edit Display on the submenu cards stays the control for cards on the page.
5. **Canceled en route times.** Found 2026-11-01 on Crescent staging, during the Stage B click test. On a NERIS report, Resources, checking **Dispatched and canceled en route** should fill Dispatch Time, Canceled Time, and Clear Time with the call arrival time from Incident Times. It did not. The operator typed the times and continued. Do not build this until asked.
6. **Edit My Display is this browser, not this person.** Found 2026-11-01 on Crescent staging. Dashboard Edit My Display stayed after logout and also appeared for `admin1` in the same browser. A different browser did not have those choices. Save the choices for the signed-in person on the server, so a shared computer does not keep the previous person's display and the same person does not have to set it again on another computer. Do not build this until asked. The gear → Edit My Display choice is still local until then.

## Data the click-through left behind (practice demo tenant only)
- **26-Test** still has a real Draft (not removed). Its older history line still lists the original first-save auto-fill fields, now with readable labels. New saves do not list auto-fill.
- **Test Incident** and **Incident 27 Test** were deleted by an earlier build that wiped `formValues`. They are `reportRemoved: true` with empty `formValues`. Those typed answers **cannot be restored**. Later deletes keep the previous payload (see `removedReportPayload` in `server/neris-proxy.mjs`).
- Opening a removed report shows incident auto-fill plus an off-list banner, and GET draft still returns the row. Unlock of a removed draft is 404. The NERIS queue hides removed call numbers. The incident list still shows the incident. Incident delete ignores `reportRemoved` drafts so a ghost draft does not block deleting the incident.

## Behavior the next agent must not undo
- Server refuses content edits when report status is In Review or Exported. Draft stays editable with `reports.edit`. Anyone who can edit reports can unlock In Review. Only admin (role level >= admin) can unlock Exported. Transition to Exported requires `neris.export`.
- Conflict: client sends `{ payload, baseUpdatedAt }` using `NerisDraft.updatedAt`. Missing or mismatched `baseUpdatedAt` on an active row returns 409 `REPORT_CONFLICT`. Exact message: "Someone else saved this report while you were editing. Reload to see their changes before saving again." The form shows that as a modal, not only inline. Other save errors stay inline.
- Removed drafts: conflict only if `baseUpdatedAt` is sent and mismatches; an empty `baseUpdatedAt` may overwrite a removed row.
- History: `changedFieldNames` skips `formValues`, `baseUpdatedAt`, `lastSavedAt`, `payload`, `reportRemoved`, and `seedFormValues`. First-save keys that match the client seed are not recorded. Absent→Draft `reportStatus` is not recorded. Empty arrays/objects versus null are not recorded. `recordReportChange` skips empty field name lists. Display maps ids through `nerisFieldLabelById` plus extras (`reportStatus` → "Report status", aid and JSON fields listed in the October 31 session note). Fallback replaces underscores with spaces. Stored ids stay stable.
- Client `autoFillSeedRef` copies form values until the user edits (`userEditedReportRef`). `persistNerisDraft` sends that seed as sibling `seedFormValues` on PATCH, not inside the payload. The server strips `seedFormValues` and `reportRemoved` so a save clears the removed flag.
- Delete does not hard-delete `NerisDraft`. It upserts the previous payload with `reportRemoved: true` and `reportStatus: "Draft"`. Only an admin can delete, and the report must be unlocked first. DELETE on a locked report is refused.
- Saving NERIS Entity ID (Admin Functions, `vendorCode`, `PATCH /api/neris/settings`) updates `Tenant.nerisEntityId`.
- Shared settings live in `DepartmentDetails.payloadJson.sharedDepartmentSettings` (logo 500 KB decoded data-URL, workflow states, submenu visibility, display cards). Not a secret. Writes require `settings.department`. Any signed-in user may `GET /api/department-details`. The submenu card editor is admin-only. Incident list layout and sidebar width stay local. Shift trades wait.
- Workflow row input key is `key={index}` (about `src/App.tsx` line 12521). Do not key the row on the text value or typing one character remounts the input.
- Queue status: `getNerisQueueFieldValue` prefers the local draft `reportStatus`, then `call.nerisReportStatus`, then Draft. View Exports uses that same helper, and shows Exported only after a successful export. The incidents list API skips `reportRemoved` drafts when setting `nerisReportStatus`. Call number used by the API is the incident id.
- View Exports (the button, the page, and `GET /api/neris/export-history`) requires `neris.export`. Default role is admin. A person without it sees "Export history is not shown for this sign-in." Do not add a separate permission.
- Part 0: `requirePlatformAdmin` compares `request.path.toLowerCase()` with `/api/admin`. A capitalized `/API/admin/...` with no key returns 403 and creates nothing. That one-line check is on staging (PR #32) and on `main` (PR #33). Pull request 31 is already merged for the Stage B promote. Do not merge it again.
- Fixes 8, 9, and 10 (and 11–14) are on staging as of 2026-11-01 and on production as of 2026-11-04. Fix 8 rejects API paths with different letter case or a trailing slash. Fix 9 keeps a real account's wrong-password count during a flood and clears a count 15 minutes after the last failure. Fix 10 returns a short JSON message for a broken request instead of a stack trace.

## Still open — user must answer before those pieces are built
- **Stage C Waves 1–5 are built on this practice branch.** See `docs/plans/PHASE_C_FIRE_RECOVERY_PLAN.md` §9 and §15. Target: one real Crescent vehicle-accident bill from production. Go-live moves later if the staging sandbox test hasn't passed. Wave 5b is a staging NERIS re-export check and is not started. Wave 6 is the fake-vendor file and is not started. Do not start either until the user says so.
- **Stage C plan is complete and detailed** in `docs/plans/PHASE_C_FIRE_RECOVERY_PLAN.md`: decisions in §3, waves in §9, operator steps in §11, vendor email in §13. Start at Wave 1. The §14 approvals are given: the add-only `submitStatus` and `submitStartedAt` columns, and permission-map entries for the new routes. Only Q5 (is the Welcome login also for real bills?) waits on the vendor, and it blocks only Wave 8. The operator answered the minimum fields, local time, one law enforcement number, and the run number on 2026-11-01 (plan §4 and §13).
- Confirmed 2026-11-01:
  - The Welcome email has the RH public API login; the host is `https://process.firerecoveryusa.com`.
  - Crescent's billing agreement is set up.
  - `FIRE_RECOVERY_CREDENTIAL_KEY` is missing on both staging and production. The operator creates it at Wave 7/8 (plan §11.1).
- Key finding: since fix 5, the export receipt stores only the NERIS payload. Wave 3 reads billing from the Exported `NerisDraft` form values and takes the NERIS incident ID from the receipt (plan §7.1).
- The user chose to send the combined Fire Recovery email now, in parallel with building, instead of after Step 17.
- The full vendor API documentation is in `docs/procedures/vendor/fire-recovery-usa-api-collection-2026-11-01.json`.

## External dependency status
- Staging Neon and Render updated 2026-11-01. Production promote 2026-11-04: backup `backup-2026-11-04-before-production-weekday`, migrations applied, PR #37 / `6efda0e`, production build command `npm ci --engine-strict=false && npm run build`. Fire Recovery mode left unset. Production Crescent Allowed Senders was empty after promote — add before CAD ingest is used.
- Backups to leave alone: `backup-2026-10-28-before-repairs` (prod), `backup-2026-10-28-before-repairs-staging`, `backup-2026-11-01-before-stage-b`, `backup-2026-11-04-before-weekday-schedule`, `backup-2026-11-04-before-production-weekday`.
- Production runs `main` at `6efda0e`. Staging runs `submenu/neris-golive-cifpd`. Staging and production API build commands use `npm ci --engine-strict=false && npm run build`. Do not add a dashboard `NODE_ENV` variable.

## Next agent should do this first
1. Read `docs/plans/security-remediation-plan.md` Status first. Stage B is on production. Do not rebuild fixes 1–15.
2. Wave 7 staging sandbox is the next Fire Recovery step when the user asks. Leave `FIRE_RECOVERY_MODE` unset. Do not create `FIRE_RECOVERY_CREDENTIAL_KEY` until then.
3. Before production CAD ingest is relied on, add Crescent’s dispatch sender to production Allowed Senders.
4. Do not build the parked items. Do not save a Fire Recovery password in production until Wave 8.
