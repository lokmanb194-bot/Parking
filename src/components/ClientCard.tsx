import { useState } from "react";
import { FlightStatusRow, flightTone } from "./FlightStatus";
import {
  completeClient,
  deleteClient,
  markArrived,
  undoComplete,
  unmarkArrived,
} from "../store/actions";
import { syncDelete } from "../services/sync";
import { formatDayLabel } from "../utils/time";
import type { Client } from "../types";

interface Props {
  client: Client;
  onEdit: (client: Client) => void;
  showDate?: boolean;
}

export function ClientCard({ client, onEdit, showDate }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const tone = flightTone(client.flight);
  const cardClass =
    client.status === "completed"
      ? "status-completed"
      : client.status === "arrived"
        ? "status-arrived"
        : tone === "bad"
          ? "status-bad"
          : tone === "warn"
            ? "status-warn"
            : "";

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
    <article className={`card ${cardClass}`}>
      <div className="card-top">
        <span className="card-title">{client.name}</span>
        {client.status === "arrived" && (
          <span className="pill good">● At airport</span>
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
    </article>
  );
}
