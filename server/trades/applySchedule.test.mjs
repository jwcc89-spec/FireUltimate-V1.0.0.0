import assert from "node:assert/strict";
import test from "node:test";
import { applyAcceptedTrade } from "./applySchedule.mjs";

const payload = {
  personnelQualifications: ["Paramedic", "EMT"],
  schedulerPersonnelRecords: [
    { name: "Joshua Wichtner", qualifications: ["Paramedic"] },
    { name: "Lance Keller", qualifications: ["Paramedic"] },
    { name: "Kenny Baier", qualifications: ["EMT"] },
    { name: "Landon LeDuke", qualifications: ["Paramedic"] },
  ],
  schedulerApparatusRecords: [
    {
      apparatus: "Ambulance",
      minimumPersonnel: 2,
      maximumPersonnel: 2,
      personnelRequirements: ["Paramedic", "EMT"],
    },
  ],
  shiftInformationEntries: [{ shiftType: "8a-8p", startTime: "08:00", shiftDuration: 12 }],
  additionalFields: [{ id: "support-injured", fieldName: "Injury" }],
};

function row(dateKey, assignments, extra = {}) {
  return {
    shiftType: "8a-8p",
    dateKey,
    assignmentsJson: {
      assignments,
      overtimeSplit: extra.overtimeSplit ?? {},
      slotSegments: extra.slotSegments ?? {},
    },
  };
}

function segments(result, dateKey, slotIndex) {
  const saved = result.rows.find((entry) => entry.dateKey === dateKey);
  return saved.assignmentsJson.slotSegments.Ambulance[slotIndex].map((segment) => ({
    name: segment.personnelName,
    start: segment.startMinutes,
    end: segment.endMinutes,
    source: segment.source,
  }));
}

test("accepting a trade splits the day and lets a paramedic move up", () => {
  const result = applyAcceptedTrade({
    payload,
    rows: [row("2026-11-05", { Ambulance: ["Joshua Wichtner", "Lance Keller"] })],
    trade: {
      id: "trade-1",
      requesterName: "Joshua Wichtner",
      counterpartName: "Kenny Baier",
      tradeDate: "2026-11-05",
      startTime: "08:00",
      endTime: "10:00",
      paybackRequired: false,
      paybackDate: "",
    },
  });
  assert.equal(result.ok, true);
  const saved = result.rows[0].assignmentsJson;
  assert.equal(saved.assignments.Ambulance[0], "Lance Keller");
  assert.deepEqual(saved.slotSegments.Ambulance[0], []);
  assert.equal(saved.overtimeSplit.Ambulance[0], false);
  assert.deepEqual(segments(result, "2026-11-05", 1), [
    { name: "Kenny Baier", start: 8 * 60, end: 10 * 60, source: "trade" },
    { name: "Joshua Wichtner", start: 10 * 60, end: 20 * 60, source: "trade" },
  ]);
  assert.equal(saved.overtimeSplit.Ambulance[1], true);
  assert.deepEqual(result.scheduleChange.rows[0].assignmentsJson.assignments.Ambulance, [
    "Joshua Wichtner",
    "Lance Keller",
  ]);
});

test("a qualified person covers the seat when nobody has to move", () => {
  const result = applyAcceptedTrade({
    payload,
    rows: [row("2026-11-05", { Ambulance: ["Joshua Wichtner", ""] })],
    trade: {
      id: "trade-2",
      requesterName: "Joshua Wichtner",
      counterpartName: "Landon LeDuke",
      tradeDate: "2026-11-05",
      startTime: "08:00",
      endTime: "10:00",
      paybackRequired: false,
      paybackDate: "",
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(segments(result, "2026-11-05", 0), [
    { name: "Landon LeDuke", start: 8 * 60, end: 10 * 60, source: "trade" },
    { name: "Joshua Wichtner", start: 10 * 60, end: 20 * 60, source: "trade" },
  ]);
});

test("payback puts the requester on the other person's seat for the same hours", () => {
  const result = applyAcceptedTrade({
    payload,
    rows: [
      row("2026-11-05", { Ambulance: ["Joshua Wichtner", ""] }),
      row("2026-11-12", { Ambulance: ["Landon LeDuke", ""] }),
    ],
    trade: {
      id: "trade-3",
      requesterName: "Joshua Wichtner",
      counterpartName: "Landon LeDuke",
      tradeDate: "2026-11-05",
      startTime: "08:00",
      endTime: "10:00",
      paybackRequired: true,
      paybackDate: "2026-11-12",
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(segments(result, "2026-11-12", 0), [
    { name: "Joshua Wichtner", start: 8 * 60, end: 10 * 60, source: "trade" },
    { name: "Landon LeDuke", start: 10 * 60, end: 20 * 60, source: "trade" },
  ]);
});

test("a payback day that cannot be covered is refused and the schedule stays unchanged", () => {
  const rows = [
    row("2026-11-05", { Ambulance: ["Joshua Wichtner", ""] }),
    row("2026-11-12", { Ambulance: ["Landon LeDuke", ""], "support-injured": ["Joshua Wichtner"] }),
  ];
  const result = applyAcceptedTrade({
    payload,
    rows,
    trade: {
      id: "trade-4",
      requesterName: "Joshua Wichtner",
      counterpartName: "Landon LeDuke",
      tradeDate: "2026-11-05",
      startTime: "08:00",
      endTime: "10:00",
      paybackRequired: true,
      paybackDate: "2026-11-12",
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /On the payback date, Joshua Wichtner is on Injury/);
  assert.equal(rows[0].assignmentsJson.slotSegments.Ambulance, undefined);
});
