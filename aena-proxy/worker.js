/*
 * ALC Valet — personal Aena flight-data relay (Cloudflare Worker).
 *
 * WHY THIS EXISTS
 * ---------------
 * aena.es publishes flight information on its website but offers no public
 * API and sends no CORS headers, so the ALC Valet PWA (a static site) cannot
 * call it from the browser. This Worker runs under YOUR free Cloudflare
 * account, fetches Aena's public flight-information service on your behalf,
 * and answers with the small normalized JSON contract the app expects.
 * It is intended for light personal use only — one valet, a handful of
 * flights, one request every few minutes. Note that automated access is a
 * gray area under Aena's website terms; keep the poll interval generous.
 *
 * DEPLOY (≈5 minutes, free)
 * -------------------------
 *  1. https://dash.cloudflare.com → Workers & Pages → Create → Worker.
 *  2. Replace the generated code with this file. Deploy.
 *  3. IMPORTANT — set the upstream (see AENA_UPSTREAM below): on your phone
 *     or PC open aena.es → flight info (infovuelos), search any ALC flight,
 *     then in the browser DevTools → Network → XHR copy the request URL that
 *     returned the flight JSON, and paste its pattern into AENA_UPSTREAM.
 *     Aena reworks its site now and then, which is also why this knob exists.
 *  4. Copy the worker URL (https://<name>.<account>.workers.dev) into
 *     ALC Valet → Settings → Flight tracking → "Aena (personal relay)".
 *
 * CONTRACT SERVED TO THE APP
 * --------------------------
 *   GET /flight?number=VY1350&date=2026-08-02&role=arrival|departure
 *   → 200 {"found":true,"phase":"landed","scheduled":"…","estimated":"…",
 *          "actual":"…","gate":"…","terminal":"…","counterpart":"…",
 *          "delayMinutes":12}
 *   → 200 {"found":false} when the flight isn't listed.
 *   Add &debug=1 to see the raw upstream payload while troubleshooting.
 */

/*
 * The upstream request template. `{number}` and `{date}` are substituted.
 * The default below targets Aena's flight-info search as of early 2026;
 * if Aena has changed it, capture the current URL as described above.
 */
const AENA_UPSTREAM =
  "https://www.aena.es/infovuelos-web/rest/vuelos?numVuelo={number}&fecha={date}&aeropuerto=ALC";

const UPSTREAM_HEADERS = {
  // A plain browser-like request; Aena serves this data publicly.
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    const url = new URL(request.url);
    if (url.pathname !== "/flight") {
      return json({ error: "Use /flight?number=XX123&date=YYYY-MM-DD&role=arrival" }, 404);
    }

    const number = (url.searchParams.get("number") || "").replace(/\s+/g, "").toUpperCase();
    const date = url.searchParams.get("date") || "";
    const role = url.searchParams.get("role") === "departure" ? "departure" : "arrival";
    const debug = url.searchParams.get("debug") === "1";
    if (!number || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: "number and date=YYYY-MM-DD are required" }, 400);
    }

    const upstreamUrl = AENA_UPSTREAM.replace("{number}", encodeURIComponent(number)).replace(
      "{date}",
      encodeURIComponent(date),
    );

    let upstream;
    try {
      upstream = await fetch(upstreamUrl, { headers: UPSTREAM_HEADERS });
    } catch (err) {
      return json({ error: `Upstream fetch failed: ${err}` }, 502);
    }
    const text = await upstream.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      // fall through — payload stays null and we report it below
    }

    if (debug) {
      return json({
        upstreamUrl,
        upstreamStatus: upstream.status,
        parsed: payload !== null,
        sample: text.slice(0, 4000),
      });
    }
    if (!upstream.ok || payload === null) {
      return json(
        {
          error:
            `Upstream answered ${upstream.status} or non-JSON. Aena has likely changed ` +
            "its endpoint — recapture it from DevTools and update AENA_UPSTREAM " +
            "(add &debug=1 to this request to inspect what came back).",
        },
        502,
      );
    }

    const flight = pickFlight(collectFlights(payload), number);
    if (!flight) return json({ found: false });
    return json(normalize(flight, role, date));
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/*
 * Aena's exact JSON shape varies between site versions, so instead of hard
 * wiring one schema the helpers below scan the payload defensively: collect
 * every object that looks like a flight record, pick the one matching the
 * flight number, then read whichever of the known field aliases is present.
 */
function collectFlights(node, out = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectFlights(item, out);
  } else if (node && typeof node === "object") {
    const id = firstString(node, ["numVuelo", "flightNumber", "nvuelo", "vuelo", "numero"]);
    if (id) out.push(node);
    for (const value of Object.values(node)) collectFlights(value, out);
  }
  return out;
}

function pickFlight(flights, number) {
  const clean = (s) => String(s).replace(/\s+/g, "").toUpperCase();
  return (
    flights.find((f) =>
      clean(firstString(f, ["numVuelo", "flightNumber", "nvuelo", "vuelo", "numero"])) === number,
    ) ?? null
  );
}

function normalize(flight, role, date) {
  const scheduled = firstString(flight, [
    "horaProgramada", "fechaHoraProgramada", "scheduledTime", "horaPrevista", "stad", "std",
  ]);
  const estimated = firstString(flight, [
    "horaEstimada", "fechaHoraEstimada", "estimatedTime", "etad", "etd",
  ]);
  const actual = firstString(flight, [
    "horaReal", "fechaHoraReal", "actualTime", "atad", "atd",
  ]);
  const status = firstString(flight, ["estado", "status", "estadoVuelo", "situacion"]);
  return {
    found: true,
    phase: status || null,
    scheduled: toISO(scheduled, date),
    estimated: toISO(estimated, date),
    actual: toISO(actual, date),
    delayMinutes: null,
    gate: firstString(flight, ["puerta", "gate", "puertaEmbarque"]) || null,
    terminal: firstString(flight, ["terminal", "term"]) || null,
    counterpart:
      firstString(flight, [
        role === "arrival" ? "origen" : "destino",
        role === "arrival" ? "origin" : "destination",
        role === "arrival" ? "codOrigen" : "codDestino",
      ]) || null,
  };
}

function firstString(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "object" && value !== null) {
      const nested = firstString(value, ["codigo", "code", "iata", "nombre", "name", "hora"]);
      if (nested) return nested;
    }
  }
  return "";
}

/* Accepts "HH:mm", "YYYY-MM-DDTHH:mm…" or "DD/MM/YYYY HH:mm" → ISO local. */
function toISO(value, date) {
  if (!value) return null;
  if (/^\d{2}:\d{2}/.test(value)) return `${date}T${value.slice(0, 5)}:00`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const es = value.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}:\d{2})/);
  if (es) return `${es[3]}-${es[2]}-${es[1]}T${es[4]}:00`;
  return null;
}
