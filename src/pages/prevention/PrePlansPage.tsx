import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPrePlans, propertyTypeLabel, type PrePlanListItem } from "../../api/prevention";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { errorText, formatTimestamp24 } from "../maintenance/maintenanceUtils";
import { templateLabel } from "./prePlanTemplates";

type TemplateFilter = "all" | "basic" | "complex";

const FILTERS: { id: TemplateFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "basic", label: "Basic" },
  { id: "complex", label: "Complex" },
];

/** Fire Prevention > Pre-Plans: every pre-plan in the department. Pre-plans are added from a property. */
export function PrePlansPage() {
  const navigate = useNavigate();
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
    { id: "reviewed", label: "Last Reviewed", width: 130, value: (row) => row.reviewedOn, render: (row) => row.reviewedOn || "—" },
    {
      id: "updated",
      label: "Updated",
      width: 150,
      value: (row) => row.updatedAt,
      render: (row) => formatTimestamp24(row.updatedAt) || "—",
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
          <p>Every pre-plan in the department. To add one, open the property and use the Pre-Plans tab.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button compact-button" onClick={() => navigate("/fire-prevention/properties")}>
            Go to Properties
          </button>
        </div>
      </header>
      {error ? <p className="field-error">{error}</p> : null}
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
