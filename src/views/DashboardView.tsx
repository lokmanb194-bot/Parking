import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
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
    const inParking = active.filter((c) => c.parkingStatus === "in_parking");
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
      .slice(0, 6);

    return {
      waiting,
      toDeliver,
      inParking,
      completedToday,
      delayed,
      nextHour,
      upcoming,
    };
  }, [clients]);

  return (
    <div>
      <div className="stat-grid">
        <Tile
          label="Cars in parking"
          value={stats.inParking.length}
          hint="inside Aena now"
          accent="blue"
        />
        <Tile label="Cars waiting" value={stats.waiting.length} hint="pickups open" />
        <Tile
          label="Cars to deliver"
          value={stats.toDeliver.length}
          hint="returns open"
          accent="scarlet"
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
          accent={stats.nextHour.length > 0 ? "scarlet" : undefined}
        />
      </div>

      {stats.delayed.length > 0 && (
        <>
          <div className="section-title">⚠️ Flight problems</div>
          <div className="cards-2col">
            <AnimatePresence initial={false}>
              {stats.delayed.map((c) => (
                <ClientCard key={c.id} client={c} onEdit={onEdit} showDate />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      <div className="section-title">⏭ Next up</div>
      {stats.upcoming.length === 0 && (
        <div className="empty">
          <div className="big">☕️</div>
          Nothing coming up. Enjoy the break.
        </div>
      )}
      <div className="cards-2col">
        <AnimatePresence initial={false}>
          {stats.upcoming.map((c) => (
            <ClientCard key={c.id} client={c} onEdit={onEdit} showDate />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  alert,
  accent,
}: {
  label: string;
  value: number;
  hint?: string;
  alert?: boolean;
  accent?: "blue" | "scarlet";
}) {
  const cls = [
    "stat-tile",
    alert ? "alert" : "",
    accent ? `accent-${accent}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <div className="label">{label}</div>
      <div className="value">
        <AnimatedNumber value={value} />
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

/** Counts up to `value` when it changes (respects reduced-motion). */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === value) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const start = performance.now();
    const duration = 500;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display}</>;
}
