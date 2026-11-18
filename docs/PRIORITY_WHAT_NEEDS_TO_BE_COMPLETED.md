# What needs to be completed

**Updated:** 2026-11-17, late morning America/Chicago (N14, N15, and N16 ready for click checks).  
**Branch:** `submenu/neris-golive-cifpd`.  
**How to use this file:** open work from the plan review, grouped by topic. Do not start coding an item until the operator names it. Each ID appears once. Rows marked **Waiting on click check** are listed with steps in `docs/Click by Click Checks.md`. Older incident and NERIS UX history (items 2–11) stays in `docs/completed/BACKLOG_INCIDENTS_NERIS_UX.md`.

**Group order:** NERIS → Fire Recovery → Incidents and dashboard → UI and layout → Roles, admin, and security → Scheduling → CAD → Waiting on Fire Recovery → Much later → Not scheduled → Marked done.

---

## NERIS report and form

| ID | Status | Item |
|----|--------|------|
| E1 | Open | Conditional required fields: one shared rule for platform defaults and department rules, with an admin screen under NERIS Required Fields. Fire Recovery already has its own requirement levels; this item is the wider NERIS rule engine, not the billing tab alone. |
| E11 | Open | Each department’s NERIS settings (for example entity ID and export configuration) live in the database and load per request. The NERIS web address stays one setting per environment. |
| F1 | Open | Recover Reports: on Reporting → NERIS, next to Fire Recovery and View Exports, restore a deleted NERIS report with every typed answer. The incident stays on Incidents. Do not build until named. |
| F5 | Waiting on click check | **Dispatched and canceled en route** fills times. Open a NERIS report that has a call arrival time under Incident Times → Resources → check **Dispatched and canceled en route**. Dispatch Time, Canceled Time, and Clear Time should fill with that call arrival time. If they stay empty, move this back to Open. |
| N3 | Open | Reporting → NERIS needs a **Configure Table** button with the same drag-and-drop column layout as Incidents. |
| N4 | Open | NERIS dropdowns are cut off at the bottom of a short window. The open list must stay fully visible and scrollable (portal or similar), including fields such as primary incident type. |
| N5 | Open | After a primary incident type is chosen, the form should show only the last name (for example Motor Vehicle Collision), not the full path. Keep sending the full NERIS code. The reporting table already shows the last segment; the form field still shows the full path. |
| N6 | Open | NERIS export is sending the dispatch number. It must send the incident number. Mapping and display of the other number stay as they are unless the operator says otherwise. |
| N7 | Open | NERIS table dates show `year-month-day T HH:MM:SS`. Show `MM/DD/YY HH:MM` in 24-hour time. |
| N8 | Open | Add Person needs a **Save** button at the top and the bottom, so Close is not the only choice when an address is missing. |
| N9 | Open | On the Motor Vehicle Collision tab, hide the call fields that are copied from earlier sections: run date, time alarm received, time call cleared, run number, total personnel on scene, law enforcement agency report number, street, city, state, and ZIP. Keep sending them. Do not remove the mapping. |
| N10 | Open | Hazards **Save**, **Back**, and **Next** are oblong. Match the buttons used on the rest of the NERIS report. |
| N13 | Review findings | Live schema is **1.5.x** (OpenAPI `1.5.3`), not 2.0. Version 2 is still planned for later. Our form matches pre–1.5 lists. Findings: `docs/plans/NERIS_N13_SCHEMA_VERSION_FINDINGS.md`. Do not change the form until you pick which 1.5 fields Crescent needs. |
| N14 | Waiting on click check | Narrative Builder: pick a NERIS section, then a field in that section. Resources now includes the unit-card values that were missing from the old one-list picker: apparatus that responded, personnel on scene, staffing, response and transport mode, each unit time, canceled en route, report writer, unit narrative, and one line with every value for a unit. |
| N15 | Waiting on click check | Admins and above see **Validate/Export** next to the existing **Export** button. Validate/Export checks the report and exports only when validation passes. Export alone stays, so a report that is already validated can be exported without running validation again. |
| N16 | Waiting on click check | **Import** and **Get Incident (Test)** on the NERIS report are visible only to superadmin. Import is still disabled (“not implemented”). Get Incident (Test) loads an already-exported incident from NERIS by its NERIS ID so the response can be compared with the form. After this click check, decide whether these were only original test tools and whether they should stay. |

---

## Fire Recovery and billing

| ID | Status | Item |
|----|--------|------|
| A2 | Open / Waiting on Email Reply | Time Call Cleared stayed blank in Recovery Hub on the live bill. Their website only accepts `HH:MM`. We sent seconds (`2025-11-11T13:59:45`), same shape as Alarm. Follow-up email sent 2026-11-17. Do not change the mapping until Fire Recovery answers. |
| A3 | Open / Waiting on Email Reply | Is Resident **No** (`Isresident: false`) did not show in Recovery Hub. **Yes** does show when resident is true. Follow-up email sent 2026-11-17. Do not change the mapping until they answer. |
| G2 | Waiting on click check | Billing uses the server NERIS receipt and a preview. On an exported motor-vehicle report, open View Exports → Fire Recovery. **Preview & Send** should open only after NERIS accepted the export. Confirm is a second click. Nothing is billed automatically. |
| G3 | Waiting on click check | A second send does not create a second bill. On staging, open an incident already marked Sent and click **Confirm and send** again. The screen should refuse it and keep the same tracking ID. Do not send another live production bill for this check. |
| G9 | Open | Finish any pieces of the April Fire Recovery billing screens that are still missing. Phase C already shipped preview, Sent / Failed / Needs review, the billing list, and Update billing status (replacing the old “DataSent” label). Still confirm amount due, amount paid, and tracking ID on the list, and a manual send from the incident queue. The View Exports side box is N12. |
| N12 | Open | In View Exports, the gray **Not Sent** box on the far right should do the same thing as **View and Send** when the incident can be billed. If it cannot be billed, show a gray circle with a dash instead. |

---

## Incidents and dashboard

| ID | Status | Item |
|----|--------|------|
| E5 | Open | Incidents / Mapping stat cards (Open Calls, Average Turnout, Average Travel, Calls Awaiting Closure) use live, tenant-scoped numbers. Until then, hide or park the demo-style cards (see N2 for the dashboard). |
| E6 | Open | Export Call Queue performs a real export (CSV or agreed download). Define the target, tenant scope, and who may use it before coding. |
| F2 | Open | On an open incident, the Status box is unit status (Dispatched, Enroute, On scene, Cleared). Draft should not be a choice. This is not the NERIS report status (Draft, In Review, Exported) and is not the dispatch workflow list in Customization. |
| N2 | Open | Remove, hide, or park Active Calls and the other dashboard blocks that still use demo-style information on production and staging. Map them to live data later. |

---

## UI and layout

| ID | Status | Item |
|----|--------|------|
| F4 | Open | Unchecking a box in Admin Functions → Customization → Submenu Display Settings hides that item from the left menu. Edit Display on the submenu cards still controls which cards show on the menu page. |
| N1 | Open | Choices such as Edit My Display follow the signed-in person, including onto another browser and another computer. A shared station PC must not keep the previous person’s display. Then list every other setting that still lives only in one browser and should follow the person (this includes the old F6 Edit My Display note). |
| N11 | Open | Reduce the sidebar width by about 20 percent of its current width. |

---

## Roles, admin, and security

| ID | Status | Item |
|----|--------|------|
| B3 | Open | Clear report and incident data from the browser when the sign-in expires. On a shared station PC, people should not keep seeing the previous person’s data. Needs an approved clearing rule before coding. |
| B4 | Open | Remove the old readable-text password check on the server, after both databases stay at zero readable-text passwords. Safe only while that count stays zero. |
| B6 | Open | An unknown username must not get a faster sign-in reply than a real username (compare against a stand-in password hash when the username does not exist). |
| E2 | Waiting on click check | Department role permissions work. Admin Functions → Department Details → Access / Restrictions → **Who can do what**. Change one action to a lower role, save, and sign in as that role. The four roles are User, Subadmin, Admin, and Superadmin. A department cannot yet invent a new role name such as secretary. If those four roles and the saved choice behave as expected, mark done. |
| E3 | Open | Find any leftover checks that look for the exact word `admin` and use “admin and up,” so superadmin is included. Numbered role levels already exist in code. |
| E8 | Open | Super admin stays out of the normal user-type dropdown and is assigned another way (for example a production script or platform tool). |
| E9 | Open | An admin can enter a show/hide mode and click fields and menus to show or hide them by user type. Persist and apply those choices. |
| E12 | Waiting on click check | Reset password is an in-app form. Admin Functions → Department Details → Access / Restrictions → open users → **Reset Password**. You should see new-password fields and **Save Reset Password**, not a browser prompt. If you see the in-app form, mark done. |
| E13 | Open | Extra login slowdown or rate limit beyond the 15-minute lock that already exists after five wrong passwords. |
| E14 | Open | A clear record of who reset or changed a password, and when. Access / Restrictions already lists recent account changes. If a password reset already appears there with who/when/target, this item is done. |
| E15 | Open | Search and filter on large personnel and user lists. |
| E16 | Waiting on click check | The staging website is its own Render service. In the Render dashboard, confirm a frontend service whose site is the staging address, separate from the production website. If you see that split, mark done. |

---

## Scheduling

D9 (schedule save erasing days missing from an open tab) is done. D1 needs a click-check.

| ID | Status | Item |
|----|--------|------|
| D1 | Waiting on click check | Watseka weekday 12-hour schedule on staging. Sign in at `watsekademo.staging.fireultimate.app` and open that schedule. Crescent’s 24/48 schedule on its own site should be unchanged. Work lived on branch `cursor/watseka-scheduling-plan`. If the trial is there and Crescent is unchanged, mark done. |
| D2 | Open / parked | Phone schedule. Parked until you ask to start it. Pick the layout first (day-first list recommended), then the phone header, one-day list, week and month pickers, and the day-block editor. Desktop week and month stay unchanged. Plan: `docs/plans/canvases/schedule-mobile-plan.canvas.tsx`. |
| D3 | Open | Scheduler Settings: Standard or Custom mode for each extra field. Not built yet. Spec: `docs/plans/SCHEDULE_OVERTIME_IMPLEMENTATION_SPEC.md`. |
| D4 | Open | Hour ledger: per-person and per-position hours, including the sick-time rule (for example remaining hours after a short sick day must be placed elsewhere). |
| D5 | Open | Full overtime hiring workflow on the server (beyond the per-segment OT checkbox already in the day-block UI). |
| D6 | Open | A history of segment edits (who changed a timed segment, when). |
| D7 | Open / parked | A screen to create a department without a script. Today only the program owner can create one with a script or the platform admin API. |
| D8 | Open / parked | Nights and weekends for volunteer or paid-on-call members. This test department does not schedule them in the app. |
| E4 | Open | Scheduler Apparatus: a way to remove or delete an imported apparatus row after Import Apparatus sync. |

---

## CAD

Every CAD item below is still open. Do not start coding until the operator names the first step. Batches A–I are done. A database change still needs an explicit yes before C2 or C8. Hold from 2026-04-09 still stands until lifted.

| ID | Status | Item |
|----|--------|------|
| C1 | Open | Ignore a repeat delivery of the same email (fingerprint by message ID and contents so five deliveries act like one). |
| C2 | Open | One incident per call number, including both Crescent email shapes (short dispatch and closing summary). Needs an approved database rule. |
| C3 | Open | CAD updates its own incidents without blanking fields, duplicating notes, or recreating a deleted or hand-made incident. Users do not edit CAD-created incidents; corrections go on the run report. Matching emails on hand-made or deleted rows show a warning for an admin. |
| C4 | Open | The first CAD email creates the run report. Later emails fill only blank or still-CAD fields. If a person changed a field, show that CAD has newer information instead of overwriting. In Review and Exported reports stay unchanged. |
| C5 | Open | Refuse broken or unsafe parsing rules when they are saved, with a clear message and a run-time limit. |
| C6 | Open | An admin screen for allowed senders. An empty list already rejects everyone. Crescent’s sender `dispatch@co.iroquois.il.us` is already saved. Do not delete that row. |
| C7 | Open | A holding area and an alert when a dispatch email fails, plus safer handling of very large emails (Cloudflare has no dead-letter queue today). |
| C8 | Open | Separate switches for “create new incidents” and “update existing incidents” (Batch J). Needs an approved database change. |
| C9 | Open | The admin preview and a real inbound email use the same engine and the same result, tested on Crescent’s sample emails. |
| C10 | Open | Finish Crescent’s parsing rules, pass the staging checklist, then point the Cloudflare Worker at production (`CAD_INGEST_API_URL`). |
| C11 | Open | A shared rule library departments turn on, in plain language, with no JSON for normal setup (Batch K). |
| C12 | Open | Automatic email cleanup after N days or M stored emails, with an admin setting. |
| C13 | Open | Apparatus matching polish (own units vs mutual aid) and duplicate-call tuning. |
| C14 | Open | Optional: the Cloudflare Worker drops a disallowed sender before it calls the API. |
| F7 | Open / later | After CAD is reliable: in-app alerts, dispatcher-note alerts, a map, optional text messages, a mobile app, and a station-log summary. Depends on C1–C4 working first. |

---

## Waiting on Fire Recovery

Follow-up email sent to Fire Recovery on **2026-11-17** (cleared time, Is Resident No, commercial trucking, lost tracking ID, billing status timing). Do not change code until they reply.

| ID | Status | Item |
|----|--------|------|
| A4 | Open / Waiting on Email Reply | How to mark a commercial trucking incident through the API. They said they will add fields later and notify. Asked again in the 2026-11-17 email. Park until they send field names. |
| A5 | Open / Waiting on Email Reply | How to find a tracking ID after a timeout. Get Incident Tracking Id still lists a SubscriptionKey we do not have. Asked again in the 2026-11-17 email. Keep Needs review plus admin resolve until they answer. |
| A6 | Open / Waiting on Email Reply | How soon billing status is available after submit, and how often we may check it. Asked again in the 2026-11-17 email. Keep manual **Update billing status** until then. |
| A11 | Open / Waiting on Email Reply | Archive the Phase C plan (`docs/plans/PHASE_C_FIRE_RECOVERY_PLAN.md`) only after A2, A3, A4, A5, and A6 are closed and the operator says the Recovery Hub follow-ups are finished. |

---

## Much later

| ID | Status | Item |
|----|--------|------|
| F8 | Much later | Fire Recovery attachments, address validation, incident search, structure-fire and other run types, automatic billing-status refresh, bulk status, payment reconciliation, invoices, and inspection billing. Not for the current go-live. |

---

## Not scheduled

Explained in the 2026-11-13 review. Not on the build list until the operator schedules them.

| ID | Why it is not scheduled |
|----|-------------------------|
| A1 | Some older incidents were exported before the server kept its own proof that NERIS accepted them. The plan was to export one again; if NERIS updated that same incident, we could later add a button that exports again and then opens the billing preview. You confirmed NERIS updates the same incident and does not create a second one. That answers the safety question. The optional re-export-then-bill button is not approved. |
| A7 | An optional security note said the server could store the name of the person who validated the export. The export screen already has a place for that name when one was saved. We never decided to require it. |
| A8 | After a bill is sent, someone may need to correct it in Recovery Hub. One idea was a screen that says “correct this in Recovery Hub” and records who clicked it, when, and why. Accidental double-send protection is already in the app. The guided correction screen was not requested. Vendor answer: re-send through the API only if Recovery Hub has not edited the run. |
| A9 | If someone edits a report after it was billed, Fire Recovery could still have the older bill. One idea was a warning that says the bill may be out of date, without sending another bill. That warning was not requested. The attempt-history table was not approved. |
| B2 | Suspended and archived departments can still sign in today. Cutting off a department by status alone is unsafe until sessions are cancelled and accounts are disabled. Needs a design conversation before any code. |
| B5 | When the browser calls the server, the server can check which website the request came from. That check can ignore the difference between `http` and `https`, and it can ignore a port number. Cloudflare already forces HTTPS, and the sign-in cookie is only sent to that department’s own address. Extra work was not requested. |
| B7 | Developer-tool warnings and session tests that skip when the local test database is not running. People using the department site never see this. |
| E20 | The website currently downloads as a large file. Splitting it into smaller pieces can make the first page open faster. The screens would look the same. Not requested. |
| G6 | Pretend-Fire-Recovery tests already live in `server/fireRecovery.test.mjs`. They run with `npm test` so a bug can be found without a real invoice. There is no screen for them. Treated as done; listed here so the ID is explained. |
| G7 | The remaining email questions are A3, A4, A5, and A6. The staging sandbox test itself is done (tracking ID `c7aaf46a-fd7b-4ea8-9bd6-d644bbfd3418`). |

---

## Marked done in this review

| ID | Item |
|----|------|
| A10 | Production CAD test email, and an unsigned `/api/users` request returns 401. |
| B1 | Capital letters and a trailing slash no longer skip sign-in or permissions. |
| D9 | Saving the schedule no longer erases days that are missing from an open browser tab. |
| E7 | Validate is available to the people who should validate. Export stays limited by the billing and NERIS permissions. |
| E10 | NERIS Export Configuration is saved for the department, not only in one browser. |
| F3 | Incidents → Configure Table drag-and-drop works. |
| G1 | The server writes the NERIS success receipt. |
| G4 | The Fire Recovery password is encrypted, and sandbox versus live department ID is in place. |
| G5 | The Motor Vehicle Collision billing section and its required party fields are in place. |
| G8 | The production release and the one real bill are done. Tracking ID `412c2d90-6489-4b63-9fa0-6570adf33bb2`. |

---

## Now vs Later

- **Now:** open rows above, one item at a time, after you name it. Prefer NERIS and Fire Recovery first unless you say otherwise.
- **Waiting on click check:** D1, E2, E12, E16, F5, G2, G3, N14, N15, N16. Steps are in `docs/Click by Click Checks.md`. After a pass, mark Done. After a fail, move back to Open. N16’s keep-or-remove decision stays open after the visibility check passes.
- **Waiting on email reply (sent 2026-11-17):** A2, A3, A4, A5, A6, A11.
- **Later:** F8 and anything under Not scheduled, until you say to schedule it.
- **CAD:** listed because it is not done. Coding waits until you name the first CAD step and lift the hold.
