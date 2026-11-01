# November 1, 2026 — staging is updated

This is the plain-language summary of the session that put Stage B on Crescent staging.

## What you can use now
Crescent staging (`https://cifpdil.staging.fireultimate.app`) is running the new program. Your click test passed about 2:09 p.m. Chicago time. Nothing in that test failed.

You confirmed:
- Sign-in, the dashboard, logout, and sign-in again.
- Allowed Senders shows `dispatch@co.iroquois.il.us`, exact email, turned on. Leave that row in place.
- Raw Email opens. A message from a personal address did not show up. That is the expected result.
- Incidents open. NERIS Validate listed the required fields. Change history worked. The report showed In Review on NERIS and on View Exports. Export was not clicked.
- `https://cifpdil.staging.fireultimate.app/API/users` showed an error, not a user list.
- Five wrong passwords locked the staging username `admin` for 15 minutes. `admin1` still signed in.

## What was saved before the new program started
- A Neon backup named `backup-2026-11-01-before-stage-b` in the staging project, with 22 incidents. Leave that backup alone.
- The Crescent sender address above, saved before the new program went live.
- Four new tables on the live staging database: Session, RolePermission, AccountAuditLog, and NerisReportChange.

## Two items parked for later
These are not failures. They are not built yet.
1. On a NERIS report, checking “Dispatched and canceled en route” should fill Dispatch Time, Canceled Time, and Clear Time with the call arrival time. It did not. You typed the times.
2. Edit My Display stays on the computer’s browser. It stayed after logout and showed up for `admin1` in the same browser. A different browser did not have it. Later, those choices should be saved for each person.

Also still parked from earlier: Recover Reports, the incident Status list (Draft should not be a choice), dragging columns in Configure Table, and hiding left-menu items from Submenu Display Settings.

## Settings that must stay as they are
- Staging build command: `npm ci --engine-strict=false && npm run build`. The first build failed because an unused helper asks for Node 22. The flag lets the install finish on Node 20. Do not change the Node version.
- Do not add `NODE_ENV` in the Render dashboard. Render already sets it for the running server. A dashboard copy broke an earlier build.
- Do not create a Fire Recovery key, and do not save a Fire Recovery password in production.

## What is not done
Production is still the older program, plus the one-line admin-key fix from earlier the same day. A production update needs its own backup, its own database steps, the Crescent sender saved first, and a separate yes from you. That pass was not started.

The practice copy of the docs is ahead of the staging program by notes only. Those notes were not pushed onto the staging branch, so staging does not rebuild just because the notes were saved.
