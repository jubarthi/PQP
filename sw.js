/* PQP Hotseat - simple offline cache */
const CACHE = "pqp-hotseat-v1";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : Promise.resolve())));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, {ignoreSearch:true});
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      // Cache same-origin GET
      if (req.method === "GET" && new URL(req.url).origin === self.location.origin) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      // fallback to index for navigation
      if (req.mode === "navigate") {
        const idx = await cache.match("./index.html");
        if (idx) return idx;
      }
      throw e;
    }
  })());
});
