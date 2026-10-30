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
      { n: "9", title: "Turn on automatic checks and safe release rules", status: "Next",
        problem: "Existing tests never run automatically, and there is no written release procedure that protects live data.",
        why: "Tests catch accidental breakage; release rules protect Crescent's data.",
        fix: "Run all tests on every change, add a temporary practice database for server tests, and follow the rules in the 'Data safety' tab for every release.",
        who: "Me.",
        done: "Every change shows pass or fail in GitHub, and the release checklist exists." },
      { n: "9A", title: "Protect incidents and NERIS reports on the server", status: "Updated",
        problem: "The 'locked when In Review or Exported' rule is enforced only on screen, so the server still accepts edits. If two people edit the same report, the last save silently wins, and there is no change history. Changing the NERIS Entity ID in Admin Functions can leave export using the old ID.",
        why: "A submitted NERIS report could be changed behind the scenes, and one person's edits could silently erase another's.",
        fix: "Approved October 30. The server refuses edits when a report is In Review (Validate passed) or Exported. A Draft stays editable by anyone who can edit reports. After Validate or Export, only an admin can unlock. If two people edit at once, the second save stops with: 'Someone else saved this report while you were editing. Reload to see their changes before saving again.' A new add-only history list records who saved, when, which report, and which field names changed (not the old and new text). History is kept forever and is shown inside that report. Deleting requires the report to be unlocked first, and only an admin can delete. Saving the NERIS Entity ID in Admin Functions updates the ID export uses.",
        who: "Me.",
        done: "Tests prove a validated report cannot be edited or deleted until an admin unlocks it, a second simultaneous save is refused, and export uses the entity ID last saved by an admin." },
      { n: "9B", title: "Clean up production leftovers", status: "Updated",
        problem: "Test accounts admin/admin and demo/demo may exist from initial setup; NODE_ENV is not set on either Render service; some settings exist only in one person's browser.",
        why: "NODE_ENV turns on the stricter production check for CAD email, and browser-only settings differ between computers. The starter accounts stay, by your choice on October 30.",
        fix: "Approved October 30. Keep the admin and demo accounts; do not delete them. During a planned release, set NODE_ENV=production on both Render services. Move these to the server so the whole department shares them: department logo (500 KB limit), dispatch workflow states, submenu display settings, and submenu cards. Leave each person's incident list layout and sidebar width on their own computer. Shift trades wait for the scheduling review.",
        who: "Me, with you confirming in Render and the app.",
        done: "NODE_ENV is set on both live servers during a release, shared settings match on every computer, and the admin and demo accounts were kept on purpose." },
    ],
  },
  {
    id: "C", name: "Stage C — Fire Recovery billing (first priority)",
    summary: "Bill only verified incidents, exactly once, with correct information. Fire Recovery is not in production yet, so this is building it correctly before release.",
    steps: [
      { n: "10", title: "Have the server record NERIS export results itself",
        problem: "Billing uses an 'export succeeded' record that the browser writes. Anything not marked 'failed' is saved as success. The same weakness affects NERIS export history in production today.",
        why: "It is like a bank accepting a customer's handwritten note saying a check cleared.",
        fix: "The server writes an official receipt only after NERIS confirms success. The receipt includes the NERIS ID, time, who exported it, an exact copy of what was sent, and a tamper-check fingerprint.",
        who: "Me.",
        done: "Tests prove the browser cannot create a success record." },
      { n: "11", title: "Bill only from verified receipts, with a preview", status: "Updated",
        problem: "Billing does not check where its data came from or who is submitting.",
        why: "Billing must be based on the official, confirmed report and sent only by authorized staff.",
        fix: "The 'Send to Fire Recovery' button appears only for incidents with an official receipt and only for approved roles (decided October 29: admin by default; the department admin may grant it to other roles in Admin Functions). The person submitting sees a preview of exactly what will be sent and clicks Confirm. Nothing is ever billed automatically.",
        who: "Me.",
        done: "Tests prove unverified incidents and unauthorized users cannot bill." },
      { n: "12", title: "Prevent double billing",
        problem: "Submitting again sends the incident again and overwrites the previous tracking number.",
        why: "A double-click or retry could bill twice and lose the original tracking number.",
        fix: "On Confirm, the incident is marked Submitting so repeats are ignored. Corrections require a separate Correct/Resubmit action with a reason that follows Fire Recovery's rules and keeps the original tracking number on record. The API has no update or cancel method — only add, attachments, and billing status. Your understanding (October 29): corrections are made by logging in to Fire Recovery's Recovery Hub (therecoveryhub.com) directly. After sandbox testing we confirm this with Fire Recovery in the single combined email (see 'Decisions'), then the Correct/Resubmit action becomes a guided 'correct this in Recovery Hub' step that records who, when and why in our history.",
        who: "Me; Fire Recovery USA confirms the correction process.",
        done: "Tests prove repeated clicks create only one submission." },
      { n: "13", title: "Protect the Fire Recovery password and use the sandbox department ID for testing", status: "Updated",
        problem: "Vendor passwords are stored as readable text. Fire Recovery confirmed October 29 that testing happens on their real address (process.firerecoveryusa.com) using a sandbox department NERIS ID, FD12345678; there is no separate test site for us. Today the app always sends the department's own NERIS ID (the same one used for NERIS exports), so a test from staging would send Crescent's real ID to Fire Recovery's real system.",
        why: "With one shared address, the department ID is the only thing separating a test from a real bill.",
        fix: "Encrypt stored passwords. Add a per-department 'Fire Recovery department ID' setting, separate from the NERIS export ID, so staging can use FD12345678 while NERIS exports keep the real ID. Staging refuses to submit with any ID other than the sandbox ID, and every submission screen shows which ID will be used. No subscription key is needed for this method. Fire Recovery sets up the sandbox after you reply with the account email; the Welcome Message holds the API login, which is entered only in the app's settings screen, never in chat.",
        who: "Me; the new setting may need your approval for a database change; you reply to Fire Recovery with the account email.",
        done: "Passwords are encrypted, and tests prove staging can only submit with sandbox ID FD12345678." },
      { n: "14", title: "Handle vendor outages and errors clearly",
        problem: "If Fire Recovery is slow or down, a request can hang. The screen only shows not sent or DataSent.",
        why: "Staff need to know whether a bill went out, failed, or needs attention.",
        fix: "Add time limits; statuses Not sent, Submitting, Sent, Failed, Needs review, and Paid/Balance due; plus a history of every attempt showing who, when, what was sent and what came back. Flag 'Billing may be out of date' if a billed report is later edited—never re-bill automatically.",
        who: "Me; you approve status wording.",
        done: "Simulated outages show a clear Failed status and no duplicate bill." },
      { n: "15", title: "Send every field Fire Recovery requires, from the Reporting tab", status: "Updated",
        problem: "Checked October 29 against the code: the billing request sends only a small block (incident number, NERIS ID, type, personnel count, filed-by). It never sends the call details or any parties. The report form has no Law Enforcement Number field, so the code falls back to the dispatch final disposition. Personnel is counted from unit staffing, not the people selected. The Person/Owner > Vehicle section is never read for billing, none of its fields are required, and there is no 'Is Resident' field anywhere. Fire Recovery's current documentation accepts all of these details in the same request.",
        why: "Missing required fields lead to rejected or unpaid invoices.",
        fix: "Fire Recovery's requirements (from you, October 29). Call details, required: date of incident, time alarm received, time call cleared, run number, personnel on scene (people selected on the run report for units that arrived on scene), and incident location. Call details, helpful: Law Enforcement Agency Report Number and NFIRS code. Parties: one per vehicle (a 2-vehicle accident has 2 parties). Each party requires first name, last name, address, Is Resident (yes/no), insurance company, and vehicle make and model. Helpful: phone, policy number, insurance contact number, VIN and license plate. All of this comes from the Reporting tab's Person/Owner > Vehicle section. Changes: add the 'Is Resident' question, mark the required party fields as required when the incident is a vehicle accident, decide where the incident-level Law Enforcement Number lives (the Vehicle section has a per-vehicle police report number today), and map every field into the billing request.",
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
        fix: "Manual backup, rehearse the four database additions and the release on a copy of production, release, then submit one controlled real incident. CAD automation stays switched off for Crescent until Stage D.",
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
        fix: "Reject unknown addresses and add an admin screen for allowed senders. Decided October 29: when a department has no allowed senders listed, CAD emails are accepted from no one until an address is added. Crescent's only sender is dispatch@co.iroquois.il.us.",
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
  ["NERIS export history", "Browser writes 'export succeeded' records", "10"],
  ["NERIS export button", "Server does not check who exports", "6"],
  ["Report edit lock", "Lock enforced only on screen", "9A"],
  ["Report editing", "Last save silently wins; no change history", "9A"],
  ["CAD email intake (production)", "Secret optional in the production code version; no sender allowlist on main", "23, 9B (secret confirmed set)"],
  ["Department settings save", "Can also create, change or delete user accounts", "6"],
  ["Default test accounts", "Kept on purpose October 30. Guessable passwords remain a risk until you change them in the app.", "9B"],
  ["Browser-only settings", "Some settings differ between computers", "9B"],
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
  ["October 29, 2026", "Software", "Packages with known flaws were upgraded on the practice branch. The security scan reports no remaining issues. Not deployed.", "8"],
  ["October 30, 2026", "NERIS", "Departments do not log in to NERIS. One vendor key stays on the server. Each department exports only under the NERIS Entity ID an admin sets in Admin Functions. Export uses that saved ID.", "7, 9A"],
  ["October 30, 2026", "Reports", "The server refuses edits to In Review and Exported reports. Draft stays editable. After Validate or Export, only an admin can unlock.", "9A"],
  ["October 30, 2026", "Reports", "If someone else saved first, the save stops with: 'Someone else saved this report while you were editing. Reload to see their changes before saving again.'", "9A"],
  ["October 30, 2026", "Reports", "A new add-only history list stores who, when, which report, and which field names changed. Old and new text are not stored. History is kept forever and shown inside that report.", "9A"],
  ["October 30, 2026", "Reports", "A report must be unlocked before it can be deleted. Only an admin can delete.", "9A"],
  ["October 30, 2026", "Production", "Keep the admin and demo accounts. Set NODE_ENV=production on both Render services during a planned release.", "9B"],
  ["October 30, 2026", "Settings", "Move the department logo (500 KB limit), dispatch workflow states, submenu visibility, and submenu cards to the server. Incident list layout and sidebar width stay on each computer. Shift trades wait.", "9B"],
];

const decisions = [
  ["Fire Recovery", "Reply to Fire Recovery with the account email for the sandbox Welcome Message. Their reply mentions support@fireultimatehq.com as the existing account; confirm whether to use it."],
  ["Fire Recovery", "Approve the Reporting tab changes in Step 15: add 'Is Resident', mark the required party fields as required for vehicle accidents, and decide where the incident-level Law Enforcement Number lives."],
  ["Release checklist", "Approve the Step 9 release checklist wording."],
];

const fireRecoveryEmail = [
  ["Corrections", "Are corrections and resubmissions made only in Recovery Hub (therecoveryhub.com), or is there an API method? How should a corrected report be matched to the original tracking ID?"],
  ["Billing status", "When does billing status become available after submission, and how often may we check it?"],
  ["Parties", "Confirm the required party fields (first and last name, address, Is Resident, insurance company, vehicle make and model). Are date of birth, at-fault, owner and occupant needed for vehicle accidents?"],
  ["Call details", "Should the run number go in IncidentNumber, IncidentID, or both? Is the NFIRS code expected in IncidentType or PrincipleIncidentType?"],
  ["Law enforcement", "If more than one police agency reports, should we send one number or several?"],
  ["Sandbox", "Confirm that submissions using FD12345678 are never billed, and whether sandbox incidents can be cleared after testing."],
  ["Test results", "Summary of the sandbox submissions and any errors returned (added after Step 17)."],
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
      <H2>Set aside for now: scheduling</H2>
      <Text>Scheduling (rotation, D shifts, staffing, Kelly days, vacation, trades) is parked for a separate review and possible rebuild. None of these steps change scheduling features.</Text>
      <Callout tone="warning" title="Scheduling is next after Fire Recovery and CAD (decided October 29)">
        Crescent does not use the schedule today, but Watseka and Kankakee will use it for work days and trades. Scheduling is reviewed in the near future, but not during the Fire Recovery and CAD work. Step 5 automatically protects the scheduling pages. Saving the schedule today can erase days missing from someone's open browser tab, so that fix must be part of the scheduling review before either department relies on it.
      </Callout>
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
        <Text size="small" tone="tertiary">Updated October 30, 2026 · Steps 1–8 done, Steps 9A and 9B approved, not built · Practice copy: cursor/stage-b-foundation-b5ff · Saved in repo: docs/plans/canvases/repair-plan.canvas.tsx · Priority: Fire Recovery, then CAD · Scheduling after Fire Recovery and CAD</Text>
        <H1>Fire Ultimate — step-by-step repair plan</H1>
      </Stack>
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
