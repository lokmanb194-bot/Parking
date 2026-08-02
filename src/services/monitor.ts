import { detectArrival } from "./arrival";
import { activeProvider } from "./flightProviders";
import { notifyOnce } from "./notify";
import { applyFlightUpdate, markArrived } from "../store/actions";
import { store } from "../store/store";
import { formatTime, jobDateTime, minutesBetween } from "../utils/time";
import type { Client, FlightInfo, FlightRole } from "../types";

const TICK_MS = 30_000;
let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

/**
 * Background monitor. While the app is open (foreground or installed and
 * minimised with the tab alive) it:
 *   1. refreshes flight status from the configured provider,
 *   2. turns status changes into notifications (delay, landed, cancelled...),
 *   3. auto-detects client arrival (see services/arrival.ts),
 *   4. warns when a delivery hand-over is approaching,
 *   5. warns about schedule conflicts.
 * Everything is dedup-keyed so a notification fires exactly once.
 */
export function startMonitor(): () => void {
  if (timer) clearInterval(timer);
  timer = setInterval(tick, TICK_MS);
  void tick();
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}

export function flightRoleFor(client: Client): FlightRole {
  // Incoming job = client drives in and flies OUT of ALC (departure).
  // Outgoing job = client flies back INTO ALC to collect the car (arrival).
  return client.type === "incoming" ? "departure" : "arrival";
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    await refreshFlights();
    checkArrivals();
    checkDeliveryReminders();
    checkConflicts();
  } catch (err) {
    console.error("Monitor tick failed", err);
  } finally {
    ticking = false;
  }
}

function activeClients(): Client[] {
  return store
    .getSnapshot()
    .clients.filter((c) => !c.archived && c.status !== "completed");
}

function isTrackable(client: Client, now: Date): boolean {
  if (!client.flightNumber?.trim()) return false;
  const distanceMin = Math.abs(minutesBetween(now, jobDateTime(client)));
  return distanceMin <= 26 * 60; // only poll flights within ~a day of the job
}

async function refreshFlights(): Promise<void> {
  const provider = activeProvider();
  if (!provider) return;
  const { pollIntervalMin } = store.getSnapshot().settings;
  const now = new Date();

  for (const client of activeClients()) {
    if (!isTrackable(client, now)) continue;
    const last = client.flight?.lastChecked;
    if (last && minutesBetween(new Date(last), now) < pollIntervalMin) continue;

    try {
      const fresh = await provider.fetchStatus(
        client.flightNumber!.trim(),
        client.date,
        flightRoleFor(client),
      );
      if (!fresh) continue;
      const previous = client.flight;
      applyFlightUpdate(client.id, fresh);
      await announceFlightChanges(client, previous, fresh);
    } catch (err) {
      console.error(`Flight refresh failed for ${client.flightNumber}`, err);
    }
  }
}

async function announceFlightChanges(
  client: Client,
  previous: FlightInfo | undefined,
  fresh: FlightInfo,
): Promise<void> {
  const label = `${fresh.flightNumber} (${client.name})`;
  const day = client.date;

  if (fresh.phase === "cancelled" && previous?.phase !== "cancelled") {
    await notifyOnce(
      `cancelled:${client.id}:${day}`,
      "Flight cancelled",
      `${label} has been cancelled.`,
    );
  }
  if (fresh.phase === "diverted" && previous?.phase !== "diverted") {
    await notifyOnce(
      `diverted:${client.id}:${day}`,
      "Flight diverted",
      `${label} has been diverted.`,
    );
  }
  if ((fresh.delayMinutes ?? 0) >= 15) {
    await notifyOnce(
      `delayed:${client.id}:${day}:${bucketDelay(fresh.delayMinutes!)}`,
      "Flight delayed",
      `${label} is running ${fresh.delayMinutes} min late — now ${formatTime(
        fresh.estimated ?? fresh.scheduled,
      )}.`,
    );
  }
  if (fresh.role === "arrival" && fresh.phase === "landed") {
    await notifyOnce(
      `landed:${client.id}:${day}`,
      "Flight landed",
      `${label} landed at ${formatTime(fresh.actual ?? fresh.estimated)}. Get the car ready.`,
    );
  }
  if (fresh.role === "departure" && fresh.phase === "departed") {
    await notifyOnce(
      `departed:${client.id}:${day}`,
      "Flight departed",
      `${label} has departed.`,
    );
  }
}

/** Group delays into 15-minute buckets so a growing delay re-notifies. */
function bucketDelay(minutes: number): number {
  return Math.floor(minutes / 15);
}

function checkArrivals(): void {
  const { settings } = store.getSnapshot();
  const now = new Date();
  for (const client of activeClients()) {
    if (client.status !== "pending") continue;
    if (detectArrival(client, settings, now)) {
      markArrived(client.id, true);
      void notifyOnce(
        `arrived:${client.id}:${client.date}`,
        "Client arrived",
        `${client.name} should be at the terminal now — deliver ${client.plate}.`,
      );
    }
  }
}

function checkDeliveryReminders(): void {
  const { deliveryLeadMin } = store.getSnapshot().settings;
  const now = new Date();
  for (const client of activeClients()) {
    if (client.type !== "outgoing") continue;
    const minutesTo = minutesBetween(now, jobDateTime(client));
    if (minutesTo > 0 && minutesTo <= deliveryLeadMin) {
      void notifyOnce(
        `delivery:${client.id}:${client.date}`,
        "Delivery coming up",
        `Deliver ${client.plate} to ${client.name} at ${client.time} (${minutesTo} min).`,
      );
    }
  }
}

function checkConflicts(): void {
  const { conflictWindowMin } = store.getSnapshot().settings;
  const jobs = activeClients()
    .slice()
    .sort((a, b) => jobDateTime(a).getTime() - jobDateTime(b).getTime());
  for (let i = 0; i < jobs.length - 1; i++) {
    const a = jobs[i];
    const b = jobs[i + 1];
    const gap = minutesBetween(jobDateTime(a), jobDateTime(b));
    if (a.date === b.date && gap < conflictWindowMin) {
      const pair = [a.id, b.id].sort().join(":");
      void notifyOnce(
        `conflict:${pair}:${a.date}`,
        "Schedule conflict",
        `${a.name} (${a.time}) and ${b.name} (${b.time}) are only ${gap} min apart.`,
      );
    }
  }
}
