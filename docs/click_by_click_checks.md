# Click by Click Checks

Use this list when the priority file status is **Waiting on click check**.

Each check has an ID, the item, and numbered steps. After you run a check, tell the agent pass or fail so the priority status can move to Done or back to Open.

**Updated:** 2026-11-17, evening America/Chicago. N14, N15, and N16 passed and were removed.

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

## N18 — Complete and Collapse saves the unit

**Item:** On Resources, **Complete and Collapse** saves the unit when that unit has no errors.

1. Open a NERIS report and go to **Resources**.
2. Expand a unit, add personnel, and fill the required times.
3. Click **Complete and Collapse**.
4. Confirm the page says **Resources unit saved.**
5. Reload the report.
6. Open **Resources** again.

**Pass:** The unit is collapsed, marked complete, and the personnel and times are still there after reload.  
**Fail:** The message does not say the unit was saved, or the personnel and times are gone after reload.
