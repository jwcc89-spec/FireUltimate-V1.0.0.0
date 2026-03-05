import { SUBMENU_PLACEHOLDER_NOTES, type NavSubmenu } from "./appData";

interface SubmenuPlaceholderPageProps {
  submenu: NavSubmenu;
}

export function SubmenuPlaceholderPage({ submenu }: SubmenuPlaceholderPageProps) {
  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{submenu.label}</h1>
          <p>{submenu.summary}</p>
        </div>
      </header>

      <section className="panel-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h2>Module Status</h2>
          </div>
          <p className="panel-description">
            {submenu.isBuilt
              ? "This submenu includes an initial UI implementation."
              : "This submenu route is connected with a scaffold placeholder and is ready for detailed build-out."}
          </p>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Next Build Steps</h2>
          </div>
          <ul className="activity-list">
            {SUBMENU_PLACEHOLDER_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
}
