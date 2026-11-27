import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { List, Map as MapIcon, Plus } from "lucide-react";
import {
  getProperties,
  getProperty,
  propertyTypeLabel,
  type PropertyDetail,
  type PropertySummary,
} from "../../api/prevention";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { useMyPermissions } from "../../useMyPermissions";
import type { LatLng } from "../maps/mapUtils";
import { errorText } from "../maintenance/maintenanceUtils";
import { PropertiesMap } from "./PropertiesMap";
import { PropertyForm } from "./PropertyForm";
import { PropertyScreen } from "./PropertyScreen";
import { formatSquareFeet } from "./preventionUtils";

type TypeFilter = "all" | "residential" | "commercial";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "residential", label: "Residential" },
  { id: "commercial", label: "Commercial" },
];

/**
 * Fire Prevention > Properties. The list (or map), and through the address bar
 * ?property=<id> for one property, &edit=1 to edit it, or ?new=1 to add one.
 */
export function PropertiesPage() {
  const grants = useMyPermissions();
  const canManage = grants?.["prevention.manage"] === true;
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyId = searchParams.get("property") ?? "";
  const editing = searchParams.get("edit") === "1";
  const creating = searchParams.get("new") === "1";
  const view = searchParams.get("view") === "map" ? "map" : "list";

  const [rows, setRows] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [detailError, setDetailError] = useState("");

  const loadList = useCallback(
    () =>
      getProperties()
        .then((next) => {
          setRows(next);
          setError("");
        })
        .catch((loadError) => setError(errorText(loadError, "Could not load properties.")))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!propertyId) return;
    let active = true;
    void getProperty(propertyId)
      .then((next) => {
        if (!active) return;
        setDetail(next);
        setDetailError("");
      })
      .catch((loadError) => {
        if (active) setDetailError(errorText(loadError, "Could not load the property."));
      });
    return () => {
      active = false;
    };
  }, [propertyId]);

  const go = (params: Record<string, string>) => {
    if (!params.property) setDetail(null);
    setSearchParams(params);
  };
  const backToList = () => go(view === "map" ? { view: "map" } : {});

  const fallbackCenter = useMemo<LatLng | null>(() => {
    const pinned = rows.find((row) => row.latitude != null && row.longitude != null);
    return pinned ? { lat: pinned.latitude as number, lng: pinned.longitude as number } : null;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== "all" && row.propertyType !== typeFilter) return false;
      if (!term) return true;
      return [row.name, row.address, row.unit, row.city, row.ownerName].some((value) => value.toLowerCase().includes(term));
    });
  }, [rows, search, typeFilter]);

  if (creating && canManage) {
    return (
      <PropertyForm
        existing={null}
        fallbackCenter={fallbackCenter}
        onCancel={backToList}
        onSaved={(saved) => {
          setDetail(saved);
          void loadList();
          go({ property: saved.id });
        }}
      />
    );
  }

  if (propertyId) {
    if (detailError) {
      return (
        <section className="page-section">
          <p className="field-error">{detailError}</p>
          <button type="button" className="secondary-button compact-button" onClick={backToList}>
            Back to Properties
          </button>
        </section>
      );
    }
    if (!detail || detail.id !== propertyId) {
      return (
        <section className="page-section">
          <p className="field-hint">Loading...</p>
        </section>
      );
    }
    if (editing && canManage) {
      return (
        <PropertyForm
          key={detail.id}
          existing={detail}
          fallbackCenter={fallbackCenter}
          onCancel={() => go({ property: detail.id })}
          onSaved={(saved) => {
            setDetail(saved);
            void loadList();
            go({ property: saved.id });
          }}
        />
      );
    }
    return (
      <PropertyScreen
        key={detail.id}
        property={detail}
        canManage={canManage}
        onEdit={() => go({ property: detail.id, edit: "1" })}
        onBack={backToList}
        onChanged={(next) => {
          setDetail(next);
          void loadList();
        }}
        onDeleted={() => {
          void loadList();
          backToList();
        }}
      />
    );
  }

  const columns: ModuleTableColumn<PropertySummary>[] = [
    {
      id: "address",
      label: "Address",
      width: 260,
      value: (row) => row.address,
      render: (row) => (
        <span className="property-list-address">
          <strong>{[row.address, row.unit].filter(Boolean).join(" ")}</strong>
          {row.name ? <span className="field-hint">{row.name}</span> : null}
        </span>
      ),
    },
    { id: "city", label: "City", width: 140, value: (row) => row.city, render: (row) => row.city || "—" },
    { id: "state", label: "State", width: 80, value: (row) => row.state, render: (row) => row.state || "—" },
    {
      id: "type",
      label: "Type",
      width: 130,
      value: (row) => row.propertyType,
      render: (row) => <span className="tone tone-neutral">{propertyTypeLabel(row.propertyType)}</span>,
    },
    { id: "owner", label: "Owner", width: 180, value: (row) => row.ownerName, render: (row) => row.ownerName || "—" },
    {
      id: "squareFeet",
      label: "Sq Ft",
      width: 100,
      value: (row) => row.squareFeet ?? -1,
      render: (row) => formatSquareFeet(row.squareFeet) || "—",
    },
  ];

  const toolbar = (
    <>
      <input
        type="search"
        className="maintenance-search"
        value={search}
        placeholder="Search name, address or owner"
        aria-label="Search properties"
        onChange={(event) => setSearch(event.target.value)}
      />
      {TYPE_FILTERS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={`secondary-button compact-button ${typeFilter === entry.id ? "department-toggle-active" : ""}`}
          onClick={() => setTypeFilter(entry.id)}
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
          <h1>Properties</h1>
          <p>Buildings and addresses the department pre-plans and inspects.</p>
        </div>
        <div className="header-actions">
          <div className="properties-view-toggle" role="group" aria-label="List or map">
            <button
              type="button"
              className={`secondary-button compact-button maintenance-icon-button ${view === "list" ? "department-toggle-active" : ""}`}
              onClick={() => go({})}
            >
              <List size={14} aria-hidden="true" /> List
            </button>
            <button
              type="button"
              className={`secondary-button compact-button maintenance-icon-button ${view === "map" ? "department-toggle-active" : ""}`}
              onClick={() => go({ view: "map" })}
            >
              <MapIcon size={14} aria-hidden="true" /> Map
            </button>
          </div>
          {canManage ? (
            <button type="button" className="primary-button maintenance-icon-button" onClick={() => go({ new: "1" })}>
              <Plus size={15} aria-hidden="true" /> Add Property
            </button>
          ) : null}
        </div>
      </header>
      {error ? <p className="field-error">{error}</p> : null}
      <article className="panel">
        {loading ? (
          <p className="field-hint">Loading...</p>
        ) : view === "map" ? (
          <>
            <div className="module-table-toolbar">
              <div className="module-table-toolbar-start">{toolbar}</div>
            </div>
            <PropertiesMap rows={filtered} onOpen={(row) => go({ property: row.id })} />
          </>
        ) : (
          <ModuleTable
            tableId="prevention-properties"
            toolbarStart={toolbar}
            columns={columns}
            rows={filtered}
            rowKey={(row) => row.id}
            onRowClick={(row) => go({ property: row.id })}
            emptyText={rows.length === 0 ? "No properties added yet." : "No properties match this search."}
            defaultSort={{ id: "address", direction: "asc" }}
          />
        )}
      </article>
    </section>
  );
}
