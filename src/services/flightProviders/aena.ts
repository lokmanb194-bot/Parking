import type { FlightInfo, FlightPhase, FlightRole } from "../../types";
import { normalizeFlightNumber } from "./types";
import type { FlightProvider } from "./types";

/**
 * Aena flight data through a personal relay.
 *
 * aena.es does not send CORS headers, so this browser app can never call it
 * directly — every request goes through a tiny relay you host yourself (a free
 * Cloudflare Worker; see aena-proxy/worker.js and the README section
 * "Aena data through a personal relay"). The relay fetches Aena's public
 * flight-information service and answers with normalized JSON:
 *
 *   GET {base}/flight?number=VY1350&date=2026-08-02&role=arrival
 *   -> { "found": true, "phase": "landed", "scheduled": "...ISO...",
 *        "estimated": null, "actual": "...ISO...", "gate": "C21",
 *        "terminal": "N", "counterpart": "AMS", "delayMinutes": 12 }
 *
 * Anything that can answer that contract works here, so if Aena ever ships an
 * official API the relay is the only thing that needs to change.
 */
export function createAena(getProxyBase: () => string): FlightProvider {
  return {
    id: "aena",
    name: "Aena (personal relay)",
    isConfigured: () => getProxyBase().trim().length > 0,

    async fetchStatus(flightNumber, date, role): Promise<FlightInfo | null> {
      const base = getProxyBase().trim().replace(/\/$/, "");
      const num = normalizeFlightNumber(flightNumber);
      const params = new URLSearchParams({ number: num, date, role });
      const res = await fetch(`${base}/flight?${params}`);
      if (!res.ok) throw new Error(`Aena relay HTTP ${res.status}`);
      const data: AenaRelayResponse = await res.json();
      if (!data.found) return null;

      return {
        flightNumber: num,
        role,
        phase: mapPhase(data.phase, role, Boolean(data.actual)),
        scheduled: data.scheduled ?? undefined,
        estimated: data.estimated ?? undefined,
        actual: data.actual ?? undefined,
        delayMinutes: data.delayMinutes ?? computeDelay(data),
        gate: data.gate ?? undefined,
        terminal: data.terminal ?? undefined,
        counterpartAirport: data.counterpart ?? undefined,
        lastChecked: new Date().toISOString(),
        providerId: "aena",
      };
    },
  };
}

function computeDelay(data: AenaRelayResponse): number | undefined {
  const best = data.actual ?? data.estimated;
  if (!data.scheduled || !best) return undefined;
  const s = new Date(data.scheduled).getTime();
  const b = new Date(best).getTime();
  if (isNaN(s) || isNaN(b)) return undefined;
  return Math.round((b - s) / 60000);
}

function mapPhase(
  phase: string | null | undefined,
  role: FlightRole,
  hasActual: boolean,
): FlightPhase {
  switch ((phase ?? "").toLowerCase()) {
    case "cancelled":
    case "cancelado":
      return "cancelled";
    case "diverted":
    case "desviado":
      return "diverted";
    case "delayed":
    case "retrasado":
      return "delayed";
    case "boarding":
    case "embarque":
      return "boarding";
    case "enroute":
    case "en vuelo":
    case "airborne":
      return role === "departure" ? "departed" : "enroute";
    case "landed":
    case "aterrizado":
      return role === "arrival" ? "landed" : "departed";
    case "departed":
    case "despegado":
    case "salido":
      return "departed";
    case "scheduled":
    case "previsto":
    case "on time":
    case "en hora":
      return "scheduled";
    default:
      if (hasActual) return role === "arrival" ? "landed" : "departed";
      return "unknown";
  }
}

interface AenaRelayResponse {
  found: boolean;
  phase?: string | null;
  scheduled?: string | null;
  estimated?: string | null;
  actual?: string | null;
  delayMinutes?: number | null;
  gate?: string | null;
  terminal?: string | null;
  counterpart?: string | null;
}
