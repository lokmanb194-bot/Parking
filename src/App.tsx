import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ClientForm } from "./components/ClientForm";
import { ClientList } from "./components/ClientList";
import { LockScreen } from "./components/LockScreen";
import { startMonitor } from "./services/monitor";
import { startParkingConnector } from "./services/parkingConnector";
import { startSync } from "./services/sync";
import { useAppState } from "./store/store";
import { DashboardView } from "./views/DashboardView";
import { DailyProgramView } from "./views/DailyProgramView";
import { ScheduleView } from "./views/ScheduleView";
import { SettingsView } from "./views/SettingsView";
import type { Client, JobType } from "./types";

type Tab =
  | "dashboard"
  | "incoming"
  | "outgoing"
  | "program"
  | "schedule"
  | "settings";

interface NavItem {
  id: Tab;
  icon: string;
  label: string;
  short: string;
}

const NAV: NavItem[] = [
  { id: "dashboard", icon: "📊", label: "Dashboard", short: "Home" },
  { id: "incoming", icon: "🚗", label: "Pickups", short: "Pickups" },
  { id: "outgoing", icon: "🔑", label: "Returns", short: "Returns" },
  { id: "program", icon: "🗒️", label: "Daily Program", short: "Program" },
  { id: "schedule", icon: "📅", label: "Schedule", short: "Schedule" },
];

// Shown in the mobile bottom bar (Settings lives behind the header gear there).
const MOBILE_TABS = NAV;

const TITLES: Record<Tab, string> = {
  dashboard: "Dashboard",
  incoming: "Incoming · Pickups",
  outgoing: "Outgoing · Returns",
  program: "Daily Program",
  schedule: "Schedule",
  settings: "Settings",
};

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="clock">
      {`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`}
    </span>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem("alc-valet-unlocked") === "1",
  );
  const { clients, settings } = useAppState();

  useEffect(() => {
    const stops = [startMonitor(), startSync(), startParkingConnector()];
    return () => stops.forEach((stop) => stop());
  }, []);

  const openCount = useMemo(() => {
    const active = clients.filter((c) => !c.archived && c.status !== "completed");
    return {
      incoming: active.filter((c) => c.type === "incoming").length,
      outgoing: active.filter((c) => c.type === "outgoing").length,
      program: active.filter((c) => c.date === todayISO()).length,
    };
  }, [clients]);

  if (settings.passcode && !unlocked) {
    return (
      <LockScreen
        passcode={settings.passcode}
        onUnlock={() => {
          sessionStorage.setItem("alc-valet-unlocked", "1");
          setUnlocked(true);
        }}
      />
    );
  }

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (client: Client) => {
    setEditing(client);
    setFormOpen(true);
  };

  const defaultType: JobType = tab === "outgoing" ? "outgoing" : "incoming";
  const countFor = (id: Tab) =>
    id === "incoming"
      ? openCount.incoming
      : id === "outgoing"
        ? openCount.outgoing
        : id === "program"
          ? openCount.program
          : 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">🅿️</div>
          <div>
            <div className="name">ALC Valet</div>
            <div className="place">Alicante Airport</div>
          </div>
        </div>
        <nav className="side-nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`side-nav-btn ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <span className="ico">{item.icon}</span>
              {item.label}
              {countFor(item.id) > 0 && (
                <span className="count">{countFor(item.id)}</span>
              )}
            </button>
          ))}
          <button
            className={`side-nav-btn ${tab === "settings" ? "active" : ""}`}
            onClick={() => setTab("settings")}
          >
            <span className="ico">⚙️</span>
            Settings
          </button>
        </nav>
        <button className="side-cta" onClick={openNew}>
          ＋ New reservation
        </button>
        <div className="side-foot">
          Personal valet admin panel.
          <br />
          Data stays on this device unless sync is on.
        </div>
      </aside>

      <div className="content">
        <header className="app-header">
          <h1>{TITLES[tab]}</h1>
          <span className="sub">ALC</span>
          <Clock />
          <button
            className="icon-header-btn mobile-only"
            aria-label="Settings"
            onClick={() => setTab("settings")}
          >
            ⚙️
          </button>
        </header>

        <main className="main">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {tab === "dashboard" && <DashboardView onEdit={openEdit} />}
              {tab === "incoming" && (
                <ClientList type="incoming" onEdit={openEdit} />
              )}
              {tab === "outgoing" && (
                <ClientList type="outgoing" onEdit={openEdit} />
              )}
              {tab === "program" && <DailyProgramView onEdit={openEdit} />}
              {tab === "schedule" && <ScheduleView onEdit={openEdit} />}
              {tab === "settings" && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {tab !== "settings" && (
        <button className="fab" aria-label="Add reservation" onClick={openNew}>
          ＋
        </button>
      )}

      <nav className="tabbar">
        <div className="tabbar-inner">
          {MOBILE_TABS.map((item) => (
            <button
              key={item.id}
              className={`tab-btn ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <span className="icon">{item.icon}</span>
              {item.short}
              {countFor(item.id) > 0 && (
                <span className="badge">{countFor(item.id)}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <AnimatePresence>
        {formOpen && (
          <ClientForm
            key="form"
            client={editing}
            defaultType={editing?.type ?? defaultType}
            onClose={() => setFormOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
