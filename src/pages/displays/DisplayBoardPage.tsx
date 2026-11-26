import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Maximize2, Volume2, X } from "lucide-react";
import {
  getBoard,
  getBoardFeed,
  type BoardDepartment,
  type BoardFeed,
  type BoardIncident,
  type DisplayBoard,
} from "../../api/displays";
import { errorText, formatTimestamp24 } from "../maintenance/maintenanceUtils";
import { CallMap } from "./CallMap";

const REFRESH_MS = 20_000;
/** Only a call this recent opens the takeover, so an older call that reappears on a district board stays quiet. */
const TAKEOVER_MAX_AGE_MS = 30 * 60 * 1000;

const SAMPLE_CALL: BoardIncident = {
  id: "test-alert",
  incidentNumber: "",
  incidentType: "Test alert (no calls yet)",
  priority: "",
  address: "",
  stillDistrict: "",
  assignedUnits: "",
  receivedAt: "",
  currentState: "",
  createdAt: new Date().toISOString(),
  latitude: null,
  longitude: null,
  districtUnknown: false,
};

const pad = (value: number) => String(value).padStart(2, "0");

function clockText(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function dateText(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday} ${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
}

/** Received time as 24-hour HH:MM, with the date when it is not today. CAD text that is not a date is shown as typed. */
function callTime(incident: BoardIncident, now: Date): string {
  const parsed = new Date(incident.receivedAt || incident.createdAt);
  if (Number.isNaN(parsed.getTime())) return incident.receivedAt;
  const time = `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  return parsed.toDateString() === now.toDateString() ? time : `${pad(parsed.getMonth() + 1)}/${pad(parsed.getDate())} ${time}`;
}

function playAlert(context: AudioContext) {
  const start = context.currentTime + 0.05;
  for (let index = 0; index < 6; index += 1) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const at = start + index * 0.45;
    oscillator.type = "square";
    oscillator.frequency.value = index % 2 === 0 ? 880 : 660;
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0.15, at);
    gain.gain.setValueAtTime(0, at + 0.4);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.42);
  }
}

/** Full-screen station board at /display/:boardId. It reads only; nothing on this screen changes a record. */
export function DisplayBoardPage() {
  const { boardId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const testAlert = searchParams.get("test") === "1";
  const [board, setBoard] = useState<DisplayBoard | null>(null);
  const [department, setDepartment] = useState<BoardDepartment | null>(null);
  const [loadError, setLoadError] = useState("");
  const [feed, setFeed] = useState<BoardFeed | null>(null);
  const [feedError, setFeedError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [takeover, setTakeover] = useState<{ incident: BoardIncident; until: number } | null>(null);
  const [soundReady, setSoundReady] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void getBoard(boardId)
      .then((result) => {
        if (!active) return;
        setBoard(result.board);
        setDepartment(result.department);
      })
      .catch((error) => {
        if (active) setLoadError(errorText(error, "This board could not be loaded."));
      });
    return () => {
      active = false;
    };
  }, [boardId]);

  useEffect(() => {
    if (!board) return;
    let active = true;
    knownIds.current = null;
    const startTakeover = (incident: BoardIncident) => {
      setTakeover({ incident, until: Date.now() + board.takeoverSeconds * 1000 });
      const context = audioRef.current;
      if (board.soundOn && context && context.state === "running") playAlert(context);
    };
    const poll = async () => {
      try {
        const next = await getBoardFeed(board.id, new Date());
        if (!active) return;
        setFeed(next);
        setFeedError("");
        setUpdatedAt(new Date());
        const ids = next.incidents.map((incident) => incident.id);
        if (knownIds.current === null) {
          knownIds.current = new Set(ids);
          if (testAlert) startTakeover(next.incidents[0] ?? SAMPLE_CALL);
          return;
        }
        const known = knownIds.current;
        const fresh = next.incidents.filter(
          (incident) => !known.has(incident.id) && Date.now() - new Date(incident.createdAt).getTime() < TAKEOVER_MAX_AGE_MS,
        );
        for (const id of ids) known.add(id);
        if (fresh[0]) startTakeover(fresh[0]);
      } catch (error) {
        if (active) setFeedError(errorText(error, "Could not refresh. Trying again."));
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [board, testAlert]);

  const enableSound = () => {
    const context = audioRef.current ?? new AudioContext();
    audioRef.current = context;
    void context.resume().then(() => {
      setSoundReady(true);
      playAlert(context);
    });
  };

  if (loadError) {
    return (
      <div className="display-board display-board-message">
        <h1 className="page-title-keep">Display board</h1>
        <p>{loadError}</p>
        <Link className="primary-button" to="/admin-functions/displays">Go to Displays</Link>
      </div>
    );
  }

  if (!board || !department) {
    return <div className="display-board display-board-message">Loading the board...</div>;
  }

  const panels = board.panels;
  const banner = (feed?.announcements ?? []).filter((item) => item.important);
  const inService = (feed?.apparatus ?? []).filter((unit) => unit.status !== "Out of Service");
  const outOfService = (feed?.apparatus ?? []).filter((unit) => unit.status === "Out of Service");
  const activeTakeover = takeover && now.getTime() < takeover.until ? takeover : null;

  return (
    <div className="display-board">
      <header className="display-header">
        <div className="display-brand">
          {department.logoDataUrl ? <img src={department.logoDataUrl} alt="" /> : null}
          <div>
            <h1 className="page-title-keep">{department.name}</h1>
            <p>{board.stationName ? `${board.stationName} · ${board.name}` : board.name}</p>
          </div>
        </div>
        <div className="display-clock">
          <strong>{clockText(now)}</strong>
          <span>{dateText(now)}</span>
        </div>
      </header>

      {banner.length > 0 ? (
        <div className="display-banner" role="status">
          <span>{banner.map((item) => (item.body ? `${item.title}: ${item.body}` : item.title)).join("   •   ")}</span>
        </div>
      ) : null}

      <main className="display-grid">
        <div className="display-column">
          {panels.apparatus ? (
            <section className="display-panel">
              <h2>Apparatus</h2>
              <h3>In Service</h3>
              {inService.length === 0 ? <p className="display-empty">None</p> : null}
              <div className="display-units">
                {inService.map((unit) => (
                  <span key={unit.unitId} className="display-unit display-unit-ok">{unit.unitId}</span>
                ))}
              </div>
              <h3>Out of Service</h3>
              {outOfService.length === 0 ? <p className="display-empty">None</p> : null}
              {outOfService.map((unit) => (
                <div key={unit.unitId} className="display-oos">
                  <span className="display-unit display-unit-down">{unit.unitId}</span>
                  <span>
                    {unit.outOfServiceReason || "Out of service"}
                    {unit.outOfServiceSince ? ` · since ${formatTimestamp24(unit.outOfServiceSince)}` : ""}
                  </span>
                </div>
              ))}
            </section>
          ) : null}
          {panels.onDuty ? (
            <section className="display-panel">
              <h2>On Duty{feed?.onDuty.shifts.length ? ` · ${feed.onDuty.shifts.join(", ")}` : ""}</h2>
              {(feed?.onDuty.units ?? []).length === 0 ? <p className="display-empty">No one is on the schedule right now.</p> : null}
              {(feed?.onDuty.units ?? []).map((unit) => (
                <div key={unit.unit} className="display-crew">
                  <strong>{unit.unit}</strong>
                  <span>{unit.people.join(", ")}</span>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        {panels.incidents ? (
          <section className="display-panel display-incidents">
            <h2>Incidents</h2>
            {(feed?.incidents ?? []).length === 0 ? <p className="display-empty">No recent calls.</p> : null}
            {(feed?.incidents ?? []).map((incident) => (
              <div
                key={incident.id}
                className={
                  now.getTime() - new Date(incident.createdAt).getTime() < 60 * 60 * 1000
                    ? "display-incident display-incident-recent"
                    : "display-incident"
                }
              >
                <span className="display-incident-time">{callTime(incident, now)}</span>
                <div>
                  <strong>
                    {incident.incidentType || "Incident"}
                    {incident.priority ? <span className="display-priority">{incident.priority}</span> : null}
                  </strong>
                  <span>{incident.address || "Address not given"}</span>
                  <span className="display-incident-units">
                    {incident.assignedUnits}
                    {incident.districtUnknown ? <span className="display-unknown">District not confirmed</span> : null}
                  </span>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <div className="display-column">
          {panels.events ? (
            <section className="display-panel">
              <h2>Events</h2>
              {(feed?.events ?? []).length === 0 ? <p className="display-empty">No upcoming events.</p> : null}
              {(feed?.events ?? []).map((event) => (
                <div key={event.id} className="display-event">
                  <span className="display-incident-time">{formatTimestamp24(event.startsAt)}</span>
                  <div>
                    <strong>{event.title}</strong>
                    {event.location ? <span>{event.location}</span> : null}
                  </div>
                </div>
              ))}
            </section>
          ) : null}
          {panels.messages ? (
            <section className="display-panel">
              <h2>Messages</h2>
              {(feed?.announcements ?? []).length === 0 ? <p className="display-empty">No messages.</p> : null}
              {(feed?.announcements ?? []).map((item) => (
                <div key={item.id} className={item.important ? "display-message display-message-important" : "display-message"}>
                  <strong>{item.title}</strong>
                  {item.body ? <span>{item.body}</span> : null}
                </div>
              ))}
            </section>
          ) : null}
        </div>
      </main>

      <footer className="display-footer">
        <span>{updatedAt ? `Updated ${clockText(updatedAt)}` : "Loading..."}</span>
        {feedError ? <span className="display-feed-error">{feedError}</span> : null}
        <span className="display-footer-actions">
          {board.soundOn && !soundReady ? (
            <button type="button" className="primary-button compact-button maintenance-icon-button" onClick={enableSound}>
              <Volume2 size={15} aria-hidden="true" /> Tap to enable sound
            </button>
          ) : null}
          <button
            type="button"
            className="secondary-button compact-button"
            aria-label="Full screen"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen();
            }}
          >
            <Maximize2 size={15} aria-hidden="true" />
          </button>
        </span>
      </footer>

      {activeTakeover ? (
        <div className="display-takeover" role="alertdialog" aria-label="New call">
          <header className="display-takeover-header">
            <strong>NEW CALL</strong>
            <span>{Math.max(0, Math.ceil((activeTakeover.until - now.getTime()) / 1000))} s</span>
            <button type="button" className="secondary-button compact-button" aria-label="Close" onClick={() => setTakeover(null)}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="display-takeover-body">
            <div className="display-takeover-details">
              <h2>
                {activeTakeover.incident.incidentType || "Incident"}
                {activeTakeover.incident.priority ? <span className="display-priority">{activeTakeover.incident.priority}</span> : null}
              </h2>
              <p className="display-takeover-address">{activeTakeover.incident.address || "Address not given"}</p>
              <dl>
                <dt>Units</dt>
                <dd>{activeTakeover.incident.assignedUnits || "Not listed"}</dd>
                <dt>Time</dt>
                <dd>{callTime(activeTakeover.incident, now) || "—"}</dd>
                {activeTakeover.incident.incidentNumber ? (
                  <>
                    <dt>Incident #</dt>
                    <dd>{activeTakeover.incident.incidentNumber}</dd>
                  </>
                ) : null}
              </dl>
            </div>
            {activeTakeover.incident.address ? (
              <CallMap
                key={activeTakeover.incident.id}
                incidentId={activeTakeover.incident.id}
                address={activeTakeover.incident.address}
                latitude={activeTakeover.incident.latitude}
                longitude={activeTakeover.incident.longitude}
              />
            ) : (
              <p className="call-map-note">No address on this call, so there is no map.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
