import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeRegexLiteral, tryDecodeLiteralPattern } from "./regexEscape.ts";

describe("regexEscape", () => {
  it("round-trips literals used for find/replace UI", () => {
    const samples = ["", "hello", "1.2.3", "foo/bar", "(x)"];
    for (const s of samples) {
      const p = escapeRegexLiteral(s);
      assert.equal(tryDecodeLiteralPattern(p), s);
    }
  });

  it("returns null for patterns that are not literal-only", () => {
    assert.equal(tryDecodeLiteralPattern("a+b"), null);
  });
});
