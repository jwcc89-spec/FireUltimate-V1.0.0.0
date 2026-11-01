import assert from "node:assert/strict";
import test from "node:test";
import { cadIngestGuard } from "./ingestGuard.mjs";

const SECRET = "stage-b-test-secret";

test("CAD ingest secret is required on every request", () => {
  const missing = cadIngestGuard({ headers: {} }, "");
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 503);

  const noHeader = cadIngestGuard({ headers: {} }, SECRET);
  assert.equal(noHeader.ok, false);
  assert.equal(noHeader.status, 401);

  const wrong = cadIngestGuard({ headers: { "x-cad-ingest-secret": "other-secret" } }, SECRET);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.status, 401);

  const correct = cadIngestGuard({ headers: { "x-cad-ingest-secret": SECRET } }, SECRET);
  assert.deepEqual(correct, { ok: true });
});
