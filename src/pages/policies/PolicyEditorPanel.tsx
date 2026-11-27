import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { JSONContent } from "@tiptap/react";
import { ArrowLeft, Archive, ArchiveRestore, Eye, Paperclip, Send, Trash2, X } from "lucide-react";
import {
  createPolicy,
  deletePolicy,
  getPolicy,
  getPolicyAttachment,
  MAX_POLICY_PDF_BYTES,
  policyLabel,
  publishPolicy,
  updatePolicy,
  type PolicyCategory,
  type PolicyDetail,
  type PolicyInput,
  type PolicyKind,
} from "../../api/policies";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { errorText } from "../maintenance/maintenanceUtils";
import { PolicyEditor } from "./PolicyContent";
import { libraryPath, openPdfDataUrl, POLICY_KIND_LABEL, readPdfFile, statusText } from "./policyUtils";

interface Fields {
  categoryId: string;
  number: string;
  title: string;
  effectiveDate: string;
  requiresAck: boolean;
}

interface PdfState {
  /** A newly picked file, not saved yet. */
  pending: { name: string; size: number; dataUrl: string } | null;
  /** The draft already has a saved PDF. */
  saved: { name: string; size: number } | null;
}

interface PolicyEditorPanelProps {
  policyId: string | null;
  kind: PolicyKind;
  categories: PolicyCategory[];
  onBack: () => void;
  onSaved: (policyId: string) => void;
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ConfirmDialogProps {
  title: string;
  confirmLabel: string;
  error: string;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}

function ConfirmDialog({ title, confirmLabel, error, saving, onConfirm, onCancel, children }: ConfirmDialogProps) {
  return (
    <div className="schedule-notice-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="schedule-notice maintenance-dialog">
        <h3>{title}</h3>
        <div className="policy-dialog-body">{children}</div>
        {error ? <p className="field-error">{error}</p> : null}
        <div className="header-actions">
          <button type="button" className="primary-button compact-button" disabled={saving} onClick={onConfirm}>
            {saving ? "Working..." : confirmLabel}
          </button>
          <button type="button" className="secondary-button compact-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function PolicyEditorPanel({ policyId, kind, categories, onBack, onSaved }: PolicyEditorPanelProps) {
  const [detail, setDetail] = useState<PolicyDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(policyId));
  const [fields, setFields] = useState<Fields>({ categoryId: "", number: "", title: "", effectiveDate: "", requiresAck: true });
  const [content, setContent] = useState<JSONContent | null>(null);
  const [contentChanged, setContentChanged] = useState(false);
  const [pdf, setPdf] = useState<PdfState>({ pending: null, saved: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [publishDraft, setPublishDraft] = useState<{ minor: boolean; assignEveryone: boolean; changeNote: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback((id: string) => {
    return getPolicy(id)
      .then((row) => {
        setDetail(row);
        setFields({
          categoryId: row.categoryId,
          number: row.number,
          title: row.title,
          effectiveDate: row.effectiveDate,
          requiresAck: row.requiresAck,
        });
        setContent(row.draft?.content ?? row.published?.content ?? null);
        setContentChanged(false);
        setPdf({ pending: null, saved: row.draft?.attachment ?? null });
      })
      .catch((loadError) => setError(errorText(loadError, "Could not load the policy.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (policyId) void load(policyId);
  }, [load, policyId]);

  const effectiveKind = detail?.kind ?? kind;
  const chapterOptions = categories
    .filter((category) => category.kind === (effectiveKind === "dtb" ? "dtb" : "manual"))
    .map((category) => ({ value: category.id, label: `${category.number}. ${category.title}` }));

  const inputFor = (archived?: boolean): PolicyInput => {
    const hadDraftContent = Boolean(detail?.draft?.content);
    return {
      kind: effectiveKind,
      ...fields,
      content: contentChanged || hadDraftContent || !detail ? content : null,
      attachment: pdf.pending,
      keepAttachment: Boolean(pdf.saved) && !pdf.pending,
      ...(archived === undefined ? (detail?.status === "archived" ? { archived: true } : {}) : { archived }),
    };
  };

  const save = async (archived?: boolean, notify = true): Promise<string | null> => {
    if (!fields.title.trim()) {
      setError("Enter a title.");
      return null;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const row = detail ? await updatePolicy(detail.id, inputFor(archived)) : await createPolicy(inputFor());
      if (detail) await load(row.id);
      if (notify) onSaved(row.id);
      return row.id;
    } catch (saveError) {
      setError(errorText(saveError, "Could not save the policy."));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!publishDraft) return;
    const id = await save(undefined, false);
    if (!id) return;
    setSaving(true);
    try {
      await publishPolicy(id, {
        requireReack: !publishDraft.minor,
        changeNote: publishDraft.changeNote,
        assignEveryone: publishDraft.assignEveryone,
      });
      setPublishDraft(null);
      await load(id);
      onSaved(id);
      setNotice("Published.");
    } catch (publishError) {
      setError(errorText(publishError, "Could not publish the policy."));
    } finally {
      setSaving(false);
    }
  };

  const pickPdf = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") return setError("Only PDF files can be attached.");
    if (file.size > MAX_POLICY_PDF_BYTES) return setError(`The PDF is ${megabytes(file.size)}. The limit is 2.5 MB.`);
    try {
      setPdf((current) => ({ ...current, pending: { name: file.name, size: file.size, dataUrl: "" } }));
      const dataUrl = await readPdfFile(file);
      setPdf((current) => ({ ...current, pending: { name: file.name, size: file.size, dataUrl } }));
      setError("");
    } catch (readError) {
      setError(errorText(readError, "Could not read the file."));
    }
  };

  const viewPdf = () => {
    if (pdf.pending?.dataUrl) return void openPdfDataUrl(pdf.pending.dataUrl);
    if (detail && pdf.saved) {
      getPolicyAttachment(detail.id, true)
        .then((file) => openPdfDataUrl(file.dataUrl))
        .catch((openError) => setError(errorText(openError, "Could not open the PDF.")));
    }
  };

  if (loading) return <p className="field-hint">Loading...</p>;

  const isNew = !detail;
  const isPublished = Boolean(detail && detail.currentVersion > 0);
  const label = POLICY_KIND_LABEL[effectiveKind];
  const shownPdf = pdf.pending ?? pdf.saved;
  const publishedPdf = detail?.published?.attachment ?? null;

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1 className="page-title-keep">{isNew ? `New ${label}` : `Edit ${label}`}</h1>
          <p>{detail ? `${statusText(detail)}${isPublished ? ` · Version ${detail.currentVersion}` : ""}` : "Not saved yet"}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button maintenance-icon-button" onClick={onBack}>
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </button>
          {isPublished && detail ? (
            <Link className="secondary-button maintenance-icon-button" to={libraryPath(detail.kind, detail.id)}>
              <Eye size={15} aria-hidden="true" /> View Published
            </Link>
          ) : null}
          <button type="button" className="secondary-button compact-button" disabled={saving} onClick={() => void save().then((id) => id && setNotice("Draft saved."))}>
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="button"
            className="primary-button maintenance-icon-button"
            disabled={saving}
            onClick={() => {
              setError("");
              setPublishDraft({ minor: false, assignEveryone: true, changeNote: "" });
            }}
          >
            <Send size={15} aria-hidden="true" /> Publish
          </button>
        </div>
      </header>
      {error ? <p className="field-error">{error}</p> : null}
      {notice ? <p className="field-hint">{notice}</p> : null}

      <article className="panel">
        <div className="department-edit-grid policy-editor-fields">
          <label>
            Chapter
            <NerisFlatSingleOptionSelect
              inputId="policy-chapter"
              usePortal
              allowClear
              value={fields.categoryId}
              options={chapterOptions}
              placeholder={chapterOptions.length ? "No chapter" : "Add chapters on the Chapters tab"}
              onChange={(value) => setFields({ ...fields, categoryId: value })}
            />
          </label>
          <label>
            Number
            <input value={fields.number} placeholder={effectiveKind === "dtb" ? "e.g. DTB-14" : "e.g. 201"} onChange={(event) => setFields({ ...fields, number: event.target.value })} />
          </label>
          <label className="policy-editor-title">
            Title
            <input value={fields.title} onChange={(event) => setFields({ ...fields, title: event.target.value })} />
          </label>
          <label>
            Effective Date
            <input type="date" value={fields.effectiveDate} onChange={(event) => setFields({ ...fields, effectiveDate: event.target.value })} />
          </label>
          <label className="checklist-builder-check">
            <input type="checkbox" checked={fields.requiresAck} onChange={(event) => setFields({ ...fields, requiresAck: event.target.checked })} />
            Members must acknowledge
          </label>
        </div>

        <div className="policy-attachment-row">
          <Paperclip size={15} aria-hidden="true" />
          {shownPdf ? (
            <>
              <button type="button" className="edit-display-link" onClick={viewPdf} disabled={pdf.pending ? !pdf.pending.dataUrl : false}>
                {shownPdf.name}
              </button>
              <span className="field-hint">{megabytes(shownPdf.size)}{pdf.pending ? " · not saved yet" : ""}</span>
              <button
                type="button"
                className="secondary-button compact-button"
                aria-label="Remove PDF"
                onClick={() => setPdf(pdf.pending ? { ...pdf, pending: null } : { pending: null, saved: null })}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </>
          ) : (
            <span className="field-hint">
              {publishedPdf ? `Published PDF: ${publishedPdf.name}. Attach a new one to replace it.` : "Optional: attach a PDF (2.5 MB or smaller)."}
            </span>
          )}
          <label className="secondary-button compact-button policy-file-button">
            {shownPdf || publishedPdf ? "Replace PDF" : "Attach PDF"}
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                void pickPdf(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>

        <p className="field-hint">
          Use <strong>Section</strong> headings for the numbered parts ({fields.number ? `${fields.number}.1, ${fields.number}.2` : "1, 2"}...). Changes stay
          in the draft until you click Publish.
        </p>
        <PolicyEditor
          key={detail?.id ?? "new"}
          initial={content}
          policyNumber={fields.number}
          onChange={(next) => {
            setContent(next);
            setContentChanged(true);
          }}
        />
      </article>

      {detail ? (
        <div className="header-actions policy-editor-footer">
          {detail.status === "archived" ? (
            <button type="button" className="secondary-button maintenance-icon-button" disabled={saving} onClick={() => void save(false)}>
              <ArchiveRestore size={15} aria-hidden="true" /> Restore
            </button>
          ) : (
            <button type="button" className="secondary-button maintenance-icon-button" disabled={saving} onClick={() => void save(true)}>
              <Archive size={15} aria-hidden="true" /> Archive
            </button>
          )}
          <button type="button" className="secondary-button maintenance-icon-button" disabled={saving} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} aria-hidden="true" /> Delete
          </button>
        </div>
      ) : null}

      {publishDraft ? (
        <ConfirmDialog
          title={`Publish ${label}`}
          confirmLabel="Publish"
          error={error}
          saving={saving}
          onConfirm={() => void publish()}
          onCancel={() => setPublishDraft(null)}
        >
          <p className="field-hint">
            {isPublished
              ? `This becomes version ${(detail?.currentVersion ?? 0) + 1}. Members see it right away.`
              : "Members see it right away."}
          </p>
          {isPublished ? (
            <label className="checklist-builder-check">
              <input type="checkbox" checked={publishDraft.minor} onChange={(event) => setPublishDraft({ ...publishDraft, minor: event.target.checked })} />
              Minor edit (typo or formatting). Don't ask members to acknowledge again.
            </label>
          ) : null}
          {fields.requiresAck ? (
            <label className="checklist-builder-check">
              <input
                type="checkbox"
                checked={publishDraft.assignEveryone}
                onChange={(event) => setPublishDraft({ ...publishDraft, assignEveryone: event.target.checked })}
              />
              Assign to everyone to acknowledge
            </label>
          ) : (
            <p className="field-hint">Acknowledgment is turned off, so nobody is asked to acknowledge.</p>
          )}
          <label>
            What Changed (optional)
            <textarea rows={3} value={publishDraft.changeNote} onChange={(event) => setPublishDraft({ ...publishDraft, changeNote: event.target.value })} />
          </label>
        </ConfirmDialog>
      ) : null}

      {confirmDelete && detail ? (
        <ConfirmDialog
          title={`Delete ${label}?`}
          confirmLabel="Delete"
          error={error}
          saving={saving}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setSaving(true);
            deletePolicy(detail.id)
              .then(onBack)
              .catch((deleteError) => setError(errorText(deleteError, "Could not delete the policy.")))
              .finally(() => setSaving(false));
          }}
        >
          <p>
            {policyLabel(detail)} will be removed from the manual. Acknowledgment records are kept. Use Archive instead if you may need it again.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
