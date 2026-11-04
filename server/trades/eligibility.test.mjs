import assert from "node:assert/strict";
import test from "node:test";
import { tradeRequestBlockReason, tradeRequestBlockReasonFromStored } from "./eligibility.mjs";

const shiftEntries = [{ shiftType: "8a-8p", startTime: "08:00", shiftDuration: 12 }];
const qualificationOrder = ["Paramedic", "EMT"];
const apparatus = [
  {
    label: "Ambulance",
    minimumPersonnel: 2,
    personnelRequirements: ["Paramedic", "EMT"],
  },
];
const personnel = [
  { name: "Joshua Wichtner", qualifications: ["Paramedic"] },
  { name: "Landon LeDuke", qualifications: ["EMT"] },
  { name: "Lance Keller", qualifications: ["EMT"] },
];

function day(assignments, slotSegments = {}) {
  return {
    assignments: { "8a-8p::2026-11-05": assignments },
    slotSegments: { "8a-8p::2026-11-05": slotSegments },
  };
}

function check(extra) {
  return tradeRequestBlockReason({
    requesterName: "Joshua Wichtner",
    counterpartName: "Landon LeDuke",
    tradeDate: "2026-11-05",
    startTime: "08:00",
    endTime: "10:00",
    personnel,
    qualificationOrder,
    apparatus,
    additionalFields: [],
    shiftEntries,
    assignments: {},
    slotSegments: {},
    ...extra,
  });
}

test("a free qualified person can cover the seat", () => {
  const schedule = day({ Ambulance: ["", "Joshua Wichtner"] });
  assert.equal(check(schedule), "");
});

test("touching hours do not count as already working", () => {
  const schedule = day(
    { Ambulance: ["", "Joshua Wichtner"] },
    {
      Ambulance: [
        [
          {
            personnelName: "Landon LeDuke",
            assigneeType: "personnel",
            source: "manual",
            startMinutes: 10 * 60,
            endMinutes: 12 * 60,
          },
        ],
        [],
      ],
    },
  );
  assert.equal(check(schedule), "");
});

test("overlapping apparatus time blocks the request", () => {
  const schedule = day({ Ambulance: ["Landon LeDuke", "Joshua Wichtner"] });
  assert.equal(
    check(schedule),
    "Landon LeDuke already assigned to Ambulance. Remove or segment assignments so times do not overlap.",
  );
});

test("a split that misses the requested hours does not block", () => {
  const schedule = day(
    { Ambulance: ["", "Joshua Wichtner"] },
    {
      Engine: [
        [
          {
            personnelName: "Landon LeDuke",
            assigneeType: "personnel",
            source: "manual",
            startMinutes: 12 * 60,
            endMinutes: 20 * 60,
          },
        ],
      ],
    },
  );
  assert.equal(check(schedule), "");
});

test("Injury, Vacation, Sick, and Kelly Day block even when the person is otherwise free", () => {
  const labels = [
    ["support-injured", "Landon LeDuke is on Injury. Remove them from Injury before scheduling them on apparatus."],
    ["support-vacation", "Landon LeDuke is on Vacation. Remove them from Vacation before scheduling them on apparatus."],
    ["support-sick", "Landon LeDuke is on Sick. Remove them from Sick before scheduling them on apparatus."],
    ["support-kelly-day", "Landon LeDuke is on Kelly Day. Remove them from Kelly Day before scheduling them on apparatus."],
  ];
  for (const [unitId, message] of labels) {
    const schedule = day({
      Ambulance: ["", "Joshua Wichtner"],
      [unitId]: ["Landon LeDuke"],
    });
    assert.equal(check(schedule), message);
  }
});

test("Chief on Call does not block a trade", () => {
  const schedule = day({
    Ambulance: ["", "Joshua Wichtner"],
    "support-chief-on-call": ["Landon LeDuke"],
  });
  assert.equal(check(schedule), "");
});

test("a lower qualification cannot take a higher seat", () => {
  const schedule = day({ Ambulance: ["Joshua Wichtner", ""] });
  assert.equal(
    check(schedule),
    "Cannot assign Landon LeDuke: does not meet required qualification for that segmented slot.",
  );
});

test("a higher qualification can take a lower seat", () => {
  const schedule = day({ Ambulance: ["", "Joshua Wichtner"] });
  assert.equal(
    check({
      ...schedule,
      personnel: [
        { name: "Joshua Wichtner", qualifications: ["EMT"] },
        { name: "Landon LeDuke", qualifications: ["Paramedic"] },
      ],
    }),
    "",
  );
});

test("a seat with no requirement does not check qualifications", () => {
  const schedule = day({ Ambulance: ["Joshua Wichtner"] });
  assert.equal(
    check({
      ...schedule,
      apparatus: [{ label: "Ambulance", minimumPersonnel: 1, personnelRequirements: [""] }],
      personnel: [
        { name: "Joshua Wichtner", qualifications: [] },
        { name: "Landon LeDuke", qualifications: [] },
      ],
    }),
    "",
  );
});

test("no scheduled seat still blocks leave and overlap, and allows a free person", () => {
  assert.equal(check({}), "");
  assert.equal(
    check({ assignments: { "8a-8p::2026-11-05": { "support-injured": ["Landon LeDuke"] } } }),
    "Landon LeDuke is on Injury. Remove them from Injury before scheduling them on apparatus.",
  );
});

test("stored department payload and schedule rows use the same rules", () => {
  const reason = tradeRequestBlockReasonFromStored({
    requesterName: "Joshua Wichtner",
    counterpartName: "Landon LeDuke",
    tradeDate: "2026-11-05",
    startTime: "08:00",
    endTime: "10:00",
    payload: {
      personnelQualifications: qualificationOrder,
      schedulerPersonnelRecords: personnel,
      schedulerApparatusRecords: [
        { apparatus: "Ambulance", minimumPersonnel: 2, maximumPersonnel: 2, personnelRequirements: ["Paramedic", "EMT"] },
      ],
      shiftInformationEntries: shiftEntries,
      additionalFields: [{ id: "support-injured", fieldName: "Injury" }],
    },
    rows: [
      {
        shiftType: "8a-8p",
        dateKey: "2026-11-05",
        assignmentsJson: {
          assignments: { Ambulance: ["", "Joshua Wichtner"], "support-injured": ["Landon LeDuke"] },
          slotSegments: {},
        },
      },
    ],
  });
  assert.equal(
    reason,
    "Landon LeDuke is on Injury. Remove them from Injury before scheduling them on apparatus.",
  );
});
