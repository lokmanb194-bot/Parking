import { replaceClients } from "../store/actions";
import { store } from "../store/store";
import type { Client } from "../types";

/**
 * Optional multi-device sync through Supabase's REST API (PostgREST).
 * Disabled by default; enable it in Settings with a project URL + anon key
 * after creating the table below. No SDK needed — plain fetch.
 *
 *   create table public.valet_clients (
 *     id uuid primary key,
 *     updated_at timestamptz not null,
 *     data jsonb not null
 *   );
 *   alter table public.valet_clients enable row level security;
 *   -- For a single-user app protect it with a policy suited to your setup,
 *   -- e.g. require an authenticated user, or keep the anon key private.
 *
 * Strategy: last-write-wins per client id, pushed on local change and pulled
 * every PULL_MS. Remote deletions are not propagated (delete on each device
 * or clear the table); this is a deliberate simplification.
 */
const PULL_MS = 45_000;
const TABLE = "valet_clients";

let pullTimer: ReturnType<typeof setInterval> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
let applyingRemote = false;
let lastPushed = new Map<string, string>(); // id -> updatedAt already on server

function config(): { url: string; key: string } | null {
  const { supabaseUrl, supabaseAnonKey, syncEnabled } =
    store.getSnapshot().settings;
  if (!syncEnabled || !supabaseUrl.trim() || !supabaseAnonKey.trim()) return null;
  return { url: supabaseUrl.trim().replace(/\/$/, ""), key: supabaseAnonKey.trim() };
}

function headers(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export function startSync(): () => void {
  stopSync();
  unsubscribe = store.subscribe(() => {
    if (applyingRemote) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void push(), 2_000);
  });
  pullTimer = setInterval(() => void pull(), PULL_MS);
  void pull();
  return stopSync;
}

export function stopSync(): void {
  if (pullTimer) clearInterval(pullTimer);
  if (pushTimer) clearTimeout(pushTimer);
  pullTimer = null;
  pushTimer = null;
  unsubscribe?.();
  unsubscribe = null;
}

async function push(): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  const clients = store.getSnapshot().clients;
  const dirty = clients.filter((c) => lastPushed.get(c.id) !== c.updatedAt);
  if (dirty.length === 0) return;
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/${TABLE}?on_conflict=id`,
      {
        method: "POST",
        headers: {
          ...headers(cfg.key),
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(
          dirty.map((c) => ({ id: c.id, updated_at: c.updatedAt, data: c })),
        ),
      },
    );
    if (!res.ok) throw new Error(`Supabase push HTTP ${res.status}`);
    for (const c of dirty) lastPushed.set(c.id, c.updatedAt);
  } catch (err) {
    console.error("Sync push failed", err);
  }
}

async function pull(): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/${TABLE}?select=id,updated_at,data`,
      { headers: headers(cfg.key) },
    );
    if (!res.ok) throw new Error(`Supabase pull HTTP ${res.status}`);
    const rows: Array<{ id: string; updated_at: string; data: Client }> =
      await res.json();

    const local = store.getSnapshot().clients;
    const byId = new Map(local.map((c) => [c.id, c]));
    let changed = false;
    for (const row of rows) {
      const mine = byId.get(row.id);
      if (!mine || mine.updatedAt < row.data.updatedAt) {
        byId.set(row.id, row.data);
        lastPushed.set(row.id, row.data.updatedAt);
        changed = true;
      }
    }
    if (changed) {
      applyingRemote = true;
      replaceClients([...byId.values()]);
      applyingRemote = false;
    }
  } catch (err) {
    console.error("Sync pull failed", err);
  }
}

/** Remove a client remotely too (called from the delete action path). */
export async function syncDelete(id: string): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  try {
    await fetch(`${cfg.url}/rest/v1/${TABLE}?id=eq.${id}`, {
      method: "DELETE",
      headers: headers(cfg.key),
    });
    lastPushed.delete(id);
  } catch (err) {
    console.error("Sync delete failed", err);
  }
}
