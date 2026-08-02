/*
 * ALC Valet service worker.
 *
 * Caching strategy:
 *  - Navigations: network-first with cached fallback, so the app shell keeps
 *    working offline and picks up new deploys when online.
 *  - Hashed build assets (/assets/*): cache-first — filenames are
 *    content-hashed by Vite, so cached entries never go stale.
 *  - Everything else same-origin: stale-while-revalidate.
 */
const PRECACHE = "valet-precache-v1";
const RUNTIME = "valet-runtime-v1";
const PRECACHE_URLS = ["/", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PRECACHE && key !== RUNTIME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() =>
          caches
            .match("/", { ignoreSearch: true })
            .then((cached) => cached || caches.match("/index.html")),
        ),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(RUNTIME).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow("/");
      }),
  );
});

/*
 * Web Push entry point. Local notifications are shown directly by the app via
 * registration.showNotification(); this handler additionally supports true
 * server-sent push if a push backend is added later (see README — "Push
 * notifications").
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "ALC Valet", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "ALC Valet", {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      data: payload.data,
    }),
  );
});
