import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { addClient, setParkingStatus } from "../store/actions";
import { useAppState } from "../store/store";
import {
  addDays,
  formatDayLabel,
  jobDateTime,
  nowHHMM,
  todayISO,
} from "../utils/time";
import type { Client, JobType, ParkingStatus } from "../types";

interface Props {
  onEdit: (client: Client) => void;
}

const NEXT: Record<ParkingStatus, ParkingStatus> = {
  awaiting: "in_parking",
  in_parking: "returned",
  returned: "awaiting",
};

/**
 * The admin panel's core: build the day's program fast. Pick a date, add
 * reservations inline, and cycle each car's parking status with one tap.
 */
export function DailyProgramView({ onEdit }: Props) {
  const { clients } = useAppState();
  const [day, setDay] = useState(todayISO());

  const dayClients = useMemo(
    () =>
      clients
        .filter((c) => c.date === day && !c.archived)
        .sort((a, b) => jobDateTime(a).getTime() - jobDateTime(b).getTime()),
    [clients, day],
  );

  const counts = useMemo(
    () => ({
      total: dayClients.length,
      incoming: dayClients.filter((c) => c.type === "incoming").length,
      outgoing: dayClients.filter((c) => c.type === "outgoing").length,
      parked: dayClients.filter((c) => c.parkingStatus === "in_parking").length,
    }),
    [dayClients],
  );

  return (
    <div>
      <div className="program-toolbar">
        <button className="chip" onClick={() => setDay(addDays(day, -1))}>
          ‹ Prev
        </button>
        <input
          className="date-input"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value || todayISO())}
          aria-label="Program date"
        />
        <button className="chip" onClick={() => setDay(addDays(day, 1))}>
          Next ›
        </button>
        <button
          className={`chip ${day === todayISO() ? "active" : ""}`}
          onClick={() => setDay(todayISO())}
        >
          Today
        </button>
      </div>

      <div className="prog-summary">
        <span className="chipstat">
          📋 <b>{counts.total}</b> total
        </span>
        <span className="chipstat">
          🚗 <b>{counts.incoming}</b> pickups
        </span>
        <span className="chipstat">
          🔑 <b>{counts.outgoing}</b> returns
        </span>
        <span className="chipstat">
          🅿️ <b>{counts.parked}</b> in parking
        </span>
      </div>

      <QuickAdd day={day} />

      <div className="date-heading">
        {formatDayLabel(day)} · {counts.total} reservation
        {counts.total === 1 ? "" : "s"}
      </div>

      {dayClients.length === 0 && (
        <div className="empty">
          <div className="big">🗒️</div>
          Nothing on the program for {formatDayLabel(day)} yet. Add the day’s
          cars above.
        </div>
      )}

      <AnimatePresence initial={false}>
        {dayClients.map((c) => (
          <motion.div
            key={c.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className={`prog-row ${c.type === "outgoing" ? "out" : ""}`}
            onClick={() => onEdit(c)}
          >
            <span className="time">{c.time}</span>
            <span className="mini-plate">{c.plate}</span>
            <span className="who">
              <div className="nm">{c.name}</div>
              <div className="dt">
                {c.type === "incoming" ? "🚗 Pickup" : "🔑 Return"}
                {c.flightNumber ? ` · ✈ ${c.flightNumber}` : ""}
                {c.parking ? ` · ${c.parking}` : ""}
              </div>
            </span>
            <button
              className={`park-cycle ${
                c.parkingStatus === "in_parking"
                  ? "in"
                  : c.parkingStatus === "returned"
                    ? "ret"
                    : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setParkingStatus(c.id, NEXT[c.parkingStatus]);
              }}
              title="Tap to change parking status"
            >
              {c.parkingStatus === "in_parking"
                ? "🚗 In parking"
                : c.parkingStatus === "returned"
                  ? "🔑 Returned"
                  : "🅿️ Awaiting"}
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function QuickAdd({ day }: { day: string }) {
  const empty = {
    type: "incoming" as JobType,
    name: "",
    plate: "",
    time: nowHHMM(),
    flightNumber: "",
  };
  const [form, setForm] = useState(empty);
  const [flash, setFlash] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canAdd = form.name.trim() && form.plate.trim() && form.time;

  const submit = () => {
    if (!canAdd) return;
    addClient({
      type: form.type,
      name: form.name.trim(),
      plate: form.plate.trim().toUpperCase(),
      flightNumber: form.flightNumber.trim().toUpperCase() || undefined,
      date: day,
      time: form.time,
    });
    setForm({ ...empty, type: form.type, time: form.time });
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
  };

  return (
    <div className="quick-add">
      <h3>➕ Add to {formatDayLabel(day)}</h3>
      <div className="segmented" style={{ marginBottom: 8 }}>
        <button
          className={form.type === "incoming" ? "active" : ""}
          onClick={() => set("type", "incoming")}
        >
          🚗 Pickup
        </button>
        <button
          className={form.type === "outgoing" ? "active" : ""}
          onClick={() => set("type", "outgoing")}
        >
          🔑 Return
        </button>
      </div>
      <div className="quick-grid">
        <input
          placeholder="Client name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoComplete="off"
        />
        <input
          placeholder="Plate"
          value={form.plate}
          onChange={(e) => set("plate", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{ textTransform: "uppercase" }}
          autoComplete="off"
        />
        <input
          type="time"
          value={form.time}
          onChange={(e) => set("time", e.target.value)}
          aria-label="Time"
        />
        <input
          placeholder="Flight (optional)"
          value={form.flightNumber}
          onChange={(e) => set("flightNumber", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{ textTransform: "uppercase" }}
          autoComplete="off"
        />
      </div>
      <button
        className="btn primary grow"
        style={{ marginTop: 10, width: "100%" }}
        disabled={!canAdd}
        onClick={submit}
      >
        {flash ? "✓ Added" : "Add reservation"}
      </button>
    </div>
  );
}
