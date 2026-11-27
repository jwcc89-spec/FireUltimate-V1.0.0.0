import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import {
  assignPolicyTemplate,
  createPolicyAssignments,
  createPolicyRule,
  createPolicyTemplate,
  deletePolicyAssignment,
  deletePolicyRule,
  deletePolicyTemplate,
  getPolicyAssignments,
  getPolicyPeople,
  getPolicyRules,
  getPolicyTemplates,
  policyLabel,
  updatePolicyRule,
  updatePolicyTemplate,
  type PolicyAssignment,
  type PolicyCategory,
  type PolicyPerson,
  type PolicyRule,
  type PolicyRuleInput,
  type PolicySummary,
  type PolicyTemplate,
} from "../../api/policies";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { NerisFlatMultiOptionSelect, NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { EditDialog } from "../maintenance/MaintenanceSetupTabs";
import { errorText, formatDateKey, formatTimestamp24 } from "../maintenance/maintenanceUtils";
import { useDialogSave } from "../maintenance/useDialogSave";
import { POLICY_KIND_LABEL } from "./policyUtils";

const SOURCE_LABEL: Record<PolicyAssignment["source"], string> = {
  publish: "Published",
  manual: "Assigned",
  template: "Template",
  rule: "Random rule",
};

const splitIds = (value: string) => value.split(",").filter(Boolean);

function usePeople() {
  const [people, setPeople] = useState<PolicyPerson[]>([]);
  useEffect(() => {
    getPolicyPeople()
      .then(setPeople)
      .catch(() => setPeople([]));
  }, []);
  return people;
}

interface TargetDraft {
  everyone: boolean;
  userIds: string;
  dueDate: string;
}

/** "Everyone" or a list of people, plus an optional due date. */
function TargetFields({ draft, people, onChange, idPrefix }: { draft: TargetDraft; people: PolicyPerson[]; onChange: (next: TargetDraft) => void; idPrefix: string }) {
  return (
    <>
      <label className="checklist-builder-check">
        <input type="checkbox" checked={draft.everyone} onChange={(event) => onChange({ ...draft, everyone: event.target.checked })} />
        Everyone in the department
      </label>
      {draft.everyone ? null : (
        <label>
          People
          <NerisFlatMultiOptionSelect
            inputId={`${idPrefix}-people`}
            usePortal
            value={draft.userIds}
            options={people.map((person) => ({ value: person.id, label: person.name }))}
            placeholder="Pick people..."
            onChange={(value) => onChange({ ...draft, userIds: value })}
          />
        </label>
      )}
      <label>
        Due Date (optional)
        <input type="date" value={draft.dueDate} onChange={(event) => onChange({ ...draft, dueDate: event.target.value })} />
      </label>
    </>
  );
}

function targetsOf(draft: TargetDraft) {
  return { userIds: draft.everyone ? [""] : splitIds(draft.userIds), dueDate: draft.dueDate };
}

function publishedOptions(policies: PolicySummary[]) {
  return policies
    .filter((policy) => policy.status === "published")
    .map((policy) => ({ value: policy.id, label: `${POLICY_KIND_LABEL[policy.kind]} · ${policyLabel(policy)}` }));
}

// ----- Assignments -----

export function PolicyAssignmentsTab({ policies }: { policies: PolicySummary[] }) {
  const people = usePeople();
  const [rows, setRows] = useState<PolicyAssignment[]>([]);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<(TargetDraft & { policyIds: string }) | null>(null);
  const [removing, setRemoving] = useState<PolicyAssignment | null>(null);
  const dialog = useDialogSave();

  const load = useCallback(() => {
    getPolicyAssignments()
      .then(setRows)
      .catch((loadError) => setError(errorText(loadError, "Could not load assignments.")));
  }, []);
  useEffect(load, [load]);

  const policyName = useMemo(() => {
    const names = new Map(policies.map((policy) => [policy.id, policyLabel(policy)]));
    return (id: string) => names.get(id) ?? "(deleted)";
  }, [policies]);
  const personName = useMemo(() => {
    const names = new Map(people.map((person) => [person.id, person.name]));
    return (id: string) => (id ? names.get(id) ?? "(removed member)" : "Everyone");
  }, [people]);

  const columns: ModuleTableColumn<PolicyAssignment>[] = [
    { id: "policy", label: "Policy / DTB", width: 280, render: (row) => policyName(row.policyId), value: (row) => policyName(row.policyId) },
    { id: "who", label: "Assigned To", width: 180, render: (row) => personName(row.userId), value: (row) => personName(row.userId) },
    { id: "source", label: "How", width: 130, render: (row) => SOURCE_LABEL[row.source] ?? row.source, value: (row) => row.source },
    { id: "due", label: "Due", width: 120, render: (row) => (row.dueDate ? formatDateKey(row.dueDate) : ""), value: (row) => row.dueDate },
    { id: "by", label: "Assigned By", width: 160, render: (row) => row.assignedBy, value: (row) => row.assignedBy },
    { id: "when", label: "Assigned", width: 160, render: (row) => formatTimestamp24(row.createdAt), value: (row) => row.createdAt },
  ];

  const save = async () => {
    if (!draft) return;
    const ok = await dialog.run(async () => {
      await createPolicyAssignments({ policyIds: splitIds(draft.policyIds), ...targetsOf(draft) });
    }, "Could not assign.");
    if (ok) {
      setDraft(null);
      load();
    }
  };

  return (
    <>
      <article className="panel">
        <div className="header-actions policy-tab-actions">
          <button
            type="button"
            className="primary-button maintenance-icon-button"
            onClick={() => {
              dialog.setError("");
              setDraft({ policyIds: "", everyone: false, userIds: "", dueDate: "" });
            }}
          >
            <UserPlus size={15} aria-hidden="true" /> Assign
          </button>
        </div>
        {error ? <p className="field-error">{error}</p> : null}
        <ModuleTable
          tableId="policy-assignments"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyText="Nothing assigned yet. Publishing a policy assigns it to everyone."
          defaultSort={{ id: "when", direction: "desc" }}
          onRowClick={(row) => {
            dialog.setError("");
            setRemoving(row);
          }}
        />
      </article>

      {draft ? (
        <EditDialog title="Assign Reading" error={dialog.error} saving={dialog.saving} onSave={() => void save()} onCancel={() => setDraft(null)}>
          <label>
            Policies and DTB's
            <NerisFlatMultiOptionSelect
              inputId="assign-policies"
              usePortal
              value={draft.policyIds}
              options={publishedOptions(policies)}
              placeholder="Pick what to read..."
              onChange={(value) => setDraft({ ...draft, policyIds: value })}
            />
          </label>
          <TargetFields draft={draft} people={people} idPrefix="assign" onChange={(next) => setDraft({ ...draft, ...next })} />
        </EditDialog>
      ) : null}

      {removing ? (
        <EditDialog
          title="Assignment"
          error={dialog.error}
          saving={dialog.saving}
          readOnly
          onSave={() => undefined}
          onCancel={() => setRemoving(null)}
        >
          <p>
            {policyName(removing.policyId)} · {personName(removing.userId)} · {SOURCE_LABEL[removing.source]}
            {removing.dueDate ? ` · due ${formatDateKey(removing.dueDate)}` : ""}
          </p>
          <button
            type="button"
            className="secondary-button compact-button"
            disabled={dialog.saving}
            onClick={() =>
              void dialog.run(() => deletePolicyAssignment(removing.id), "Could not remove the assignment.").then((ok) => {
                if (!ok) return;
                setRemoving(null);
                load();
              })
            }
          >
            Remove Assignment
          </button>
        </EditDialog>
      ) : null}
    </>
  );
}

// ----- Templates -----

export function PolicyTemplatesTab({ policies }: { policies: PolicySummary[] }) {
  const people = usePeople();
  const [rows, setRows] = useState<PolicyTemplate[]>([]);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ id: string | null; name: string; policyIds: string } | null>(null);
  const [assigning, setAssigning] = useState<{ template: PolicyTemplate; target: TargetDraft } | null>(null);
  const [notice, setNotice] = useState("");
  const dialog = useDialogSave();

  const load = useCallback(() => {
    getPolicyTemplates()
      .then(setRows)
      .catch((loadError) => setError(errorText(loadError, "Could not load templates.")));
  }, []);
  useEffect(load, [load]);

  const columns: ModuleTableColumn<PolicyTemplate>[] = [
    { id: "name", label: "Template", width: 260, render: (row) => row.name, value: (row) => row.name.toLowerCase() },
    { id: "count", label: "Items", width: 90, render: (row) => row.policyIds.length, value: (row) => row.policyIds.length },
    {
      id: "assign",
      label: "",
      width: 130,
      render: (row) => (
        <button
          type="button"
          className="secondary-button compact-button"
          onClick={(event) => {
            event.stopPropagation();
            dialog.setError("");
            setAssigning({ template: row, target: { everyone: false, userIds: "", dueDate: "" } });
          }}
        >
          Assign...
        </button>
      ),
    },
    { id: "updated", label: "Updated", width: 160, render: (row) => formatTimestamp24(row.updatedAt), value: (row) => row.updatedAt },
  ];

  const save = async () => {
    if (!draft) return;
    const input = { name: draft.name, policyIds: splitIds(draft.policyIds) };
    const ok = await dialog.run(async () => {
      if (draft.id) await updatePolicyTemplate(draft.id, input);
      else await createPolicyTemplate(input);
    }, "Could not save the template.");
    if (ok) {
      setDraft(null);
      load();
    }
  };

  const assign = async () => {
    if (!assigning) return;
    let created = 0;
    const ok = await dialog.run(async () => {
      created = (await assignPolicyTemplate(assigning.template.id, targetsOf(assigning.target))).created;
    }, "Could not assign the template.");
    if (ok) {
      setNotice(`${assigning.template.name}: ${created} new assignment${created === 1 ? "" : "s"}.`);
      setAssigning(null);
    }
  };

  return (
    <>
      <article className="panel">
        <div className="header-actions policy-tab-actions">
          <button
            type="button"
            className="primary-button maintenance-icon-button"
            onClick={() => {
              dialog.setError("");
              setDraft({ id: null, name: "", policyIds: "" });
            }}
          >
            <Plus size={15} aria-hidden="true" /> New Template
          </button>
        </div>
        <p className="field-hint">A template is a reading list, for example "New Member Orientation". Assign it to people in one step.</p>
        {error ? <p className="field-error">{error}</p> : null}
        {notice ? <p className="field-hint">{notice}</p> : null}
        <ModuleTable
          tableId="policy-templates"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyText="No templates yet."
          defaultSort={{ id: "name", direction: "asc" }}
          onRowClick={(row) => {
            dialog.setError("");
            setDraft({ id: row.id, name: row.name, policyIds: row.policyIds.join(",") });
          }}
        />
      </article>

      {draft ? (
        <EditDialog
          title={draft.id ? "Edit Template" : "New Template"}
          error={dialog.error}
          saving={dialog.saving}
          onSave={() => void save()}
          onCancel={() => setDraft(null)}
          onDelete={
            draft.id
              ? () => {
                  const id = draft.id;
                  if (!id) return;
                  void dialog.run(() => deletePolicyTemplate(id), "Could not delete the template.").then((ok) => {
                    if (!ok) return;
                    setDraft(null);
                    load();
                  });
                }
              : undefined
          }
        >
          <label>
            Name
            <input value={draft.name} placeholder="e.g. New Member Orientation" onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            Policies and DTB's
            <NerisFlatMultiOptionSelect
              inputId="template-policies"
              usePortal
              value={draft.policyIds}
              options={publishedOptions(policies)}
              placeholder="Pick what to include..."
              onChange={(value) => setDraft({ ...draft, policyIds: value })}
            />
          </label>
        </EditDialog>
      ) : null}

      {assigning ? (
        <EditDialog title={`Assign ${assigning.template.name}`} error={dialog.error} saving={dialog.saving} onSave={() => void assign()} onCancel={() => setAssigning(null)}>
          <TargetFields
            draft={assigning.target}
            people={people}
            idPrefix="template-assign"
            onChange={(next) => setAssigning({ ...assigning, target: next })}
          />
        </EditDialog>
      ) : null}
    </>
  );
}

// ----- Random rules -----

const PERIOD_OPTIONS = [
  { value: "week", label: "Each week" },
  { value: "month", label: "Each month" },
];

const KIND_OPTIONS = [
  { value: "dtb", label: "DTB's" },
  { value: "policy", label: "Policies" },
];

interface RuleDraft {
  id: string | null;
  name: string;
  kind: PolicyRule["kind"];
  count: string;
  period: PolicyRule["period"];
  categoryIds: string;
  userIds: string;
  active: boolean;
}

export function PolicyRulesTab({ categories }: { categories: PolicyCategory[] }) {
  const people = usePeople();
  const [rows, setRows] = useState<PolicyRule[]>([]);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const dialog = useDialogSave();

  const load = useCallback(() => {
    getPolicyRules()
      .then(setRows)
      .catch((loadError) => setError(errorText(loadError, "Could not load rules.")));
  }, []);
  useEffect(load, [load]);

  const chapterName = useMemo(() => {
    const names = new Map(categories.map((category) => [category.id, `${category.number}. ${category.title}`]));
    return (ids: string[]) => (ids.length ? ids.map((id) => names.get(id) ?? "(removed)").join(", ") : "Any chapter");
  }, [categories]);

  const columns: ModuleTableColumn<PolicyRule>[] = [
    { id: "name", label: "Rule", width: 220, render: (row) => row.name, value: (row) => row.name.toLowerCase() },
    {
      id: "what",
      label: "Picks",
      width: 200,
      render: (row) => {
        const unit = row.kind === "dtb" ? (row.count === 1 ? "DTB" : "DTB's") : row.count === 1 ? "policy" : "policies";
        return `${row.count} ${unit} per ${row.period}`;
      },
      value: (row) => row.count,
    },
    { id: "chapters", label: "From", width: 220, render: (row) => chapterName(row.categoryIds), value: (row) => chapterName(row.categoryIds) },
    { id: "who", label: "For", width: 140, render: (row) => (row.userIds.length ? `${row.userIds.length} people` : "Everyone"), value: (row) => row.userIds.length },
    { id: "active", label: "Active", width: 90, render: (row) => (row.active ? "Yes" : "Paused"), value: (row) => (row.active ? 1 : 0) },
  ];

  const save = async () => {
    if (!draft) return;
    const input: PolicyRuleInput = {
      name: draft.name,
      kind: draft.kind,
      count: Number(draft.count),
      period: draft.period,
      categoryIds: splitIds(draft.categoryIds),
      userIds: splitIds(draft.userIds),
      active: draft.active,
    };
    const ok = await dialog.run(async () => {
      if (draft.id) await updatePolicyRule(draft.id, input);
      else await createPolicyRule(input);
    }, "Could not save the rule.");
    if (ok) {
      setDraft(null);
      load();
    }
  };

  const chapterOptions = draft
    ? categories
        .filter((category) => category.kind === (draft.kind === "dtb" ? "dtb" : "manual"))
        .map((category) => ({ value: category.id, label: `${category.number}. ${category.title}` }))
    : [];

  return (
    <>
      <article className="panel">
        <div className="header-actions policy-tab-actions">
          <button
            type="button"
            className="primary-button maintenance-icon-button"
            onClick={() => {
              dialog.setError("");
              setDraft({ id: null, name: "", kind: "dtb", count: "1", period: "week", categoryIds: "", userIds: "", active: true });
            }}
          >
            <Plus size={15} aria-hidden="true" /> New Rule
          </button>
        </div>
        <p className="field-hint">
          A random rule picks published items for members to read each week or month, for example "2 DTB's every week". Items not picked before come first. Picks
          are due at the end of the week (Monday to Sunday) or month.
        </p>
        {error ? <p className="field-error">{error}</p> : null}
        <ModuleTable
          tableId="policy-rules"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyText="No random rules yet."
          defaultSort={{ id: "name", direction: "asc" }}
          onRowClick={(row) => {
            dialog.setError("");
            setDraft({
              id: row.id,
              name: row.name,
              kind: row.kind,
              count: String(row.count),
              period: row.period,
              categoryIds: row.categoryIds.join(","),
              userIds: row.userIds.join(","),
              active: row.active,
            });
          }}
        />
      </article>

      {draft ? (
        <EditDialog
          title={draft.id ? "Edit Random Rule" : "New Random Rule"}
          error={dialog.error}
          saving={dialog.saving}
          onSave={() => void save()}
          onCancel={() => setDraft(null)}
          onDelete={
            draft.id
              ? () => {
                  const id = draft.id;
                  if (!id) return;
                  void dialog.run(() => deletePolicyRule(id), "Could not delete the rule.").then((ok) => {
                    if (!ok) return;
                    setDraft(null);
                    load();
                  });
                }
              : undefined
          }
        >
          <label>
            Name
            <input value={draft.name} placeholder="e.g. Weekly DTB's" onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            Pick From
            <NerisFlatSingleOptionSelect
              inputId="rule-kind"
              usePortal
              value={draft.kind}
              options={KIND_OPTIONS}
              onChange={(value) => setDraft({ ...draft, kind: (value || "dtb") as PolicyRule["kind"], categoryIds: "" })}
            />
          </label>
          <label>
            How Many
            <input type="number" min={1} max={20} value={draft.count} onChange={(event) => setDraft({ ...draft, count: event.target.value })} />
          </label>
          <label>
            How Often
            <NerisFlatSingleOptionSelect
              inputId="rule-period"
              usePortal
              value={draft.period}
              options={PERIOD_OPTIONS}
              onChange={(value) => setDraft({ ...draft, period: (value || "week") as PolicyRule["period"] })}
            />
          </label>
          <label>
            Chapters (optional)
            <NerisFlatMultiOptionSelect
              inputId="rule-chapters"
              usePortal
              value={draft.categoryIds}
              options={chapterOptions}
              placeholder="Any chapter"
              onChange={(value) => setDraft({ ...draft, categoryIds: value })}
            />
          </label>
          <label>
            People (optional)
            <NerisFlatMultiOptionSelect
              inputId="rule-people"
              usePortal
              value={draft.userIds}
              options={people.map((person) => ({ value: person.id, label: person.name }))}
              placeholder="Everyone"
              onChange={(value) => setDraft({ ...draft, userIds: value })}
            />
          </label>
          <label className="checklist-builder-check">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
            Active (uncheck to pause)
          </label>
        </EditDialog>
      ) : null}
    </>
  );
}
