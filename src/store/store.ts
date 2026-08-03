import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS } from "../types";
import type { AppState } from "../types";

const STORAGE_KEY = "alc-valet-state-v1";
const CHANNEL = "alc-valet-sync";

type Listener = () => void;

/**
 * Minimal external store: immutable state, localStorage persistence and
 * BroadcastChannel fan-out so every open tab/window updates in real time.
 */
class Store {
  private state: AppState;
  private listeners = new Set<Listener>();
  private channel: BroadcastChannel | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.state = this.load();
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (event) => {
        if (event.data?.type === "state" && event.data.state) {
          this.state = event.data.state as AppState;
          this.emit();
        }
      };
    }
  }

  private load(): AppState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppState>;
        return {
          // Backfill fields added in later versions so older saves keep working.
          clients: (parsed.clients ?? []).map((c) => ({
            ...c,
            parkingStatus: c.parkingStatus ?? "awaiting",
          })),
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          notified: parsed.notified ?? {},
        };
      }
    } catch (err) {
      console.error("Failed to load saved state", err);
    }
    return { clients: [], settings: { ...DEFAULT_SETTINGS }, notified: {} };
  }

  getSnapshot = (): AppState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  update(fn: (state: AppState) => AppState): void {
    this.state = fn(this.state);
    this.emit();
    this.persistSoon();
    this.channel?.postMessage({ type: "state", state: this.state });
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private persistSoon(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (err) {
        console.error("Failed to persist state", err);
      }
    }, 150);
  }
}

export const store = new Store();

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
