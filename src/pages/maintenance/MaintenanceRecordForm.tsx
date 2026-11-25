import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import {
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_STATUSES,
  addMaintenanceComment,
  createMaintenanceRecord,
  deleteMaintenanceRecord,
  getMaintenanceRecord,
  updateMaintenanceRecord,
  type MaintenanceAssetKind,
  type MaintenanceComment,
  type MaintenanceRecordInput,
  type MaintenanceType,
  type Vendor,
} from "../../api/maintenance";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import type { NerisValueOption } from "../../nerisMetadata";
import {
  errorText,
  formatMoney,
  formatTimestamp24,
  isOpenStatus,
  readFileAsDataUrl,
  toOptions,
} from "./maintenanceUtils";

const MAX_ATTACHMENT_BYTES = 1_500_000;

interface MaintenanceRecordFormProps {
  recordId: string | null;
  assetKind: MaintenanceAssetKind;
  username: string;
  canManage: boolean;
  types: MaintenanceType[];
  vendors: Vendor[];
  assetOptions: NerisValueOption[];
  stations: string[];
  personnel: string[];
  onClose: (changed: boolean) => void;
}

function emptyInput(assetKind: MaintenanceAssetKind): MaintenanceRecordInput {
  return {
    assetKind,
    assets: [],
    typeId: "",
    description: "",
    status: "Open",
    priority: "Medium",
    dueDate: "",
    completedDate: "",
    performedByKind: "personnel",
    performedByName: "",
    vendorId: "",
    outOfService: false,
    location: "",
    locationDetails: "",
    costs: [],
    attachments: [],
  };
}

type FormTab = "details" | "costs" | "attachments";

export function MaintenanceRecordForm({
  recordId,
  assetKind,
  username,
  canManage,
  types,
  vendors,
  assetOptions,
  stations,
  personnel,
  onClose,
}: MaintenanceRecordFormProps) {
  const [form, setForm] = useState<MaintenanceRecordInput>(() => emptyInput(assetKind));
  const [currentId, setCurrentId] = useState<string | null>(recordId);
  const [recordNumber, setRecordNumber] = useState("");
  const [createdBy, setCreatedBy] = useState(username);
  const [savedStatus, setSavedStatus] = useState("Open");
  const [comments, setComments] = useState<MaintenanceComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [assetToAdd, setAssetToAdd] = useState("");
  const [tab, setTab] = useState<FormTab>("details");
  const [loading, setLoading] = useState(Boolean(recordId));
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!recordId) return;
    let active = true;
    getMaintenanceRecord(recordId)
      .then((record) => {
        if (!active) return;
        setForm({
          assetKind: record.assetKind,
          assets: record.assets,
          typeId: record.typeId,
          description: record.description,
          status: record.status,
          priority: record.priority,
          dueDate: record.dueDate,
          completedDate: record.completedDate,
          performedByKind: record.performedByKind,
          performedByName: record.performedByName,
          vendorId: record.vendorId,
          outOfService: record.outOfService,
          location: record.location,
          locationDetails: record.locationDetails,
          costs: record.costs,
          attachments: record.attachments,
        });
        setRecordNumber(record.recordNumber);
        setCreatedBy(record.createdBy);
        setSavedStatus(record.status);
        setComments(record.comments);
      })
      .catch((loadError) => {
        if (active) setError(errorText(loadError, "Could not load the record."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [recordId]);

  const isNew = !currentId;
  const canEdit = canManage || isNew || (createdBy === username && isOpenStatus(savedStatus));

  const typeOptions = useMemo(
    () =>
      types
        .filter((type) => type.enabled || type.id === form.typeId)
        .map((type) => ({ value: type.id, label: type.name })),
    [form.typeId, types],
  );
  const vendorOptions = useMemo(
    () => vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
    [vendors],
  );
  const performedByOptions = useMemo(() => {
    const names = new Set(personnel);
    if (form.performedByName) names.add(form.performedByName);
    return toOptions(Array.from(names));
  }, [form.performedByName, personnel]);
  const stationOptions = useMemo(() => toOptions(stations), [stations]);
  const availableAssets = useMemo(
    () => assetOptions.filter((option) => !form.assets.some((asset) => asset.ref === option.value)),
    [assetOptions, form.assets],
  );
  const costTotal = form.costs.reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0);

  const update = <K extends keyof MaintenanceRecordInput>(key: K, value: MaintenanceRecordInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setNotice("");
  };

  const addAsset = () => {
    const option = assetOptions.find((entry) => entry.value === assetToAdd);
    if (!option) return;
    update("assets", [...form.assets, { kind: assetKind, ref: option.value, label: option.label }]);
    setAssetToAdd("");
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const added = [];
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${file.name} is larger than 1.5 MB. Larger files will work once file storage is added.`);
        continue;
      }
      added.push({ name: file.name, type: file.type, size: file.size, dataUrl: await readFileAsDataUrl(file) });
    }
    if (added.length > 0) update("attachments", [...form.attachments, ...added]);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        ...form,
        costs: form.costs.map((cost) => ({ ...cost, amount: Number(cost.amount) || 0 })),
      };
      const saved = currentId
        ? await updateMaintenanceRecord(currentId, payload)
        : await createMaintenanceRecord(payload);
      setCurrentId(saved.id);
      setRecordNumber(saved.recordNumber);
      setCreatedBy(saved.createdBy);
      setSavedStatus(saved.status);
      setComments(saved.comments);
      setForm((previous) => ({ ...previous, attachments: saved.attachments, costs: saved.costs }));
      setChanged(true);
      setNotice(`Saved ${saved.recordNumber}.`);
    } catch (saveError) {
      setError(errorText(saveError, "Could not save the record."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!currentId) return;
    setSaving(true);
    try {
      await deleteMaintenanceRecord(currentId);
      onClose(true);
    } catch (deleteError) {
      setError(errorText(deleteError, "Could not delete the record."));
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const postComment = async () => {
    if (!currentId || !commentDraft.trim()) return;
    try {
      const comment = await addMaintenanceComment(currentId, commentDraft);
      setComments((previous) => [...previous, comment]);
      setCommentDraft("");
    } catch (commentError) {
      setError(errorText(commentError, "Could not save the comment."));
    }
  };

  if (loading) {
    return <p className="field-hint">Loading record...</p>;
  }

  const statusOptions = MAINTENANCE_STATUSES.map((status) => ({ value: status, label: status }));

  return (
    <section className="page-section">
      <div className="maintenance-breadcrumb">
        <button type="button" className="edit-display-link" onClick={() => onClose(changed)}>
          Maintenance
        </button>
        <span>&gt; {isNew ? "New" : recordNumber}</span>
      </div>
      <div className="header-actions">
        {canEdit ? (
          <button type="button" className="primary-button compact-button" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving..." : "Save"}
          </button>
        ) : null}
        <button type="button" className="secondary-button compact-button" onClick={() => onClose(changed)}>
          {canEdit ? "Cancel" : "Back"}
        </button>
        {canManage && !isNew ? (
          <button type="button" className="secondary-button compact-button" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        ) : null}
      </div>
      {!canEdit ? (
        <p className="field-hint">
          Only people who manage maintenance can change this record. You can still add a comment.
        </p>
      ) : null}
      {error ? <p className="field-error">{error}</p> : null}
      {notice ? <p className="cad-dispatch-save-ok" role="status">{notice}</p> : null}

      <div className="department-editor-toolbar-actions">
        {(["details", "costs", "attachments"] as FormTab[]).map((value) => (
          <button
            key={value}
            type="button"
            className={`secondary-button compact-button ${tab === value ? "department-toggle-active" : ""}`}
            onClick={() => setTab(value)}
          >
            {value === "details" ? "Details" : value === "costs" ? `Costs (${form.costs.length})` : `Attachments (${form.attachments.length})`}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        <>
          <section className="panel-grid two-column">
            <article className="panel">
              <h3>General Information</h3>
              <fieldset className="maintenance-fieldset" disabled={!canEdit}>
                <div className="department-edit-grid">
                  <label>
                    Category
                    <NerisFlatSingleOptionSelect
                      inputId="maintenance-category"
                      usePortal
                      value={form.typeId}
                      options={typeOptions}
                      onChange={(value) => update("typeId", value)}
                      placeholder="Select category..."
                      allowClear
                      disabled={!canEdit}
                    />
                  </label>
                  <label>
                    Status
                    <NerisFlatSingleOptionSelect
                      inputId="maintenance-status"
                      usePortal
                      value={form.status}
                      options={statusOptions}
                      onChange={(value) => update("status", value || "Open")}
                      isOptionDisabled={(value) => !canManage && !isOpenStatus(value)}
                      disabled={!canEdit}
                    />
                  </label>
                  <label>
                    Priority
                    <NerisFlatSingleOptionSelect
                      inputId="maintenance-priority"
                      usePortal
                      value={form.priority}
                      options={toOptions(MAINTENANCE_PRIORITIES)}
                      onChange={(value) => update("priority", value || "Medium")}
                      disabled={!canEdit}
                    />
                  </label>
                  <label className="maintenance-checkbox-label">
                    <span>Out of Service</span>
                    <span className="maintenance-checkbox-row">
                      <input
                        type="checkbox"
                        checked={form.outOfService}
                        onChange={(event) => update("outOfService", event.target.checked)}
                      />
                      Take the asset out of service while this record is open
                    </span>
                  </label>
                  <label>
                    Completed Date
                    <input
                      type="date"
                      value={form.completedDate}
                      onChange={(event) => update("completedDate", event.target.value)}
                    />
                  </label>
                  <label>
                    Due Date
                    <input type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} />
                  </label>
                  <label>
                    Location
                    <NerisFlatSingleOptionSelect
                      inputId="maintenance-location"
                      usePortal
                      value={form.location}
                      options={stationOptions}
                      onChange={(value) => update("location", value)}
                      placeholder="No station"
                      allowClear
                      disabled={!canEdit}
                    />
                  </label>
                  <label>
                    Location Details
                    <input
                      type="text"
                      placeholder="Bay, room or address"
                      value={form.locationDetails}
                      onChange={(event) => update("locationDetails", event.target.value)}
                    />
                  </label>
                  <div className="maintenance-field">
                    <span className="maintenance-field-label">Performed By Type</span>
                    <div className="department-editor-toolbar-actions">
                      {(["personnel", "vendor"] as const).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          className={`secondary-button compact-button ${form.performedByKind === kind ? "department-toggle-active" : ""}`}
                          onClick={() => update("performedByKind", kind)}
                        >
                          {kind === "personnel" ? "Personnel" : "Vendor"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label>
                    Performed By
                    {form.performedByKind === "vendor" ? (
                      <NerisFlatSingleOptionSelect
                        inputId="maintenance-vendor"
                        usePortal
                        value={form.vendorId}
                        options={vendorOptions}
                        onChange={(value) => update("vendorId", value)}
                        placeholder={vendorOptions.length ? "Select vendor..." : "Add vendors in the Vendors tab"}
                        allowClear
                        disabled={!canEdit}
                      />
                    ) : (
                      <NerisFlatSingleOptionSelect
                        inputId="maintenance-performed-by"
                        usePortal
                        value={form.performedByName}
                        options={performedByOptions}
                        onChange={(value) => update("performedByName", value)}
                        placeholder="Select personnel..."
                        allowClear
                        disabled={!canEdit}
                      />
                    )}
                  </label>
                </div>
                <label className="maintenance-textarea-label">
                  Describe The Issue
                  <textarea
                    rows={4}
                    placeholder="Describe the maintenance issue..."
                    value={form.description}
                    onChange={(event) => update("description", event.target.value)}
                  />
                </label>
              </fieldset>
            </article>

            <article className="panel">
              <h3>Comments</h3>
              {isNew ? (
                <div className="maintenance-empty-state">
                  <MessageSquare size={22} aria-hidden="true" />
                  <p className="field-hint">Comments will be available after saving.</p>
                </div>
              ) : (
                <>
                  {comments.length === 0 ? (
                    <p className="field-hint">No comments yet.</p>
                  ) : (
                    <ul className="list-card">
                      {comments.map((comment) => (
                        <li key={comment.id}>
                          <div>
                            <strong>{comment.authorName}</strong>
                            <p>{comment.body}</p>
                          </div>
                          <span className="field-hint">{formatTimestamp24(comment.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <label className="maintenance-textarea-label">
                    Add a comment
                    <textarea rows={3} value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} />
                  </label>
                  <div>
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      disabled={!commentDraft.trim()}
                      onClick={() => void postComment()}
                    >
                      Add Comment
                    </button>
                  </div>
                </>
              )}
            </article>
          </section>

          <article className="panel">
            <div className="panel-header">
              <h3>Assets</h3>
              {canEdit ? (
                <div className="maintenance-asset-picker">
                  <NerisFlatSingleOptionSelect
                    inputId="maintenance-asset-picker"
                    usePortal
                    value={assetToAdd}
                    options={availableAssets}
                    onChange={setAssetToAdd}
                    placeholder={
                      assetOptions.length
                        ? assetKind === "apparatus"
                          ? "Select apparatus..."
                          : "Select equipment..."
                        : assetKind === "apparatus"
                          ? "No apparatus in Department Details"
                          : "No equipment in Equipment List"
                    }
                  />
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    disabled={!assetToAdd}
                    onClick={addAsset}
                  >
                    <Plus size={14} aria-hidden="true" /> Add Asset
                  </button>
                </div>
              ) : null}
            </div>
            {form.assets.length === 0 ? (
              <p className="field-hint">No assets linked to this record.</p>
            ) : (
              <ul className="list-card">
                {form.assets.map((asset) => (
                  <li key={asset.ref}>
                    <strong>{asset.label || asset.ref}</strong>
                    {canEdit ? (
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() => update("assets", form.assets.filter((entry) => entry.ref !== asset.ref))}
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </>
      ) : null}

      {tab === "costs" ? (
        <article className="panel">
          <div className="panel-header">
            <h3>Costs</h3>
            <strong>Total {formatMoney(costTotal)}</strong>
          </div>
          {form.costs.length === 0 ? <p className="field-hint">No cost lines yet.</p> : null}
          <div className="maintenance-cost-list">
            {form.costs.map((cost, index) => (
              <div key={cost.id ?? `new-${index}`} className="maintenance-cost-row">
                <input
                  type="text"
                  placeholder="Description (parts, labor...)"
                  value={cost.description}
                  disabled={!canEdit}
                  onChange={(event) =>
                    update(
                      "costs",
                      form.costs.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, description: event.target.value } : entry,
                      ),
                    )
                  }
                />
                <NerisFlatSingleOptionSelect
                  inputId={`maintenance-cost-vendor-${index}`}
                  usePortal
                  value={cost.vendorId}
                  options={vendorOptions}
                  placeholder="Vendor (optional)"
                  allowClear
                  disabled={!canEdit}
                  onChange={(value) =>
                    update(
                      "costs",
                      form.costs.map((entry, entryIndex) => (entryIndex === index ? { ...entry, vendorId: value } : entry)),
                    )
                  }
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={Number.isFinite(cost.amount) ? String(cost.amount) : ""}
                  disabled={!canEdit}
                  onChange={(event) =>
                    update(
                      "costs",
                      form.costs.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, amount: Number(event.target.value) } : entry,
                      ),
                    )
                  }
                />
                {canEdit ? (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remove cost line"
                    onClick={() => update("costs", form.costs.filter((_, entryIndex) => entryIndex !== index))}
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {canEdit ? (
            <div>
              <button
                type="button"
                className="secondary-button compact-button maintenance-icon-button"
                onClick={() => update("costs", [...form.costs, { description: "", amount: 0, vendorId: "" }])}
              >
                <Plus size={14} aria-hidden="true" /> Add Cost Line
              </button>
            </div>
          ) : null}
          <p className="field-hint">Cost changes are kept when you click Save.</p>
        </article>
      ) : null}

      {tab === "attachments" ? (
        <article className="panel">
          <h3>Attachments</h3>
          {form.attachments.length === 0 ? <p className="field-hint">No attachments yet.</p> : null}
          <ul className="list-card">
            {form.attachments.map((attachment, index) => (
              <li key={attachment.id ?? `new-${index}`}>
                <div>
                  <a href={attachment.dataUrl} download={attachment.name}>
                    {attachment.name}
                  </a>
                  <p>
                    {Math.max(1, Math.round(attachment.size / 1024))} KB
                    {attachment.addedBy ? ` · added by ${attachment.addedBy}` : " · not saved yet"}
                  </p>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={() => update("attachments", form.attachments.filter((_, entryIndex) => entryIndex !== index))}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <label className="maintenance-textarea-label">
              Add files (up to 1.5 MB each for now)
              <input type="file" multiple onChange={(event) => void handleFiles(event)} />
            </label>
          ) : null}
          <p className="field-hint">New attachments are kept when you click Save.</p>
        </article>
      ) : null}

      {confirmDelete ? (
        <div className="schedule-notice-backdrop" role="dialog" aria-modal="true">
          <div className="schedule-notice">
            <p>Delete {recordNumber}? It will be hidden from every list.</p>
            <div className="schedule-notice-actions">
              <button type="button" className="primary-button compact-button" disabled={saving} onClick={() => void remove()}>
                Delete
              </button>
              <button type="button" className="secondary-button compact-button" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
