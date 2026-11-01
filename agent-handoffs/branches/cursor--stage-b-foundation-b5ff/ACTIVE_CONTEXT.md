# Active Context Snapshot (cursor/stage-b-foundation-b5ff)

## System overview (read this first)
- **Platform:** FireUltimate — multi-tenant fire department operations.
- **Architecture:** React frontend (Vite), Node Express backend (`server/neris-proxy.mjs`), PostgreSQL via Prisma 7.10.1. Do not upgrade Prisma.
- **Tenancy:** All tenant data is scoped by `tenantId`. Localhost requests resolve to the `demo` tenant. Tenant is otherwise resolved from the Host header.
- **Details:** See `docs/system_architecture.md` and `docs/data_model.md`.
- **Time format:** All time inputs and displays are 24-hour (military) app-wide.

## Current branch
- `cursor/stage-b-foundation-b5ff` (practice/work branch). Folder slug: `cursor--stage-b-foundation-b5ff`.
- Created from `submenu/neris-golive-cifpd` at `2d985fa` (the version staging runs).
- Pull request: https://github.com/jwcc89-spec/FireUltimate-V1.0.0.0/pull/31 — title starts with "Stage B Steps 5–9B" and says **do not merge**. Base branch is `submenu/neris-golive-cifpd`, never `main`.
- `main` is production. Do not merge this branch. Do not point staging or production at this branch. Do not touch staging, production, Neon, Render, or Cloudflare.

## Current focus
- Stage B (Steps 5–9B) is **built and click-tested** on this practice branch. It is **not released**.
- Security Part 1 is **complete**. Part 2 code (fixes 4, 1, 2, and 3) is **built and tested** and **not released**. Sign-in limits stay at 5 failures, 10,000 remembered names, 100-character usernames, and 256-character passwords.
- The allowed-sender screen is **Stage D, repair-plan step 23**. Do not build it during Part 3. Crescent's sender is `dispatch@co.iroquois.il.us`. Staging `cifpdil` has 0 allowed senders. Do not release this branch until that address is saved, because Fix 3 rejects mail when the list is empty.
- **Next code is security Part 3:** fix 5, then fix 6, then fix 7, on this practice branch only. The operator ended the October 31 chat by asking the next agent to start there. Fix 6 uses Render setting `FIRE_RECOVERY_CREDENTIAL_KEY`. Fix 7 `billing.view` defaults to admin. Do not start Step 15, the Fire Recovery email, or a release.
- Repair plan canvas (live): https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/3b7445ce-b395-4e16-b948-f84dab1ca136
- Repair plan source in the repo: `docs/plans/canvases/repair-plan.canvas.tsx`. Keep the live canvas and this file in sync. Republish with WriteCanvas using canvas id `3b7445ce-b395-4e16-b948-f84dab1ca136` and the full repo file. Omit the title so "Fire Ultimate repair plan" stays.
- Design canvas (older, not the working plan): https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/a9d0e635-88a9-45c5-89c8-ab93873f7618
- Latest session note: `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/2026-10-31-handoff-to-part-3.md`
- Latest user summary: `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/conversations/2026-10-31-session-summary.md`
- Start prompt for the next agent: `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/COPY_PASTE_START_PROMPT.md`

## Latest known status
- Latest security code on this branch: `f3b59e5` (CAD secret required everywhere) and `2e99f11` (empty sender list rejected). Earlier the same evening: `497b667` (session tests) and `e3c222e` (sign-in memory cap). Docs through `0b356cd` marked Part 1 complete. Read `git log -1` after pull. The handoff that points the next agent at Part 3 is the commit after `0b356cd`.
- Stage A (Steps 1–4) complete. Stage B Steps 5, 6, 7, 8, 9, 9A, and 9B are built here and click-tested on October 31, 2026 (America/Chicago).
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
- Sign-in for practice: `demo` / `demo` (admin), unless the user changed it. The user cannot paste into the terminal. Do not ask them to paste commands. If a server is down, the agent fixes it.
- Lockout lives in memory in `server/auth/sessions.mjs` (`loginFailures` Map), not in the database. Restarting the practice proxy clears it and signs people out. Do not restart unless a lock or a crash requires it.
- curl to `127.0.0.1:8787` for a mutating request needs `Origin: http://127.0.0.1:8787` or the server returns 403 "This action must come from the department's own website." Vite listens on `::1:5173`; `curl http://127.0.0.1:5173` can fail while `http://localhost:5173` works. `ss` is not installed; use curl. `/api/health` returning 401 means the proxy is up and auth is on.
- After a client change, tell the user to reload `http://localhost:5173` once.

## Current blocker / status
- No code blocker for Stage B. Click-through is done.
- **Do not merge** until `Session`, `RolePermission`, `AccountAuditLog`, and `NerisReportChange` exist on staging, with a fresh backup and explicit approval. Those tables are add-only. Prisma schema and migrations change only with explicit approval.
- Do not set `TRUST_PROXY=1` until Render is confirmed to replace `X-Forwarded-Host`.
- Do not set `NODE_ENV=production` until a planned release. Keep the admin and demo accounts.
- Do not store auth secrets in `DepartmentDetails.payloadJson`.
- Fire Recovery tests, when they start, use sandbox department ID `FD12345678` only.

## Parked — do not build unless the user asks
Recorded October 31, 2026 on the repair plan (Decisions and Parked & future):
1. **Recover Reports.** Button on Reporting → NERIS, next to Fire Recovery and View Exports. Restores a deleted report with every typed answer. The incident already stays. Do not build it now.
2. **Incident Status is unit status.** On an open incident, Status uses the built-in list Draft, Dispatched, Enroute, On scene, Cleared (`DEFAULT_INCIDENTS_SETUP_CONFIG.currentStateOptions` in `src/App.tsx`, about line 933). New incidents start on Draft. This is not NERIS report status (Draft / In Review / Exported) and it is not the dispatch workflow list in `src/appData.ts` (`DEFAULT_DISPATCH_WORKFLOW_STATES`: Dispatched, Enroute, On scene, Transport, Cleared). Draft should not be a choice. Do not change it while starting Stage C.
3. **Incidents → Configure Table** drag-and-drop does not work (button near `src/App.tsx` line 4331). Column layout stays on each computer.
4. **Submenu Display Settings.** Unchecking a box in Admin Functions → Customization → Submenu Display Settings should hide that item from the **left menu**. Today `submenuVisibility` only filters menu-page cards and Edit Display (`src/App.tsx` about 3501–3522). The left sidebar (`visibleSubmenus`, about 3262) filters by admin role and scheduler, not by those checkboxes. Edit Display on the submenu cards stays the control for cards on the page.

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
- Queue status: `getNerisQueueFieldValue` prefers the local draft `reportStatus`, then `call.nerisReportStatus`, then Draft. The incidents list API skips `reportRemoved` drafts when setting `nerisReportStatus`. Call number used by the API is the incident id.

## Still open — user must answer before those pieces are built
- Fire Recovery sandbox Welcome Message account email (Step 13). Support mentioned `support@fireultimatehq.com`; the user has not confirmed which email to send.
- Step 15 Reporting tab: add Is Resident, require vehicle-party fields, and decide where the incident-level Law Enforcement Number lives.
- One combined Fire Recovery email is drafted after sandbox testing (Step 17), not before.

## External dependency status
- Render, Neon, Cloudflare, and Fire Recovery were not changed by this branch.
- Backups from 2026-10-28: `backup-2026-10-28-before-repairs` (prod) and `backup-2026-10-28-before-repairs-staging` (staging). Do not edit or connect the app to a backup branch.
- Production runs `main` (`3f9b97a`). Staging runs `submenu/neris-golive-cifpd` (`2d985fa`).

## Next agent should do this first
1. **Do now:** Read `cursoragent-context.md`, `.cursor/project-context.md`, this file, `sessions/2026-10-31-handoff-to-part-3.md`, and `docs/plans/security-remediation-plan.md` Part 3. Part 1 is complete. Part 2 code is complete and not released. Start Part 3 at Fix 5, then Fix 6, then Fix 7. Do not build the allowed-sender screen (Stage D, step 23). Do not deploy.
2. **Do now:** Stay on `cursor/stage-b-foundation-b5ff`. Pull before editing. Confirm `http://localhost:5173` if the user is about to click.
3. **Do now:** Start security Part 3 (fix 5, then 6, then 7). Do not deploy. Production migrations are recorded (10 names through `20260411190000_fire_recovery_tenant_api_credentials`). This branch adds Session, RolePermission plus AccountAuditLog, and NerisReportChange. The allowed-sender screen is Stage D.
4. **Do not** build Recover Reports, the allowed-sender screen, the Status dropdown, Configure Table drag, or left-menu hiding. Step 10 in this next session means security Fix 5 only.
5. **Do not** merge, retarget staging, or touch Render, Neon, Cloudflare, or production.
6. Part 3 does not add a database table. Fix 6's key is the Render setting `FIRE_RECOVERY_CREDENTIAL_KEY`. Do not create that setting on Render in this session. Step 15 and the Fire Recovery email stay parked.
