import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAssignments, getSubmissions } from "../../api/checklists";
import { getDashboardSummary, type DashboardWidgetId } from "../../api/dashboard";
import { getDisplayEvents, type DisplayEvent } from "../../api/displays";
import { getIncidentList } from "../../api/incidents";
import { getPoliciesHome, policyLabel } from "../../api/policies";
import { DASHBOARD_PRIORITY_LINKS, getIncidentDisplayNumber, type IncidentCallSummary } from "../../appData";
import { CallMap } from "../displays/CallMap";
import { errorText, formatDateKey, todayKey } from "../maintenance/maintenanceUtils";

const REFRESH_MS = 60_000;
const ACTIVE_TRADE_STATUSES = ["requested", "awaiting_admin", "cancel_requested", "cancel_awaiting_admin"];
const pad = (value: number) => String(value).padStart(2, "0");

interface TradeRow {
  id: string;
  shiftType: string;
  requesterUsername: string;
  requesterName: string;
  counterpartName: string;
  tradeDate: string;
  startTime: string;
  endTime: string;
  status: string;
  cancelRequestedBy?: string;
}

interface TradesData {
  trades: TradeRow[];
  pendingApprovals: number;
}

async function loadTrades(): Promise<TradesData> {
  const [tradesResponse, overridesResponse] = await Promise.all([fetch("/api/trades"), fetch("/api/qualification-overrides")]);
  const tradesJson = (await tradesResponse.json().catch(() => null)) as { ok?: boolean; trades?: TradeRow[]; message?: string } | null;
  if (!tradesResponse.ok || !tradesJson?.ok) throw new Error(tradesJson?.message || "Trades could not be loaded.");
  const overridesJson = (await overridesResponse.json().catch(() => null)) as {
    ok?: boolean;
    canReview?: boolean;
    requests?: Array<{ status: string }>;
  } | null;
  const pendingApprovals =
    overridesJson?.ok && overridesJson.canReview === true && Array.isArray(overridesJson.requests)
      ? overridesJson.requests.filter((row) => row.status === "pending").length
      : 0;
  return {
    trades: (tradesJson.trades ?? []).filter((trade) => ACTIVE_TRADE_STATUSES.includes(trade.status)),
    pendingApprovals,
  };
}

async function loadChecks() {
  const assignments = await getAssignments(todayKey());
  const flagged = await getSubmissions()
    .then((rows) => rows.filter((row) => row.status === "Flagged").length)
    .catch(() => 0);
  return { open: assignments.filter((row) => row.status === "Due" || row.status === "Overdue"), flagged };
}

const LOADERS = {
  summary: () => getDashboardSummary(new Date()),
  incidents: () => getIncidentList(),
  trades: loadTrades,
  checks: loadChecks,
  events: getDisplayEvents,
  policies: getPoliciesHome,
};

type LoaderKey = keyof typeof LOADERS;
type LoaderData<K extends LoaderKey> = Awaited<ReturnType<(typeof LOADERS)[K]>>;

/** Several widgets read the same data (for example the incident list), so one request is shared for a few seconds. */
const shared = new Map<LoaderKey, { at: number; promise: Promise<unknown> }>();

function useShared<K extends LoaderKey>(key: K): { data: LoaderData<K> | null; error: string } {
  const [state, setState] = useState<{ data: LoaderData<K> | null; error: string }>({ data: null, error: "" });
  useEffect(() => {
    let active = true;
    const load = () => {
      let entry = shared.get(key);
      if (!entry || Date.now() - entry.at > 5_000) {
        entry = { at: Date.now(), promise: LOADERS[key]() };
        shared.set(key, entry);
      }
      (entry.promise as Promise<LoaderData<K>>)
        .then((data) => {
          if (active) setState({ data, error: "" });
        })
        .catch((error) => {
          shared.delete(key);
          if (active) setState((previous) => ({ data: previous.data, error: errorText(error, "Could not load.") }));
        });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [key]);
  return state;
}

function Loading({ error }: { error: string }) {
  return <p className={error ? "field-error" : "field-hint"}>{error || "Loading..."}</p>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="field-hint">{children}</p>;
}

/** Call time from the CAD received time, when it reads as a date. */
function callDate(call: IncidentCallSummary): Date | null {
  if (!call.receivedAt) return null;
  const parsed = new Date(call.receivedAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function time24(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function shortDate(date: Date): string {
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function callTime(call: IncidentCallSummary, now: Date): string {
  const date = callDate(call);
  if (!date) return call.receivedAt;
  return date.toDateString() === now.toDateString() ? time24(date) : `${shortDate(date)} ${time24(date)}`;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function ClockWidget() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  return (
    <div className="dashboard-clock">
      <strong>{`${time24(now)}:${pad(now.getSeconds())}`}</strong>
      <span>{`${weekday} ${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`}</span>
    </div>
  );
}

function CallStatsWidget() {
  const { data, error } = useShared("incidents");
  if (!data) return <Loading error={error} />;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const dates = data.map(callDate);
  const stats = [
    { label: "Calls Today", value: dates.filter((date) => date && date.getTime() >= startOfToday).length },
    { label: "Last 7 Days", value: dates.filter((date) => date && date.getTime() >= weekAgo).length },
    { label: "This Year", value: dates.filter((date) => date && date.getFullYear() === now.getFullYear()).length },
    {
      label: "Reports Not Exported",
      value: data.filter((call) => (call.nerisReportStatus ?? "Draft") !== "Exported").length,
      to: "/reporting/neris",
    },
  ];
  return (
    <div className="dashboard-stats">
      {stats.map((stat) => (
        <Link key={stat.label} to={stat.to ?? "/incidents-mapping/incidents"} className="dashboard-stat">
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
        </Link>
      ))}
    </div>
  );
}

function IncidentsWidget() {
  const { data, error } = useShared("incidents");
  if (!data) return <Loading error={error} />;
  if (data.length === 0) return <Empty>No calls yet.</Empty>;
  const now = new Date();
  return (
    <ul className="dashboard-list">
      {data.slice(0, 10).map((call) => (
        <li key={call.callNumber}>
          <Link to={`/incidents-mapping/incidents/${encodeURIComponent(call.callNumber)}`}>
            <span className="dashboard-list-main">
              <strong>{call.incidentType || "Call"}</strong>
              <small>{`${getIncidentDisplayNumber(call)} - ${call.address}`}</small>
            </span>
            <span className="dashboard-list-side">{callTime(call, now)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MapWidget() {
  const { data, error } = useShared("incidents");
  if (!data) return <Loading error={error} />;
  const call = data.find((row) => row.address && row.address !== "Unknown");
  if (!call) return <Empty>No call with an address yet.</Empty>;
  return (
    <div className="dashboard-map">
      <p className="dashboard-map-caption">
        <Link to={`/incidents-mapping/incidents/${encodeURIComponent(call.callNumber)}`}>
          {`${call.incidentType || "Call"} - ${call.address}`}
        </Link>
      </p>
      <CallMap key={call.callNumber} incidentId={call.callNumber} address={call.address} latitude={null} longitude={null} />
    </div>
  );
}

function OnDutyWidget() {
  const { data, error } = useShared("summary");
  if (!data) return <Loading error={error} />;
  const { shifts, units } = data.onDuty;
  if (units.length === 0) return <Empty>Nobody is on the schedule right now.</Empty>;
  return (
    <>
      {shifts.length > 0 ? <p className="dashboard-widget-note">{shifts.join(", ")}</p> : null}
      <ul className="dashboard-list">
        {units.map((unit) => (
          <li key={unit.unit} className="dashboard-list-static">
            <span className="dashboard-list-main">
              <strong>{unit.unit}</strong>
              <small>{unit.people.join(", ")}</small>
            </span>
            {unit.station ? <span className="dashboard-list-side">{unit.station}</span> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function ApparatusWidget() {
  const { data, error } = useShared("summary");
  if (!data) return <Loading error={error} />;
  if (data.apparatus.length === 0) return <Empty>No apparatus yet. Add units in Admin Functions.</Empty>;
  const out = data.apparatus.filter((unit) => unit.status !== "In Service").length;
  return (
    <>
      <p className="dashboard-widget-note">{`${data.apparatus.length - out} in service, ${out} out of service`}</p>
      <ul className="dashboard-list">
        {data.apparatus.map((unit) => (
          <li key={unit.unitId} className="dashboard-list-static">
            <span className="dashboard-list-main">
              <strong>{unit.label}</strong>
              {unit.outOfServiceReason ? <small>{unit.outOfServiceReason}</small> : null}
            </span>
            <span className={`tone ${unit.status === "In Service" ? "tone-positive" : "tone-critical"}`}>{unit.status}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function MaintenanceWidget() {
  const { data, error } = useShared("summary");
  if (!data) return <Loading error={error} />;
  const { open, overdue, outOfService, recent } = data.maintenance;
  const counts = [
    { label: "Open", value: open, to: "/apparatus/maintenance-logs?filter=open" },
    { label: "Overdue", value: overdue, to: "/apparatus/maintenance-logs?filter=overdue" },
    { label: "Out of Service", value: outOfService, to: "/apparatus/maintenance-logs?filter=outOfService" },
  ];
  return (
    <>
      <div className="dashboard-stats compact">
        {counts.map((count) => (
          <Link key={count.label} to={count.to} className="dashboard-stat">
            <span>{count.label}</span>
            <strong>{count.value}</strong>
          </Link>
        ))}
      </div>
      {recent.length === 0 ? (
        <Empty>No open maintenance.</Empty>
      ) : (
        <ul className="dashboard-list">
          {recent.map((record) => (
            <li key={record.id}>
              <Link
                to={`/apparatus/${record.assetKind === "equipment" ? "equipment-maintenance" : "maintenance-logs"}?record=${encodeURIComponent(record.id)}`}
              >
                <span className="dashboard-list-main">
                  <strong>{`${record.recordNumber} ${record.assetRef}`.trim()}</strong>
                  <small>{record.description || record.status}</small>
                </span>
                <span className={`tone ${record.outOfService ? "tone-critical" : "tone-neutral"}`}>
                  {record.outOfService ? "OOS" : record.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ChecksDueWidget({ canReview }: { canReview: boolean }) {
  const { data, error } = useShared("checks");
  if (!data) return <Loading error={error} />;
  return (
    <>
      {canReview && data.flagged > 0 ? (
        <p className="dashboard-widget-alert">
          <Link to="/file-center/checklists">{`${data.flagged} flagged check${data.flagged === 1 ? "" : "s"} need review`}</Link>
        </p>
      ) : null}
      {data.open.length === 0 ? (
        <Empty>No checklists due today.</Empty>
      ) : (
        <ul className="dashboard-list">
          {data.open.map((assignment) => (
            <li key={assignment.id}>
              <Link to="/file-center/checklists">
                <span className="dashboard-list-main">
                  <strong>{assignment.templateName}</strong>
                  <small>{[assignment.targetLabel, assignment.assignedTo].filter(Boolean).join(" - ") || "Anyone"}</small>
                </span>
                <span className={`tone ${assignment.status === "Overdue" ? "tone-critical" : "tone-warning"}`}>{assignment.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function tradeStatus(trade: TradeRow): string {
  if (trade.status === "requested") return `Waiting on ${trade.counterpartName}`;
  if (trade.status === "awaiting_admin") return "Waiting for admin approval";
  if (trade.status === "cancel_requested") {
    return `Cancel: waiting on ${trade.cancelRequestedBy === trade.requesterUsername ? trade.counterpartName : trade.requesterName}`;
  }
  return "Cancel: waiting for admin approval";
}

function TradesWidget() {
  const { data, error } = useShared("trades");
  if (!data) return <Loading error={error} />;
  return (
    <>
      {data.pendingApprovals > 0 ? (
        <p className="dashboard-widget-alert">
          <Link to="/personnel/trades#active-requests">
            {`${data.pendingApprovals} schedule request${data.pendingApprovals === 1 ? "" : "s"} need approval`}
          </Link>
        </p>
      ) : null}
      {data.trades.length === 0 ? (
        <Empty>No active trade requests.</Empty>
      ) : (
        <ul className="dashboard-list">
          {data.trades.map((trade) => (
            <li key={trade.id}>
              <Link to="/personnel/trades#active-requests">
                <span className="dashboard-list-main">
                  <strong>{`${trade.requesterName} / ${trade.counterpartName}`}</strong>
                  <small>
                    {`${formatDateKey(trade.tradeDate) || trade.tradeDate} ${trade.startTime}-${trade.endTime}${trade.shiftType ? ` - ${trade.shiftType}` : ""}`}
                  </small>
                </span>
                <span className="tone tone-warning">{tradeStatus(trade)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DtbsWidget() {
  const { data, error } = useShared("policies");
  if (!data) return <Loading error={error} />;
  const due = [...data.dtbs].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  const today = todayKey();
  return (
    <>
      {data.needed.length > 0 ? (
        <p className="dashboard-widget-alert">
          <Link to="/policies">{`${data.needed.length} polic${data.needed.length === 1 ? "y needs" : "ies need"} your acknowledgment`}</Link>
        </p>
      ) : null}
      {due.length === 0 ? (
        <Empty>No DTB's are assigned to you right now.</Empty>
      ) : (
        <ul className="dashboard-list">
          {due.map((dtb) => (
            <li key={dtb.id}>
              <Link to={`/policies/dtbs?policy=${encodeURIComponent(dtb.id)}`}>
                <span className="dashboard-list-main">
                  <strong>{policyLabel(dtb)}</strong>
                  {dtb.dueDate ? <small>{`Due ${formatDateKey(dtb.dueDate)}`}</small> : null}
                </span>
                {dtb.dueDate && dtb.dueDate < today ? <span className="tone tone-critical">Overdue</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function CalendarWidget({ canManageEvents }: { canManageEvents: boolean }) {
  const { data, error } = useShared("events");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const eventsByDay = useMemo(() => {
    const map = new Map<string, DisplayEvent[]>();
    for (const event of data ?? []) {
      const date = new Date(event.startsAt);
      if (Number.isNaN(date.getTime())) continue;
      const key = dayKey(date);
      map.set(key, [...(map.get(key) ?? []), event].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    }
    return map;
  }, [data]);
  if (!data) return <Loading error={error} />;

  const firstWeekday = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
  ];
  const today = dayKey(new Date());
  const dayEvents = eventsByDay.get(selected) ?? [];
  const changeMonth = (step: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + step, 1));

  return (
    <div className="dashboard-calendar">
      <div className="dashboard-calendar-header">
        <button type="button" className="secondary-button compact-button" onClick={() => changeMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <strong>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
        <button type="button" className="secondary-button compact-button" onClick={() => changeMonth(1)} aria-label="Next month">
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="dashboard-calendar-grid">
        {WEEKDAYS.map((day) => (
          <span key={day} className="dashboard-calendar-weekday">
            {day}
          </span>
        ))}
        {cells.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />;
          const key = dayKey(date);
          const classes = [
            "dashboard-calendar-day",
            key === today ? "is-today" : "",
            key === selected ? "is-selected" : "",
            eventsByDay.has(key) ? "has-events" : "",
          ];
          return (
            <button key={key} type="button" className={classes.filter(Boolean).join(" ")} onClick={() => setSelected(key)}>
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div className="dashboard-calendar-events">
        <p className="dashboard-widget-note">{formatDateKey(selected)}</p>
        {dayEvents.length === 0 ? (
          <Empty>No events scheduled.</Empty>
        ) : (
          <ul className="dashboard-list">
            {dayEvents.map((event) => (
              <li key={event.id} className="dashboard-list-static">
                <span className="dashboard-list-main">
                  <strong>{event.title}</strong>
                  {event.location ? <small>{event.location}</small> : null}
                </span>
                <span className="dashboard-list-side">{time24(new Date(event.startsAt))}</span>
              </li>
            ))}
          </ul>
        )}
        {canManageEvents ? (
          <p className="field-hint">
            Add events in <Link to="/admin-functions/displays">Admin Functions &gt; Displays</Link>, Events.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function QuickLinksWidget() {
  return (
    <ul className="dashboard-list">
      {DASHBOARD_PRIORITY_LINKS.map((link) => (
        <li key={link.path}>
          <Link to={link.path}>
            <span className="dashboard-list-main">
              <strong>{link.label}</strong>
              <small>{link.description}</small>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DashboardWidgetBody({
  id,
  canReviewChecks,
  canManageEvents,
}: {
  id: DashboardWidgetId;
  canReviewChecks: boolean;
  canManageEvents: boolean;
}) {
  switch (id) {
    case "clock":
      return <ClockWidget />;
    case "callStats":
      return <CallStatsWidget />;
    case "incidents":
      return <IncidentsWidget />;
    case "map":
      return <MapWidget />;
    case "onDuty":
      return <OnDutyWidget />;
    case "apparatus":
      return <ApparatusWidget />;
    case "maintenance":
      return <MaintenanceWidget />;
    case "checksDue":
      return <ChecksDueWidget canReview={canReviewChecks} />;
    case "trades":
      return <TradesWidget />;
    case "calendar":
      return <CalendarWidget canManageEvents={canManageEvents} />;
    case "quickLinks":
      return <QuickLinksWidget />;
    case "dtbs":
      return <DtbsWidget />;
    default:
      return null;
  }
}
