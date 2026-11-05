import assert from "node:assert/strict";
import test from "node:test";
import {
  REENTER_PASSWORD_MESSAGE,
  SECRET_PREFIX,
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} from "./secretBox.mjs";

const KEY = "practice-test-key";
const OTHER_KEY = "different-test-key";
const PASSWORD = "Fake-Audit-Pw-7Q2";

test("Fire Recovery password encrypts and decrypts", () => {
  const stored = encryptSecret(PASSWORD, KEY);
  assert.ok(stored.startsWith(SECRET_PREFIX));
  assert.equal(stored.includes(PASSWORD), false);
  assert.equal(decryptSecret(stored, KEY), PASSWORD);
  assert.equal(isEncryptedSecret(stored), true);
  assert.equal(isEncryptedSecret(PASSWORD), false);
});

test("altered Fire Recovery ciphertext is rejected", () => {
  const stored = encryptSecret(PASSWORD, KEY);
  const flipped = `${stored.slice(0, -1)}${stored.endsWith("a") ? "b" : "a"}`;
  assert.throws(() => decryptSecret(flipped, KEY), (error) => error.message === REENTER_PASSWORD_MESSAGE);
});

test("wrong Fire Recovery key is rejected", () => {
  const stored = encryptSecret(PASSWORD, KEY);
  assert.throws(() => decryptSecret(stored, OTHER_KEY), (error) => error.message === REENTER_PASSWORD_MESSAGE);
});

test("readable Fire Recovery password is refused", () => {
  assert.throws(() => decryptSecret(PASSWORD, KEY), (error) => error.message === REENTER_PASSWORD_MESSAGE);
});

test("missing Fire Recovery key does not echo the password", () => {
  assert.throws(() => encryptSecret(PASSWORD, ""), (error) => {
    assert.equal(error.message.includes(PASSWORD), false);
    return error.code === "SECRET_KEY_MISSING";
  });
});
