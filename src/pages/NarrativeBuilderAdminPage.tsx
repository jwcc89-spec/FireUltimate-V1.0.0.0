/**
 * Admin UI for Narrative Builder templates (PRIORITY 11.1).
 * Templates are stored in Department Details payload (narrativeTemplates), tenant-scoped.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { NERIS_FORM_FIELDS } from "../nerisMetadata";
import type { NarrativeSegment, NarrativeTemplate } from "../narrativeBuilder";

const DEPARTMENT_DETAILS_STORAGE_KEY = "fire-ultimate-department-details";

async function loadDepartmentDetails(): Promise<Record<string, unknown>> {
  const res = await fetch("/api/department-details");
  if (!res.ok) throw new Error("Failed to load");
  const json = await res.json();
  return (json?.data && typeof json.data === "object" ? json.data : {}) as Record<string, unknown>;
}

async function saveDepartmentDetails(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/department-details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Save failed");
  const updated = await loadDepartmentDetails();
  window.localStorage.setItem(DEPARTMENT_DETAILS_STORAGE_KEY, JSON.stringify(updated));
}

function generateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getNerisFieldLabel(fieldId: string): string {
  const field = NERIS_FORM_FIELDS.find((f) => f.id === fieldId);
  return field?.label ?? fieldId;
}

/** Build preview text for admin: human-readable labels for NERIS, placeholder for user fillable */
function buildAdminPreview(segments: NarrativeSegment[]): string {
  const parts = segments.map((seg) => {
    if (seg.type === "fillable") return seg.text.trim();
    if (seg.type === "neris") return `[${getNerisFieldLabel(seg.fieldId)}]`;
    if (seg.type === "userFillable")
      return seg.placeholderHint
        ? `[User: ${seg.placeholderHint}]`
        : "[User fillable]";
    if (seg.type === "question")
      return seg.questionText.trim() ? `[${seg.questionText.trim()}]` : "[Question]";
    return "";
  });

  // Join with spaces so templates read like sentences.
  return parts.filter((p) => p.length > 0).join(" ");
}

export function NarrativeBuilderAdminPage() {
  const [templates, setTemplates] = useState<NarrativeTemplate[]>([]);
  const [narrativeBuilderEnabled, setNarrativeBuilderEnabled] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "done" | "error">("loading");
  const [saveStatus, setSaveStatus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addNewName, setAddNewName] = useState("");
  const [addNewSegments, setAddNewSegments] = useState<NarrativeSegment[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDepartmentDetails()
      .then((data) => {
        if (cancelled) return;
        const raw = data.narrativeTemplates;
        const list = Array.isArray(raw)
          ? (raw as NarrativeTemplate[]).map((t) => ({
              ...t,
              id: String(t.id ?? generateId()),
              name: String(t.name ?? "").trim() || "Unnamed",
              segments: Array.isArray(t.segments) ? t.segments : [],
            }))
          : [];
        setTemplates(list);
        const enabled = data.narrativeBuilderEnabled === true || data.narrativeBuilderEnabled === "true";
        setNarrativeBuilderEnabled(Boolean(enabled));
        setLoadStatus("done");
      })
      .catch(() => {
        if (!cancelled) setLoadStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async () => {
    setSaveStatus("Saving…");
    try {
      const data = await loadDepartmentDetails();
      const payload = {
        ...data,
        narrativeTemplates: templates,
        narrativeBuilderEnabled,
      };
      await saveDepartmentDetails(payload);
      setSaveStatus("Saved.");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch {
      setSaveStatus("Save failed.");
    }
  }, [templates, narrativeBuilderEnabled]);

  const startAdd = useCallback(() => {
    setIsAdding(true);
    setAddNewName("");
    setAddNewSegments([]);
    setEditingId(null);
  }, []);

  const cancelAdd = useCallback(() => {
    setIsAdding(false);
    setAddNewName("");
    setAddNewSegments([]);
  }, []);

  const commitAdd = useCallback(() => {
    const name = addNewName.trim();
    if (!name) return;
    const t: NarrativeTemplate = {
      id: generateId(),
      name,
      segments: [...addNewSegments],
      createdAt: new Date().toISOString(),
    };
    setTemplates((prev) => [...prev, t]);
    setIsAdding(false);
    setAddNewName("");
    setAddNewSegments([]);
    setSaveStatus("Add saved locally. Click Save to persist.");
  }, [addNewName, addNewSegments]);

  const deleteTemplate = useCallback((id: string) => {
    if (!window.confirm("Delete this template?")) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
    setSaveStatus("Template removed. Click Save to persist.");
  }, [editingId]);

  const startEdit = useCallback((id: string) => {
    setEditingId(id);
    setIsAdding(false);
  }, []);

  const updateTemplateSegments = useCallback(
    (id: string, segments: NarrativeSegment[]) => {
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, segments } : t)),
      );
      setSaveStatus("Updated. Click Save to persist.");
    },
    [],
  );

  const moveSegment = useCallback(
    (list: NarrativeSegment[], index: number, dir: "up" | "down") => {
      const next = [...list];
      const j = dir === "up" ? index - 1 : index + 1;
      if (j < 0 || j >= next.length) return list;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    },
    [],
  );

  const addSegmentToNew = useCallback(
    (seg: NarrativeSegment) => setAddNewSegments((prev) => [...prev, seg]),
    [],
  );

  const removeSegmentFromNew = useCallback((index: number) => {
    setAddNewSegments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const moveSegmentInNew = useCallback(
    (index: number, dir: "up" | "down") => {
      setAddNewSegments((prev) => moveSegment(prev, index, dir));
    },
    [moveSegment],
  );

  const updateSegmentInNew = useCallback(
    (index: number, seg: NarrativeSegment) => {
      setAddNewSegments((prev) =>
        prev.map((s, i) => (i === index ? seg : s)),
      );
    },
    [],
  );

  return (
    <section className="page-section narrative-builder-admin">
      <div className="narrative-builder-enable-strip">
        <label className="narrative-builder-enable-label">
          <input
            type="checkbox"
            checked={narrativeBuilderEnabled}
            onChange={(e) => {
              setNarrativeBuilderEnabled(e.target.checked);
              setSaveStatus("Click Save to persist.");
            }}
            aria-label="Enable Narrative Builder in NERIS report form"
          />
          Enable Narrative Builder
        </label>
        <p className="narrative-builder-enable-hint">
          When enabled, the NERIS report form will show &quot;Use Narrative Builder&quot; so users can insert a template into the narrative field.
        </p>
      </div>
      <header className="page-header">
        <div>
          <h1>Narrative Builder</h1>
          <p>
            Create templates that combine fixed text, NERIS field values, and user-fillable slots.
            End users can pick a template in the NERIS report form to fill the narrative.
          </p>
        </div>
        <div>
          {loadStatus === "done" && (
            <button type="button" className="primary" onClick={save}>
              Save
            </button>
          )}
          {saveStatus && <span>{saveStatus}</span>}
        </div>
      </header>

      {loadStatus === "loading" && <p>Loading…</p>}
      {loadStatus === "error" && (
        <p className="error">Could not load department details.</p>
      )}

      {loadStatus === "done" && (
        <>
          <div className="narrative-builder-toolbar">
            <button type="button" className="primary" onClick={startAdd}>
              Add new template
            </button>
          </div>

          {isAdding && (
            <div className="panel narrative-builder-editor">
              <h3>New template</h3>
              <label>
                Template name <span className="required">(required)</span>
                <input
                  type="text"
                  value={addNewName}
                  onChange={(e) => setAddNewName(e.target.value)}
                  placeholder="e.g. Standard dispatch narrative"
                />
              </label>
              <SegmentBuilder
                segments={addNewSegments}
                onAddSegment={addSegmentToNew}
                onRemoveSegment={removeSegmentFromNew}
                onMoveSegment={moveSegmentInNew}
                onUpdateSegment={updateSegmentInNew}
              />
              <div className="narrative-builder-preview">
                <strong>Preview:</strong>{" "}
                {addNewSegments.length === 0
                  ? "(Add segments below)"
                  : buildAdminPreview(addNewSegments)}
              </div>
              <div className="narrative-builder-actions">
                <button type="button" className="primary" onClick={commitAdd} disabled={!addNewName.trim()}>
                  Add template
                </button>
                <button type="button" onClick={cancelAdd}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <ul className="narrative-builder-list">
            {templates.map((t) => (
              <li key={t.id} className="panel narrative-builder-item">
                <div className="narrative-builder-item-header">
                  <span className="narrative-builder-item-name">{t.name}</span>
                  <span className="narrative-builder-item-actions">
                    <button
                      type="button"
                      className="rl-box-button"
                      onClick={() => startEdit(t.id)}
                      aria-label={`Edit ${t.name}`}
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="rl-box-button"
                      onClick={() => deleteTemplate(t.id)}
                      aria-label={`Delete ${t.name}`}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
                {editingId === t.id && (
                  <div className="narrative-builder-editor">
                    <SegmentBuilder
                      segments={t.segments}
                      onAddSegment={(seg) =>
                        updateTemplateSegments(t.id, [...t.segments, seg])
                      }
                      onRemoveSegment={(index) =>
                        updateTemplateSegments(
                          t.id,
                          t.segments.filter((_, i) => i !== index),
                        )
                      }
                      onMoveSegment={(index, dir) =>
                        updateTemplateSegments(
                          t.id,
                          moveSegment(t.segments, index, dir),
                        )
                      }
                      onUpdateSegment={(index, seg) =>
                        updateTemplateSegments(
                          t.id,
                          t.segments.map((s, i) => (i === index ? seg : s)),
                        )
                      }
                    />
                    <div className="narrative-builder-preview">
                      <strong>Preview:</strong>{" "}
                      {t.segments.length === 0
                        ? "(No segments)"
                        : buildAdminPreview(t.segments)}
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setEditingId(null)}
                    >
                      Done editing
                    </button>
                  </div>
                )}
                {editingId !== t.id && t.segments.length > 0 && (
                  <p className="narrative-builder-item-preview">
                    {buildAdminPreview(t.segments)}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {templates.length === 0 && !isAdding && (
            <p className="muted">No templates yet. Click &quot;Add new template&quot; to create one.</p>
          )}
        </>
      )}
    </section>
  );
}

interface SegmentBuilderProps {
  segments: NarrativeSegment[];
  onAddSegment: (seg: NarrativeSegment) => void;
  onRemoveSegment: (index: number) => void;
  onMoveSegment: (index: number, dir: "up" | "down") => void;
  onUpdateSegment: (index: number, seg: NarrativeSegment) => void;
}

function SegmentBuilder({
  segments,
  onAddSegment,
  onRemoveSegment,
  onMoveSegment,
  onUpdateSegment,
}: SegmentBuilderProps) {
  const [addKind, setAddKind] = useState<"fillable" | "neris" | "userFillable" | "question">(
    "fillable",
  );
  const [fillableText, setFillableText] = useState("");
  const [nerisFieldId, setNerisFieldId] = useState("");
  const [userHint, setUserHint] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionRows, setQuestionRows] = useState<
    Array<{ answer: string; response: string }>
  >([
    { answer: "", response: "" },
    { answer: "", response: "" },
  ]);

  const handleAddFillable = () => {
    const text = fillableText.trim();
    if (text) {
      onAddSegment({ type: "fillable", text });
      setFillableText("");
    }
  };

  const handleAddNeris = () => {
    const id = nerisFieldId.trim();
    if (id) {
      onAddSegment({ type: "neris", fieldId: id });
      setNerisFieldId("");
    }
  };

  const handleAddUserFillable = () => {
    onAddSegment({ type: "userFillable", placeholderHint: userHint.trim() || undefined });
    setUserHint("");
  };

  const handleAddQuestion = () => {
    const q = questionText.trim();
    const rows = questionRows.map((r) => ({
      answer: r.answer.trim(),
      response: r.response.trim(),
    }));
    if (!q) return;
    if (rows.length < 2) return;
    if (rows.some((r) => !r.answer || !r.response)) return;
    onAddSegment({ type: "question", questionText: q, rows });
    setQuestionText("");
    setQuestionRows([
      { answer: "", response: "" },
      { answer: "", response: "" },
    ]);
  };

  return (
    <div className="segment-builder">
      <div className="segment-builder-add">
        <span>Add segment:</span>
        <select
          value={addKind}
          onChange={(e) =>
            setAddKind(
              e.target.value as "fillable" | "neris" | "userFillable" | "question",
            )
          }
        >
          <option value="fillable">Fillable text</option>
          <option value="neris">NERIS field</option>
          <option value="userFillable">User fillable</option>
          <option value="question">Question (answer → response)</option>
        </select>
        {addKind === "fillable" && (
          <>
            <input
              type="text"
              value={fillableText}
              onChange={(e) => setFillableText(e.target.value)}
              placeholder="Fixed text"
            />
            <button type="button" className="secondary" onClick={handleAddFillable} disabled={!fillableText.trim()}>
              Add
            </button>
          </>
        )}
        {addKind === "neris" && (
          <>
            <select
              value={nerisFieldId}
              onChange={(e) => setNerisFieldId(e.target.value)}
            >
              <option value="">Select NERIS field</option>
              {NERIS_FORM_FIELDS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <button type="button" className="secondary" onClick={handleAddNeris} disabled={!nerisFieldId}>
              Add
            </button>
          </>
        )}
        {addKind === "userFillable" && (
          <>
            <input
              type="text"
              value={userHint}
              onChange={(e) => setUserHint(e.target.value)}
              placeholder="Optional placeholder hint"
            />
            <button type="button" className="secondary" onClick={handleAddUserFillable}>
              Add
            </button>
          </>
        )}
        {addKind === "question" && (
          <>
            <input
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Question text (e.g. occupant location)"
            />
            <div className="segment-question-add-rows">
              {questionRows.map((row, idx) => (
                <div key={idx} className="segment-question-add-row">
                  <input
                    type="text"
                    value={row.answer}
                    onChange={(e) => {
                      const next = [...questionRows];
                      next[idx] = { ...next[idx]!, answer: e.target.value };
                      setQuestionRows(next);
                    }}
                    placeholder={`Answer ${idx + 1}`}
                  />
                  <input
                    type="text"
                    value={row.response}
                    onChange={(e) => {
                      const next = [...questionRows];
                      next[idx] = { ...next[idx]!, response: e.target.value };
                      setQuestionRows(next);
                    }}
                    placeholder={`Response ${idx + 1}`}
                  />
                  <button
                    type="button"
                    className="segment-question-row-remove"
                    onClick={() => {
                      if (questionRows.length <= 2) return;
                      setQuestionRows((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    disabled={questionRows.length <= 2}
                    aria-label={`Remove answer/response row ${idx + 1}`}
                    title={questionRows.length <= 2 ? "Minimum 2 rows" : "Remove row"}
                  >
                    -
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setQuestionRows((prev) => [...prev, { answer: "", response: "" }])
                }
              >
                + Add answer/response
              </button>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={handleAddQuestion}
              disabled={
                !questionText.trim() ||
                questionRows.length < 2 ||
                questionRows.some((r) => !r.answer.trim() || !r.response.trim())
              }
            >
              Add
            </button>
          </>
        )}
      </div>
      <ul className="segment-list">
        {segments.map((seg, index) => (
          <li key={index} className="segment-item">
            <span className="segment-item-move">
              <button
                type="button"
                aria-label="Move up"
                onClick={() => onMoveSegment(index, "up")}
                disabled={index === 0}
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                aria-label="Move down"
                onClick={() => onMoveSegment(index, "down")}
                disabled={index === segments.length - 1}
              >
                <ChevronDown size={16} />
              </button>
            </span>
            <span className="segment-item-content">
              {seg.type === "fillable" && (
                <>
                  <span className="segment-tag fillable">Text</span>
                  <input
                    type="text"
                    value={seg.text}
                    onChange={(e) =>
                      onUpdateSegment(index, { type: "fillable", text: e.target.value })
                    }
                  />
                </>
              )}
              {seg.type === "neris" && (
                <>
                  <span className="segment-tag neris">NERIS</span>
                  <select
                    value={seg.fieldId}
                    onChange={(e) =>
                      onUpdateSegment(index, { type: "neris", fieldId: e.target.value })
                    }
                  >
                    {NERIS_FORM_FIELDS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {seg.type === "userFillable" && (
                <>
                  <span className="segment-tag user">User</span>
                  <input
                    type="text"
                    value={seg.placeholderHint ?? ""}
                    onChange={(e) =>
                      onUpdateSegment(index, {
                        type: "userFillable",
                        placeholderHint: e.target.value.trim() || undefined,
                      })
                    }
                    placeholder="Optional hint"
                  />
                </>
              )}
              {seg.type === "question" && (
                <>
                  <span className="segment-tag question">Question</span>
                  <input
                    type="text"
                    value={seg.questionText}
                    onChange={(e) =>
                      onUpdateSegment(index, {
                        type: "question",
                        questionText: e.target.value,
                        rows: seg.rows,
                      })
                    }
                    placeholder="Question text"
                  />
                  <div className="segment-question-editor-rows">
                    {seg.rows.map((row, idx) => (
                      <div
                        key={idx}
                        className="segment-question-editor-row"
                      >
                        <input
                          type="text"
                          value={row.answer}
                          onChange={(e) => {
                            const nextRows = seg.rows.map((r, i) =>
                              i === idx ? { ...r, answer: e.target.value } : r,
                            );
                            onUpdateSegment(index, {
                              type: "question",
                              questionText: seg.questionText,
                              rows: nextRows,
                            });
                          }}
                          placeholder={`Answer ${idx + 1}`}
                        />
                        <input
                          type="text"
                          value={row.response}
                          onChange={(e) => {
                            const nextRows = seg.rows.map((r, i) =>
                              i === idx ? { ...r, response: e.target.value } : r,
                            );
                            onUpdateSegment(index, {
                              type: "question",
                              questionText: seg.questionText,
                              rows: nextRows,
                            });
                          }}
                          placeholder={`Response ${idx + 1}`}
                        />
                        <button
                          type="button"
                          className="segment-question-row-remove"
                          onClick={() => {
                            if (seg.rows.length <= 2) return;
                            onUpdateSegment(index, {
                              type: "question",
                              questionText: seg.questionText,
                              rows: seg.rows.filter((_, i) => i !== idx),
                            });
                          }}
                          disabled={seg.rows.length <= 2}
                          aria-label={`Remove answer/response row ${idx + 1}`}
                          title={seg.rows.length <= 2 ? "Minimum 2 rows" : "Remove row"}
                        >
                          -
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        onUpdateSegment(index, {
                          type: "question",
                          questionText: seg.questionText,
                          rows: [...seg.rows, { answer: "", response: "" }],
                        })
                      }
                    >
                      + Add answer/response
                    </button>
                  </div>
                </>
              )}
            </span>
            <button
              type="button"
              className="rl-box-button segment-remove"
              onClick={() => onRemoveSegment(index)}
              aria-label="Remove segment"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      {segments.length === 0 && (
        <p className="muted">No segments yet. Add segments above.</p>
      )}
    </div>
  );
}
