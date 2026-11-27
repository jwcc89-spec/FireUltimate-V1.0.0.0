import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Move, RotateCcw } from "lucide-react";
import { BOARD_PANELS, type BoardLayout, type BoardPanel, type DisplayBoard, type GridBox } from "../../api/displays";
import { DEFAULT_LAYOUT, fits, freeSpot, GRID_SIZE, MIN_SPAN, placeLayout } from "./boardLayout";

const CELLS = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => index);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function panelLabel(key: BoardPanel): string {
  return BOARD_PANELS.find((panel) => panel.value === key)?.label ?? key;
}

/**
 * The whole board as an 8 by 8 grid. Drag a panel to move it; drag its corner to resize it.
 * Panels snap to whole squares, stay at least 2 by 2, and never overlap.
 */
export function BoardLayoutEditor({
  board,
  canManage,
  saving,
  error,
  onSave,
  onClose,
}: {
  board: DisplayBoard;
  canManage: boolean;
  saving: boolean;
  error: string;
  onSave: (layout: BoardLayout) => void;
  onClose: () => void;
}) {
  const [initial] = useState(() => placeLayout(board.panels, board.layout));
  const [draft, setDraft] = useState<BoardLayout>(initial.placed);
  const [unplaced, setUnplaced] = useState<BoardPanel[]>(initial.unplaced);
  const [notice, setNotice] = useState("");
  const [drag, setDrag] = useState<{ key: BoardPanel; mode: "move" | "resize"; startX: number; startY: number; box: GridBox } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = Math.round(((event.clientX - drag.startX) / rect.width) * GRID_SIZE);
      const dy = Math.round(((event.clientY - drag.startY) / rect.height) * GRID_SIZE);
      const { box } = drag;
      const next =
        drag.mode === "move"
          ? { ...box, x: clamp(box.x + dx, 0, GRID_SIZE - box.w), y: clamp(box.y + dy, 0, GRID_SIZE - box.h) }
          : { ...box, w: clamp(box.w + dx, MIN_SPAN, GRID_SIZE - box.x), h: clamp(box.h + dy, MIN_SPAN, GRID_SIZE - box.y) };
      setDraft((current) => (fits(next, current, drag.key) ? { ...current, [drag.key]: next } : current));
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag]);

  const start = (key: BoardPanel, mode: "move" | "resize") => (event: ReactPointerEvent) => {
    const box = draft[key];
    if (!canManage || !box) return;
    event.preventDefault();
    event.stopPropagation();
    setNotice("");
    setDrag({ key, mode, startX: event.clientX, startY: event.clientY, box });
  };

  const addPanel = (key: BoardPanel) => {
    const slot = freeSpot(draft);
    if (!slot) {
      setNotice("There is no empty 2 by 2 space. Make a panel smaller first.");
      return;
    }
    setDraft({ ...draft, [key]: slot });
    setUnplaced(unplaced.filter((item) => item !== key));
  };

  const reset = () => {
    const next = placeLayout(board.panels, DEFAULT_LAYOUT);
    setDraft(next.placed);
    setUnplaced(next.unplaced);
    setNotice("");
  };

  const placed = Object.entries(draft) as [BoardPanel, GridBox][];

  return (
    <article className="panel">
      <div className="panel-header">
        <h2>Layout: {board.name}</h2>
        <div className="header-actions">
          <button type="button" className="secondary-button compact-button maintenance-icon-button" onClick={onClose}>
            <ArrowLeft size={15} aria-hidden="true" /> Back to boards
          </button>
          {canManage ? (
            <>
              <button type="button" className="secondary-button compact-button maintenance-icon-button" onClick={reset}>
                <RotateCcw size={15} aria-hidden="true" /> Reset to default
              </button>
              <button type="button" className="primary-button compact-button" disabled={saving} onClick={() => onSave(draft)}>
                {saving ? "Saving..." : "Save layout"}
              </button>
            </>
          ) : null}
        </div>
      </div>
      <p className="field-hint">
        The board below the header is split into 8 by 8 squares. Drag a panel to move it. Drag the corner to resize it. Each panel is at
        least 2 by 2, and panels cannot overlap. Turn panels on or off in Edit board.
      </p>
      {error ? <p className="field-error">{error}</p> : null}
      {notice ? <p className="field-error">{notice}</p> : null}
      {unplaced.length > 0 ? (
        <div className="header-actions">
          <span className="field-hint">Not on the board yet:</span>
          {unplaced.map((key) => (
            <button key={key} type="button" className="secondary-button compact-button" disabled={!canManage} onClick={() => addPanel(key)}>
              Add {panelLabel(key)}
            </button>
          ))}
        </div>
      ) : null}
      <div className="board-layout-preview">
        <div className="board-layout-header">
          <span>Department name and logo</span>
          <span>Clock</span>
        </div>
        <div className="board-layout-grid" ref={gridRef}>
          {CELLS.map((cell) => (
            <span key={cell} className="board-layout-cell" />
          ))}
          {placed.map(([key, box]) => (
            <div
              key={key}
              className={drag?.key === key ? "board-layout-box board-layout-box-active" : "board-layout-box"}
              style={{
                left: `${(box.x / GRID_SIZE) * 100}%`,
                top: `${(box.y / GRID_SIZE) * 100}%`,
                width: `${(box.w / GRID_SIZE) * 100}%`,
                height: `${(box.h / GRID_SIZE) * 100}%`,
              }}
              onPointerDown={start(key, "move")}
            >
              <strong>
                <Move size={14} aria-hidden="true" /> {panelLabel(key)}
              </strong>
              <span>
                {box.w} × {box.h}
              </span>
              {canManage ? (
                <span className="board-layout-handle" aria-label={`Resize ${panelLabel(key)}`} onPointerDown={start(key, "resize")} />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
