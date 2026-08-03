import { store } from "./store";
import { newId } from "../utils/id";
import type { Client, FlightInfo, ParkingStatus, Settings } from "../types";

export type ClientDraft = Omit<
  Client,
  | "id"
  | "status"
  | "parkingStatus"
  | "parkedAt"
  | "archived"
  | "createdAt"
  | "updatedAt"
  | "flight"
> & { parkingStatus?: ParkingStatus };

function touch(client: Client): Client {
  return { ...client, updatedAt: new Date().toISOString() };
}

function patchClient(id: string, patch: (c: Client) => Client): void {
  store.update((state) => ({
    ...state,
    clients: state.clients.map((c) => (c.id === id ? touch(patch(c)) : c)),
  }));
}

export function addClient(draft: ClientDraft): Client {
  const now = new Date().toISOString();
  const client: Client = {
    ...draft,
    id: newId(),
    status: "pending",
    parkingStatus: draft.parkingStatus ?? "awaiting",
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  store.update((state) => ({ ...state, clients: [...state.clients, client] }));
  return client;
}

export function updateClient(id: string, draft: ClientDraft): void {
  patchClient(id, (c) => {
    const flightChanged = c.flightNumber !== draft.flightNumber || c.date !== draft.date;
    return { ...c, ...draft, flight: flightChanged ? undefined : c.flight };
  });
}

export function deleteClient(id: string): void {
  store.update((state) => ({
    ...state,
    clients: state.clients.filter((c) => c.id !== id),
  }));
}

export function completeClient(id: string): void {
  patchClient(id, (c) => ({
    ...c,
    status: "completed",
    completedAt: new Date().toISOString(),
  }));
}

export function undoComplete(id: string): void {
  patchClient(id, (c) => ({
    ...c,
    status: c.arrivedAt ? "arrived" : "pending",
    completedAt: undefined,
  }));
}

export function markArrived(id: string, auto = false): void {
  patchClient(id, (c) =>
    c.status === "completed"
      ? c
      : {
          ...c,
          status: "arrived",
          arrivedAt: c.arrivedAt ?? new Date().toISOString(),
          notes: auto && !c.arrivedAt ? c.notes : c.notes,
        },
  );
}

export function unmarkArrived(id: string): void {
  patchClient(id, (c) => ({ ...c, status: "pending", arrivedAt: undefined }));
}

export function archiveCompleted(): number {
  const count = store
    .getSnapshot()
    .clients.filter((c) => c.status === "completed" && !c.archived).length;
  store.update((state) => ({
    ...state,
    clients: state.clients.map((c) =>
      c.status === "completed" ? { ...c, archived: true } : c,
    ),
  }));
  return count;
}

export function applyFlightUpdate(id: string, flight: FlightInfo): void {
  patchClient(id, (c) => ({ ...c, flight }));
}

export function setParkingStatus(id: string, parkingStatus: ParkingStatus): void {
  patchClient(id, (c) => ({
    ...c,
    parkingStatus,
    parkedAt:
      parkingStatus === "in_parking"
        ? (c.parkedAt ?? new Date().toISOString())
        : parkingStatus === "awaiting"
          ? undefined
          : c.parkedAt,
  }));
}

/**
 * Apply parking status coming from the self-hosted connector, keyed by plate.
 * Only touches non-archived, non-returned reservations and never downgrades a
 * manual "returned". Returns the number of reservations updated.
 */
export function applyParkingByPlate(
  byPlate: Record<string, ParkingStatus>,
): number {
  const norm = (p: string) => p.replace(/[\s-]/g, "").toUpperCase();
  const map = new Map(Object.entries(byPlate).map(([k, v]) => [norm(k), v]));
  let changed = 0;
  store.update((state) => ({
    ...state,
    clients: state.clients.map((c) => {
      if (c.archived || c.parkingStatus === "returned") return c;
      const next = map.get(norm(c.plate));
      if (!next || next === c.parkingStatus) return c;
      changed++;
      return {
        ...c,
        parkingStatus: next,
        parkedAt:
          next === "in_parking"
            ? (c.parkedAt ?? new Date().toISOString())
            : c.parkedAt,
        updatedAt: new Date().toISOString(),
      };
    }),
  }));
  return changed;
}

export function updateSettings(patch: Partial<Settings>): void {
  store.update((state) => ({
    ...state,
    settings: { ...state.settings, ...patch },
  }));
}

export function rememberNotified(key: string): void {
  const cutoff = Date.now() - 3 * 24 * 3600_000;
  store.update((state) => {
    const notified: Record<string, number> = { [key]: Date.now() };
    for (const [k, ts] of Object.entries(state.notified)) {
      if (ts > cutoff) notified[k] = ts;
    }
    return { ...state, notified };
  });
}

export function wasNotified(key: string): boolean {
  return key in store.getSnapshot().notified;
}

export function replaceClients(clients: Client[]): void {
  store.update((state) => ({ ...state, clients }));
}
