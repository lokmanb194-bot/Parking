import type { FlightInfo, FlightRole } from "../../types";

/**
 * A pluggable source of live flight status.
 *
 * Aena (the Spanish airport operator) does not offer a public API, so status
 * comes from licensed commercial providers instead. Implement this interface
 * and register the provider in ./index.ts to add a new source — including an
 * official Aena integration if one ever becomes available.
 */
export interface FlightProvider {
  id: string;
  name: string;
  /** True when the provider has the configuration it needs (API key etc.). */
  isConfigured(): boolean;
  /**
   * Fetch status for one flight on one local date (YYYY-MM-DD).
   * `role` says whether we care about its arrival at ALC or departure from ALC.
   * Return null when the flight cannot be found.
   */
  fetchStatus(
    flightNumber: string,
    date: string,
    role: FlightRole,
  ): Promise<FlightInfo | null>;
}

export function normalizeFlightNumber(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}
