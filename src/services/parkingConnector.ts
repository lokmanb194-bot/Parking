import { applyParkingByPlate } from "../store/actions";
import { store } from "../store/store";
import { notifyOnce } from "./notify";
import type { ParkingStatus } from "../types";

/**
 * Client for a SELF-HOSTED parking connector.
 *
 * The connector is a small service YOU run on your own machine/server (see
 * parking-connector/). Your Aena credentials live only in that connector's
 * environment — never in this app and never in the repo. The connector logs
 * into Aena on your behalf, reads which of the day's plates are inside the car
 * park, and exposes a tiny read-only endpoint this app polls:
 *
 *   GET {base}/parking?date=YYYY-MM-DD          (optional: Authorization: Bearer <token>)
 *   -> { "plates": { "1234ABC": "in_parking", "5678XYZ": "returned" } }
 *
 * Values are ParkingStatus ("awaiting" | "in_parking" | "returned").
 */
const POLL_MS = 60_000;
let timer: ReturnType<typeof setInterval> | null = null;
let busy = false;

function config(): { base: string; token: string } | null {
  const { parkingConnectorUrl, parkingConnectorToken } =
    store.getSnapshot().settings;
  if (!parkingConnectorUrl.trim()) return null;
  return {
    base: parkingConnectorUrl.trim().replace(/\/$/, ""),
    token: parkingConnectorToken.trim(),
  };
}

export function startParkingConnector(): () => void {
  if (timer) clearInterval(timer);
  timer = setInterval(() => void poll(), POLL_MS);
  void poll();
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}

/** Poll once. Returns updated count, or null when not configured / on error. */
export async function poll(): Promise<number | null> {
  const cfg = config();
  if (!cfg || busy) return null;
  busy = true;
  try {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}`;
    const headers: Record<string, string> = {};
    if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
    const res = await fetch(`${cfg.base}/parking?date=${iso}`, { headers });
    if (!res.ok) throw new Error(`Parking connector HTTP ${res.status}`);
    const data: { plates?: Record<string, ParkingStatus> } = await res.json();
    if (!data.plates) return 0;

    // Snapshot which plates were already inside so we only notify on new entries.
    const before = new Map(
      store
        .getSnapshot()
        .clients.map((c) => [c.plate.replace(/[\s-]/g, "").toUpperCase(), c.parkingStatus]),
    );
    const updated = applyParkingByPlate(data.plates);

    for (const [plate, statusRaw] of Object.entries(data.plates)) {
      const key = plate.replace(/[\s-]/g, "").toUpperCase();
      if (statusRaw === "in_parking" && before.get(key) !== "in_parking") {
        const client = store
          .getSnapshot()
          .clients.find(
            (c) => c.plate.replace(/[\s-]/g, "").toUpperCase() === key,
          );
        if (client) {
          void notifyOnce(
            `parked:${client.id}:${iso}`,
            "Car in the car park",
            `${client.plate} (${client.name}) is now inside the Aena car park.`,
          );
        }
      }
    }
    return updated;
  } catch (err) {
    console.error("Parking connector poll failed", err);
    return null;
  } finally {
    busy = false;
  }
}
