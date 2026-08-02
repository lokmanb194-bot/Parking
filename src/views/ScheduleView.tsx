import { useMemo, useState } from "react";
import { ClientCard } from "../components/ClientCard";
import { useAppState } from "../store/store";
import {
  addDays,
  formatDayLabel,
  jobDateTime,
  todayISO,
  weekDays,
} from "../utils/time";
import type { Client } from "../types";

type Mode = "agenda" | "week" | "timeline";
type StatusFilter = "all" | "pending" | "completed";
type SortKey = "time" | "incoming-first" | "outgoing-first";

interface Props {
  onEdit: (client: Client) => void;
}

export function ScheduleView({ onEdit }: Props) {
  const { clients } = useAppState();
  const [mode, setMode] = useState<Mode>("agenda");
  const [selectedDay, setSelectedDay] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [descending, setDescending] = useState(false);

  const active = useMemo(
    () => clients.filter((c) => !c.archived),
    [clients],
  );

  const dayClients = useMemo(() => {
    const list = active
      .filter((c) => c.date === selectedDay)
      .filter((c) =>
        statusFilter === "all"
          ? true
          : statusFilter === "completed"
            ? c.status === "completed"
            : c.status !== "completed",
      )
      .sort((a, b) => {
        if (sortKey !== "time" && a.type !== b.type) {
          const first = sortKey === "incoming-first" ? "incoming" : "outgoing";
          return a.type === first ? -1 : 1;
        }
        const diff = jobDateTime(a).getTime() - jobDateTime(b).getTime();
        return descending ? -diff : diff;
      });
    return list;
  }, [active, selectedDay, statusFilter, sortKey, descending]);

  const days = weekDays(selectedDay);

  return (
    <div>
      <div className="field" style={{ marginBottom: 12 }}>
        <div className="segmented">
          {(["agenda", "week", "timeline"] as const).map((m) => (
            <button
              key={m}
              className={mode === m ? "active" : ""}
              onClick={() => setMode(m)}
            >
              {m === "agenda" ? "Agenda" : m === "week" ? "Week" : "Timeline"}
            </button>
          ))}
        </div>
      </div>

      <div className="chip-row">
        <button className="chip" onClick={() => setSelectedDay(addDays(selectedDay, -1))}>
          ‹
        </button>
        <button
          className={`chip ${selectedDay === todayISO() ? "active" : ""}`}
          onClick={() => setSelectedDay(todayISO())}
        >
          {formatDayLabel(selectedDay)}
        </button>
        <button className="chip" onClick={() => setSelectedDay(addDays(selectedDay, 1))}>
          ›
        </button>
        <button
          className={`chip ${statusFilter === "pending" ? "active" : ""}`}
          onClick={() =>
            setStatusFilter(statusFilter === "pending" ? "all" : "pending")
          }
        >
          Pending
        </button>
        <button
          className={`chip ${statusFilter === "completed" ? "active" : ""}`}
          onClick={() =>
            setStatusFilter(statusFilter === "completed" ? "all" : "completed")
          }
        >
          Completed
        </button>
        <button
          className={`chip ${sortKey === "incoming-first" ? "active" : ""}`}
          onClick={() =>
            setSortKey(sortKey === "incoming-first" ? "time" : "incoming-first")
          }
        >
          🚗 Pickups first
        </button>
        <button
          className={`chip ${sortKey === "outgoing-first" ? "active" : ""}`}
          onClick={() =>
            setSortKey(sortKey === "outgoing-first" ? "time" : "outgoing-first")
          }
        >
          🔑 Returns first
        </button>
        <button className="chip" onClick={() => setDescending(!descending)}>
          {descending ? "↓ Latest first" : "↑ Earliest first"}
        </button>
      </div>

      {(mode === "week" || mode === "agenda") && mode === "week" && (
        <WeekGrid
          days={days}
          selected={selectedDay}
          clients={active}
          onSelect={setSelectedDay}
        />
      )}

      {mode === "timeline" ? (
        <Timeline clients={dayClients} day={selectedDay} />
      ) : (
        <div>
          {dayClients.length === 0 && (
            <div className="empty">
              <div className="big">📅</div>
              Nothing scheduled for {formatDayLabel(selectedDay)}.
            </div>
          )}
          {dayClients.map((c) => (
            <ClientCard key={c.id} client={c} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

function WeekGrid({
  days,
  selected,
  clients,
  onSelect,
}: {
  days: string[];
  selected: string;
  clients: Client[];
  onSelect: (day: string) => void;
}) {
  const today = todayISO();
  return (
    <div className="week-grid">
      {days.map((day) => {
        const jobs = clients.filter((c) => c.date === day);
        const hasIn = jobs.some((c) => c.type === "incoming");
        const hasOut = jobs.some((c) => c.type === "outgoing");
        const d = new Date(`${day}T12:00:00`);
        return (
          <button
            key={day}
            className={`day-cell ${day === selected ? "selected" : ""} ${
              day === today ? "today" : ""
            }`}
            onClick={() => onSelect(day)}
          >
            <span className="dow">
              {d.toLocaleDateString(undefined, { weekday: "short" })}
            </span>
            <span className="num">{d.getDate()}</span>
            <span className="counts">
              {hasIn && <span className="dot in" />}
              {hasOut && <span className="dot out" />}
              {jobs.length > 0 && (
                <span style={{ fontSize: 10, color: "var(--muted)" }}>
                  {jobs.length}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const DAY_START = 5; // 05:00
const DAY_END = 24; // 24:00
const HOUR_PX = 64;

function Timeline({ clients, day }: { clients: Client[]; day: string }) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const now = new Date();
  const isToday = day === todayISO();
  const nowOffset =
    (now.getHours() + now.getMinutes() / 60 - DAY_START) * HOUR_PX;

  const position = (c: Client) => {
    const dt = jobDateTime(c);
    const hoursFromStart = dt.getHours() + dt.getMinutes() / 60 - DAY_START;
    return Math.max(0, hoursFromStart * HOUR_PX);
  };

  return (
    <div className="timeline">
      {isToday && nowOffset > 0 && nowOffset < hours.length * HOUR_PX && (
        <div className="now-line" style={{ top: nowOffset }} />
      )}
      {hours.map((h) => (
        <div className="timeline-hour" key={h}>
          <span className="hlabel">{String(h).padStart(2, "0")}:00</span>
        </div>
      ))}
      {clients.map((c) => (
        <div
          key={c.id}
          className={`timeline-event ${c.type === "outgoing" ? "out" : ""} ${
            c.status === "completed" ? "done" : ""
          }`}
          style={{ top: position(c) }}
        >
          <strong>{c.time}</strong> · {c.type === "incoming" ? "🚗" : "🔑"}{" "}
          {c.name} · {c.plate}
          {c.flightNumber ? ` · ✈ ${c.flightNumber}` : ""}
        </div>
      ))}
    </div>
  );
}
