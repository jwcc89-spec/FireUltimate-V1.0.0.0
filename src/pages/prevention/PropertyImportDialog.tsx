import { useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { importProperties, type ImportResult } from "../../api/prevention";
import { useDialogSave } from "../maintenance/useDialogSave";
import { rowsFromCsv, templateCsv } from "./propertyCsv";

const MAX_ROWS = 1000;

function downloadTemplate() {
  const blob = new Blob([templateCsv()], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "properties-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

/** Import properties from a CSV: download the template, pick a file, preview every row, then save. */
export function PropertyImportDialog({ onClose, onImported }: { onClose: () => void; onImported: (created: number) => void }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [fileError, setFileError] = useState("");
  const { saving, error, run } = useDialogSave();

  const check = (nextRows: Record<string, string>[]) =>
    void run(async () => {
      setPreview(await importProperties(nextRows, false, true));
    }, "Could not check the file.");

  const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreview(null);
    setFileName(file.name);
    const parsed = rowsFromCsv(await file.text());
    setUnknownHeaders(parsed.unknownHeaders);
    if (parsed.rows.length === 0) {
      setRows([]);
      setFileError("No rows were found. The first row must be the column headers.");
      return;
    }
    if (parsed.rows.length > MAX_ROWS) {
      setRows([]);
      setFileError(`This file has ${parsed.rows.length} rows. Import at most ${MAX_ROWS} at a time.`);
      return;
    }
    setFileError("");
    setRows(parsed.rows);
    check(parsed.rows);
  };

  const commit = () =>
    void run(async () => {
      const result = await importProperties(rows, true, skipDuplicates);
      onImported(result.created);
    }, "Could not import the properties.");

  const errors = preview?.rows.filter((row) => !row.ok).length ?? 0;
  const duplicates = preview?.rows.filter((row) => row.ok && row.duplicate).length ?? 0;
  const ready = preview ? preview.rows.filter((row) => row.ok && (!skipDuplicates || !row.duplicate)).length : 0;

  return (
    <div className="schedule-notice-backdrop" role="dialog" aria-modal="true" aria-label="Import properties">
      <div className="schedule-notice maintenance-dialog property-import-dialog">
        <h3>Import Properties</h3>
        <p className="field-hint">
          Download the template, fill in one property per row (only Address is required), save it as CSV, then choose the file. Owner
          columns add a primary Owner contact.
        </p>
        <div className="header-actions">
          <button type="button" className="secondary-button compact-button maintenance-icon-button" onClick={downloadTemplate}>
            <Download size={14} aria-hidden="true" /> Download Template
          </button>
          <label className="secondary-button compact-button maintenance-icon-button property-import-file">
            <Upload size={14} aria-hidden="true" /> {fileName ? "Choose Another File" : "Choose CSV File"}
            <input type="file" accept=".csv,text/csv" onChange={(event) => void pickFile(event)} />
          </label>
          {fileName ? <span className="field-hint">{fileName}</span> : null}
        </div>
        {fileError ? <p className="field-error">{fileError}</p> : null}
        {unknownHeaders.length > 0 ? (
          <p className="field-hint">These columns were not recognized and will be skipped: {unknownHeaders.join(", ")}.</p>
        ) : null}

        {preview ? (
          <>
            <div className="property-tags">
              <span className="tone tone-neutral">{preview.rows.length} rows</span>
              <span className="tone tone-neutral">{ready} ready to add</span>
              {duplicates > 0 ? <span className="tone tone-warning">{duplicates} already exist</span> : null}
              {errors > 0 ? <span className="tone tone-critical">{errors} with errors</span> : null}
            </div>
            <label className="property-import-skip">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(event) => setSkipDuplicates(event.target.checked)}
              />
              Skip addresses that already exist (recommended)
            </label>
            <div className="property-import-preview">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Address</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.index} className={row.ok ? "" : "property-import-error"}>
                      <td>{row.index + 2}</td>
                      <td>{row.address || "—"}</td>
                      <td>
                        {!row.ok
                          ? row.error
                          : row.duplicate === "existing"
                            ? skipDuplicates
                              ? "Already exists, skipped"
                              : "Already exists, will be added again"
                            : row.duplicate === "file"
                              ? skipDuplicates
                                ? "Repeated in this file, skipped"
                                : "Repeated in this file, will be added again"
                              : "Ready"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="field-hint">Rows with errors are never imported. Row numbers match the spreadsheet (row 1 is the headers).</p>
          </>
        ) : null}

        {error ? <p className="field-error">{error}</p> : null}
        <div className="header-actions">
          <button type="button" className="primary-button compact-button" disabled={saving || !preview || ready === 0} onClick={commit}>
            {saving ? "Working..." : `Import ${ready} ${ready === 1 ? "Property" : "Properties"}`}
          </button>
          <button type="button" className="secondary-button compact-button" disabled={saving} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
