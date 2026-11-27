import { useEffect, useState, type ReactNode } from "react";
import { ClipboardCheck } from "lucide-react";
import {
  createSubmission,
  deleteSubmission,
  getSubmission,
  reviewSubmission,
  type ChecklistAnswer,
  type ChecklistAssignment,
  type ChecklistItem,
  type ChecklistSection,
  type ChecklistSubmissionDetail,
  type ChecklistTargetKind,
  type ChecklistTemplate,
} from "../../api/checklists";
import { errorText, formatDateKey, todayKey } from "../maintenance/maintenanceUtils";
import { itemFlag, itemRule, statusTone, targetText } from "./checklistUtils";

const CHECK_CHOICES = [
  { value: "OK", label: "OK" },
  { value: "Fail", label: "Fail" },
  { value: "NA", label: "N/A" },
];
const YESNO_CHOICES = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];

function ChoiceButtons({
  choices,
  value,
  disabled,
  onChange,
}: {
  choices: { value: string; label: string }[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <span className="inspection-result-buttons" role="radiogroup">
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          role="radio"
          aria-checked={value === choice.value}
          disabled={disabled}
          className={`inspection-result-button ${value === choice.value ? "inspection-result-active" : ""} ${choice.value === "Fail" ? "checklist-choice-fail" : ""}`}
          onClick={() => onChange(value === choice.value ? "" : choice.value)}
        >
          {choice.label}
        </button>
      ))}
    </span>
  );
}

function ItemInput({ item, value, onChange }: { item: ChecklistItem; value: string; onChange: (value: string) => void }) {
  if (item.type === "check") return <ChoiceButtons choices={CHECK_CHOICES} value={value} onChange={onChange} />;
  if (item.type === "yesno") return <ChoiceButtons choices={YESNO_CHOICES} value={value} onChange={onChange} />;
  if (item.type === "quantity" || item.type === "number") {
    return (
      <input
        type="number"
        className="checklist-number"
        min={item.type === "quantity" ? 0 : undefined}
        step={item.type === "quantity" ? 1 : "any"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (item.type === "expiration" || item.type === "date") {
    return <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />;
  }
  if (item.type === "select") {
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Pick one...</option>
        {(item.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  return <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function shownValue(item: ChecklistItem, value: string): string {
  if (!value) return "—";
  if (value === "NA") return "N/A";
  if (item.type === "expiration" || item.type === "date") return formatDateKey(value) || value;
  return value;
}

function SectionPanel({ section, children }: { section: ChecklistSection; children: ReactNode }) {
  return (
    <article className="panel">
      <h3>{section.title}</h3>
      <div className="inspection-items">{children}</div>
    </article>
  );
}

export interface RunTarget {
  kind: ChecklistTargetKind;
  ref: string;
  label: string;
}

/** Fill in a check. The typed name is pre-filled with the signed-in person; the PIN is required but not stored. */
export function ChecklistRun({
  template,
  assignment,
  target,
  signedInName,
  onClose,
}: {
  template: ChecklistTemplate;
  assignment: ChecklistAssignment | null;
  target: RunTarget;
  signedInName: string;
  onClose: (savedId: string | null) => void;
}) {
  const [completedOn, setCompletedOn] = useState(todayKey());
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswer>>({});
  const [notes, setNotes] = useState("");
  const [signatureName, setSignatureName] = useState(signedInName);
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const items = template.sections.flatMap((section) => section.items);
  const unanswered = items.filter((item) => item.required && !answers[item.id]?.value).length;
  const flagged = items.filter((item) => itemFlag(item, answers[item.id]?.value ?? "", completedOn)).length;

  const setValue = (itemId: string, value: string) =>
    setAnswers((previous) => ({ ...previous, [itemId]: { value, note: previous[itemId]?.note ?? "" } }));
  const setNote = (itemId: string, note: string) =>
    setAnswers((previous) => ({ ...previous, [itemId]: { value: previous[itemId]?.value ?? "", note } }));
  const markUncheckedOk = () =>
    setAnswers((previous) => {
      const next = { ...previous };
      for (const item of items) {
        if (item.type === "check" && !next[item.id]?.value) next[item.id] = { value: "OK", note: next[item.id]?.note ?? "" };
      }
      return next;
    });

  const submit = async () => {
    setError("");
    if (unanswered > 0) return setError(`${unanswered} required items still need an answer.`);
    if (!signatureName.trim()) return setError("Type your name to sign the checklist.");
    if (!pin.trim()) return setError("Enter your PIN to sign the checklist.");
    setSaving(true);
    try {
      const saved = await createSubmission({
        templateId: template.id,
        assignmentId: assignment?.id ?? "",
        targetKind: target.kind,
        targetRef: target.ref,
        completedOn,
        signatureName,
        pin,
        notes,
        results: answers,
      });
      onClose(saved.id);
    } catch (saveError) {
      setError(errorText(saveError, "Could not save the checklist."));
      setSaving(false);
    }
  };

  return (
    <section className="page-section">
      <div className="maintenance-breadcrumb">
        <button type="button" className="edit-display-link" onClick={() => onClose(null)}>
          Checklists
        </button>
        <span>&gt; {template.name}</span>
      </div>
      <header className="page-header">
        <div>
          <h1 className="page-title-keep">{template.name}</h1>
          <p>
            {targetText(target.kind, target.label)}
            {assignment?.assignedTo ? ` · Assigned to ${assignment.assignedTo}` : ""}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button compact-button" onClick={() => onClose(null)}>
            Cancel
          </button>
        </div>
      </header>

      <div className="department-editor-toolbar">
        <p className="field-hint">
          {unanswered === 0 ? "Every required item has an answer." : `${unanswered} required items still need an answer.`}
          {flagged > 0 ? ` ${flagged} items will be flagged for an admin.` : ""}
        </p>
        <button type="button" className="secondary-button compact-button maintenance-icon-button" onClick={markUncheckedOk}>
          <ClipboardCheck size={14} aria-hidden="true" /> Mark Unchecked as OK
        </button>
      </div>

      {template.sections.map((section) => (
        <SectionPanel key={section.id} section={section}>
          {section.items.map((item) => {
            const answer = answers[item.id];
            const flag = itemFlag(item, answer?.value ?? "", completedOn);
            const rule = itemRule(item);
            return (
              <div key={item.id} className={`inspection-item ${flag ? "inspection-item-repair" : ""}`}>
                <span className="inspection-item-label">
                  {item.label}
                  {item.required ? <span className="required-mark"> *</span> : null}
                  {rule ? <span className="field-hint checklist-rule">{rule}</span> : null}
                </span>
                <ItemInput item={item} value={answer?.value ?? ""} onChange={(value) => setValue(item.id, value)} />
                <span className="inspection-item-note">
                  {flag ? <span className="tone tone-critical">{flag}</span> : null}
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={answer?.note ?? ""}
                    onChange={(event) => setNote(item.id, event.target.value)}
                  />
                </span>
              </div>
            );
          })}
        </SectionPanel>
      ))}

      <article className="panel">
        <label className="maintenance-textarea-label">
          Notes
          <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <h3>Sign</h3>
        <div className="department-edit-grid">
          <label>
            <span>Date<span className="required-mark"> *</span></span>
            <input type="date" value={completedOn} onChange={(event) => setCompletedOn(event.target.value)} />
          </label>
          <label>
            <span>Typed Name<span className="required-mark"> *</span></span>
            <input type="text" value={signatureName} onChange={(event) => setSignatureName(event.target.value)} />
          </label>
          <label>
            <span>PIN<span className="required-mark"> *</span></span>
            <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(event) => setPin(event.target.value)} />
          </label>
        </div>
        <p className="field-hint">For the demo the PIN only has to be entered. It is not saved.</p>
      </article>

      {error ? <p className="field-error">{error}</p> : null}
      <div className="header-actions">
        <button type="button" className="primary-button compact-button" disabled={saving} onClick={() => void submit()}>
          {saving ? "Saving..." : "Submit Checklist"}
        </button>
        <button type="button" className="secondary-button compact-button" onClick={() => onClose(null)}>
          Cancel
        </button>
      </div>
    </section>
  );
}

/** A completed check, read-only. Admins can mark a flagged check reviewed or delete it. */
export function ChecklistReport({ id, canManage, onBack }: { id: string; canManage: boolean; onBack: () => void }) {
  const [submission, setSubmission] = useState<ChecklistSubmissionDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getSubmission(id)
      .then((next) => {
        if (active) setSubmission(next);
      })
      .catch((loadError) => {
        if (active) setError(errorText(loadError, "Could not load the checklist."));
      });
    return () => {
      active = false;
    };
  }, [id]);

  const act = async (work: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (actionError) {
      setError(errorText(actionError, fallback));
    } finally {
      setBusy(false);
    }
  };

  if (!submission) return error ? <p className="field-error">{error}</p> : <p className="field-hint">Loading...</p>;

  return (
    <section className="page-section">
      <div className="maintenance-breadcrumb">
        <button type="button" className="edit-display-link" onClick={onBack}>
          Checklists
        </button>
        <span>&gt; {submission.submissionNumber}</span>
      </div>
      <header className="page-header">
        <div>
          <h1 className="page-title-keep">
            {submission.templateName} <span className={statusTone(submission.status)}>{submission.status}</span>
          </h1>
          <p>
            {submission.submissionNumber} · {targetText(submission.targetKind, submission.targetLabel)} · Signed by{" "}
            {submission.completedByName} on {formatDateKey(submission.completedOn)}
            {submission.reviewedBy ? ` · Reviewed by ${submission.reviewedBy}` : ""}
          </p>
        </div>
        <div className="header-actions">
          {canManage && submission.status === "Flagged" ? (
            <button
              type="button"
              className="primary-button compact-button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await reviewSubmission(submission.id);
                  setSubmission({ ...submission, status: "Reviewed" });
                }, "Could not mark the checklist reviewed.")
              }
            >
              Mark Reviewed
            </button>
          ) : null}
          {canManage ? (
            <button
              type="button"
              className="secondary-button compact-button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm("Delete this completed checklist?")) return;
                void act(async () => {
                  await deleteSubmission(submission.id);
                  onBack();
                }, "Could not delete the checklist.");
              }}
            >
              Delete
            </button>
          ) : null}
          <button type="button" className="secondary-button compact-button" onClick={onBack}>
            Back
          </button>
        </div>
      </header>
      {error ? <p className="field-error">{error}</p> : null}

      {submission.flags.length > 0 ? (
        <article className="panel checklist-flag-panel">
          <h3>Needs attention ({submission.flags.length})</h3>
          <ul className="list-card">
            {submission.flags.map((flag) => (
              <li key={flag.itemId}>
                <span className="tone tone-critical">{flag.reason}</span> {flag.label}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {submission.sections.map((section) => (
        <SectionPanel key={section.id} section={section}>
          {section.items.map((item) => {
            const answer = submission.results[item.id];
            return (
              <div key={item.id} className={`inspection-item ${answer?.flag ? "inspection-item-repair" : ""}`}>
                <span className="inspection-item-label">
                  {item.label}
                  {itemRule(item) ? <span className="field-hint checklist-rule">{itemRule(item)}</span> : null}
                </span>
                <strong>{shownValue(item, answer?.value ?? "")}</strong>
                <span className="inspection-item-note">
                  {answer?.flag ? <span className="tone tone-critical">{answer.flag}</span> : null}
                  {answer?.note ? <span>{answer.note}</span> : null}
                </span>
              </div>
            );
          })}
        </SectionPanel>
      ))}
      {submission.notes ? (
        <article className="panel">
          <h3>Notes</h3>
          <p>{submission.notes}</p>
        </article>
      ) : null}
    </section>
  );
}
