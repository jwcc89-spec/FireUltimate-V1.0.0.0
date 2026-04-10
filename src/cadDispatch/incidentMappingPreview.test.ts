import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMappedIncidentFieldsPreview,
  extractMergeKeyFromSlots,
} from "./incidentMappingPreview.ts";

describe("incidentMappingPreview", () => {
  it("extracts merge key from configured slot", () => {
    assert.equal(
      extractMergeKeyFromSlots({ cfs: "25-1", address: "x" }, { slot: "cfs" }),
      "25-1",
    );
  });

  it("falls back to cfs / incidentNumber", () => {
    assert.equal(extractMergeKeyFromSlots({ cfs: "A" }, null), "A");
    assert.equal(extractMergeKeyFromSlots({ incidentNumber: "B" }, null), "B");
  });

  it("maps slots to incident fields and default dispatchNotes from pipeline text", () => {
    const m = buildMappedIncidentFieldsPreview(
      { addr: "123 Main", cfs: "1" },
      { addr: "address" },
      "full pipeline text",
    );
    assert.equal(m.address, "123 Main");
    assert.equal(m.dispatchNotes, "full pipeline text");
  });
});
