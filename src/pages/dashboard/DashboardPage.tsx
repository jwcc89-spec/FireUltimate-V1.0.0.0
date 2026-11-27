import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import ReactGridLayout, { useContainerWidth, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { GripVertical, LayoutGrid, Plus, X } from "lucide-react";
import {
  getDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
  saveDepartmentDashboardLayout,
  type DashboardItem,
  type DashboardLayoutResult,
  type DashboardWidgetId,
} from "../../api/dashboard";
import { useMyPermissions } from "../../useMyPermissions";
import { errorText } from "../maintenance/maintenanceUtils";
import { DashboardWidgetBody } from "./DashboardWidgets";
import {
  addWidget,
  DASHBOARD_COLS,
  DASHBOARD_ROW_HEIGHT,
  sameLayout,
  stackedLayout,
  WIDGET_BY_ID,
  WIDGET_LINKS,
  WIDGETS,
} from "./widgetCatalog";

/** Below this width the dashboard shows one column and can't be edited. */
const STACK_BELOW_PX = 760;

const SOURCE_TEXT: Record<DashboardLayoutResult["source"], string> = {
  user: "Showing your saved layout.",
  department: "Showing the department default layout.",
  builtIn: "Showing the standard layout.",
};

function toItems(layout: Layout): DashboardItem[] {
  return layout.map(({ i, x, y, w, h }) => ({ i: i as DashboardWidgetId, x, y, w, h }));
}

/**
 * Drag-and-resize dashboard. Each member saves their own layout; admins can save one as the department default.
 * Widgets only read data; nothing on this page changes a record.
 */
export function DashboardPage({ alerts, footer }: { alerts?: ReactNode; footer?: ReactNode }) {
  const grants = useMyPermissions();
  const { width, containerRef, mounted } = useContainerWidth();
  const [result, setResult] = useState<DashboardLayoutResult | null>(null);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<DashboardItem[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getDashboardLayout()
      .then((next) => {
        if (active) setResult(next);
      })
      .catch((loadFailure) => {
        if (active) setLoadError(errorText(loadFailure, "The dashboard layout could not be loaded."));
      });
    return () => {
      active = false;
    };
  }, []);

  const editing = draft !== null;
  const stacked = mounted && width < STACK_BELOW_PX;
  const items = useMemo(() => draft ?? result?.items ?? [], [draft, result]);
  const shownLayout = useMemo(
    () => (stacked ? stackedLayout(items) : items).map((item) => ({ ...item, minW: 2, minH: 2 })),
    [items, stacked],
  );
  const missing = WIDGETS.filter((widget) => !items.some((item) => item.i === widget.id));
  const canReviewChecks = grants?.["inventory.manage"] === true;
  const canManageEvents = grants?.["displays.manage"] === true;

  const startEditing = () => {
    setDraft(result?.items ?? []);
    setNotice("");
    setError("");
  };

  const stopEditing = () => {
    setDraft(null);
    setAddOpen(false);
  };

  const run = async (action: () => Promise<DashboardLayoutResult>, done: string) => {
    setBusy(true);
    setError("");
    try {
      setResult(await action());
      setNotice(done);
      stopEditing();
    } catch (saveError) {
      setError(errorText(saveError, "The dashboard layout could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const removeWidget = (id: DashboardWidgetId) => setDraft((previous) => (previous ?? []).filter((item) => item.i !== id));

  return (
    <section className="page-section neris-report-page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{result ? SOURCE_TEXT[result.source] : "Current status across call activity, readiness, and high-priority updates."}</p>
        </div>
        <div className="header-actions">
          {editing ? (
            <>
              <div className="edit-display-wrap">
                <button
                  type="button"
                  className="secondary-button compact-button maintenance-icon-button"
                  disabled={missing.length === 0}
                  onClick={() => setAddOpen((open) => !open)}
                >
                  <Plus size={15} aria-hidden="true" /> Add widget
                </button>
                {addOpen ? (
                  <div className="edit-display-dropdown">
                    <p>Add a widget to the bottom of the dashboard.</p>
                    <ul>
                      {missing.map((widget) => (
                        <li key={widget.id}>
                          <button
                            type="button"
                            className="dashboard-add-option"
                            onClick={() => {
                              setDraft((previous) => addWidget(previous ?? [], widget.id));
                              setAddOpen(false);
                            }}
                          >
                            <strong>{widget.title}</strong>
                            <span>{widget.description}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              {result?.source === "user" ? (
                <button
                  type="button"
                  className="secondary-button compact-button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      resetDashboardLayout,
                      result.hasDepartmentDefault ? "Your dashboard now uses the department default." : "Your dashboard now uses the standard layout.",
                    )
                  }
                >
                  {result.hasDepartmentDefault ? "Reset to department default" : "Reset to standard layout"}
                </button>
              ) : null}
              {result?.canSetDefault ? (
                <button
                  type="button"
                  className="secondary-button compact-button"
                  disabled={busy}
                  onClick={() => void run(() => saveDepartmentDashboardLayout(draft ?? []), "Saved as the department default for everyone without their own layout.")}
                >
                  Save as department default
                </button>
              ) : null}
              <button type="button" className="secondary-button compact-button" disabled={busy} onClick={stopEditing}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button compact-button"
                disabled={busy || (result != null && result.source === "user" && sameLayout(draft ?? [], result.items))}
                onClick={() => void run(() => saveDashboardLayout(draft ?? []), "Your dashboard layout was saved.")}
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="secondary-button compact-button maintenance-icon-button"
                disabled={!result || stacked}
                title={stacked ? "Edit the layout on a wider screen." : undefined}
                onClick={startEditing}
              >
                <LayoutGrid size={15} aria-hidden="true" /> Edit layout
              </button>
              <NavLink className="primary-button button-link" to="/incidents-mapping/incidents">
                Open Incidents
              </NavLink>
            </>
          )}
        </div>
      </header>

      {editing ? (
        <p className="dashboard-edit-hint">
          Drag a widget by its title bar. Resize from its bottom-right corner. Remove it with the X. Save when you are done.
        </p>
      ) : null}
      {notice ? <p className="field-hint">{notice}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
      {loadError ? <p className="field-error">{loadError}</p> : null}

      {alerts}

      <div ref={containerRef} className={`dashboard-grid${editing ? " is-editing" : ""}`}>
        {result && mounted ? (
          items.length === 0 ? (
            <article className="panel">
              <p className="field-hint">
                {editing ? "Use Add widget to put widgets on your dashboard." : "No widgets on this dashboard. Use Edit layout to add some."}
              </p>
            </article>
          ) : (
            <ReactGridLayout
              width={width}
              layout={shownLayout}
              gridConfig={{ cols: stacked ? 1 : DASHBOARD_COLS, rowHeight: DASHBOARD_ROW_HEIGHT, margin: [12, 12], containerPadding: [0, 0] }}
              dragConfig={{ enabled: editing && !stacked, handle: ".dashboard-widget-header", cancel: ".dashboard-widget-remove" }}
              resizeConfig={{ enabled: editing && !stacked }}
              onLayoutChange={(layout) => {
                if (editing && !stacked) setDraft(toItems(layout));
              }}
            >
              {items.map((item) => {
                const info = WIDGET_BY_ID.get(item.i);
                const link = WIDGET_LINKS[item.i];
                return (
                  <div key={item.i} className="panel dashboard-widget">
                    <div className="dashboard-widget-header">
                      {editing ? <GripVertical size={14} aria-hidden="true" className="dashboard-widget-grip" /> : null}
                      <h2>{link && !editing ? <NavLink to={link}>{info?.title}</NavLink> : info?.title}</h2>
                      {editing ? (
                        <button
                          type="button"
                          className="dashboard-widget-remove"
                          aria-label={`Remove ${info?.title ?? "widget"}`}
                          onClick={() => removeWidget(item.i)}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    <div className="dashboard-widget-body">
                      <DashboardWidgetBody id={item.i} canReviewChecks={canReviewChecks} canManageEvents={canManageEvents} />
                    </div>
                  </div>
                );
              })}
            </ReactGridLayout>
          )
        ) : null}
      </div>

      {footer}
    </section>
  );
}
