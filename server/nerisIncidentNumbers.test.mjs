import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseNerisIncidentNumbers } from "./nerisIncidentNumbers.mjs";

describe("chooseNerisIncidentNumbers", () => {
  it("sends the department incident number when the report still has the dispatch number", () => {
    const chosen = chooseNerisIncidentNumbers({
      formIncidentNumber: "26017731",
      formDispatchNumber: "26017731",
      recordIncidentNumber: "27-001",
      recordDispatchNumber: "26017731",
      callNumber: "incident-id",
    });
    assert.equal(chosen.incidentNumber, "27-001");
    assert.equal(chosen.dispatchNumber, "26017731");
  });

  it("keeps a report incident number the user typed", () => {
    const chosen = chooseNerisIncidentNumbers({
      formIncidentNumber: "27-005",
      formDispatchNumber: "26017731",
      recordIncidentNumber: "27-001",
      recordDispatchNumber: "26017731",
    });
    assert.equal(chosen.incidentNumber, "27-005");
    assert.equal(chosen.dispatchNumber, "26017731");
  });

  it("uses the dispatch number only for the dispatch field", () => {
    const chosen = chooseNerisIncidentNumbers({
      formIncidentNumber: "27-001",
      formDispatchNumber: "",
      recordIncidentNumber: "",
      recordDispatchNumber: "26017820",
    });
    assert.equal(chosen.incidentNumber, "27-001");
    assert.equal(chosen.dispatchNumber, "26017820");
  });
});
