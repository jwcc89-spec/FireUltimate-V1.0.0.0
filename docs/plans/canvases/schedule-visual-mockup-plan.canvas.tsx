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
      { n: "0", title: "Agree the one-piece rule and the target", status: "Next",
        problem: "The last visual pass changed many schedule pieces together and took three times longer to stabilize.",
        why: "One visual piece at a time keeps breakages small and easy to undo.",
        fix: "Target is the hybrid mockup (Layout B dates): assets/schedule-mockup-hybrid-a-layout-b-dates.jpg and docs/mockups/schedule-hybrid-wed-nov5.html. Only Personnel Schedule page visuals. No schema, migrations, auth, API, or trade logic. One step → you look → approve → next step. Prefer CSS-only before JSX structure. If a step needs both CSS and JSX, still ship only that one visual piece.",
        who: "You approve; me executes one step at a time.",
        done: "You say go on Step 0, and we start Step 1 only after that." },
    ],
  },
  {
    id: "A", name: "Stage A — Page header chrome only",
    summary: "Make the top of the schedule page match the mockup without touching the grid body.",
    steps: [
      { n: "1", title: "Rename the page title text",
        problem: "The live page says Schedule (Personnel). The mockup says Personnel Schedule.",
        why: "Smallest possible first change so we prove the one-piece workflow.",
        fix: "Change only the visible h1 text on PersonnelSchedulePage (and the matching loading / blocked titles). No CSS. No control moves.",
        who: "Me.",
        done: "Title reads Personnel Schedule. Assignments, highlight, undo, and day open still work." },
      { n: "2", title: "Restyle the month navigator as a compact control group",
        problem: "Prev / month / Next look like separate plain buttons, not the mockup's single rounded month control.",
        why: "Header controls should look grouped before we rearrange them.",
        fix: "CSS only under .personnel-schedule-month-nav (and label). Keep Prev / Next behavior. Do not move other controls yet.",
        who: "Me.",
        done: "Month nav looks like one white rounded control. Month still changes correctly." },
      { n: "3", title: "Restyle shift, highlight, and Undo to match header buttons",
        problem: "Shift select, Highlight Personnel, and Undo do not match the mockup header control height, radius, and weight.",
        why: "Finish header look before rearranging layout, so later moves do not mix style and structure.",
        fix: "CSS only for those existing controls on the schedule page. No new buttons. No KPI strip yet.",
        who: "Me.",
        done: "Those three controls match the mockup header look. Behavior unchanged." },
      { n: "4", title: "Put title left and controls right on one header row",
        problem: "Controls sit under the title instead of in a single header row like the mockup.",
        why: "Layout B puts month, shift, highlight, and Undo on the right of the title.",
        fix: "One structural pass on the page header only: title left, actions right. Keep Last action hint visible without crowding the mockup row (under the actions or as a quiet line). Do not change the grid.",
        who: "Me.",
        done: "Header matches the mockup arrangement. All existing controls still work." },
    ],
  },
  {
    id: "B", name: "Stage B — Grid shell CSS only",
    summary: "Soft panel, quieter borders, and lighter row labels — still the same HTML table.",
    steps: [
      { n: "5", title: "Soft white schedule panel and quieter cell borders",
        problem: "The grid sits in a hard bordered box with dense gray cell lines.",
        why: "The mockup uses a white rounded panel and lighter separators.",
        fix: "CSS only on .personnel-schedule-grid-wrapper and grid borders/padding. No header-row rewrite yet.",
        who: "Me.",
        done: "Grid looks like a soft white card. Scrolling and cell clicks still work." },
      { n: "6", title: "Lighten row and corner labels",
        problem: "DAY / DATE / apparatus labels use heavy gray (#d1d5db) blocks.",
        why: "The mockup uses a lighter slate label column and calmer header cells.",
        fix: "CSS only for .personnel-schedule-row-label, .personnel-schedule-col-day, and .personnel-schedule-col-date. Keep the two header rows for now.",
        who: "Me.",
        done: "Labels match the mockup tone. Text is still readable." },
      { n: "7", title: "Increase slot spacing inside day cells",
        problem: "Assigned names sit too tight compared with the mockup's pill stack gap.",
        why: "Spacing must improve before pill shape changes, or shape and spacing blur together.",
        fix: "CSS only on .personnel-schedule-slots gap and day-block padding. No pill shape yet.",
        who: "Me.",
        done: "Names have clearer vertical space. Editing and drag still work." },
    ],
  },
  {
    id: "C", name: "Stage C — Date headers (Layout B)",
    summary: "Replace the red italic DAY + DATE rows with one date-chip row and a today highlight. This is the main Layout B change.",
    steps: [
      { n: "8", title: "Combine DAY and DATE into one date-chip header cell",
        problem: "The live grid has two header rows (weekday, then M/D) in red italic. The mockup uses one chip per day: weekday on top, date under it.",
        why: "This is the signature Layout B difference from the current table.",
        fix: "One JSX + CSS piece: single header row; each day cell shows weekday + date inside a small white chip. Keep the click-to-open day block behavior on the chip. Remove the old red italic styles for these headers.",
        who: "Me.",
        done: "One header row of date chips. Day block still opens from the header." },
      { n: "9", title: "Highlight today's date chip",
        problem: "No visual cue for the current calendar day on the header.",
        why: "The mockup marks today with a blue border and blue text on the chip.",
        fix: "Add a today class to the matching date chip only. CSS for blue border / soft blue fill / blue text. No column wash yet.",
        who: "Me.",
        done: "Today's chip matches the mockup. Other days stay neutral." },
      { n: "10", title: "Soft blue wash on today's column body",
        problem: "Only the chip is highlighted; the mockup also tints today's column cells lightly.",
        why: "Makes the selected day readable while scanning down the grid.",
        fix: "CSS/class on today's body cells only. Do not change assignment logic.",
        who: "Me.",
        done: "Today's column has a light blue wash. Seats remain editable." },
    ],
  },
  {
    id: "D", name: "Stage D — Assignment pills",
    summary: "Turn seat cells into mockup-style pills. Shape first, then fill color, then OPEN / segments.",
    steps: [
      { n: "11", title: "Round seat cells into pill shape",
        problem: "Seats are small rectangular boxes, not rounded pills.",
        why: "Shape alone must land before color fills, so we can judge the silhouette.",
        fix: "CSS only on .personnel-schedule-slot (radius, padding, font weight, text align). Keep existing borders and current text-color qualification tint for now.",
        who: "Me.",
        done: "Filled and empty seats look pill-shaped. Inline edit and click still work." },
      { n: "12", title: "Use qualification color as pill background fill",
        problem: "Qualification color is only applied as text color today. The mockup fills the whole pill.",
        why: "Background color is the main way the mockup shows role at a glance.",
        fix: "One visual piece: apply the existing qualification hex as a soft background (and readable text) on filled name pills. Keep OPEN / HIRE / invalid / highlight rules intact. Prefer soft tints if the stored hex is too strong.",
        who: "Me.",
        done: "Assigned people show colored pill fills from existing qualification colors. Highlight and invalid states still read clearly." },
      { n: "13", title: "Style OPEN / HIRE as red open pills",
        problem: "OPEN and HIRE are red text tokens inside otherwise plain cells.",
        why: "The mockup uses a full red open pill for empty required seats.",
        fix: "CSS (and class only if needed) so OPEN / HIRE seats match the mockup red pill. Do not change when a seat becomes OPEN.",
        who: "Me.",
        done: "Open seats read as red pills. Filling a seat still works." },
      { n: "14", title: "Show segment times on split pills more clearly",
        problem: "Split / overtime segments are dense text; the mockup stacks name + 24-hour time under it on a slightly squarer pill.",
        why: "Weekday 12-hour and trade segments need the time to stay visible without crowding.",
        fix: "Visual-only: when a seat shows segment times, use the split-pill layout from the mockup (name + time). Keep 24-hour time. No trade-rule changes.",
        who: "Me.",
        done: "Segmented seats show name and time clearly. Existing segment actions still work." },
    ],
  },
  {
    id: "E", name: "Stage E — Support rows polish",
    summary: "Info, leave rows, and Trades get mockup spacing and quieter presentation without new features.",
    steps: [
      { n: "15", title: "Calm the support-row divider and label weight",
        problem: "The jump from apparatus rows into Info / Vacation / etc. is a thick hard line and heavy labels.",
        why: "The mockup uses a softer divider and consistent label treatment.",
        fix: "CSS only for support-start border and support row labels.",
        who: "Me.",
        done: "Support section separates cleanly without looking like a different product." },
      { n: "16", title: "Polish Info and Trades cell content styling",
        problem: "Info coverage lines and trade text look like plain small text, not mockup chips.",
        why: "Support rows should feel like the same pill system as apparatus seats.",
        fix: "Visual-only styling for Info coverage lines and Trades displays already on the page. No new icons unless a tiny CSS/Unicode affordance is enough; park custom icon work if it needs asset plumbing.",
        who: "Me.",
        done: "Info and Trades cells look closer to the mockup without changing their data." },
    ],
  },
  {
    id: "F", name: "Stage F — KPI strip (last on purpose)",
    summary: "Add the four summary cards only after the grid already looks right. This step may need small read-only counts from data already on the page.",
    steps: [
      { n: "17", title: "Add the four summary cards with live counts",
        problem: "The mockup shows Open Seats, Coverage, Pending Overrides, and On Kelly Day above the grid. The live page has none of these.",
        why: "Saved for last so card math cannot hide grid regressions. Cards are display-only.",
        fix: "Add the four cards above the grid. Compute from data already loaded on the page (open apparatus seats in view, filled vs required coverage percent, pending override count, Kelly Day row count in view). No new API. No schema. Confirm the exact formulas with you before coding if any count is ambiguous.",
        who: "Me after you confirm the four formulas.",
        done: "Four cards match mockup layout and show believable numbers for the visible week. Grid behavior unchanged." },
    ],
  },
];

const decided: [string, string, string][] = [
  ["November 4, 2026", "Change size", "Literally one visual piece per step. You approve each step before the next."],
  ["November 4, 2026", "Target", "Hybrid mockup A look + Layout B date chips (the JPG you linked). HTML reference: docs/mockups/schedule-hybrid-wed-nov5.html."],
  ["November 4, 2026", "Scope", "Personnel Schedule page only. No schema, migrations, auth, or trade/assignment rule changes."],
  ["November 4, 2026", "Order", "Header → grid shell CSS → date chips → pills → support polish → KPI cards last."],
  ["November 4, 2026", "Time format", "Keep 24-hour times app-wide; mockup times stay military."],
];

const stillOpen: [string, string][] = [
  ["Branch for this work", "Confirm before Step 1. Detected on this Mac: cursor/watseka-scheduling-plan."],
  ["KPI formulas (Step 17)", "Exact Open Seats / Coverage / Pending Overrides / Kelly Day definitions before that step."],
  ["Today vs selected day", "Mockup highlights Wednesday as the focus day. Confirm: use real today, or a clicked/selected day, or both."],
];

const parked: [string, string][] = [
  ["App sidebar / topbar redesign", "Mockup sidebar and user avatar are shell chrome, not the schedule page. Stay out of App shell unless you ask later."],
  ["Day-block modal restyle", "Match the modal after the main grid looks right."],
  ["Custom SVG icons on Info / Trades", "Only if CSS polish in Step 16 is not enough."],
  ["Mobile-specific schedule layout", "Desktop match first; phone layout later."],
  ["Changing qualification color palette itself", "Use colors already configured in Admin Functions unless you want a palette pass later."],
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
        <Text tone="secondary" size="small">Updated November 4, 2026 · evening · plan only, no code yet</Text>
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
