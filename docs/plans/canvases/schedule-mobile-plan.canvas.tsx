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
    id: "0",
    name: "Stage 0 — Keep this separate",
    summary: "Phone layout is not part of the schedule visual mockup plan.",
    steps: [
      {
        n: "M0",
        title: "Park this plan until you ask to start it",
        status: "Done",
        problem: "A phone schedule was sitting as B9 inside the visual mockup plan, which is a desktop grid project.",
        why: "Mixing them would risk squeezing the desktop week and month views.",
        fix: "Moved here on November 5, 2026. Do not start coding until you explicitly open this plan.",
        who: "You decide when. Me builds one step at a time after that.",
        done: "This plan exists and is parked. The visual mockup plan is complete and archived in docs/completed. It no longer owns phone layout.",
      },
    ],
  },
  {
    id: "1",
    name: "Stage 1 — Choose the phone shape",
    summary: "Agree the layout before any screen code. Desktop stays untouched.",
    steps: [
      {
        n: "M1",
        title: "Pick the phone layout",
        status: "New",
        problem: "The live schedule is a multi-column week or month table. Phones scroll sideways.",
        why: "Squeezing that table is the failure mode this plan exists to avoid.",
        fix: "Choose one: A day-first list (recommended), B a week of snap day cards, or C a squeezed table (not recommended). Also pick the breakpoint, the default day, how month works, and whether phone KPIs count one day or the week.",
        who: "You decide. Me does not guess.",
        done: "The Decisions tab records the layout and the open questions are closed.",
      },
    ],
  },
  {
    id: "2",
    name: "Stage 2 — Build the phone schedule",
    summary: "Only after M1. One piece at a time. Desktop week and month stay as they are.",
    steps: [
      {
        n: "M2",
        title: "Phone header and summary cards",
        status: "New",
        problem: "Title, week/month controls, shift, highlight, undo, and four KPI cards are laid out for a wide screen.",
        why: "The phone needs those controls stacked and readable before the day list is useful.",
        fix: "On the agreed breakpoint only, stack the header and reflow the KPI cards. Do not change the desktop header.",
        who: "Me after M1.",
        done: "A narrow window shows a usable header. A wide window looks unchanged.",
      },
      {
        n: "M3",
        title: "One-day list instead of the matrix",
        status: "New",
        problem: "Week and month columns do not fit a phone.",
        why: "Field users need to read who is on a truck without sideways scanning.",
        fix: "Show one day as a vertical list of the same row labels and seat pills. Reuse current open-seat, cancel, and admin day-block rules.",
        who: "Me after M2.",
        done: "A phone can read one day without horizontal matrix scroll. Desktop grid is unchanged.",
      },
      {
        n: "M4",
        title: "Week and month as pickers, not grids",
        status: "New",
        problem: "People still need to move between days, weeks, and months.",
        why: "The phone should not render the full month matrix.",
        fix: "Week becomes a row of day chips. Month becomes a date picker. Selecting a date loads that day’s list.",
        who: "Me after M3.",
        done: "You can change days on a phone without opening the desktop grid.",
      },
      {
        n: "M5",
        title: "Day-block modal on a narrow screen",
        status: "New",
        problem: "The day editor is a two-column desktop dialog.",
        why: "Admins who can open it on a phone need the seats and roster to fit.",
        fix: "On the phone breakpoint, stack the day block above the roster and let segment trays stay inside the card. No assignment-rule changes.",
        who: "Me after M4.",
        done: "An admin can open a day block on a phone width without the segment cards spilling out.",
      },
    ],
  },
];

const decided: [string, string, string][] = [
  [
    "November 5, 2026",
    "Separate from the visual plan",
    "Phone layout left the schedule visual mockup plan. Desktop week and month stay there.",
  ],
  [
    "November 5, 2026",
    "Not started",
    "Do not build this until you ask. Recommended direction, if chosen later, is a day-first list rather than squeezing the table.",
  ],
];

const stillOpen: [string, string][] = [
  ["Layout", "A day-first list (recommended), B week carousel, or C squeezed table."],
  ["Default day", "Today, or the first day of the current week."],
  ["Month on a phone", "Date picker only, or also a week summary."],
  ["Breakpoint", "768px, 900px, or another width."],
  ["KPI scope", "Counts for the one day on screen, or the current week."],
];

const safety: [string, string][] = [
  ["Do not change", "Prisma schema, migrations, auth, tenant isolation, schedule save rules, or trade rules."],
  ["Desktop", "Week and month grids must look the same above the phone breakpoint."],
  ["When work starts", "One step at a time. Lint, and build if TSX changes. You click-check before the next step."],
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
                    <Text weight="semibold">{`M ${step.n.replace("M", "")} — ${step.title}`}</Text>
                    {step.status ? (
                      <Pill tone={step.status === "Next" ? "info" : step.status === "Done" ? "success" : "neutral"}>
                        {step.status}
                      </Pill>
                    ) : null}
                  </Row>
                  <Text size="small">{step.problem}</Text>
                  <Text size="small" tone="secondary">{step.fix}</Text>
                </Stack>
              ))}
            </Stack>
          </CardBody>
        </Card>
      ))}
    </Stack>
  );
}

export default function ScheduleMobilePlan() {
  const theme = useHostTheme();
  const [tab, setTab] = useState<"Plan" | "Decisions" | "Data safety">("Plan");

  return (
    <Stack gap={16} style={{ padding: 16 }}>
      <Stack gap={6}>
        <Text tone="secondary" size="small">
          Updated November 5, 2026 · parked · not part of the schedule visual mockup plan
        </Text>
        <H1>Personnel Schedule — phone layout</H1>
        <Text>
          A later plan for a readable phone schedule. The desktop visual plan is complete and archived in docs/completed.
          Do not start until you ask.
        </Text>
        <Callout tone="warning" title="Parked">
          No phone layout work is in progress. Open this plan again when you want to choose the layout and start M1.
        </Callout>
      </Stack>

      <Row gap={8} wrap>
        {(["Plan", "Decisions", "Data safety"] as const).map((name) => (
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

      {tab === "Plan" ? renderStages(theme, stages) : null}

      {tab === "Decisions" ? (
        <Stack gap={12}>
          <H2>Decided</H2>
          <Table headers={["When", "Topic", "Decision"]} rows={decided} />
          <Divider />
          <H2>Still open</H2>
          <Table headers={["Question", "Notes"]} rows={stillOpen} />
        </Stack>
      ) : null}

      {tab === "Data safety" ? (
        <Stack gap={12}>
          <Callout tone="warning" title="Desktop stays put">
            This plan must not squeeze or restyle the desktop week and month grids.
          </Callout>
          <Table headers={["Rule", "Detail"]} rows={safety} />
        </Stack>
      ) : null}
    </Stack>
  );
}
