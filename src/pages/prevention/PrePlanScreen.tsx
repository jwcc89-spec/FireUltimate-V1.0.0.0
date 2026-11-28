import { useEffect, useState } from "react";
import { Pencil, Printer } from "lucide-react";
import {
  createPrePlan,
  deletePrePlan,
  fullAddress,
  getPrePlan,
  updatePrePlan,
  type PrePlan,
  type PrePlanInput,
  type PrePlanTemplate,
  type PropertyDetail,
} from "../../api/prevention";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { errorText, formatDateKey, formatTimestamp24 } from "../maintenance/maintenanceUtils";
import { useDialogSave } from "../maintenance/useDialogSave";
import { PrePlanSections } from "./PrePlanSections";
import { templateLabel } from "./prePlanTemplates";

function inputOf(plan: PrePlan | null, template: PrePlanTemplate): PrePlanInput {
  if (!plan) return { title: "Pre-Plan", template, reviewedOn: "", answers: {} };
  return {
    title: plan.title,
    template: plan.template,
    reviewedOn: plan.reviewedOn,
    answers: { ...plan.answers },
  };
}

/**
 * One pre-plan for a property. planId "new" starts a blank Basic or Complex pre-plan; otherwise it opens
 * read-only, and managers can switch to editing. Every field is optional.
 */
export function PrePlanScreen({
  property,
  planId,
  template,
  editing,
  canManage,
  onBack,
  onEdit,
  onSaved,
  onDeleted,
}: {
  property: PropertyDetail;
  planId: string;
  template: PrePlanTemplate;
  editing: boolean;
  canManage: boolean;
  onBack: () => void;
  onEdit: () => void;
  onSaved: (plan: PrePlan) => void;
  onDeleted: () => void;
}) {
  const isNew = planId === "new";
  const [plan, setPlan] = useState<PrePlan | null>(null);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<PrePlanInput>(() => inputOf(null, template));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [printing, setPrinting] = useState(false);
  const { saving, error, run } = useDialogSave();

  useEffect(() => {
    if (isNew) return;
    let active = true;
    void getPrePlan(planId)
      .then((next) => {
        if (!active) return;
        setPlan(next);
        setDraft(inputOf(next, next.template));
      })
      .catch((failure) => {
        if (active) setLoadError(errorText(failure, "Could not load the pre-plan."));
      });
    return () => {
      active = false;
    };
  }, [isNew, planId]);

  const breadcrumb = (
    <div className="maintenance-breadcrumb">
      <button type="button" className="edit-display-link" onClick={onBack}>
        {property.address}
      </button>
      <span>&gt; {isNew ? `New ${templateLabel(template)} Pre-Plan` : plan?.title || "Pre-Plan"}</span>
    </div>
  );

  if (loadError) {
    return (
      <section className="page-section">
        {breadcrumb}
        <p className="field-error">{loadError}</p>
      </section>
    );
  }
  if (!isNew && !plan) {
    return (
      <section className="page-section">
        {breadcrumb}
        <p className="field-hint">Loading...</p>
      </section>
    );
  }

  const showForm = canManage && (isNew || editing);
  const setAnswer = (id: string, value: string) =>
    setDraft((current) => ({
      ...current,
      answers: { ...current.answers, [id]: value },
    }));

  const save = () =>
    void run(async () => {
      const saved = isNew ? await createPrePlan(property.id, draft) : await updatePrePlan(planId, draft);
      onSaved(saved);
    }, "Could not save the pre-plan.");

  const print = () => {
    setPrinting(true);
    window.setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
  };

  const remove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    void run(async () => {
      await deletePrePlan(planId);
      onDeleted();
    }, "Could not delete the pre-plan.");
  };

  return (
    <section className="page-section preplan-screen">
      <div className="preplan-sticky">
        {breadcrumb}
        <article className="panel preplan-header">
          <div>
            <h2>{showForm ? draft.title || "Pre-Plan" : plan?.title}</h2>
            <p>{fullAddress(property)}</p>
            <div className="property-tags">
              <span className="tone tone-neutral">{templateLabel(draft.template)}</span>
              {property.occupancyType ? <span className="tone tone-neutral">{property.occupancyType}</span> : null}
              {!showForm && plan?.reviewedOn ? <span className="tone tone-neutral">Last reviewed {formatDateKey(plan.reviewedOn)}</span> : null}
              {!showForm && plan?.updatedAt ? (
                <span className="field-hint">
                  Updated {formatTimestamp24(plan.updatedAt)}
                  {plan.updatedBy ? ` by ${plan.updatedBy}` : ""}
                </span>
              ) : null}
            </div>
          </div>
          <div className="header-actions">
            {showForm ? (
              <>
                <button type="button" className="primary-button compact-button" disabled={saving} onClick={save}>
                  {saving ? "Saving..." : "Save"}
                </button>
                <button type="button" className="secondary-button compact-button" onClick={onBack}>
                  Cancel
                </button>
                {!isNew ? (
                  <button type="button" className="secondary-button compact-button" disabled={saving} onClick={remove}>
                    {confirmDelete ? "Click again to delete" : "Delete"}
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <button type="button" className="secondary-button compact-button maintenance-icon-button" onClick={print}>
                  <Printer size={14} aria-hidden="true" /> Print
                </button>
                {canManage ? (
                  <button type="button" className="primary-button compact-button maintenance-icon-button" onClick={onEdit}>
                    <Pencil size={14} aria-hidden="true" /> Edit
                  </button>
                ) : null}
              </>
            )}
          </div>
        </article>
        {error ? <p className="field-error">{error}</p> : null}
      </div>

      {showForm ? (
        <article className="panel">
          <div className="property-form-grid">
            <label>
              Title
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <label>
              Template
              <NerisFlatSingleOptionSelect
                inputId="preplan-template"
                value={draft.template}
                options={[
                  { value: "basic", label: "Basic" },
                  { value: "complex", label: "Complex" },
                ]}
                usePortal
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    template: value === "complex" ? "complex" : "basic",
                  })
                }
              />
            </label>
            <label>
              Last Reviewed
              <input
                type="date"
                value={draft.reviewedOn}
                onChange={(event) => setDraft({ ...draft, reviewedOn: event.target.value })}
              />
            </label>
          </div>
          <p className="field-hint">
            Every field is optional. Switching to Basic hides the Complex sections but keeps their answers.
          </p>
        </article>
      ) : null}

      <PrePlanSections
        template={draft.template}
        answers={draft.answers}
        onAnswer={showForm ? setAnswer : undefined}
        forceOpen={printing}
      />
    </section>
  );
}
