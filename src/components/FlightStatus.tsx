import { formatRelative, formatTime } from "../utils/time";
import type { FlightInfo, FlightPhase } from "../types";

const PHASE_LABEL: Record<FlightPhase, string> = {
  unknown: "No data",
  scheduled: "On time",
  delayed: "Delayed",
  boarding: "Boarding",
  enroute: "En route",
  landed: "Landed",
  departed: "Departed",
  cancelled: "Cancelled",
  diverted: "Diverted",
};

const PHASE_TONE: Record<FlightPhase, string> = {
  unknown: "neutral",
  scheduled: "neutral",
  delayed: "warn",
  boarding: "accent",
  enroute: "accent",
  landed: "good",
  departed: "good",
  cancelled: "bad",
  diverted: "bad",
};

export function flightTone(flight?: FlightInfo): "ok" | "warn" | "bad" {
  if (!flight) return "ok";
  if (flight.phase === "cancelled" || flight.phase === "diverted") return "bad";
  if (flight.phase === "delayed" || (flight.delayMinutes ?? 0) >= 15) return "warn";
  return "ok";
}

export function FlightStatusRow({ flight }: { flight: FlightInfo }) {
  const delayed = (flight.delayMinutes ?? 0) >= 5;
  const best = flight.actual ?? flight.estimated;
  return (
    <div className="flight-row">
      <span className="fnum">✈ {flight.flightNumber}</span>
      {flight.counterpartAirport && (
        <span className="pill neutral">
          {flight.role === "arrival"
            ? `from ${flight.counterpartAirport}`
            : `to ${flight.counterpartAirport}`}
        </span>
      )}
      <span className={`pill ${PHASE_TONE[flight.phase]}`}>
        {PHASE_LABEL[flight.phase]}
        {delayed && flight.phase !== "cancelled"
          ? ` +${flight.delayMinutes}′`
          : ""}
      </span>
      <span className="times">
        {formatTime(flight.scheduled)}
        {best && best !== flight.scheduled ? (
          <>
            {" → "}
            <span className="est">{formatTime(best)}</span>
          </>
        ) : null}
      </span>
      {flight.gate && <span className="pill neutral">Gate {flight.gate}</span>}
      {flight.lastChecked && (
        <span className="checked">checked {formatRelative(flight.lastChecked)}</span>
      )}
    </div>
  );
}
