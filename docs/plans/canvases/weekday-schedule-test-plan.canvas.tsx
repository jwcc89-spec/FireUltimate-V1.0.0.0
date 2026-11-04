import {
  Callout, Card, CardBody, CardHeader, Divider, H1, H2,
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
    id: "A", name: "Stage A — Set up the test department (no coding)",
    summary: "Build a brand-new weekday department on this Mac, from an empty database, so every setup step is tested the way a new customer would see it.",
    steps: [
      { n: "1", title: "Create a throwaway database and an empty test department on this Mac", status: "Done",
        problem: "This Mac's normal server settings (.env.server) point at the staging database, which holds real Crescent and Watseka data.",
        why: "A from-scratch test must start empty, and it must not be able to change staging.",
        fix: "November 3, 2026: installed a private database program in ~/fu-local-db (outside the project, no admin rights needed), created the app's tables in it, and created 'Weekday Test Fire Department' with one admin account. The local server runs from its own settings file with only the local database address. It has no NERIS or Fire Recovery keys.",
        who: "Me.",
        done: "Completed: http://localhost:5173 shows Weekday Test Fire Department and admin sign-in works. Staging was not touched." },
      { n: "2", title: "Set up the department from scratch in Admin Functions", status: "Done",
        problem: "We have never timed or written down what a new department must fill in before the schedule works.",
        why: "Ease of setup decides whether departments can onboard themselves.",
        fix: "November 4: the Weekday Test Fire Department is set up. The shift is 8a-8p, 08:00, 12 hours, Daily. Personnel, qualifications, and apparatus are in place, and the Personnel Schedule has been used for the trades tests. Setup findings are on the Findings tab.",
        who: "You; I record findings.",
        done: "Passed. The user confirmed Step 2 is complete. The schedule opens and has been used." },
    ],
  },
  {
    id: "B", name: "Stage B — Make the schedule fit a weekday 12-hour department",
    summary: "The scheduler was built around 24-hours-on, 48-hours-off rotations. These steps add weekday shifts without changing how the 24/48 department works.",
    steps: [
      { n: "3", title: "Let a shift run on chosen weekdays (Monday–Friday)", status: "Next",
        problem: "Shift Information → Recurrence only offers Daily, Every other Day, Every 2 days, Every 3 days, or Custom (a number of days). Daily also schedules Saturday and Sunday.",
        why: "This department works 08:00–20:00 Monday through Friday only. Weekend days would show empty seats and false HIRE openings.",
        fix: "November 4: you chose to put this under Recurrence → Custom. Custom will let an admin pick weekdays (Monday–Friday for this department), saved with the existing shift settings (no database structure change). The calendar shows only the chosen days. Custom offers two choices: 'every N days' as today, or pick weekdays with Monday–Sunday checkboxes.",
        who: "Me.",
        done: "Not started. Done when the weekday department's calendar shows only Monday–Friday and a 24/48 shift still shows exactly the same days as before." },
      { n: "4", title: "Stop tying the rotation to the letters A, B and C", status: "New",
        problem: "The calendar counts shift days from January 1, 2026 and shifts the start by one day for 'A Shift' and two days for 'B Shift'. Shift names other than A, B or C start on day zero. The list is also sorted A, B, C, D by name.",
        why: "Departments name shifts differently (Day Shift, Red, Platoon 1). A hidden rule based on the name is hard to discover during setup.",
        fix: "Proposed: an optional 'Rotation starts on' date per shift in Shift Information. Shifts without one keep today's A/B/C behavior, so the 24/48 department is unchanged.",
        who: "Me, after your approval.",
        done: "Not started. Done when a shift with any name can be placed on the right days by setting its start date." },
      { n: "5", title: "Make hour and overtime rules follow the real shift length", status: "Done",
        problem: "Several rules looked like they assumed 24 hours, such as a Standard Overtime Slot that starts at 24 hours.",
        why: "With a 12-hour shift, a 24-hour overtime piece would be longer than the whole shift.",
        fix: "November 4: no code change needed. 24 hours is only the starting value. Admin Functions → Scheduler Settings → Overtime Setup lets each department set the Standard Overtime Slot to 12, 8, or any number of hours, and splits follow it.",
        who: "You confirmed.",
        done: "Closed November 4. The overtime length is a department setting, and the 12-hour test splits and overtime worked." },
      { n: "6", title: "Re-test trades, overtime and the calendar view for this department", status: "Done",
        problem: "Trades, overtime, segments and the month and day views were tuned for the 24/48 department.",
        why: "They must work for a single weekday crew too.",
        fix: "November 3–4: covered by the Stage D click-tests. Segmenting, the month and day views, trades, and overtime were all used on the 12-hour test department.",
        who: "You.",
        done: "Passed November 4. You found no problems with segmenting, the month and day views, trades, or overtime. Weekday-only days are still Step 3." },
    ],
  },
  {
    id: "C", name: "Stage C — Take it to the Watseka staging trial",
    summary: "Only after the local test passes.",
    steps: [
      { n: "7", title: "Push to GitHub and test on watsekademo.staging.fireultimate.app", status: "New",
        problem: "Local testing cannot prove the change works on the real staging site.",
        why: "Every change passes on staging before production.",
        fix: "Commit, push, and release to staging under the repair plan's release rules, then repeat the key checks on the Watseka trial department.",
        who: "You, with guidance.",
        done: "Not started. Done when the weekday schedule works on staging and Crescent's schedule is unchanged." },
    ],
  },
  {
    id: "D", name: "Stage D — Trades between members",
    summary: "A member asks another member to cover part or all of a scheduled shift. The other member accepts or denies. Steps 8 through 13 passed the local click-test. An accepted trade splits the schedule. Cancelling it puts both days back.",
    steps: [
      { n: "8", title: "Give trades a shared home on the server", status: "Done",
        problem: "Trades were saved only in the browser of the person who typed them. Landon never saw a request from Josh, and admins saw nothing.",
        why: "A request has to reach the other person's account, and each person may see only their own trades.",
        fix: "November 3: added a trades table to the database (you approved it), with one row per request inside one department. It is on the local test database only. The Trades page now reads and saves through the server. Members see only their own trades. Sub Admins and above see all trades and can show All trades, My trades, or one shift (for example 8a-8p). Only the person asked can accept or deny. Denying needs a reason.",
        who: "Me.",
        done: "Completed: 15 server checks passed on the local database. Josh's request reached Landon and admin, Lance and Kenny could not see it, and only Landon could answer it. The test trades were deleted afterward." },
      { n: "9", title: "Add a Trades screen to Scheduler Settings", status: "Done",
        problem: "Departments handle trades differently. Career crews pay trades back. On-call crews may just cover hours.",
        why: "Each department needs to set its own rules without code changes.",
        fix: "November 3: Admin Functions → Scheduler Settings → Trades has three checkboxes, all starting off. Admin approval for trades makes an accepted trade wait for a sub admin, admin, or super admin. Payback required is the starting value of the checkbox on a new request, and the sender can still change it. Require approval before cancelling a trade makes a cancellation wait for a sub admin or above (Step 13).",
        who: "Me.",
        done: "Completed: an admin can turn the three settings on, another account sees them, an accepted trade waits for admin approval, and turning approval off lets the other person finish it." },
      { n: "10", title: "Rebuild the New Trade Request form", status: "Done",
        problem: "Counterpart was free text, the date was any date, and there was no payback choice.",
        why: "Requests should only go to real roster members, for days the requester actually works.",
        fix: "November 3: Trade With is a list from Scheduler Settings → Personnel, with your own name left out. Your Assigned Date can be typed, or picked from days you are already on a truck or a split piece. Start and end are 24-hour times. Payback required starts from the department setting and grays out Date You Work Instead when it is off.",
        who: "Me.",
        done: "Completed: the form offers roster members, scheduled days, 24-hour times, and the department payback setting." },
      { n: "11", title: "Check a request before it is sent", status: "Done",
        problem: "Nothing stops a trade to someone unqualified or already working.",
        why: "An accepted trade must never leave a seat unqualified.",
        fix: "November 3: Submit Trade Request is refused, and nothing is saved, when the crew cannot cover the truck for those hours, the other person already works those hours, or that person is on Injury, Vacation, Sick, or Kelly Day. A person in a lower seat can move up when their qualification covers the seat being given up, and the new person must meet the seat that move opens. A higher qualification can cover a lower seat. The notice is the same centered message used on the schedule. Chief on Call does not block. The payback day is checked when the trade is accepted.",
        who: "Me.",
        done: "Passed: a bad request shows the reason and is not saved, a good request still sends, and a paramedic in the lower seat can move up." },
      { n: "12", title: "Accept, deny, approve, and put the trade on the schedule", status: "Done",
        problem: "The current Accept and Approve buttons only change a label. The schedule never changes.",
        why: "Accepted trades should appear on the schedule with no manual editing.",
        fix: "November 3: Accept puts the trade on the schedule when admin approval is off. When admin approval is on, the schedule changes only after Approve. Deny does not change the schedule. For 11/5 08:00–10:00, the other person covers 08:00–10:00 and the requester keeps 10:00–20:00. If someone already works the whole shift and can fill the higher seat, that person moves there for the entire shift and that seat is not split. Only the hours that still change people are listed on Trades. Payback uses the same rule. The previous day is saved so Step 13 can put it back.",
        who: "Me.",
        done: "Passed November 4: Accept splits November 5, Lance stays in the top seat all day, and only Kenny then Josh are split in the lower seat." },
      { n: "13", title: "Cancel a trade and put the schedule back", status: "Done",
        problem: "There is no way to undo a trade.",
        why: "Plans change, and the schedule must return to how it was.",
        fix: "November 4: Either person clicks Cancel Requested Trade on an accepted trade. The other person clicks Accept Cancellation. If Require approval before cancelling a trade is on, a sub admin or above must Approve Cancellation before the schedule changes. Then both the trade day and any payback day go back to the saved previous day. Keep Trade, or an admin Deny, leaves the schedule as it is and the trade stays Accepted.",
        who: "Me.",
        done: "Passed November 4: cancelling the 11/5 example restores Josh 08:00–20:00 and Lance in the lower seat, and the Trades lines are gone." },
    ],
  },
  {
    id: "E", name: "Stage E — Fixes found during testing",
    summary: "Added November 4, 2026 from your notes after the Stage D tests. Each is a separate small change. Step 20 (Dashboard Alerts) was added the same day and is built with Step 17.",
    steps: [
      { n: "14", title: "Widen the Department Apparatus window", status: "New",
        problem: "Admin Functions → Setup/Configuration → Operational Details → Department Apparatus opens a window that is too narrow. You must scroll sideways to see the whole table and to reach Close and Edit.",
        why: "Admins should see every column and the buttons without scrolling sideways.",
        fix: "Make that window as wide as the Edit Users and Edit Personnel windows were made on November 3, so the table and its buttons fit on a normal desktop screen.",
        who: "Me.",
        done: "Not started. Done when the whole Department Apparatus table, Close, and Edit are visible without scrolling sideways." },
      { n: "15", title: "Lock the schedule for people who may not edit it", status: "New",
        problem: "Admin Functions → Setup/Configuration → Access/Restrictions → Edit the schedule can be set to Sub Admin. A regular user can still open a day block, remove people, and make changes. The server already refuses to save those changes, so they disappear on refresh, but the screen gives no sign of that.",
        why: "A user should not be able to make changes that look saved but are thrown away.",
        fix: "When the signed-in person lacks Edit the schedule, clicking a day block does nothing (decided November 4), so nothing can be removed, added, moved, split, or typed. Trades are not affected. Requesting, accepting, and cancelling a trade go through the Trades page and the server's trades route, which is separate from schedule saving.",
        who: "Me.",
        done: "Not started. Done when a user without the permission cannot change a day block, an admin still can, and a user can still send and accept trades that change the schedule." },
      { n: "16", title: "Pick a qualification for each seat in Scheduler Apparatus", status: "New",
        problem: "Admin Functions → Setup/Configuration → Scheduler Settings → Scheduler Apparatus lets each qualification be chosen only once. With a minimum of 2, an apparatus can require Paramedic and EMT-B but not two Paramedics or two EMT-Bs.",
        why: "Many apparatus require two people with the same qualification.",
        fix: "Show one qualification choice per seat (Seat 1, Seat 2, and so on, up to the minimum), and allow the same qualification on more than one seat. If only one qualification is chosen, every seat uses it. Saved in the existing scheduler settings (no database structure change). Apparatus saved before this change keep working.",
        who: "Me.",
        done: "Not started. Done when an apparatus can require two Paramedics, the schedule enforces both seats, and the existing Paramedic + EMT-B apparatus is unchanged." },
      { n: "17", title: "Request Admin Permission when a person misses a seat's qualification", status: "New",
        problem: "Personnel → Schedule → day block: when an EMT-B is already in the lower seat and another EMT-B tries the top (Paramedic) seat, the qualification message blocks it. Some departments allow two EMT-Bs to ride with an administrator's approval.",
        why: "Those departments need a way to staff the apparatus legally without turning the qualification check off for everyone.",
        fix: "Add a setting in Admin Functions → Scheduler Settings → Personnel Qualifications: Allow admin override for each qualification. Each overridable qualification names the one lower qualification allowed (for example EMT-B for Paramedic). When a person with that lower qualification is blocked, the message gets a Request Admin Permission button. The person sits in the seat marked Pending until a Sub Admin or above approves or denies. Requests are saved in a new database table (approved November 4), one row per request in one department. Admins see them on Personnel → Trades in the same table as trades: bold, marked with an asterisk, and always pinned to the top. They also appear in the new Dashboard Alerts section (Step 20).",
        who: "Me.",
        done: "Not started. Done when an overridable seat offers Request Admin Permission, the request is bold and pinned at the top of Personnel → Trades for admins, the placement takes effect only after an approval, and a seat without the setting still blocks as it does today." },
      { n: "18", title: "Clean up the New Trade Request form", status: "New",
        problem: "Personnel → Trades has a Payback required checkbox on each request, but payback is a department rule. Some labels are long, and the date fields sit on their own row.",
        why: "Members should not be able to change a department rule, and the form should be shorter to read.",
        fix: "Remove the Payback required checkbox from the form. The department setting in Scheduler Settings → Trades decides it, and Date You Work Instead follows it. Rename Your Assigned Date to Date. Rename Or pick a day you are scheduled to Select Scheduled Day. Put Trade With, Date, and Select Scheduled Day on one line. Date and Select Scheduled Day are the same width, and Trade With is slightly narrower than today.",
        who: "Me.",
        done: "Not started. Done when the form has no payback checkbox, shows the new labels, and the three fields sit on one line." },
      { n: "19", title: "Show every scheduled day in Select Scheduled Day", status: "New",
        problem: "Personnel → Trades → the scheduled-day list shows only about 7 days and cannot reach later dates.",
        why: "Members trade shifts weeks ahead.",
        fix: "The list is built only from days already saved on the server with the person on a truck. Days the person works by roster, but that nobody has opened and saved, are missing. Build the list from the shift's own working days as well, from today forward for 3 months (decided November 4), and keep it scrollable.",
        who: "Me.",
        done: "Not started. Done when Josh's list shows his working days for the next 3 months, not only saved days." },
      { n: "20", title: "Add an Alerts section to the Dashboard", status: "New",
        problem: "Nothing on the Dashboard shows items that need attention right away.",
        why: "Admins must see critical items, such as a seat waiting for permission, as soon as they sign in.",
        fix: "Add an Alerts section above the submenu cards on the Dashboard. It lists critical messages and items that need action now. The first alert type is Request Admin Permission from Step 17, shown to Sub Admin and above, and clicking it opens Personnel → Trades. The section is hidden when there are no alerts. More alert types can be added later.",
        who: "Me, built together with Step 17.",
        done: "Not started. Done when a pending permission request appears in Dashboard Alerts for a sub admin, does not appear for a regular user, and leaves the list once approved or denied." },
    ],
  },
];

const findings = [
  ["Setup", "No screen creates a new department. It takes the tenant:create script or the platform admin API, which only the program owner can run.", "Parked & future"],
  ["Setup", "November 3: Admin menu reordered. Personnel Management is second. NERIS Reporting, Hydrants, Customization, then Dispatch Parsing Settings. Beta items sit under that. Audit Logs is last.", "Done"],
  ["Setup", "November 3: Edit Users and Edit Personnel windows are wide enough for their columns on a normal desktop.", "Done"],
  ["Setup", "November 3: Reporting renamed to NERIS Reporting. Required-field sections start collapsed. Click a section name to open it.", "Done"],
  ["Setup", "November 3: Scheduler Personnel stayed empty after accounts were created, because the roster was not filled from the account list on page load. Opening Edit Personnel now lists every account. Click Save Scheduler Settings after assigning shifts.", "Done"],
  ["Setup", "Shift Duration is a number of hours. The test shift is saved as 8a-8p, 08:00, 12 hours, Daily.", "Noted"],
  ["Setup", "Additional Fields showing 8 is the built-in list (Info, Chief on Call, Vacation, Kelly Day, Injured, Sick, Other, Trade).", "Noted"],
  ["Schedule", "No weekday recurrence. Daily includes weekends. The test shift uses Daily, so Saturday and Sunday will appear.", "Step 3"],
  ["Schedule", "Rotation day counting depends on the letters A, B and C in the shift name. The test shift is named 8a-8p, so it does not use the A/B/C offset.", "Step 4"],
  ["Schedule", "Standard Overtime Slot starts at 24 hours, but Overtime Setup lets the department change it to 12, 8, or any length. No fix needed.", "Step 5 (closed)"],
  ["Schedule", "Recurrence 'Every other Day' and 'Every 2 days' both mean every 2nd day, which may confuse admins.", "Step 3"],
  ["Setup", "November 4: the Department Apparatus window is too narrow. Close and Edit need sideways scrolling.", "Step 14"],
  ["Access", "November 4: with Edit the schedule set to Sub Admin, a user can still change a day block. The changes are lost on refresh because the server refuses them.", "Step 15"],
  ["Setup", "November 4: Scheduler Apparatus cannot require the same qualification on two seats, such as two Paramedics.", "Step 16"],
  ["Schedule", "November 4: no way to ask an administrator to allow two EMT-Bs on a Paramedic and EMT-B apparatus.", "Step 17"],
  ["Trades", "November 4: members can change Payback required on a request, though it is a department rule. Labels and layout need cleanup.", "Step 18"],
  ["Trades", "November 4: Select Scheduled Day shows only about 7 days, because it lists only days saved on the server.", "Step 19"],
];

const decided = [
  ["November 3, 2026", "Test location", "A throwaway database on this Mac (~/fu-local-db). Staging is used only after the local test passes and the code is pushed."],
  ["November 3, 2026", "Plan", "This is a new canvas plan. Its copy lives in docs/plans/canvases/."],
  ["November 3, 2026", "Nights and weekends", "Covered by volunteer or paid-on-call members who are not scheduled in the app. Those hours do not appear on the schedule."],
  ["November 3, 2026", "Schedule type", "No Career / Paid-on-call picker. The current scheduler is used. People are assigned to the 8a-8p shift, with apparatus and station left blank so they are not auto-placed. They are picked on the calendar."],
  ["November 3, 2026", "Times on the schedule", "The Info row is the one place that uses a short clock: 8A-10A and 10A-8P. Each person is on their own line, with no apparatus name. Lance Keller reads KELL. Landon LeDuke reads LEDL. Those lines fill the first Info box, so that day has three note boxes left."],
  ["November 3, 2026", "Qualification colors", "Eight basic colors sit next to each qualification. Nothing is colored until someone picks a color. A person with more than one qualification uses the color of the highest one in the list."],
  ["November 3, 2026", "Seat order", "When two people together meet an ambulance's qualifications, the person who only has the lower qualification moves to that lower seat. The higher qualification stays on the stricter seat. A person who does not fill an open qualification is not added, and the people already on that day stay."],
  ["November 3, 2026", "Info on the schedule", "Additional fields use labeled Rows visible and Maximum rows. Info, Kelly Day, Trades, and Injury can be hidden but not deleted. A segmented personnel field can show its times in Info, in Trades, or not at all."],
  ["November 3, 2026", "Segmented shift vs overtime", "A segmented shift and overtime are separate. Segmented hours are chosen in Shift Information. Overtime hours are chosen in Overtime Setup. An empty split piece says OPEN in red. It says HIRE only when that piece's OT box is checked, and that name is red and bold."],
  ["November 3, 2026", "Scheduler settings layout", "Shift Information and Scheduler Apparatus put the edit form above the list. Qualifications can be removed. Additional fields can use 0 visible rows, and the usual starting value stays 1."],
  ["November 3, 2026", "Injury and a split seat", "A person on Injury, Vacation, Sick, or Kelly Day cannot be placed on a truck until they are removed from that row. A person who misses a seat's qualification is not placed on that seat."],
  ["November 3, 2026", "Rows visible at zero", "Zero visible rows hides the blank typing lines. Split-shift hours still show on Info or Trades. Turning off the split checkbox deletes that split."],
  ["November 3, 2026", "Trade approval", "The other person must always click Accept. A new Scheduler Settings → Trades screen can also require admin approval."],
  ["November 3, 2026", "Trade payback", "Payback required lives in Scheduler Settings → Trades and on the request form, and starts unchecked. When a Date You Work Instead is entered, accepting the trade puts the requester on that day in the other person's place for the same hours."],
  ["November 3, 2026", "Cancelling a trade", "Either person clicks Cancel Requested Trade. The other person accepts the cancellation, then the schedule goes back to how it was. A Trades setting can also require admin approval before cancelling."],
  ["November 3, 2026", "Who sees trades", "Members see only trades they are part of. Sub Admin, Admin, and Super Admin see every trade, and Active Requests lets them show All trades, My trades, or one shift."],
  ["November 3, 2026", "Where trades are saved", "A new trades table in the database, one row per request. You approved the structure change. It is on the local test database only. Staging and production get it when this branch is released."],
  ["November 3, 2026", "Trade settings", "Scheduler Settings → Trades has Admin approval, Payback required, and Require approval before cancelling. All start off. Payback required is the starting value on a new request, and the sender can change it. Admin approval makes the trade wait for a sub admin or above. Cancel approval does the same for a cancellation."],
  ["November 4, 2026", "Overtime length (Step 5)", "Closed. Standard Overtime Slot is a department setting in Overtime Setup. 24 hours is only the starting value."],
  ["November 4, 2026", "Re-test (Step 6)", "Closed. The Stage D tests covered segmenting, month and day views, trades, and overtime with no problems found."],
  ["November 4, 2026", "Weekday recurrence (Step 3)", "Weekday selection goes under Recurrence → Custom, so Monday–Friday can be chosen."],
  ["November 4, 2026", "Custom recurrence layout (Step 3)", "Custom offers two choices: 'every N days' as today, or pick weekdays with Monday–Sunday checkboxes."],
  ["November 4, 2026", "Locked day block (Step 15)", "For a person without Edit the schedule, clicking a day block does nothing."],
  ["November 4, 2026", "Admin override approval (Step 17)", "Sub Admin and above approve. While waiting, the person is in the seat marked Pending. Each overridable qualification names the one lower qualification allowed, such as EMT-B for Paramedic."],
  ["November 4, 2026", "Override requests storage (Step 17)", "You approved a new database table for permission requests, one row per request in one department, like the trades table. Local test database first."],
  ["November 4, 2026", "Where admins see override requests (Step 17)", "Personnel → Trades, in the same table as trades. Permission requests are bold, start with an asterisk, and always stay at the top."],
  ["November 4, 2026", "Dashboard Alerts (Step 20)", "A new Alerts section above the Dashboard submenu cards for critical items that need attention right away. Permission requests are the first alert type."],
  ["November 4, 2026", "Scheduled-day list (Step 19)", "Select Scheduled Day lists working days from today through the next 3 months."],
  ["November 4, 2026", "Holidays", "Holidays are normal working days. No holiday handling is needed."],
  ["November 4, 2026", "Payback on the request (Step 18)", "Payback required is set only by the department in Scheduler Settings → Trades. The checkbox comes off the request form."],
  ["November 4, 2026", "Locked schedule and trades (Step 15)", "Locking the schedule must not stop members from sending, accepting, or cancelling trades."],
  ["November 3, 2026", "Trade send check", "A request is refused before it is saved when the crew cannot cover the truck for those hours, the other person already works those hours, or that person is on Injury, Vacation, Sick, or Kelly Day. Someone in a lower seat can move into a higher seat when they hold that qualification, and the new person must meet the seat that opens. A higher qualification can cover a lower seat. The payback day is not checked until Step 12."],
];

const stillOpen: string[][] = [];

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

function StartHere() {
  return (
    <Stack gap={14}>
      <Text>
        The scheduler was built and tuned for a department working 24 hours on, 48 hours off. This plan tests it
        with a department that works one 12-hour shift, 08:00–20:00, Monday through Friday. You set the department
        up from nothing, the way a new customer would. Every problem you hit becomes a finding, then a fix.
      </Text>
      <Table
        headers={["Stage", "Purpose", "Steps", "Mostly done by"]}
        rows={[
          ["A — Set up the test department", "Empty local database, then a from-scratch setup", "1–2", "You, with me recording"],
          ["B — Fit the weekday schedule", "Weekday shifts, rotation start dates, 12-hour rules, re-test", "3–6", "Me, after your approval"],
          ["C — Watseka staging trial", "Repeat the checks on staging", "7", "You, with guidance"],
          ["D — Trades between members", "Requests, accept/deny, approval, payback, cancel, schedule changes", "8–13", "Me, after your decisions"],
          ["E — Fixes found during testing", "Window width, schedule lock, seat qualifications, admin override, Trades form, scheduled-day list, Dashboard Alerts", "14–20", "Me"],
        ]}
      />
      <H2>How to open the test department</H2>
      <Table
        headers={["What", "Value"]}
        rows={[
          ["Web address", "http://localhost:5173"],
          ["Username", "admin"],
          ["Password", "The one you set. It is not written in this plan."],
        ]}
      />
    </Stack>
  );
}

function Findings() {
  return (
    <Stack gap={10}>
      <H2>Findings so far</H2>
      <Text tone="secondary">Found by reading the code on November 3, 2026, before the click-through. Your setup findings are added here as you go.</Text>
      <Table headers={["Area", "Finding", "Handled in"]} rows={findings} striped />
    </Stack>
  );
}

function DecisionsTab() {
  return (
    <Stack gap={14}>
      <H2>Decided</H2>
      <Table headers={["Date", "Topic", "Decision"]} rows={decided} striped />
      {stillOpen.length > 0 && (
        <>
          <H2>Still open</H2>
          <Table headers={["Question", "Detail"]} rows={stillOpen} striped />
        </>
      )}
    </Stack>
  );
}

function Safety() {
  return (
    <Stack gap={12}>
      <H2>Data-safety rules for this test</H2>
      <Table
        headers={["Rule", "What it means"]}
        rows={[
          ["Local database only", "All testing uses the throwaway database at 127.0.0.1 port 5433 in ~/fu-local-db. It can be deleted and rebuilt at any time."],
          ["Never start the server with npm run proxy for this test", "That command reads .env.server, which points at staging. The local server for this test uses ~/fu-local-db/api.env instead."],
          ["No staging keys locally", "The local settings file has no NERIS or Fire Recovery keys, so nothing can be exported or billed from this test."],
          ["Keep 24/48 working", "Every schedule change must leave the existing 24-hours-on, 48-hours-off behavior exactly the same."],
          ["No database structure changes without approval", "Weekday settings should fit in the existing shift settings. Ask first if a change to the database structure seems needed. The trades table was approved on November 3 and is applied only to the local test database."],
          ["Trades change one day at a time", "Accepting or cancelling a trade changes only the days in that trade, never the rest of the schedule."],
          ["Staging after local", "Nothing goes to watsekademo.staging.fireultimate.app until the local test passes and you approve the push, under the repair plan's Data safety rules."],
          ["No secrets in chat or in this plan", "Never share staging or production passwords or database addresses. The local admin password is not written here."],
        ]}
        striped
      />
    </Stack>
  );
}

function Parked() {
  return (
    <Stack gap={12}>
      <H2>Parked and future</H2>
      <Table
        headers={["Item", "Why it is parked"]}
        rows={[
          ["A screen to create a new department", "Today only the program owner can create one, with a script. A self-service or owner screen is a larger change that touches sign-in setup."],
          ["Scheduling nights and weekends for volunteer or paid-on-call members", "This department does not schedule them in the app."],        ]}
        striped
      />
    </Stack>
  );
}

export default function Plan() {
  const theme = useHostTheme();
  const tabs = ["Start here", "Findings", "Stage A", "Stage B", "Stage C", "Stage D", "Stage E", "Decisions", "Data safety", "Parked & future"] as const;
  type T = typeof tabs[number];
  const [tab, setTab] = useState<T>("Stage E");
  const stageFor: Record<string, string> = { "Stage A": "A", "Stage B": "B", "Stage C": "C", "Stage D": "D", "Stage E": "E" };
  const st = stages.find((s) => s.id === stageFor[tab]);
  return (
    <Stack gap={18} style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px 64px", background: theme.bg.editor }}>
      <Stack gap={6}>
        <Text size="small" tone="tertiary">Updated November 4, 2026, 11:45 a.m. Chicago · Branch cursor/watseka-scheduling-plan · Stages A and D done · Steps 5 and 6 closed · Stage E added (Steps 14–20) · No open questions · Nothing on staging</Text>
        <H1>Scheduling — weekday 12-hour department test</H1>
      </Stack>
      <Callout tone="info" title="Next: Step 3 and Stage E, after your answers">
        Steps 5 and 6 are closed. Step 3 puts weekdays under Recurrence → Custom. Stage E lists six fixes from your November 4 notes. Your November 4 answers are in Decisions, and no questions are open. Steps 3 and 14–20 can all start. Steps 17 and 20 are built together. A 24/48 shift must keep showing the same days it shows today.
      </Callout>
      <Row gap={6} wrap>{tabs.map((t) => <Pill key={t} active={t === tab} onClick={() => setTab(t)}>{t}</Pill>)}</Row>
      <Divider />
      {tab === "Start here" && <StartHere />}
      {tab === "Findings" && <Findings />}
      {st && (
        <Stack gap={10}>
          <H2>{st.name}</H2>
          <Text tone="secondary">{st.summary}</Text>
          {st.steps.map((s) => <StepCard key={s.n} s={s} />)}
        </Stack>
      )}
      {tab === "Decisions" && <DecisionsTab />}
      {tab === "Data safety" && <Safety />}
      {tab === "Parked & future" && <Parked />}
    </Stack>
  );
}
