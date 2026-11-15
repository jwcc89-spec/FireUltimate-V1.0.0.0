# What needs to be completed

**Updated:** 2026-11-13, evening, America/Chicago.  
**Branch:** `submenu/neris-golive-cifpd`.  
**How to use this file:** this is the open-work list from the plan review. Do not start coding an item until the operator names it. Older incident and NERIS UX history (items 2–11) stays in `docs/completed/BACKLOG_INCIDENTS_NERIS_UX.md`.

---

## Still to build

### Fire Recovery and NERIS reports

| ID | Item |
|----|------|
| A2 | Time Call Cleared stayed blank in Recovery Hub. Their website only accepts `HH:MM`. We sent seconds (`2025-11-11T13:59:45`). Do not change the mapping until the operator says to try `HH:MM`, or Fire Recovery answers. |
| A3 | Send the email asking why Is Resident **No** did not show. **Yes** does show on their website. |
| G9 | Finish any pieces of the April Fire Recovery billing screens that are still missing. Preview, statuses, the billing list, and Update billing status already shipped in Phase C. Still check the list for amount due, amount paid, and tracking ID, and a manual send from the incident queue. The View Exports side box is N12. |
| N3 | Reporting → NERIS needs a **Configure Table** button with the same drag-and-drop column layout as Incidents. |
| N4 | NERIS dropdowns are cut off at the bottom of a short window. The open list must stay visible and scrollable. |
| N5 | After a primary incident type is chosen, show only the last name (Motor Vehicle Collision). Keep sending the full NERIS code. The reporting table already does this. The form field still shows the full path. |
| N6 | NERIS export is sending the dispatch number. It must send the incident number. |
| N7 | NERIS table dates show `year-month-day T HH:MM:SS`. Show `MM/DD/YY HH:MM` in 24-hour time. |
| N8 | Add Person needs a **Save** button at the top and the bottom, so Close is not the only choice when an address is missing. |
| N9 | On the Motor Vehicle Collision tab, hide the call fields that are copied from earlier sections: run date, time alarm received, time call cleared, run number, total personnel on scene, law enforcement agency report number, street, city, state, and ZIP. Keep sending them. |
| N10 | Hazards **Save**, **Back**, and **Next** are oblong. Match the buttons used on the rest of the NERIS report. |
| N12 | In View Exports, the gray **Not Sent** box on the far right should do the same thing as **View and Send** when the incident can be billed. If it cannot be billed, show a gray circle with a dash. |
| E1 | Conditional required fields: one shared rule for platform defaults and department rules, with an admin screen under NERIS Required Fields. Fire Recovery already has its own requirement levels. |
| F1 | Recover Reports: restore a deleted NERIS report with every typed answer. |
| F2 | Incident Status is unit status. Draft should not be a choice. It is not the NERIS report status. |

### Security

| ID | Item |
|----|------|
| B3 | Clear report and incident data from the browser when the sign-in expires. |
| B4 | Remove the old readable-text password check, after both databases stay at zero readable-text passwords. |
| B6 | An unknown username must not get a faster sign-in reply than a real username. |

### People, roles, and admin screens

| ID | Item |
|----|------|
| E3 | Find any leftover checks that look for the exact word `admin` and use “admin and up,” so superadmin is included. |
| E4 | Scheduler Apparatus: a way to remove an imported apparatus row. |
| E5 | Incidents / Mapping stat cards use live numbers. Hide or park the demo-style cards until then. See also N2. |
| E6 | Export Call Queue performs a real export. |
| E8 | Super admin stays out of the normal user-type dropdown and is assigned another way. |
| E9 | An admin can show or hide fields and menus by user type. |
| E11 | Each department’s NERIS settings live in the database. The NERIS web address stays one setting per environment. |
| E13 | Extra login slowdown beyond the 15-minute lock that already exists after five wrong passwords. |
| E14 | A record of who reset or changed a password, and when. Access / Restrictions already lists recent account changes. If a password reset already appears there, this item is done. |
| E15 | Search and filter on large personnel lists. |
| N1 | Choices such as Edit My Display follow the signed-in person, including onto another browser. Then list every other setting that stays on one browser and should follow the person. This includes F6. |
| F4 | Unchecking a box in Submenu Display Settings hides that item from the left menu. Edit Display still controls the cards on the menu page. |
| N11 | Reduce the sidebar width by about 20 percent. |

### Dashboard

| ID | Item |
|----|------|
| N2 | Remove, hide, or park Active Calls and the other dashboard blocks that still use demo-style information on production and staging. Map them to live data later. |

### Scheduling

D1 (Watseka staging trial) is treated as done. D9 (schedule save erasing days missing from an open tab) is done. These still need to be built:

| ID | Item |
|----|------|
| D2 | Phone schedule. Parked until you ask to start it. Pick the layout first, then the phone header, one-day list, week and month pickers, and the day-block editor. |
| D3 | Scheduler Settings: Standard or Custom for each extra field. |
| D4 | Hour ledger: per-person and per-position hours, including the sick-time rule. |
| D5 | Overtime hiring workflow on the server. |
| D6 | A history of segment edits. |
| D7 | A screen to create a department without a script. |
| D8 | Nights and weekends for volunteer or paid-on-call members. |

### CAD

Every CAD item below is still open. Do not start coding until the operator names the first step. Batches A–I are done. A database change still needs an explicit yes before C2 or C8.

| ID | Item |
|----|------|
| C1 | Ignore a repeat delivery of the same email. |
| C2 | One incident per call number, including both Crescent email shapes. |
| C3 | CAD updates its own incidents without blanking fields, duplicating notes, or recreating a deleted or hand-made incident. Users do not edit CAD incidents. |
| C4 | The first CAD email creates the run report. Later emails fill only blank or still-CAD fields. In Review and Exported reports stay unchanged. |
| C5 | Refuse broken or unsafe parsing rules when they are saved. |
| C6 | An admin screen for allowed senders. An empty list already rejects everyone. Crescent’s sender is already saved. |
| C7 | A holding area and an alert when a dispatch email fails, plus safer handling of very large emails. |
| C8 | Separate switches for “create new incidents” and “update existing incidents” (Batch J). |
| C9 | The preview and a real email use the same result, tested on Crescent’s sample emails. |
| C10 | Finish Crescent’s parsing rules, pass the staging checklist, then point the Cloudflare Worker at production. |
| C11 | A shared rule library departments turn on, in plain language, with no JSON for normal setup (Batch K). |
| C12 | Automatic email cleanup after N days or M stored emails, with an admin setting. |
| C13 | Apparatus matching polish and duplicate-call tuning. |
| C14 | Optional: the Cloudflare Worker drops a disallowed sender before it calls the API. |
| F7 | After CAD is reliable: in-app alerts, dispatcher-note alerts, a map, optional text messages, a mobile app, and a station-log summary. |

---

## Waiting on Fire Recovery

Do not change code for these until they answer, except A2 if the operator says to try `HH:MM`.

| ID | Item |
|----|------|
| A4 | How to mark a commercial trucking incident. They will add fields later. |
| A5 | How to find a tracking ID after a timeout. |
| A6 | How soon billing status is available, and how often we may check it. Manual Update stays until then. |
| A11 | Archive the Phase C plan after A2, A3, A4, A5, and A6 are closed. |

---

## Much later

| ID | Item |
|----|------|
| F8 | Fire Recovery attachments, address validation, incident search, structure-fire and other run types, automatic billing-status refresh, bulk status, payment reconciliation, invoices, and inspection billing. |

---

## Check by clicking before calling these done

| ID | What you believe | What to look at |
|----|------------------|-----------------|
| D1 | Watseka weekday schedule is on staging. | Sign in at `watsekademo.staging.fireultimate.app` and open the weekday 12-hour schedule. Crescent’s 24/48 schedule on its own site should be unchanged. |
| E2 | Department role permissions work. | Admin Functions → Department Details → Access / Restrictions → **Who can do what**. Change one action to a lower role, save, and sign in as that role. The four roles are User, Subadmin, Admin, and Superadmin. A department cannot yet invent a new role name such as secretary. |
| E12 | Reset password is an in-app form. | Admin Functions → Department Details → Access / Restrictions → open users → **Reset Password**. You should see new-password fields and **Save Reset Password**, not a browser prompt. |
| E16 | The staging website is its own Render service. | In the Render dashboard, confirm a frontend service whose site is the staging address, separate from production. |
| F5 | Canceled en route fills the times. | Open a NERIS report → Resources → check **Dispatched and canceled en route**. Dispatch Time, Canceled Time, and Clear Time should fill with the call arrival time from Incident Times. |
| G2 | Billing uses the server receipt and a preview. | On an exported motor-vehicle report, open View Exports → Fire Recovery. **Preview & Send** should open only after NERIS accepted the export. Confirm is a second click. |
| G3 | A second send does not create a second bill. | On an incident already marked Sent, **Confirm and send** again. The screen should refuse it and keep the same tracking ID. Do this on staging, not with another live bill. |

---

## Not on the build list

These were explained on 2026-11-13 and are not scheduled.

| ID | Why it is not scheduled |
|----|-------------------------|
| A1 | A second NERIS export updates the same incident. It does not create another one. The optional “export again, then open billing” button for older incidents is not approved. |
| A7 | Storing the validator’s name on an export was an optional security note. The export screen can already show a name when one was saved. No new work was requested. |
| A8 | A guided “fix this in Recovery Hub” screen, with who, when, and why, was not requested. Accidental double-send protection is already in the app. |
| A9 | A “billing may be out of date” warning after someone edits a billed report was not requested. |
| B2 | Suspended and archived departments need a design conversation before any code. |
| B5 | The origin check can ignore `http` versus `https` and the port. Cloudflare already forces HTTPS, and the sign-in cookie is host-only. Not requested. |
| B7 | Developer-tool warnings and session tests that skip without a local database. Departments never see this. |
| E20 | Split the website download into smaller pieces so the first page loads faster. No screen change. Not requested. |
| G6 | Pretend-Fire-Recovery tests already live in `server/fireRecovery.test.mjs`. They run with `npm test`. There is no screen for this. |
| G7 | The remaining email questions are A3, A4, A5, and A6. The staging sandbox test itself is done. |

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

- **Now:** the open rows above, one item at a time, after you name it. Vendor rows stay waiting.
- **Later:** F8, and anything in “Not on the build list,” until you say to schedule it.
- **CAD:** listed because it is not done. Coding waits until you name the first CAD step.
