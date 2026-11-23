import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIncidentLabelConfig,
  emptyIncidentLabels,
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
    assert.equal(value("incidentNumber"), "26018614");
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

  it("reads the part that contains highlighted text", () => {
    assert.deepEqual(partFromSelection(SAMPLE, "540 E UNITED STATES HIGHWAY 24, GILMAN, IL 60938"), {
      index: 2,
      afterLabel: false,
    });
    assert.deepEqual(partFromSelection(SAMPLE, "GILMAN"), { index: 2, afterLabel: false });
    assert.deepEqual(partFromSelection(SAMPLE, "None"), { index: 5, afterLabel: true });
  });
});
