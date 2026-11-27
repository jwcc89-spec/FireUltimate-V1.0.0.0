import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronRight, Search } from "lucide-react";
import { getPolicies, getPolicyCategories, type PolicyCategory, type PolicyKind, type PolicySummary } from "../../api/policies";
import { errorText } from "../maintenance/maintenanceUtils";
import { PolicyView } from "./PolicyView";
import { issuedText } from "./policyUtils";

function PolicyRow({ policy, selected, onPick }: { policy: PolicySummary; selected: boolean; onPick: (id: string) => void }) {
  return (
    <li>
      <button type="button" className={`policy-list-row ${selected ? "policy-list-row-active" : ""}`} onClick={() => onPick(policy.id)}>
        <span className="policy-list-icon">
          {policy.myAck === "needed" ? (
            <AlertTriangle size={15} className="policy-icon-needed" aria-label="Needs your acknowledgment" />
          ) : policy.myAck === "acknowledged" ? (
            <CheckCircle2 size={15} className="policy-icon-done" aria-label="Acknowledged" />
          ) : null}
        </span>
        <span className="policy-list-text">
          <strong>
            {policy.number ? `${policy.number} ` : ""}
            {policy.title}
          </strong>
          <span className="field-hint">
            {policy.status === "published" ? `Issued ${issuedText(policy.publishedAt)}` : policy.status === "archived" ? "Archived" : "Draft"}
          </span>
        </span>
      </button>
    </li>
  );
}

export function PolicyLibraryPage({ kind }: { kind: PolicyKind }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("policy") ?? "";
  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [searchResults, setSearchResults] = useState<PolicySummary[] | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isDtb = kind === "dtb";
  const noun = isDtb ? "DTB" : "policy";

  const load = useCallback(() => {
    Promise.all([getPolicyCategories(isDtb ? "dtb" : "manual"), getPolicies(kind)])
      .then(([chapterRows, policyResult]) => {
        setCategories(chapterRows);
        setPolicies(policyResult.rows.filter((row) => row.status !== "archived"));
      })
      .catch((loadError) => setError(errorText(loadError, "Could not load policies.")))
      .finally(() => setLoading(false));
  }, [isDtb, kind]);

  useEffect(load, [load]);

  useEffect(() => {
    const query = search.trim();
    if (!query) return;
    const timer = window.setTimeout(() => {
      getPolicies(kind, query)
        .then((result) => setSearchResults(result.rows.filter((row) => row.status !== "archived")))
        .catch((searchError) => setError(errorText(searchError, "Search failed.")));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [kind, search]);

  const groups = useMemo(() => {
    const known = new Set(categories.map((category) => category.id));
    const list = categories.map((category) => ({
      id: category.id,
      label: `${category.number}. ${category.title}`,
      rows: policies.filter((policy) => policy.categoryId === category.id),
    }));
    const loose = policies.filter((policy) => !policy.categoryId || !known.has(policy.categoryId));
    if (loose.length > 0) list.push({ id: "", label: categories.length ? "Other" : isDtb ? "All DTB's" : "All Policies", rows: loose });
    return list;
  }, [categories, isDtb, policies]);

  const results = search.trim() ? searchResults : null;
  const needed = policies.filter((policy) => policy.myAck === "needed");
  const selectedGroup = groups.find((group) => group.rows.some((row) => row.id === selectedId))?.id;
  const isOpen = (id: string) => open[id] ?? (id === selectedGroup || groups.length === 1);
  const pick = (id: string) => setSearchParams(id ? { policy: id } : {});

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>{isDtb ? "DTB's" : "Policy Manual"}</h1>
          <p>
            {isDtb
              ? "Daily Training Bulletins. Read the ones assigned to you and click Acknowledge."
              : "Department policies by chapter. A warning icon means the policy needs your acknowledgment."}
          </p>
        </div>
        <div className="header-actions">
          <Link className="secondary-button compact-button" to="/policies">
            Policies Home
          </Link>
        </div>
      </header>
      {error ? <p className="field-error">{error}</p> : null}

      <div className="policy-library">
        <aside className="panel policy-library-nav">
          <label className="policy-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              placeholder={`Search ${isDtb ? "DTB's" : "the manual"}...`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={`Search ${isDtb ? "DTB's" : "the manual"}`}
            />
          </label>
          {loading ? <p className="field-hint">Loading...</p> : null}

          {results ? (
            <>
              <h3 className="policy-nav-heading">
                {results.length} result{results.length === 1 ? "" : "s"}
              </h3>
              <ul className="policy-list">
                {results.map((policy) => (
                  <PolicyRow key={policy.id} policy={policy} selected={policy.id === selectedId} onPick={pick} />
                ))}
              </ul>
            </>
          ) : (
            <>
              {needed.length > 0 ? (
                <>
                  <h3 className="policy-nav-heading">Needs Your Acknowledgment ({needed.length})</h3>
                  <ul className="policy-list">
                    {needed.map((policy) => (
                      <PolicyRow key={policy.id} policy={policy} selected={policy.id === selectedId} onPick={pick} />
                    ))}
                  </ul>
                </>
              ) : null}
              {groups.map((group) => (
                <div key={group.id || "loose"} className="policy-chapter">
                  <button
                    type="button"
                    className="policy-chapter-toggle"
                    aria-expanded={isOpen(group.id)}
                    onClick={() => setOpen((current) => ({ ...current, [group.id]: !isOpen(group.id) }))}
                  >
                    {isOpen(group.id) ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                    <span>{group.label}</span>
                    <span className="field-hint">{group.rows.length}</span>
                  </button>
                  {isOpen(group.id) ? (
                    <ul className="policy-list">
                      {group.rows.length === 0 ? <li className="field-hint policy-list-empty">Nothing in this chapter yet.</li> : null}
                      {group.rows.map((policy) => (
                        <PolicyRow key={policy.id} policy={policy} selected={policy.id === selectedId} onPick={pick} />
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
              {!loading && groups.length === 0 ? <p className="field-hint">No {isDtb ? "DTB's" : "policies"} have been published yet.</p> : null}
            </>
          )}
        </aside>

        <div className="policy-library-main">
          {selectedId ? (
            <PolicyView key={selectedId} policyId={selectedId} onChanged={load} />
          ) : (
            <article className="panel policy-library-empty">
              <BookOpen size={28} aria-hidden="true" />
              <h3>Pick a {noun} on the left</h3>
              <p className="field-hint">
                {needed.length > 0
                  ? `You have ${needed.length} ${needed.length === 1 ? noun : `${noun === "policy" ? "policies" : "DTB's"}`} to acknowledge.`
                  : "You are all caught up."}
              </p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
