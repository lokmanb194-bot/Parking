import type { FlightInfo, FlightPhase } from "../../types";
import { normalizeFlightNumber } from "./types";
import type { FlightProvider } from "./types";

/**
 * Demo provider: simulates a believable flight without any API key, so the
 * whole tracking/notification pipeline can be exercised offline. The flight is
 * assumed to be scheduled at the job's hand-over date+time; a hash of the
 * flight number decides whether it runs on time, late, or gets cancelled.
 */
export function createDemoProvider(
  getJobTime: (flightNumber: string, date: string) => string | null,
): FlightProvider {
  return {
    id: "demo",
    name: "Demo (simulated flights)",
    isConfigured: () => true,

    async fetchStatus(flightNumber, date, role): Promise<FlightInfo | null> {
      const num = normalizeFlightNumber(flightNumber);
      const time = getJobTime(num, date) ?? "12:00";
      const scheduled = new Date(`${date}T${time}:00`);
      const h = hash(num + date);
      const scenario = h % 10; // 0-5 on time, 6-8 delayed, 9 cancelled
      const delayMin = scenario >= 6 && scenario <= 8 ? 15 + (h % 45) : 0;
      const cancelled = scenario === 9;
      const estimated = new Date(scheduled.getTime() + delayMin * 60000);
      const now = new Date();

      let phase: FlightPhase;
      let actual: Date | undefined;
      if (cancelled) {
        phase = "cancelled";
      } else if (now >= estimated) {
        phase = role === "arrival" ? "landed" : "departed";
        actual = estimated;
      } else if (now >= new Date(estimated.getTime() - 40 * 60000)) {
        phase = role === "arrival" ? "enroute" : "boarding";
      } else {
        phase = delayMin > 0 ? "delayed" : "scheduled";
      }

      return {
        flightNumber: num,
        role,
        phase,
        scheduled: scheduled.toISOString(),
        estimated: cancelled ? undefined : estimated.toISOString(),
        actual: actual?.toISOString(),
        delayMinutes: cancelled ? undefined : delayMin,
        gate: cancelled ? undefined : `${"ABCD"[h % 4]}${(h % 30) + 1}`,
        terminal: "N",
        counterpartAirport: ["LGW", "MAN", "AMS", "BRU", "OSL", "DUB"][h % 6],
        lastChecked: new Date().toISOString(),
        providerId: "demo",
      };
    },
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}
