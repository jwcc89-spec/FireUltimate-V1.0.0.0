import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignSectionToField,
  buildIncidentLabelConfig,
  emptyIncidentLabels,
  departmentCfsDigits,
  fieldIdForSection,
  formatIncidentNumber,
  followUpCallNumber,
  partFromSelection,
  labelsFromSavedRules,
  previewIncidentFromLabels,
  splitDispatchParts,
} from "./incidentLabelMap.ts";

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
    const preview = previewIncidentFromLabels(SAMPLE, choices);
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    const value = (id: string) => preview.rows.find((row) => row.id === id)?.value;
    assert.equal(value("incidentNumber"), "Waiting for Department CFS");
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
    const followPreview = previewIncidentFromLabels(followUp, choices);
    assert.equal(followPreview.ok, true);
    if (!followPreview.ok) return;
    assert.equal(followPreview.followUp, true);
    assert.equal(departmentCfsDigits(followUp), "2600089");
    assert.equal(formatIncidentNumber("2600089", "{yy}-{seq}"), "26-00089");
    assert.equal(formatIncidentNumber("2600089", "{cfs}"), "2600089");
    assert.equal(followPreview.rows.find((row) => row.id === "incidentNumber")?.value, "26-00089");
    assert.equal(followPreview.rows.find((row) => row.id === "dispatchNumber")?.value, "26018313");
    assert.equal(followPreview.rows.find((row) => row.id === "cfsNumber")?.value, "2600089");
    assert.equal(followPreview.rows.find((row) => row.id === "address")?.value, "Unchanged");
    assert.equal(followPreview.rows.find((row) => row.id === "assignedUnits")?.value, "1801");
    const freshPreview = previewIncidentFromLabels(fresh, choices);
    assert.equal(freshPreview.ok, true);
    if (!freshPreview.ok) return;
    assert.equal(freshPreview.followUp, false);
    assert.equal(freshPreview.rows.find((row) => row.id === "dispatchNumber")?.value, "26018313");
    assert.equal(freshPreview.rows.find((row) => row.id === "incidentNumber")?.value, "Waiting for Department CFS");
    assert.equal(freshPreview.rows.find((row) => row.id === "address")?.value, "2000 NORTH / 1600 EAST, CRESCENT CITY");
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

  it("reads the part that contains highlighted text", () => {
    assert.deepEqual(partFromSelection(SAMPLE, "540 E UNITED STATES HIGHWAY 24, GILMAN, IL 60938"), {
      index: 2,
      afterLabel: false,
    });
    assert.deepEqual(partFromSelection(SAMPLE, "GILMAN"), { index: 2, afterLabel: false });
    assert.deepEqual(partFromSelection(SAMPLE, "None"), { index: 5, afterLabel: true });
  });
});
