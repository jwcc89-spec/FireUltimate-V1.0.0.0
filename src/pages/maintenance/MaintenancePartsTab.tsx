import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, DollarSign, Package, PackagePlus, Plus } from "lucide-react";
import {
  changePartStock,
  createPart,
  deletePart,
  getPartTransactions,
  updatePart,
  type MaintenanceRecordSummary,
  type Part,
  type PartInput,
  type PartTransaction,
  type Vendor,
} from "../../api/maintenance";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { EditDialog } from "./MaintenanceSetupTabs";
import { assetsText, errorText, formatMoney, formatTimestamp24, partLabel, todayKey } from "./maintenanceUtils";
import { useDialogSave } from "./useDialogSave";

const EMPTY_PART: PartInput = { partNumber: "", description: "", vendorId: "", unitCost: 0, reorderLevel: 0, storageLocation: "" };

type Period = "month" | "year" | "all";

function isLow(part: Part): boolean {
  return part.reorderLevel > 0 && part.onHand <= part.reorderLevel;
}

function PartFields({
  draft,
  vendors,
  onChange,
  disabled,
}: {
  draft: PartInput;
  vendors: Vendor[];
  onChange: (next: PartInput) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <label>
        Part Number
        <input type="text" value={draft.partNumber} onChange={(event) => onChange({ ...draft, partNumber: event.target.value })} />
      </label>
      <label>
        Description
        <input type="text" value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} />
      </label>
      <label>
        Vendor
        <NerisFlatSingleOptionSelect
          inputId="part-vendor"
          usePortal
          allowClear
          disabled={disabled}
          value={draft.vendorId}
          options={vendors.map((vendor) => ({ value: vendor.id, label: vendor.name }))}
          placeholder="Select vendor..."
          onChange={(value) => onChange({ ...draft, vendorId: value })}
        />
      </label>
      <label>
        Unit Cost
        <input
          type="number"
          min={0}
          step="0.01"
          value={draft.unitCost || ""}
          onChange={(event) => onChange({ ...draft, unitCost: Number(event.target.value) || 0 })}
        />
      </label>
      <label>
        Reorder At (quantity)
        <input
          type="number"
          min={0}
          step={1}
          value={draft.reorderLevel || ""}
          onChange={(event) => onChange({ ...draft, reorderLevel: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
        />
      </label>
      <label>
        Storage Location
        <input
          type="text"
          placeholder="Station, shelf or bin"
          value={draft.storageLocation}
          onChange={(event) => onChange({ ...draft, storageLocation: event.target.value })}
        />
      </label>
    </>
  );
}

/** Add Part popup, also opened from a ticket's part search when nothing matches. */
export function AddPartDialog({
  initialText,
  vendors,
  onCancel,
  onSaved,
}: {
  initialText: string;
  vendors: Vendor[];
  onCancel: () => void;
  onSaved: (part: Part) => void;
}) {
  const [draft, setDraft] = useState<PartInput>({ ...EMPTY_PART, partNumber: initialText });
  const dialog = useDialogSave();
  const save = async () => {
    let created: Part | null = null;
    const ok = await dialog.run(async () => {
      created = await createPart(draft);
    }, "Could not save the part.");
    if (ok && created) onSaved(created);
  };
  return (
    <EditDialog title="Add Part" error={dialog.error} saving={dialog.saving} onSave={() => void save()} onCancel={onCancel}>
      <PartFields draft={draft} vendors={vendors} onChange={setDraft} />
    </EditDialog>
  );
}

export function MaintenancePartsTab({
  parts,
  vendors,
  records,
  assetLabel,
  canManage,
  canSubmit,
  onChanged,
  onOpenRecord,
}: {
  parts: Part[];
  vendors: Vendor[];
  records: MaintenanceRecordSummary[];
  assetLabel: string;
  canManage: boolean;
  canSubmit: boolean;
  onChanged: () => void;
  onOpenRecord: (recordId: string) => void;
}) {
  const [draft, setDraft] = useState<(PartInput & { id: string | null }) | null>(null);
  const [stockFor, setStockFor] = useState<{ part: Part; kind: "received" | "adjusted"; quantity: string; unitCost: string; note: string } | null>(
    null,
  );
  const [transactions, setTransactions] = useState<PartTransaction[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [lowOnly, setLowOnly] = useState(false);
  const dialog = useDialogSave();

  useEffect(() => {
    let active = true;
    getPartTransactions()
      .then((rows) => {
        if (active) setTransactions(rows);
      })
      .catch((loadError) => {
        if (active) setHistoryError(errorText(loadError, "Could not load part history."));
      });
    return () => {
      active = false;
    };
  }, [parts]);

  const lowParts = parts.filter(isLow);
  const inventoryValue = parts.reduce((sum, part) => sum + Math.max(0, part.onHand) * part.unitCost, 0);
  const today = todayKey();

  const analytics = useMemo(() => {
    const inPeriod = (iso: string) =>
      period === "all" ? true : period === "year" ? iso.slice(0, 4) === today.slice(0, 4) : iso.slice(0, 7) === today.slice(0, 7);
    const partById = new Map(parts.map((part) => [part.id, part]));
    const vendorName = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
    const recordById = new Map(records.map((record) => [record.id, record]));
    const byMonth = new Map<string, { purchased: number; used: number }>();
    const byVendor = new Map<string, number>();
    const byAsset = new Map<string, number>();
    let purchased = 0;
    let used = 0;
    for (const row of transactions) {
      const amount = Math.abs(row.quantity) * row.unitCost;
      const month = row.createdAt.slice(0, 7);
      const monthEntry = byMonth.get(month) ?? { purchased: 0, used: 0 };
      if (row.kind === "received") monthEntry.purchased += amount;
      if (row.kind === "used") monthEntry.used += amount;
      byMonth.set(month, monthEntry);
      if (!inPeriod(row.createdAt)) continue;
      if (row.kind === "received") {
        purchased += amount;
        const name = vendorName.get(partById.get(row.partId)?.vendorId ?? "") || "No vendor";
        byVendor.set(name, (byVendor.get(name) ?? 0) + amount);
      } else if (row.kind === "used") {
        used += amount;
        const record = recordById.get(row.recordId);
        const name = record ? assetsText(record) || "Not linked" : "Other module";
        byAsset.set(name, (byAsset.get(name) ?? 0) + amount);
      }
    }
    const sortDesc = (map: Map<string, number>) => Array.from(map).sort((a, b) => b[1] - a[1]);
    return {
      purchased,
      used,
      months: Array.from(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12),
      vendors: sortDesc(byVendor),
      assets: sortDesc(byAsset),
    };
  }, [parts, period, records, today, transactions, vendors]);

  const columns: ModuleTableColumn<Part>[] = [
    { id: "partNumber", label: "Part #", width: 110, value: (row) => row.partNumber, render: (row) => <strong>{row.partNumber || "—"}</strong> },
    { id: "description", label: "Description", width: 220, value: (row) => row.description, render: (row) => row.description || "—" },
    { id: "vendor", label: "Vendor", width: 150, value: (row) => row.vendorName, render: (row) => row.vendorName || "—" },
    { id: "location", label: "Location", width: 130, value: (row) => row.storageLocation, render: (row) => row.storageLocation || "—" },
    {
      id: "onHand",
      label: "On Hand",
      width: 90,
      value: (row) => row.onHand,
      render: (row) => <span className={isLow(row) ? "tone tone-critical" : undefined}>{row.onHand}</span>,
    },
    { id: "reorder", label: "Reorder At", width: 90, value: (row) => row.reorderLevel, render: (row) => row.reorderLevel || "—" },
    { id: "unitCost", label: "Unit Cost", width: 90, value: (row) => row.unitCost, render: (row) => formatMoney(row.unitCost) },
    {
      id: "status",
      label: "Status",
      width: 100,
      value: (row) => (isLow(row) ? 0 : 1),
      render: (row) =>
        isLow(row) ? <span className="tone tone-critical">Reorder</span> : <span className="tone tone-positive">In Stock</span>,
    },
    {
      id: "actions",
      label: "",
      width: 120,
      render: (row) =>
        canManage ? (
          <span onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="secondary-button compact-button maintenance-icon-button"
              onClick={() => {
                dialog.setError("");
                setStockFor({ part: row, kind: "received", quantity: "", unitCost: String(row.unitCost || ""), note: "" });
              }}
            >
              <PackagePlus size={13} aria-hidden="true" /> Receive
            </button>
          </span>
        ) : null,
    },
  ];

  const saveDraft = async () => {
    if (!draft) return;
    const { id, ...input } = draft;
    const ok = await dialog.run(async () => {
      if (id) await updatePart(id, input);
      else await createPart(input);
    }, "Could not save the part.");
    if (ok) {
      setDraft(null);
      onChanged();
    }
  };

  const removeDraft = async () => {
    if (!draft?.id) return;
    const id = draft.id;
    const ok = await dialog.run(() => deletePart(id), "Could not delete the part.");
    if (ok) {
      setDraft(null);
      onChanged();
    }
  };

  const saveStock = async () => {
    if (!stockFor) return;
    const quantity = Math.round(Number(stockFor.quantity));
    const ok = await dialog.run(async () => {
      if (!quantity) throw new Error("Enter a quantity.");
      await changePartStock(stockFor.part.id, {
        kind: stockFor.kind,
        quantity,
        unitCost: stockFor.kind === "received" && stockFor.unitCost !== "" ? Number(stockFor.unitCost) : undefined,
        note: stockFor.note,
      });
    }, "Could not update stock.");
    if (ok) {
      setStockFor(null);
      onChanged();
    }
  };

  const partHistory = stockFor ? transactions.filter((row) => row.partId === stockFor.part.id).slice(0, 8) : [];
  const recordNumber = new Map(records.map((record) => [record.id, record.recordNumber]));
  const periodLabel = period === "month" ? "This Month" : period === "year" ? "This Year" : "All Time";

  return (
    <section className="page-section">
      <div className="stat-grid">
        <article className="stat-card">
          <p>
            <Package size={14} aria-hidden="true" /> Parts Tracked
          </p>
          <strong>{parts.length}</strong>
        </article>
        <button type="button" className="stat-card maintenance-cost-summary" onClick={() => setLowOnly((value) => !value)}>
          <p>
            <AlertTriangle size={14} aria-hidden="true" /> Reorder Alerts
          </p>
          <strong className={lowParts.length > 0 ? "maintenance-critical-text" : undefined}>{lowParts.length}</strong>
          <p>{lowOnly ? "Showing reorder only · show all" : "Show only these →"}</p>
        </button>
        <article className="stat-card">
          <p>
            <DollarSign size={14} aria-hidden="true" /> Inventory Value
          </p>
          <strong>{formatMoney(inventoryValue)}</strong>
        </article>
      </div>

      <div className="department-editor-toolbar">
        <p className="field-hint">Using a part on a maintenance ticket takes it out of stock. Receiving stock adds to it.</p>
        {canSubmit ? (
          <button
            type="button"
            className="primary-button compact-button maintenance-icon-button"
            onClick={() => {
              dialog.setError("");
              setDraft({ id: null, ...EMPTY_PART });
            }}
          >
            <Plus size={14} aria-hidden="true" /> Add Part
          </button>
        ) : null}
      </div>

      <article className="panel">
        <h3>Inventory</h3>
        <ModuleTable
          tableId="maintenance-parts"
          columns={columns}
          rows={lowOnly ? lowParts : parts}
          rowKey={(row) => row.id}
          emptyText={lowOnly ? "No parts below their reorder level." : "No parts yet. Click Add Part, or add one from a ticket's Parts tab."}
          defaultSort={{ id: "partNumber", direction: "asc" }}
          onRowClick={(row) => {
            dialog.setError("");
            setDraft({
              id: row.id,
              partNumber: row.partNumber,
              description: row.description,
              vendorId: row.vendorId,
              unitCost: row.unitCost,
              reorderLevel: row.reorderLevel,
              storageLocation: row.storageLocation,
            });
          }}
        />
      </article>

      <article className="panel">
        <div className="panel-header">
          <h3>Parts Spend · {periodLabel}</h3>
          <div className="department-editor-toolbar-actions">
            {(["month", "year", "all"] as Period[]).map((value) => (
              <button
                key={value}
                type="button"
                className={`secondary-button compact-button ${period === value ? "department-toggle-active" : ""}`}
                onClick={() => setPeriod(value)}
              >
                {value === "month" ? "This Month" : value === "year" ? "This Year" : "All Time"}
              </button>
            ))}
          </div>
        </div>
        {historyError ? <p className="field-error">{historyError}</p> : null}
        <p className="field-hint">
          Purchased {formatMoney(analytics.purchased)} (stock received) · Used {formatMoney(analytics.used)} (parts put on tickets)
        </p>
        <section className="parts-spend-grid">
          <div>
            <h4>By Month (last 12)</h4>
            <table className="module-table-grid">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Purchased</th>
                  <th>Used</th>
                </tr>
              </thead>
              <tbody>
                {analytics.months.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No stock movement yet.</td>
                  </tr>
                ) : (
                  analytics.months.map(([month, entry]) => (
                    <tr key={month}>
                      <td>{`${month.slice(5)}/${month.slice(0, 4)}`}</td>
                      <td>{formatMoney(entry.purchased)}</td>
                      <td>{formatMoney(entry.used)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div>
            <h4>Purchased by Vendor</h4>
            <table className="module-table-grid">
              <tbody>
                {analytics.vendors.length === 0 ? (
                  <tr>
                    <td>Nothing received in this period.</td>
                  </tr>
                ) : (
                  analytics.vendors.map(([name, amount]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{formatMoney(amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div>
            <h4>Used by {assetLabel}</h4>
            <table className="module-table-grid">
              <tbody>
                {analytics.assets.length === 0 ? (
                  <tr>
                    <td>No parts used in this period.</td>
                  </tr>
                ) : (
                  analytics.assets.map(([name, amount]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{formatMoney(amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </article>

      {draft ? (
        <EditDialog
          title={draft.id ? (canManage ? "Edit Part" : "Part") : "Add Part"}
          error={dialog.error}
          saving={dialog.saving}
          readOnly={Boolean(draft.id) && !canManage}
          onSave={() => void saveDraft()}
          onCancel={() => setDraft(null)}
          onDelete={draft.id ? () => void removeDraft() : undefined}
        >
          <PartFields draft={draft} vendors={vendors} disabled={Boolean(draft.id) && !canManage} onChange={(next) => setDraft({ ...draft, ...next })} />
        </EditDialog>
      ) : null}

      {stockFor ? (
        <EditDialog
          title={`${stockFor.kind === "received" ? "Receive Stock" : "Adjust Stock"}: ${partLabel(stockFor.part)}`}
          error={dialog.error}
          saving={dialog.saving}
          onSave={() => void saveStock()}
          onCancel={() => setStockFor(null)}
        >
          <div className="maintenance-field maintenance-span-2">
            <span className="maintenance-field-label">On hand now: {stockFor.part.onHand}</span>
            <div className="department-editor-toolbar-actions">
              {(["received", "adjusted"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={`secondary-button compact-button ${stockFor.kind === kind ? "department-toggle-active" : ""}`}
                  onClick={() => setStockFor({ ...stockFor, kind })}
                >
                  {kind === "received" ? "Receive" : "Adjust (count correction)"}
                </button>
              ))}
            </div>
          </div>
          <label>
            {stockFor.kind === "received" ? "Quantity Received" : "Change (+ or -)"}
            <input
              type="number"
              step={1}
              min={stockFor.kind === "received" ? 1 : undefined}
              value={stockFor.quantity}
              onChange={(event) => setStockFor({ ...stockFor, quantity: event.target.value })}
            />
          </label>
          {stockFor.kind === "received" ? (
            <label>
              Unit Cost
              <input
                type="number"
                min={0}
                step="0.01"
                value={stockFor.unitCost}
                onChange={(event) => setStockFor({ ...stockFor, unitCost: event.target.value })}
              />
            </label>
          ) : (
            <div />
          )}
          <label className="maintenance-span-2">
            Note
            <input
              type="text"
              placeholder="PO number, invoice or reason"
              value={stockFor.note}
              onChange={(event) => setStockFor({ ...stockFor, note: event.target.value })}
            />
          </label>
          {partHistory.length > 0 ? (
            <div className="maintenance-span-2">
              <span className="maintenance-field-label">Recent history</span>
              <ul className="list-card">
                {partHistory.map((row) => (
                  <li key={row.id}>
                    <span>
                      {row.kind === "received" ? "Received" : row.kind === "used" ? "Used" : "Adjusted"} {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                      {row.recordId ? (
                        <>
                          {" on "}
                          <button type="button" className="edit-display-link" onClick={() => onOpenRecord(row.recordId)}>
                            {recordNumber.get(row.recordId) ?? "a ticket"}
                          </button>
                        </>
                      ) : null}
                      {row.note ? ` · ${row.note}` : ""}
                    </span>
                    <span className="field-hint">{formatTimestamp24(row.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </EditDialog>
      ) : null}
    </section>
  );
}
