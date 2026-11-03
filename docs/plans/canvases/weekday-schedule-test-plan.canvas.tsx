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
      { n: "2", title: "Set up the department from scratch in Admin Functions", status: "Next",
        problem: "We have never timed or written down what a new department must fill in before the schedule works.",
        why: "Ease of setup decides whether departments can onboard themselves.",
        fix: "You enter department details, stations, apparatus, qualifications, personnel, Shift Information (one 12-hour shift starting 08:00) and Scheduler Settings, in whatever order feels natural. Tell me every confusing label, missing hint, error, or dead end as you go, and I add it to the Findings tab.",
        who: "You; I record findings.",
        done: "The Personnel Schedule page opens for the new department, and the Findings tab lists every setup problem you hit." },
    ],
  },
  {
    id: "B", name: "Stage B — Make the schedule fit a weekday 12-hour department",
    summary: "The scheduler was built around 24-hours-on, 48-hours-off rotations. These steps add weekday shifts without changing how the 24/48 department works.",
    steps: [
      { n: "3", title: "Let a shift run on chosen weekdays (Monday–Friday)", status: "New",
        problem: "Shift Information → Recurrence only offers Daily, Every other Day, Every 2 days, Every 3 days, or Custom (a number of days). Daily also schedules Saturday and Sunday.",
        why: "This department works 08:00–20:00 Monday through Friday only. Weekend days would show empty seats and false HIRE openings.",
        fix: "Proposed: add a 'Selected weekdays' recurrence with Monday–Sunday checkboxes, saved with the existing shift settings (no database structure change). The calendar shows only checked days. Needs your approval of the wording and layout first.",
        who: "Me, after your approval.",
        done: "Not started. Done when the weekday department's calendar shows only Monday–Friday and a 24/48 shift still shows exactly the same days as before." },
      { n: "4", title: "Stop tying the rotation to the letters A, B and C", status: "New",
        problem: "The calendar counts shift days from January 1, 2026 and shifts the start by one day for 'A Shift' and two days for 'B Shift'. Shift names other than A, B or C start on day zero. The list is also sorted A, B, C, D by name.",
        why: "Departments name shifts differently (Day Shift, Red, Platoon 1). A hidden rule based on the name is hard to discover during setup.",
        fix: "Proposed: an optional 'Rotation starts on' date per shift in Shift Information. Shifts without one keep today's A/B/C behavior, so the 24/48 department is unchanged.",
        who: "Me, after your approval.",
        done: "Not started. Done when a shift with any name can be placed on the right days by setting its start date." },
      { n: "5", title: "Make hour and overtime rules follow the real shift length", status: "New",
        problem: "Several rules assume 24 hours: the schedule spec's 'full obligation is typically 24 hours', a Standard Overtime Slot that defaults to 24 hours, and default two-piece splits sized for 24-hour shifts.",
        why: "With a 12-hour shift, a 24-hour overtime piece is longer than the whole shift, and hour totals could mark everyone as short.",
        fix: "Check each rule against the shift's own duration during Step 2 and Step 6, then fix the ones that misbehave.",
        who: "You find; I fix.",
        done: "Not started. Done when a 12-hour shift splits, counts hours, and shows HIRE correctly, and the 24/48 results are unchanged." },
      { n: "6", title: "Re-test trades, overtime and the calendar view for this department", status: "New",
        problem: "Trades, overtime, segments and the month and day views were tuned for the 24/48 department.",
        why: "They must work for a single weekday crew too.",
        fix: "Walk through a normal week: assign crews, mark sick time, split a shift, hire overtime, and request a trade. Record anything that looks wrong.",
        who: "You; I record and fix.",
        done: "Not started. Done when a full Monday–Friday week can be scheduled with no workarounds." },
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
  ["Schedule", "Standard Overtime Slot is still 24 hours, which is longer than this 12-hour shift. It was left unchanged during setup.", "Step 5"],
  ["Schedule", "Recurrence 'Every other Day' and 'Every 2 days' both mean every 2nd day, which may confuse admins.", "Step 3"],
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
];

const stillOpen = [
  ["Weekends", "Daily still puts Saturday and Sunday on the calendar. Monday–Friday only is not built."],
  ["Holidays", "Are holidays worked or skipped?"],
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
        ]}
      />
      <H2>How to open the test department</H2>
      <Table
        headers={["What", "Value"]}
        rows={[
          ["Web address", "http://localhost:5173"],
          ["Username", "admin"],
          ["Password", "Weekday#2026 (throwaway, this Mac only)"],
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
      <H2>Still open</H2>
      <Table headers={["Question", "Detail"]} rows={stillOpen} striped />
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
          ["No database structure changes without approval", "Weekday settings should fit in the existing shift settings. Ask first if a change to the database structure seems needed."],
          ["Staging after local", "Nothing goes to watsekademo.staging.fireultimate.app until the local test passes and you approve the push, under the repair plan's Data safety rules."],
          ["No secrets in chat", "The local test password is throwaway. Never share staging or production passwords or database addresses."],
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
          ["Scheduling nights and weekends for volunteer or paid-on-call members", "This department does not schedule them in the app."],
          ["Holiday handling", "Waits on the Holidays answer in Decisions."],
        ]}
        striped
      />
    </Stack>
  );
}

export default function Plan() {
  const theme = useHostTheme();
  const tabs = ["Start here", "Findings", "Stage A", "Stage B", "Stage C", "Decisions", "Data safety", "Parked & future"] as const;
  type T = typeof tabs[number];
  const [tab, setTab] = useState<T>("Stage A");
  const stageFor: Record<string, string> = { "Stage A": "A", "Stage B": "B", "Stage C": "C" };
  const st = stages.find((s) => s.id === stageFor[tab]);
  return (
    <Stack gap={18} style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px 64px", background: theme.bg.editor }}>
      <Stack gap={6}>
        <Text size="small" tone="tertiary">Updated November 3, 2026, Chicago · Branch cursor/watseka-scheduling-plan · Segmented hours are chosen in Shift Information · OPEN is red · Nothing on staging</Text>
        <H1>Scheduling — weekday 12-hour department test</H1>
      </Stack>
      <Callout tone="info" title="Next: set up Weekday Test Fire Department from scratch">
        Open http://localhost:5173, sign in as admin, and go through Admin Functions. Tell me every snag as you hit it.
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
