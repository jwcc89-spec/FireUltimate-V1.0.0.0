import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, CalendarClock, Dices, FolderTree, GraduationCap, LayoutTemplate, Plus } from "lucide-react";
import {
  createPolicyCategory,
  deletePolicyCategory,
  getPolicies,
  getPolicyCategories,
  updatePolicyCategory,
  type CategoryKind,
  type PolicyCategory,
  type PolicyKind,
  type PolicySummary,
} from "../../api/policies";
import { ModuleTable, type ModuleTableColumn } from "../../components/ModuleTable";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { EditDialog } from "../maintenance/MaintenanceSetupTabs";
import { errorText } from "../maintenance/maintenanceUtils";
import { useDialogSave } from "../maintenance/useDialogSave";
import { PolicyAssignmentsTab, PolicyRulesTab, PolicyTemplatesTab } from "./PolicyAssignTabs";
import { PolicyEditorPanel } from "./PolicyEditorPanel";
import { issuedText, statusText } from "./policyUtils";

type Tab = "policies" | "dtbs" | "chapters" | "assignments" | "templates" | "rules";

const TABS: { id: Tab; label: string; Icon: typeof BookOpen }[] = [
  { id: "policies", label: "Policies", Icon: BookOpen },
  { id: "dtbs", label: "DTB's", Icon: GraduationCap },
  { id: "chapters", label: "Chapters", Icon: FolderTree },
  { id: "assignments", label: "Assignments", Icon: CalendarClock },
  { id: "templates", label: "Templates", Icon: LayoutTemplate },
  { id: "rules", label: "Random Rules", Icon: Dices },
];

const CATEGORY_KIND_OPTIONS = [
  { value: "manual", label: "Policy Manual" },
  { value: "dtb", label: "DTB's" },
];

interface ChapterDraft {
  id: string | null;
  kind: CategoryKind;
  number: string;
  title: string;
}

export function PolicyBuilderPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const editingId = searchParams.get("policy");
  const creatingKind = searchParams.get("new") as PolicyKind | null;
  const [tab, setTab] = useState<Tab>("policies");
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [canManage, setCanManage] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chapterDraft, setChapterDraft] = useState<ChapterDraft | null>(null);
  const [chapterKind, setChapterKind] = useState<CategoryKind>("manual");
  const dialog = useDialogSave();

  const load = useCallback(() => {
    Promise.all([getPolicies("policy"), getPolicies("dtb"), getPolicyCategories()])
      .then(([manual, dtbs, chapters]) => {
        setPolicies([...manual.rows, ...dtbs.rows]);
        setCanManage(manual.canManage);
        setCategories(chapters);
      })
      .catch((loadError) => setError(errorText(loadError, "Could not load the Policy Builder.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const chapterName = useMemo(() => {
    const names = new Map(categories.map((category) => [category.id, `${category.number}. ${category.title}`]));
    return (id: string) => names.get(id) ?? "";
  }, [categories]);

  const policyColumns: ModuleTableColumn<PolicySummary>[] = [
    { id: "number", label: "Number", width: 110, render: (row) => row.number, value: (row) => row.number },
    { id: "title", label: "Title", width: 280, render: (row) => row.title, value: (row) => row.title.toLowerCase() },
    { id: "chapter", label: "Chapter", width: 220, render: (row) => chapterName(row.categoryId), value: (row) => chapterName(row.categoryId) },
    { id: "status", label: "Status", width: 220, render: (row) => statusText(row), value: (row) => statusText(row) },
    { id: "version", label: "Version", width: 90, render: (row) => (row.currentVersion ? `v${row.currentVersion}` : ""), value: (row) => row.currentVersion },
    { id: "issued", label: "Issued", width: 120, render: (row) => issuedText(row.publishedAt), value: (row) => row.publishedAt },
    { id: "ack", label: "Acknowledge", width: 120, render: (row) => (row.requiresAck ? "Required" : "No"), value: (row) => (row.requiresAck ? 1 : 0) },
  ];

  const chapterColumns: ModuleTableColumn<PolicyCategory>[] = [
    { id: "number", label: "Chapter", width: 100, render: (row) => row.number, value: (row) => row.number },
    { id: "title", label: "Title", width: 320, render: (row) => row.title, value: (row) => row.title.toLowerCase() },
    {
      id: "count",
      label: "Items",
      width: 100,
      render: (row) => policies.filter((policy) => policy.categoryId === row.id).length,
      value: (row) => policies.filter((policy) => policy.categoryId === row.id).length,
    },
  ];

  if (!loading && !canManage) {
    return (
      <section className="page-section">
        <article className="panel">
          <p className="field-hint">You need permission to manage policies to use the Policy Builder.</p>
        </article>
      </section>
    );
  }

  if (editingId || creatingKind) {
    return (
      <PolicyEditorPanel
        key={editingId ?? `new-${creatingKind}`}
        policyId={editingId}
        kind={creatingKind === "dtb" ? "dtb" : "policy"}
        categories={categories}
        onBack={() => {
          setSearchParams({});
          load();
        }}
        onSaved={(id) => {
          load();
          if (id !== editingId) setSearchParams({ policy: id }, { replace: true });
        }}
      />
    );
  }

  const listKind: PolicyKind = tab === "dtbs" ? "dtb" : "policy";
  const listRows = policies.filter((row) => row.kind === listKind && (showArchived ? row.status === "archived" : row.status !== "archived"));
  const saveChapter = async () => {
    if (!chapterDraft) return;
    const input = { kind: chapterDraft.kind, number: Number(chapterDraft.number), title: chapterDraft.title };
    const ok = await dialog.run(async () => {
      if (chapterDraft.id) await updatePolicyCategory(chapterDraft.id, input);
      else await createPolicyCategory(input);
    }, "Could not save the chapter.");
    if (ok) {
      setChapterDraft(null);
      load();
    }
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Policy Builder</h1>
          <p>Write and publish policies and DTB's, organize chapters, and assign reading to members.</p>
        </div>
        <div className="header-actions">
          {tab === "policies" || tab === "dtbs" ? (
            <button type="button" className="primary-button maintenance-icon-button" onClick={() => setSearchParams({ new: listKind })}>
              <Plus size={15} aria-hidden="true" /> {tab === "dtbs" ? "New DTB" : "New Policy"}
            </button>
          ) : null}
          {tab === "chapters" ? (
            <button
              type="button"
              className="primary-button maintenance-icon-button"
              onClick={() => {
                dialog.setError("");
                const next = Math.max(-1, ...categories.filter((row) => row.kind === chapterKind).map((row) => row.number)) + 1;
                setChapterDraft({ id: null, kind: chapterKind, number: String(next), title: "" });
              }}
            >
              <Plus size={15} aria-hidden="true" /> Add Chapter
            </button>
          ) : null}
        </div>
      </header>

      <nav className="department-editor-toolbar-actions maintenance-tabs" aria-label="Policy Builder sections">
        {TABS.map(({ id, label, Icon }) => (
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

      {!loading && (tab === "policies" || tab === "dtbs") ? (
        <article className="panel">
          <ModuleTable
            tableId={`policy-builder-${listKind}`}
            toolbarStart={
              <>
                {[false, true].map((archived) => (
                  <button
                    key={String(archived)}
                    type="button"
                    className={`secondary-button compact-button ${showArchived === archived ? "department-toggle-active" : ""}`}
                    onClick={() => setShowArchived(archived)}
                  >
                    {archived ? "Archived" : "Active"}
                  </button>
                ))}
              </>
            }
            columns={policyColumns}
            rows={listRows}
            rowKey={(row) => row.id}
            emptyText={showArchived ? "Nothing archived." : tab === "dtbs" ? "No DTB's yet. Click New DTB to write one." : "No policies yet. Click New Policy to write one."}
            defaultSort={{ id: "number", direction: "asc" }}
            onRowClick={(row) => setSearchParams({ policy: row.id })}
          />
        </article>
      ) : null}

      {!loading && tab === "chapters" ? (
        <article className="panel">
          <ModuleTable
            tableId="policy-builder-chapters"
            toolbarStart={
              <>
                {CATEGORY_KIND_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`secondary-button compact-button ${chapterKind === option.value ? "department-toggle-active" : ""}`}
                    onClick={() => setChapterKind(option.value as CategoryKind)}
                  >
                    {option.label}
                  </button>
                ))}
              </>
            }
            columns={chapterColumns}
            rows={categories.filter((row) => row.kind === chapterKind)}
            rowKey={(row) => row.id}
            emptyText="No chapters yet. Chapter 0 is usually the Preface."
            defaultSort={{ id: "number", direction: "asc" }}
            onRowClick={(row) => {
              dialog.setError("");
              setChapterDraft({ id: row.id, kind: row.kind, number: String(row.number), title: row.title });
            }}
          />
        </article>
      ) : null}

      {!loading && tab === "assignments" ? <PolicyAssignmentsTab policies={policies} /> : null}
      {!loading && tab === "templates" ? <PolicyTemplatesTab policies={policies} /> : null}
      {!loading && tab === "rules" ? <PolicyRulesTab categories={categories} /> : null}

      {chapterDraft ? (
        <EditDialog
          title={chapterDraft.id ? "Edit Chapter" : "Add Chapter"}
          error={dialog.error}
          saving={dialog.saving}
          onSave={() => void saveChapter()}
          onCancel={() => setChapterDraft(null)}
          onDelete={
            chapterDraft.id
              ? () => {
                  const id = chapterDraft.id;
                  if (!id) return;
                  void dialog
                    .run(() => deletePolicyCategory(id), "Could not delete the chapter.")
                    .then((ok) => {
                      if (!ok) return;
                      setChapterDraft(null);
                      load();
                    });
                }
              : undefined
          }
        >
          <label>
            Section
            <NerisFlatSingleOptionSelect
              inputId="chapter-kind"
              usePortal
              value={chapterDraft.kind}
              options={CATEGORY_KIND_OPTIONS}
              onChange={(value) => setChapterDraft({ ...chapterDraft, kind: (value || "manual") as CategoryKind })}
            />
          </label>
          <label>
            Chapter Number
            <input
              type="number"
              min={0}
              max={999}
              value={chapterDraft.number}
              onChange={(event) => setChapterDraft({ ...chapterDraft, number: event.target.value })}
            />
          </label>
          <label>
            Title
            <input value={chapterDraft.title} placeholder="e.g. Organization and Administration" onChange={(event) => setChapterDraft({ ...chapterDraft, title: event.target.value })} />
          </label>
        </EditDialog>
      ) : null}
    </section>
  );
}
