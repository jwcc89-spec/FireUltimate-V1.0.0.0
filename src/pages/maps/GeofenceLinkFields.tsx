import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPrePlans, getProperties, type PrePlanListItem, type PropertySummary } from "../../api/prevention";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";

const propertyHref = (propertyId: string, prePlanId = "") =>
  `/fire-prevention/properties?property=${encodeURIComponent(propertyId)}${prePlanId ? `&preplan=${encodeURIComponent(prePlanId)}` : ""}`;

function propertyLabel(row: PropertySummary): string {
  const address = [row.address, row.unit].filter(Boolean).join(" ");
  return row.name ? `${address} (${row.name})` : address;
}

/** Linked property and pre-plan for a geofence: dropdowns while editing, open links when reading. */
export function GeofenceLinkFields({
  propertyId,
  prePlanId,
  editable,
  onChange,
}: {
  propertyId: string;
  prePlanId: string;
  editable: boolean;
  onChange: (patch: { linkedPropertyId?: string; linkedPrePlanId?: string }) => void;
}) {
  const [properties, setProperties] = useState<PropertySummary[] | null>(null);
  const [prePlans, setPrePlans] = useState<PrePlanListItem[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([getProperties(), getPrePlans()])
      .then(([nextProperties, nextPlans]) => {
        if (!active) return;
        setProperties(nextProperties);
        setPrePlans(nextPlans);
      })
      .catch(() => {
        if (active) setProperties([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const property = properties?.find((row) => row.id === propertyId) ?? null;
  const plan = prePlans.find((row) => row.id === prePlanId) ?? null;
  const planChoices = prePlans.filter((row) => !propertyId || row.propertyId === propertyId);

  const openLinks =
    property || plan ? (
      <p className="field-hint map-span geofence-links">
        {property ? <Link to={propertyHref(property.id)}>Open property</Link> : null}
        {plan ? <Link to={propertyHref(plan.propertyId, plan.id)}>Open pre-plan</Link> : null}
      </p>
    ) : null;

  if (!editable) {
    if (!propertyId && !prePlanId) return null;
    return (
      <>
        {property ? <p>Property: {propertyLabel(property)}</p> : null}
        {plan ? <p>Pre-plan: {plan.title}</p> : null}
        {openLinks}
      </>
    );
  }

  return (
    <>
      <label className="map-span">
        Linked property
        <NerisFlatSingleOptionSelect
          inputId="map-geofence-property"
          value={propertyId}
          options={(properties ?? []).map((row) => ({ value: row.id, label: propertyLabel(row) }))}
          usePortal
          allowClear
          placeholder={properties === null ? "Loading..." : "No linked property"}
          onChange={(value) => {
            const keepPlan = prePlans.some((row) => row.id === prePlanId && row.propertyId === value);
            onChange({ linkedPropertyId: value, linkedPrePlanId: keepPlan ? prePlanId : "" });
          }}
        />
      </label>
      <label className="map-span">
        Linked pre-plan
        <NerisFlatSingleOptionSelect
          inputId="map-geofence-preplan"
          value={prePlanId}
          options={planChoices.map((row) => ({ value: row.id, label: `${row.title} · ${row.propertyAddress}` }))}
          usePortal
          allowClear
          placeholder={planChoices.length === 0 ? "No pre-plans yet" : "No linked pre-plan"}
          onChange={(value) => {
            const picked = prePlans.find((row) => row.id === value);
            onChange(picked ? { linkedPrePlanId: value, linkedPropertyId: picked.propertyId } : { linkedPrePlanId: "" });
          }}
        />
      </label>
      {openLinks}
    </>
  );
}
