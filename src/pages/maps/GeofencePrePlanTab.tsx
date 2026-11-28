import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPrePlan, type PrePlan } from "../../api/prevention";
import { errorText, formatDateKey } from "../maintenance/maintenanceUtils";
import { PrePlanSections } from "../prevention/PrePlanSections";
import { templateLabel } from "../prevention/prePlanTemplates";

/** The geofence's linked pre-plan, read-only, with a link to the full pre-plan. */
export function GeofencePrePlanTab({ prePlanId }: { prePlanId: string }) {
  const [loaded, setLoaded] = useState<{ id: string; plan: PrePlan | null; error: string } | null>(null);

  useEffect(() => {
    if (!prePlanId) return;
    let active = true;
    void getPrePlan(prePlanId)
      .then((plan) => {
        if (active) setLoaded({ id: prePlanId, plan, error: "" });
      })
      .catch((failure) => {
        if (active) setLoaded({ id: prePlanId, plan: null, error: errorText(failure, "Could not load the pre-plan.") });
      });
    return () => {
      active = false;
    };
  }, [prePlanId]);

  if (!prePlanId) {
    return <p className="field-hint">No pre-plan is linked. Pick a property or pre-plan on the Information tab.</p>;
  }
  if (!loaded || loaded.id !== prePlanId) return <p className="field-hint">Loading...</p>;
  if (!loaded.plan) return <p className="field-error">{loaded.error}</p>;
  const plan = loaded.plan;

  return (
    <div className="geofence-preplan">
      <p>
        <strong>{plan.title}</strong> · {templateLabel(plan.template)}
        <br />
        <span className="field-hint">
          {plan.propertyAddress}
          {plan.reviewedOn ? ` · Last reviewed ${formatDateKey(plan.reviewedOn)}` : ""}
        </span>
      </p>
      <p className="geofence-links">
        <Link
          to={`/fire-prevention/properties?property=${encodeURIComponent(plan.propertyId)}&preplan=${encodeURIComponent(plan.id)}`}
        >
          Open full pre-plan
        </Link>
      </p>
      <PrePlanSections template={plan.template} answers={plan.answers} compact />
    </div>
  );
}
