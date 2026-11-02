import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRE_RECOVERY_SANDBOX_DEPARTMENT_ID,
  fireRecoveryModeBanner,
  readFireRecoveryMode,
  resolveFireRecoveryDepartmentId,
} from "./fireRecoveryMode.mjs";

test("fire recovery mode reads sandbox, live, and off", () => {
  assert.equal(readFireRecoveryMode({ FIRE_RECOVERY_MODE: "sandbox" }), "sandbox");
  assert.equal(readFireRecoveryMode({ FIRE_RECOVERY_MODE: "  LIVE " }), "live");
  assert.equal(readFireRecoveryMode({}), "off");
  assert.equal(readFireRecoveryMode({ FIRE_RECOVERY_MODE: "" }), "off");
  assert.equal(readFireRecoveryMode({ FIRE_RECOVERY_MODE: "production" }), "off");
});

test("sandbox always uses FD12345678 and never the department NERIS ID", () => {
  for (const entityId of ["FD33333333", FIRE_RECOVERY_SANDBOX_DEPARTMENT_ID, "", "not-an-id"]) {
    const resolved = resolveFireRecoveryDepartmentId("sandbox", entityId);
    assert.equal(resolved.ok, true);
    assert.equal(resolved.departmentId, FIRE_RECOVERY_SANDBOX_DEPARTMENT_ID);
    assert.notEqual(resolved.departmentId, "FD33333333");
  }
  assert.match(fireRecoveryModeBanner("sandbox"), /SANDBOX/);
});

test("live refuses FD12345678 and accepts another NERIS entity ID", () => {
  const sandbox = resolveFireRecoveryDepartmentId("live", FIRE_RECOVERY_SANDBOX_DEPARTMENT_ID);
  assert.equal(sandbox.ok, false);
  assert.equal(sandbox.departmentId, "");
  assert.match(sandbox.message, /FD12345678/);

  const missing = resolveFireRecoveryDepartmentId("live", "");
  assert.equal(missing.ok, false);
  assert.match(missing.message, /NERIS Entity ID/);

  const real = resolveFireRecoveryDepartmentId("live", "fd33333333");
  assert.equal(real.ok, false, "live requires the stored FD######## shape, not a lowercase rewrite");

  const accepted = resolveFireRecoveryDepartmentId("live", "FD33333333");
  assert.equal(accepted.ok, true);
  assert.equal(accepted.departmentId, "FD33333333");
  assert.match(fireRecoveryModeBanner("live"), /LIVE/);
});

test("unset mode refuses every submit", () => {
  const resolved = resolveFireRecoveryDepartmentId("off", "FD33333333");
  assert.equal(resolved.ok, false);
  assert.equal(resolved.departmentId, "");
  assert.match(resolved.message, /switched off/);
  assert.match(fireRecoveryModeBanner("off"), /switched off/);
});
