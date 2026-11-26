import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ExternalLink, Megaphone, Monitor, Plus } from "lucide-react";
import {
  BOARD_PANELS,
  createAnnouncement,
  createBoard,
  createDisplayEvent,
  deleteAnnouncement,
  deleteBoard,
  deleteDisplayEvent,
  getAnnouncements,
  getBoards,
  getDisplayEvents,
  updateAnnouncement,
  updateBoard,
  updateDisplayEvent,
  type Announcement,
  type BoardPanel,
  type DisplayBoard,
  type DisplayEvent,
} from "../../api/displays";
import { getGeofences, type Geofence } from "../../api/maps";
import { ModuleTable } from "../../components/ModuleTable";
import { useModuleLookups } from "../../moduleLookups";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { useMyPermissions } from "../../useMyPermissions";
import { EditDialog } from "../maintenance/MaintenanceSetupTabs";
import { errorText, formatTimestamp24, isoToLocalParts, localPartsToIso, normalizeTime24 } from "../maintenance/maintenanceUtils";
import { useDialogSave } from "../maintenance/useDialogSave";
import { kindLabel } from "../maps/mapUtils";

type PageTab = "boards" | "messages" | "events";

const PAGE_TABS: { id: PageTab; label: string; Icon: typeof Monitor }[] = [
  { id: "boards", label: "Boards", Icon: Monitor },
  { id: "messages", label: "Messages", Icon: Megaphone },
  { id: "events", label: "Events", Icon: CalendarDays },
];

const CALL_FILTER_OPTIONS = [
  { value: "all", label: "All department calls" },
  { value: "districts", label: "Only calls in chosen districts" },
];

interface BoardDraft {
  id: string | null;
  name: string;
  stationName: string;
  callFilter: "all" | "districts";
  filterGeofenceIds: string[];
  takeoverSeconds: string;
  soundOn: boolean;
  panels: Record<BoardPanel, boolean>;
}

interface MessageDraft {
  id: string | null;
  title: string;
  body: string;
  important: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

interface EventDraft {
  id: string | null;
  title: string;
  date: string;
  time: string;
  location: string;
  notes: string;
}

const ALL_PANELS: Record<BoardPanel, boolean> = { apparatus: true, onDuty: true, incidents: true, events: true, messages: true };

/** Date plus typed 24-hour time. An empty date means "not set". */
function toIso(date: string, time: string, label: string, required: boolean): string {
  if (!date) {
    if (required) throw new Error(`Enter ${label}.`);
    return "";
  }
  if (time && !normalizeTime24(time)) throw new Error(`Enter the ${label} time as HH:MM in 24-hour time.`);
  return localPartsToIso(date, time);
}

function DateTimeField({
  label,
  date,
  time,
  onChange,
}: {
  label: string;
  date: string;
  time: string;
  onChange: (date: string, time: string) => void;
}) {
  return (
    <div className="maintenance-field">
      <span className="maintenance-field-label">{label}</span>
      <div className="maintenance-time-row">
        <input type="date" aria-label={`${label} date`} value={date} onChange={(event) => onChange(event.target.value, time)} />
        <input
          type="text"
          inputMode="numeric"
          placeholder="HH:MM"
          aria-label={`${label} time (24-hour)`}
          value={time}
          onChange={(event) => onChange(date, event.target.value)}
          onBlur={(event) => {
            const normalized = normalizeTime24(event.currentTarget.value);
            if (normalized) onChange(date, normalized);
          }}
        />
      </div>
    </div>
  );
}

/** Admin Functions > Displays: station boards, the messages they show, and upcoming events. */
export function DisplaysAdminPage() {
  const grants = useMyPermissions();
  const canManage = grants?.["displays.manage"] === true;
  const lookups = useModuleLookups();
  const [tab, setTab] = useState<PageTab>("boards");
  const [boards, setBoards] = useState<DisplayBoard[]>([]);
  const [messages, setMessages] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [areas, setAreas] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [boardDraft, setBoardDraft] = useState<BoardDraft | null>(null);
  const [messageDraft, setMessageDraft] = useState<MessageDraft | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft | null>(null);
  const dialog = useDialogSave();

  const reload = useCallback(async () => {
    try {
      const [nextBoards, nextMessages, nextEvents] = await Promise.all([getBoards(), getAnnouncements(), getDisplayEvents()]);
      setBoards(nextBoards);
      setMessages(nextMessages);
      setEvents(nextEvents);
      setError("");
    } catch (loadError) {
      setError(errorText(loadError, "Could not load displays."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([getBoards(), getAnnouncements(), getDisplayEvents()])
      .then(([nextBoards, nextMessages, nextEvents]) => {
        if (!active) return;
        setBoards(nextBoards);
        setMessages(nextMessages);
        setEvents(nextEvents);
      })
      .catch((loadError) => {
        if (active) setError(errorText(loadError, "Could not load displays."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void getGeofences()
      .then((rows) => {
        if (active) setAreas(rows);
      })
      .catch(() => {
        if (active) setAreas([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const areaName = (id: string) => areas.find((area) => area.id === id)?.name ?? "Removed area";
  const sortedAreas = [...areas].sort(
    (a, b) => Number(b.kind === "district") - Number(a.kind === "district") || a.name.localeCompare(b.name),
  );

  const openBoard = (board: DisplayBoard | null) => {
    dialog.setError("");
    setBoardDraft(
      board
        ? {
            id: board.id,
            name: board.name,
            stationName: board.stationName,
            callFilter: board.callFilter,
            filterGeofenceIds: board.filterGeofenceIds,
            takeoverSeconds: String(board.takeoverSeconds),
            soundOn: board.soundOn,
            panels: { ...ALL_PANELS, ...board.panels },
          }
        : {
            id: null,
            name: "",
            stationName: "",
            callFilter: "all",
            filterGeofenceIds: [],
            takeoverSeconds: "60",
            soundOn: true,
            panels: { ...ALL_PANELS },
          },
    );
  };

  const saveBoard = () => {
    if (!boardDraft) return;
    void dialog.run(async () => {
      const input = {
        name: boardDraft.name.trim(),
        stationName: boardDraft.stationName,
        callFilter: boardDraft.callFilter,
        filterGeofenceIds: boardDraft.callFilter === "districts" ? boardDraft.filterGeofenceIds : [],
        takeoverSeconds: Number(boardDraft.takeoverSeconds),
        soundOn: boardDraft.soundOn,
        panels: boardDraft.panels,
      };
      if (!input.name) throw new Error("Enter a name for the board.");
      if (boardDraft.id) await updateBoard(boardDraft.id, input);
      else await createBoard(input);
      setBoardDraft(null);
      await reload();
    }, "Could not save the board.");
  };

  const openMessage = (message: Announcement | null) => {
    dialog.setError("");
    const start = isoToLocalParts(message?.startsAt ?? "");
    const end = isoToLocalParts(message?.endsAt ?? "");
    setMessageDraft({
      id: message?.id ?? null,
      title: message?.title ?? "",
      body: message?.body ?? "",
      important: message?.important ?? false,
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
    });
  };

  const saveMessage = () => {
    if (!messageDraft) return;
    void dialog.run(async () => {
      if (!messageDraft.title.trim()) throw new Error("Enter a title for the message.");
      const input = {
        title: messageDraft.title.trim(),
        body: messageDraft.body,
        important: messageDraft.important,
        startsAt: toIso(messageDraft.startDate, messageDraft.startTime, "the start", false),
        endsAt: toIso(messageDraft.endDate, messageDraft.endTime, "the end", false),
      };
      if (messageDraft.id) await updateAnnouncement(messageDraft.id, input);
      else await createAnnouncement(input);
      setMessageDraft(null);
      await reload();
    }, "Could not save the message.");
  };

  const openEvent = (event: DisplayEvent | null) => {
    dialog.setError("");
    const start = isoToLocalParts(event?.startsAt ?? "");
    setEventDraft({
      id: event?.id ?? null,
      title: event?.title ?? "",
      date: start.date,
      time: start.time,
      location: event?.location ?? "",
      notes: event?.notes ?? "",
    });
  };

  const saveEvent = () => {
    if (!eventDraft) return;
    void dialog.run(async () => {
      if (!eventDraft.title.trim()) throw new Error("Enter a title for the event.");
      const input = {
        title: eventDraft.title.trim(),
        startsAt: toIso(eventDraft.date, eventDraft.time, "a start date", true),
        location: eventDraft.location,
        notes: eventDraft.notes,
      };
      if (eventDraft.id) await updateDisplayEvent(eventDraft.id, input);
      else await createDisplayEvent(input);
      setEventDraft(null);
      await reload();
    }, "Could not save the event.");
  };

  const remove = (work: () => Promise<void>, close: () => void, fallback: string) => {
    void dialog.run(async () => {
      await work();
      close();
      await reload();
    }, fallback);
  };

  const addButton = {
    boards: { label: "Add Board", onClick: () => openBoard(null) },
    messages: { label: "Add Message", onClick: () => openMessage(null) },
    events: { label: "Add Event", onClick: () => openEvent(null) },
  }[tab];

  const togglePanel = (panel: BoardPanel, on: boolean) => {
    if (boardDraft) setBoardDraft({ ...boardDraft, panels: { ...boardDraft.panels, [panel]: on } });
  };

  const toggleArea = (id: string, on: boolean) => {
    if (!boardDraft) return;
    const next = on ? [...boardDraft.filterGeofenceIds, id] : boardDraft.filterGeofenceIds.filter((item) => item !== id);
    setBoardDraft({ ...boardDraft, filterGeofenceIds: next });
  };

  return (
    <section className="page-section">
      <header className="page-header">
        <div>
          <h1>Displays</h1>
          <p>Station TV boards, the messages they show, and upcoming events. Open a board on the station TV and leave it running.</p>
        </div>
        {canManage ? (
          <button type="button" className="primary-button maintenance-icon-button" onClick={addButton.onClick}>
            <Plus size={15} aria-hidden="true" /> {addButton.label}
          </button>
        ) : null}
      </header>

      <nav className="department-editor-toolbar-actions maintenance-tabs" aria-label="Displays sections">
        {PAGE_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`secondary-button compact-button ${tab === id ? "department-toggle-active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={14} aria-hidden="true" /> {label}
          </button>
        ))}
      </nav>

      {error ? <p className="field-error">{error}</p> : null}
      {loading ? <p className="field-hint">Loading...</p> : null}

      {!loading && tab === "boards" ? (
        <article className="panel">
          <ModuleTable
            tableId="display-boards"
            columns={[
              { id: "name", label: "Board", width: 200, value: (row) => row.name, render: (row) => <strong>{row.name}</strong> },
              { id: "station", label: "Station", width: 150, value: (row) => row.stationName, render: (row) => row.stationName || "All stations" },
              {
                id: "calls",
                label: "Calls",
                width: 220,
                value: (row) => row.callFilter,
                render: (row) =>
                  row.callFilter === "districts" ? row.filterGeofenceIds.map(areaName).join(", ") : "All department calls",
              },
              { id: "takeover", label: "Takeover", width: 100, value: (row) => row.takeoverSeconds, render: (row) => `${row.takeoverSeconds} s` },
              { id: "sound", label: "Sound", width: 80, value: (row) => (row.soundOn ? 1 : 0), render: (row) => (row.soundOn ? "On" : "Off") },
              {
                id: "open",
                label: "Board",
                width: 220,
                render: (row) => (
                  <span className="display-admin-links">
                    <a href={`/display/${row.id}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                      <ExternalLink size={13} aria-hidden="true" /> Open board
                    </a>
                    <a href={`/display/${row.id}?test=1`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                      Test alert
                    </a>
                  </span>
                ),
              },
            ]}
            rows={boards}
            rowKey={(row) => row.id}
            emptyText="No boards yet. Add one for each station TV."
            defaultSort={{ id: "name", direction: "asc" }}
            onRowClick={(row) => openBoard(row)}
          />
        </article>
      ) : null}

      {!loading && tab === "messages" ? (
        <article className="panel">
          <p className="field-hint">Every board shows current messages. Important messages also scroll in the red banner.</p>
          <ModuleTable
            tableId="display-messages"
            columns={[
              { id: "title", label: "Message", width: 260, value: (row) => row.title, render: (row) => <strong>{row.title}</strong> },
              { id: "important", label: "Banner", width: 90, value: (row) => (row.important ? 1 : 0), render: (row) => (row.important ? "Yes" : "No") },
              { id: "starts", label: "Starts", width: 160, value: (row) => row.startsAt, render: (row) => formatTimestamp24(row.startsAt) || "Now" },
              { id: "ends", label: "Ends", width: 160, value: (row) => row.endsAt, render: (row) => formatTimestamp24(row.endsAt) || "No end" },
              { id: "updated", label: "Updated", width: 160, value: (row) => row.updatedAt, render: (row) => formatTimestamp24(row.updatedAt) },
            ]}
            rows={messages}
            rowKey={(row) => row.id}
            emptyText="No messages yet."
            defaultSort={{ id: "updated", direction: "desc" }}
            onRowClick={(row) => openMessage(row)}
          />
        </article>
      ) : null}

      {!loading && tab === "events" ? (
        <article className="panel">
          <p className="field-hint">Boards show events from 6 hours ago onward, soonest first. The Calendar module replaces this list later.</p>
          <ModuleTable
            tableId="display-events"
            columns={[
              { id: "starts", label: "Starts", width: 160, value: (row) => row.startsAt, render: (row) => formatTimestamp24(row.startsAt) },
              { id: "title", label: "Event", width: 260, value: (row) => row.title, render: (row) => <strong>{row.title}</strong> },
              { id: "location", label: "Location", width: 200, value: (row) => row.location, render: (row) => row.location || "—" },
            ]}
            rows={events}
            rowKey={(row) => row.id}
            emptyText="No events yet."
            defaultSort={{ id: "starts", direction: "desc" }}
            onRowClick={(row) => openEvent(row)}
          />
        </article>
      ) : null}

      {boardDraft ? (
        <EditDialog
          title={boardDraft.id ? (canManage ? "Edit board" : "Board") : "Add board"}
          error={dialog.error}
          saving={dialog.saving}
          readOnly={!canManage}
          onSave={saveBoard}
          onCancel={() => setBoardDraft(null)}
          onDelete={
            boardDraft.id && canManage
              ? () => remove(() => deleteBoard(boardDraft.id!), () => setBoardDraft(null), "Could not delete the board.")
              : undefined
          }
        >
          <label>
            Board name
            <input type="text" value={boardDraft.name} onChange={(event) => setBoardDraft({ ...boardDraft, name: event.target.value })} />
          </label>
          <label>
            Station
            <NerisFlatSingleOptionSelect
              inputId="display-board-station"
              value={boardDraft.stationName}
              options={lookups.stations.map((name) => ({ value: name, label: name }))}
              placeholder="All stations"
              usePortal
              allowClear
              disabled={!canManage}
              onChange={(value) => setBoardDraft({ ...boardDraft, stationName: value })}
            />
          </label>
          <label>
            Calls shown
            <NerisFlatSingleOptionSelect
              inputId="display-board-calls"
              value={boardDraft.callFilter}
              options={CALL_FILTER_OPTIONS}
              usePortal
              disabled={!canManage}
              onChange={(value) => setBoardDraft({ ...boardDraft, callFilter: value === "districts" ? "districts" : "all" })}
            />
          </label>
          <label>
            Takeover seconds
            <input
              type="number"
              min={10}
              max={600}
              value={boardDraft.takeoverSeconds}
              onChange={(event) => setBoardDraft({ ...boardDraft, takeoverSeconds: event.target.value })}
            />
          </label>
          {boardDraft.callFilter === "districts" ? (
            <div className="maintenance-field map-span">
              <span className="maintenance-field-label">Districts</span>
              {sortedAreas.length === 0 ? (
                <p className="field-hint">No areas yet. Draw districts on Incidents &amp; Mapping &gt; Map Markers first.</p>
              ) : (
                <div className="display-check-grid">
                  {sortedAreas.map((area) => (
                    <label key={area.id} className="maintenance-checkbox-row">
                      <input
                        type="checkbox"
                        checked={boardDraft.filterGeofenceIds.includes(area.id)}
                        onChange={(event) => toggleArea(area.id, event.target.checked)}
                      />
                      {area.name} <span className="field-hint">({kindLabel(area.kind)})</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="field-hint">A call is placed with the US Census address lookup. A call that cannot be placed still shows, marked "District not confirmed".</p>
            </div>
          ) : null}
          <div className="maintenance-field map-span">
            <span className="maintenance-field-label">Panels</span>
            <div className="display-check-grid">
              {BOARD_PANELS.map((panel) => (
                <label key={panel.value} className="maintenance-checkbox-row">
                  <input
                    type="checkbox"
                    checked={boardDraft.panels[panel.value]}
                    onChange={(event) => togglePanel(panel.value, event.target.checked)}
                  />
                  {panel.label}
                </label>
              ))}
              <label className="maintenance-checkbox-row">
                <input type="checkbox" checked={boardDraft.soundOn} onChange={(event) => setBoardDraft({ ...boardDraft, soundOn: event.target.checked })} />
                Sound on new calls
              </label>
            </div>
          </div>
        </EditDialog>
      ) : null}

      {messageDraft ? (
        <EditDialog
          title={messageDraft.id ? (canManage ? "Edit message" : "Message") : "Add message"}
          error={dialog.error}
          saving={dialog.saving}
          readOnly={!canManage}
          onSave={saveMessage}
          onCancel={() => setMessageDraft(null)}
          onDelete={
            messageDraft.id && canManage
              ? () => remove(() => deleteAnnouncement(messageDraft.id!), () => setMessageDraft(null), "Could not delete the message.")
              : undefined
          }
        >
          <label className="map-span">
            Title
            <input type="text" value={messageDraft.title} onChange={(event) => setMessageDraft({ ...messageDraft, title: event.target.value })} />
          </label>
          <label className="maintenance-textarea-label map-span">
            Details
            <textarea rows={3} value={messageDraft.body} onChange={(event) => setMessageDraft({ ...messageDraft, body: event.target.value })} />
          </label>
          <DateTimeField
            label="Starts (blank shows now)"
            date={messageDraft.startDate}
            time={messageDraft.startTime}
            onChange={(date, time) => setMessageDraft({ ...messageDraft, startDate: date, startTime: time })}
          />
          <DateTimeField
            label="Ends (blank never ends)"
            date={messageDraft.endDate}
            time={messageDraft.endTime}
            onChange={(date, time) => setMessageDraft({ ...messageDraft, endDate: date, endTime: time })}
          />
          <label className="maintenance-checkbox-row map-span">
            <input
              type="checkbox"
              checked={messageDraft.important}
              onChange={(event) => setMessageDraft({ ...messageDraft, important: event.target.checked })}
            />
            Important: also scroll in the red banner
          </label>
        </EditDialog>
      ) : null}

      {eventDraft ? (
        <EditDialog
          title={eventDraft.id ? (canManage ? "Edit event" : "Event") : "Add event"}
          error={dialog.error}
          saving={dialog.saving}
          readOnly={!canManage}
          onSave={saveEvent}
          onCancel={() => setEventDraft(null)}
          onDelete={
            eventDraft.id && canManage
              ? () => remove(() => deleteDisplayEvent(eventDraft.id!), () => setEventDraft(null), "Could not delete the event.")
              : undefined
          }
        >
          <label className="map-span">
            Title
            <input type="text" value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} />
          </label>
          <DateTimeField
            label="Starts"
            date={eventDraft.date}
            time={eventDraft.time}
            onChange={(date, time) => setEventDraft({ ...eventDraft, date, time })}
          />
          <label>
            Location
            <input type="text" value={eventDraft.location} onChange={(event) => setEventDraft({ ...eventDraft, location: event.target.value })} />
          </label>
          <label className="maintenance-textarea-label map-span">
            Notes
            <textarea rows={3} value={eventDraft.notes} onChange={(event) => setEventDraft({ ...eventDraft, notes: event.target.value })} />
          </label>
        </EditDialog>
      ) : null}
    </section>
  );
}
