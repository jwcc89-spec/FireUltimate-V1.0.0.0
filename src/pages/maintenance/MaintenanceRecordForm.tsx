import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { MessageSquare, Package, Plus, Trash2 } from "lucide-react";
import {
  EMPTY_OIL_CHANGE,
  EMPTY_READINGS,
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_STATUSES,
  addMaintenanceComment,
  createMaintenanceRecord,
  deleteMaintenanceRecord,
  getMaintenanceRecord,
  updateMaintenanceRecord,
  type MaintenanceAssetKind,
  type MaintenanceComment,
  type MaintenanceReadings,
  type MaintenanceRecordInput,
  type MaintenanceType,
  type Part,
  type PmSchedule,
  type RecordPartLine,
  type Vendor,
} from "../../api/maintenance";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { AddPartDialog } from "./MaintenancePartsTab";
import { PmPerformedPanel } from "./MaintenancePmTab";
import { AddVendorDialog } from "./MaintenanceSetupTabs";
import type { NerisValueOption } from "../../nerisMetadata";
import {
  errorText,
  formatMoney,
  formatTimestamp24,
  isOilChangeType,
  isOpenStatus,
  isoToLocalParts,
  localPartsToIso,
  normalizeTime24,
  partLabel,
  readFileAsDataUrl,
  toOptions,
  todayKey,
} from "./maintenanceUtils";

const MAX_ATTACHMENT_BYTES = 1_500_000;

interface MaintenanceRecordFormProps {
  recordId: string | null;
  /** Starting values for a new record, for example from a PM task's Work Order button. */
  prefill?: Partial<MaintenanceRecordInput>;
  schedules: PmSchedule[];
  readingsByUnit: Map<string, MaintenanceReadings>;
  /** Parts inventory for the Parts tab. */
  parts?: Part[];
  onPartCreated?: (part: Part) => void;
  assetKind: MaintenanceAssetKind;
  username: string;
  canManage: boolean;
  types: MaintenanceType[];
  vendors: Vendor[];
  assetOptions: NerisValueOption[];
  stations: string[];
  personnel: string[];
  onVendorCreated: (vendor: Vendor) => void;
  onClose: (changed: boolean) => void;
  /** Called after each successful save, for example so an inspection can link the new record. */
  onSaved?: (record: { id: string; recordNumber: string; description: string }) => void;
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
    outOfServiceAt: "",
    assignedTo: "",
    readings: { ...EMPTY_READINGS },
    pmPerformed: [],
    oilChange: { ...EMPTY_OIL_CHANGE },
    location: "",
    locationDetails: "",
    costs: [],
    attachments: [],
  };
}

type FormTab = "details" | "costs" | "parts" | "attachments";

export function MaintenanceRecordForm({
  recordId,
  prefill,
  schedules,
  readingsByUnit,
  parts = [],
  onPartCreated,
  assetKind,
  username,
  canManage,
  types,
  vendors,
  assetOptions,
  stations,
  personnel,
  onVendorCreated,
  onClose,
  onSaved,
}: MaintenanceRecordFormProps) {
  const [vendorPrompt, setVendorPrompt] = useState<{ costIndex: number; name: string } | null>(null);
  const [partPrompt, setPartPrompt] = useState<{ lineIndex: number; text: string } | null>(null);
  const [partLines, setPartLines] = useState<RecordPartLine[]>([]);
  const [partsChanged, setPartsChanged] = useState(false);
  const [form, setForm] = useState<MaintenanceRecordInput>(() => ({ ...emptyInput(assetKind), ...prefill }));
  const [currentId, setCurrentId] = useState<string | null>(recordId);
  const [recordNumber, setRecordNumber] = useState("");
  const [createdBy, setCreatedBy] = useState(username);
  const [savedStatus, setSavedStatus] = useState("Open");
  const [completedAt, setCompletedAt] = useState("");
  const [comments, setComments] = useState<MaintenanceComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
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
          outOfServiceAt: record.outOfServiceAt,
          assignedTo: record.assignedTo,
          readings: record.readings ?? { ...EMPTY_READINGS },
          pmPerformed: record.pmPerformed ?? [],
          oilChange: record.oilChange ?? { ...EMPTY_OIL_CHANGE },
          location: record.location,
          locationDetails: record.locationDetails,
          costs: record.costs,
          attachments: record.attachments,
        });
        setRecordNumber(record.recordNumber);
        setCreatedBy(record.createdBy);
        setSavedStatus(record.status);
        setCompletedAt(record.completedAt);
        setComments(record.comments);
        setPartLines(record.parts ?? []);
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
  const assignedToOptions = useMemo(() => {
    const names = new Set(personnel);
    if (form.assignedTo) names.add(form.assignedTo);
    return toOptions(Array.from(names));
  }, [form.assignedTo, personnel]);
  const stationOptions = useMemo(() => toOptions(stations), [stations]);
  const primaryAsset = form.assets[0];
  const extraAssets = form.assets.slice(1);
  const primaryAssetOptions = useMemo(() => {
    if (!primaryAsset || assetOptions.some((option) => option.value === primaryAsset.ref)) return assetOptions;
    return [{ value: primaryAsset.ref, label: primaryAsset.label || primaryAsset.ref }, ...assetOptions];
  }, [assetOptions, primaryAsset]);
  const outOfServiceParts = isoToLocalParts(form.outOfServiceAt);
  const assetLabel = assetKind === "apparatus" ? "Apparatus" : "Equipment";
  const costTotal = form.costs.reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0);
  const pmReadings = useMemo((): MaintenanceReadings | null => {
    const latest = primaryAsset ? readingsByUnit.get(primaryAsset.ref) : undefined;
    const pick = (key: keyof MaintenanceReadings) => {
      const values = [form.readings[key], latest?.[key] ?? null].filter((value): value is number => value !== null);
      return values.length ? Math.max(...values) : null;
    };
    return { mileage: pick("mileage"), engineHours: pick("engineHours"), pumpHours: pick("pumpHours") };
  }, [form.readings, primaryAsset, readingsByUnit]);

  const partsTotal = partLines.reduce((sum, line) => sum + line.unitCost * line.quantity, 0);
  const partOptions = (line: RecordPartLine) => {
    const options = parts.map((part) => ({ value: part.id, label: `${partLabel(part)} (${part.onHand} on hand)` }));
    if (line.partId && !parts.some((part) => part.id === line.partId)) {
      options.unshift({ value: line.partId, label: partLabel(line) || "Removed part" });
    }
    return options;
  };
  const setPartLine = (index: number, patch: Partial<RecordPartLine>) => {
    setPartLines((previous) => previous.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
    setPartsChanged(true);
    setNotice("");
  };

  const update = <K extends keyof MaintenanceRecordInput>(key: K, value: MaintenanceRecordInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setNotice("");
  };

  const isOilChange = isOilChangeType(types.find((type) => type.id === form.typeId)?.name);

  /** Picking the oil change category also checks the unit's oil change PM tasks, so completing the ticket resets them. */
  const selectType = (typeId: string) => {
    setForm((previous) => {
      if (!isOilChangeType(types.find((type) => type.id === typeId)?.name)) return { ...previous, typeId };
      const unitRef = previous.assets[0]?.ref ?? "";
      const checked = new Set(previous.pmPerformed.map((entry) => entry.scheduleId));
      const oilTasks = schedules.filter(
        (schedule) =>
          schedule.active &&
          schedule.assetKind === assetKind &&
          schedule.assetRef === unitRef &&
          schedule.typeId === typeId &&
          !checked.has(schedule.id),
      );
      return {
        ...previous,
        typeId,
        pmPerformed: [...previous.pmPerformed, ...oilTasks.map((schedule) => ({ scheduleId: schedule.id, reading: null }))],
      };
    });
    setNotice("");
  };

  const selectPrimaryAsset = (ref: string) => {
    const option = primaryAssetOptions.find((entry) => entry.value === ref);
    update("assets", option ? [{ kind: assetKind, ref: option.value, label: option.label }, ...extraAssets] : extraAssets);
  };

  const setOutOfService = (checked: boolean) => {
    setForm((previous) => ({
      ...previous,
      outOfService: checked,
      outOfServiceAt: checked ? previous.outOfServiceAt || new Date().toISOString() : "",
    }));
    setNotice("");
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
        completedDate: form.status === "Completed" && !form.completedDate ? todayKey() : form.completedDate,
        costs: form.costs.map((cost) => ({ ...cost, amount: Number(cost.amount) || 0 })),
        ...(partsChanged
          ? { parts: partLines.filter((line) => line.partId).map((line) => ({ partId: line.partId, quantity: Math.max(1, Math.round(line.quantity)) })) }
          : {}),
      };
      const saved = currentId
        ? await updateMaintenanceRecord(currentId, payload)
        : await createMaintenanceRecord(payload);
      setCurrentId(saved.id);
      setRecordNumber(saved.recordNumber);
      setCreatedBy(saved.createdBy);
      setSavedStatus(saved.status);
      setCompletedAt(saved.completedAt);
      setComments(saved.comments);
      setPartLines(saved.parts ?? []);
      setPartsChanged(false);
      setForm((previous) => ({
        ...previous,
        attachments: saved.attachments,
        costs: saved.costs,
        completedDate: saved.completedDate,
        outOfServiceAt: saved.outOfServiceAt,
      }));
      setChanged(true);
      setNotice(`Saved ${saved.recordNumber}.`);
      onSaved?.(saved);
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
        {(["details", "costs", "parts", "attachments"] as FormTab[]).map((value) => (
          <button
            key={value}
            type="button"
            className={`secondary-button compact-button ${tab === value ? "department-toggle-active" : ""}`}
            onClick={() => setTab(value)}
          >
            {value === "details"
              ? "Details"
              : value === "costs"
                ? `Costs (${form.costs.length})`
                : value === "parts"
                  ? `Parts (${partLines.length})`
                  : `Attachments (${form.attachments.length})`}
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
                    {assetLabel}
                    <NerisFlatSingleOptionSelect
                      inputId="maintenance-asset"
                      usePortal
                      value={primaryAsset?.ref ?? ""}
                      options={primaryAssetOptions}
                      onChange={selectPrimaryAsset}
                      placeholder={
                        assetOptions.length
                          ? `Select ${assetLabel.toLowerCase()}...`
                          : assetKind === "apparatus"
                            ? "No apparatus in Department Details"
                            : "No equipment in Equipment List"
                      }
                      allowClear
                      disabled={!canEdit}
                    />
                    {extraAssets.length > 0 ? (
                      <span className="field-hint">
                        Also linked: {extraAssets.map((asset) => asset.label || asset.ref).join(", ")}
                      </span>
                    ) : null}
                  </label>
                  <label>
                    Category
                    <NerisFlatSingleOptionSelect
                      inputId="maintenance-category"
                      usePortal
                      value={form.typeId}
                      options={typeOptions}
                      onChange={selectType}
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
                  <label>
                    Assigned To
                    <NerisFlatSingleOptionSelect
                      inputId="maintenance-assigned-to"
                      usePortal
                      value={form.assignedTo}
                      options={assignedToOptions}
                      onChange={(value) => update("assignedTo", value)}
                      placeholder="Select personnel..."
                      allowClear
                      disabled={!canEdit}
                    />
                  </label>
                  <label>
                    Due Date
                    <input type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} />
                  </label>
                  <label className="maintenance-checkbox-label">
                    Out of Service
                    <span className="maintenance-checkbox-row">
                      <input
                        type="checkbox"
                        checked={form.outOfService}
                        onChange={(event) => setOutOfService(event.target.checked)}
                      />
                      {assetKind === "apparatus" ? "Unit is out of service" : "Out of service"}
                    </span>
                  </label>
                  {form.outOfService ? (
                    <div className="maintenance-field">
                      <span className="maintenance-field-label">Taken Out of Service (24-hour)</span>
                      <div className="maintenance-time-row">
                        <input
                          type="date"
                          aria-label="Taken out of service date"
                          value={outOfServiceParts.date}
                          onChange={(event) =>
                            update("outOfServiceAt", localPartsToIso(event.target.value, outOfServiceParts.time))
                          }
                        />
                        <input
                          key={form.outOfServiceAt}
                          type="text"
                          inputMode="numeric"
                          placeholder="HH:MM"
                          aria-label="Taken out of service time"
                          defaultValue={outOfServiceParts.time}
                          onBlur={(event) => {
                            const time = normalizeTime24(event.currentTarget.value);
                            if (time && outOfServiceParts.date) {
                              update("outOfServiceAt", localPartsToIso(outOfServiceParts.date, time));
                            } else {
                              event.currentTarget.value = outOfServiceParts.time;
                            }
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div />
                  )}
                  {assetKind === "apparatus" ? (
                    <>
                      {(
                        [
                          ["mileage", "Mileage", true],
                          ["engineHours", "Engine Hours", true],
                          ["pumpHours", "Pump Hours", false],
                        ] as const
                      ).map(([key, label, required]) => (
                        <label key={key}>
                          {label}
                          {required ? " (needed to complete)" : ""}
                          <input
                            type="number"
                            min={0}
                            step={key === "mileage" ? 1 : 0.1}
                            value={form.readings[key] ?? ""}
                            onChange={(event) =>
                              update("readings", {
                                ...form.readings,
                                [key]: event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                          />
                        </label>
                      ))}
                    </>
                  ) : null}
                  <div className="maintenance-field">
                    <span className="maintenance-field-label">Completed</span>
                    <span className="field-hint">
                      {completedAt
                        ? formatTimestamp24(completedAt)
                        : form.status === "Completed"
                          ? "Stamped with the date and time when you click Save"
                          : "Stamped automatically when saved as Completed"}
                    </span>
                  </div>
                  {assetKind === "apparatus" ? null : <div />}
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
                        placeholder={vendorOptions.length ? "Select vendor..." : "Search or add a vendor"}
                        searchPlaceholder="Search vendors..."
                        allowClear
                        disabled={!canEdit}
                        createOption={
                          canManage
                            ? { label: "Add Vendor", onCreate: (name) => setVendorPrompt({ costIndex: -1, name }) }
                            : undefined
                        }
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
          {isOilChange ? (
            <article className="panel oil-change-panel">
              <h3>Oil Change</h3>
              <p className="field-hint">
                {assetKind === "apparatus"
                  ? "When this ticket is Completed, its Mileage and Engine Hours become the Last Service on this unit's next inspection."
                  : "Record what went in. The oil change is logged when this ticket is Completed."}
              </p>
              <fieldset className="department-edit-grid" disabled={!canEdit}>
                <label>
                  Oil Type / Weight
                  <input
                    type="text"
                    placeholder="e.g. 15W-40"
                    value={form.oilChange.oilType}
                    onChange={(event) => update("oilChange", { ...form.oilChange, oilType: event.target.value })}
                  />
                </label>
                <label>
                  Quarts
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={form.oilChange.quarts ?? ""}
                    onChange={(event) =>
                      update("oilChange", {
                        ...form.oilChange,
                        quarts: event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Oil Filter Part #
                  <input
                    type="text"
                    value={form.oilChange.filterPartNumber}
                    onChange={(event) => update("oilChange", { ...form.oilChange, filterPartNumber: event.target.value })}
                  />
                </label>
              </fieldset>
            </article>
          ) : null}
          {assetKind === "apparatus" ? (
            <PmPerformedPanel
              schedules={schedules.filter((schedule) => schedule.assetKind === assetKind)}
              assetRef={primaryAsset?.ref ?? ""}
              readings={pmReadings}
              value={form.pmPerformed}
              completed={savedStatus === "Completed"}
              disabled={!canEdit}
              onChange={(next) => update("pmPerformed", next)}
            />
          ) : null}
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
                  searchPlaceholder="Search vendors..."
                  allowClear
                  disabled={!canEdit}
                  createOption={
                    canManage
                      ? { label: "Add Vendor", onCreate: (name) => setVendorPrompt({ costIndex: index, name }) }
                      : undefined
                  }
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

      {tab === "parts" ? (
        <article className="panel">
          <div className="panel-header">
            <h3>Parts Used</h3>
            <strong>Parts {formatMoney(partsTotal)}</strong>
          </div>
          {partLines.length === 0 ? <p className="field-hint">No parts on this ticket yet.</p> : null}
          <div className="maintenance-cost-list">
            {partLines.map((line, index) => {
              const part = parts.find((entry) => entry.id === line.partId);
              return (
                <div key={`${line.partId}-${index}`} className="maintenance-cost-row maintenance-part-row">
                  <NerisFlatSingleOptionSelect
                    inputId={`maintenance-part-${index}`}
                    usePortal
                    value={line.partId}
                    options={partOptions(line)}
                    placeholder="Search part number or description..."
                    searchPlaceholder="Search parts..."
                    disabled={!canEdit}
                    createOption={{ label: "Add Part", onCreate: (text) => setPartPrompt({ lineIndex: index, text }) }}
                    onChange={(value) => {
                      const picked = parts.find((entry) => entry.id === value);
                      setPartLine(index, {
                        partId: value,
                        partNumber: picked?.partNumber ?? "",
                        description: picked?.description ?? "",
                        unitCost: picked?.unitCost ?? 0,
                      });
                    }}
                  />
                  <label className="maintenance-inline-field">
                    Qty
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={line.quantity || ""}
                      disabled={!canEdit}
                      onChange={(event) => setPartLine(index, { quantity: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
                    />
                  </label>
                  <span className="field-hint">
                    {formatMoney(line.unitCost * line.quantity)}
                    {part ? ` · ${part.onHand} on hand` : ""}
                  </span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Remove part"
                      onClick={() => {
                        setPartLines((previous) => previous.filter((_, lineIndex) => lineIndex !== index));
                        setPartsChanged(true);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          {canEdit ? (
            <div>
              <button
                type="button"
                className="secondary-button compact-button maintenance-icon-button"
                onClick={() => {
                  setPartLines((previous) => [...previous, { partId: "", partNumber: "", description: "", quantity: 1, unitCost: 0 }]);
                  setPartsChanged(true);
                }}
              >
                <Package size={14} aria-hidden="true" /> Add Part Used
              </button>
            </div>
          ) : null}
          <p className="field-hint">
            Saving takes these parts out of stock (Parts Log). Removing a part or lowering the quantity puts it back.
          </p>
        </article>
      ) : null}

      {partPrompt ? (
        <AddPartDialog
          initialText={partPrompt.text}
          vendors={vendors}
          onCancel={() => setPartPrompt(null)}
          onSaved={(part) => {
            onPartCreated?.(part);
            setPartLine(partPrompt.lineIndex, {
              partId: part.id,
              partNumber: part.partNumber,
              description: part.description,
              unitCost: part.unitCost,
            });
            setPartPrompt(null);
          }}
        />
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

      {vendorPrompt ? (
        <AddVendorDialog
          initialName={vendorPrompt.name}
          onCancel={() => setVendorPrompt(null)}
          onSaved={(vendor) => {
            onVendorCreated(vendor);
            if (vendorPrompt.costIndex < 0) {
              update("vendorId", vendor.id);
            } else {
              update(
                "costs",
                form.costs.map((entry, entryIndex) =>
                  entryIndex === vendorPrompt.costIndex ? { ...entry, vendorId: vendor.id } : entry,
                ),
              );
            }
            setVendorPrompt(null);
          }}
        />
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
