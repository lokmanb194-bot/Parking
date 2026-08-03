# Self-hosted parking connector

This small service is how ALC Valet learns **which cars are inside the Aena
car park** without your Aena password ever touching the app or its public
repository. You run it yourself; your credentials live only here.

```
ALC Valet (public web app)  ──GET /parking?date=…──▶  this connector (your machine)
        ▲                                                     │
        └────────── { plate: status } only ───────────────────┘   ← never your password
```

## Setup (~15 minutes)

1. Install Node 20+.
2. In this folder:
   ```bash
   cp .env.example .env
   # edit .env: set MODE=mock to start, and a CONNECTOR_TOKEN
   npm start
   ```
   You'll see `parking connector on http://localhost:8787 (mode: mock)`.
3. In ALC Valet → **Settings → Car-park tracking**, paste the connector URL
   (`http://localhost:8787` if the app runs on the same machine) and the same
   token. The app polls it once a minute and updates each reservation's parking
   status by plate; a notification fires when a car first shows as inside.

`MODE=mock` serves demo plates so you can confirm the whole pipeline works
before writing any Aena code.

## Making it real

Open `server.mjs` and implement `fetchPlatesInside(date)` — the one function
that talks to your Aena account. It must return, for the given date:

```json
{ "1234ABC": "in_parking", "5678XYZ": "returned", "9999ZZZ": "awaiting" }
```

Read `AENA_EMAIL` / `AENA_PASSWORD` from `process.env` (they come from `.env`).
How you obtain the data is up to you and your account — a logged-in bookings
page, an export, etc. Then set `MODE=live` in `.env` and restart.

## Keep it safe and legitimate

- **`.env` is gitignored** — never commit your credentials. Don't paste them
  anywhere else, especially not into the app or the public repo.
- Set a strong `CONNECTOR_TOKEN`, and if you expose the connector beyond
  localhost, put it behind HTTPS and set `ALLOW_ORIGIN` to the app's origin.
- Automating a personal Aena login sits in a gray area of their website terms.
  Keep it to light personal use, poll gently (the app default is once a
  minute), and stop if Aena objects. If you need robust, sanctioned data,
  a licensed provider or a commercial agreement with the car-park operator is
  the durable route.
- If your account uses 2-factor auth or Aena changes its site, live mode may
  need re-work; the app keeps the last known statuses when the connector is
  unreachable, so nothing breaks in the meantime.
