import assert from "node:assert/strict";
import test from "node:test";
import { PublicError, publicErrorMessage } from "./publicError.mjs";

test("public errors keep their message and internal errors use the fallback", () => {
  assert.equal(publicErrorMessage(new PublicError("Missing incident number."), "fallback"), "Missing incident number.");
  const leaked = publicErrorMessage(
    new Error("Invalid prisma.user.findMany() invocation … 127.0.0.1:5432"),
    "Unexpected users list error.",
  );
  assert.equal(leaked, "Unexpected users list error.");
  assert.equal(leaked.includes("prisma"), false);
  assert.equal(leaked.includes("127.0.0.1"), false);
});
