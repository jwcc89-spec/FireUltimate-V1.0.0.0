import { useEffect, useState } from "react";
import { getRoleLevel } from "./roleHierarchy";
import { notifyPermissionsChanged } from "./useMyPermissions";

type PolicyRow = {
  permission: string;
  label: string;
  minimumRole: string;
  defaultMinimumRole: string;
};

type AuditRow = {
  id: string;
  actorUsername: string;
  action: string;
  targetUsername: string;
  detail: string;
  createdAt: string;
};

const ROLE_OPTIONS = [
  { value: "user", label: "User" },
  { value: "subadmin", label: "Subadmin" },
  { value: "admin", label: "Admin" },
  { value: "superadmin", label: "Superadmin" },
];

function formatAuditTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    hourCycle: "h23",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RolePermissionsPanel() {
  const [role, setRole] = useState("user");
  const [policy, setPolicy] = useState<PolicyRow[] | null>(null);
  const [hidden, setHidden] = useState(false);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/permissions/policy")
      .then(async (response) => {
        if (response.status === 403) return { forbidden: true as const };
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message || "Could not load who can do what.");
        }
        return (await response.json()) as { role?: string; policy?: PolicyRow[] };
      })
      .then((payload) => {
        if (!active || !payload) return;
        if ("forbidden" in payload) {
          setHidden(true);
          return;
        }
        setRole(payload.role || "user");
        setPolicy(payload.policy ?? []);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load who can do what.");
      });
    fetch("/api/account-audit")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { entries?: AuditRow[] };
      })
      .then((payload) => {
        if (active && payload) setAudit(payload.entries ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (hidden) return null;
  if (!policy) {
    return error ? <p className="auth-error">{error}</p> : null;
  }

  const actorLevel = getRoleLevel(role);
  const choices = ROLE_OPTIONS.filter((option) => getRoleLevel(option.value) <= actorLevel);

  const saveMinimum = (permission: string, minimumRole: string) => {
    setError("");
    setSaved("");
    fetch("/api/permissions/policy", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ permission, minimumRole }),
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
          policy?: PolicyRow[];
        } | null;
        if (!response.ok) {
          throw new Error(body?.message || "That permission was not saved.");
        }
        setPolicy(body?.policy ?? policy);
        setSaved("Saved.");
        notifyPermissionsChanged();
      })
      .catch((saveError: unknown) => {
        setError(saveError instanceof Error ? saveError.message : "That permission was not saved.");
      });
  };

  return (
    <div className="panel" style={{ marginBottom: "0.75rem" }}>
      <div className="panel-header">
        <h3>Who can do what</h3>
      </div>
      <div className="settings-form">
        <p className="field-hint">
          Pick the lowest role allowed for each action. A higher role can still do it. You can set
          an action to your role or a lower role. By default, only admins can create an incident
          by hand, send a NERIS report, and send a NERIS report for billing.
        </p>
        {policy.map((row) => {
          const canEdit = actorLevel >= getRoleLevel(row.minimumRole);
          return (
            <label key={row.permission}>
              {row.label}
              {canEdit ? (
                <select
                  value={row.minimumRole}
                  aria-label={row.label}
                  onChange={(event) => saveMinimum(row.permission, event.target.value)}
                >
                  {choices.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={ROLE_OPTIONS.find((option) => option.value === row.minimumRole)?.label ?? row.minimumRole}
                  readOnly
                  aria-label={row.label}
                />
              )}
            </label>
          );
        })}
        {error ? <p className="auth-error">{error}</p> : null}
        {saved ? <p className="save-message">{saved}</p> : null}
        {audit ? (
          <>
            <h3>Recent account changes</h3>
            {audit.length === 0 ? (
              <p className="field-hint">No account changes have been recorded yet.</p>
            ) : (
              <ul className="settings-list">
                {audit.map((entry) => (
                  <li key={entry.id}>
                    {formatAuditTime(entry.createdAt)} CT — {entry.actorUsername} {entry.action}{" "}
                    {entry.targetUsername}. {entry.detail}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
