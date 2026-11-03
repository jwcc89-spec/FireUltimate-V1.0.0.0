import { useCallback, useEffect, useMemo, useState } from "react";
import { ScheduleNoticeDialog } from "./ScheduleNoticeDialog";

type TradeStatus = "requested" | "accepted" | "denied";

interface TradeRecord {
  id: string;
  shiftType: string;
  requesterUsername: string;
  requesterName: string;
  counterpartUsername: string;
  counterpartName: string;
  tradeDate: string;
  startTime: string;
  endTime: string;
  paybackRequired: boolean;
  paybackDate: string;
  reason: string;
  status: TradeStatus;
  denialReason: string;
}

interface RosterEntry {
  name: string;
  shift: string;
}

const MY_TRADES_FILTER = "__mine__";
const ALL_TRADES_FILTER = "__all__";

const EMPTY_DRAFT = {
  counterpartName: "",
  tradeDate: "",
  startTime: "",
  endTime: "",
  paybackRequired: false,
  paybackDate: "",
  reason: "",
};

/** Turns 8, 0800, 8:00 or 800 into 08:00. Returns "" when it cannot. */
function normalizeTime24(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const padded = digits.length <= 2 ? `${digits.padStart(2, "0")}00` : digits.padStart(4, "0").slice(0, 4);
  const hours = Number(padded.slice(0, 2));
  const minutes = Number(padded.slice(2, 4));
  if (hours > 23 || minutes > 59) return "";
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
}

function statusLabel(trade: TradeRecord): string {
  if (trade.status === "requested") return `Waiting on ${trade.counterpartName}`;
  if (trade.status === "accepted") return "Accepted";
  if (trade.status === "denied") return "Denied";
  return trade.status;
}

export function PersonnelTradesPage() {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [username, setUsername] = useState("");
  const [myName, setMyName] = useState("");
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [filter, setFilter] = useState(ALL_TRADES_FILTER);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [denyReasons, setDenyReasons] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadTrades = useCallback(async () => {
    const response = await fetch("/api/trades");
    const json = (await response.json().catch(() => null)) as {
      ok?: boolean;
      canSeeAll?: boolean;
      username?: string;
      name?: string;
      trades?: TradeRecord[];
      message?: string;
    } | null;
    if (!response.ok || !json?.ok) {
      setNotice(json?.message || "Trades could not be loaded.");
      return;
    }
    setTrades(Array.isArray(json.trades) ? json.trades : []);
    setCanSeeAll(json.canSeeAll === true);
    setUsername(String(json.username ?? ""));
    setMyName(String(json.name ?? ""));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadTrades();
      const response = await fetch("/api/department-details");
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        data?: { schedulerPersonnelRecords?: unknown };
      } | null;
      if (cancelled || !json?.ok) return;
      const records = Array.isArray(json.data?.schedulerPersonnelRecords)
        ? (json.data.schedulerPersonnelRecords as Array<Record<string, unknown>>)
        : [];
      setRoster(
        records
          .map((record) => ({
            name: String(record?.name ?? "").trim(),
            shift: String(record?.shift ?? "").split("|")[0].trim(),
          }))
          .filter((entry) => entry.name)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTrades]);

  const shiftOptions = useMemo(() => {
    const names = new Set<string>();
    for (const entry of roster) if (entry.shift) names.add(entry.shift);
    for (const trade of trades) if (trade.shiftType) names.add(trade.shiftType);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [roster, trades]);

  const visibleTrades = useMemo(() => {
    if (!canSeeAll || filter === ALL_TRADES_FILTER) return trades;
    if (filter === MY_TRADES_FILTER) {
      return trades.filter(
        (trade) => trade.requesterUsername === username || trade.counterpartUsername === username,
      );
    }
    return trades.filter((trade) => trade.shiftType === filter);
  }, [canSeeAll, filter, trades, username]);

  const submitRequest = async () => {
    const startTime = normalizeTime24(draft.startTime);
    const endTime = normalizeTime24(draft.endTime);
    if (!draft.counterpartName) {
      setNotice("Choose who you are trading with.");
      return;
    }
    if (!draft.tradeDate) {
      setNotice("Enter your assigned date.");
      return;
    }
    if (!startTime || !endTime) {
      setNotice("Enter start and end times in 24-hour format, for example 08:00 and 10:00.");
      return;
    }
    if (draft.paybackRequired && !draft.paybackDate) {
      setNotice("Payback is required, so enter the date you work instead.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, startTime, endTime }),
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !json?.ok) {
        setNotice(json?.message || "The trade request could not be sent.");
        return;
      }
      setDraft(EMPTY_DRAFT);
      await loadTrades();
      setNotice(`Trade request sent to ${draft.counterpartName}.`);
    } finally {
      setIsSaving(false);
    }
  };

  const answerTrade = async (trade: TradeRecord, action: "accept" | "deny") => {
    const denialReason = (denyReasons[trade.id] ?? "").trim();
    if (action === "deny" && !denialReason) {
      setNotice("Enter a reason before denying.");
      return;
    }
    const response = await fetch(`/api/trades/${encodeURIComponent(trade.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, denialReason }),
    });
    const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (!response.ok || !json?.ok) {
      setNotice(json?.message || "The trade could not be updated.");
      return;
    }
    await loadTrades();
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <h1>Trades</h1>
        <p>Ask another member to cover part or all of a shift you are scheduled to work.</p>
      </header>
      <article className="panel">
        <h3>New Trade Request</h3>
        <div className="department-edit-grid">
          <label>
            Trade With
            <select
              value={draft.counterpartName}
              onChange={(event) => setDraft((prev) => ({ ...prev, counterpartName: event.target.value }))}
            >
              <option value="">Choose a person</option>
              {roster
                .filter((entry) => entry.name.toLowerCase() !== myName.toLowerCase())
                .map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.name}
                  {entry.shift ? ` (${entry.shift})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Your Assigned Date
            <input
              type="date"
              value={draft.tradeDate}
              onChange={(event) => setDraft((prev) => ({ ...prev, tradeDate: event.target.value }))}
            />
          </label>
          <label>
            Start Time
            <input
              type="text"
              inputMode="numeric"
              placeholder="08:00"
              value={draft.startTime}
              onChange={(event) => setDraft((prev) => ({ ...prev, startTime: event.target.value }))}
              onBlur={(event) => {
                const value = normalizeTime24(event.target.value);
                if (value) setDraft((prev) => ({ ...prev, startTime: value }));
              }}
            />
          </label>
          <label>
            End Time
            <input
              type="text"
              inputMode="numeric"
              placeholder="10:00"
              value={draft.endTime}
              onChange={(event) => setDraft((prev) => ({ ...prev, endTime: event.target.value }))}
              onBlur={(event) => {
                const value = normalizeTime24(event.target.value);
                if (value) setDraft((prev) => ({ ...prev, endTime: value }));
              }}
            />
          </label>
          <label className="additional-field-check">
            <input
              type="checkbox"
              checked={draft.paybackRequired}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  paybackRequired: event.target.checked,
                  paybackDate: event.target.checked ? prev.paybackDate : "",
                }))
              }
            />
            Payback required
          </label>
          <label className={draft.paybackRequired ? undefined : "department-field-disabled"}>
            Date You Work Instead
            <input
              type="date"
              disabled={!draft.paybackRequired}
              value={draft.paybackDate}
              onChange={(event) => setDraft((prev) => ({ ...prev, paybackDate: event.target.value }))}
            />
          </label>
          <label>
            Reason
            <input
              type="text"
              value={draft.reason}
              onChange={(event) => setDraft((prev) => ({ ...prev, reason: event.target.value }))}
            />
          </label>
        </div>
        <button
          type="button"
          className="primary-button compact-button"
          disabled={isSaving}
          onClick={() => void submitRequest()}
        >
          Submit Trade Request
        </button>
      </article>
      <article className="panel">
        <div className="trades-active-header">
          <h3>Active Requests</h3>
          {canSeeAll ? (
            <label>
              Show
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value={ALL_TRADES_FILTER}>All trades</option>
                <option value={MY_TRADES_FILTER}>My trades</option>
                {shiftOptions.map((shift) => (
                  <option key={shift} value={shift}>
                    {shift}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {visibleTrades.length === 0 ? (
          <p className="field-hint">No trades yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Shift</th>
                  <th>Requester</th>
                  <th>Covered By</th>
                  <th>Date and Hours</th>
                  <th>Payback</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleTrades.map((trade) => {
                  const isCounterpart = trade.counterpartUsername === username;
                  return (
                    <tr key={trade.id}>
                      <td>{trade.shiftType || "—"}</td>
                      <td>{trade.requesterName}</td>
                      <td>{trade.counterpartName}</td>
                      <td>
                        {trade.tradeDate} {trade.startTime}–{trade.endTime}
                      </td>
                      <td>{trade.paybackRequired ? trade.paybackDate : "Not required"}</td>
                      <td>{trade.reason || "—"}</td>
                      <td>{statusLabel(trade)}</td>
                      <td>
                        {trade.status === "requested" && isCounterpart ? (
                          <div className="trades-action-cell">
                            <button
                              type="button"
                              className="primary-button compact-button"
                              onClick={() => void answerTrade(trade, "accept")}
                            >
                              Accept
                            </button>
                            <input
                              type="text"
                              placeholder="Reason to deny"
                              value={denyReasons[trade.id] ?? ""}
                              onChange={(event) =>
                                setDenyReasons((prev) => ({ ...prev, [trade.id]: event.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() => void answerTrade(trade, "deny")}
                            >
                              Deny
                            </button>
                          </div>
                        ) : trade.status === "denied" ? (
                          trade.denialReason || "—"
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
      <ScheduleNoticeDialog message={notice} onClose={() => setNotice(null)} />
    </section>
  );
}
