# Click by Click Checks

Use this list when the priority file status is **Waiting on click check**.

Each check has an ID, the item, and numbered steps. After you run a check, tell the agent pass or fail so the priority status can move to Done or back to Open.

**Updated:** 2026-11-17, evening America/Chicago. G2 preview size and N12 Not Sent behavior are ready to check after the next staging deploy.

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

## G2 — Billing preview uses the NERIS receipt

**Item:** Fire Recovery preview opens only after NERIS accepted the export. The preview is large enough to read Incident Type and Alarm without scrolling. Confirm is a second click. Nothing bills by itself.

1. On staging, open an exported motor-vehicle report.
2. Go to **Reporting → NERIS → View Exports**.
3. Open that export.
4. Click **Preview & Send**.
5. Read **Incident type** and **Alarm**.

**Pass:** The preview opens because NERIS already accepted the report. Incident type and Alarm fit in their boxes. You do not have to scroll left, right, up, or down for that short preview. A second click is required before anything is sent.  
**Fail:** Preview opens with no NERIS acceptance, the bill sends on the first click, or Incident type / Alarm spill out of their boxes.

Do not click **Confirm and send** unless you mean to send a sandbox bill.

---

## N12 — Not sent opens the bill preview

**Item:** On View Exports, **Not sent** opens Preview & Send for a billable motor-vehicle call. A call that is not billable shows a grey long dash and cannot be clicked.

1. On staging, go to **Reporting → NERIS → View Exports**.
2. Find an exported motor-vehicle call whose Fire Recovery box says **Not sent**.
3. Click **Not sent**.
4. Find a call that is not a motor-vehicle incident.

**Pass:** The motor-vehicle click opens the same preview, and **Confirm and send** is a separate click. The other call shows a grey long dash and does not open anything.  
**Fail:** Not sent does nothing on a billable call, sends the bill on the first click, or a non-billable call can still be clicked.

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
