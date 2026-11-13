import {
  Callout, Card, CardBody, CardHeader, Divider, Grid, H1, H2, H3,
  Pill, Row, Stack, Table, Text, useHostTheme, useState,
} from "cursor/canvas";

interface Step {
  n: string;
  title: string;
  status?: "Done" | "Next" | "Updated" | "New";
  problem: string;
  why: string;
  fix: string;
  who: string;
  done: string;
}

interface StageDef { id: string; name: string; summary: string; steps: Step[] }

const stages: StageDef[] = [
  {
    id: "A", name: "Stage A — Get our bearings (no coding)",
    summary: "Confirm what is actually running, make sure we can undo mistakes, and study Crescent's real CAD emails.",
    steps: [
      { n: "1", title: "Find out what is live right now", status: "Done",
        problem: "GitHub shows the code, but not which version the real websites run.",
        why: "We must fix the code departments actually use, and know where real data lives.",
        fix: "Checked Render, Neon, and Cloudflare (October 28, 2026). Results are in the 'Findings' tab.",
        who: "You, with guidance.",
        done: "Completed: production runs main (3f9b97a), staging runs the side branch (2d985fa), databases are separate, and CAD emails go to staging." },
      { n: "2", title: "Make backups of both databases", status: "Done",
        problem: "Neon can only rewind the last 6 hours on both databases.",
        why: "A backup is the undo button. Crescent's NERIS data must never be lost.",
        fix: "Created Neon backup branches on October 28, 2026: backup-2026-10-28-before-repairs in fireultimate-prod (62 incidents) and backup-2026-10-28-before-repairs-staging in fireultimate-staging (22 incidents, 86 CAD emails). A manual backup will be taken before every future change, even after a plan upgrade. A downloaded copy stored outside Neon is an optional extra layer, covered later.",
        who: "You, with guidance.",
        done: "Completed: both backup branches exist with tables visible and row counts recorded in the 'Findings' tab." },
      { n: "3", title: "Study Crescent's CAD setup and example emails", status: "Done",
        problem: "We did not know how Crescent's dispatch formats its emails or what parsing rules were saved on staging.",
        why: "The CAD fixes and the self-service setup must be built around real email patterns, not guesses.",
        fix: "Reviewed staging's Dispatch Parsing Settings and two real calls (one with 2 emails, one with 3) on October 28, 2026, plus your explanation of how the Incidents and Reporting tabs are meant to work together. Findings are in the 'CAD, incidents & reports' tab.",
        who: "You, guided; I analyzed.",
        done: "Completed: Crescent sends a short dispatch email (sometimes repeated as notes are added) and a closing summary email. No parsing rules exist yet." },
      { n: "4", title: "Pick one code version to build on, set up access, and answer the business questions", status: "Done",
        problem: "There appeared to be two code versions: production's (main, April 9) and staging's (the side branch, April 10).",
        why: "Selling to hundreds of departments requires one shared code version. Departments differ only by settings stored in the database, never by separate code.",
        fix: "Checked October 28: staging's version already contains everything production's version has, plus 19 newer changes (CAD Batches A–I and Fire Recovery). A trial combination in a throwaway copy matched staging's version exactly, with no conflicts. So no combining work is needed. October 29: re-checked (still identical), created the practice copy cursor/stage-b-foundation-b5ff from staging's version and saved it to GitHub, and you answered the Decisions questions (recorded in the 'Decisions' tab). Practice copy work reaches staging only when deliberately combined into the staging branch, because staging redeploys from that branch.",
        who: "You for access and decisions; me for the setup.",
        done: "Completed: the practice copy exists on GitHub, lint, build and the 15 existing tests pass on it, and the business questions are answered except the vendor items listed in 'Decisions'." },
    ],
  },
  {
    id: "B", name: "Stage B — The minimum foundation Fire Recovery and CAD need",
    summary: "These are the locks and safety checks that Fire Recovery and CAD both depend on. They also protect Crescent's live NERIS data in production and the real dispatch emails held on staging.",
    steps: [
      { n: "5", title: "Make the server actually remember who logged in", status: "Done",
        problem: "After login, the server forgets who you are and accepts requests from anyone who knows the department's web address.",
        why: "It is like a guard who checks your badge at the front door while every inner office stays unlocked. Fire Recovery must not go live before this is fixed.",
        fix: "After a correct password, the server issues a secure sign-in pass. Every later request must present it. Approved October 29: signed out after 60 minutes with no activity, locked for 15 minutes after 5 wrong passwords, cached department data cleared on logout, and closing the browser signs the person out.",
        who: "Me.",
        done: "Built on the practice branch October 29, 2026. Automated tests prove requests without a valid pass are refused. Not on staging or production until a planned release." },
      { n: "6", title: "Check permissions on the server, not just the screen", status: "Done",
        problem: "The user's role is stored in the web browser and trusted. Admin buttons are hidden, but the actions behind them are not protected. Users can be created, promoted to admin, reset or deleted without logging in; saving department settings can also change user accounts; and anyone can trigger a NERIS export.",
        why: "Hiding a button is like hiding a key under the mat.",
        fix: "The server looks up each person's real role and department for every action. User management becomes admin-only with a log of every account change, department settings saves no longer change user accounts, and NERIS export is limited to approved roles. Add Admin Functions settings where each department's admin chooses which roles may see the Incidents tab, create incidents by hand, and delete incidents (deleting is admin-only by default) — all decided October 28. Decided October 29: the same admin-grantable pattern applies to submitting Fire Recovery billing, changing CAD rules, and changing Fire Recovery settings — admin only by default, and the department admin may grant or revoke each one for other roles. The server enforces the same choices. Approved October 29: sending a NERIS report and sending a NERIS report for billing are admin-only by default, and creating an incident by hand is admin-only by default.",
        who: "Me; role defaults are decided (admin only, grantable by the department admin).",
        done: "Built on the practice branch October 29, 2026. Tests prove a regular user cannot create an incident, send a NERIS report, send billing, or create an account, and that saving department settings does not delete accounts. Not on staging or production until a planned release." },
      { n: "7", title: "Prove departments are fully separated", status: "Done",
        problem: "Records are tagged by department, but separation relies only on the web address, which may be fakeable. All departments also share one set of NERIS login credentials.",
        why: "With hundreds of departments, an admin change in one must never affect another.",
        fix: "Tie every account to one department, accept only trusted address information from Render, and add automated tests that create two pretend departments and prove neither can see or change the other's data. Review the shared NERIS credentials before onboarding additional departments.",
        who: "Me.",
        done: "Built on the practice branch October 29, 2026. Two pretend departments cannot see or change each other's incidents, reports, accounts, settings, billing, schedule, or CAD emails. A forged address header does not switch departments. A department cannot send a NERIS report as another department's entity ID. Decided October 30: departments do not log in to NERIS. FireUltimate keeps one vendor key on the server. Each department exports only under the NERIS Entity ID an admin sets in Admin Functions. Not on staging or production." },
      { n: "8", title: "Update outdated software pieces", status: "Done",
        problem: "Some third-party components have publicly known security flaws, one rated critical.",
        why: "Known flaws are the first thing attackers try.",
        fix: "Upgrade and re-test everything.",
        who: "Me.",
        done: "Upgraded on the practice branch October 29, 2026. The security scan reports no remaining issues, including the critical proxy-addr flaw. Not on staging or production." },
      { n: "9", title: "Turn on automatic checks and safe release rules", status: "Done",
        problem: "Existing tests never run automatically, and there is no written release procedure that protects live data.",
        why: "Tests catch accidental breakage; release rules protect Crescent's data.",
        fix: "Run all tests on every change, add a temporary practice database for server tests, and follow the rules in the 'Data safety' tab for every release. The release checklist wording was approved October 30 and saved as docs/procedures/RELEASE_CHECKLIST.md.",
        who: "Me.",
        done: "Built on the practice branch October 30, 2026. GitHub runs lint, build, and the automated tests against a throwaway Postgres database that is discarded after the run. The release checklist is saved. Not on staging or production." },
      { n: "9A", title: "Protect incidents and NERIS reports on the server", status: "Done",
        problem: "The 'locked when In Review or Exported' rule is enforced only on screen, so the server still accepts edits. If two people edit the same report, the last save silently wins, and there is no change history. Changing the NERIS Entity ID in Admin Functions can leave export using the old ID.",
        why: "A submitted NERIS report could be changed behind the scenes, and one person's edits could silently erase another's.",
        fix: "Approved October 30. The server refuses edits when a report is In Review (Validate passed) or Exported. A Draft stays editable by anyone who can edit reports. Anyone who can edit reports can unlock an In Review report that has not been exported, so a firefighter can fix it. Once a report is Exported, only an admin can unlock it. If two people edit at once, the second save stops with: 'Someone else saved this report while you were editing. Reload to see their changes before saving again.' A new add-only history list records who saved, when, which report, and which field names changed (not the old and new text). History is kept forever and is shown inside that report. Deleting requires the report to be unlocked first, and only an admin can delete. Saving the NERIS Entity ID in Admin Functions updates the ID export uses.",
        who: "Me.",
        done: "Built on the practice branch October 30, 2026. Tests prove a locked report cannot be edited or deleted until it is unlocked, a firefighter can unlock an In Review report but not an Exported one, a second simultaneous save is refused, change history stores field names only, and export uses the entity ID last saved by an admin. Not on staging or production." },
      { n: "9B", title: "Clean up production leftovers", status: "Done",
        problem: "Test accounts admin/admin and demo/demo may exist from initial setup; NODE_ENV is not set on either Render service; some settings exist only in one person's browser.",
        why: "NODE_ENV turns on the stricter production check for CAD email, and browser-only settings differ between computers. The starter accounts stay, by your choice on October 30.",
        fix: "Approved October 30. Keep the admin and demo accounts; do not delete them. During a planned release, set NODE_ENV=production on both Render services. Move these to the server so the whole department shares them: department logo (500 KB limit), dispatch workflow states, submenu display settings, and submenu cards. Leave each person's incident list layout and sidebar width on their own computer. Shift trades wait for the scheduling review.",
        who: "Me, with you confirming in Render and the app.",
        done: "Built on the practice branch October 30, 2026. The department logo (500 KB limit), dispatch workflow states, submenu visibility, and submenu cards are stored on the server for the whole department. Incident list layout and sidebar width stay on each computer. The admin and demo accounts were kept. NODE_ENV=production is written into the release checklist and is set only during a planned release. Not on staging or production." },
      { n: "9C", title: "Close the web-address tricks that skip sign-in and permissions", status: "New",
        problem: "Found October 31 in the post-remediation security check. Changing letter case in the address (for example /API/users) skips sign-in. Adding a trailing slash or changing case skips role permissions. On production and staging today, /API/admin/... skips the program owner's platform admin key.",
        why: "Anyone could read accounts, CAD emails, and department settings, create incidents, or change Fire Recovery settings without signing in. On the live sites, anyone could create a department or attach a web address to an existing one.",
        fix: "Security plan Part 0: run two read-only checks for unknown departments and web addresses, then decide on a one-line emergency fix for the platform admin key on main and staging. Security fixes 8–10 on this practice branch: make routes match exact letter case and no trailing slash, make the sign-in and permission checks use the same rule, close the lockout-reset gap, and stop sending internal error details. Each needs your approval first (authorization and sign-in code). Full detail: docs/plans/security-remediation-plan.md.",
        who: "You for the read-only checks and approvals; me for the code.",
        done: "Not started. Done when automated tests request every API route with capital letters and a trailing slash and none returns data without permission, and the same checks pass on staging. Stage B must not be released before this." },
    ],
  },
  {
    id: "C", name: "Stage C — Fire Recovery billing (first priority)",
    summary: "Bill only verified incidents, exactly once, with correct information. Fire Recovery is not in production yet, so this is building it correctly before release.",
    steps: [
      { n: "10", title: "Have the server record NERIS export results itself", status: "Updated",
        problem: "Billing uses an 'export succeeded' record that the browser writes. Anything not marked 'failed' is saved as success. The same weakness affects NERIS export history in production today.",
        why: "It is like a bank accepting a customer's handwritten note saying a check cleared.",
        fix: "The server writes an official receipt only after NERIS replies. The receipt includes the NERIS ID, time, who exported it, and the payload that was sent. November 1: this receipt (security fix 5) is on staging. Production is not updated. The browser can record only a failure that never reached NERIS. A separate tamper-check fingerprint is not in this pass.",
        who: "Me.",
        done: "Tests prove the browser cannot create a success record. Met on the practice branch October 31, 2026. Not released." },
      { n: "11", title: "Bill only from verified receipts, with a preview", status: "Updated",
        problem: "Billing does not check where its data came from or who is submitting.",
        why: "Billing must be based on the official, confirmed report and sent only by authorized staff.",
        fix: "The 'Send to Fire Recovery' button appears only for incidents with an official receipt and only for approved roles (decided October 29: admin by default; the department admin may grant it to other roles in Admin Functions). The person submitting sees a preview of exactly what will be sent and clicks Confirm. Nothing is ever billed automatically. November 1: viewing billing is a separate permission, billing.view, defaulting to admin (security fix 7). That permission is on staging. Production is not updated. The preview and Confirm click are still later. Also decided November 1: only vehicle accidents are billed at launch. Crescent's admin will grant billing to officers, which needs both 'Send a NERIS report for billing' and 'View billing information'. Incidents exported before the server receipt existed are billed with a button that exports the report to NERIS again and then opens the preview. No override skips the receipt.",
        who: "Me.",
        done: "Tests prove unverified incidents and unauthorized users cannot bill." },
      { n: "12", title: "Prevent double billing",
        problem: "Submitting again sends the incident again and overwrites the previous tracking number.",
        why: "A double-click or retry could bill twice and lose the original tracking number.",
        fix: "On Confirm, the incident is marked Submitting so repeats are ignored. Corrections require a separate Correct/Resubmit action with a reason that follows Fire Recovery's rules and keeps the original tracking number on record. The API has no update or cancel method — only add, attachments, and billing status. Your understanding (October 29): corrections are made by logging in to Fire Recovery's Recovery Hub (therecoveryhub.com) directly. After sandbox testing we confirm this with Fire Recovery in the single combined email (see 'Decisions'), then the Correct/Resubmit action becomes a guided 'correct this in Recovery Hub' step that records who, when and why in our history. November 1: if Fire Recovery's reply is unclear (time limit reached, unreadable reply, or no tracking ID), the incident shows 'Needs review: check Recovery Hub' and cannot be sent again until an admin clears it. A failed retry must never hide an earlier successful bill and its tracking ID.",
        who: "Me; Fire Recovery USA confirms the correction process.",
        done: "Tests prove repeated clicks create only one submission." },
      { n: "13", title: "Protect the Fire Recovery password and use the sandbox department ID for testing", status: "Updated",
        problem: "Vendor passwords are stored as readable text. Fire Recovery confirmed October 29 that testing happens on their real address (process.firerecoveryusa.com) using a sandbox department NERIS ID, FD12345678; there is no separate test site for us. Today the app always sends the department's own NERIS ID (the same one used for NERIS exports), so a test from staging would send Crescent's real ID to Fire Recovery's real system.",
        why: "With one shared address, the department ID is the only thing separating a test from a real bill.",
        fix: "Encrypt stored passwords. Add a per-department 'Fire Recovery department ID' setting, separate from the NERIS export ID, so staging can use FD12345678 while NERIS exports keep the real ID. Staging refuses to submit with any ID other than the sandbox ID, and every submission screen shows which ID will be used. No subscription key is needed for this method. Fire Recovery sets up the sandbox after you reply with the account email; the Welcome Message holds the API login, which is entered only in the app's settings screen, never in chat. November 1: encryption (security fix 6) is on staging. Production is not updated. The key is the Render setting FIRE_RECOVERY_CREDENTIAL_KEY. Do not create that setting in a coding session. Do not save a Fire Recovery password in production until fixes 5–7 are live there. The separate sandbox department ID setting is not built yet. November 1 decision: replace the per-department setting with a Render setting. On staging it makes every Fire Recovery submission use FD12345678. Production refuses FD12345678 and sends the department's own NERIS ID. No database change. November 1 evening: Wave 1 of that switch is on the practice branch only. Sandbox always sends FD12345678, live refuses FD12345678, and an unset mode refuses every submit. The settings screen shows which ID would be sent. The Render setting is still not created. Do not create it until Wave 7. This code is not on staging.",
        who: "Me; you set the Render setting on staging and reply to Fire Recovery with the account email.",
        done: "Passwords are encrypted, and tests prove staging can only submit with sandbox ID FD12345678 and production refuses it." },
      { n: "14", title: "Handle vendor outages and errors clearly",
        problem: "If Fire Recovery is slow or down, a request can hang. The screen only shows not sent or DataSent.",
        why: "Staff need to know whether a bill went out, failed, or needs attention.",
        fix: "Add time limits; statuses Not sent, Submitting, Sent, Failed, Needs review, and Paid/Balance due; plus a history of every attempt showing who, when, what was sent and what came back. Flag 'Billing may be out of date' if a billed report is later edited—never re-bill automatically. November 1: count a submission as accepted only when Fire Recovery's reply has Status 1 and a tracking ID. Billing status and amounts are also shown in the NERIS report's export view, not only on the Fire Recovery screens. For the 24-hour launch, the time limit, Failed and Needs review come first; attempt history and the out-of-date flag may follow right after.",
        who: "Me; you approve status wording.",
        done: "Simulated outages show a clear Failed status and no duplicate bill." },
      { n: "15", title: "Send every field Fire Recovery requires, from the Reporting tab", status: "Updated",
        problem: "Checked October 29 against the code: the billing request sends only a small block (incident number, NERIS ID, type, personnel count, filed-by). It never sends the call details or any parties. The report form has no Law Enforcement Number field, so the code falls back to the dispatch final disposition. Personnel is counted from unit staffing, not the people selected. The Person/Owner > Vehicle section is never read for billing, none of its fields are required, and there is no 'Is Resident' field anywhere. Fire Recovery's current documentation accepts all of these details in the same request.",
        why: "Missing required fields lead to rejected or unpaid invoices.",
        fix: "Fire Recovery's requirements (from you, October 29). Call details, required: date of incident, time alarm received, time call cleared, run number, personnel on scene (people selected on the run report for units that arrived on scene), and incident location. Call details, helpful: Law Enforcement Agency Report Number and NFIRS code. Parties: one per vehicle (a 2-vehicle accident has 2 parties). Each party requires first name, last name, address, Is Resident (yes/no), insurance company, and vehicle make and model. Helpful: phone, policy number, insurance contact number, VIN and license plate. All of this comes from the Reporting tab's Person/Owner > Vehicle section. Changes: add the 'Is Resident' question, mark the required party fields as required when the incident is a vehicle accident, decide where the incident-level Law Enforcement Number lives (the Vehicle section has a per-vehicle police report number today), and map every field into the billing request. November 1 final design (full detail in docs/plans/PHASE_C_FIRE_RECOVERY_PLAN.md): a new Fire Recovery Billing tab in the NERIS report, laid out like Recovery Hub's 'Create New Motor Vehicle Incident' form. Call details are copied from the report. Party cards are typed in or copied from Person/Owner. The Person/Owner tab is unchanged. Required by default: first and last name, address, Is Resident (lives in the fire district; required for Crescent by ordinance), insurance company (waived by Uninsured), and vehicle make and model. Admins can change these levels. Billing fields never block NERIS export. Found November 1: since security fix 5, the export receipt holds only the NERIS payload, so billing currently receives none of the report's answers. Billing will read the server-saved, Exported report instead. Send the narrative and responding units, as Fire Recovery's documentation asks. Fire Recovery's full API documentation is saved in docs/procedures/vendor/. It marks no field as required, so Crescent's minimums stay the rule. November 1 evening: Wave 2 of that tab is on the practice branch only. The section appears after Person/Owner for the three motor-vehicle types, is read-only when the report is In Review or Exported, and prints a summary. Copy from Person/Owner stores names, not list positions. Admins set billing requirement levels under NERIS Required Fields. NERIS export does not send this section. The vendor mapping is still the old short payload. This code is not on staging.",
        who: "Me; you approve the Reporting tab changes.",
        done: "The preview shows every required field filled, a 2-vehicle test incident sends 2 parties, and missing required fields block submission with a clear message." },
      { n: "16", title: "Build automated billing tests with a fake vendor",
        problem: "Billing has no tests.",
        why: "We should never need real invoices to discover a bug.",
        fix: "Create a pretend Fire Recovery service to test success, failure, timeouts and repeats.",
        who: "Me.",
        done: "Billing tests run automatically on every change." },
      { n: "17", title: "Test on staging with Fire Recovery's sandbox, then send one combined email", status: "Updated",
        problem: "There is no record of a successful real-world test, and several questions for Fire Recovery are still open.",
        why: "Passing tests still need one controlled real-world check, and one clear email gets better answers than several partial ones.",
        fix: "I write a click-by-click checklist; you run it on staging using the sandbox department ID FD12345678, including a billing status check with the returned tracking ID. Afterwards I draft one email to Fire Recovery with the test results and every open question (listed in 'Decisions').",
        who: "You, with my checklist and email draft.",
        done: "Checklist completed, Fire Recovery confirms the sandbox incidents, and the combined email is sent." },
      { n: "18", title: "Release Fire Recovery to production", status: "Updated",
        problem: "Production does not have this feature yet. Releasing also brings the CAD Batches A–I code and four database additions that production has never received.",
        why: "Release only after every earlier step passes, including Stage B.",
        fix: "Manual backup, rehearse the four database additions and the release on a copy of production, release, then submit one controlled real incident. CAD automation stays switched off for Crescent until Stage D. November 2: the staging sandbox bill passed. Do not start production until Fire Recovery answers whether the Welcome login works for real bills. The operator sent that email the night of November 1 and is waiting.",
        who: "Both of us.",
        done: "One verified production billing submission, and Crescent's existing data unchanged." },
    ],
  },
  {
    id: "D", name: "Stage D — CAD dispatch email automation (second priority)",
    summary: "Two layers: the incident is CAD's live 'what's happening now' record, read-only for users and kept current by CAD; the run report belongs to the crew and is created and filled from CAD but never overwritten against their work. Each email is processed once, and all emails for a call land on one incident and one report. CAD automation is not in production yet; emails currently arrive on staging.",
    steps: [
      { n: "19", title: "Ignore repeat deliveries of the same email",
        problem: "If the email relay does not get a quick confirmation, it delivers the same email again, and the server treats it as new.",
        why: "Repeats add duplicate notes or duplicate incidents, and later would send duplicate alerts to responders.",
        fix: "Give each email a unique fingerprint based on its message ID and contents, and skip any fingerprint already processed.",
        who: "Me.",
        done: "Sending the same email five times has the same result as sending it once." },
      { n: "20", title: "Guarantee one incident per call number", status: "Updated",
        problem: "Nothing in the database prevents two incidents with the same call number, and two emails arriving together can both create one. Crescent's call number appears in two different places depending on the email type.",
        why: "Crescent's dispatch, notes-update and closing emails must all land on the same incident and the same run report, never create another.",
        fix: "A database rule allows only one active incident per call number per department; create-or-update happens as one protected action. The call-number rule must read it from the start of the short email and from after 'CAD CFS:' in the closing email. Decided October 29: for Crescent, the matching number is the county CAD number (for example 26017007), which fills the report's dispatch number. The 'Department CFS' number is not used. Crescent's own incident number (for example 26-079, resetting November 1) and the number sent to NERIS are typed by hand in the Reporting tab, because CAD resets on January 1.",
        who: "Me; requires your approval for a database change.",
        done: "Simultaneous-email tests produce exactly one incident, and both Crescent email types match the same incident." },
      { n: "21", title: "Keep the live incident accurate and CAD-only", status: "Updated",
        problem: "The incident is CAD's live record, but today a later email can blank out information it does not contain, repeated notes are added again, deleted incidents get recreated, emails without a call number have no review path, and users can edit CAD incidents by hand. Crescent's notes-update email repeats every earlier note, including 'ENTRY REVISED' copies.",
        why: "Responders rely on the incident for 'what's happening now' and as a quick reference for station logs; it must reflect exactly what CAD sent.",
        fix: "CAD-created incidents become read-only for users; corrections are made on the run report instead. Incidents a person creates by hand stay editable, and only roles the department admin allows may create them. If a CAD email arrives with the same call number as a hand-made incident or a deleted incident, CAD does not change or recreate it; the row shows a yellow warning triangle (⚠) for an admin to review (all decided October 28). CAD updates its own incidents from the latest email, but a missing field (such as the closing email's missing address) never erases a value; only new note entries are added (matched by time stamp); caller name and phone become standard incident fields, filled when the CAD email includes them (decided October 29); emails without a call number go to a Needs review list; and each incident shows a CAD activity log listing every email and what it changed.",
        who: "Me.",
        done: "Tests using Crescent's real email patterns prove addresses are kept, notes do not duplicate, users cannot edit CAD incidents, matching emails flag hand-made and deleted incidents with the warning triangle without changing them, and each incident shows its CAD activity log." },
      { n: "21A", title: "Auto-create and keep the run report filled in from CAD", status: "New",
        problem: "Today the run report copies CAD information only the first time someone opens it. After the report is saved, later CAD emails update the incident but never reach the report, and the closing email's unit times are not used at all.",
        why: "Your goal is for CAD to create the run report with as much information as possible, so the crew only completes what CAD cannot know.",
        fix: "Approved October 28: the first CAD email creates the run report automatically. Later emails fill any report field that is still blank or still exactly as CAD filled it. If a person has changed a field and CAD later has different information, the report shows 'CAD has newer information' with an Accept button instead of overwriting. Once the report is In Review or Exported, CAD never changes it; new information appears only as a notice. The closing email fills apparatus and unit times (enroute, on scene, returning, in quarters) for the department's own units, matched against Admin Functions > Department Apparatus. Decided October 29 for Crescent: own units are 1871, 1881, 1832 and 18Car18 (Car18); 1801 is the chief's number; Crescent28 is Crescent EMS, a separate agency. A call where only Crescent EMS is dispatched creates no incident and no run report (a per-department setting, not Crescent-only code).",
        who: "Me; you approve the report fields CAD may fill.",
        done: "Tests prove the report is created on the first email, fills in from later emails, never overwrites a person's edits, and never changes once In Review or Exported." },
      { n: "22", title: "Check parsing rules when they are saved",
        problem: "Broken rules can be saved; some complex text patterns can freeze the server.",
        why: "A typo could stop dispatch processing during an emergency.",
        fix: "Validate rules on save, reject unsafe patterns, and limit how long any rule can run.",
        who: "Me.",
        done: "Broken or unsafe rules are refused with a clear message." },
      { n: "23", title: "Control who can send CAD emails", status: "Updated",
        problem: "An empty sender allowlist accepts everyone, unknown addresses create department-less records, and there is no screen to manage senders.",
        why: "Spam or a mistaken email could become an incident, and later a false alert to responders.",
        fix: "Reject unknown addresses and add an admin screen for allowed senders. Decided October 29: when a department has no allowed senders listed, CAD emails are accepted from no one until an address is added. Crescent's only sender is dispatch@co.iroquois.il.us. October 31: the reject behavior is already on the practice branch (security fix 3). The allowed-sender screen stays in this Stage D step. Do not build that screen during security Part 3.",
        who: "Me.",
        done: "Unapproved senders are rejected and admins manage the list themselves." },
      { n: "24", title: "Never silently lose dispatch emails",
        problem: "Confirmed October 28: Cloudflare has no dead letter queue, so an email that fails 10 times has nowhere to go. Very large emails are cut off mid-message.",
        why: "A lost dispatch email means a missed incident, a missing run report, and later a missed alert.",
        fix: "Add a holding area for failed emails, an alert, and safer handling of large emails.",
        who: "Me; you add one Cloudflare setting with guidance.",
        done: "A deliberately failed email appears in the holding area and triggers an alert." },
      { n: "25", title: "Separate 'create new incidents' from 'update existing incidents'",
        problem: "One switch controls both (planned Batch J).",
        why: "A department may want updates without automatic new incidents, or the reverse.",
        fix: "Two independent switches.",
        who: "Me; requires database-change approval.",
        done: "Each switch works independently in tests and on staging." },
      { n: "26", title: "Test the server's CAD engine", status: "Updated",
        problem: "Preview and real processing use two separately maintained copies of the logic; only the preview copy is tested.",
        why: "The preview could show a different result from what real emails produce.",
        fix: "Use one shared engine, or prove both produce identical results. Use Crescent's email patterns from Step 3 (with personal details removed) as permanent test samples.",
        who: "Me.",
        done: "Automated tests prove preview equals real processing on Crescent's sample emails." },
      { n: "27", title: "Run the staging checklist, then switch CAD to production", status: "Updated",
        problem: "CAD emails currently go to staging, and the staging checklist has no recorded completion. Production does not have CAD automation. On staging the auto-create box is checked, but it does nothing because no parsing rules exist.",
        why: "Real dispatch emails must be trusted before Crescent relies on them.",
        fix: "Build Crescent's rules, run practice mode on staging for a set period, then you run the click-by-click checklist covering both the incident and the run report. Only after it passes do we release CAD to production, point the Cloudflare Worker to production, and turn auto-create on for Crescent. Decided October 29: in general, department admins turn auto-create on themselves once their field mapping is complete; no program-owner approval is required.",
        who: "You, with guidance.",
        done: "Checklist passed and one controlled production email processed correctly." },
      { n: "28", title: "Self-service CAD Setup for department admins", status: "Updated",
        problem: "Parsing rules are written in technical JSON, so the program owner or a developer would have to configure every department and fix it whenever a dispatch center changes its format. Each new department also needs its own CAD email address and Cloudflare routing rule.",
        why: "Selling to hundreds of departments requires each department admin to configure and maintain their own CAD setup without vendor code changes.",
        fix: "Decided October 29: incidents need no extra hand-entered fields, but the 'standard field list' must grow with each CAD system. Different dispatch centers send different or extra information (for example latitude and longitude, verified addresses, known offenders, police units on scene), so the field list is a shared, expandable catalog and each department maps only the fields its CAD sends. Owner level: the expandable field catalog, starter templates for common CAD vendors (Crescent's Iroquois County format becomes the first template), a health view across all departments, and a simple onboarding procedure for each department's CAD address. Department level: a guided screen to pick a template, point at and label parts of real sample emails, choose the call-number field, choose what later emails may update per field (for example 'update from latest', 'fill only if blank', 'add new information only'), choose which run report fields CAD fills, test against the last 20 emails, use practice mode, turn auto-create on once mapping is complete, keep version history with one-click undo, and handle different email types such as dispatch and closing summary. Safety: rules checked on save, alerts to the department admin and owner when the success rate drops, unreadable emails sent to a Needs review list, and complete separation between departments. Apparatus matching (including telling own units from mutual aid), a 'created by CAD' indicator, standardized times and automatic email cleanup follow afterward.",
        who: "Me, with your approval of each screen design.",
        done: "A department admin can configure and test CAD from start to finish without developer help." },
    ],
  },
];

const productionItems = [
  ["Logging in", "Server forgets you after login; role trusted from the browser", "5, 6"],
  ["User management", "Accounts can be created, promoted, reset or deleted without logging in", "6"],
  ["NERIS export history", "Fixed on the practice branch October 31. The server writes the receipt after NERIS replies. Not released.", "10"],
  ["NERIS export button", "Server does not check who exports", "6"],
  ["Report edit lock", "Fixed on the practice branch October 30. The server enforces the lock. Not released.", "9A (done)"],
  ["Report editing", "Fixed on the practice branch October 30. A second save is refused and change history is kept. Not released.", "9A (done)"],
  ["CAD email intake (production)", "Secret optional in the production code version; no sender allowlist on main", "23, 9B (secret confirmed set)"],
  ["Department settings save", "Can also create, change or delete user accounts", "6"],
  ["Default test accounts", "Kept on purpose October 30. Guessable passwords remain a risk until you change them in the app.", "9B"],
  ["Browser-only settings", "Logo, workflow, submenu visibility, and submenu cards moved to the server on the practice branch. Incident layout and sidebar width stay on each computer. Not released.", "9B (done)"],
  ["Underlying software", "Fixed on the practice branch October 29. The scan is clean. Not released yet.", "8 (done)"],
  ["Backups", "6-hour restore window", "2 (done), Data safety"],
];

const decided = [
  ["October 28, 2026", "CAD", "The first CAD email creates the run report automatically.", "21A"],
  ["October 28, 2026", "CAD", "Later emails fill run report fields that are blank or still exactly as CAD filled them.", "21A"],
  ["October 28, 2026", "CAD", "If a person changed a report field and CAD has different information, show 'CAD has newer information' with Accept; never overwrite.", "21A"],
  ["October 28, 2026", "CAD", "Locked reports (In Review or Exported) are never changed by CAD.", "21A"],
  ["October 28, 2026", "CAD", "Each department's admin chooses, in Admin Functions, which roles may see the Incidents tab.", "6"],
  ["October 28, 2026", "CAD", "CAD-created incidents are read-only for users; all information comes from CAD. Incidents a person creates by hand are the exception.", "21"],
  ["October 28, 2026", "CAD", "If a CAD email matches a hand-made incident's call number, CAD does not change it; the row shows a yellow warning triangle (⚠) for admin review.", "21"],
  ["October 28, 2026", "CAD", "Each department's admin chooses, in Admin Functions, which roles may create or enter incidents by hand.", "6"],
  ["October 28, 2026", "CAD", "If a CAD email matches a deleted incident's call number, CAD does not recreate it; it shows the same yellow warning triangle for admin review.", "21"],
  ["October 28, 2026", "CAD", "Deleting incidents is admin-only by default; the department admin can grant it to other roles in Admin Functions.", "6"],
  ["October 29, 2026", "Code", "All work starts from staging's version in the practice copy cursor/stage-b-foundation-b5ff; production stays on main until a planned release.", "4"],
  ["October 29, 2026", "Planning", "Canvas plans are the standard planning format; each plan's source is also saved in the repo under docs/plans/canvases/.", "All"],
  ["October 29, 2026", "Fire Recovery", "Submitting billing is admin-only by default; the department admin can grant it to other roles.", "6, 11"],
  ["October 29, 2026", "Fire Recovery", "Law Enforcement Number = the report number from the state police or county police agency on scene.", "15"],
  ["October 29, 2026", "Fire Recovery", "Personnel on Scene = people selected on the run report for units that arrived on scene.", "15"],
  ["October 29, 2026", "Fire Recovery", "Involved parties = people the department documents (for example vehicle occupants) with contact, insurance and vehicle details.", "15"],
  ["October 29, 2026", "Both", "Changing CAD rules and Fire Recovery settings is admin-only by default; the department admin can grant or revoke it for other roles. The same pattern applies to all settings.", "6"],
  ["October 29, 2026", "CAD", "Incidents need no extra hand-entered fields, but the standard field list is an expandable catalog that grows with each CAD system (for example coordinates, verified address, known offenders, police units).", "28"],
  ["October 29, 2026", "CAD", "Department admins turn on auto-create themselves once mapping is complete; no program-owner approval.", "27, 28"],
  ["October 29, 2026", "CAD", "Caller name and phone are standard incident fields, filled when the CAD email includes them.", "21"],
  ["October 29, 2026", "CAD (Crescent)", "The county CAD number (for example 26017007) matches emails to incidents and fills the dispatch number. 'Department CFS' is not used. Crescent's incident number (for example 26-079, resetting November 1) and the NERIS number are typed by hand.", "20, 21A"],
  ["October 29, 2026", "CAD (Crescent)", "Crescent units: 1871, 1881, 1832, 18Car18 (Car18). 1801 is the chief. Crescent28 is Crescent EMS, a separate agency. Units match Department Apparatus.", "21A, 28"],
  ["October 29, 2026", "CAD (Crescent)", "Calls where only Crescent EMS is dispatched create no incident and no run report.", "21A, 28"],
  ["October 29, 2026", "Scheduling", "Crescent does not rely on the schedule today, but Watseka and Kankakee will use it for work days and trades. Scheduling is reviewed in the near future, but not during the Fire Recovery and CAD work.", "Parked & future"],
  ["October 29, 2026", "CAD", "When no allowed senders are listed, CAD emails are accepted from no one until an address is added.", "23"],
  ["October 29, 2026", "Fire Recovery", "Testing uses Fire Recovery's real address (process.firerecoveryusa.com) with sandbox department NERIS ID FD12345678. No subscription key is needed for NERIS incident billing.", "13, 17"],
  ["October 29, 2026", "Fire Recovery", "Each vehicle is one party. Required per party: first and last name, address, Is Resident (yes/no), insurance company, vehicle make and model. Helpful: phone, policy number, insurance contact number, VIN, license plate.", "15"],
  ["October 29, 2026", "Fire Recovery", "Required call details: date of incident, time alarm received, time call cleared, run number, personnel on scene, incident location. Helpful: Law Enforcement Agency Report Number, NFIRS code.", "15"],
  ["October 29, 2026", "Fire Recovery", "Party information comes from the Reporting tab's Person/Owner > Vehicle section; its required fields are enforced for vehicle accidents.", "15"],
  ["October 29, 2026", "Fire Recovery", "Corrections are expected to happen in Recovery Hub (therecoveryhub.com); confirm with Fire Recovery after testing.", "12"],
  ["October 29, 2026", "Fire Recovery", "All open Fire Recovery questions go in one combined email, drafted after sandbox testing.", "17"],
  ["October 29, 2026", "Sign-in", "Session table approved. Signed out after 60 minutes with no activity. Locked for 15 minutes after 5 wrong passwords. Logout clears cached department data, and closing the browser signs the person out.", "5"],
  ["October 29, 2026", "Permissions", "Only admins can send a NERIS report, and only admins can send a NERIS report for billing. Only admins can create an incident by hand. The permission list and the account-change log are approved. Both are add-only. A department admin can lower a permission to their own role or a lower role.", "6"],
  ["October 29, 2026", "Departments", "The department comes from the Host address. A fake X-Forwarded-Host is ignored unless TRUST_PROXY=1, and that switch stays off until Render is confirmed to replace the header. A department can only use its own NERIS entity ID.", "7"],
  ["October 29, 2026", "Software", "Packages with known flaws were upgraded. The security scan reports no remaining issues. Those upgrades are on staging as of November 1. Production is not updated.", "8"],
  ["October 30, 2026", "NERIS", "Departments do not log in to NERIS. One vendor key stays on the server. Each department exports only under the NERIS Entity ID an admin sets in Admin Functions. Export uses that saved ID.", "7, 9A"],
  ["October 30, 2026", "Reports", "The server refuses edits to In Review and Exported reports. Draft stays editable. Anyone who can edit reports can unlock an In Review report that has not been exported. Only an admin can unlock an Exported report.", "9A"],
  ["October 30, 2026", "Releases", "The Step 9 release checklist wording is approved and saved as docs/procedures/RELEASE_CHECKLIST.md.", "9"],
  ["October 30, 2026", "Reports", "If someone else saved first, the save stops with: 'Someone else saved this report while you were editing. Reload to see their changes before saving again.'", "9A"],
  ["October 30, 2026", "Reports", "A new add-only history list stores who, when, which report, and which field names changed. Old and new text are not stored. History is kept forever and shown inside that report.", "9A"],
  ["October 30, 2026", "Reports", "A report must be unlocked before it can be deleted. Only an admin can delete.", "9A"],
  ["October 30, 2026", "Production", "Keep the admin and demo accounts. Render already sets NODE_ENV=production for the running server. Do not add NODE_ENV as a dashboard variable. A dashboard copy is present during npm install and the build fails.", "9B"],
  ["October 30, 2026", "Settings", "Move the department logo (500 KB limit), dispatch workflow states, submenu visibility, and submenu cards to the server. Incident list layout and sidebar width stay on each computer. Shift trades wait.", "9B"],
  ["October 30, 2026", "Practice branch", "Steps 9, 9A, and 9B were built on the practice branch. GitHub runs lint, build, and the tests on a throwaway database. November 1: those steps are on staging. Production is not updated.", "9, 9A, 9B"],
  ["October 31, 2026", "Reports", "Recover Reports is parked. Later, a button on Reporting → NERIS, next to Fire Recovery and View Exports, will restore a deleted report with every typed answer. Do not build it during this test pass.", "Parked & future"],
  ["October 31, 2026", "Incidents", "The Status box on an open incident is unit status. Draft is not a valid choice there. That box is not the NERIS report status. Fix later.", "Parked & future"],
  ["October 31, 2026", "Incidents", "Dragging columns under Incidents → Configure Table does not work. Fix later. That layout stays on each computer.", "Parked & future"],
  ["October 31, 2026", "Settings", "Unchecking a box in Admin Functions → Customization → Submenu Display Settings should hide that item from the left menu. Edit Display on the submenu cards is what shows or hides cards on the menu page. Fix later.", "Parked & future"],
  ["November 1, 2026", "NERIS", "On Resources, checking Dispatched and canceled en route should fill Dispatch Time, Canceled Time, and Clear Time with the call arrival time from Incident Times. It did not on the Crescent staging test. Fix later.", "Parked & future"],
  ["November 1, 2026", "Settings", "Edit My Display stays in the browser. It followed a second user on the same computer and did not follow the person to another browser. Save it per person on the server later.", "Parked & future"],
  ["October 31, 2026", "CAD", "The allowed-sender screen was planned for Stage D, step 23. It was built early and is on staging as of November 1. Crescent's sender is dispatch@co.iroquois.il.us. An empty sender list rejects mail.", "23"],
  ["November 1, 2026", "Release", "Stage B is on staging at commit d4bbaee. The Crescent click test passed. Production is not updated. The staging build command is npm ci --engine-strict=false && npm run build. Do not add a dashboard NODE_ENV variable. Do not merge to main.", "9"],
  ["October 31, 2026", "Security", "Part 3 is on staging as of November 1. The server writes the NERIS export receipt. The Fire Recovery password is encrypted. Viewing billing requires billing.view, which defaults to admin. Do not create FIRE_RECOVERY_CREDENTIAL_KEY on Render in a coding session. Production does not have Part 3 yet.", "10, 13"],
  ["October 31, 2026", "Security", "Part 4 (D1–D7) stays deferred. It is not the next coding task. D1 is required before any department is suspended. D2 is after Stage C and needs the browser-clearing rule approved first. D3–D6 are Stage C. D7 is when convenient.", "Parked & future"],
  ["October 31, 2026", "Security", "Post-remediation verification result: FAIL. Encryption, server export receipts, and CAD intake checks work. Letter case and trailing slashes skip sign-in and permissions, and on production and staging they skip the platform admin key. Stage B release is blocked until step 9C is done. Error details (D4) moved up to before release.", "9C"],
  ["November 1, 2026", "Fire Recovery", "Go-live means one real Crescent vehicle-accident bill from production, targeted for Monday, November 2. If the staging sandbox test has not passed in time, go-live moves later.", "17, 18"],
  ["November 1, 2026", "Fire Recovery", "Only vehicle accidents are billed at launch.", "11, 15"],
  ["November 1, 2026", "Fire Recovery", "Staging is forced to sandbox ID FD12345678 by a Render setting, and production refuses FD12345678. This replaces the per-department setting; no database change.", "13"],
  ["November 1, 2026", "Fire Recovery", "Billing parties are entered on a new Fire Recovery Billing tab in the NERIS report, laid out like Recovery Hub's 'Create New Motor Vehicle Incident' form. A party is one card: name and address, insurance, vehicle. There is no driver or owner concept. A 'Copy from Person/Owner' button pre-fills it. Required by default: first and last name, address, Is Resident, insurance company (waived by Uninsured), vehicle make and model. Admins can change billing field requirement levels. Billing fields never block NERIS export.", "15"],
  ["November 1, 2026", "Fire Recovery", "Wave 2 built the Fire Recovery Billing tab on the practice branch. It shows after Person/Owner for a motor-vehicle report, copies names at copy time, and is not sent in the NERIS export. It is not on staging. The vendor mapping is still the old short payload.", "15"],
  ["November 1, 2026", "Fire Recovery", "On a motor-vehicle report, Validate lists missing Required Fire Recovery fields and stays on Draft until they are filled. Form Filed By is not on that list. Export still does not check billing fields. Required labels show an asterisk. Time Call Cleared uses Incident clear time, then the latest Resources clear time. Personnel count is the people selected on Resources. Each party has its own Copy from Person/Owner picker. Wave 3 builds the vendor bill from the Exported report and refuses missing required fields before calling Fire Recovery.", "15"],
  ["November 1, 2026", "Fire Recovery", "Is Resident means the person lives in the fire district. It is always sent; Fire Recovery then bills only the insurance.", "15"],
  ["November 1, 2026", "Fire Recovery", "At Fault is an optional yes/no per party. Run type is Motor Vehicle or Commercial Trucking, with a commercial vehicle checkbox and DOT number per party. Billed types: the three NERIS motor-vehicle types, primary or additional.", "15"],
  ["November 1, 2026", "Fire Recovery", "The Person/Owner tab stays exactly as it is. The earlier ideas (Is Owner / Is Driver checkboxes, removing Add Owner, removing 'Owner - Insurance Company') are cancelled.", "15"],
  ["November 2, 2026", "Fire Recovery", "Updated the November 1 Person/Owner decision. The owner Insurance Company field and the Vehicle section are removed. Copy from Person/Owner copies name, phone, and address only. Vehicle, insurance, and the law-enforcement number come from Motor Vehicle Collision and do not write back to Core.", "15"],
  ["November 2, 2026", "Fire Recovery", "Core has street, city, state, and ZIP for the dispatch location and the incident location. Same as dispatch copies the dispatch parts into the incident. Motor Vehicle Collision shows those incident parts as read-only.", "15"],
  ["November 2, 2026", "Fire Recovery", "Wave 4 is on the practice branch only. Preview hashes the bill without the clock. Submit takes one lock. A second send returns Already sent and does not call Fire Recovery again. An unclear reply is Needs review and stays blocked until an admin resolves it. Not on staging.", "15"],
  ["November 2, 2026", "Fire Recovery", "Dispatch location and Incident location on Core are locked. Each line is built from the street, city, state, and ZIP under it. An arrow hides those four fields. They use two rows, and street is half a row. Same as dispatch sits beside the Incident location label.", "15"],
  ["November 2, 2026", "Fire Recovery", "Wave 5 is on the practice branch only. Export Details uses Preview & Send instead of an instant send. An admin can resolve Needs review. The queue and Fire Recovery list show Not sent, Submitting, Sent, Failed, or Needs review. Do not click Confirm and send from this Mac.", "15"],
  ["November 2, 2026", "NERIS", "Incident location keeps one state and one ZIP. Country and county sit in that section, and country defaults to US. State/Territory and Postal code are no longer separate fields. The export still sends state, postal code, country, and county. The Motor Vehicle Collision NERIS code box is hidden and uses the Core primary incident type. The NERIS Entity ID is set at Admin Functions → Setup/Configuration → NERIS Configuration → NERIS Export Configuration. Incident 12345 exported 201 Created at 11:14:04.", "15"],
  ["November 2, 2026", "Fire Recovery", "Wave 6 is on the practice branch. A pretend Fire Recovery server proves one bill per incident, Failed versus Needs review, sandbox FD12345678, live department ID, and a refusal when Fire Recovery is switched off. Wave 7 is the operator's staging sandbox test. Do not click Confirm and send from this Mac.", "15"],
  ["November 2, 2026", "Fire Recovery", "The first Wave 7 Preview & Send said Export this report to NERIS first. NERIS had already returned 201, but the saved report stayed In Review because saving the NERIS id was rejected. That one Crescent report was set to Exported.", "17"],
  ["November 2, 2026", "Fire Recovery", "Crescent staging accepted one sandbox bill at 12:21 p.m. Chicago. Tracking ID c7aaf46a-fd7b-4ea8-9bd6-d644bbfd3418. Department ID FD12345678. Update billing status returned Unassigned, with no amount due and no amount paid. One Sent row is stored. Production is not updated.", "17"],
  ["November 1, 2026", "Fire Recovery", "Is Resident is required for Crescent because a local ordinance bars billing residents directly. Recovery Hub itself marks it recommended. Only an admin adds missing billing info after export: unlock, edit, export to NERIS again.", "5, 15"],
  ["November 1, 2026", "Fire Recovery", "Send the narrative and responding units, as Fire Recovery's documentation asks. The full vendor documentation is saved in docs/procedures/vendor/.", "15"],
  ["November 1, 2026", "Fire Recovery", "An unclear vendor reply shows 'Needs review: check Recovery Hub' and blocks resending until an admin clears it.", "12, 14"],
  ["November 1, 2026", "Fire Recovery", "Older incidents are billed with a button that exports to NERIS again and then opens the billing preview.", "11"],
  ["November 1, 2026", "Fire Recovery", "Billing is granted to officers at Crescent. Billing status and amounts are also shown in the NERIS report's export view.", "11, 14"],
];

const decisions = [
  ["Fire Recovery", "Wait for Fire Recovery USA to answer the November 1 email. The open question is whether the Welcome login can create Crescent's real bills. That answer blocks Wave 8. Do not start Wave 8, Wave 5b, or a production release while waiting."],
  ["Fire Recovery", "Sandbox bill is done. Tracking ID c7aaf46a-fd7b-4ea8-9bd6-d644bbfd3418. Invoice status Unassigned. One Sent row on cifpdil. Do not click Confirm and send on this Mac."],
];

const fireRecoveryEmail = [
  ["Corrections", "Are corrections and resubmissions made only in Recovery Hub (therecoveryhub.com), or is there an API method? How should a corrected report be matched to the original tracking ID?"],
  ["Billing status", "When does billing status become available after submission, and how often may we check it?"],
  ["Parties", "We plan to leave InvolvementType and InvolTypeDescript blank. Is that okay? (Minimum fields, local-time dates, one law enforcement number and the run number were answered by the operator on November 1; see docs/plans/PHASE_C_FIRE_RECOVERY_PLAN.md section 13.)"],
  ["Lost tracking ID", "Get Incident Tracking Id still lists a SubscriptionKey. If a submission times out, how do we look up its tracking ID without one?"],
  ["NERIS code", "Should IncidentType and PrincipleIncidentType hold the full NERIS incident type value? Which format matches the NERIS Code dropdown in Recovery Hub?"],
  ["Commercial trucking", "How is a Commercial Trucking Incident marked through the API?"],
  ["Sandbox", "Confirm that submissions using FD12345678 are never billed, and whether sandbox incidents can be cleared after testing."],
  ["Test results", "November 2, 2026 sandbox bill accepted. Department ID FD12345678. Tracking ID c7aaf46a-fd7b-4ea8-9bd6-d644bbfd3418. Billing status Unassigned, with no amount due and no amount paid."],
];

function StepCard({ s }: { s: Step }) {
  return (
    <Card collapsible defaultOpen={s.status === "Next" || s.status === "Updated" || s.status === "New"}>
      <CardHeader trailing={<Pill size="sm" active={s.status === "Next"}>{s.status ? `Step ${s.n} · ${s.status}` : `Step ${s.n}`}</Pill>}>{s.title}</CardHeader>
      <CardBody>
        <Stack gap={8}>
          <Text size="small"><Text as="span" weight="semibold">What is wrong: </Text>{s.problem}</Text>
          <Text size="small"><Text as="span" weight="semibold">Why it matters: </Text>{s.why}</Text>
          <Text size="small"><Text as="span" weight="semibold">The fix: </Text>{s.fix}</Text>
          <Divider />
          <Row gap={16} wrap>
            <Text size="small" tone="secondary"><Text as="span" weight="semibold">Who: </Text>{s.who}</Text>
            <Text size="small" tone="secondary"><Text as="span" weight="semibold">Done when: </Text>{s.done}</Text>
          </Row>
        </Stack>
      </CardBody>
    </Card>
  );
}

function Explainer() {
  return (
    <Stack gap={14}>
      <H2>Why the foundation comes first</H2>
      <Text>Imagine CAD as an office clerk who reads dispatch emails and files each one into an incident folder.</Text>
      <Grid columns={2} gap={14}>
        <Card>
          <CardHeader>Problem 1: the office has no locks</CardHeader>
          <CardBody><Text size="small">Anyone who knows the department's web address can change the clerk's instructions, read the mail, or edit folders without logging in. Authentication means checking who you are on every request, not just at the front door.</Text></CardBody>
        </Card>
        <Card>
          <CardHeader>Problem 2: the clerk files duplicates</CardHeader>
          <CardBody><Text size="small">When the mail carrier is unsure a letter arrived, he delivers it again, and the clerk treats it as new. Two letters arriving at once can create two folders. Uniqueness means one email is processed once and each call has one folder.</Text></CardBody>
        </Card>
      </Grid>
      <Callout tone="info" title="What this means for the plan">
        Fancier CAD skills built first would still work in an unlocked office and still create duplicates. Fixing locks and duplicates first means everything afterward rests on solid ground. Fire Recovery is the same: billing must trust only server-written NERIS receipts.
      </Callout>
      <H2>Where the data lives</H2>
      <Table
        headers={["Place", "Role", "Holds"]}
        rows={[
          ["Render", "The store: runs the program", "No permanent records"],
          ["Neon", "The warehouse: permanent records", "Departments, users, incidents, run reports (NERIS drafts) and history, settings, schedules, CAD emails"],
          ["GitHub", "The blueprint library: the program's code", "Every version of the code, but no department data"],
          ["NERIS", "Official national copy", "Every report Crescent submitted"],
          ["Web browsers", "Local copies", "Cached data, plus trades and some display settings that exist only there"],
          ["Cloudflare", "Mail delivery", "CAD emails briefly, while delivering"],
        ]}
      />
      <H2>Code words in plain language</H2>
      <Table
        headers={["Word", "Plain meaning"]}
        rows={[
          ["Code", "The program's instructions. Stored on GitHub. Contains no department data."],
          ["Branch", "A named copy of the code. Changes to one copy do not affect the others until someone deliberately copies them over."],
          ["main", "The copy Crescent's real site (production) runs."],
          ["Staging branch (submenu/neris-golive-cifpd)", "The copy the test site runs. It already includes everything in main, plus the newer CAD and Fire Recovery work."],
          ["Practice copy (work branch)", "cursor/stage-b-foundation-b5ff: a fresh copy made from the staging branch where new fixes are written and tested, so neither live site changes by accident. Staging redeploys from its own branch, so work reaches staging only when deliberately combined into it."],
          ["Merge / combine", "Copying the changes from one branch into another, like accepting tracked changes from one document into another."],
          ["Release (deploy)", "Telling Render to run a different copy of the code. Only this changes what a live site does."],
        ]}
        striped
      />
    </Stack>
  );
}

function Findings() {
  return (
    <Stack gap={14}>
      <H2>Step 1 results — confirmed October 28, 2026</H2>
      <Table
        headers={["Item", "Staging (test site)", "Production (Crescent's real site)"]}
        rows={[
          ["Render service", "fireultimate-api-staging", "fireultimate-prod-api"],
          ["Code branch and version", "submenu/neris-golive-cifpd · 2d985fa", "main · 3f9b97a (deployed April 9, 2026)"],
          ["Web addresses", "cifpdil, demo and kankdemo .staging.fireultimate.app", "cifpdil.fireultimate.app"],
          ["NERIS connection", "Test NERIS (api-test)", "Real NERIS (api)"],
          ["Database", "Neon project fireultimate-staging", "Neon project fireultimate-prod (separate)"],
          ["Neon live branch name", "production (Neon's default name; holds staging data)", "production (holds Crescent's live data)"],
          ["Fire Recovery and CAD automation code", "Present", "Not present"],
          ["NODE_ENV setting", "Not set", "Not set"],
          ["Restore window", "6 hours", "6 hours"],
        ]}
        striped
      />
      <H2>Step 2 results — backups taken October 28, 2026</H2>
      <Table
        headers={["Item", "Staging", "Production"]}
        rows={[
          ["Backup branch", "backup-2026-10-28-before-repairs-staging", "backup-2026-10-28-before-repairs"],
          ["Tables visible", "Yes", "Yes"],
          ["Incident rows", "22", "62"],
          ["CAD email rows", "86", "Not applicable"],
        ]}
        striped
      />
      <H2>Step 4 check — code versions compared October 28, 2026</H2>
      <Table
        headers={["Question", "Answer"]}
        rows={[
          ["Does production's version have anything staging's lacks?", "No. Its only extra entries are five records of earlier combinations (April 9 and March), with no unique code."],
          ["What does staging's version add?", "19 changes from April 9–10: CAD Batches A–I, Fire Recovery billing, Setup/Configuration screen, and four database additions"],
          ["Trial combination (throwaway copy, nothing saved)", "No conflicts; the result was identical to staging's version"],
          ["Conclusion", "Staging's version is already the single combined version. Build all future work on it."],
        ]}
        striped
      />
      <H2>CAD email routing</H2>
      <Table
        headers={["CAD email setting", "Finding"]}
        rows={[
          ["Dispatch address", "cifpdil@cad.fireultimate.app → cad-email-ingest-worker (active)"],
          ["Sender", "dispatch@co.iroquois.il.us"],
          ["Catch-all rule", "Drop, disabled"],
          ["Worker destination", "Staging: cifpdil.staging.fireultimate.app"],
          ["Email secret key", "Set on the Worker and on both Render services"],
          ["Queue", "Empty; no dead letter queue configured"],
          ["Auto-create on staging", "Box is checked, but nothing happens because there are no parsing rules and no call-number field"],
          ["Auto-create in production", "Feature not present; turned on only after Stage D passes"],
        ]}
      />
      <Callout tone="success" title="What this means">
        Crescent's production data has not been touched by the newer, unfinished work, and a frozen copy of it now exists. Staging holds real dispatch emails, so it should be treated as private.
      </Callout>
    </Stack>
  );
}

function CadEmails() {
  return (
    <Stack gap={14}>
      <H2>How CAD, the Incidents tab and the Reporting tab fit together</H2>
      <Text tone="secondary">Agreed design (October 28, 2026).</Text>
      <Grid columns={2} gap={14}>
        <Card>
          <CardHeader>Incident — "what's happening now"</CardHeader>
          <CardBody>
            <Stack gap={6}>
              <Text size="small">Owned by CAD and read-only for users. Created by the first dispatch email and updated by every later email.</Text>
              <Text size="small">Used before and during the call: alerts, map location, dispatcher note updates, and a quick reference for station logs.</Text>
              <Text size="small">The department admin chooses which roles can see the Incidents tab, create incidents by hand, and delete incidents. A hand-made or deleted incident that a CAD email matches shows a yellow ⚠ for admin review.</Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>Run report — "what we did"</CardHeader>
          <CardBody>
            <Stack gap={6}>
              <Text size="small">Owned by the crew. Created automatically by the first CAD email and pre-filled with everything CAD knows.</Text>
              <Text size="small">Crew completes it after the call in the Reporting tab, then it goes to review, NERIS and billing.</Text>
              <Text size="small">CAD keeps filling blank fields, offers 'CAD has newer information' for fields a person changed, and never touches a locked report.</Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>
      <H3>Example: call 26017007 — today versus after Step 21A</H3>
      <Table
        headers={["Moment", "What the program does today", "What it will do after the fix"]}
        rows={[
          ["2:58 PM — dispatch email arrives", "Incident created (once rules exist). It appears in the Reporting list, but no run report exists yet", "Incident and run report are both created; the report already shows call number, type, address"],
          ["3:30 PM — a firefighter opens the report", "The report copies call number, type, address and time from the incident at this moment, then saves", "Report is already filled; firefighter adds their work"],
          ["4:21 PM — closing email arrives", "Only the incident is updated. The saved report still says 'Fire Alarm' and has no unit times", "Report fills unit times; because nobody changed the call type, it updates to 'Fire Vehicle'"],
          ["If the firefighter had changed the call type", "(Not applicable — report never hears from CAD again)", "Report keeps the firefighter's value and shows 'CAD has newer information' with Accept"],
        ]}
        striped
      />
      <Divider />
      <H2>Crescent CAD emails — Step 3 findings</H2>
      <Text tone="secondary">Based on staging's Raw Email list and two real calls (26017007 with 2 emails, 26012778 with 3 emails). Personal details are not stored in this plan.</Text>
      <H3>The two email types</H3>
      <Table
        headers={["", "Type 1 — Dispatch (short)", "Type 2 — Closing summary"]}
        rows={[
          ["When it arrives", "About a minute after the call is created; sent again when dispatchers add CAD notes", "Seconds after the last unit is back in quarters"],
          ["How it starts", "The call number, for example '26017007; Fire Alarm; …'", "'Crescent-Iroquois Fire - CAD CFS: 26017007; …'"],
          ["Call number", "First item", "After 'CAD CFS:'"],
          ["Call type (nature)", "Second item, for example 'Fire Alarm'", "After 'Nature:', printed twice, for example 'Fire Vehicle Fire Vehicle'"],
          ["Address", "Third item; town always, state and ZIP sometimes", "Not included"],
          ["Short description", "Fourth item, for example 'COMBINE FIRE'", "Not included"],
          ["CAD notes", "After 'CAD Notes:'; each repeat includes all earlier notes", "Not included"],
          ["Department numbers", "Not included", "After 'Department CFS:', one per agency, for example CrescentIroquoisFPD2600079"],
          ["Start time", "Not included", "After 'Start Date/Time:'"],
          ["Units", "Not included", "After 'Units:'; mixes real units with agency markers such as CrescentIroquoisFireDispatched"],
          ["Unit times", "Not included", "Enroute, On Scene, Returning and InQuarters for each unit, plus agency page times"],
        ]}
        striped
      />
      <H3>What this means for the CAD design</H3>
      <Table
        headers={["Finding", "Why it matters", "Plan step"]}
        rows={[
          ["The call number sits in a different place in each email type", "Two rules are needed so every email lands on the same incident", "20, 28"],
          ["The call type can change between emails (Fire Alarm became Fire Vehicle)", "The incident updates from the latest email; the report follows unless a person changed it", "21, 21A"],
          ["The closing email has no address", "A missing field must never erase the existing value", "21"],
          ["Repeated short emails repeat every earlier note, including 'ENTRY REVISED' copies", "Only new note entries should be added, matched by their time stamp", "21"],
          ["The dispatch email arrives within about a minute", "Fast enough to drive responder alerts later", "Future"],
          ["The address sometimes lacks state and ZIP", "Map location needs the department's state filled in automatically", "Future"],
          ["Units list includes agency markers and mutual-aid units", "Apparatus matching must ignore markers and separate Crescent's units from mutual aid", "21A, 28"],
          ["Some units have no On Scene time; agencies can be paged more than once", "Times must handle gaps and repeats without errors", "21A, 28"],
          ["Times have no time zone", "Treat them as Central time consistently", "28"],
          ["CAD notes can contain caller names, phone numbers and addresses", "Staging and any copied samples must be treated as private", "Data safety"],
          ["One sender address", "Becomes the first entry on Crescent's allowed-sender list", "23"],
          ["No parsing rules exist yet", "Crescent's rules are built from scratch and become the first template", "27, 28"],
        ]}
        striped
      />
    </Stack>
  );
}

function ProductionTab() {
  return (
    <Stack gap={12}>
      <H2>Improvements to features live in production today</H2>
      <Text tone="secondary">You agreed all of these should be implemented. Each is covered by the step shown.</Text>
      <Table headers={["Feature", "Current weakness", "Covered by step"]} rows={productionItems} striped />
    </Stack>
  );
}

function DecisionsTab() {
  return (
    <Stack gap={14}>
      <H2>Decided</H2>
      <Table headers={["Date", "Area", "Decision", "Step"]} rows={decided} striped />
      <H2>Still open — only you can answer</H2>
      <Table headers={["Area", "Question"]} rows={decisions} striped />
      <H2>Questions for Fire Recovery — sent as one email after sandbox testing</H2>
      <Text tone="secondary">Collected here as they come up. The email is drafted at Step 17, with the test results.</Text>
      <Table headers={["Topic", "Question"]} rows={fireRecoveryEmail} striped />
    </Stack>
  );
}

function Safety() {
  return (
    <Stack gap={12}>
      <H2>Data-safety rules for every change</H2>
      <Table
        headers={["Rule", "What it means"]}
        rows={[
          ["Manual backup first", "A fresh Neon backup branch before every release, even after upgrading Neon. Name it backup-YYYY-MM-DD-reason."],
          ["Keep backups untouched", "Never edit, connect the app to, reset, or delete a backup branch. Delete old backups only after a later backup exists and with guidance."],
          ["Leave branch names alone", "Keep Neon's live branch named 'production' in both projects. Tell projects apart by project name (fireultimate-prod vs fireultimate-staging)."],
          ["Longer restore window later", "Upgrade the Neon plan for a longer restore window as more departments join."],
          ["Optional offsite copy", "A periodic downloaded copy stored outside Neon for extra protection."],
          ["Add, never remove", "Database updates only add new information; no deleting or renaming existing data."],
          ["Rehearse on a copy", "Every database update is tested on a copy of production before touching Crescent's real data."],
          ["No test setup on production", "The script that creates admin/admin and demo/demo accounts is never run against production."],
          ["Code changes never touch data", "Saving code to GitHub changes nothing on a live site. Only a release in Render does, and every release follows these rules."],
          ["Production stays on main until a planned release", "Do not change which branch Render's production service uses without a release plan and a fresh backup."],
          ["Staging before production", "Every change passes on staging first."],
          ["Small releases", "One focused change at a time, with a way to roll back."],
          ["Staging is private", "Staging holds real dispatch emails, including caller names and phone numbers in CAD notes, and must be protected like production."],
          ["Redact samples", "When sharing CAD emails, replace names, addresses, phone numbers and medical details inside CAD notes too."],
          ["Don't save on settings screens while reviewing", "Looking at Dispatch Parsing Settings is safe; clicking Save or changing the auto-create box is not, until the matching step."],
          ["Fire Recovery tests use only the sandbox ID", "Fire Recovery testing happens on their real address, so every test must use sandbox department ID FD12345678. No Fire Recovery tests from staging until Step 13 makes staging refuse any other ID."],
          ["No secrets in chat", "Share names, version codes and yes/no answers only—never passwords or database addresses."],
        ]}
        striped
      />
    </Stack>
  );
}

function Parked() {
  return (
    <Stack gap={14}>
      <H2>Future CAD-driven features (after Stage D)</H2>
      <Text>These are the reasons the Incidents tab exists. They are not built yet and come after Stage D, because each one depends on CAD being reliable first.</Text>
      <Table
        headers={["Feature", "What it does", "Must be true first"]}
        rows={[
          ["In-app alerts", "Notify responders when a call is dispatched", "Each email processed once (19) and one incident per call (20), or people get duplicate alerts"],
          ["Dispatcher note updates", "Notify responders when dispatch adds new notes", "Only new notes detected (21)"],
          ["Map location", "Show the call on a map for the future mobile app", "Address read reliably, with the department's state filled in when CAD leaves it out"],
          ["Text messages", "Optional texts in addition to app alerts", "Alerts working, plus each person's consent and a texting service (has a per-message cost)"],
          ["Mobile app", "Alerts, map and incident details on phones", "Stages B and D complete; a separate design project"],
          ["Station log reference", "Read-only incident summary with times for handwritten logs", "CAD activity log and unit times (21, 21A)"],
        ]}
        striped
      />
      <Divider />
      <H2>Parked: recover a deleted NERIS report</H2>
      <Text>
        Decided October 31, 2026, during practice-branch testing. Do not build this yet. On Reporting → NERIS, next to Fire Recovery and View Exports, add a Recover Reports button. If a report is removed from that list by mistake, Recover Reports puts the whole report back, including every answer that was typed. The incident already stays on the Incidents tab. The answers on Incident 27 Test were cleared by an earlier delete, before this was parked, so that one report cannot be restored.
      </Text>
      <Divider />
      <H2>Parked: incident Status is unit status</H2>
      <Text>
        Found October 31, 2026, on an open incident. The Status box uses a built-in list: Draft, Dispatched, Enroute, On scene, and Cleared. A new incident starts on Draft. That list is not the NERIS report status (Draft, In Review, Exported), and it is not connected to the dispatch workflow list in Admin Functions → Customization. This box is unit status. Draft should not be a choice. Do not change it while starting Stage C.
      </Text>
      <Divider />
      <H2>Parked: Incidents Configure Table drag and drop</H2>
      <Text>
        Found October 31, 2026. On the Incidents tab, Configure Table is meant to let a person drag columns into a new order. That drag and drop does not work correctly. Fix it later. The column layout stays on each computer.
      </Text>
      <Divider />
      <H2>Parked: Submenu Display Settings hide the left menu</H2>
      <Text>
        Decided October 31, 2026. Admin Functions → Customization → Submenu Display Settings currently changes whether a submenu appears on that menu's card page and in Edit Display. Unchecking a box there should instead hide that item from the main menu list on the left. Showing or hiding cards on the menu page stays with Edit Display on the submenu cards.
      </Text>
      <Divider />
      <H2>Parked: canceled en route fills the times</H2>
      <Text>
        Found November 1, 2026, on Crescent staging. On a NERIS report, open Resources and check Dispatched and canceled en route. Dispatch Time, Canceled Time, and Clear Time should fill themselves with the call arrival time from Incident Times. They stayed empty. The operator typed the times and continued the test. Do not build this until asked.
      </Text>
      <Divider />
      <H2>Parked: Edit My Display follows the person</H2>
      <Text>
        Found November 1, 2026, on Crescent staging. Dashboard Edit My Display stayed after logout and also appeared for a second username in the same browser. A different browser did not have those choices. Save the choices for the signed-in person on the server. A shared computer should not keep the previous person's display, and the same person should see their choices on another computer. Do not build this until asked.
      </Text>
      <Divider />
      <H2>Set aside for now: scheduling</H2>
      <Text>Scheduling (rotation, D shifts, staffing, Kelly days, vacation, trades) is parked for a separate review and possible rebuild. None of these steps change scheduling features.</Text>
      <Callout tone="warning" title="Scheduling is next after Fire Recovery and CAD (decided October 29)">
        Crescent does not use the schedule today, but Watseka and Kankakee will use it for work days and trades. Scheduling is reviewed in the near future, but not during the Fire Recovery and CAD work. Step 5 automatically protects the scheduling pages. Saving the schedule today can erase days missing from someone's open browser tab, so that fix must be part of the scheduling review before either department relies on it.
      </Callout>
      <Divider />
      <H2>Later: security Part 4 (deferred)</H2>
      <Text>
        Recorded October 31, 2026 from the security plan. Parts 1–3 are on staging as of November 1, 2026. Production is not updated. Part 4 is not the next coding task. Each item below stays deferred only while its restriction stays true.
      </Text>
      <Table
        headers={["Item", "What is still open", "Restriction until it is fixed", "When"]}
        rows={[
          ["D1", "A suspended or archived department can still sign in.", "Do not use department status to cut off access. To cut off a department, cancel its sessions and disable its accounts.", "Before any department is suspended. If one is already suspended or archived, this moves up."],
          ["D2", "Report and incident data can stay in the browser after sign-in expires.", "On a shared station computer, click Sign out. Shared computers use separate Windows sign-ins.", "After Stage C. The clearing rule needs approval first."],
          ["D3", "The server can still accept an old readable-text password.", "Safe only while both databases have zero readable-text passwords.", "During Stage C: remove that fallback and add a test."],
          ["D4", "Moved to security fix 10. Short error text is on staging as of November 1, 2026.", "Production does not have fix 10 yet.", "Done on staging. Production waits for its own release."],
          ["D5", "The origin check ignores the web address scheme and port.", "Keep HTTPS-only at Cloudflare. The sign-in cookie is already strict and host-only.", "During Stage C."],
          ["D6", "Sign-in for an unknown username replies faster than for a real one.", "The lockout after wrong passwords reduces the risk.", "During Stage C: compare against a stand-in password hash when the username does not exist."],
          ["D7", "12 moderate warnings are in development tools only. Session tests skip when no local database is present.", "These are not shipped to departments. The automatic checks already run the session tests.", "When convenient."],
        ]}
        striped
      />
      <Divider />
      <H2>Later: turn older plan documents into canvas plans</H2>
      <Text>The repo's docs/plans, docs/procedures and docs/user instructions folders hold text plans that are hard to follow. Later, search the repo for incomplete items in those files and turn each active area into a canvas plan with the same layout as this one. Each plan's source is saved under docs/plans/canvases/.</Text>
    </Stack>
  );
}

export default function Plan() {
  const theme = useHostTheme();
  const tabs = ["Start here", "Findings", "CAD, incidents & reports", "Stage A", "Stage B", "Stage C — Fire Recovery", "Stage D — CAD", "Production improvements", "Decisions", "Data safety", "Parked & future"] as const;
  type T = typeof tabs[number];
  const [tab, setTab] = useState<T>("Stage B");
  const stageFor: Record<string, string> = { "Stage A": "A", "Stage B": "B", "Stage C — Fire Recovery": "C", "Stage D — CAD": "D" };
  const st = stages.find((s) => s.id === stageFor[tab]);
  return (
    <Stack gap={18} style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px 64px", background: theme.bg.editor }}>
      <Stack gap={6}>
        <Text size="small" tone="tertiary">Updated November 13, 2026 · Wave 8 production bill sent · Tracking ID 412c2d90-6489-4b63-9fa0-6570adf33bb2 · Recovery Hub shows Draft · Wave 5b still parked · Live canvas was not republished with this copy</Text>
        <H1>Fire Ultimate — step-by-step repair plan</H1>
      </Stack>
      <Callout tone="success" title="Stage B is on Crescent staging (November 1, 2026)">
        Pull request 31 is merged. Staging runs commit d4bbaee. The Crescent click test passed about 2:09 p.m. Chicago: sign-in, logout, Allowed Senders showing dispatch@co.iroquois.il.us exact and on, Raw Email, a personal message rejected, incidents, NERIS Validate, change history, In Review on NERIS and View Exports, a capitalized /API/users error, and the 15-minute lock on username admin. Production is not updated. Do not merge to main. Do not delete the saved sender. The October 31 security check that blocked the release is closed on staging by fixes 8–15. Production still has only the Fix 15 one-line hotfix.
      </Callout>
      <Callout tone="neutral" title="Practice click-through (October 31, 2026)">
        Confirmed in the practice browser before the promote: change history shows the on-screen field names, deleting a report leaves the incident, a second save opens the "This report was not saved" pop-up, workflow states accept continuous typing, dashboard Edit display hides the six boxes on this computer, saving the NERIS Entity ID fills the report, idle sign-out is 60 minutes, and five wrong passwords lock sign-in for 15 minutes. Security Part 4 (D1–D7) is deferred and is not the next coding task. Recover Reports, incident Status, table drag, left-menu hiding, canceled-en-route time fill, and per-user Edit My Display are parked.
      </Callout>
      <Row gap={6} wrap>{tabs.map((t) => <Pill key={t} active={t === tab} onClick={() => setTab(t)}>{t}</Pill>)}</Row>
      <Divider />
      {tab === "Start here" && (
        <Stack gap={18}>
          <Explainer />
          <H2>The four stages</H2>
          <Table
            headers={["Stage", "Purpose", "Steps", "Mostly done by"]}
            rows={[
              ["A — Get our bearings", "Know what is live, back up, study CAD emails, pick one code version, answer questions", "1–4", "You, with guidance"],
              ["B — Minimum foundation", "Logins, permissions, department separation, updates, tests, report protection, production cleanup", "5–9B", "Me"],
              ["C — Fire Recovery", "Bill only verified incidents, exactly once, accurately", "10–18", "Me, with vendor checks"],
              ["D — CAD", "One incident per call, CAD fills the run report without overwriting the crew, then self-service setup", "19–28", "Me, with your staging checks"],
            ]}
          />
        </Stack>
      )}
      {tab === "Findings" && <Findings />}
      {tab === "CAD, incidents & reports" && <CadEmails />}
      {st && (
        <Stack gap={10}>
          <H2>{st.name}</H2>
          <Text tone="secondary">{st.summary}</Text>
          {st.steps.map((s) => <StepCard key={s.n} s={s} />)}
        </Stack>
      )}
      {tab === "Production improvements" && <ProductionTab />}
      {tab === "Decisions" && <DecisionsTab />}
      {tab === "Data safety" && <Safety />}
      {tab === "Parked & future" && <Parked />}
    </Stack>
  );
}
