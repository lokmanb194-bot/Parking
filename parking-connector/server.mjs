/*
 * ALC Valet — self-hosted parking connector.
 *
 * WHAT THIS IS
 * ------------
 * A tiny HTTP service that YOU run on your own machine or private server. It
 * is the only place your Aena email/password ever live (in a local .env that
 * is never committed). It logs into Aena on your behalf, works out which of a
 * day's licence plates are inside the car park, and exposes ONE read-only
 * endpoint that the ALC Valet app polls:
 *
 *   GET /parking?date=YYYY-MM-DD        (optional: Authorization: Bearer <token>)
 *   -> { "plates": { "1234ABC": "in_parking", "5678XYZ": "returned" } }
 *
 * The app never sees your credentials — only this small status map.
 *
 * WHY IT IS SEPARATE FROM THE APP
 * -------------------------------
 * The app is a public, static site; putting account credentials in it would
 * expose them. Keeping them here, on hardware you control, is the safe design
 * you chose. Note that automating a personal Aena login is a gray area under
 * Aena's terms — run this for light personal use only, at a gentle poll rate,
 * and stop if Aena asks you to.
 *
 * RUN
 * ---
 *   cd parking-connector
 *   cp .env.example .env      # then edit .env
 *   npm install               # only needed if you add scraping deps
 *   npm start                 # serves http://localhost:8787
 * Put that URL into ALC Valet → Settings → Car-park tracking.
 *
 * IMPLEMENT YOUR ACCESS
 * ---------------------
 * Fill in `fetchPlatesInside()` below with however you legitimately read the
 * data from your own Aena account (their site, an export, a booking list…).
 * Until you do, set MODE=mock in .env to return demo data so you can wire up
 * and test the whole pipeline end to end.
 */
import { createServer } from "node:http";
import process from "node:process";

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.CONNECTOR_TOKEN || "";
const MODE = process.env.MODE || "mock"; // "mock" | "live"
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";

/**
 * Return the parking status of every plate known to be relevant for `date`,
 * as { "PLATE": "awaiting" | "in_parking" | "returned" }. Plates are matched
 * to reservations case-insensitively with spaces/dashes ignored.
 *
 * Replace the mock branch with your own Aena access. Read AENA_EMAIL /
 * AENA_PASSWORD from process.env — never hard-code them, never commit .env.
 */
async function fetchPlatesInside(date) {
  if (MODE === "mock") {
    // Demo data so you can test the app without any real login.
    return {
      "4821KLM": "in_parking",
      "9034JTR": "in_parking",
      "7712HGF": "returned",
    };
  }

  // ---- LIVE MODE: your implementation goes here -------------------------
  // const email = process.env.AENA_EMAIL;
  // const password = process.env.AENA_PASSWORD;
  // 1. Authenticate to your Aena account (kept entirely within this process).
  // 2. Fetch the car-park / bookings view for `date`.
  // 3. Map each plate to "awaiting" | "in_parking" | "returned".
  // Return that object. Throwing here yields a 502 to the app, which simply
  // keeps the last known statuses — safe to fail.
  throw new Error(
    "LIVE mode not implemented yet. Implement fetchPlatesInside() or set MODE=mock in .env.",
  );
  // -----------------------------------------------------------------------
}

const server = createServer(async (req, res) => {
  const cors = {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", ...cors });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === "/health") return send(200, { ok: true, mode: MODE });
  if (url.pathname !== "/parking") return send(404, { error: "Use /parking?date=YYYY-MM-DD" });

  if (TOKEN) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${TOKEN}`) return send(401, { error: "Bad or missing token" });
  }

  const date = url.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return send(400, { error: "date=YYYY-MM-DD is required" });
  }

  try {
    const plates = await fetchPlatesInside(date);
    send(200, { date, plates });
  } catch (err) {
    console.error(err);
    send(502, { error: String(err?.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`ALC Valet parking connector on http://localhost:${PORT} (mode: ${MODE})`);
  if (!TOKEN) console.log("No CONNECTOR_TOKEN set — anyone who can reach this port can read it.");
});
