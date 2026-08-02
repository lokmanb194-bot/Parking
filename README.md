# ALC Valet — Airport Valet Operations PWA

A fast, dark-mode, mobile-first Progressive Web App for running an airport
valet operation at **Alicante Airport (ALC)**: track incoming clients
(pickups), outgoing clients (returns), live flight status, your daily
schedule, and get notified when things change — even with the app minimised.

Built with **React 19 + TypeScript + Vite**, no backend required. Data is
stored **offline-first on the device**, with optional multi-device sync via
Supabase.

## Features

- **Two operational lists** — *Pickups* (clients arriving to drop off their
  car before flying out) and *Returns* (clients flying back in to collect
  their car), each with open-job badges in the tab bar.
- **Full client records** — name, license plate, phone, airline, flight
  number, date, scheduled time, parking location, notes, status.
- **Automatic flight tracking** — scheduled/estimated/actual times, delays,
  gate, landed / cancelled / diverted, refreshed automatically on a
  configurable interval while the app is open. No manual refresh needed.
- **Arrival detection** — once a return client's flight lands, the app marks
  them *"at the airport"* after a configurable walk-out time, notifies you,
  highlights them green and pins them to the top of the list. A manual
  **Arrived** button is always available.
- **Task management** — complete / undo / edit / delete on every card;
  completed jobs stay visible (crossed out) until you archive them.
- **Notifications** — flight delayed, flight landed, client arrived,
  delivery approaching, schedule conflicts. Delivered through the service
  worker so they show while the installed app is minimised.
- **Schedule** — daily agenda, weekly calendar, and a timeline view with a
  live "now" line; sort pickups/returns first, earliest/latest first; filter
  by pending/completed.
- **Search** — by client name, license plate, flight number or airline.
- **Dashboard** — cars waiting, cars to deliver, completed today, flights
  delayed, hand-overs due in the next hour, plus flight-problem and next-up
  lists.
- **PWA** — installable (Add to Home Screen), offline-capable app shell,
  dark theme, large touch targets for use while walking.
- **Backup** — export/import all data as JSON from Settings.

## Getting started

```bash
npm install
npm run dev        # local development
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
```

Deploy `dist/` to any static host (Netlify, Vercel, Cloudflare Pages,
GitHub Pages…). **HTTPS is required** for the service worker, install
prompt and notifications (localhost works for testing).

On your phone, open the deployed URL and use **Add to Home Screen** — the
app then runs standalone with its own icon and can show notifications while
minimised.

### Utility scripts

```bash
npm run icons          # regenerate PNG icons from public/icons/icon.svg (needs Chromium)
node scripts/smoke.mjs # build smoke test: seeds demo data, walks every tab, screenshots
```

## Flight data providers

Live flight status comes from a pluggable provider, chosen in **Settings →
Flight tracking**:

| Provider | Key needed | Notes |
|---|---|---|
| **Off** | — | Manual tracking only. |
| **Demo** | — | Simulated flights so you can try the whole pipeline (delays, landings, arrival detection, notifications) without any account. |
| **Aena (personal relay)** | your relay URL | Reads Aena's own public flight info through a relay you host — see below. |
| **AeroDataBox** | RapidAPI key | Good European/ALC coverage, free tier for light use. Subscribe at rapidapi.com → AeroDataBox, paste the `X-RapidAPI-Key`. |
| **AviationStack** | API key | aviationstack.com; the free tier is monthly-quota-limited, so keep the refresh interval generous. |

### Aena data through a personal relay

aena.es sends no CORS headers, so a static web app can never query it
directly from the browser — the request has to hop through a server you
control. The repo ships that server: `aena-proxy/worker.js`, a Cloudflare
Worker (free tier is plenty for one valet).

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages →
   Create → Worker**, paste `aena-proxy/worker.js`, deploy.
2. Aena's internal flight-info endpoint is undocumented and changes with
   site redesigns, so the Worker keeps it in one `AENA_UPSTREAM` constant:
   open aena.es flight info in a browser, search any ALC flight, copy the
   XHR request URL from DevTools → Network, and paste its pattern there.
   `?debug=1` on the Worker shows the raw upstream answer while tuning.
3. Paste the Worker URL into **Settings → Flight tracking → Aena**.

Heads-up, honestly stated: this reads Aena's public website data outside an
official API. For light personal use (one device, refresh every 5+ min)
that is generally tolerated but it sits in a gray zone of their website
terms, and a site redesign can break it until you re-capture the endpoint —
which is why the licensed providers above remain the more robust option.

Adding another provider (FlightAware AeroAPI, Cirium, an official Aena feed
if one appears…) means implementing one interface —
`src/services/flightProviders/types.ts` — and registering it in
`src/services/flightProviders/index.ts`. Nothing else changes.

## The license-plate limitation (please read)

Flight status can now come straight from Aena via the personal relay above.
**License-plate entry detection cannot.** The signal the official Aena app
uses to know a vehicle entered an airport car park lives behind Aena's
authenticated account systems (and anti-bot protection); it is not exposed
on any public page a personal relay could read. There is simply no lawful,
workable way for a client-side app to query "has plate 1234-ABC entered
ALC" today.

How the app compensates: a modular *arrival detector*
(`src/services/arrival.ts`) infers arrival from the tracked flight (landed
+ configurable walk-out minutes), plus the always-available manual
**Arrived** button. If you ever obtain plate-entry data (e.g. through the
car-park operator or an Aena commercial agreement), implement the
`ArrivalDetector` interface against it and add it to the detector list —
the green highlight, pin-to-top and notification already work off that
signal.

## Notifications: local vs push

Notifications are generated on-device by a monitor loop
(`src/services/monitor.ts`) and displayed through the service worker, so
they appear while the installed app is in the background on Android/Chrome.
This requires the app (or its tab) to be alive; if the OS fully kills it,
checks resume when you reopen the app.

True server-sent **Web Push** (notifications with the app completely
closed) requires a small backend that polls flights and pushes via VAPID.
The service worker already has a `push` handler wired
(`public/sw.js`), so adding that backend later needs no client redesign.

## Optional multi-device sync (Supabase)

The app is fully functional offline with device-local storage. To mirror
data across devices:

1. Create a free project at supabase.com.
2. Run this SQL in the SQL editor:

   ```sql
   create table public.valet_clients (
     id uuid primary key,
     updated_at timestamptz not null,
     data jsonb not null
   );
   alter table public.valet_clients enable row level security;
   create policy "valet anon access" on public.valet_clients
     for all using (true) with check (true);
   ```

   > The permissive policy above means anyone with your anon key can read
   > and write the table — fine for a personal single-user app if you keep
   > the key private, but consider Supabase Auth for anything more.

3. In **Settings → Multi-device sync**, paste the project URL and anon key
   and enable sync.

Sync is last-write-wins per client and pulls every 45 s
(`src/services/sync.ts`). Deletions propagate best-effort.

## Architecture

```
src/
├── types.ts                  # domain model (Client, FlightInfo, Settings)
├── store/
│   ├── store.ts              # external store: localStorage + BroadcastChannel
│   └── actions.ts            # all state mutations
├── services/
│   ├── flightProviders/      # pluggable flight-status sources
│   │   ├── types.ts          #   FlightProvider interface
│   │   ├── aerodatabox.ts    #   AeroDataBox adapter
│   │   ├── aviationstack.ts  #   AviationStack adapter
│   │   ├── demo.ts           #   keyless simulator
│   │   └── index.ts          #   registry / active provider
│   ├── monitor.ts            # polling loop, change→notification, reminders, conflicts
│   ├── arrival.ts            # modular airport-arrival detection (Aena-ready)
│   ├── notify.ts             # notification permission + dedupe + SW display
│   └── sync.ts               # optional Supabase REST sync
├── components/               # cards, form, list, flight status row
├── views/                    # Schedule, Dashboard, Settings
└── App.tsx                   # tabs, FAB, wiring
public/
├── sw.js                     # offline caching + notification/push handlers
├── manifest.webmanifest
└── icons/
```

Jobs and flights are linked by direction: a **pickup** client is flying
*out* of ALC (their departure is tracked), a **return** client is flying
*into* ALC (their arrival is tracked, and drives arrival detection).
