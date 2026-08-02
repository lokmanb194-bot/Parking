import type { FlightInfo, FlightPhase, FlightRole } from "../../types";
import { normalizeFlightNumber } from "./types";
import type { FlightProvider } from "./types";

/**
 * AviationStack (https://aviationstack.com). The free tier only allows a
 * limited number of requests per month, so keep the poll interval generous.
 */
export function createAviationStack(getKey: () => string): FlightProvider {
  return {
    id: "aviationstack",
    name: "AviationStack",
    isConfigured: () => getKey().trim().length > 0,

    async fetchStatus(flightNumber, date, role): Promise<FlightInfo | null> {
      const num = normalizeFlightNumber(flightNumber);
      const params = new URLSearchParams({
        access_key: getKey().trim(),
        flight_iata: num,
        flight_date: date,
      });
      const res = await fetch(`https://api.aviationstack.com/v1/flights?${params}`);
      if (!res.ok) throw new Error(`AviationStack HTTP ${res.status}`);
      const payload: AvsResponse = await res.json();
      if (payload.error) {
        throw new Error(`AviationStack: ${payload.error.message ?? "API error"}`);
      }
      const flight = payload.data?.[0];
      if (!flight) return null;

      const movement = role === "arrival" ? flight.arrival : flight.departure;
      const counterpart = role === "arrival" ? flight.departure : flight.arrival;

      return {
        flightNumber: num,
        role,
        phase: mapPhase(flight.flight_status, role, Boolean(movement?.actual)),
        scheduled: movement?.scheduled ?? undefined,
        estimated: movement?.estimated ?? undefined,
        actual: movement?.actual ?? undefined,
        delayMinutes: movement?.delay ?? undefined,
        gate: movement?.gate ?? undefined,
        terminal: movement?.terminal ?? undefined,
        counterpartAirport: counterpart?.iata ?? undefined,
        lastChecked: new Date().toISOString(),
        providerId: "aviationstack",
      };
    },
  };
}

function mapPhase(
  status: string | undefined,
  role: FlightRole,
  hasActual: boolean,
): FlightPhase {
  switch ((status ?? "").toLowerCase()) {
    case "cancelled":
      return "cancelled";
    case "diverted":
      return "diverted";
    case "incident":
      return "diverted";
    case "active":
      return role === "departure" ? "departed" : "enroute";
    case "landed":
      return role === "arrival" ? "landed" : "departed";
    case "scheduled":
      return "scheduled";
    default:
      if (hasActual) return role === "arrival" ? "landed" : "departed";
      return "unknown";
  }
}

interface AvsMovement {
  iata?: string;
  terminal?: string | null;
  gate?: string | null;
  delay?: number | null;
  scheduled?: string | null;
  estimated?: string | null;
  actual?: string | null;
}

interface AvsResponse {
  error?: { message?: string };
  data?: Array<{
    flight_status?: string;
    departure?: AvsMovement;
    arrival?: AvsMovement;
  }>;
}
