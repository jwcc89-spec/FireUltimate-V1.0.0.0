import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyVendorReply,
  displaySubmitStatus,
  nextTrackingId,
  previewHash,
} from "./fireRecoverySubmit.mjs";

describe("fire recovery submit status", () => {
  it("ignores CatchCreated when hashing a preview", () => {
    const first = {
      IncidentToBillPayload: {
        IncidentsToBill: { incident: { CostRecovery: { CatchCreated: "2026-11-02T08:00:00", IncidentNumber: "26-1" } } },
      },
    };
    const second = JSON.parse(JSON.stringify(first));
    second.IncidentToBillPayload.IncidentsToBill.incident.CostRecovery.CatchCreated = "2026-11-02T09:15:00";
    assert.equal(previewHash(first), previewHash(second));
    second.IncidentToBillPayload.IncidentsToBill.incident.CostRecovery.IncidentNumber = "26-2";
    assert.notEqual(previewHash(first), previewHash(second));
  });

  it("counts a bill as sent only with Status 1 and a tracking ID", () => {
    const sent = classifyVendorReply({
      httpStatus: 200,
      json: { Done: { TrackingId: "track-1", "API Response": { Status: 1, Message: "Success" } } },
    });
    assert.equal(sent.outcome, "sent");
    assert.equal(sent.trackingId, "track-1");
    const unclear = classifyVendorReply({
      httpStatus: 200,
      json: { Done: { TrackingId: "track-1", "API Response": { Status: 0 } } },
    });
    assert.equal(unclear.outcome, "needs_review");
    assert.equal(classifyVendorReply({ httpStatus: 400, json: { message: "No" } }).outcome, "failed");
    assert.equal(classifyVendorReply({ httpStatus: 500 }).outcome, "needs_review");
    assert.equal(classifyVendorReply({ timedOut: true }).outcome, "needs_review");
  });

  it("shows a stale Submitting lock as Needs review and never drops a tracking ID", () => {
    const now = Date.parse("2026-11-02T12:00:00Z");
    assert.equal(
      displaySubmitStatus({ submitStatus: "submitting", submitStartedAt: "2026-11-02T11:50:00Z" }, now),
      "needs_review",
    );
    assert.equal(
      displaySubmitStatus({ submitStatus: "submitting", submitStartedAt: "2026-11-02T11:58:00Z" }, now),
      "submitting",
    );
    assert.equal(nextTrackingId("keep-me", ""), "keep-me");
    assert.equal(nextTrackingId("", "new-id"), "new-id");
    assert.equal(nextTrackingId(null, ""), null);
  });
});
