import { useMemo } from "react";
import { ClientCard } from "../components/ClientCard";
import { flightTone } from "../components/FlightStatus";
import { useAppState } from "../store/store";
import { jobDateTime, minutesBetween, todayISO } from "../utils/time";
import type { Client } from "../types";

interface Props {
  onEdit: (client: Client) => void;
}

export function DashboardView({ onEdit }: Props) {
  const { clients } = useAppState();

  const stats = useMemo(() => {
    const now = new Date();
    const today = todayISO();
    const active = clients.filter((c) => !c.archived && c.status !== "completed");

    const waiting = active.filter((c) => c.type === "incoming");
    const toDeliver = active.filter((c) => c.type === "outgoing");
    const completedToday = clients.filter(
      (c) =>
        c.status === "completed" &&
        c.completedAt &&
        c.completedAt.slice(0, 10) === today,
    );
    const delayed = active.filter((c) => flightTone(c.flight) !== "ok");
    const nextHour = active.filter((c) => {
      const mins = minutesBetween(now, jobDateTime(c));
      return mins >= 0 && mins <= 60;
    });
    const upcoming = active
      .filter((c) => jobDateTime(c).getTime() >= now.getTime() - 30 * 60000)
      .sort((a, b) => jobDateTime(a).getTime() - jobDateTime(b).getTime())
      .slice(0, 5);

    return { waiting, toDeliver, completedToday, delayed, nextHour, upcoming };
  }, [clients]);

  return (
    <div>
      <div className="stat-grid">
        <Tile label="Cars waiting" value={stats.waiting.length} hint="pickups open" />
        <Tile
          label="Cars to deliver"
          value={stats.toDeliver.length}
          hint="returns open"
        />
        <Tile
          label="Completed today"
          value={stats.completedToday.length}
          hint="jobs closed"
        />
        <Tile
          label="Flights delayed"
          value={stats.delayed.length}
          hint="or cancelled"
          alert={stats.delayed.length > 0}
        />
        <Tile
          label="Next hour"
          value={stats.nextHour.length}
          hint="hand-overs due"
          alert={stats.nextHour.length > 0}
        />
      </div>

      {stats.delayed.length > 0 && (
        <>
          <div className="section-title">⚠️ Flight problems</div>
          {stats.delayed.map((c) => (
            <ClientCard key={c.id} client={c} onEdit={onEdit} showDate />
          ))}
        </>
      )}

      <div className="section-title">⏭ Next up</div>
      {stats.upcoming.length === 0 && (
        <div className="empty">
          <div className="big">☕️</div>
          Nothing coming up. Enjoy the break.
        </div>
      )}
      {stats.upcoming.map((c) => (
        <ClientCard key={c.id} client={c} onEdit={onEdit} showDate />
      ))}
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: number;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div className={`stat-tile ${alert ? "alert" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
