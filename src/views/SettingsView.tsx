import { useRef, useState } from "react";
import {
  archiveCompleted,
  replaceClients,
  updateSettings,
} from "../store/actions";
import {
  requestNotificationPermission,
  showTestNotification,
} from "../services/notify";
import { useAppState } from "../store/store";
import type { Client, FlightProviderId } from "../types";

export function SettingsView() {
  const { settings, clients } = useAppState();
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 4000);
  };

  const toggleNotifications = async () => {
    if (settings.notificationsEnabled) {
      updateSettings({ notificationsEnabled: false });
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      flash("Permission denied — allow notifications for this site in your browser settings.");
      return;
    }
    updateSettings({ notificationsEnabled: true });
    await showTestNotification();
  };

  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), clients }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alc-valet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { clients?: Client[] };
      if (!Array.isArray(parsed.clients)) throw new Error("no clients array");
      const byId = new Map(clients.map((c) => [c.id, c]));
      for (const imported of parsed.clients) {
        const mine = byId.get(imported.id);
        if (!mine || mine.updatedAt < imported.updatedAt) {
          byId.set(imported.id, imported);
        }
      }
      replaceClients([...byId.values()]);
      flash(`Imported ${parsed.clients.length} clients (merged).`);
    } catch {
      flash("Import failed — not a valid backup file.");
    }
  };

  return (
    <div>
      {message && (
        <div className="note" style={{ marginBottom: 14 }}>
          {message}
        </div>
      )}

      <div className="settings-card">
        <h3>🔔 Notifications</h3>
        <p className="desc">
          Alerts for delays, landings, arrivals, upcoming deliveries and schedule
          conflicts. On your phone, install the app (Add to Home Screen) so
          notifications also appear while the app is minimised.
        </p>
        <div className="switch-row">
          <span className="label">Enable notifications</span>
          <button
            className={`switch ${settings.notificationsEnabled ? "on" : ""}`}
            role="switch"
            aria-checked={settings.notificationsEnabled}
            aria-label="Enable notifications"
            onClick={() => void toggleNotifications()}
          />
        </div>
        {settings.notificationsEnabled && (
          <button
            className="btn"
            style={{ marginTop: 8 }}
            onClick={() => void showTestNotification()}
          >
            Send test notification
          </button>
        )}
        <div className="field-grid" style={{ marginTop: 12 }}>
          <div className="field">
            <label htmlFor="s-lead">Delivery reminder (min before)</label>
            <input
              id="s-lead"
              type="number"
              min={5}
              max={240}
              value={settings.deliveryLeadMin}
              onChange={(e) =>
                updateSettings({ deliveryLeadMin: Number(e.target.value) || 45 })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="s-walkout">Walk-out time after landing (min)</label>
            <input
              id="s-walkout"
              type="number"
              min={0}
              max={120}
              value={settings.walkOutMin}
              onChange={(e) =>
                updateSettings({ walkOutMin: Number(e.target.value) || 20 })
              }
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3>✈️ Flight tracking</h3>
        <p className="desc">
          Live status comes from a licensed flight-data provider. Pick one, paste
          your API key, and flights refresh automatically while the app is open.
        </p>
        <div className="field">
          <label htmlFor="s-provider">Data provider</label>
          <select
            id="s-provider"
            value={settings.flightProvider}
            onChange={(e) =>
              updateSettings({ flightProvider: e.target.value as FlightProviderId })
            }
          >
            <option value="none">Off — manual tracking only</option>
            <option value="demo">Demo — simulated flights (no key needed)</option>
            <option value="aena">Aena — via your personal relay</option>
            <option value="aerodatabox">AeroDataBox (RapidAPI key)</option>
            <option value="aviationstack">AviationStack (API key)</option>
          </select>
        </div>
        {settings.flightProvider === "aena" && (
          <>
            <div className="field">
              <label htmlFor="s-aena">Relay URL (your Cloudflare Worker)</label>
              <input
                id="s-aena"
                type="url"
                value={settings.aenaProxyUrl}
                onChange={(e) => updateSettings({ aenaProxyUrl: e.target.value })}
                placeholder="https://alc-valet-aena.yourname.workers.dev"
              />
            </div>
            <div className="note" style={{ marginBottom: 12 }}>
              aena.es blocks direct browser requests (no CORS), so Aena data
              flows through a small relay you host for free — deploy{" "}
              <strong>aena-proxy/worker.js</strong> from the repository to
              Cloudflare Workers (steps in the README) and paste its URL here.
              For light personal use; keep the refresh interval at 5+ minutes.
            </div>
          </>
        )}
        {settings.flightProvider === "aerodatabox" && (
          <div className="field">
            <label htmlFor="s-adb">RapidAPI key for AeroDataBox</label>
            <input
              id="s-adb"
              type="password"
              value={settings.aeroDataBoxKey}
              onChange={(e) => updateSettings({ aeroDataBoxKey: e.target.value })}
              placeholder="Paste your X-RapidAPI-Key"
            />
          </div>
        )}
        {settings.flightProvider === "aviationstack" && (
          <div className="field">
            <label htmlFor="s-avs">AviationStack access key</label>
            <input
              id="s-avs"
              type="password"
              value={settings.aviationStackKey}
              onChange={(e) => updateSettings({ aviationStackKey: e.target.value })}
              placeholder="Paste your access_key"
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="s-poll">Refresh interval (minutes)</label>
          <input
            id="s-poll"
            type="number"
            min={1}
            max={60}
            value={settings.pollIntervalMin}
            onChange={(e) =>
              updateSettings({ pollIntervalMin: Number(e.target.value) || 3 })
            }
          />
        </div>
      </div>

      <div className="settings-card">
        <h3>🅿️ Car-park tracking</h3>
        <p className="desc">
          Set each car’s parking status by hand on its card or in the Daily
          Program (Awaiting → In parking → Returned). Optionally, a self-hosted
          connector you run can set it automatically.
        </p>
        <div className="note warn" style={{ marginBottom: 12 }}>
          <strong>Your Aena login never goes in this app.</strong> This app is
          static and its repo is public, so it can’t safely hold your Aena email
          and password, and automating an Aena account login is against their
          terms. Instead, run the connector in{" "}
          <strong>parking-connector/</strong> on your own machine — your
          credentials stay there — and it feeds only the parking status back
          here.
        </div>
        <div className="field">
          <label htmlFor="s-conn">Parking connector URL (yours)</label>
          <input
            id="s-conn"
            type="url"
            value={settings.parkingConnectorUrl}
            onChange={(e) =>
              updateSettings({ parkingConnectorUrl: e.target.value })
            }
            placeholder="http://localhost:8787  or  https://…"
          />
        </div>
        <div className="field">
          <label htmlFor="s-conntok">Connector token (optional)</label>
          <input
            id="s-conntok"
            type="password"
            value={settings.parkingConnectorToken}
            onChange={(e) =>
              updateSettings({ parkingConnectorToken: e.target.value })
            }
            placeholder="Shared secret your connector checks"
          />
        </div>
        <div className="note">
          The connector only ever returns which of the day’s plates are inside;
          the app matches them to your reservations by plate. See the README
          (“Self-hosted parking connector”) for the ~15-minute setup.
        </div>
      </div>

      <div className="settings-card">
        <h3>🔒 Admin passcode (optional)</h3>
        <p className="desc">
          Leave empty for instant access. Set a code to require it when the app
          opens on this device — a convenience lock, not encryption.
        </p>
        <div className="field">
          <label htmlFor="s-pass">Passcode</label>
          <input
            id="s-pass"
            type="text"
            inputMode="numeric"
            value={settings.passcode}
            onChange={(e) => updateSettings({ passcode: e.target.value })}
            placeholder="e.g. 1234 (empty = no lock)"
          />
        </div>
      </div>

      <div className="settings-card">
        <h3>☁️ Multi-device sync (optional)</h3>
        <p className="desc">
          The app is fully offline-first; data lives on this device. To share data
          across devices, create a free Supabase project, run the SQL from the
          README, and paste its URL and anon key here.
        </p>
        <div className="field">
          <label htmlFor="s-sburl">Supabase project URL</label>
          <input
            id="s-sburl"
            value={settings.supabaseUrl}
            onChange={(e) => updateSettings({ supabaseUrl: e.target.value })}
            placeholder="https://xyzcompany.supabase.co"
          />
        </div>
        <div className="field">
          <label htmlFor="s-sbkey">Supabase anon key</label>
          <input
            id="s-sbkey"
            type="password"
            value={settings.supabaseAnonKey}
            onChange={(e) => updateSettings({ supabaseAnonKey: e.target.value })}
            placeholder="eyJhbGciOi…"
          />
        </div>
        <div className="switch-row">
          <span className="label">Enable sync</span>
          <button
            className={`switch ${settings.syncEnabled ? "on" : ""}`}
            role="switch"
            aria-checked={settings.syncEnabled}
            aria-label="Enable sync"
            onClick={() => updateSettings({ syncEnabled: !settings.syncEnabled })}
          />
        </div>
      </div>

      <div className="settings-card">
        <h3>🗄 Data</h3>
        <div className="form-actions" style={{ marginTop: 0 }}>
          <button
            className="btn grow"
            onClick={() => flash(`Archived ${archiveCompleted()} completed jobs.`)}
          >
            Archive completed
          </button>
          <button className="btn grow" onClick={exportData}>
            Export backup
          </button>
          <button className="btn grow" onClick={() => fileRef.current?.click()}>
            Import
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importData(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
