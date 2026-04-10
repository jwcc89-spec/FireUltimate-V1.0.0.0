import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ICOMM_FIXTURE_INITIAL_DISPATCH,
  ICOMM_FIXTURE_UPDATE_DISPATCH,
} from "./icommFixtures.ts";
import { normalizeDispatchTextForParsing } from "./normalizeDispatchText.ts";
import { parseCadRulesJson, runCadRulePipeline, type CadRule } from "./ruleEngine.ts";

describe("normalizeDispatchTextForParsing", () => {
  test("trims and CRLF to LF", () => {
    assert.equal(
      normalizeDispatchTextForParsing("  a\r\nb\r  "),
      "a\nb",
    );
  });
});

describe("parseCadRulesJson", () => {
  test("accepts empty array", () => {
    assert.deepEqual(parseCadRulesJson([]), []);
  });
  test("rejects non-array", () => {
    assert.throws(() => parseCadRulesJson({}), /array/);
  });
  test("parses a full rule set", () => {
    const rules = parseCadRulesJson([
      { type: "trim" },
      { type: "delete_before_nth", substring: "ADDR:", occurrence: 1, caseSensitive: true },
      {
        type: "extract_capture",
        pattern: String.raw`CFS:\s*(\S+)`,
        group: 1,
        slot: "cfs",
      },
    ]);
    assert.equal(rules.length, 3);
    assert.equal(rules[2]?.type, "extract_capture");
  });
});

describe("runCadRulePipeline", () => {
  const cfsRules: CadRule[] = [
    {
      type: "extract_capture",
      pattern: String.raw`CFS:\s*(\S+)`,
      group: 1,
      slot: "cfs",
    },
  ];

  test("extracts same CFS from initial and update fixtures", () => {
    const a = runCadRulePipeline(ICOMM_FIXTURE_INITIAL_DISPATCH, cfsRules);
    const b = runCadRulePipeline(ICOMM_FIXTURE_UPDATE_DISPATCH, cfsRules);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (a.ok && b.ok) {
      assert.equal(a.slots.cfs, "25-004567");
      assert.equal(b.slots.cfs, "25-004567");
    }
  });

  test("delete_before_nth + trim narrows working text", () => {
    const rules: CadRule[] = [
      { type: "delete_before_nth", substring: "ADDR:", occurrence: 1, caseSensitive: false },
      { type: "trim" },
    ];
    const r = runCadRulePipeline(ICOMM_FIXTURE_INITIAL_DISPATCH, rules);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.ok(r.text.startsWith("ADDR:"));
      assert.ok(r.text.includes("123 N MAIN ST"));
    }
  });

  test("regex_replace removes label line noise", () => {
    const rules: CadRule[] = [
      {
        type: "regex_replace",
        pattern: "^ICOMM CAD[^\n]*\n",
        replacement: "",
        flags: "m",
      },
    ];
    const r = runCadRulePipeline(ICOMM_FIXTURE_INITIAL_DISPATCH, rules);
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(!r.text.startsWith("ICOMM"));
  });

  test("returns ok:false on invalid regex in regex_replace", () => {
    const rules: CadRule[] = [{ type: "regex_replace", pattern: "[", replacement: "", flags: "" }];
    const r = runCadRulePipeline("x", rules);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.includes("Rule 0"));
  });
});
