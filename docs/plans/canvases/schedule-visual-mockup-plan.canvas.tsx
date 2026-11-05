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
        done: "Calendar button switches views. Click-check passed November 5." },
    ],
  },
  {
    id: "F", name: "Stage F — KPI strip (after week view)",
    summary: "Add the four summary cards only after week vs month is in place, so the numbers match the days on screen.",
    steps: [
      { n: "17", title: "Add the four summary cards with live counts", status: "Done",
        problem: "The mockup shows Open Seats, Coverage, Pending Overrides, and On Kelly Day above the grid. The live page has none of these.",
        why: "Counts must use the days currently shown, so week and month totals differ.",
        fix: "Four display-only cards above the grid. Open Seats = empty required apparatus seats in view (OPEN/HIRE count as open). Coverage = filled required seats ÷ required seats as %. Pending Overrides = pending requests whose date is in view (and match the active shift when set). On Kelly Day = named people on the Kelly Day row in view, and the card is omitted when Additional Fields has Kelly Day hidden. Badge for Kelly says In view. No new API. No schema.",
        who: "Me.",
        done: "Cards show live numbers for the days on screen. On Kelly Day is hidden when that additional field is hidden. Waiting on your click-check of the hide." },
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
  [
    "November 5, 2026",
    "Pending Overrides card",
    "An administrator click on the Pending Overrides card opens Personnel → Trades and scrolls to Active Requests, where pending overrides are listed.",
  ],
  [
    "November 5, 2026",
    "KPI formulas (Step 17)",
    "Open Seats = empty required apparatus seats in the days on screen (OPEN/HIRE = open). Coverage = filled ÷ required as %. Pending Overrides = pending requests dated in the days on screen (and active shift when set). On Kelly Day = named people on Kelly Day row in the days on screen, and the card is hidden when Kelly Day is hidden in Additional Fields.",
  ],
  [
    "November 5, 2026",
    "Plan B",
    "Parked follow-ups move into a Plan B tab with the same stage/step format. Plan A stages stay as completed history. Next is B1 Injury/Sick red person-pill override.",
  ],
  [
    "November 5, 2026",
    "B1 leave-row pill color",
    "On Injury and Sick rows, filled person pills use the row red soft fill and ignore Admin qualification color. Other rows unchanged.",
  ],
];

const stillOpen: [string, string][] = [
  ["B2 click-check", "In Scheduler Apparatus, set A51 to Medic + green and confirm the schedule left label updates."],
  ["Plan B next step", "B3 slot spacing retry after B2 passes."],
];

const planBStages: StageDef[] = [
  {
    id: "B0",
    name: "Plan B Stage 0 — Rules",
    summary: "Same one-piece rule as Plan A. Plan B covers the parked follow-ups after the main visual pass.",
    steps: [
      {
        n: "B0",
        title: "Keep one piece at a time for Plan B",
        status: "Done",
        problem: "The parked list mixed polish retries, admin settings, shell chrome, and a bug fix with no clear order.",
        why: "Without stages, the next agent may change too much at once again.",
        fix: "Plan B uses the same step shape: what is wrong, why it matters, the fix, who, done when. You approve each step before the next. Prefer Personnel Schedule page work first; App shell and mobile stay last.",
        who: "You approve; me executes one step at a time.",
        done: "Plan B section added November 5, 2026. B1 completed the same day.",
      },
    ],
  },
  {
    id: "H",
    name: "Plan B Stage H — Person pill color on leave rows",
    summary: "When someone sits on a red Injury or Sick-style row, that row’s red look wins over their qualification color.",
    steps: [
      {
        n: "B1",
        title: "Injury/Sick row overrides person pill color",
        status: "Done",
        problem: "Keller or Laduke on Injury still shows their Admin qualification color, so the red leave row does not read as clearly.",
        why: "The leave row color should win so injury and sick stand out at a glance.",
        fix: "On Injury and Sick rows (label tone sick), filled person pills use the row red soft fill (#fee2e2 / #991b1b) and ignore personal qualification color. Apparatus and other support rows unchanged.",
        who: "Me.",
        done: "A person on Injury shows a red pill on that row only. Their apparatus seat still uses their qualification color. Waiting on your click-check.",
      },
    ],
  },
  {
    id: "I",
    name: "Plan B Stage I — Admin row label color and icon",
    summary: "Stop guessing Engine blue vs Medic green from the apparatus name alone.",
    steps: [
      {
        n: "B2",
        title: "Admin setting for schedule row label color and icon",
        status: "Done",
        problem: "Step 18D only guesses from the apparatus name, so A51 and A52 stay engine blue even when they should look like Medic/EMS green.",
        why: "Each department needs to pick how schedule apparatus rows look without renaming the unit.",
        fix: "Admin Functions → Scheduler Settings → Scheduler Apparatus edit form now has schedule label icon (fire truck, medic, info, trades, injury) and color swatches. Stored on schedulerApparatusRecords. Schedule left labels read those settings; unset still uses the name guess. Additional-field rows stay heuristic for now.",
        who: "Me.",
        done: "Changing A51 icon/color in Admin updates that row’s pill on the schedule. Waiting on your click-check.",
      },
    ],
  },
  {
    id: "J",
    name: "Plan B Stage J — Visual polish retries",
    summary: "Retry the three November 5 reverts one at a time, then optional custom icons.",
    steps: [
      {
        n: "B3",
        title: "Retry Step 7 slot spacing",
        status: "Next",
        problem: "Assigned names can still sit too tight compared with the mockup’s pill stack gap.",
        why: "A small gap makes stacked seats easier to scan without another big layout change.",
        fix: "Try a gentler seat/stack gap than the first November 5 attempt. One CSS-only step. Revert if it looks wrong on Windows.",
        who: "Me after you approve.",
        done: "Seat stack spacing matches the mockup enough that you keep it.",
      },
      {
        n: "B4",
        title: "Retry Step 14 segment times on split pills",
        status: "New",
        problem: "Split seats still show dense name tokens; the mockup stacks name plus 24-hour time more clearly.",
        why: "Weekday 12-hour and trade segments need the time visible without crowding.",
        fix: "Choose a better layout than the first try (no narrow wrap that broke the grid). Keep military time. One visual piece only.",
        who: "Me after B3, and only after you pick the layout direction.",
        done: "Split pills show name and 24-hour time clearly without breaking week or month view.",
      },
      {
        n: "B5",
        title: "Retry Step 16 Info and Trades chips",
        status: "New",
        problem: "Info coverage lines and trade text still look like plain small text, not the pill system.",
        why: "Support rows should feel like the same visual language as apparatus seats.",
        fix: "Restyle Info and Trades cell content as quiet chips. CSS-first. Revert if it fights the coverage lines.",
        who: "Me after B4.",
        done: "Info and Trades content read as soft chips without changing coverage math.",
      },
      {
        n: "B6",
        title: "Custom SVG icons on Info / Trades (optional)",
        status: "New",
        problem: "Generic icons may still feel weak after B5.",
        why: "Only needed if the CSS chips are not enough.",
        fix: "Replace Info and Trades label icons with small custom SVGs. Skip this step if B5 is enough.",
        who: "Me only if you ask after B5.",
        done: "Info and Trades icons match the mockup closely enough, or you decide to skip.",
      },
    ],
  },
  {
    id: "K",
    name: "Plan B Stage K — Inline seat assign bug",
    summary: "Fix the pre-existing inline dropdown assign after the main visual pass.",
    steps: [
      {
        n: "B7",
        title: "Fix inline seat dropdown assign",
        status: "New",
        problem: "Clicking a seat to pick someone from the small inline dropdown is broken on staging and production. The day-block modal still works.",
        why: "Admins expect to assign from the grid without opening the day block every time.",
        fix: "Repair the inline select assign path only. Do not redesign the dropdown. Keep limited-user self-fill rules.",
        who: "Me after the polish you want first, or sooner if you bump it ahead.",
        done: "Choosing a person from the inline seat dropdown assigns them and saves, matching day-block behavior.",
      },
    ],
  },
  {
    id: "L",
    name: "Plan B Stage L — Day-block modal, then later surfaces",
    summary: "Match the day editor after the grid looks right. Shell, mobile, and palette stay last.",
    steps: [
      {
        n: "B8",
        title: "Restyle the day-block modal",
        status: "New",
        problem: "The day-block editor still looks like the older dense UI while the grid now matches the mockup.",
        why: "Admins spend time in that modal; it should match the new pills and date chips.",
        fix: "Restyle the day-block modal chrome and seat/segment presentation to match the grid. No assignment-rule changes in this step.",
        who: "Me after the grid polish you want kept.",
        done: "Opening a day block feels like the same visual system as the main schedule.",
      },
      {
        n: "B9",
        title: "Mobile-specific schedule layout",
        status: "New",
        problem: "Week and month views are desktop-first; phones still need sideways scanning.",
        why: "Field users may need a readable phone layout later.",
        fix: "Design a phone layout after desktop is stable. Do not squeeze the desktop grid.",
        who: "Me later when you ask for mobile.",
        done: "A phone schedule view is usable without breaking desktop week/month.",
      },
      {
        n: "B10",
        title: "App sidebar / topbar redesign",
        status: "New",
        problem: "The mockup shows a dark app shell and user avatar that the live app does not use.",
        why: "That is shell chrome, not the Personnel Schedule page.",
        fix: "Only touch App sidebar/topbar if you explicitly open an App-shell project. Stay out of it during schedule work.",
        who: "Me only if you start a separate shell plan.",
        done: "Either deferred forever for this plan, or completed under an App-shell plan you approve.",
      },
      {
        n: "B11",
        title: "Qualification color palette pass",
        status: "New",
        problem: "Departments may want a better default color set than the current Admin palette.",
        why: "Pill fills are only as clear as the colors chosen in Admin Functions.",
        fix: "Optional palette pass later. Until then, keep using colors already configured in Admin.",
        who: "Me only if you ask for a palette redesign.",
        done: "Either skipped, or Admin has an agreed clearer default palette.",
      },
    ],
  },
];

const parked: [string, string][] = [
  ["See Plan B tab", "Parked follow-ups are now staged in Plan B (B1–B11). Use that tab instead of this list for order and status."],
];

const safety: [string, string][] = [
  ["Do not change", "Prisma schema, migrations, auth, tenant isolation, schedule save rules, trade rules."],
  ["Files we expect to touch", "src/PersonnelSchedulePage.tsx and src/App.css schedule section. Avoid unrelated pages."],
  ["After every step", "npm run lint. If TSX changed, npm run build. You click the schedule and confirm before the next step."],
  ["Rollback", "Each step is one small commit when you ask to commit, so any step can be reverted alone."],
  ["Demo tenant", "Do not auto-reset demo. Visual checks can use the Weekday Test department or Watseka staging later."],
];

function renderStages(theme: ReturnType<typeof useHostTheme>, stageList: StageDef[]) {
  return (
    <Stack gap={14}>
      {stageList.map((stage) => (
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
                    {step.status ? (
                      <Pill tone={step.status === "Next" ? "info" : step.status === "Done" ? "success" : "neutral"}>
                        {step.status}
                      </Pill>
                    ) : (
                      <Pill tone="neutral">Queued</Pill>
                    )}
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
  );
}

export default function ScheduleVisualMockupPlan() {
  const theme = useHostTheme();
  const [tab, setTab] = useState<"Plan A" | "Plan B" | "Decisions" | "Data safety" | "Parked">("Plan B");
  const nextStep =
    planBStages.flatMap((s) => s.steps).find((s) => s.status === "Next") ??
    stages.flatMap((s) => s.steps).find((s) => s.status === "Next");

  return (
    <Stack gap={16} style={{ padding: 16 }}>
      <Stack gap={6}>
        <Text tone="secondary" size="small">Updated November 5, 2026 · midday · branch submenu/scheduler-pagevisuals · Plan B Step B2 done; next is B3</Text>
        <H1>Personnel Schedule — visual mockup plan (one piece at a time)</H1>
        <Text>
          Plan A brought the live Personnel Schedule to the hybrid mockup. Plan B stages the parked follow-ups in the same one-piece format.
          Reference: schedule-mockup-hybrid-a-layout-b-dates.jpg and docs/mockups/schedule-hybrid-wed-nov5.html.
        </Text>
        {nextStep ? (
          <Callout tone="info" title={`Next: Step ${nextStep.n} — ${nextStep.title}`}>
            {nextStep.fix}
          </Callout>
        ) : null}
      </Stack>

      <Row gap={8} wrap>
        {(["Plan A", "Plan B", "Decisions", "Data safety", "Parked"] as const).map((name) => (
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

      {tab === "Plan A" ? renderStages(theme, stages) : null}
      {tab === "Plan B" ? (
        <Stack gap={14}>
          <Callout tone="info" title="Plan B order">
            B1 Injury red override → B2 Admin label color/icon → B3–B6 polish retries → B7 inline seat bug → B8 day-block modal → B9–B11 later surfaces.
          </Callout>
          {renderStages(theme, planBStages)}
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
