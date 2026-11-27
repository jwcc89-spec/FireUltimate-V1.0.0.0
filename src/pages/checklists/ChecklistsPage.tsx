import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, CalendarClock, ClipboardList, LayoutTemplate, Play, Plus } from "lucide-react";
import {
  FREQUENCIES,
  TARGET_KINDS,
  createAssignment,
  createKit,
  deleteAssignment,
  deleteKit,
  getAssignments,
  getChecklistTemplates,
  getKits,
  getSubmissions,
  reviewSubmission,
  updateAssignment,
  updateKit,
  type ChecklistAssignment,
  type ChecklistAssignmentInput,
  type ChecklistSubmission,
  type ChecklistTargetKind,
  type ChecklistTemplate,
  type Kit,
} from "../../api/checklists";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { fullNameForUsername, useModuleLookups } from "../../moduleLookups";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { useMyPermissions } from "../../useMyPermissions";
import { EditDialog } from "../maintenance/MaintenanceSetupTabs";
import { errorText, formatDateKey, toOptions, todayKey } from "../maintenance/maintenanceUtils";
import { useDialogSave } from "../maintenance/useDialogSave";
import { ChecklistReport, ChecklistRun, type RunTarget } from "./ChecklistRun";
import { ChecklistTemplateBuilder } from "./ChecklistTemplateBuilder";
import { frequencyLabel, isOpen, statusTone, targetText } from "./checklistUtils";

type Tab = "checklists" | "templates" | "assignments" | "kits";
type View =
  | { kind: "list" }
  | { kind: "run"; template: ChecklistTemplate; assignment: ChecklistAssignment | null; target: RunTarget }
  | { kind: "report"; id: string }
  | { kind: "builder"; template: ChecklistTemplate | null };

const TABS: { id: Tab; label: string; Icon: typeof ClipboardList; manageOnly: boolean }[] = [
  { id: "checklists", label: "Checklists", Icon: ClipboardList, manageOnly: false },
  { id: "templates", label: "Templates", Icon: LayoutTemplate, manageOnly: true },
  { id: "assignments", label: "Assignments", Icon: CalendarClock, manageOnly: true },
  { id: "kits", label: "Kits", Icon: Boxes, manageOnly: true },
];

const EMPTY_ASSIGNMENT: ChecklistAssignmentInput & { id: string | null } = {
  id: null,
  templateId: "",
  targetKind: "apparatus",
  targetRef: "",
  assignedTo: "",
  frequency: "daily",
  startsOn: todayKey(),
  active: true,
};

const EMPTY_KIT: Omit<Kit, "id"> & { id: string | null } = { id: null, name: "", kitType: "", locationRef: "", notes: "" };

export function ChecklistsPage({ username }: { username: string }) {
  const grants = useMyPermissions();
  const canManage = grants?.["inventory.manage"] === true;
  const canComplete = grants?.["inventory.complete"] === true;
  const lookups = useModuleLookups();
  const myName = fullNameForUsername(lookups, username);
  const [tab, setTab] = useState<Tab>("checklists");
  const [view, setView] = useState<View>({ kind: "list" });
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [assignments, setAssignments] = useState<ChecklistAssignment[]>([]);
  const [submissions, setSubmissions] = useState<ChecklistSubmission[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [listMode, setListMode] = useState<"open" | "complete">("open");
  const [whose, setWhose] = useState<"all" | "mine">("all");
  const [startDraft, setStartDraft] = useState<{ templateId: string; targetKind: ChecklistTargetKind; targetRef: string } | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<typeof EMPTY_ASSIGNMENT | null>(null);
  const [kitDraft, setKitDraft] = useState<typeof EMPTY_KIT | null>(null);
  const dialog = useDialogSave();

  const load = useCallback(async () => {
    try {
      const [nextTemplates, nextAssignments, nextSubmissions, nextKits] = await Promise.all([
        getChecklistTemplates(),
        getAssignments(todayKey()),
        getSubmissions(),
        getKits(),
      ]);
      setTemplates(nextTemplates);
      setAssignments(nextAssignments);
      setSubmissions(nextSubmissions);
      setKits(nextKits);
      setError("");
    } catch (loadError) {
      setError(errorText(loadError, "Could not load checklists."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const targetOptions = useCallback(
    (kind: ChecklistTargetKind) => {
      if (kind === "apparatus") return lookups.apparatus.map((unit) => ({ value: unit.unitId, label: unit.label }));
      if (kind === "station") return toOptions(lookups.stations);
      if (kind === "kit") return kits.map((kit) => ({ value: kit.id, label: kit.locationRef ? `${kit.name} (${kit.locationRef})` : kit.name }));
      return [];
    },
    [kits, lookups.apparatus, lookups.stations],
  );
  const targetLabel = (kind: ChecklistTargetKind, ref: string) =>
    kind === "kit" ? (kits.find((kit) => kit.id === ref)?.name ?? "") : ref;

  const openRows = useMemo(
    () => assignments.filter((row) => isOpen(row) && (whose === "all" || !row.assignedTo || row.assignedTo === myName)),
    [assignments, myName, whose],
  );
  const completeRows = useMemo(
    () => submissions.filter((row) => whose === "all" || row.completedByName === myName),
    [myName, submissions, whose],
  );
  const flaggedRows = submissions.filter((row) => row.status === "Flagged");
  const enabledTemplates = templates.filter((template) => template.enabled);

  const startAssignment = (assignment: ChecklistAssignment) => {
    const template = templates.find((entry) => entry.id === assignment.templateId);
    if (!template) return setError("That assignment's template is no longer available.");
    if (!template.enabled) return setError(`"${template.name}" is turned off. An admin can turn it back on in Templates.`);
    setView({
      kind: "run",
      template,
      assignment,
      target: { kind: assignment.targetKind, ref: assignment.targetRef, label: assignment.targetLabel },
    });
  };

  const closeSubView = (changed: boolean, reportId: string | null = null) => {
    setView(reportId ? { kind: "report", id: reportId } : { kind: "list" });
    if (changed || reportId) void load();
  };

  if (view.kind === "run") {
    return (
      <ChecklistRun
        template={view.template}
        assignment={view.assignment}
        target={view.target}
        signedInName={myName}
        onClose={(savedId) => closeSubView(Boolean(savedId), savedId)}
      />
    );
  }
  if (view.kind === "report") {
    return <ChecklistReport id={view.id} canManage={canManage} onBack={() => closeSubView(true)} />;
  }
  if (view.kind === "builder") {
    return <ChecklistTemplateBuilder template={view.template} onClose={(changed) => closeSubView(changed)} />;
  }

  const openColumns: ModuleTableColumn<ChecklistAssignment>[] = [
    { id: "template", label: "Template", width: 220, value: (row) => row.templateName, render: (row) => <strong>{row.templateName}</strong> },
    { id: "for", label: "Checklist For", width: 200, value: (row) => row.targetLabel, render: (row) => targetText(row.targetKind, row.targetLabel) },
    { id: "assigned", label: "Assigned To", width: 170, value: (row) => row.assignedTo, render: (row) => row.assignedTo || "Anyone" },
    { id: "status", label: "Status", width: 120, value: (row) => row.status, render: (row) => <span className={statusTone(row.status)}>{row.status}</span> },
    { id: "date", label: "Date", width: 120, value: (row) => row.dueOn, render: (row) => formatDateKey(row.dueOn) },
  ];
  const completeColumns: ModuleTableColumn<ChecklistSubmission>[] = [
    { id: "template", label: "Template", width: 220, value: (row) => row.templateName, render: (row) => <strong>{row.templateName}</strong> },
    { id: "for", label: "Checklist For", width: 200, value: (row) => row.targetLabel, render: (row) => targetText(row.targetKind, row.targetLabel) },
    { id: "by", label: "Completed By", width: 170, value: (row) => row.completedByName, render: (row) => row.completedByName },
    {
      id: "status",
      label: "Status",
      width: 150,
      value: (row) => row.status,
      render: (row) => (
        <span className={statusTone(row.status)}>
          {row.status}
          {row.flagCount > 0 ? ` (${row.flagCount})` : ""}
        </span>
      ),
    },
    { id: "date", label: "Date", width: 120, value: (row) => row.completedOn, render: (row) => formatDateKey(row.completedOn) },
    { id: "number", label: "Number", width: 130, value: (row) => row.submissionNumber, render: (row) => row.submissionNumber },
  ];
  const templateColumns: ModuleTableColumn<ChecklistTemplate>[] = [
    { id: "name", label: "Template", width: 240, value: (row) => row.name, render: (row) => <strong>{row.name}</strong> },
    {
      id: "items",
      label: "Items",
      width: 100,
      value: (row) => row.sections.reduce((sum, section) => sum + section.items.length, 0),
      render: (row) => row.sections.reduce((sum, section) => sum + section.items.length, 0),
    },
    { id: "sections", label: "Sections", width: 100, value: (row) => row.sections.length, render: (row) => row.sections.length },
    { id: "version", label: "Version", width: 90, value: (row) => row.version, render: (row) => row.version },
    {
      id: "status",
      label: "Status",
      width: 110,
      value: (row) => (row.enabled ? "In use" : "Off"),
      render: (row) => <span className={row.enabled ? "tone tone-positive" : "tone tone-neutral"}>{row.enabled ? "In use" : "Off"}</span>,
    },
  ];
  const assignmentColumns: ModuleTableColumn<ChecklistAssignment>[] = [
    { id: "template", label: "Template", width: 220, value: (row) => row.templateName, render: (row) => <strong>{row.templateName}</strong> },
    { id: "for", label: "Checklist For", width: 200, value: (row) => row.targetLabel, render: (row) => targetText(row.targetKind, row.targetLabel) },
    { id: "assigned", label: "Assigned To", width: 160, value: (row) => row.assignedTo, render: (row) => row.assignedTo || "Anyone" },
    { id: "frequency", label: "How Often", width: 120, value: (row) => row.frequency, render: (row) => frequencyLabel(row.frequency) },
    { id: "status", label: "Status", width: 110, value: (row) => row.status, render: (row) => <span className={statusTone(row.status)}>{row.status}</span> },
    {
      id: "last",
      label: "Last Completed",
      width: 130,
      value: (row) => row.lastCompletedOn,
      render: (row) => (row.lastCompletedOn ? formatDateKey(row.lastCompletedOn) : "Never"),
    },
  ];
  const kitColumns: ModuleTableColumn<Kit>[] = [
    { id: "name", label: "Kit", width: 220, value: (row) => row.name, render: (row) => <strong>{row.name}</strong> },
    { id: "type", label: "Type", width: 150, value: (row) => row.kitType, render: (row) => row.kitType || "—" },
    { id: "location", label: "Location", width: 160, value: (row) => row.locationRef, render: (row) => row.locationRef || "—" },
  ];

  const filterChips = (
    <>
      {(["open", "complete"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          className={`secondary-button compact-button ${listMode === mode ? "department-toggle-active" : ""}`}
          onClick={() => setListMode(mode)}
        >
          {mode === "open" ? `Open (${openRows.length})` : "Complete"}
        </button>
      ))}
      <select aria-label="Whose checklists" value={whose} onChange={(event) => setWhose(event.target.value as "all" | "mine")}>
        <option value="all">All assignments</option>
        <option value="mine">My assignments</option>
      </select>
    </>
  );

  const saveAssignment = async () => {
    if (!assignmentDraft) return;
    const { id, ...input } = assignmentDraft;
    const ok = await dialog.run(async () => {
      if (id) await updateAssignment(id, input, todayKey());
      else await createAssignment(input, todayKey());
    }, "Could not save the assignment.");
    if (ok) {
      setAssignmentDraft(null);
      void load();
    }
  };

  const saveKit = async () => {
    if (!kitDraft) return;
    const { id, ...input } = kitDraft;
    const ok = await dialog.run(async () => {
      if (id) await updateKit(id, input);
      else await createKit(input);
    }, "Could not save the kit.");
    if (ok) {
      setKitDraft(null);
      void load();
    }
  };

  const locationOptions = toOptions(
    Array.from(new Set([...lookups.apparatus.map((unit) => unit.unitId), ...lookups.stations])).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    ),
  );

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Checklists</h1>
          <p>Shift, daily, weekly and monthly checks for apparatus, stations and kits. Failed, short or expired items are flagged for an admin.</p>
        </div>
        <div className="header-actions">
          {tab === "checklists" && canComplete ? (
            <button
              type="button"
              className="primary-button maintenance-icon-button"
              onClick={() => setStartDraft({ templateId: enabledTemplates[0]?.id ?? "", targetKind: "apparatus", targetRef: "" })}
            >
              <Play size={15} aria-hidden="true" /> Start Checklist
            </button>
          ) : null}
          {tab === "templates" && canManage ? (
            <button type="button" className="primary-button maintenance-icon-button" onClick={() => setView({ kind: "builder", template: null })}>
              <Plus size={15} aria-hidden="true" /> New Template
            </button>
          ) : null}
          {tab === "assignments" && canManage ? (
            <button
              type="button"
              className="primary-button maintenance-icon-button"
              onClick={() => {
                dialog.setError("");
                setAssignmentDraft({ ...EMPTY_ASSIGNMENT, templateId: enabledTemplates[0]?.id ?? "", startsOn: todayKey() });
              }}
            >
              <Plus size={15} aria-hidden="true" /> Add Assignment
            </button>
          ) : null}
          {tab === "kits" && canManage ? (
            <button
              type="button"
              className="primary-button maintenance-icon-button"
              onClick={() => {
                dialog.setError("");
                setKitDraft({ ...EMPTY_KIT });
              }}
            >
              <Plus size={15} aria-hidden="true" /> Add Kit
            </button>
          ) : null}
        </div>
      </header>

      <nav className="department-editor-toolbar-actions maintenance-tabs" aria-label="Checklist sections">
        {TABS.filter((entry) => canManage || !entry.manageOnly).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`secondary-button compact-button ${tab === id ? "department-toggle-active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={14} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>
      {error ? <p className="field-error">{error}</p> : null}
      {loading ? <p className="field-hint">Loading...</p> : null}

      {!loading && tab === "checklists" ? (
        <>
          {canManage && flaggedRows.length > 0 ? (
            <article className="panel checklist-flag-panel">
              <h3>Needs review ({flaggedRows.length})</h3>
              <ul className="list-card">
                {flaggedRows.map((row) => (
                  <li key={row.id} className="checklist-flag-row">
                    <button type="button" className="edit-display-link" onClick={() => setView({ kind: "report", id: row.id })}>
                      {row.submissionNumber}
                    </button>
                    <span>
                      {row.templateName} · {targetText(row.targetKind, row.targetLabel)} · {row.completedByName} · {formatDateKey(row.completedOn)}
                    </span>
                    <span className="field-hint">{row.flags.map((flag) => `${flag.reason}: ${flag.label}`).join("; ")}</span>
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() =>
                        void reviewSubmission(row.id)
                          .then(load)
                          .catch((reviewError) => setError(errorText(reviewError, "Could not mark the checklist reviewed.")))
                      }
                    >
                      Mark Reviewed
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
          <article className="panel">
            {listMode === "open" ? (
              <ModuleTable
                tableId="checklists-open"
                toolbarStart={filterChips}
                columns={openColumns}
                rows={openRows}
                rowKey={(row) => row.id}
                emptyText={whose === "all" ? "Nothing is due right now." : "Nothing is due for you right now."}
                defaultSort={{ id: "date", direction: "asc" }}
                onRowClick={canComplete ? startAssignment : undefined}
              />
            ) : (
              <ModuleTable
                tableId="checklists-complete"
                toolbarStart={filterChips}
                columns={completeColumns}
                rows={completeRows}
                rowKey={(row) => row.id}
                emptyText="No completed checklists yet."
                defaultSort={{ id: "date", direction: "desc" }}
                onRowClick={(row) => setView({ kind: "report", id: row.id })}
              />
            )}
          </article>
        </>
      ) : null}

      {!loading && tab === "templates" ? (
        <article className="panel">
          <ModuleTable
            tableId="checklist-templates"
            columns={templateColumns}
            rows={templates}
            rowKey={(row) => row.id}
            emptyText={canManage ? "No templates yet. Click New Template to build one." : "No templates yet."}
            defaultSort={{ id: "name", direction: "asc" }}
            onRowClick={canManage ? (row) => setView({ kind: "builder", template: row }) : undefined}
          />
        </article>
      ) : null}

      {!loading && tab === "assignments" ? (
        <article className="panel">
          <ModuleTable
            tableId="checklist-assignments"
            columns={assignmentColumns}
            rows={assignments}
            rowKey={(row) => row.id}
            emptyText="No assignments yet. Click Add Assignment to schedule a checklist."
            defaultSort={{ id: "template", direction: "asc" }}
            onRowClick={(row) => {
              dialog.setError("");
              setAssignmentDraft({
                id: row.id,
                templateId: row.templateId,
                targetKind: row.targetKind,
                targetRef: row.targetRef,
                assignedTo: row.assignedTo,
                frequency: row.frequency,
                startsOn: row.startsOn,
                active: row.active,
              });
            }}
          />
        </article>
      ) : null}

      {!loading && tab === "kits" ? (
        <article className="panel">
          <ModuleTable
            tableId="checklist-kits"
            columns={kitColumns}
            rows={kits}
            rowKey={(row) => row.id}
            emptyText="No kits yet. Add jump bags, RIT packs and other kits that are checked on their own."
            defaultSort={{ id: "name", direction: "asc" }}
            onRowClick={(row) => {
              dialog.setError("");
              setKitDraft({ ...row });
            }}
          />
        </article>
      ) : null}

      {startDraft ? (
        <EditDialog
          title="Start Checklist"
          error={dialog.error}
          saving={false}
          onCancel={() => setStartDraft(null)}
          onSave={() => {
            const template = enabledTemplates.find((entry) => entry.id === startDraft.templateId);
            if (!template) return dialog.setError("Pick a template.");
            if (startDraft.targetKind !== "none" && !startDraft.targetRef) return dialog.setError("Pick what the checklist is for.");
            dialog.setError("");
            setStartDraft(null);
            setView({
              kind: "run",
              template,
              assignment: null,
              target: { kind: startDraft.targetKind, ref: startDraft.targetRef, label: targetLabel(startDraft.targetKind, startDraft.targetRef) },
            });
          }}
        >
          <label>
            Template
            <NerisFlatSingleOptionSelect
              inputId="checklist-start-template"
              usePortal
              value={startDraft.templateId}
              options={enabledTemplates.map((template) => ({ value: template.id, label: template.name }))}
              placeholder={enabledTemplates.length ? "Pick a template..." : "No templates in use yet"}
              onChange={(value) => setStartDraft({ ...startDraft, templateId: value })}
            />
          </label>
          <label>
            Checklist For
            <NerisFlatSingleOptionSelect
              inputId="checklist-start-kind"
              usePortal
              value={startDraft.targetKind}
              options={TARGET_KINDS}
              onChange={(value) => setStartDraft({ ...startDraft, targetKind: (value || "none") as ChecklistTargetKind, targetRef: "" })}
            />
          </label>
          {startDraft.targetKind !== "none" ? (
            <label>
              Which One
              <NerisFlatSingleOptionSelect
                inputId="checklist-start-target"
                usePortal
                value={startDraft.targetRef}
                options={targetOptions(startDraft.targetKind)}
                placeholder="Pick one..."
                onChange={(value) => setStartDraft({ ...startDraft, targetRef: value })}
              />
            </label>
          ) : null}
        </EditDialog>
      ) : null}

      {assignmentDraft ? (
        <EditDialog
          title={assignmentDraft.id ? "Edit Assignment" : "Add Assignment"}
          error={dialog.error}
          saving={dialog.saving}
          onSave={() => void saveAssignment()}
          onCancel={() => setAssignmentDraft(null)}
          onDelete={
            assignmentDraft.id
              ? () => {
                  const id = assignmentDraft.id;
                  if (!id) return;
                  void dialog
                    .run(() => deleteAssignment(id), "Could not delete the assignment.")
                    .then((ok) => {
                      if (!ok) return;
                      setAssignmentDraft(null);
                      void load();
                    });
                }
              : undefined
          }
        >
          <label>
            Template
            <NerisFlatSingleOptionSelect
              inputId="assignment-template"
              usePortal
              value={assignmentDraft.templateId}
              options={templates.map((template) => ({ value: template.id, label: template.enabled ? template.name : `${template.name} (off)` }))}
              placeholder="Pick a template..."
              onChange={(value) => setAssignmentDraft({ ...assignmentDraft, templateId: value })}
            />
          </label>
          <label>
            Checklist For
            <NerisFlatSingleOptionSelect
              inputId="assignment-kind"
              usePortal
              value={assignmentDraft.targetKind}
              options={TARGET_KINDS}
              onChange={(value) => setAssignmentDraft({ ...assignmentDraft, targetKind: (value || "none") as ChecklistTargetKind, targetRef: "" })}
            />
          </label>
          {assignmentDraft.targetKind !== "none" ? (
            <label>
              Which One
              <NerisFlatSingleOptionSelect
                inputId="assignment-target"
                usePortal
                value={assignmentDraft.targetRef}
                options={targetOptions(assignmentDraft.targetKind)}
                placeholder="Pick one..."
                onChange={(value) => setAssignmentDraft({ ...assignmentDraft, targetRef: value })}
              />
            </label>
          ) : null}
          <label>
            Assigned To
            <NerisFlatSingleOptionSelect
              inputId="assignment-person"
              usePortal
              allowClear
              value={assignmentDraft.assignedTo}
              options={toOptions(lookups.personnel)}
              placeholder="Anyone"
              onChange={(value) => setAssignmentDraft({ ...assignmentDraft, assignedTo: value })}
            />
          </label>
          <label>
            How Often
            <NerisFlatSingleOptionSelect
              inputId="assignment-frequency"
              usePortal
              value={assignmentDraft.frequency}
              options={FREQUENCIES}
              onChange={(value) => setAssignmentDraft({ ...assignmentDraft, frequency: (value || "daily") as ChecklistAssignment["frequency"] })}
            />
          </label>
          <label>
            Starts On
            <input type="date" value={assignmentDraft.startsOn} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, startsOn: event.target.value })} />
          </label>
          <label className="checklist-builder-check">
            <input
              type="checkbox"
              checked={assignmentDraft.active}
              onChange={(event) => setAssignmentDraft({ ...assignmentDraft, active: event.target.checked })}
            />
            Active (uncheck to pause)
          </label>
        </EditDialog>
      ) : null}

      {kitDraft ? (
        <EditDialog
          title={kitDraft.id ? "Edit Kit" : "Add Kit"}
          error={dialog.error}
          saving={dialog.saving}
          onSave={() => void saveKit()}
          onCancel={() => setKitDraft(null)}
          onDelete={
            kitDraft.id
              ? () => {
                  const id = kitDraft.id;
                  if (!id) return;
                  void dialog
                    .run(() => deleteKit(id), "Could not delete the kit.")
                    .then((ok) => {
                      if (!ok) return;
                      setKitDraft(null);
                      void load();
                    });
                }
              : undefined
          }
        >
          <label>
            Kit Name
            <input type="text" placeholder="For example Medic 1 Jump Bag" value={kitDraft.name} onChange={(event) => setKitDraft({ ...kitDraft, name: event.target.value })} />
          </label>
          <label>
            Type
            <input type="text" placeholder="EMS, RIT, Hazmat..." value={kitDraft.kitType} onChange={(event) => setKitDraft({ ...kitDraft, kitType: event.target.value })} />
          </label>
          <label>
            Location
            <NerisFlatSingleOptionSelect
              inputId="kit-location"
              usePortal
              allowClear
              value={kitDraft.locationRef}
              options={locationOptions}
              placeholder="Unit or station"
              onChange={(value) => setKitDraft({ ...kitDraft, locationRef: value })}
            />
          </label>
          <label>
            Notes
            <textarea rows={3} value={kitDraft.notes} onChange={(event) => setKitDraft({ ...kitDraft, notes: event.target.value })} />
          </label>
        </EditDialog>
      ) : null}
    </section>
  );
}
