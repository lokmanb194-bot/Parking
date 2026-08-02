import { useState } from "react";
import { addClient, updateClient } from "../store/actions";
import type { ClientDraft } from "../store/actions";
import { todayISO } from "../utils/time";
import type { Client, JobType } from "../types";

interface Props {
  /** Existing client to edit, or null to create. */
  client: Client | null;
  defaultType: JobType;
  onClose: () => void;
}

export function ClientForm({ client, defaultType, onClose }: Props) {
  const [draft, setDraft] = useState<ClientDraft>(() =>
    client
      ? {
          type: client.type,
          name: client.name,
          plate: client.plate,
          phone: client.phone,
          airline: client.airline,
          flightNumber: client.flightNumber,
          date: client.date,
          time: client.time,
          parking: client.parking,
          notes: client.notes,
        }
      : {
          type: defaultType,
          name: "",
          plate: "",
          phone: "",
          airline: "",
          flightNumber: "",
          date: todayISO(),
          time: "",
          parking: "",
          notes: "",
        },
  );
  const [error, setError] = useState("");

  const set = <K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    if (!draft.name.trim()) return setError("Client name is required.");
    if (!draft.plate.trim()) return setError("License plate is required.");
    if (!draft.date) return setError("Date is required.");
    if (!draft.time) return setError("Scheduled time is required.");
    const clean: ClientDraft = {
      ...draft,
      name: draft.name.trim(),
      plate: draft.plate.trim().toUpperCase(),
      flightNumber: draft.flightNumber?.trim().toUpperCase(),
    };
    if (client) updateClient(client.id, clean);
    else addClient(clean);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{client ? "Edit client" : "New client"}</h2>

        <div className="field">
          <div className="segmented">
            <button
              className={draft.type === "incoming" ? "active" : ""}
              onClick={() => set("type", "incoming")}
            >
              🚗 Pickup (incoming)
            </button>
            <button
              className={draft.type === "outgoing" ? "active" : ""}
              onClick={() => set("type", "outgoing")}
            >
              🔑 Return (outgoing)
            </button>
          </div>
        </div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor="f-name">Client name *</label>
            <input
              id="f-name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="John Smith"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="f-plate">License plate *</label>
            <input
              id="f-plate"
              value={draft.plate}
              onChange={(e) => set("plate", e.target.value)}
              placeholder="1234 ABC"
              autoComplete="off"
              style={{ textTransform: "uppercase" }}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-phone">Phone (optional)</label>
          <input
            id="f-phone"
            type="tel"
            value={draft.phone ?? ""}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+34 600 000 000"
          />
        </div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor="f-airline">Airline</label>
            <input
              id="f-airline"
              value={draft.airline ?? ""}
              onChange={(e) => set("airline", e.target.value)}
              placeholder="Ryanair"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="f-flight">Flight number</label>
            <input
              id="f-flight"
              value={draft.flightNumber ?? ""}
              onChange={(e) => set("flightNumber", e.target.value)}
              placeholder="FR 8123"
              autoComplete="off"
              style={{ textTransform: "uppercase" }}
            />
          </div>
        </div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor="f-date">
              {draft.type === "incoming" ? "Arrival date *" : "Return date *"}
            </label>
            <input
              id="f-date"
              type="date"
              value={draft.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="f-time">Scheduled time *</label>
            <input
              id="f-time"
              type="time"
              value={draft.time}
              onChange={(e) => set("time", e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-parking">Parking location</label>
          <input
            id="f-parking"
            value={draft.parking ?? ""}
            onChange={(e) => set("parking", e.target.value)}
            placeholder="P2 · Level 1 · Row C"
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="f-notes">Notes</label>
          <textarea
            id="f-notes"
            rows={2}
            value={draft.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Keys in glovebox, prefers WhatsApp…"
          />
        </div>

        {error && <div className="error-text">{error}</div>}

        <div className="form-actions">
          <button className="btn grow" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary grow" onClick={save}>
            {client ? "Save changes" : "Add client"}
          </button>
        </div>
      </div>
    </div>
  );
}
