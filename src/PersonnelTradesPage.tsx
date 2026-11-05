import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ScheduleNoticeDialog } from "./ScheduleNoticeDialog";
import { shiftOccursOnDate, toDateKey, type ScheduleShiftEntryLike } from "./scheduleUtils";

type TradeStatus =
  | "requested"
  | "awaiting_admin"
  | "accepted"
  | "denied"
  | "admin_denied"
  | "cancel_requested"
  | "cancel_awaiting_admin"
  | "cancelled";

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
  cancelRequestedBy?: string;
  statusNote?: string;
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
  if (trade.status === "awaiting_admin") return "Waiting for admin approval";
  if (trade.status === "accepted") return "Accepted";
  if (trade.status === "denied") return "Denied";
  if (trade.status === "admin_denied") return "Denied by admin";
  if (trade.status === "cancel_requested") {
    const waitingOn =
      trade.cancelRequestedBy === trade.requesterUsername ? trade.counterpartName : trade.requesterName;
    return `Waiting on ${waitingOn} to accept the cancellation`;
  }
  if (trade.status === "cancel_awaiting_admin") return "Waiting for admin approval to cancel";
  if (trade.status === "cancelled") return "Cancelled";
  return trade.status;
}

function formatMonthDayYear(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  return match ? `${match[2]}-${match[3]}-${match[1].slice(2)}` : value;
}

function formatScheduledDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function namesInSlot(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split("||OT||")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap((entry) => namesInSlot(entry));
  return [];
}

function segmentNames(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((entry) => segmentNames(entry));
  const record = value as Record<string, unknown>;
  const own = typeof record.personnelName === "string" ? [record.personnelName.trim()] : [];
  return [...own, ...Object.values(record).flatMap((entry) => segmentNames(entry))];
}

/** Dates this person is placed on a truck or a split piece. Support rows such as Injury are skipped. */
function scheduledDatesForPerson(
  personName: string,
  assignments: Record<string, unknown>,
  slotSegments: Record<string, unknown>,
): string[] {
  const target = personName.trim().toLowerCase();
  if (!target) return [];
  const dates = new Set<string>();
  const addStorageKey = (storageKey: string) => {
    const dateKey = storageKey.split("::")[1] ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) dates.add(dateKey);
  };
  for (const [storageKey, day] of Object.entries(assignments)) {
    if (!day || typeof day !== "object") continue;
    for (const [unitId, slots] of Object.entries(day as Record<string, unknown>)) {
      if (unitId.startsWith("support-")) continue;
      if (namesInSlot(slots).some((name) => name.toLowerCase() === target)) addStorageKey(storageKey);
    }
  }
  for (const [storageKey, day] of Object.entries(slotSegments)) {
    if (!day || typeof day !== "object") continue;
    for (const [unitId, rows] of Object.entries(day as Record<string, unknown>)) {
      if (unitId.startsWith("support-")) continue;
      if (segmentNames(rows).some((name) => name.toLowerCase() === target)) addStorageKey(storageKey);
    }
  }
  return [...dates].sort();
}

function datesFromToday(entry: ScheduleShiftEntryLike & { shiftType: string }, monthsAhead: number): string[] {
  const dates: string[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + monthsAhead);
  const cursor = new Date(start);
  while (cursor <= end) {
    if (shiftOccursOnDate(entry, cursor, entry.shiftType)) dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function PersonnelTradesPage() {
  const location = useLocation();
  const activeRequestsRef = useRef<HTMLElement | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [username, setUsername] = useState("");
  const [myName, setMyName] = useState("");
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [scheduledDates, setScheduledDates] = useState<string[]>([]);
  const [tradeSettings, setTradeSettings] = useState({
    adminApproval: false,
    paybackRequired: false,
    cancelApproval: false,
  });
  const paybackDefaultApplied = useRef(false);
  const [filter, setFilter] = useState(ALL_TRADES_FILTER);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [denyReasons, setDenyReasons] = useState<Record<string, string>>({});
  const [denyPromptId, setDenyPromptId] = useState<string | null>(null);
  const [denyPromptReason, setDenyPromptReason] = useState("");
  const [denyPromptError, setDenyPromptError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [overrideRequests, setOverrideRequests] = useState<
    Array<{
      id: string;
      personName: string;
      apparatus: string;
      dateKey: string;
      requiredQualification: string;
      shiftType: string;
      status: string;
      slotIndex: number;
    }>
  >([]);
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
      return "";
    }
    setTrades(Array.isArray(json.trades) ? json.trades : []);
    setCanSeeAll(json.canSeeAll === true);
    setUsername(String(json.username ?? ""));
    setMyName(String(json.name ?? ""));
    return String(json.name ?? "");
  }, []);

  useEffect(() => {
    if (location.hash !== "#active-requests") return;
    activeRequestsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, overrideRequests, trades]);

  const loadOverrideRequests = useCallback(async () => {
    const response = await fetch("/api/qualification-overrides");
    const json = (await response.json().catch(() => null)) as {
      ok?: boolean;
      canReview?: boolean;
      requests?: Array<{
        id: string;
        personName: string;
        apparatus: string;
        dateKey: string;
        requiredQualification: string;
        shiftType: string;
        status: string;
        slotIndex: number;
      }>;
    } | null;
    if (!response.ok || !json?.ok || json.canReview !== true) {
      setOverrideRequests([]);
      return;
    }
    setOverrideRequests((json.requests ?? []).filter((row) => row.status === "pending"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const personName = await loadTrades();
      await loadOverrideRequests();
      const [detailsResponse, scheduleResponse] = await Promise.all([
        fetch("/api/department-details"),
        fetch("/api/schedule-assignments"),
      ]);
      const json = (await detailsResponse.json().catch(() => null)) as {
        ok?: boolean;
        data?: Record<string, unknown>;
      } | null;
      const scheduleJson = (await scheduleResponse.json().catch(() => null)) as {
        ok?: boolean;
        assignments?: Record<string, unknown>;
        slotSegments?: Record<string, unknown>;
      } | null;
      if (cancelled || !json?.ok || !json.data) return;
      const data = json.data;
      const records = Array.isArray(data.schedulerPersonnelRecords)
        ? (data.schedulerPersonnelRecords as Array<Record<string, unknown>>)
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
      const nextSettings = {
        adminApproval: data.tradeAdminApproval === true,
        paybackRequired: data.tradePaybackRequired === true,
        cancelApproval: data.tradeCancelApproval !== false,
      };
      setTradeSettings(nextSettings);
      if (!paybackDefaultApplied.current) {
        paybackDefaultApplied.current = true;
        setDraft((prev) => ({ ...prev, paybackRequired: nextSettings.paybackRequired }));
      }
      if (!cancelled) {
        const saved = scheduleJson?.ok
          ? scheduledDatesForPerson(
              personName ?? "",
              scheduleJson.assignments ?? {},
              scheduleJson.slotSegments ?? {},
            )
          : [];
        const shiftName = String(
          records.find((record) => String(record?.name ?? "").trim().toLowerCase() === (personName ?? "").trim().toLowerCase())
            ?.shift ?? "",
        )
          .split("|")[0]
          .trim();
        const shiftEntries = Array.isArray(data.shiftInformationEntries)
          ? (data.shiftInformationEntries as Array<Record<string, unknown>>)
          : [];
        const shiftEntry = shiftEntries.find(
          (entry) => String(entry.shiftType ?? "").trim().toLowerCase() === shiftName.toLowerCase(),
        );
        const generated = shiftEntry
          ? datesFromToday(
              {
                shiftType: String(shiftEntry.shiftType ?? shiftName),
                recurrence: String(shiftEntry.recurrence ?? ""),
                recurrenceCustomValue: String(shiftEntry.recurrenceCustomValue ?? ""),
                recurrenceCustomMode: String(shiftEntry.recurrenceCustomMode ?? ""),
                recurrenceWeekdays: Array.isArray(shiftEntry.recurrenceWeekdays)
                  ? shiftEntry.recurrenceWeekdays.map((day) => Math.floor(Number(day)))
                  : [],
                rotationStartsOn: String(shiftEntry.rotationStartsOn ?? ""),
              },
              3,
            )
          : [];
        setScheduledDates([...new Set([...saved, ...generated])].sort());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOverrideRequests, loadTrades]);

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
      setNotice("Enter the date.");
      return;
    }
    if (!startTime || !endTime) {
      setNotice("Enter start and end times in 24-hour format, for example 08:00 and 10:00.");
      return;
    }
    if (tradeSettings.paybackRequired && !draft.paybackDate) {
      setNotice("Payback is required, so enter the date you work instead.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          startTime,
          endTime,
          paybackRequired: tradeSettings.paybackRequired,
          paybackDate: tradeSettings.paybackRequired ? draft.paybackDate : "",
        }),
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !json?.ok) {
        setNotice(json?.message || "The trade request could not be sent.");
        return;
      }
      setDraft({ ...EMPTY_DRAFT, paybackRequired: tradeSettings.paybackRequired });
      await loadTrades();
      setNotice(`Trade request sent to ${draft.counterpartName}.`);
    } finally {
      setIsSaving(false);
    }
  };

  const answerTrade = async (
    trade: TradeRecord,
    action:
      | "accept"
      | "deny"
      | "approve"
      | "admin_deny"
      | "cancel_request"
      | "cancel_accept"
      | "cancel_decline"
      | "cancel_approve"
      | "cancel_admin_deny",
  ) => {
    const denialReason = (denyReasons[trade.id] ?? "").trim();
    if ((action === "deny" || action === "admin_deny" || action === "cancel_admin_deny") && !denialReason) {
      setNotice("Enter a reason before denying.");
      return;
    }
    if (action === "cancel_decline" && !denialReason) {
      setNotice("Enter a reason for keeping the trade.");
      return;
    }
    const response = await fetch(`/api/trades/${encodeURIComponent(trade.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, denialReason }),
    });
    const json = (await response.json().catch(() => null)) as {
      ok?: boolean;
      message?: string;
      trade?: TradeRecord;
    } | null;
    if (!response.ok || !json?.ok) {
      setNotice(json?.message || "The trade could not be updated.");
      return;
    }
    await loadTrades();
    if (json.trade?.status === "cancelled") {
      setNotice("The trade is cancelled. Open Schedule and refresh it. Both days are back to how they were before the trade.");
    }
  };

  const answerOverride = async (id: string, action: "approve" | "deny", denialReason = "") => {
    const reason = denialReason.trim();
    if (action === "deny" && !reason) {
      setDenyPromptError("Enter a reason before denying.");
      return;
    }
    const response = await fetch(`/api/qualification-overrides/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, denialReason: reason }),
    });
    const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (!response.ok || !json?.ok) {
      const message = json?.message || "The permission request could not be updated.";
      if (action === "deny") setDenyPromptError(message);
      else setNotice(message);
      return;
    }
    const removal = overrideRequests.some(
      (request) => request.id === id && request.requiredQualification === "Remove from seat",
    );
    const partial = overrideRequests.some(
      (request) => request.id === id && request.requiredQualification.startsWith("Partial shift "),
    );
    setDenyPromptId(null);
    setDenyPromptReason("");
    setDenyPromptError("");
    await loadOverrideRequests();
    setNotice(
      action === "approve"
        ? partial
          ? "Those hours are on the schedule."
          : removal
            ? "They are removed from that seat."
            : "The seat is approved."
        : partial
          ? "The partial shift was denied."
          : removal
            ? "The cancellation stays denied and the person remains on the schedule."
            : "The request is denied and the person is removed from that seat.",
    );
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <h1>Trades</h1>
        <p>Ask another member to cover part or all of a shift you are scheduled to work.</p>
      </header>
      <article className="panel">
        <h3>New Trade Request</h3>
        <div className="trade-request-top-row">
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
            Date
            <input
              type="date"
              value={draft.tradeDate}
              onChange={(event) => setDraft((prev) => ({ ...prev, tradeDate: event.target.value }))}
            />
          </label>
          <label>
            Select Scheduled Day
            <select
              value={scheduledDates.includes(draft.tradeDate) ? draft.tradeDate : ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, tradeDate: event.target.value }))}
            >
              <option value="">
                {scheduledDates.length === 0 ? "No scheduled days yet" : "Choose a scheduled day"}
              </option>
              {scheduledDates.map((date) => (
                <option key={date} value={date}>
                  {formatScheduledDate(date)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="department-edit-grid">
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
          <label className={tradeSettings.paybackRequired ? undefined : "department-field-disabled"}>
            Date You Work Instead
            <input
              type="date"
              disabled={!tradeSettings.paybackRequired}
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
        <p className="field-hint">
          Type a date or choose one from Select Scheduled Day. Times use 24-hour format, such as 08:00.
        </p>
        {tradeSettings.adminApproval ? (
          <p className="field-hint">
            This department requires an administrator to approve a trade after the other person accepts.
          </p>
        ) : null}
        {tradeSettings.cancelApproval ? (
          <p className="field-hint">
            Cancelling an accepted trade requires an administrator's approval before the schedule is changed back.
          </p>
        ) : null}
        <button
          type="button"
          className="primary-button compact-button"
          disabled={isSaving}
          onClick={() => void submitRequest()}
        >
          Submit Trade Request
        </button>
      </article>
      <article className="panel" id="active-requests" ref={activeRequestsRef}>
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
        {visibleTrades.length === 0 && overrideRequests.length === 0 ? (
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
                {overrideRequests.map((request, index) => (
                  <tr key={`override-${request.id}`} className="trades-override-row" style={{ top: `${index * 2.6}rem` }}>
                    <td>{`* ${request.shiftType || "—"}`}</td>
                    <td>{request.personName}</td>
                    <td>{request.apparatus || "—"}</td>
                    <td>
                      {request.requiredQualification.startsWith("Partial shift ")
                        ? `${formatMonthDayYear(request.dateKey)} ${request.requiredQualification
                            .replace("Partial shift ", "")
                            .replace("-", "–")}`
                        : formatMonthDayYear(request.dateKey)}
                    </td>
                    <td>—</td>
                    <td>
                      {request.requiredQualification === "Remove from seat"
                        ? "Request to cancel shift"
                        : request.requiredQualification.startsWith("Partial shift ")
                          ? `Asked to work ${request.requiredQualification.replace("Partial shift ", "").replace("-", " to ")}`
                          : `Needs approval for ${request.requiredQualification}`}
                    </td>
                    <td>Pending</td>
                    <td>
                      <div className="trades-override-actions">
                        <button type="button" className="primary-button compact-button" onClick={() => void answerOverride(request.id, "approve")}>
                          Approve
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          onClick={() => {
                            setDenyPromptId(request.id);
                            setDenyPromptReason("");
                            setDenyPromptError("");
                          }}
                        >
                          Deny
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleTrades.map((trade) => {
                  const isCounterpart = trade.counterpartUsername === username;
                  const isParty = isCounterpart || trade.requesterUsername === username;
                  const canAnswerCancel =
                    trade.status === "cancel_requested" &&
                    isParty &&
                    username !== (trade.cancelRequestedBy ?? "");
                  return (
                    <tr key={trade.id}>
                      <td>{trade.shiftType || "—"}</td>
                      <td>{trade.requesterName}</td>
                      <td>{trade.counterpartName}</td>
                      <td>
                        {formatMonthDayYear(trade.tradeDate)} {trade.startTime}–{trade.endTime}
                      </td>
                      <td>{trade.paybackRequired ? formatMonthDayYear(trade.paybackDate) : "Not required"}</td>
                      <td>{trade.reason || "—"}</td>
                      <td>
                        {statusLabel(trade)}
                        {trade.statusNote ? <div className="field-hint">{trade.statusNote}</div> : null}
                      </td>
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
                        ) : trade.status === "awaiting_admin" && canSeeAll ? (
                          <div className="trades-action-cell">
                            <button
                              type="button"
                              className="primary-button compact-button"
                              onClick={() => void answerTrade(trade, "approve")}
                            >
                              Approve
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
                              onClick={() => void answerTrade(trade, "admin_deny")}
                            >
                              Deny
                            </button>
                          </div>
                        ) : trade.status === "accepted" && isParty ? (
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            onClick={() => void answerTrade(trade, "cancel_request")}
                          >
                            Cancel Requested Trade
                          </button>
                        ) : canAnswerCancel ? (
                          <div className="trades-action-cell">
                            <button
                              type="button"
                              className="primary-button compact-button"
                              onClick={() => void answerTrade(trade, "cancel_accept")}
                            >
                              Accept Cancellation
                            </button>
                            <input
                              type="text"
                              placeholder="Reason to keep the trade"
                              value={denyReasons[trade.id] ?? ""}
                              onChange={(event) =>
                                setDenyReasons((prev) => ({ ...prev, [trade.id]: event.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="secondary-button compact-button"
                              onClick={() => void answerTrade(trade, "cancel_decline")}
                            >
                              Keep Trade
                            </button>
                          </div>
                        ) : trade.status === "cancel_awaiting_admin" && canSeeAll ? (
                          <div className="trades-action-cell">
                            <button
                              type="button"
                              className="primary-button compact-button"
                              onClick={() => void answerTrade(trade, "cancel_approve")}
                            >
                              Approve Cancellation
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
                              onClick={() => void answerTrade(trade, "cancel_admin_deny")}
                            >
                              Deny
                            </button>
                          </div>
                        ) : trade.status === "denied" || trade.status === "admin_denied" ? (
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
      {denyPromptId ? (
        <div className="schedule-notice-backdrop" role="dialog" aria-modal="true" aria-labelledby="deny-override-title">
          <div className="schedule-notice">
            <p id="deny-override-title">Enter a reason to deny this request.</p>
            <input
              className="qualification-override-deny-input"
              type="text"
              value={denyPromptReason}
              autoFocus
              onChange={(event) => {
                setDenyPromptReason(event.target.value);
                setDenyPromptError("");
              }}
            />
            {denyPromptError ? <p className="field-error">{denyPromptError}</p> : null}
            <div className="schedule-notice-actions">
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => void answerOverride(denyPromptId, "deny", denyPromptReason)}
              >
                Deny
              </button>
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => {
                  setDenyPromptId(null);
                  setDenyPromptReason("");
                  setDenyPromptError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ScheduleNoticeDialog message={notice} onClose={() => setNotice(null)} />
    </section>
  );
}
