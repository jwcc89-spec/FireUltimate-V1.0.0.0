# Session summary — October 31, 2026

**Read this for a condensed view of the click-through.** Technical detail for the next agent is in `sessions/2026-10-31-session.md`. Active status is in `ACTIVE_CONTEXT.md`.

This was the Stage B click-through on the practice copy only. Crescent's live site and the staging site were not changed.

## What you confirmed

- A new report's first save no longer lists every field that was filled in from the incident. Change history shows the names you see on the form, without underscores. It still does not show the old and new text. That is the rule we kept: who, when, which report, and which field names, kept forever, inside that report.
- Deleting a report takes it off the NERIS list. The incident stays on the Incidents tab. From the open incident, **Open NERIS report** opens it again.
- Saving from a second browser window opens a pop-up titled **This report was not saved**, with Reload. You confirmed that pop-up.
- Admin Functions → Customization: editing a dispatch workflow state lets you keep typing. You confirmed that.
- Dashboard **Edit display** is at the top right, next to Open Calendar and Open Incidents. An admin or a regular user can hide Active Calls, Units Available, Pending Reports, Unread Messages, Priority Shortcuts, and Live Alerts on this computer. Those number boxes are sample figures. They are not live department totals.
- Saving a NERIS Entity ID in Admin Functions fills that ID on the report. That save is only on this practice copy.
- Leaving the computer signed you out (60 minutes). Five wrong passwords showed "Too many failed sign-in attempts. Try again in 15 minutes."

## What we fixed along the way

- The NERIS list now uses the status you just saved, so Validate can show In Review without a full browser refresh.
- A delete from the current practice copy keeps the answers that were typed. Opening the report and saving puts it back on the NERIS list.

## What cannot be undone

Incident 27 Test and Test Incident were deleted by an earlier version that cleared the typed answers. Those answers are gone. The incidents themselves stayed. A future Recover Reports button cannot bring those two answer sets back.

## Parked — not built

You asked to write these down and leave them for later. They are on the repair plan under **Parked & future** and in **Decisions** (October 31, 2026).

1. **Recover Reports.** A button on Reporting → NERIS, next to Fire Recovery and View Exports, that puts a deleted report back with every typed answer.
2. **Status on an open incident.** That box is unit status. Draft should not be a choice. It is not the NERIS report status (Draft, In Review, Exported), and it is not the dispatch workflow list under Customization.
3. **Incidents → Configure Table.** Dragging columns does not work. The column layout stays on each computer.
4. **Submenu Display Settings.** Unchecking a box should hide that item from the left menu. Edit Display on the submenu cards is what shows or hides cards on the menu page.

## Are we ready for Stage C?

Stage B on this practice copy is done. Stage C has **not** been started.

The line above was the instruction at the end of the click-through. Later the same evening it was replaced. The next agent starts Part 3 of the security plan on this practice copy without waiting for another start command. See **Later the same evening — security handoff** at the bottom of this file. That work stays off staging and off Crescent's site.

Two answers are still needed before those later Stage C pieces are built:

- Which email address Fire Recovery should use for the sandbox Welcome Message.
- Reporting tab changes for billing: Is Resident, which vehicle-party fields are required, and where the incident-level Law Enforcement Number lives.

Parked items above do not have to be finished before Step 10.

## Still do not merge

This practice copy is pull request 31. It must not be merged until the new sign-in, permission, account-log, and report-history tables exist on staging, with a fresh backup and your approval. Production stays on its current version until a planned release.

## Repair plan

https://cursor.com/canvas/store-145781ad-9ad5-4dec-b4ef-ebe57ce55ee4/3b7445ce-b395-4e16-b948-f84dab1ca136

Open **Parked & future** for the four parked items, and **Decisions** for the October 31 rows.

## Later the same evening — security handoff

The click-through section above still describes Stage B. After that, the security plan was started on this same practice copy.

- Part 1 (password changes, the backup, the counts, and confirming the CAD secret name exists) is complete.
- Part 2 code is built and tested. It is not on staging or Crescent's site. Sign-in still locks after 5 wrong passwords. CAD mail is refused when the intake secret is missing, and it is refused when a department has no allowed sender.
- The screen that lets you add `dispatch@co.iroquois.il.us` stays in Stage D, repair-plan step 23. Do not build that screen in the next coding session. Do not release this practice copy until that address is saved, because an empty sender list now rejects mail and saves nothing.
- The next agent starts at Part 3 of `docs/plans/security-remediation-plan.md`: Fix 5, then Fix 6, then Fix 7. Fix 5 is the server-written NERIS export record (the security piece of repair-plan Step 10). It does not start the Fire Recovery email, Recover Reports, or the parked screens.
- Do not merge pull request 31. Do not save a Fire Recovery password in production until those three fixes are live there.

## Later the same evening — Part 3 built

A new coding session on this same practice copy built the three security fixes. They are not on staging and not on Crescent's site.

- After NERIS answers, the server writes the export record. The browser can no longer write a "success" record. A bill can use only a record the server wrote.
- The Fire Recovery password is encrypted before it is saved. The encryption key is a Render setting named `FIRE_RECOVERY_CREDENTIAL_KEY`. That setting was not created. Do not type a Fire Recovery password into production until these fixes are live there.
- Only an admin can see billing information, unless an admin later gives that permission to another role. A person without it sees the sentence "Billing information is not shown for this sign-in." They do not see invoice amounts, and they do not see an error.
- The screen that adds `dispatch@co.iroquois.il.us` is still Stage D, step 23. Do not release this practice copy until that address is saved.
- The repair-plan file in the repo matches that work. The live canvas was still the older plan when this note was written. The next person who opens the plan should republish canvas id `3b7445ce-b395-4e16-b948-f84dab1ca136` from `docs/plans/canvases/repair-plan.canvas.tsx` and leave the title as "Fire Ultimate repair plan."
