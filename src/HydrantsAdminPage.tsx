import { type FormEvent, useState } from "react";
import { HYDRANT_ADMIN_TABLE_ROWS } from "./appData";

export function HydrantsAdminPage() {
  const [fileName, setFileName] = useState("No file selected");
  const [statusMessage, setStatusMessage] = useState("");

  const handleUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("CSV upload staged in prototype mode. Parsing comes next.");
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Admin Functions | Hydrants</h1>
          <p>
            Mass upload hydrants via CSV and maintain hydrant placement manually on the
            map.
          </p>
        </div>
      </header>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>CSV Upload</h2>
          </div>
          <form className="settings-form" onSubmit={handleUpload}>
            <label htmlFor="hydrant-upload">Hydrant CSV File</label>
            <input
              id="hydrant-upload"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) =>
                setFileName(event.target.files?.[0]?.name ?? "No file selected")
              }
            />
            <p className="field-hint">Selected file: {fileName}</p>
            <button type="submit" className="primary-button">
              Upload CSV
            </button>
            {statusMessage ? <p className="save-message">{statusMessage}</p> : null}
          </form>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Hydrant Map Editing</h2>
          </div>
          <div className="dispatch-map-placeholder">
            <p>
              Hydrant map editor placeholder. This screen will support manual pin
              placement and hydrant attribute editing.
            </p>
            <ul>
              <li>Drag hydrant markers to adjust map location</li>
              <li>Update flow rate, status, and service notes</li>
              <li>Sync map marker overlays for incident response</li>
            </ul>
          </div>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Hydrant Records</h2>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Hydrant ID</th>
                  <th>Status</th>
                  <th>Zone</th>
                  <th>Last Inspection</th>
                  <th>Flow Rate</th>
                </tr>
              </thead>
              <tbody>
                {HYDRANT_ADMIN_TABLE_ROWS.map((row) => (
                  <tr key={row.hydrantId}>
                    <td>{row.hydrantId}</td>
                    <td>{row.status}</td>
                    <td>{row.zone}</td>
                    <td>{row.lastInspection}</td>
                    <td>{row.flowRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </section>
  );
}
