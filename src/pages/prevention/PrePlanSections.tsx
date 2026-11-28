import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PrePlanTemplate } from "../../api/prevention";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { toOptions } from "../maintenance/maintenanceUtils";
import { sectionsFor, type PrePlanField } from "./prePlanTemplates";

function FieldInput({ field, value, onChange }: { field: PrePlanField; value: string; onChange: (value: string) => void }) {
  if (field.kind === "textarea") {
    return <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />;
  }
  if (field.kind === "choice") {
    return (
      <NerisFlatSingleOptionSelect
        inputId={`preplan-${field.id}`}
        value={value}
        options={toOptions(field.options ?? [])}
        usePortal
        allowClear
        placeholder="Select"
        onChange={onChange}
      />
    );
  }
  return <input value={value} onChange={(event) => onChange(event.target.value)} />;
}

/**
 * Pre-plan sections, each collapsible and collapsed to start. Editing shows every field; reading shows only
 * sections and fields that have an answer.
 */
export function PrePlanSections({
  template,
  answers,
  onAnswer,
  compact,
  forceOpen,
}: {
  template: PrePlanTemplate;
  answers: Record<string, string>;
  onAnswer?: (id: string, value: string) => void;
  compact?: boolean;
  /** Opens every section, for printing. */
  forceOpen?: boolean;
}) {
  const editing = Boolean(onAnswer);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const filled = (field: PrePlanField) => (answers[field.id] ?? "").trim() !== "";
  const sections = sectionsFor(template)
    .map((section) => ({ section, answered: section.fields.filter(filled) }))
    .filter(({ answered }) => editing || answered.length > 0);

  if (sections.length === 0) {
    return <p className="field-hint">Nothing has been filled in on this pre-plan yet.</p>;
  }

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOpen = sections.every(({ section }) => open.has(section.id));

  return (
    <div className={compact ? "preplan-sections preplan-sections-compact" : "preplan-sections"}>
      <div className="preplan-sections-tools">
        <button
          type="button"
          className="edit-display-link"
          onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map(({ section }) => section.id)))}
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      {sections.map(({ section, answered }) => {
        const isOpen = forceOpen || open.has(section.id);
        const Chevron = isOpen ? ChevronDown : ChevronRight;
        return (
          <article key={section.id} className="panel preplan-section">
            <button type="button" className="preplan-section-toggle" aria-expanded={isOpen} onClick={() => toggle(section.id)}>
              <Chevron size={16} aria-hidden="true" />
              <span>{section.title}</span>
              {answered.length > 0 ? <span className="field-hint">{answered.length} filled</span> : null}
            </button>
            {isOpen ? (
              <div className="property-form-grid">
                {(editing ? section.fields : answered).map((field) =>
                  editing ? (
                    <label key={field.id} className={field.wide ? "property-form-wide" : undefined}>
                      {field.label}
                      <FieldInput field={field} value={answers[field.id] ?? ""} onChange={(value) => onAnswer?.(field.id, value)} />
                    </label>
                  ) : (
                    <div key={field.id} className={field.wide ? "property-readonly property-form-wide" : "property-readonly"}>
                      <span>{field.label}</span>
                      <div className="property-notes">{answers[field.id]}</div>
                    </div>
                  ),
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
