import { HOME_AIRPORT_IATA, HOME_AIRPORT_ICAO } from "../../types";
import type { FlightInfo, FlightPhase, FlightRole } from "../../types";
import { normalizeFlightNumber } from "./types";
import type { FlightProvider } from "./types";

/**
 * AeroDataBox (https://aerodatabox.com) via RapidAPI.
 * Good European coverage including ALC; free tier available for light use.
 */
export function createAeroDataBox(getKey: () => string): FlightProvider {
  return {
    id: "aerodatabox",
    name: "AeroDataBox (RapidAPI)",
    isConfigured: () => getKey().trim().length > 0,

    async fetchStatus(flightNumber, date, role): Promise<FlightInfo | null> {
      const num = normalizeFlightNumber(flightNumber);
      const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(
        num,
      )}/${date}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`;
      const res = await fetch(url, {
        headers: {
          "X-RapidAPI-Key": getKey().trim(),
          "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
        },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`AeroDataBox HTTP ${res.status}`);
      const flights: AdbFlight[] = await res.json();
      if (!Array.isArray(flights) || flights.length === 0) return null;

      const isHome = (airport?: AdbAirport) =>
        airport?.iata === HOME_AIRPORT_IATA || airport?.icao === HOME_AIRPORT_ICAO;
      // Prefer the leg that touches ALC on the side we track.
      const flight =
        flights.find((f) =>
          role === "arrival" ? isHome(f.arrival?.airport) : isHome(f.departure?.airport),
        ) ?? flights[0];

      const movement = role === "arrival" ? flight.arrival : flight.departure;
      const counterpart = role === "arrival" ? flight.departure : flight.arrival;
      const scheduled = movement?.scheduledTime?.local ?? movement?.scheduledTime?.utc;
      const estimated =
        movement?.predictedTime?.local ??
        movement?.predictedTime?.utc ??
        movement?.revisedTime?.local ??
        movement?.revisedTime?.utc;
      const actual = movement?.actualTime?.local ?? movement?.actualTime?.utc;

      return {
        flightNumber: num,
        role,
        phase: mapPhase(flight.status, role, Boolean(actual)),
        scheduled: scheduled ? toISO(scheduled) : undefined,
        estimated: estimated ? toISO(estimated) : undefined,
        actual: actual ? toISO(actual) : undefined,
        delayMinutes: computeDelay(scheduled, estimated ?? actual),
        gate: movement?.gate,
        terminal: movement?.terminal,
        counterpartAirport:
          counterpart?.airport?.iata ??
          counterpart?.airport?.name ??
          undefined,
        lastChecked: new Date().toISOString(),
        providerId: "aerodatabox",
      };
    },
  };
}

function toISO(value: string): string {
  // AeroDataBox local times look like "2026-08-02 14:35+02:00".
  return value.replace(" ", "T");
}

function computeDelay(scheduled?: string, best?: string): number | undefined {
  if (!scheduled || !best) return undefined;
  const s = new Date(toISO(scheduled)).getTime();
  const b = new Date(toISO(best)).getTime();
  if (isNaN(s) || isNaN(b)) return undefined;
  return Math.round((b - s) / 60000);
}

function mapPhase(
  status: string | undefined,
  role: FlightRole,
  hasActual: boolean,
): FlightPhase {
  switch ((status ?? "").toLowerCase()) {
    case "canceled":
    case "cancelled":
      return "cancelled";
    case "diverted":
      return "diverted";
    case "delayed":
      return "delayed";
    case "boarding":
    case "gateclosed":
      return "boarding";
    case "departed":
    case "enroute":
    case "approaching":
      return role === "departure" ? "departed" : "enroute";
    case "arrived":
      return role === "arrival" ? "landed" : "departed";
    case "expected":
    case "checkin":
    case "scheduled":
      return "scheduled";
    default:
      if (hasActual) return role === "arrival" ? "landed" : "departed";
      return status ? "unknown" : "unknown";
  }
}

interface AdbTime {
  utc?: string;
  local?: string;
}

interface AdbAirport {
  iata?: string;
  icao?: string;
  name?: string;
}

interface AdbMovement {
  airport?: AdbAirport;
  scheduledTime?: AdbTime;
  revisedTime?: AdbTime;
  predictedTime?: AdbTime;
  actualTime?: AdbTime;
  terminal?: string;
  gate?: string;
}

interface AdbFlight {
  status?: string;
  departure?: AdbMovement;
  arrival?: AdbMovement;
}
