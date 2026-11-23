import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIncidentLabelConfig,
  labelOnLineOfSelection,
  labelsFromSavedRules,
  previewIncidentFromLabels,
} from "./incidentLabelMap.ts";

const SAMPLE = [
  "CFS: 26-1044",
  "Incident Number: 2026-55",
  "Address:",
  "123 Main St",
  "Nature: Structure Fire",
  "Priority: 1",
  "District: Still 2",
  "Reported By: Jane",
  "Units: E1, T1",
  "Phone: 815-555-0100",
  "Code: SF",
  "Notes: Smoke showing",
  "from the roof",
  "",
  "END",
].join("\n");

describe("incidentLabelMap", () => {
  it("reads a labeled line and the following line", () => {
    const labels = {
      incidentNumber: "Incident Number",
      dispatchNumber: "CFS",
      incidentType: "Nature",
      initialDispatchCode: "Code",
      priority: "Priority",
      stillDistrict: "District",
      reportedBy: "Reported By",
      assignedUnits: "Units",
      address: "Address",
      callbackNumber: "Phone",
      dispatchNotes: "Notes",
    };
    const preview = previewIncidentFromLabels(SAMPLE, labels);
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    const value = (id: string) => preview.rows.find((row) => row.id === id)?.value;
    assert.equal(value("incidentNumber"), "2026-55");
    assert.equal(value("dispatchNumber"), "26-1044");
    assert.equal(value("address"), "123 Main St");
    assert.equal(value("incidentType"), "Structure Fire");
    assert.equal(value("initialDispatchCode"), "SF");
    assert.equal(value("status"), "Draft");
    assert.equal(value("dispatchNotes"), "Smoke showing\nfrom the roof");
  });

  it("copies the incident number into dispatch number when that label is blank", () => {
    const labels = {
      incidentNumber: "Incident Number",
      dispatchNumber: "",
      incidentType: "",
      initialDispatchCode: "",
      priority: "",
      stillDistrict: "",
      reportedBy: "",
      assignedUnits: "",
      address: "",
      callbackNumber: "",
      dispatchNotes: "",
    };
    const preview = previewIncidentFromLabels(SAMPLE, labels);
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    assert.equal(preview.rows.find((row) => row.id === "dispatchNumber")?.value, "2026-55");
  });

  it("round-trips saved label rules", () => {
    const labels = {
      incidentNumber: "Incident Number:",
      dispatchNumber: "",
      incidentType: "Nature",
      initialDispatchCode: "",
      priority: "",
      stillDistrict: "",
      reportedBy: "",
      assignedUnits: "",
      address: "Address",
      callbackNumber: "",
      dispatchNotes: "",
    };
    const built = buildIncidentLabelConfig(labels);
    const loaded = labelsFromSavedRules(built.rules);
    assert.equal(loaded.recognized, true);
    assert.equal(loaded.labels.incidentNumber, "Incident Number");
    assert.equal(loaded.labels.incidentType, "Nature");
    assert.equal(loaded.labels.address, "Address");
    assert.equal(loaded.labels.dispatchNumber, "");
    assert.equal(built.incidentNumberExtract?.slot, "incidentNumber");
    assert.equal(built.fieldMap.incidentType, "incidentType");
    assert.equal(built.fieldMap.address, "address");
  });

  it("leaves custom rules unrecognized", () => {
    const loaded = labelsFromSavedRules([
      { type: "extract_capture", pattern: "CFS:\\s*(\\S+)", group: 1, slot: "cfs", flags: "i" },
    ]);
    assert.equal(loaded.recognized, false);
  });

  it("reads the label from highlighted text", () => {
    assert.equal(labelOnLineOfSelection(SAMPLE, "Structure Fire"), "Nature");
    assert.equal(labelOnLineOfSelection(SAMPLE, "123 Main St"), "Address");
  });
});
