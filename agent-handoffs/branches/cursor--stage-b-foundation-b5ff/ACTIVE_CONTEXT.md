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
- Staging runs `submenu/neris-golive-cifpd` at `d4bbaee`. Commits after that on this practice branch are documentation only. Do not fast-forward staging to them. A push to `submenu/neris-golive-cifpd` redeploys `fireultimate-api-staging`.
- `main` is production. Do not merge to `main`. Do not touch production, `fireultimate-prod`, or `fireultimate-api-prod` unless the user asks for that release.

## Current focus
- **Crescent staging click test passed** on 2026-11-01, about 2:09 p.m. America/Chicago. No step failed. Production is not updated. Do not merge to `main`. Staging username `admin` was locked by five wrong passwords during that test; `admin1` still signed in. The lock lasts 15 minutes.
- **Part 5 steps 1–5 are done for staging.** Backup `backup-2026-11-01-before-stage-b` in `fireultimate-staging` has 22 incidents (about 1:07 p.m. America/Chicago). Crescent sender `dispatch@co.iroquois.il.us` is saved on the live branch `production` for tenant `cifpdil` (about 1:14 p.m., id `allow-cifpdil-dispatch-20261101`, `exact_email`, enabled). About 1:19 p.m. the operator confirmed `Session`, `RolePermission`, `AccountAuditLog`, and `NerisReportChange` on that live database. Leave the backup alone. Do not open `fireultimate-prod`. Promoted to `submenu/neris-golive-cifpd` on 2026-11-01, about 1:33 p.m. America/Chicago. Pull request 31 is merged. Staging tip is `d4bbaee`. The first Render build of that commit failed on Node 20.19.0 with `EBADENGINE` for unused `@prisma/streams-local`. The operator set the staging build command to `npm ci --engine-strict=false && npm run build` on `fireultimate-api-staging` only. That later build succeeded, and the click test ran on the live site. Do not upgrade Node or Prisma. Do not change `.npmrc`. Do not add a dashboard `NODE_ENV` variable. Do not merge to `main`.
- Stage B (Steps 5–9B), security Parts 2 and 3 (fixes 1–14), and the Allowed Senders screen are **on staging**. Production is the pre-Stage-B program plus the Fix 15 one-line hotfix. Do not rebuild any of that code.
- Security Part 1 is **complete**. Sign-in limits stay at 5 failures, 10,000 remembered names, 100-character usernames, and 256-character passwords.
- Allowed Senders is on staging at Admin Functions → Dispatch Parsing Settings → Allowed Senders. Crescent's sender `dispatch@co.iroquois.il.us` is saved (`exact_email`, enabled). Do not delete that row. An empty list rejects mail.
- **Part 3 is on staging.** Fix 5: the server writes the NERIS export receipt after NERIS replies; the browser can post only a failure. Fix 6: `Tenant.fireRecoveryApiPassword` is AES-256-GCM, tagged `enc:v1:`, key from Render setting `FIRE_RECOVERY_CREDENTIAL_KEY` (do not create that setting in a coding session). Fix 7: `billing.view` defaults to admin and hides billing without it. Do not save a Fire Recovery password in production until these fixes are live there. Do not start Step 15, the Fire Recovery email, or a production release unless the user asks.
- The operator finished the practice-site click checks for fixes 8, 9, and 10 on 2026-11-01, about 11:30 a.m. America/Chicago, with no issues. Those fixes are included in the staging deploy. The Crescent staging click test is the staging check.
- **Fixes 11–14 are on staging.** The operator opened and saved report `26-UPPER` on the practice site on 2026-11-01, about 11:53 a.m. America/Chicago. Do not rebuild them. Fix 16 is Stage C. Fix 17 stays the 15-minute lock. `CAD_INGEST_SECRET` is present on the staging API. The dashboard `NODE_ENV` row was removed. Do not add that variable again. Do not merge to `main`.
- **Fix 15 / Part 0 live hotfix: DONE.** Staging PR #32 and production PR #33 verified by the operator on 2026-11-01. CAD address source of truth: **`cifpdil@cad.fireultimate.app`**. Worker was on staging and receiving mail. Prefer Raw Email / Neon over Render log search.
- **Part 4 is deferred.** It is not the next coding task. D1 is required before any department is suspended. D2 is after Stage C and needs the browser-clearing rule approved first. D3–D6 are Stage C. D7 is when convenient. The list is on the repair plan, Parked & future.
- Repair plan canvas (live): https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/3b7445ce-b395-4e16-b948-f84dab1ca136
- Repair plan source in the repo: `docs/plans/canvases/repair-plan.canvas.tsx`. The repo copy was updated on 2026-11-01 to say Stage B is on staging. The live canvas was not republished. Republish only if the user asks, using canvas id `3b7445ce-b395-4e16-b948-f84dab1ca136` and the full repo file. Omit the title so "Fire Ultimate repair plan" stays.
- Design canvas (older, not the working plan): https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/a9d0e635-88a9-45c5-89c8-ab93873f7618
- Latest session note: `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/sessions/2026-11-01-staging-promote.md`
- Latest user summary: `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/conversations/2026-11-01-session-summary.md`
- Older notes through 2026-10-31 stay as the record of those days. Trust this file and the security-plan Status line over any "not released" sentence in an older note.
- Start prompt for the next agent: `agent-handoffs/branches/cursor--stage-b-foundation-b5ff/COPY_PASTE_START_PROMPT.md`

## Latest known status
- Read `git log -1` after pull. Staging's deployed program is `d4bbaee`. Later commits on this practice branch are documentation. Do not rebuild the Allowed Senders screen, Part 0, or fixes 1–14.
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
- Sign-in for practice: `demo` / `demo` (admin), unless the user changed it. The user cannot paste into the terminal. Do not ask them to paste commands. If a server is down, the agent fixes it.
- Lockout lives in memory in `server/auth/sessions.mjs` (`loginFailures` Map), not in the database. Restarting the practice proxy clears it and signs people out. Do not restart unless a lock or a crash requires it.
- curl to `127.0.0.1:8787` for a mutating request needs `Origin: http://127.0.0.1:8787` or the server returns 403 "This action must come from the department's own website." Vite listens on `::1:5173`; `curl http://127.0.0.1:5173` can fail while `http://localhost:5173` works. `ss` is not installed; use curl. `/api/health` returning 401 means the proxy is up and auth is on.
- After a client change, tell the user to reload `http://localhost:5173` once.

## Current blocker / status
- Staging Stage B is live and the Crescent click test passed. Production is the remaining release, and it waits for a separate request. Do not add a dashboard `NODE_ENV` variable. Do not merge to `main`.
- The four tables exist on the live staging database as of 2026-11-01, about 1:19 p.m. America/Chicago. They are add-only. Do not migrate production. Prisma schema and migrations change only with explicit approval.
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
- Fixes 8, 9, and 10 are on staging as of 2026-11-01. Fix 8 rejects API paths with different letter case or a trailing slash. Fix 9 keeps a real account's wrong-password count during a flood and clears a count 15 minutes after the last failure. Fix 10 returns a short JSON message for a broken request instead of a stack trace. Production does not have fixes 8–14 yet.

## Still open — user must answer before those pieces are built
- Fire Recovery sandbox Welcome Message account email (Step 13). Support mentioned `support@fireultimatehq.com`; the user has not confirmed which email to send.
- Step 15 Reporting tab: add Is Resident, require vehicle-party fields, and decide where the incident-level Law Enforcement Number lives.
- One combined Fire Recovery email is drafted after sandbox testing (Step 17), not before.

## External dependency status
- Staging Neon and Render were updated on 2026-11-01 for this release: backup branch, Crescent sender row, four tables, and the `d4bbaee` deploy with build command `npm ci --engine-strict=false && npm run build`. Production Neon, production Render, and Cloudflare were not changed by the Stage B promote. Fix 15 was already on production before that promote. Fire Recovery settings were not changed.
- Backups from 2026-10-28: `backup-2026-10-28-before-repairs` (prod) and `backup-2026-10-28-before-repairs-staging` (staging). Staging backup for this release: `backup-2026-11-01-before-stage-b` in `fireultimate-staging`, 22 incidents, created 2026-11-01 about 1:07 p.m. America/Chicago. Do not edit or connect the app to a backup branch.
- Production runs `main`. Staging runs `submenu/neris-golive-cifpd` at `d4bbaee` after the 2026-11-01 promote. The Render build command on `fireultimate-api-staging` is `npm ci --engine-strict=false && npm run build`. Do not add a dashboard `NODE_ENV` variable.

## Next agent should do this first
1. **Do now:** Read `cursoragent-context.md`, `.cursor/project-context.md`, this file, and `docs/plans/security-remediation-plan.md`. Trust the Status line at the top of that plan. Staging click test passed on 2026-11-01, about 2:09 p.m. America/Chicago. Do not rebuild fixes 8–14, the Allowed Senders screen, or Part 0. Fix 16 is Stage C. Fix 17 has no code change. Do not merge to `main`. Do not build the parked items.
2. **Do now:** Stay on `cursor/stage-b-foundation-b5ff`. Pull before editing. Confirm `http://localhost:5173` if the user is about to click. If that site is down, start it. Do not restart a healthy proxy.
3. **Do now:** Wait for the user's next request. Production still needs its own backup, the four tables, Crescent's sender, and a separate approval. Staging already has those. The Allowed Senders screen is on staging.
4. **Do not** rebuild the Allowed Senders screen. Do not build Recover Reports, the Status dropdown, Configure Table drag, left-menu hiding, canceled-en-route time fill, or per-user Edit My Display. Those last two were parked on 2026-11-01 after the Crescent staging test.
5. **Do not** merge, retarget staging, or touch Render, Neon, Cloudflare, or production.
6. Part 3 did not add a database table. Fix 6's key is the Render setting `FIRE_RECOVERY_CREDENTIAL_KEY`. Do not create that setting on Render until a planned release. Step 15 and the Fire Recovery email stay parked. Do not save a Fire Recovery password in production until fixes 5–7 are live there.
