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
    id: "0", name: "Stage 0 — Rules before any code",
    summary: "Lock the working rules so we never repeat the last visual pass that changed too much at once.",
    steps: [
      { n: "0", title: "Agree the one-piece rule and the target", status: "Done",
        problem: "The last visual pass changed many schedule pieces together and took three times longer to stabilize.",
        why: "One visual piece at a time keeps breakages small and easy to undo.",
        fix: "Target is the hybrid mockup (Layout B dates): assets/schedule-mockup-hybrid-a-layout-b-dates.jpg and docs/mockups/schedule-hybrid-wed-nov5.html. Only Personnel Schedule page visuals. No schema, migrations, auth, API, or trade logic. One step → you look → approve → next step. Prefer CSS-only before JSX structure. If a step needs both CSS and JSX, still ship only that one visual piece.",
        who: "You approve; me executes one step at a time.",
        done: "Approved November 4, 2026 evening. Branch: submenu/scheduler-pagevisuals. Today highlight defaults to the real calendar today." },
    ],
  },
  {
    id: "A", name: "Stage A — Page header chrome only",
    summary: "Make the top of the schedule page match the mockup without touching the grid body.",
    steps: [
      { n: "1", title: "Rename the page title text", status: "Done",
        problem: "The live page says Schedule (Personnel). The mockup says Personnel Schedule.",
        why: "Smallest possible first change so we prove the one-piece workflow.",
        fix: "Changed the three visible h1 strings on PersonnelSchedulePage (main, loading, and blocked Start Time states) to Personnel Schedule. No CSS. No control moves.",
        who: "Me.",
        done: "Title reads Personnel Schedule in all three states. Waiting on your click-check before Step 2." },
      { n: "2", title: "Restyle the month navigator as a compact control group", status: "Done",
        problem: "Prev / month / Next look like separate plain buttons, not the mockup's single rounded month control.",
        why: "Header controls should look grouped before we rearrange them.",
        fix: "CSS for the white rounded group, then button labels set to < and > only (no Prev/Next, no ←/→). aria-labels keep Previous/Next month for screen readers. Behavior unchanged.",
        who: "Me.",
        done: "Month nav is one white rounded control with < month > only. Waiting on your click-check before Step 3." },
      { n: "3", title: "Restyle shift, highlight, and Undo to match header buttons", status: "Done",
        problem: "Shift select, Highlight Personnel, and Undo do not match the mockup header control height, radius, and weight.",
        why: "Finish header look before rearranging layout, so later moves do not mix style and structure.",
        fix: "CSS only: shift and highlight selects use 36px height, 10px radius, heavier weight; Undo and clear X match the mockup header button look. No layout move. No KPI strip.",
        who: "Me.",
        done: "Those controls match the mockup header look. Waiting on your click-check before Step 4." },
      { n: "4", title: "Put title left and controls right on one header row", status: "Done",
        problem: "Controls sit under the title instead of in a single header row like the mockup.",
        why: "Layout B puts month, shift, highlight, and Undo on the right of the title.",
        fix: "Header restructured: title (and demo hint) on the left; month, shift, highlight, X, and Undo on the right; Last action under the actions as a quiet right-aligned line. Grid untouched.",
        who: "Me.",
        done: "Header matches the mockup arrangement. Waiting on your click-check before Step 5." },
    ],
  },
  {
    id: "B", name: "Stage B — Grid shell CSS only",
    summary: "Soft panel, quieter borders, and lighter row labels — still the same HTML table.",
    steps: [
      { n: "5", title: "Soft white schedule panel and quieter cell borders", status: "Done",
        problem: "The grid sits in a hard bordered box with dense gray cell lines.",
        why: "The mockup uses a white rounded panel and lighter separators.",
        fix: "CSS only: white 12px panel, light shadow, softer #e8eef5 separators, slightly more cell padding. No header-row rewrite. Label colors left for Step 6.",
        who: "Me.",
        done: "Grid looks like a soft white card. Waiting on your click-check before Step 6." },
      { n: "6", title: "Lighten row and corner labels", status: "Done",
        problem: "DAY / DATE / apparatus labels use heavy gray (#d1d5db) blocks.",
        why: "The mockup uses a lighter slate label column and calmer header cells.",
        fix: "CSS only: DAY/DATE corner cells and row labels use #f1f5f9 with slate text. Red italic day/date headers left for Step 8. Two header rows kept.",
        who: "Me.",
        done: "Labels match the mockup tone. Waiting on your click-check before Step 7." },
      { n: "7", title: "Increase slot spacing inside day cells", status: "Updated",
        problem: "Assigned names sit too tight compared with the mockup's pill stack gap.",
        why: "Spacing can make stacked seats easier to read.",
        fix: "Tried November 5, then fully reverted the same day before a client meeting (gap and day-cell padding restored).",
        who: "Me.",
        done: "Reverted. Seat spacing matches the pre-Step-7 look." },
    ],
  },
  {
    id: "C", name: "Stage C — Date headers (Layout B)",
    summary: "Replace the red italic DAY + DATE rows with one date-chip row and a today highlight. This is the main Layout B change.",
    steps: [
      { n: "8", title: "Combine DAY and DATE into one date-chip header cell", status: "Done",
        problem: "The live grid has two header rows (weekday, then M/D) in red italic. The mockup uses one chip per day: weekday on top, date under it.",
        why: "This is the signature Layout B difference from the current table.",
        fix: "Single header row; each day is a white date chip reading like Tue Nov 3rd with the ordinal in superscript. Corner cell blank. Click/keyboard still opens the day block. Red italic two-row headers removed. Today highlight left for Step 9.",
        who: "Me.",
        done: "One header row of date chips in Tue Nov 3rd style. Waiting on your click-check before Step 9." },
      { n: "9", title: "Highlight today's date chip", status: "Done",
        problem: "No visual cue for the current calendar day on the header.",
        why: "The mockup marks today with a blue border and blue text on the chip.",
        fix: "Today's chip (real calendar today) gets blue border, soft blue fill, blue text, and aria-current=date. No column wash yet.",
        who: "Me.",
        done: "Today's chip matches the mockup. Waiting on your click-check before Step 10." },
      { n: "10", title: "Soft blue wash on today's column body", status: "Done",
        problem: "Only the chip is highlighted; the mockup also tints today's column cells lightly.",
        why: "Makes the selected day readable while scanning down the grid.",
        fix: "Today's body cells get a soft blue wash class. Invalid red state still wins. Assignment logic unchanged.",
        who: "Me.",
        done: "Today's column has a light blue wash. Waiting on your click-check before Step 11." },
    ],
  },
  {
    id: "D", name: "Stage D — Assignment pills",
    summary: "Turn seat cells into mockup-style pills. Shape first, then fill color, then OPEN / segments.",
    steps: [
      { n: "11", title: "Round seat cells into pill shape", status: "Done",
        problem: "Seats are small rectangular boxes, not rounded pills.",
        why: "Shape alone must land before color fills, so we can judge the silhouette.",
        fix: "CSS only on .personnel-schedule-slot: full pill radius, heavier weight, centered text, ellipsis. Borders and text-color qualification tint kept for Step 12.",
        who: "Me.",
        done: "Filled and empty seats look pill-shaped. Waiting on your click-check before Step 12." },
      { n: "12", title: "Use qualification color as pill background fill", status: "Done",
        problem: "Qualification color is only applied as text color today. The mockup fills the whole pill.",
        why: "Background color is the main way the mockup shows role at a glance.",
        fix: "Filled seats use soft qualification pill fills (bg/border/text) from Admin color choices. OPEN/HIRE empty, highlight yellow, and invalid seats keep their prior look. Inline-select bug noted as pre-existing and parked.",
        who: "Me.",
        done: "Assigned people show colored soft pill fills. Waiting on your click-check before Step 13." },
      { n: "13", title: "Style OPEN / HIRE as red open pills", status: "Done",
        problem: "OPEN and HIRE are red text tokens inside otherwise plain cells.",
        why: "The mockup uses a full red open pill for empty required seats.",
        fix: "Mostly already met by pill shape + existing empty-seat red styling. Step 13 only locked mockup open colors (#fee2e2) and applied the same soft red pill when a seat shows an OPEN/HIRE token. No assignment-rule changes. You noted the look already felt correct.",
        who: "Me.",
        done: "Open/HIRE seats read as soft red pills. Waiting on your click-check before Step 14." },
      { n: "14", title: "Show segment times on split pills more clearly", status: "Updated",
        problem: "Split / overtime segments are dense text; the mockup stacks name + 24-hour time under it on a slightly squarer pill.",
        why: "Weekday 12-hour and trade segments need the time to stay visible without crowding.",
        fix: "Tried November 5, then fully reverted (including the smaller-time follow-up). Split seats are back to the pre-Step-14 dense name list. Parked until a better layout is chosen.",
        who: "Me.",
        done: "Reverted. Split seats look as they did after Step 13." },
    ],
  },
  {
    id: "E", name: "Stage E — Support rows polish",
    summary: "Info, leave rows, and Trades get mockup spacing and quieter presentation without new features.",
    steps: [
      { n: "15", title: "Calm the support-row divider and label weight", status: "Done",
        problem: "The jump from apparatus rows into Info / Vacation / etc. is a thick hard line and heavy labels.",
        why: "The mockup uses a softer divider and consistent label treatment.",
        fix: "CSS only: support-start divider is 2px #cbd5e1; support row labels use a slightly softer slate text color. No data changes.",
        who: "Me.",
        done: "Support section separates cleanly. Waiting on your click-check before Step 16." },
      { n: "16", title: "Polish Info and Trades cell content styling", status: "Updated",
        problem: "Info coverage lines and trade text look like plain small text, not mockup chips.",
        why: "Support rows should feel like the same pill system as apparatus seats.",
        fix: "Tried soft pill chips November 5; fully reverted the same day before a client meeting. Back to plain coverage text with qualification text color.",
        who: "Me.",
        done: "Reverted. Info/Trades look as they did before Step 16." },
    ],
  },
  {
    id: "G", name: "Stage G — Row labels, then week view (before KPI)",
    summary: "Left schedule labels first. Then week vs month so Step 17 counts match the days on screen.",
    steps: [
      { n: "18D", title: "Style the left row labels as soft pills", status: "Done",
        problem: "Engine, Medic, Info, Kelly Day, Sick, and Trades labels are plain slate cells.",
        why: "Your screenshot shows soft colored label pills with a small icon, before week-view work.",
        fix: "Left labels are soft colored pills with small SVG icons. Engine blue, Medic green, Info gray, Kelly/Trades purple, Sick red, Vacation orange. Not the dark app navigation. Row data unchanged.",
        who: "Me.",
        done: "Left labels look closer to the screenshot. Waiting on your click-check before Step 18A." },
      { n: "18A", title: "Add a week date range, defaulting to week", status: "Done",
        problem: "The grid always shows the whole month, which forces sideways scroll on Windows.",
        why: "Week view shows Sunday–Saturday only, and Step 17 counts should follow the days on screen.",
        fix: "View mode week or month. Default week. Week window is Sunday through Saturday. Days the shift does not run stay hidden (weekday-only hides Sat/Sun). Month mode keeps today's month behavior.",
        who: "Me.",
        done: "Week mode shows at most one week of shift days." },
      { n: "18B", title: "Show month or week text in the navigator", status: "Done",
        problem: "The navigator always says the month name.",
        why: "Week mode should read like Week of Nov 3–9 2026, and month mode like November 2026.",
        fix: "Week label uses Week of Nov 3–9 2026. Month label uses November 2026. Prev and Next move by week or month.",
        who: "Me.",
        done: "Navigator text and arrows match the week/month behavior." },
      { n: "18C", title: "Calendar button toggles month and week", status: "Done",
        problem: "There is no control to switch month view and week view.",
        why: "A small calendar picture beside the date label toggles the views.",
        fix: "Calendar-icon button inside the date navigator flips week and month and keeps the same focus date.",
        who: "Me.",
        done: "Calendar button switches views. Ready for your click-check before Step 17." },
    ],
  },
  {
    id: "F", name: "Stage F — KPI strip (after week view)",
    summary: "Add the four summary cards only after week vs month is in place, so the numbers match the days on screen.",
    steps: [
      { n: "17", title: "Add the four summary cards with live counts", status: "Next",
        problem: "The mockup shows Open Seats, Coverage, Pending Overrides, and On Kelly Day above the grid. The live page has none of these.",
        why: "Counts must use the days currently shown, so week and month totals differ.",
        fix: "After Steps 18D, 18A, 18B, and 18C. Cards are display-only from data already on the page. Confirm the four formulas before coding. No new API. No schema.",
        who: "Me after you confirm the four formulas.",
        done: "Four cards show numbers for the days on screen. Grid behavior unchanged." },
    ],
  },
];

const decided: [string, string, string][] = [
  ["November 4, 2026", "Change size", "Literally one visual piece per step. You approve each step before the next."],
  ["November 4, 2026", "Target", "Hybrid mockup A look + Layout B date chips (the JPG you linked). HTML reference: docs/mockups/schedule-hybrid-wed-nov5.html."],
  ["November 4, 2026", "Scope", "Personnel Schedule page only. No schema, migrations, auth, or trade/assignment rule changes."],
  ["November 4, 2026", "Order", "Header → grid shell CSS → date chips → pills → support polish → KPI cards last."],
  ["November 4, 2026", "Time format", "Keep 24-hour times app-wide; mockup times stay military."],
  ["November 4, 2026", "Branch", "submenu/scheduler-pagevisuals (pulled from GitHub)."],
  ["November 4, 2026", "Blue day highlight", "Default highlight is the real calendar today."],
  ["November 5, 2026", "Step 7 timing", "Do slot spacing now, before row labels, week view, and KPI cards."],
  ["November 5, 2026", "Remaining order", "Step 7, then 18D row labels, then 18A week range, 18B navigator text, 18C calendar button, then Step 17."],
  ["November 5, 2026", "Week view", "Sunday–Saturday. Hide days the shift does not run. Default on open is week."],
  ["November 5, 2026", "18C control", "A calendar-picture button beside the date label toggles month and week."],
  ["November 5, 2026", "Left labels", "The colored pills are the schedule row labels (Engine, Info, Trades), not the dark app navigation."],
  [
    "November 5, 2026",
    "Apparatus label colors today",
    "No Admin setting for schedule row label color/icon. Step 18D guesses from the apparatus name only. Qualification colors in Admin only color assigned people pills, not left labels.",
  ],
];

const stillOpen: [string, string][] = [
  ["Steps 18A–18C click-check", "Confirm week default, week/month labels, calendar toggle, and Prev/Next. Then approve Step 17 formulas."],
  ["KPI formulas (Step 17)", "Confirm Open Seats / Coverage / Pending Overrides / Kelly Day before coding."],
  ["Step 7 slot spacing", "Tried and reverted November 5 before client meeting."],
  ["Step 14 segment times", "Tried and reverted November 5; parked until a better layout is chosen."],
  ["Step 16 Info/Trades chips", "Tried and reverted November 5 before client meeting."],
  ["Inline seat select bug", "Pre-existing on staging/production. Parked during visual pass."],
];

const parked: [string, string][] = [
  ["App sidebar / topbar redesign", "Mockup sidebar and user avatar are shell chrome, not the schedule page. Stay out of App shell unless you ask later."],
  ["Day-block modal restyle", "Match the modal after the main grid looks right."],
  ["Custom SVG icons on Info / Trades", "Only if CSS polish in Step 16 is not enough."],
  ["Mobile-specific schedule layout", "Desktop match first; phone layout later."],
  ["Changing qualification color palette itself", "Use colors already configured in Admin Functions unless you want a palette pass later."],
  ["Step 7 slot spacing", "Tried and reverted November 5 before client meeting."],
  ["Step 14 segment times on split pills", "Tried and reverted November 5; revisit later with a better layout."],
  ["Step 16 Info/Trades chips", "Tried and reverted November 5 before client meeting."],
  ["Inline seat dropdown assign", "Pre-existing; day-block works. Fix after visual pass."],
  [
    "Admin: schedule row label color and icon",
    "Later: Admin Functions lets the department pick color and icon for each apparatus and each additional field (Engine, Medic/EMS, Info, Kelly Day, Sick, Trades, Vacation, custom). Today Step 18D only guesses from the name (Medic/Ambulance/EMS/Rescue → green; everything else → engine blue), so A51/A52 stay blue until this exists.",
  ],
  [
    "Injury/Sick row overrides person pill color",
    "Later: when a person is listed on Injury (or the red Sick-style row), their assignment pill on that row uses the row’s red style and overrides their Admin qualification color.",
  ],
];

const safety: [string, string][] = [
  ["Do not change", "Prisma schema, migrations, auth, tenant isolation, schedule save rules, trade rules."],
  ["Files we expect to touch", "src/PersonnelSchedulePage.tsx and src/App.css schedule section. Avoid unrelated pages."],
  ["After every step", "npm run lint. If TSX changed, npm run build. You click the schedule and confirm before the next step."],
  ["Rollback", "Each step is one small commit when you ask to commit, so any step can be reverted alone."],
  ["Demo tenant", "Do not auto-reset demo. Visual checks can use the Weekday Test department or Watseka staging later."],
];

export default function ScheduleVisualMockupPlan() {
  const theme = useHostTheme();
  const [tab, setTab] = useState<"Plan" | "Decisions" | "Data safety" | "Parked">("Plan");
  const nextStep = stages.flatMap((s) => s.steps).find((s) => s.status === "Next");

  return (
    <Stack gap={16} style={{ padding: 16 }}>
      <Stack gap={6}>
        <Text tone="secondary" size="small">Updated November 5, 2026 · morning · branch submenu/scheduler-pagevisuals · Steps 18A–18C done; next is Step 17 after your check</Text>
        <H1>Personnel Schedule — visual mockup plan (one piece at a time)</H1>
        <Text>
          Bring the live Personnel Schedule closer to the hybrid mockup without another big-bang visual rewrite.
          Reference: schedule-mockup-hybrid-a-layout-b-dates.jpg and docs/mockups/schedule-hybrid-wed-nov5.html.
        </Text>
        {nextStep ? (
          <Callout tone="info" title={`Next: Step ${nextStep.n} — ${nextStep.title}`}>
            {nextStep.fix}
          </Callout>
        ) : null}
      </Stack>

      <Row gap={8} wrap>
        {(["Plan", "Decisions", "Data safety", "Parked"] as const).map((name) => (
          <Pill
            key={name}
            tone={tab === name ? "info" : "neutral"}
            active={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
          </Pill>
        ))}
      </Row>

      {tab === "Plan" ? (
        <Stack gap={14}>
          {stages.map((stage) => (
            <Card key={stage.id}>
              <CardHeader trailing={<Pill tone="neutral">{stage.steps.length} steps</Pill>}>
                {stage.name}
              </CardHeader>
              <CardBody>
                <Stack gap={10}>
                  <Text tone="secondary">{stage.summary}</Text>
                  {stage.steps.map((step) => (
                    <Stack key={step.n} gap={4} style={{ paddingTop: 8, borderTop: `1px solid ${theme.stroke.tertiary}` }}>
                      <Row gap={8} align="center" wrap>
                        <Text weight="bold">Step {step.n}. {step.title}</Text>
                        {step.status ? <Pill tone={step.status === "Next" ? "info" : step.status === "Done" ? "success" : "neutral"}>{step.status}</Pill> : <Pill tone="neutral">Queued</Pill>}
                      </Row>
                      <Text size="small"><Text weight="bold">What is wrong: </Text>{step.problem}</Text>
                      <Text size="small"><Text weight="bold">Why it matters: </Text>{step.why}</Text>
                      <Text size="small"><Text weight="bold">The fix: </Text>{step.fix}</Text>
                      <Text size="small"><Text weight="bold">Who: </Text>{step.who}</Text>
                      <Text size="small"><Text weight="bold">Done when: </Text>{step.done}</Text>
                    </Stack>
                  ))}
                </Stack>
              </CardBody>
            </Card>
          ))}
        </Stack>
      ) : null}

      {tab === "Decisions" ? (
        <Stack gap={12}>
          <H2>Decided</H2>
          <Table
            headers={["When", "Topic", "Decision"]}
            rows={decided}
          />
          <Divider />
          <H2>Still open</H2>
          <Table
            headers={["Question", "Notes"]}
            rows={stillOpen}
          />
        </Stack>
      ) : null}

      {tab === "Data safety" ? (
        <Stack gap={12}>
          <Callout tone="warning" title="Visual pass only">
            This plan must not change schedule math, permissions, or saved data shape. If a step starts to need that, stop and ask.
          </Callout>
          <Table headers={["Rule", "Detail"]} rows={safety} />
        </Stack>
      ) : null}

      {tab === "Parked" ? (
        <Stack gap={12}>
          <H2>Parked and future</H2>
          <Table headers={["Item", "Why later"]} rows={parked} />
        </Stack>
      ) : null}
    </Stack>
  );
}
