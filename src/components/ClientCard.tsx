import { useState } from "react";
import { motion } from "framer-motion";
import { FlightStatusRow, flightTone } from "./FlightStatus";
import {
  completeClient,
  deleteClient,
  markArrived,
  setParkingStatus,
  undoComplete,
  unmarkArrived,
} from "../store/actions";
import { syncDelete } from "../services/sync";
import { formatDayLabel } from "../utils/time";
import type { Client, ParkingStatus } from "../types";

interface Props {
  client: Client;
  onEdit: (client: Client) => void;
  showDate?: boolean;
}

export function ClientCard({ client, onEdit, showDate }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const tone = flightTone(client.flight);
  const cardClass = [
    `type-${client.type}`,
    client.parkingStatus === "in_parking" ? "parked" : "",
    client.status === "completed"
      ? "status-completed"
      : client.status === "arrived"
        ? "status-arrived"
        : "",
    tone === "bad" ? "flight-bad" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    deleteClient(client.id);
    void syncDelete(client.id);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
      className={`card ${cardClass}`}
    >
      <div className="card-top">
        <span className="card-title">{client.name}</span>
        {client.parkingStatus === "in_parking" && (
          <span className="pill blue dot">In parking</span>
        )}
        {client.status === "arrived" && (
          <span className="pill good dot">At airport</span>
        )}
        <span className="plate">{client.plate}</span>
      </div>

      {client.flight ? (
        <FlightStatusRow flight={client.flight} />
      ) : client.flightNumber ? (
        <div className="flight-row">
          <span className="fnum">✈ {client.flightNumber}</span>
          <span className="pill neutral">No live data</span>
          {client.airline && <span className="times">{client.airline}</span>}
        </div>
      ) : null}

      <div className="meta-row">
        <span>
          🕐 <span className="strong">{client.time}</span>
          {showDate ? ` · ${formatDayLabel(client.date)}` : ""}
        </span>
        {client.parking && (
          <span>
            📍 <span className="strong">{client.parking}</span>
          </span>
        )}
        {client.phone && <a href={`tel:${client.phone}`}>📞 {client.phone}</a>}
        {client.airline && client.flight && <span>{client.airline}</span>}
      </div>

      {client.notes && <div className="notes">{client.notes}</div>}

      <ParkingControl
        value={client.parkingStatus}
        onChange={(s) => setParkingStatus(client.id, s)}
      />

      <div className="card-actions">
        {client.status === "completed" ? (
          <button className="btn grow" onClick={() => undoComplete(client.id)}>
            ↩ Undo
          </button>
        ) : (
          <>
            <button
              className="btn good grow"
              onClick={() => completeClient(client.id)}
            >
              ✓ Done
            </button>
            {client.status === "arrived" ? (
              <button className="btn" onClick={() => unmarkArrived(client.id)}>
                ↩ Not here
              </button>
            ) : (
              <button className="btn" onClick={() => markArrived(client.id)}>
                🛬 Arrived
              </button>
            )}
          </>
        )}
        <button
          className="btn icon-btn"
          aria-label="Edit"
          onClick={() => onEdit(client)}
        >
          ✏️
        </button>
        <button
          className={`btn icon-btn ${confirmDelete ? "danger" : ""}`}
          aria-label="Delete"
          onClick={handleDelete}
        >
          {confirmDelete ? "Sure?" : "🗑"}
        </button>
      </div>
    </motion.article>
  );
}

const PARK_LABELS: Record<ParkingStatus, string> = {
  awaiting: "Awaiting",
  in_parking: "In parking",
  returned: "Returned",
};

export function ParkingControl({
  value,
  onChange,
}: {
  value: ParkingStatus;
  onChange: (status: ParkingStatus) => void;
}) {
  const options: ParkingStatus[] = ["awaiting", "in_parking", "returned"];
  const activeClass: Record<ParkingStatus, string> = {
    awaiting: "on-await",
    in_parking: "on-in",
    returned: "on-ret",
  };
  return (
    <div className="park-control" role="group" aria-label="Parking status">
      {options.map((opt) => (
        <button
          key={opt}
          className={value === opt ? activeClass[opt] : ""}
          aria-pressed={value === opt}
          onClick={() => onChange(opt)}
        >
          {opt === "awaiting" ? "🅿️" : opt === "in_parking" ? "🚗" : "🔑"}
          {PARK_LABELS[opt]}
        </button>
      ))}
    </div>
  );
}
