import { useCallback } from "react";
import type { CadRule } from "../cadDispatch/ruleEngine.ts";
import { escapeRegexLiteral, tryDecodeLiteralPattern } from "../cadDispatch/regexEscape.ts";
import {
  mergeSelectedPacksInCatalogOrder,
  type RulePackDefinition,
} from "../cadDispatch/rulePresets.ts";

type Props = {
  rules: CadRule[];
  onChange: (next: CadRule[]) => void;
  presetCatalog?: readonly RulePackDefinition[];
  presetCatalogLabel?: string;
};

type AddValue =
  | "trim"
  | "normalize_newlines"
  | "replace_literal"
  | "delete_before_nth"
  | "delete_after_nth"
  | "extract_capture";

function defaultRule(value: AddValue): CadRule {
  switch (value) {
    case "trim":
      return { type: "trim" };
    case "normalize_newlines":
      return { type: "normalize_newlines" };
    case "replace_literal":
      return { type: "regex_replace", pattern: "", replacement: "", flags: "g" };
    case "delete_before_nth":
      return { type: "delete_before_nth", substring: "", occurrence: 1, caseSensitive: false };
    case "delete_after_nth":
      return { type: "delete_after_nth", substring: "", occurrence: 1, caseSensitive: false };
    case "extract_capture":
      return { type: "extract_capture", pattern: "", group: 1, slot: "field", flags: "i" };
    default:
      return { type: "trim" };
  }
}

function updateAt(rules: CadRule[], index: number, rule: CadRule): CadRule[] {
  const next = rules.slice();
  next[index] = rule;
  return next;
}

function move(rules: CadRule[], from: number, dir: -1 | 1): CadRule[] {
  const to = from + dir;
  if (to < 0 || to >= rules.length) return rules;
  const next = rules.slice();
  const t = next[from];
  next[from] = next[to];
  next[to] = t;
  return next;
}

export function CadRulePipelineEditor({
  rules,
  onChange,
  presetCatalog,
  presetCatalogLabel = "Insert preset (adds to end)",
}: Props) {
  const addRule = useCallback(
    (raw: string) => {
      if (!raw) return;
      onChange([...rules, defaultRule(raw as AddValue)]);
    },
    [rules, onChange],
  );

  const appendPreset = useCallback(
    (packId: string) => {
      if (!packId || !presetCatalog?.length) return;
      const merged = mergeSelectedPacksInCatalogOrder(presetCatalog, new Set([packId]));
      onChange([...rules, ...merged]);
    },
    [rules, onChange, presetCatalog],
  );

  return (
    <div className="cad-rule-pipeline">
      <div className="cad-rule-pipeline-toolbar">
        <label className="cad-rule-pipeline-add-label">
          <span className="cad-rule-pipeline-add-title">Add rule</span>
          <select
            className="cad-rule-pipeline-select"
            value=""
            aria-label="Select a rule type to add"
            onChange={(e) => {
              addRule(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">Select rule…</option>
            <option value="trim">Trim leading and trailing whitespace</option>
            <option value="normalize_newlines">Normalize line endings (CRLF → LF)</option>
            <option value="replace_literal">Replace or remove text (leave replacement blank to delete)</option>
            <option value="delete_before_nth">Delete everything before the Nth occurrence of…</option>
            <option value="delete_after_nth">Delete everything after the Nth occurrence of…</option>
            <option value="extract_capture">Extract text (regex) into a named field</option>
          </select>
        </label>
        {presetCatalog && presetCatalog.length > 0 ? (
          <label className="cad-rule-pipeline-add-label">
            <span className="cad-rule-pipeline-add-title">{presetCatalogLabel}</span>
            <select
              className="cad-rule-pipeline-select"
              value=""
              aria-label="Insert a preset rule pack"
              onChange={(e) => {
                appendPreset(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">—</option>
              {presetCatalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {rules.length === 0 ? (
        <p className="panel-description cad-rule-pipeline-empty">
          No rules yet. Use <strong>Select rule…</strong> to add steps. Rules run in order from top to bottom.
        </p>
      ) : (
        <ol className="cad-rule-pipeline-list">
          {rules.map((rule, index) => (
            <li key={index} className="cad-rule-pipeline-item">
              <div className="cad-rule-pipeline-item-inner">
                <span className="cad-rule-pipeline-grip" aria-hidden title="Order: top to bottom">
                  ⋮⋮
                </span>
                <div className="cad-rule-pipeline-rule-body">
                  <RuleRowEditor
                    rule={rule}
                    onChange={(r) => onChange(updateAt(rules, index, r))}
                  />
                </div>
                <div className="cad-rule-pipeline-item-actions">
                  <button
                    type="button"
                    className="cad-rule-pipeline-icon-btn"
                    aria-label="Move rule up"
                    disabled={index === 0}
                    onClick={() => onChange(move(rules, index, -1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="cad-rule-pipeline-icon-btn"
                    aria-label="Move rule down"
                    disabled={index === rules.length - 1}
                    onClick={() => onChange(move(rules, index, 1))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="cad-rule-pipeline-icon-btn cad-rule-pipeline-remove"
                    aria-label="Remove rule"
                    onClick={() => onChange(rules.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function RuleRowEditor({
  rule,
  onChange,
}: {
  rule: CadRule;
  onChange: (r: CadRule) => void;
}) {
  switch (rule.type) {
    case "trim":
      return (
        <p className="cad-rule-sentence">
          <strong>Trim</strong> leading and trailing whitespace from the message.
        </p>
      );
    case "normalize_newlines":
      return (
        <p className="cad-rule-sentence">
          <strong>Normalize</strong> line endings (CR / CRLF → LF).
        </p>
      );
    case "regex_replace":
      return <RegexReplaceRow rule={rule} onChange={onChange} />;
    case "delete_before_nth":
      return (
        <p className="cad-rule-sentence">
          Delete everything <strong>before</strong> the{" "}
          <select
            className="cad-rule-inline-select"
            value={String(rule.occurrence)}
            onChange={(e) =>
              onChange({ ...rule, occurrence: Math.max(1, parseInt(e.target.value, 10) || 1) })
            }
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={String(n)}>
                {n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`}
              </option>
            ))}
          </select>{" "}
          occurrence of{" "}
          <input
            type="text"
            className="cad-rule-inline-input"
            value={rule.substring}
            onChange={(e) => onChange({ ...rule, substring: e.target.value })}
          />
          .
        </p>
      );
    case "delete_after_nth":
      return (
        <p className="cad-rule-sentence">
          Delete everything <strong>after</strong> the{" "}
          <select
            className="cad-rule-inline-select"
            value={String(rule.occurrence)}
            onChange={(e) =>
              onChange({ ...rule, occurrence: Math.max(1, parseInt(e.target.value, 10) || 1) })
            }
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={String(n)}>
                {n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`}
              </option>
            ))}
          </select>{" "}
          occurrence of{" "}
          <input
            type="text"
            className="cad-rule-inline-input"
            value={rule.substring}
            onChange={(e) => onChange({ ...rule, substring: e.target.value })}
          />
          .
        </p>
      );
    case "extract_capture":
      return (
        <p className="cad-rule-sentence">
          Extract capture group{" "}
          <input
            type="number"
            className="cad-rule-inline-input narrow"
            min={0}
            max={20}
            value={rule.group}
            onChange={(e) =>
              onChange({ ...rule, group: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
          />{" "}
          from regex{" "}
          <input
            type="text"
            className="cad-rule-inline-input cad-rule-regex-wide"
            value={rule.pattern}
            placeholder="pattern"
            onChange={(e) => onChange({ ...rule, pattern: e.target.value })}
          />{" "}
          into field{" "}
          <input
            type="text"
            className="cad-rule-inline-input"
            value={rule.slot}
            onChange={(e) => onChange({ ...rule, slot: e.target.value })}
          />{" "}
          (flags{" "}
          <input
            type="text"
            className="cad-rule-inline-input narrow"
            value={rule.flags ?? ""}
            onChange={(e) => onChange({ ...rule, flags: e.target.value })}
          />
          ).
        </p>
      );
    default:
      return <p className="field-error">Unknown rule type.</p>;
  }
}

function RegexReplaceRow({
  rule,
  onChange,
}: {
  rule: Extract<CadRule, { type: "regex_replace" }>;
  onChange: (r: CadRule) => void;
}) {
  const decoded = tryDecodeLiteralPattern(rule.pattern);
  const simple = decoded !== null;

  if (simple) {
    return (
      <p className="cad-rule-sentence">
        Replace{" "}
        <select
          className="cad-rule-inline-select"
          value={rule.flags?.includes("g") ? "every" : "first"}
          onChange={(e) => {
            const g = e.target.value === "every";
            onChange({ ...rule, flags: g ? "g" : "" });
          }}
        >
          <option value="every">every instance</option>
          <option value="first">the first instance</option>
        </select>{" "}
        of{" "}
        <input
          type="text"
          className="cad-rule-inline-input"
          value={decoded}
          placeholder="text to find"
          onChange={(e) => {
            const lit = e.target.value;
            onChange({
              ...rule,
              pattern: escapeRegexLiteral(lit),
              flags: rule.flags?.includes("g") ? "g" : "",
            });
          }}
        />{" "}
        with{" "}
        <input
          type="text"
          className="cad-rule-inline-input"
          value={rule.replacement}
          placeholder="replacement (leave blank to remove)"
          onChange={(e) => onChange({ ...rule, replacement: e.target.value })}
        />
        .
      </p>
    );
  }

  return (
    <div className="cad-rule-advanced-regex">
      <p className="cad-rule-sentence">
        <strong>Replace (advanced regex)</strong> pattern{" "}
        <input
          type="text"
          className="cad-rule-inline-input cad-rule-regex-wide"
          value={rule.pattern}
          onChange={(e) => onChange({ ...rule, pattern: e.target.value })}
        />{" "}
        →{" "}
        <input
          type="text"
          className="cad-rule-inline-input"
          value={rule.replacement}
          onChange={(e) => onChange({ ...rule, replacement: e.target.value })}
        />{" "}
        flags{" "}
        <input
          type="text"
          className="cad-rule-inline-input narrow"
          value={rule.flags ?? ""}
          onChange={(e) => onChange({ ...rule, flags: e.target.value })}
        />
      </p>
    </div>
  );
}
