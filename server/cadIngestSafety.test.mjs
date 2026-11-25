import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendCadNote,
  cadIngestIdentity,
  cadIngestIsDuplicate,
  cadNewerInformationMessage,
  fillBlankIncidentFields,
} from "./cadIngestSafety.mjs";

describe("cadIngestSafety", () => {
  it("treats the same message id or the same body as one email", () => {
    const first = cadIngestIdentity({ "message-id": "<abc@cad>" }, "same body");
    const replay = cadIngestIdentity({ "Message-ID": "<abc@cad>" }, "same body");
    const sameWordsNewId = cadIngestIdentity({ "message-id": "<new@cad>" }, "same body");
    const different = cadIngestIdentity({ "message-id": "<new@cad>" }, "other body");
    assert.equal(cadIngestIsDuplicate(replay, [first]), true);
    assert.equal(cadIngestIsDuplicate(sameWordsNewId, [first]), true);
    assert.equal(cadIngestIsDuplicate(different, [first]), false);
  });

  it("fills a blank address and leaves a typed address alone", () => {
    const filled = fillBlankIncidentFields(
      { address: "1 Main St", incidentType: "" },
      { address: "9 Other St", incidentType: "Fire" },
    );
    assert.equal(filled.data.address, undefined);
    assert.equal(filled.data.incidentType, "Fire");
    assert.deepEqual(filled.newer, ["address"]);
    assert.equal(cadNewerInformationMessage(filled.newer), "CAD has newer information for address. Those fields were left as saved.");
  });

  it("does not append the same CAD note twice", () => {
    const once = appendCadNote("", "Unit 1801 on scene");
    assert.equal(appendCadNote(once, "Unit 1801 on scene"), once);
    assert.match(appendCadNote(once, "Unit 1801 clear"), /Unit 1801 clear/);
  });
});
