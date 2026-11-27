import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  ITEM_TYPES,
  createChecklistTemplate,
  deleteChecklistTemplate,
  updateChecklistTemplate,
  type ChecklistItem,
  type ChecklistItemType,
  type ChecklistSection,
  type ChecklistTemplate,
} from "../../api/checklists";
import { errorText } from "../maintenance/maintenanceUtils";
import { emptyItem, emptySection } from "./checklistUtils";

function move<T>(list: T[], index: number, step: -1 | 1): T[] {
  const target = index + step;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function numberOrNull(raw: string): number | null {
  return raw.trim() === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
}

function ItemEditor({
  item,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  item: ChecklistItem;
  first: boolean;
  last: boolean;
  onChange: (item: ChecklistItem) => void;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
}) {
  const hint = ITEM_TYPES.find((entry) => entry.value === item.type)?.hint ?? "";
  const setType = (type: ChecklistItemType) => {
    const next: ChecklistItem = { id: item.id, label: item.label, type, required: item.required };
    if (type === "quantity") next.par = item.par ?? 1;
    if (type === "number") Object.assign(next, { min: item.min ?? null, max: item.max ?? null });
    if (type === "select") next.options = item.options ?? ["", ""];
    onChange(next);
  };
  return (
    <div className="checklist-builder-item">
      <input
        type="text"
        aria-label="Item label"
        placeholder="Item, for example BVM adult"
        value={item.label}
        onChange={(event) => onChange({ ...item, label: event.target.value })}
      />
      <select aria-label="Item type" value={item.type} onChange={(event) => setType(event.target.value as ChecklistItemType)}>
        {ITEM_TYPES.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </select>
      <label className="checklist-builder-check">
        <input type="checkbox" checked={item.required} onChange={(event) => onChange({ ...item, required: event.target.checked })} />
        Required
      </label>
      <span className="checklist-builder-actions">
        <button type="button" className="secondary-button compact-button" aria-label="Move item up" disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp size={14} aria-hidden="true" />
        </button>
        <button type="button" className="secondary-button compact-button" aria-label="Move item down" disabled={last} onClick={() => onMove(1)}>
          <ArrowDown size={14} aria-hidden="true" />
        </button>
        <button type="button" className="secondary-button compact-button" aria-label="Remove item" onClick={onRemove}>
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </span>
      {item.type === "quantity" ? (
        <label className="checklist-builder-extra">
          Par
          <input
            type="number"
            min={0}
            step={1}
            value={item.par ?? ""}
            onChange={(event) => onChange({ ...item, par: numberOrNull(event.target.value) ?? undefined })}
          />
        </label>
      ) : null}
      {item.type === "number" ? (
        <span className="checklist-builder-extra">
          <label>
            Low
            <input type="number" value={item.min ?? ""} onChange={(event) => onChange({ ...item, min: numberOrNull(event.target.value) })} />
          </label>
          <label>
            High
            <input type="number" value={item.max ?? ""} onChange={(event) => onChange({ ...item, max: numberOrNull(event.target.value) })} />
          </label>
        </span>
      ) : null}
      {item.type === "select" ? (
        <label className="checklist-builder-extra">
          Choices (one per line)
          <textarea
            rows={3}
            value={(item.options ?? []).join("\n")}
            onChange={(event) => onChange({ ...item, options: event.target.value.split("\n") })}
          />
        </label>
      ) : null}
      {hint ? <span className="field-hint checklist-builder-hint">{hint}</span> : null}
    </div>
  );
}

/** Build or edit a checklist template. Saving a changed item list makes a new version; old checks keep theirs. */
export function ChecklistTemplateBuilder({
  template,
  onClose,
}: {
  template: ChecklistTemplate | null;
  onClose: (changed: boolean) => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [enabled, setEnabled] = useState(template?.enabled ?? true);
  const [sections, setSections] = useState<ChecklistSection[]>(() => template?.sections ?? [emptySection()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateSection = (index: number, section: ChecklistSection) =>
    setSections((previous) => previous.map((entry, at) => (at === index ? section : entry)));

  const cleanSections = () =>
    sections.map((section) => ({
      ...section,
      items: section.items.map((item) => (item.type === "select" ? { ...item, options: (item.options ?? []).map((option) => option.trim()).filter(Boolean) } : item)),
    }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const input = { name, enabled, sections: cleanSections() };
      if (template) await updateChecklistTemplate(template.id, input);
      else await createChecklistTemplate(input);
      onClose(true);
    } catch (saveError) {
      setError(errorText(saveError, "Could not save the template."));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!template || !window.confirm(`Delete "${template.name}"? Its assignments are removed too. Completed checks are kept.`)) return;
    setSaving(true);
    try {
      await deleteChecklistTemplate(template.id);
      onClose(true);
    } catch (deleteError) {
      setError(errorText(deleteError, "Could not delete the template."));
      setSaving(false);
    }
  };

  return (
    <section className="page-section">
      <div className="maintenance-breadcrumb">
        <button type="button" className="edit-display-link" onClick={() => onClose(false)}>
          Templates
        </button>
        <span>&gt; {template ? template.name : "New Template"}</span>
      </div>
      <header className="page-header">
        <div>
          <h1 className="page-title-keep">{template ? "Edit Template" : "New Template"}</h1>
          <p>{template ? `Version ${template.version}. Saving changed items makes version ${template.version + 1}.` : "Add sections, then items in each section."}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="primary-button compact-button" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving..." : "Save Template"}
          </button>
          {template ? (
            <button type="button" className="secondary-button compact-button" disabled={saving} onClick={() => void remove()}>
              Delete
            </button>
          ) : null}
          <button type="button" className="secondary-button compact-button" onClick={() => onClose(false)}>
            Cancel
          </button>
        </div>
      </header>
      {error ? <p className="field-error">{error}</p> : null}

      <article className="panel">
        <div className="department-edit-grid">
          <label>
            <span>Template Name<span className="required-mark"> *</span></span>
            <input type="text" placeholder="For example Medic Jump Bag" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="checklist-builder-check">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            In use (turned-off templates can't be started)
          </label>
        </div>
      </article>

      {sections.map((section, sectionIndex) => (
        <article key={section.id} className="panel checklist-builder-section">
          <div className="checklist-builder-section-head">
            <input
              type="text"
              aria-label="Section title"
              placeholder={`Section ${sectionIndex + 1} title, for example Airway`}
              value={section.title}
              onChange={(event) => updateSection(sectionIndex, { ...section, title: event.target.value })}
            />
            <span className="checklist-builder-actions">
              <button
                type="button"
                className="secondary-button compact-button"
                aria-label="Move section up"
                disabled={sectionIndex === 0}
                onClick={() => setSections((previous) => move(previous, sectionIndex, -1))}
              >
                <ArrowUp size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="secondary-button compact-button"
                aria-label="Move section down"
                disabled={sectionIndex === sections.length - 1}
                onClick={() => setSections((previous) => move(previous, sectionIndex, 1))}
              >
                <ArrowDown size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="secondary-button compact-button"
                aria-label="Remove section"
                disabled={sections.length === 1}
                onClick={() => setSections((previous) => previous.filter((_, at) => at !== sectionIndex))}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </span>
          </div>
          {section.items.map((item, itemIndex) => (
            <ItemEditor
              key={item.id}
              item={item}
              first={itemIndex === 0}
              last={itemIndex === section.items.length - 1}
              onChange={(next) => updateSection(sectionIndex, { ...section, items: section.items.map((entry, at) => (at === itemIndex ? next : entry)) })}
              onMove={(step) => updateSection(sectionIndex, { ...section, items: move(section.items, itemIndex, step) })}
              onRemove={() => updateSection(sectionIndex, { ...section, items: section.items.filter((_, at) => at !== itemIndex) })}
            />
          ))}
          <button
            type="button"
            className="secondary-button compact-button maintenance-icon-button"
            onClick={() => updateSection(sectionIndex, { ...section, items: [...section.items, emptyItem()] })}
          >
            <Plus size={14} aria-hidden="true" /> Add Item
          </button>
        </article>
      ))}
      <div className="header-actions">
        <button
          type="button"
          className="secondary-button compact-button maintenance-icon-button"
          onClick={() => setSections((previous) => [...previous, emptySection()])}
        >
          <Plus size={14} aria-hidden="true" /> Add Section
        </button>
        <button type="button" className="primary-button compact-button" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving..." : "Save Template"}
        </button>
      </div>
    </section>
  );
}
