import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** CLICKABLE-LIST table for the operations modules: TH-SORT headers, drag-to-resize, column reorder. */

export interface ModuleTableColumn<T> {
  id: string;
  label: string;
  width?: number;
  render: (row: T) => ReactNode;
  /** Value used for sorting. Leave out to make the column unsortable. */
  value?: (row: T) => string | number;
}

interface ModuleTableProps<T> {
  tableId: string;
  columns: ModuleTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyText: string;
  defaultSort?: { id: string; direction: "asc" | "desc" };
  /** Shown on the left of the Edit Columns row, for example filter chips. */
  toolbarStart?: ReactNode;
}

interface StoredLayout {
  order?: string[];
  widths?: Record<string, number>;
}

const MIN_COLUMN_WIDTH = 70;
const DEFAULT_COLUMN_WIDTH = 160;

function readLayout(tableId: string): StoredLayout {
  try {
    const raw = window.localStorage.getItem(`fu.table.${tableId}`);
    return raw ? (JSON.parse(raw) as StoredLayout) : {};
  } catch {
    return {};
  }
}

function writeLayout(tableId: string, layout: StoredLayout): void {
  try {
    window.localStorage.setItem(`fu.table.${tableId}`, JSON.stringify(layout));
  } catch {
    // Storage full or blocked: the layout just isn't remembered.
  }
}

export function ModuleTable<T>({
  tableId,
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyText,
  defaultSort,
  toolbarStart,
}: ModuleTableProps<T>) {
  const [layout, setLayout] = useState<StoredLayout>(() => readLayout(tableId));
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" } | null>(defaultSort ?? null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);
  const resizeRef = useRef<{ id: string; startX: number; startWidth: number } | null>(null);
  const layoutRef = useRef(layout);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const orderedColumns = useMemo(() => {
    const byId = new Map(columns.map((column) => [column.id, column]));
    const ordered = (layout.order ?? [])
      .map((id) => byId.get(id))
      .filter((column): column is ModuleTableColumn<T> => Boolean(column));
    for (const column of columns) {
      if (!ordered.includes(column)) ordered.push(column);
    }
    return ordered;
  }, [columns, layout.order]);

  const widthOf = (column: ModuleTableColumn<T>) =>
    layout.widths?.[column.id] ?? column.width ?? DEFAULT_COLUMN_WIDTH;

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const active = resizeRef.current;
      if (!active) return;
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, active.startWidth + event.clientX - active.startX);
      setLayout((previous) => ({ ...previous, widths: { ...previous.widths, [active.id]: nextWidth } }));
    };
    const handleUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      document.body.classList.remove("resizing-dispatch-columns");
      writeLayout(tableId, layoutRef.current);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      document.body.classList.remove("resizing-dispatch-columns");
    };
  }, [tableId]);

  const startResize = (column: ModuleTableColumn<T>, event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { id: column.id, startX: event.clientX, startWidth: widthOf(column) };
    document.body.classList.add("resizing-dispatch-columns");
  };

  const handleSort = (columnId: string) => {
    setSort((previous) =>
      previous?.id === columnId
        ? { id: columnId, direction: previous.direction === "asc" ? "desc" : "asc" }
        : { id: columnId, direction: "asc" },
    );
  };

  const handleColumnDrop = (targetId: string) => {
    if (!dragColumnId || dragColumnId === targetId) return;
    const ids = orderedColumns.map((column) => column.id);
    const from = ids.indexOf(dragColumnId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ...ids.splice(from, 1));
    const next = { ...layout, order: ids };
    setLayout(next);
    writeLayout(tableId, next);
    setDragColumnId(null);
  };

  const visibleRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((entry) => entry.id === sort.id);
    if (!column?.value) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = column.value!(a);
      const right = column.value!(b);
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * factor;
    });
  }, [columns, rows, sort]);

  return (
    <div className="module-table">
      <div className="module-table-toolbar">
        <div className="module-table-toolbar-start">{toolbarStart}</div>
        <button
          type="button"
          className={`secondary-button compact-button ${editorOpen ? "department-toggle-active" : ""}`}
          onClick={() => setEditorOpen((previous) => !previous)}
        >
          Edit Columns
        </button>
      </div>
      {editorOpen ? (
        <div className="field-editor-panel">
          <p>Drag rows using the handle to reorder the columns.</p>
          <ul className="drag-order-list">
            {orderedColumns.map((column) => (
              <li
                key={`${tableId}-order-${column.id}`}
                draggable
                onDragStart={() => setDragColumnId(column.id)}
                onDragEnd={() => setDragColumnId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleColumnDrop(column.id)}
              >
                <div className="drag-order-row">
                  <span>{column.label}</span>
                  <span className="drag-handle" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="table-wrapper">
        <table className="module-table-grid">
          <colgroup>
            {orderedColumns.map((column) => (
              <col key={column.id} style={{ width: `${widthOf(column)}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {orderedColumns.map((column) => (
                <th key={column.id}>
                  <div className="user-table-header-control">
                    {column.value ? (
                      <button
                        type="button"
                        className={`table-sort-button module-table-sort-button ${sort?.id === column.id ? "table-sort-button-active" : ""}`}
                        onClick={() => handleSort(column.id)}
                        aria-label={`Sort by ${column.label}`}
                      >
                        <span>{column.label}</span>
                        {sort?.id === column.id ? (
                          <span className={`table-sort-glyph table-sort-glyph-${sort.direction}`} aria-hidden="true">
                            <span />
                            <span />
                            <span />
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      <span>{column.label}</span>
                    )}
                    <span
                      className="dispatch-column-resizer user-table-column-resizer"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${column.label} column`}
                      title={`Drag to resize ${column.label} column`}
                      onPointerDown={(event) => startResize(column, event)}
                    >
                      |
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={orderedColumns.length} className="module-table-empty">
                  {emptyText}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={onRowClick ? "clickable-row" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter") onRowClick(row);
                        }
                      : undefined
                  }
                >
                  {orderedColumns.map((column) => (
                    <td key={column.id}>{column.render(row)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="field-hint">{`${rows.length} ${rows.length === 1 ? "item" : "items"}`}</p>
    </div>
  );
}
