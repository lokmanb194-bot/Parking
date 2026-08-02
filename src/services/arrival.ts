import type { Client, Settings } from "../types";

/**
 * Airport-arrival detection.
 *
 * The ideal signal — "this licence plate / this passenger has physically
 * entered Alicante Airport" — would come from Aena's own systems (their app
 * shows car-park entry by plate). Aena does NOT expose a public API for this,
 * and scraping their app or website would be unreliable and against their
 * terms of service, so it is deliberately not done here.
 *
 * Instead this module defines a small detector interface with two built-in
 * detectors, and a place to plug in an official integration later:
 *
 *  - FlightWalkOutDetector: once the tracked flight has landed, assume the
 *    client reaches the kerb after `walkOutMin` minutes (configurable).
 *  - Manual: the "Arrived" button on every card (always available).
 *
 * If you ever obtain licensed access to plate-entry data (e.g. through the
 * car-park operator or an Aena commercial agreement), implement
 * ArrivalDetector.check() against it and add it to `detectors` below —
 * nothing else in the app needs to change.
 */
export interface ArrivalDetector {
  id: string;
  /** Return true when the client is believed to have arrived at the airport. */
  check(client: Client, settings: Settings, now: Date): boolean;
}

const flightWalkOutDetector: ArrivalDetector = {
  id: "flight-walkout",
  check(client, settings, now) {
    if (client.type !== "outgoing") return false;
    const flight = client.flight;
    if (!flight || flight.role !== "arrival" || flight.phase !== "landed") {
      return false;
    }
    const touchdown = flight.actual ?? flight.estimated ?? flight.scheduled;
    if (!touchdown) return false;
    const readyAt = new Date(touchdown).getTime() + settings.walkOutMin * 60000;
    return now.getTime() >= readyAt;
  },
};

const detectors: ArrivalDetector[] = [flightWalkOutDetector];

export function detectArrival(
  client: Client,
  settings: Settings,
  now: Date,
): boolean {
  return detectors.some((d) => d.check(client, settings, now));
}
