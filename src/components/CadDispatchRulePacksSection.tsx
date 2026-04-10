import { useCallback, useState } from "react";
import {
  mergeSelectedPacksInCatalogOrder,
  serializeRulesForEditor,
  type RulePackDefinition,
} from "../cadDispatch/rulePresets.ts";

type Props = {
  packs: readonly RulePackDefinition[];
  rulesJson: string;
  onRulesJsonChange: (next: string) => void;
};

/**
 * Product rule packs: checkboxes + Apply merges catalog-ordered rules into the editor JSON.
 * Advanced JSON remains the source of truth after Save until a server-side catalog exists (Batch K).
 */
export function CadDispatchRulePacksSection({ packs, rulesJson, onRulesJsonChange }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const applyPacks = useCallback(() => {
    const merged = mergeSelectedPacksInCatalogOrder(packs, selected);
    onRulesJsonChange(serializeRulesForEditor(merged));
  }, [packs, selected, onRulesJsonChange]);

  return (
    <div className="cad-dispatch-rule-packs">
      <p className="panel-description cad-dispatch-rule-packs-intro">
        Choose one or more <strong>product rule packs</strong>, then click <strong>Apply selected packs</strong> to
        load them into the rules below (catalog order). Use <strong>Advanced</strong> only if you need a custom rule
        list.
      </p>
      <ul className="cad-dispatch-rule-packs-list">
        {packs.map((p) => (
          <li key={p.id}>
            <label className="cad-dispatch-rule-pack-item">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span>
                <strong>{p.label}</strong>
                <span className="cad-dispatch-rule-pack-desc"> — {p.description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="cad-dispatch-incident-actions">
        <button type="button" className="secondary-button" onClick={applyPacks}>
          Apply selected packs to rules
        </button>
      </div>
      <details className="cad-dispatch-advanced-rules">
        <summary>Advanced — edit rules as JSON</summary>
        <p className="panel-description">
          Technical view of the same rules sent to the server. Prefer rule packs when possible.
        </p>
        <textarea
          className="cad-dispatch-rules-textarea"
          spellCheck={false}
          value={rulesJson}
          onChange={(e) => onRulesJsonChange(e.target.value)}
          rows={10}
          aria-label="Rules JSON"
        />
      </details>
    </div>
  );
}
