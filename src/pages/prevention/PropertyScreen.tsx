import { type ReactNode, useState } from "react";
import { Building2, ClipboardList, ExternalLink, FileText, Flame, House, Pencil, Plus, ShieldCheck, Siren } from "lucide-react";
import { deleteProperty, fullAddress, propertyTypeLabel, type PrePlanTemplate, type PropertyDetail } from "../../api/prevention";
import { mapsApiKey, type LatLng } from "../maps/mapUtils";
import { formatTimestamp24 } from "../maintenance/maintenanceUtils";
import { useDialogSave } from "../maintenance/useDialogSave";
import { PropertyContactsTab } from "./PropertyContactsTab";
import { PropertyIncidentsTab } from "./PropertyIncidentsTab";
import { templateLabel } from "./prePlanTemplates";
import { formatSquareFeet, mapsLink, streetViewImageUrl, type StreetViewCamera } from "./preventionUtils";

type TopTab = "details" | "contacts";
type LowerTab = "incidents" | "preplans" | "inspections" | "permits" | "alarms";

const LOWER_TABS: { id: LowerTab; label: string; Icon: typeof Flame }[] = [
  { id: "incidents", label: "Incidents", Icon: Flame },
  { id: "preplans", label: "Pre-Plans", Icon: FileText },
  { id: "inspections", label: "Inspections", Icon: ClipboardList },
  { id: "permits", label: "Permits", Icon: ShieldCheck },
  { id: "alarms", label: "Alarm Requests", Icon: Siren },
];

function ReadOnly({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "property-readonly property-form-wide" : "property-readonly"}>
      <span>{label}</span>
      <div>{value === "" || value == null ? "—" : value}</div>
    </div>
  );
}

/**
 * Property main screen: overview card, Details | Contacts, and the lower tabs. Live Street View and Aerial
 * load only while creating or editing; this screen shows the saved thumbnail (one Street View image at most).
 */
export function PropertyScreen({
  property,
  canManage,
  onEdit,
  onBack,
  onChanged,
  onDeleted,
  onOpenPrePlan,
  onNewPrePlan,
}: {
  property: PropertyDetail;
  canManage: boolean;
  onOpenPrePlan: (id: string) => void;
  onNewPrePlan: (template: PrePlanTemplate) => void;
  onEdit: () => void;
  onBack: () => void;
  onChanged: (next: PropertyDetail) => void;
  onDeleted: () => void;
}) {
  const apiKey = mapsApiKey();
  const [topTab, setTopTab] = useState<TopTab>("details");
  const [lowerTab, setLowerTab] = useState<LowerTab>("incidents");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { saving, error, run } = useDialogSave();

  const point: LatLng | null =
    property.latitude != null && property.longitude != null ? { lat: property.latitude, lng: property.longitude } : null;
  const camera: StreetViewCamera = {
    panoId: property.streetViewPanoId,
    heading: property.streetViewHeading,
    pitch: property.streetViewPitch,
    zoom: property.streetViewZoom,
  };
  const thumbnail = property.photo || streetViewImageUrl(apiKey, camera, 480, 300);
  const address = fullAddress(property);
  const TypeIcon = property.propertyType === "commercial" ? Building2 : House;
  const latestPrePlan = property.prePlans[0] ?? null;

  const remove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    void run(async () => {
      await deleteProperty(property.id);
      onDeleted();
    }, "Could not delete the property.");
  };

  return (
    <section className="page-section">
      <div className="maintenance-breadcrumb">
        <button type="button" className="edit-display-link" onClick={onBack}>
          Properties
        </button>
        <span>&gt; {property.address}</span>
      </div>
      {canManage ? (
        <div className="header-actions">
          <button type="button" className="secondary-button compact-button maintenance-icon-button" onClick={onEdit}>
            <Pencil size={14} aria-hidden="true" /> Edit
          </button>
          <button type="button" className="secondary-button compact-button" disabled={saving} onClick={remove}>
            {confirmDelete ? "Click again to delete" : "Delete"}
          </button>
        </div>
      ) : null}
      {error ? <p className="field-error">{error}</p> : null}

      <div className="property-main">
          <article className="panel property-overview">
            {thumbnail ? (
              <img className="property-thumbnail" src={thumbnail} alt={`Building at ${property.address}`} />
            ) : (
              <div className="property-thumbnail property-thumbnail-empty">
                <TypeIcon size={36} aria-hidden="true" />
              </div>
            )}
            <div className="property-overview-text">
              {property.name ? <h2>{property.name}</h2> : <h2>{property.address}</h2>}
              <p>{address}</p>
              <div className="property-tags">
                <span className="tone tone-neutral">
                  <TypeIcon size={13} aria-hidden="true" /> {propertyTypeLabel(property.propertyType)}
                </span>
                {property.occupancyType ? <span className="tone tone-neutral">{property.occupancyType}</span> : null}
                {property.ownerName ? <span className="tone tone-neutral">Owner: {property.ownerName}</span> : null}
              </div>
              <div className="header-actions">
                {latestPrePlan ? (
                  <button
                    type="button"
                    className="primary-button compact-button maintenance-icon-button"
                    onClick={() => onOpenPrePlan(latestPrePlan.id)}
                  >
                    <FileText size={14} aria-hidden="true" /> View Pre-Plan
                  </button>
                ) : canManage ? (
                  <button
                    type="button"
                    className="primary-button compact-button maintenance-icon-button"
                    onClick={() => onNewPrePlan("basic")}
                  >
                    <Plus size={14} aria-hidden="true" /> Add Pre-Plan
                  </button>
                ) : (
                  <span className="field-hint">No pre-plan yet.</span>
                )}
                <a
                  className="secondary-button compact-button maintenance-icon-button"
                  href={mapsLink(point, address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} aria-hidden="true" /> Open in Google Maps
                </a>
              </div>
            </div>
          </article>

          <nav className="department-editor-toolbar-actions maintenance-tabs" aria-label="Property sections">
            {(["details", "contacts"] as const).map((id) => (
              <button
                key={id}
                type="button"
                className={`secondary-button compact-button ${topTab === id ? "department-toggle-active" : ""}`}
                onClick={() => setTopTab(id)}
              >
                {id === "details" ? "Details" : `Contacts (${property.contacts.length})`}
              </button>
            ))}
          </nav>

          <article className="panel">
            {topTab === "details" ? (
              <div className="property-form-grid">
                <ReadOnly label="Occupant or Business Name" value={property.name} wide />
                <ReadOnly label="Address" value={property.address} wide />
                <ReadOnly label="Suite / Unit / Lot" value={property.unit} />
                <ReadOnly label="City" value={property.city} />
                <ReadOnly label="State" value={property.state} />
                <ReadOnly label="Postal Code" value={property.postalCode} />
                <ReadOnly label="Property Type" value={propertyTypeLabel(property.propertyType)} />
                <ReadOnly label="Occupancy Type" value={property.occupancyType} />
                <ReadOnly label="Square Footage" value={formatSquareFeet(property.squareFeet)} />
                <ReadOnly label="Year Built" value={property.yearBuilt ?? ""} />
                <ReadOnly label="Latitude" value={property.latitude ?? ""} />
                <ReadOnly label="Longitude" value={property.longitude ?? ""} />
                <ReadOnly label="Notes" value={property.notes ? <span className="property-notes">{property.notes}</span> : ""} wide />
              </div>
            ) : (
              <PropertyContactsTab property={property} canManage={canManage} onChanged={onChanged} />
            )}
          </article>

          <nav className="department-editor-toolbar-actions maintenance-tabs property-lower-tabs" aria-label="Property records">
            {LOWER_TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`secondary-button compact-button ${lowerTab === id ? "department-toggle-active" : ""}`}
                onClick={() => setLowerTab(id)}
              >
                <Icon size={14} aria-hidden="true" /> {label}
              </button>
            ))}
          </nav>
          <article className="panel property-lower-panel">
            {lowerTab === "incidents" ? (
              <PropertyIncidentsTab propertyId={property.id} />
            ) : lowerTab === "preplans" ? (
              <div className="property-preplans">
                {canManage ? (
                  <div className="header-actions">
                    {(["basic", "complex"] as const).map((template) => (
                      <button
                        key={template}
                        type="button"
                        className="secondary-button compact-button maintenance-icon-button"
                        onClick={() => onNewPrePlan(template)}
                      >
                        <Plus size={14} aria-hidden="true" /> New {templateLabel(template)} Pre-Plan
                      </button>
                    ))}
                  </div>
                ) : null}
                {property.prePlans.length === 0 ? (
                  <p className="field-hint">No pre-plans for this property yet.</p>
                ) : (
                  <ul className="property-preplan-list">
                    {property.prePlans.map((plan) => (
                      <li key={plan.id}>
                        <button type="button" className="edit-display-link" onClick={() => onOpenPrePlan(plan.id)}>
                          {plan.title}
                        </button>
                        <span className="tone tone-neutral">{templateLabel(plan.template)}</span>
                        <span className="field-hint">
                          {plan.reviewedOn ? `Last reviewed ${plan.reviewedOn} · ` : ""}Updated {formatTimestamp24(plan.updatedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : lowerTab === "inspections" ? (
              <p className="field-hint">Inspections for this property are added in the next update.</p>
            ) : (
              <p className="field-hint">Coming soon.</p>
            )}
          </article>
      </div>
    </section>
  );
}
