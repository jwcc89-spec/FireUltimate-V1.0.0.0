# Click by Click Checks

Use this list when the priority file status is **Waiting on click check**.

Each check has an ID, the item, and numbered steps. After you run a check, tell the agent pass or fail so the priority status can move to Done or back to Open.

**Updated:** 2026-11-17, late morning America/Chicago.

---

## D1 — Watseka weekday schedule on staging

**Item:** Confirm the weekday 12-hour schedule is on the Watseka staging site, and Crescent’s 24/48 schedule is unchanged.

1. Open `https://watsekademo.staging.fireultimate.app` and sign in.
2. Open the personnel schedule.
3. Confirm the weekday 12-hour pattern is there (Monday–Friday style days, not a blank calendar).
4. Open Crescent’s own site (`https://cifpdil.fireultimate.app` or Crescent staging) and open its schedule.
5. Confirm Crescent still shows the existing 24-hours-on, 48-hours-off pattern.

**Pass:** Watseka staging shows the weekday schedule, and Crescent’s schedule looks the same as before.  
**Fail:** Watseka staging has no weekday schedule, or Crescent’s days changed.

---

## E2 — Who can do what

**Item:** Department role permissions save and apply. Roles are User, Subadmin, Admin, and Superadmin. A department cannot invent a new role name such as secretary.

1. Sign in as an admin.
2. Go to **Admin Functions → Department Details → Access / Restrictions**.
3. Find **Who can do what**.
4. Change one action to a lower role. You should see **Saved.**
5. Sign out and sign in as a person with that lower role.
6. Try that action.
7. Sign back in as admin and set the action back to the original role.

**Pass:** The lower role can or cannot do the action in line with the choice you saved, and the only role names are User, Subadmin, Admin, and Superadmin.  
**Fail:** The save does not stick, the wrong role can still do it, or you can type a new role name.

---

## E12 — Reset password form

**Item:** Reset password is an in-app form, not a browser prompt.

1. Sign in as an admin.
2. Go to **Admin Functions → Department Details → Access / Restrictions**.
3. Open the user list.
4. Click **Reset Password** on one user.
5. Look at the form that opens.

**Pass:** You see password fields and **Save Reset Password** inside the page.  
**Fail:** A small browser popup asks for the new password.

Do not save a new password unless you intend to change that account.

---

## E16 — Staging website is its own Render service

**Item:** The staging website is a separate Render service from production.

1. Open the Render dashboard.
2. Find the service that serves the staging website.
3. Find the service that serves the production website.
4. Confirm they are two different services.

**Pass:** Staging and production are separate services.  
**Fail:** One service serves both, or you cannot find a staging frontend service.

---

## F5 — Canceled en route fills the times

**Item:** Checking **Dispatched and canceled en route** fills Dispatch, Canceled, and Clear with the call arrival time.

1. Open a NERIS report that already has a call arrival time under **Incident Times**.
2. Open **Resources**.
3. Check **Dispatched and canceled en route** on a unit.
4. Look at Dispatch Time, Canceled Time, and Clear Time.

**Pass:** Those three times fill with the call arrival time.  
**Fail:** They stay empty and you have to type them.

---

## G2 — Billing preview uses the NERIS receipt

**Item:** Fire Recovery preview opens only after NERIS accepted the export. Confirm is a second click. Nothing bills by itself.

1. On staging, open an exported motor-vehicle report.
2. Go to **Reporting → NERIS → View Exports**.
3. Open the Fire Recovery panel for that incident.
4. Click **Preview & Send**.

**Pass:** The preview opens because NERIS already accepted the report. A second click is required before anything is sent.  
**Fail:** Preview opens with no NERIS acceptance, or the bill sends on the first click.

Do not click **Confirm and send** unless you mean to send a sandbox bill.

---

## G3 — A second send does not create a second bill

**Item:** An incident already marked Sent cannot be billed again. The same tracking ID stays.

1. On **staging**, open a Fire Recovery incident that is already **Sent** and has a tracking ID. Write the tracking ID down.
2. Try **Confirm and send** again.
3. Read the message and check the tracking ID.

**Pass:** The screen refuses the second send and the tracking ID is unchanged.  
**Fail:** A second bill is created or the tracking ID changes.

Do this on staging. Do not send another live production bill for this check.

---

## N14 — Narrative Builder section and Resources values

**Item:** In Narrative Builder, pick a NERIS section first, then a field from that section. Resources includes the unit-card values from the report.

1. Sign in as an admin.
2. Open **Admin Functions → Narrative Builder** (the template designer).
3. Edit a template or start a new one.
4. Set the segment type to **NERIS field**.
5. Use the first box and choose **Core**. The second box should list Core fields only, not the whole report.
6. Change the first box to **Location**, then **Incident Times**. Each time, the second box should change to that section’s fields.
7. Change the first box to **Resources**.
8. Confirm the second box includes the older resource fields and these unit-card values: **Apparatus that responded**, **Number of personnel on scene**, **Personnel on scene**, **Each unit (all values)**, unit types, staffing, response modes, transport modes, personnel by unit, each time (dispatch, en route, staged, on scene, returning, canceled, clear), **Dispatched and canceled en route**, report writers, and unit narratives.
9. Add **Apparatus that responded** and **Number of personnel on scene** to the template and save.
10. Open a NERIS report that has at least one unit with a unit ID and personnel who were not canceled en route.
11. Insert that template into the narrative.

**Pass:** The section box filters the field list, Resources offers the unit-card values, and the inserted narrative shows the unit IDs and the personnel count from those cards.  
**Fail:** You still scroll one long field list, a unit-card value is missing, or the narrative stays blank when the Resources cards have data.

---

## N15 — Validate/Export keeps Export

**Item:** Admins can validate and export in one click, or export an already validated report with the old Export button.

1. Sign in as an admin (not only as a regular user).
2. Open a NERIS report that still has a required field empty.
3. Confirm you see **Validate**, **Validate/Export**, and **Export**.
4. Click **Validate/Export**.
5. Fix the missing field so validation can pass. Use a test or staging report you are allowed to export.
6. Click **Validate/Export** again.
7. Open a second report that is already validated and has no errors.
8. Click **Export** (not Validate/Export).
9. Sign in as a regular user and open a NERIS report.

**Pass:** Step 4 stops and lists the errors, and nothing is exported. Step 6 exports after validation passes. Step 8 exports without making you validate again. A regular user does not see **Validate/Export** or **Export**.  
**Fail:** Validate/Export exports a report that still has errors, Export is gone, or a regular user sees Validate/Export.

Do not export a live production report unless you mean to send it to NERIS.

---

## N16 — Import and Get Incident (Test) are superadmin only

**Item:** Import and Get Incident (Test) show only for superadmin. After you confirm that, decide whether these buttons should stay.

1. Sign in as an admin who is not a superadmin.
2. Open a NERIS report.
3. Look at the buttons at the top. You should still see **Print**, **Delete**, **Validate**, **Validate/Export**, and **Export**.
4. Sign in as a superadmin.
5. Open a NERIS report.
6. Look for **Import** and **Get Incident (Test)**.
7. Click **Import**.
8. If the report already has a NERIS ID from an export, click **Get Incident (Test)** and read the response panel.

**Pass:** The admin account does not see Import or Get Incident (Test). The superadmin account sees both. Import does nothing because it is still not built. Get Incident (Test) shows the NERIS response when the report has a NERIS ID.  
**Fail:** An admin sees those two buttons, or a superadmin cannot see them.

After this passes, say whether Import and Get Incident (Test) should stay or be removed.
