import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignIncidentNumberChart,
  assignSectionToField,
  chartRowsNewestFirst,
  incidentNumbersFromSeriesStarts,
  buildIncidentLabelConfig,
  cadLabeledDateTime,
  cadUnitTimes,
  DEFAULT_CAD_TIME_MAP,
  chicagoWallTimeToUtc,
  currentFiscalPeriod,
  emptyIncidentLabels,
  fieldIdForSection,
  followUpCallNumber,
  formatAssignedIncidentNumber,
  incidentNumberOverridesFromExtract,
  incidentNumberSeriesExample,
  partFromSelection,
  labelsFromSavedRules,
  previewIncidentFromLabels,
  splitDispatchParts,
  emailExcludedBySetup,
  unitsMatchingApparatus,
  timeMapFromExtract,
} from "./incidentLabelMap.ts";

const RESET = { month: 11, day: 1, time: "00:00" };
const AFTER_RESET = chicagoWallTimeToUtc(2026, 11, 17, 12, 0);

const SAMPLE =
  "26018614; Fire Alarm - Commercial Structure; 540 E UNITED STATES HIGHWAY 24, GILMAN, IL 60938; INCOBRASA - GENERAL FIRE ALARM ZONE 993; Common name: ; CAD Notes: None; New Message:";

describe("incidentLabelMap", () => {
  it("splits a Crescent CAD line on semicolons", () => {
    const parts = splitDispatchParts(SAMPLE);
    assert.deepEqual(parts, [
      "26018614",
      "Fire Alarm - Commercial Structure",
      "540 E UNITED STATES HIGHWAY 24, GILMAN, IL 60938",
      "INCOBRASA - GENERAL FIRE ALARM ZONE 993",
      "Common name:",
      "CAD Notes: None",
      "New Message:",
    ]);
  });

  it("fills incident fields from semicolon parts", () => {
    const choices = emptyIncidentLabels();
    choices.incidentNumber = { index: 0, afterLabel: false };
    choices.incidentType = { index: 1, afterLabel: false };
    choices.address = { index: 2, afterLabel: false };
    choices.initialDispatchCode = { index: 3, afterLabel: false };
    choices.dispatchNotes = { index: 5, afterLabel: true };
    const preview = previewIncidentFromLabels(SAMPLE, choices, ";", "{yy}-{seq}", RESET, AFTER_RESET);
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    const value = (id: string) => preview.rows.find((row) => row.id === id)?.value;
    assert.equal(value("incidentNumber"), "27-001, then 27-002");
    assert.equal(value("dispatchNumber"), "26018614");
    assert.equal(value("incidentType"), "Fire Alarm - Commercial Structure");
    assert.equal(value("address"), "540 E UNITED STATES HIGHWAY 24, GILMAN, IL 60938");
    assert.equal(value("initialDispatchCode"), "INCOBRASA - GENERAL FIRE ALARM ZONE 993");
    assert.equal(value("dispatchNotes"), "None");
    assert.equal(value("status"), "Draft");
  });

  it("round-trips part choices", () => {
    const choices = emptyIncidentLabels();
    choices.address = { index: 2, afterLabel: false };
    choices.dispatchNotes = { index: 5, afterLabel: true };
    const built = buildIncidentLabelConfig(choices);
    const loaded = labelsFromSavedRules(built.rules);
    assert.equal(loaded.recognized, true);
    assert.deepEqual(loaded.labels.address, { index: 2, afterLabel: false });
    assert.deepEqual(loaded.labels.dispatchNotes, { index: 5, afterLabel: true });
    assert.equal(loaded.labels.incidentNumber, null);
  });

  it("splits and reads fields when the separator is a pipe", () => {
    const piped = "26018614|Fire Alarm - Commercial Structure|540 E Highway 24";
    assert.deepEqual(splitDispatchParts(piped, "|"), [
      "26018614",
      "Fire Alarm - Commercial Structure",
      "540 E Highway 24",
    ]);
    const choices = emptyIncidentLabels();
    choices.incidentNumber = { index: 0, afterLabel: false };
    choices.address = { index: 2, afterLabel: false };
    const built = buildIncidentLabelConfig(choices, "|");
    assert.equal(built.incidentNumberExtract.separator, "|");
    const loaded = labelsFromSavedRules(built.rules, "|");
    assert.equal(loaded.recognized, true);
    assert.deepEqual(loaded.labels.address, { index: 2, afterLabel: false });
    const preview = previewIncidentFromLabels(piped, choices, "|");
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    assert.equal(preview.rows.find((row) => row.id === "address")?.value, "540 E Highway 24");
  });

  it("keeps a follow-up email on the same call number", () => {
    const followUp =
      "Crescent-Iroquois Fire - CAD CFS: 26018313; Department CFS: CrescentIroquoisFPD2600089; Nature: Fire Controlled Burn Fire Controlled Burn,Start Date/Time: 11/17/26 13:35, Units: 1801; CrescentIroquoisFireDispatched, Unit response times:1801 - On Scene 11/17/26 13:38:19";
    const fresh =
      "26018313; Fire Controlled Burn; 2000 NORTH / 1600 EAST, CRESCENT CITY; INFORMATION ONLY / CONTROLLED BURN / TREE STUMPS; Common name: ; CAD Notes: tree stumps; New Message:";
    assert.equal(followUpCallNumber(followUp), "26018313");
    assert.equal(followUpCallNumber(fresh), "");
    const choices = emptyIncidentLabels();
    choices.incidentNumber = { index: 0, afterLabel: false };
    choices.address = { index: 2, afterLabel: false };
    const followPreview = previewIncidentFromLabels(followUp, choices, ";", "{yy}-{seq}", RESET, AFTER_RESET);
    assert.equal(followPreview.ok, true);
    if (!followPreview.ok) return;
    assert.equal(followPreview.followUp, true);
    assert.equal(followPreview.rows.find((row) => row.id === "incidentNumber")?.value, "27-001, then 27-002");
    assert.equal(followPreview.rows.find((row) => row.id === "dispatchNumber")?.value, "26018313");
    assert.equal(followPreview.rows.find((row) => row.id === "address")?.value, "Unchanged");
    assert.equal(followPreview.rows.find((row) => row.id === "assignedUnits")?.value, "1801");
    const freshPreview = previewIncidentFromLabels(fresh, choices, ";", "{yy}-{seq}", RESET, AFTER_RESET);
    assert.equal(freshPreview.ok, true);
    if (!freshPreview.ok) return;
    assert.equal(freshPreview.followUp, false);
    assert.equal(freshPreview.rows.find((row) => row.id === "dispatchNumber")?.value, "26018313");
    assert.equal(freshPreview.rows.find((row) => row.id === "incidentNumber")?.value, "27-001, then 27-002");
    assert.equal(freshPreview.rows.find((row) => row.id === "address")?.value, "2000 NORTH / 1600 EAST, CRESCENT CITY");
  });

  it("starts 27-001 on the first call after November 1", () => {
    assert.equal(currentFiscalPeriod(AFTER_RESET, RESET).yy, "27");
    assert.equal(incidentNumberSeriesExample(AFTER_RESET, RESET), "27-001, then 27-002");
    assert.equal(formatAssignedIncidentNumber(1, "27", "{yy}-{seq}"), "27-001");
    assert.equal(currentFiscalPeriod(chicagoWallTimeToUtc(2026, 10, 31, 12, 0), RESET).yy, "26");
    assert.equal(currentFiscalPeriod(chicagoWallTimeToUtc(2026, 11, 1, 0, 0), RESET).yy, "27");
    assert.equal(
      currentFiscalPeriod(chicagoWallTimeToUtc(2026, 11, 1, 7, 0), { month: 11, day: 1, time: "08:00" }).yy,
      "26",
    );
    const built = buildIncidentLabelConfig(emptyIncidentLabels(), ";", "{yy}-{seq}", RESET);
    assert.equal(built.incidentNumberExtract.resetMonth, 11);
    assert.equal(built.incidentNumberExtract.resetDay, 1);
    assert.equal(built.incidentNumberExtract.resetTime, "00:00");
  });

  it("assigns one incident field to each section", () => {
    let choices = emptyIncidentLabels();
    choices = assignSectionToField(choices, 0, "incidentNumber");
    choices = assignSectionToField(choices, 1, "incidentType");
    choices = assignSectionToField(choices, 0, "dispatchNumber");
    assert.equal(fieldIdForSection(choices, 0), "dispatchNumber");
    assert.equal(fieldIdForSection(choices, 1), "incidentType");
    assert.equal(choices.incidentNumber, null);
  });

  it("numbers calls by dispatch order and leaves deleted calls blank", () => {
    const rows = assignIncidentNumberChart(
      [
        { dispatchNumber: "26017820", incidentId: "c", currentIncidentNumber: "26017820", reportStatus: "Draft" },
        { dispatchNumber: "26017636", incidentId: "a", deleted: true, reportStatus: "Draft" },
        {
          dispatchNumber: "26017731",
          cfs: "2600083",
          incidentId: "b",
          currentIncidentNumber: "26017731",
          reportStatus: "Draft",
        },
      ],
      AFTER_RESET,
      RESET,
    );
    assert.equal(rows.map((row) => row.dispatchNumber).join(","), "26017636,26017731,26017820");
    assert.equal(rows[0]?.proposedIncidentNumber, "");
    assert.equal(rows[1]?.proposedIncidentNumber, "27-001");
    assert.equal(rows[1]?.cfs, "2600083");
    assert.equal(rows[2]?.proposedIncidentNumber, "27-002");
    const shown = chartRowsNewestFirst(rows);
    assert.equal(shown.map((row) => row.dispatchNumber).join(","), "26017820,26017731,26017636");
    assert.equal(shown.find((row) => row.dispatchNumber === "26017731")?.proposedIncidentNumber, "27-001");
  });

  it("counts newer calls up from a typed starting number", () => {
    const rows = [
      { dispatchNumber: "26017600", currentIncidentNumber: "27-040" },
      { dispatchNumber: "26017731" },
      { dispatchNumber: "26017740", deleted: true },
      { dispatchNumber: "26017820" },
      { dispatchNumber: "26017900", locked: true, heldNumber: "27-003" },
      { dispatchNumber: "26018000" },
    ];
    const from27 = incidentNumbersFromSeriesStarts(rows, { "26017731": "27-001" });
    assert.equal(from27["26017600"], undefined);
    assert.equal(from27["26017731"], "27-001");
    assert.equal(from27["26017740"], undefined);
    assert.equal(from27["26017820"], "27-002");
    assert.equal(from27["26017900"], undefined);
    assert.equal(from27["26018000"], "27-004");
    const bothYears = incidentNumbersFromSeriesStarts(rows, {
      "26017600": "26-001",
      "26017731": "27-001",
    });
    assert.equal(bothYears["26017600"], "26-001");
    assert.equal(bothYears["26017731"], "27-001");
    assert.equal(bothYears["26017820"], "27-002");
  });

  it("keeps a typed incident number on that dispatch number", () => {
    const built = buildIncidentLabelConfig(emptyIncidentLabels(), ";", "{yy}-{seq}", RESET, {
      incidentNumberOverrides: { "26017731": "27-001" },
    });
    assert.equal(incidentNumberOverridesFromExtract(built.incidentNumberExtract)["26017731"], "27-001");
    assert.deepEqual(incidentNumberOverridesFromExtract({}), {});
  });

  it("lets a department exclude phrases and keep exceptions", () => {
    assert.equal(emailExcludedBySetup("Requesting an ambulance at the scene", ["requesting an ambulance"], []), true);
    assert.equal(emailExcludedBySetup("Crescent EMS medical assist", ["EMS"], []), true);
    assert.equal(emailExcludedBySetup("Crescent EMS medical assist", ["EMS"], ["medical assist"]), false);
    assert.equal(emailExcludedBySetup("Structure fire", ["EMS"], []), false);
    const built = buildIncidentLabelConfig(emptyIncidentLabels(), ";", "{yy}-{seq}", RESET, {
      excludeContains: ["EMS"],
      excludeExceptions: ["medical assist"],
    });
    assert.deepEqual(built.incidentNumberExtract.excludeContains, ["EMS"]);
    assert.deepEqual(built.incidentNumberExtract.excludeExceptions, ["medical assist"]);
  });

  it("drops a CAD unit that is not department apparatus", () => {
    const email =
      "Crescent-Iroquois Fire - CAD CFS: 26017731; Department CFS: CrescentIroquoisFPD2600083; Nature: Fire Controlled Burn, Units: CrescentIroquoisFireDispatched, Unit response times:CrescentIroquoisFireDispatched - Dispatch 11/06/26 17:30:11";
    assert.equal(unitsMatchingApparatus(email, ["1801", "1871", "1881"]), "");
    assert.equal(
      unitsMatchingApparatus(`${email}; 1801 - On Scene 11/06/26 17:40:00`, ["1801", "1871"]),
      "1801",
    );
    const choices = emptyIncidentLabels();
    choices.dispatchNumber = { index: 0, afterLabel: false };
    choices.incidentInformation = { index: 3, afterLabel: false };
    const built = buildIncidentLabelConfig(choices);
    assert.equal(built.fieldMap.dispatchNumber, "dispatchNumber");
    assert.equal(built.fieldMap.incidentInformation, "dispatchInfo");
  });

  it("reads call and unit times from the email labels", () => {
    const email =
      "Start Date/Time: 11/06/26 17:29, Units: 1801, Unit response times:1801 - Dispatch 11/06/26 17:30:11, 1801 - On Scene 11/06/26 17:40:00, 1801 - InQuarters 11/06/26 18:05:02";
    assert.equal(cadLabeledDateTime(email, "Start Date/Time"), "2026-11-06T17:29:00");
    assert.equal(cadLabeledDateTime(email, ""), "");
    const times = cadUnitTimes(email);
    assert.equal(times[0]?.unit, "1801");
    assert.equal(times[0]?.label, "Dispatch");
    assert.equal(times[0]?.at, "2026-11-06T17:30:11");
    assert.equal(times[1]?.label, "On Scene");
    assert.equal(times[2]?.at, "2026-11-06T18:05:02");
    const built = buildIncidentLabelConfig(emptyIncidentLabels(), ";", "{yy}-{seq}", RESET, {
      timeMap: { ...DEFAULT_CAD_TIME_MAP, callClosed: "Clear" },
    });
    assert.equal(built.incidentNumberExtract.timeMap.callClosed, "Clear");
    assert.equal(timeMapFromExtract(built.incidentNumberExtract).unitOnScene, "On Scene");
    assert.equal(timeMapFromExtract({}).callCreated, "Start Date/Time");
  });

  it("reads the part that contains highlighted text", () => {
    assert.deepEqual(partFromSelection(SAMPLE, "540 E UNITED STATES HIGHWAY 24, GILMAN, IL 60938"), {
      index: 2,
      afterLabel: false,
    });
    assert.deepEqual(partFromSelection(SAMPLE, "GILMAN"), { index: 2, afterLabel: false });
    assert.deepEqual(partFromSelection(SAMPLE, "None"), { index: 5, afterLabel: true });
  });
});
