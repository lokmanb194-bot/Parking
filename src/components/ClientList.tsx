import { useMemo, useState } from "react";
import { ClientCard } from "./ClientCard";
import { useAppState } from "../store/store";
import { archiveCompleted } from "../store/actions";
import { formatDayLabel, jobDateTime } from "../utils/time";
import type { Client, JobType } from "../types";

interface Props {
  type: JobType;
  onEdit: (client: Client) => void;
}

/** Arrived clients float to the top, completed sink to the bottom. */
function rank(c: Client): number {
  if (c.status === "arrived") return 0;
  if (c.status === "pending") return 1;
  return 2;
}

export function matchesQuery(c: Client, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [c.name, c.plate, c.flightNumber ?? "", c.airline ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function ClientList({ type, onEdit }: Props) {
  const { clients } = useAppState();
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    return clients
      .filter((c) => c.type === type && !c.archived && matchesQuery(c, query))
      .sort((a, b) => {
        const byRank = rank(a) - rank(b);
        if (byRank !== 0) return byRank;
        return jobDateTime(a).getTime() - jobDateTime(b).getTime();
      });
  }, [clients, type, query]);

  const completedCount = visible.filter((c) => c.status === "completed").length;

  // Group by date, but keep "arrived" clients pinned in a top group.
  const groups = useMemo(() => {
    const out: Array<{ key: string; label: string; items: Client[] }> = [];
    for (const c of visible) {
      const key = c.status === "arrived" ? "__arrived" : c.date;
      const label =
        c.status === "arrived" ? "🟢 At the airport now" : formatDayLabel(c.date);
      const group = out.find((g) => g.key === key);
      if (group) group.items.push(c);
      else out.push({ key, label, items: [c] });
    }
    return out;
  }, [visible]);

  return (
    <div>
      <div className="searchbar">
        <span className="icon">🔍</span>
        <input
          type="search"
          placeholder="Search name, plate or flight…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search clients"
        />
      </div>

      {groups.length === 0 && (
        <div className="empty">
          <div className="big">{type === "incoming" ? "🚗" : "🔑"}</div>
          {query
            ? "No clients match your search."
            : type === "incoming"
              ? "No pickups yet. Tap + to add a client dropping off their car."
              : "No returns yet. Tap + to add a client coming back for their car."}
        </div>
      )}

      {groups.map((group) => (
        <section key={group.key}>
          <div className="date-heading">{group.label}</div>
          {group.items.map((c) => (
            <ClientCard key={c.id} client={c} onEdit={onEdit} />
          ))}
        </section>
      ))}

      {completedCount > 0 && (
        <button
          className="btn grow"
          style={{ width: "100%", marginTop: 8 }}
          onClick={() => archiveCompleted()}
        >
          🗄 Archive {completedCount} completed
        </button>
      )}
    </div>
  );
}
