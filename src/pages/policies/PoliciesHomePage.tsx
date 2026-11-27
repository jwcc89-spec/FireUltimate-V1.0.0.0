import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BookOpen, CheckCircle2, GraduationCap } from "lucide-react";
import { getPoliciesHome, policyLabel, type PoliciesHome, type PolicySummary } from "../../api/policies";
import { errorText, formatDateKey, formatTimestamp24 } from "../maintenance/maintenanceUtils";
import { issuedText, libraryPath } from "./policyUtils";

function HomeList({ rows, done, emptyText }: { rows: PolicySummary[]; done: boolean; emptyText: string }) {
  if (rows.length === 0) return <p className="field-hint">{emptyText}</p>;
  return (
    <ul className="policy-home-list">
      {rows.map((policy) => (
        <li key={policy.id}>
          {done ? (
            <CheckCircle2 size={16} className="policy-icon-done" aria-hidden="true" />
          ) : (
            <AlertTriangle size={16} className="policy-icon-needed" aria-hidden="true" />
          )}
          <Link to={libraryPath(policy.kind, policy.id)}>{policyLabel(policy)}</Link>
          <span className="field-hint">
            {done
              ? `Acknowledged ${formatTimestamp24(policy.acknowledgedAt)}`
              : [policy.dueDate ? `Due ${formatDateKey(policy.dueDate)}` : "", `Issued ${issuedText(policy.publishedAt)}`].filter(Boolean).join(" · ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PoliciesHomePage() {
  const [home, setHome] = useState<PoliciesHome | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getPoliciesHome()
      .then(setHome)
      .catch((loadError) => setError(errorText(loadError, "Could not load policies.")));
  }, []);

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Policies</h1>
          <p>What you need to read and acknowledge. Open the Manual for every department policy.</p>
        </div>
        <div className="header-actions">
          <Link className="secondary-button maintenance-icon-button" to="/policies/manual">
            <BookOpen size={15} aria-hidden="true" /> Manual
          </Link>
          <Link className="secondary-button maintenance-icon-button" to="/policies/dtbs">
            <GraduationCap size={15} aria-hidden="true" /> DTB's
          </Link>
        </div>
      </header>
      {error ? <p className="field-error">{error}</p> : null}
      {!home && !error ? <p className="field-hint">Loading...</p> : null}
      {home ? (
        <div className="policy-home">
          <article className="panel">
            <h3>
              User Acknowledgements
              {home.needed.length > 0 ? <span className="policy-count-badge">{home.needed.length}</span> : null}
            </h3>
            <HomeList rows={home.needed} done={false} emptyText="No policies are waiting for your acknowledgment." />
            {home.acknowledged.length > 0 ? (
              <>
                <h4>Recently Acknowledged</h4>
                <HomeList rows={home.acknowledged.slice(0, 8)} done emptyText="" />
              </>
            ) : null}
          </article>
          <article className="panel">
            <h3>
              DTB's
              {home.dtbs.length > 0 ? <span className="policy-count-badge">{home.dtbs.length}</span> : null}
            </h3>
            <HomeList rows={home.dtbs} done={false} emptyText="No DTB's are assigned to you right now." />
            {home.dtbsDone.length > 0 ? (
              <>
                <h4>Recently Completed</h4>
                <HomeList rows={home.dtbsDone.slice(0, 8)} done emptyText="" />
              </>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
