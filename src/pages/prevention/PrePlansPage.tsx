import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  getPrePlans,
  getProperties,
  propertyTypeLabel,
  type PrePlanListItem,
  type PrePlanTemplate,
  type PropertySummary,
} from "../../api/prevention";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { useMyPermissions } from "../../useMyPermissions";
import { EditDialog } from "../maintenance/MaintenanceSetupTabs";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { errorText, formatDateKey } from "../maintenance/maintenanceUtils";
import { formatDayOf } from "./preventionUtils";
import { templateLabel } from "./prePlanTemplates";

type TemplateFilter = "all" | "basic" | "complex";

const FILTERS: { id: TemplateFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "basic", label: "Basic" },
  { id: "complex", label: "Complex" },
];

function NewPrePlanDialog({
  template,
  onCancel,
  onPick,
}: {
  template: PrePlanTemplate;
  onCancel: () => void;
  onPick: (propertyId: string) => void;
}) {
  const [properties, setProperties] = useState<PropertySummary[] | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getProperties()
      .then((next) => {
        if (active) setProperties(next);
      })
      .catch((loadError) => {
        if (active) setError(errorText(loadError, "Could not load properties."));
      });
    return () => {
      active = false;
    };
  }, []);

  const options = (properties ?? [])
    .map((row) => ({
      value: row.id,
      label: [[row.address, row.unit].filter(Boolean).join(" "), row.name ? `(${row.name})` : ""].filter(Boolean).join(" "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <EditDialog
      title={`New ${templateLabel(template)} Pre-Plan`}
      error={error}
      saving={false}
      onSave={() => {
        if (!propertyId) {
          setError("Pick the property this pre-plan is for.");
          return;
        }
        onPick(propertyId);
      }}
      onCancel={onCancel}
    >
      <label className="property-form-wide">
        Property
        <NerisFlatSingleOptionSelect
          inputId="new-preplan-property"
          value={propertyId}
          options={options}
          usePortal
          placeholder={properties === null ? "Loading..." : "Search an address or name"}
          onChange={(value) => {
            setPropertyId(value);
            setError("");
          }}
        />
      </label>
      <p className="field-hint property-form-wide">Not listed? Add the property first under Fire Prevention &gt; Properties.</p>
    </EditDialog>
  );
}

/** Fire Prevention > Pre-Plans: every pre-plan in the department. New ones are attached to a property. */
export function PrePlansPage() {
  const navigate = useNavigate();
  const grants = useMyPermissions();
  const canManage = grants?.["prevention.manage"] === true;
  const [newTemplate, setNewTemplate] = useState<PrePlanTemplate | null>(null);
  const [rows, setRows] = useState<PrePlanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TemplateFilter>("all");

  useEffect(() => {
    let active = true;
    void getPrePlans()
      .then((next) => {
        if (active) setRows(next);
      })
      .catch((loadError) => {
        if (active) setError(errorText(loadError, "Could not load pre-plans."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.template !== filter) return false;
      if (!term) return true;
      return [row.title, row.propertyName, row.propertyAddress].some((value) => value.toLowerCase().includes(term));
    });
  }, [rows, search, filter]);

  const columns: ModuleTableColumn<PrePlanListItem>[] = [
    {
      id: "address",
      label: "Property",
      width: 260,
      value: (row) => row.propertyAddress,
      render: (row) => (
        <span className="property-list-address">
          <strong>{row.propertyAddress}</strong>
          {row.propertyName ? <span className="field-hint">{row.propertyName}</span> : null}
        </span>
      ),
    },
    { id: "title", label: "Title", width: 200, value: (row) => row.title, render: (row) => row.title },
    {
      id: "template",
      label: "Template",
      width: 110,
      value: (row) => row.template,
      render: (row) => <span className="tone tone-neutral">{templateLabel(row.template)}</span>,
    },
    {
      id: "type",
      label: "Property Type",
      width: 130,
      value: (row) => row.propertyType,
      render: (row) => propertyTypeLabel(row.propertyType),
    },
    {
      id: "reviewed",
      label: "Last Reviewed",
      width: 130,
      value: (row) => row.reviewedOn,
      render: (row) => formatDateKey(row.reviewedOn) || "—",
    },
    {
      id: "updated",
      label: "Updated",
      width: 120,
      value: (row) => row.updatedAt,
      render: (row) => formatDayOf(row.updatedAt) || "—",
    },
  ];

  const toolbar = (
    <>
      <input
        type="search"
        className="maintenance-search"
        value={search}
        placeholder="Search title or property"
        aria-label="Search pre-plans"
        onChange={(event) => setSearch(event.target.value)}
      />
      {FILTERS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={`secondary-button compact-button ${filter === entry.id ? "department-toggle-active" : ""}`}
          onClick={() => setFilter(entry.id)}
        >
          {entry.label}
        </button>
      ))}
    </>
  );

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Pre-Plans</h1>
          <p>Every pre-plan in the department. Each pre-plan belongs to a property.</p>
        </div>
        <div className="header-actions">
          {canManage
            ? (["basic", "complex"] as const).map((template) => (
                <button
                  key={template}
                  type="button"
                  className="primary-button compact-button maintenance-icon-button"
                  onClick={() => setNewTemplate(template)}
                >
                  <Plus size={14} aria-hidden="true" /> New {templateLabel(template)} Pre-Plan
                </button>
              ))
            : null}
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => navigate("/fire-prevention/properties")}
          >
            Go to Properties
          </button>
        </div>
      </header>
      {error ? <p className="field-error">{error}</p> : null}
      {newTemplate ? (
        <NewPrePlanDialog
          template={newTemplate}
          onCancel={() => setNewTemplate(null)}
          onPick={(propertyId) =>
            navigate(`/fire-prevention/properties?property=${encodeURIComponent(propertyId)}&preplan=new&template=${newTemplate}`)
          }
        />
      ) : null}
      <article className="panel">
        {loading ? (
          <p className="field-hint">Loading...</p>
        ) : (
          <ModuleTable
            tableId="prevention-preplans"
            toolbarStart={toolbar}
            columns={columns}
            rows={filtered}
            rowKey={(row) => row.id}
            onRowClick={(row) =>
              navigate(
                `/fire-prevention/properties?property=${encodeURIComponent(row.propertyId)}&preplan=${encodeURIComponent(row.id)}`,
              )
            }
            emptyText={rows.length === 0 ? "No pre-plans yet." : "No pre-plans match this search."}
            defaultSort={{ id: "address", direction: "asc" }}
          />
        )}
      </article>
    </section>
  );
}
