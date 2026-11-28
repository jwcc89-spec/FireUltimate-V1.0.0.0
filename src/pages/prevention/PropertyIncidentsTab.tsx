import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPropertyIncidents, type PropertyCallHistory, type PropertyIncident } from "../../api/prevention";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { errorText, formatTimestamp24 } from "../maintenance/maintenanceUtils";

function receivedText(row: PropertyIncident): string {
  return formatTimestamp24(row.receivedAt) || row.receivedAt || formatTimestamp24(row.createdAt);
}

/** Call history for a property: every incident whose cleaned address matches, newest first. */
export function PropertyIncidentsTab({ propertyId }: { propertyId: string }) {
  const navigate = useNavigate();
  const [history, setHistory] = useState<PropertyCallHistory | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getPropertyIncidents(propertyId)
      .then((next) => {
        if (active) setHistory(next);
      })
      .catch((loadError) => {
        if (active) setError(errorText(loadError, "Could not load call history."));
      });
    return () => {
      active = false;
    };
  }, [propertyId]);

  if (error) return <p className="field-error">{error}</p>;
  if (!history) return <p className="field-hint">Loading...</p>;

  const columns: ModuleTableColumn<PropertyIncident>[] = [
    {
      id: "received",
      label: "Received",
      width: 150,
      value: (row) => row.receivedAt || row.createdAt,
      render: (row) => receivedText(row) || "—",
    },
    {
      id: "number",
      label: "Incident #",
      width: 140,
      value: (row) => row.incidentNumber || row.dispatchNumber,
      render: (row) => row.incidentNumber || row.dispatchNumber || "—",
    },
    { id: "type", label: "Type", width: 200, value: (row) => row.incidentType, render: (row) => row.incidentType || "—" },
    { id: "address", label: "Address", width: 260, value: (row) => row.address, render: (row) => row.address || "—" },
    { id: "status", label: "Status", width: 120, value: (row) => row.currentState, render: (row) => row.currentState || "—" },
  ];

  return (
    <div className="property-incidents">
      {history.countsByType.length > 0 ? (
        <div className="property-incident-counts">
          <span className="tone tone-neutral">
            <strong>{history.incidents.length}</strong> total
          </span>
          {history.countsByType.map((entry) => (
            <span key={entry.type} className="tone tone-neutral">
              {entry.type}: <strong>{entry.count}</strong>
            </span>
          ))}
        </div>
      ) : null}
      <ModuleTable
        tableId="prevention-property-incidents"
        columns={columns}
        rows={history.incidents}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/incidents-mapping/incidents/${encodeURIComponent(row.id)}`)}
        emptyText="No calls found at this address."
        defaultSort={{ id: "received", direction: "desc" }}
      />
    </div>
  );
}
