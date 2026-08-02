import { useEffect, useMemo, useState } from "react";
import { ClientForm } from "./components/ClientForm";
import { ClientList } from "./components/ClientList";
import { startMonitor } from "./services/monitor";
import { startSync } from "./services/sync";
import { useAppState } from "./store/store";
import { DashboardView } from "./views/DashboardView";
import { ScheduleView } from "./views/ScheduleView";
import { SettingsView } from "./views/SettingsView";
import type { Client, JobType } from "./types";

type Tab = "incoming" | "outgoing" | "schedule" | "dashboard" | "settings";

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "incoming", icon: "🚗", label: "Pickups" },
  { id: "outgoing", icon: "🔑", label: "Returns" },
  { id: "schedule", icon: "📅", label: "Schedule" },
  { id: "dashboard", icon: "📊", label: "Dashboard" },
  { id: "settings", icon: "⚙️", label: "Settings" },
];

const TITLES: Record<Tab, string> = {
  incoming: "Incoming · Pickups",
  outgoing: "Outgoing · Returns",
  schedule: "Schedule",
  dashboard: "Dashboard",
  settings: "Settings",
};

export default function App() {
  const [tab, setTab] = useState<Tab>("incoming");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const { clients } = useAppState();

  useEffect(() => {
    const stopMonitor = startMonitor();
    const stopSync = startSync();
    return () => {
      stopMonitor();
      stopSync();
    };
  }, []);

  const openCount = useMemo(() => {
    const active = clients.filter((c) => !c.archived && c.status !== "completed");
    return {
      incoming: active.filter((c) => c.type === "incoming").length,
      outgoing: active.filter((c) => c.type === "outgoing").length,
    };
  }, [clients]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setFormOpen(true);
  };

  const defaultType: JobType = tab === "outgoing" ? "outgoing" : "incoming";

  return (
    <>
      <header className="app-header">
        <h1>{TITLES[tab]}</h1>
        <span className="sub">ALC · Alicante</span>
      </header>

      <main className="main">
        {tab === "incoming" && <ClientList type="incoming" onEdit={openEdit} />}
        {tab === "outgoing" && <ClientList type="outgoing" onEdit={openEdit} />}
        {tab === "schedule" && <ScheduleView onEdit={openEdit} />}
        {tab === "dashboard" && <DashboardView onEdit={openEdit} />}
        {tab === "settings" && <SettingsView />}
      </main>

      {tab !== "settings" && (
        <button className="fab" aria-label="Add client" onClick={openNew}>
          +
        </button>
      )}

      <nav className="tabbar">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="icon">{t.icon}</span>
              {t.label}
              {t.id === "incoming" && openCount.incoming > 0 && (
                <span className="badge">{openCount.incoming}</span>
              )}
              {t.id === "outgoing" && openCount.outgoing > 0 && (
                <span className="badge">{openCount.outgoing}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {formOpen && (
        <ClientForm
          client={editing}
          defaultType={editing?.type ?? defaultType}
          onClose={() => setFormOpen(false)}
        />
      )}
    </>
  );
}
