/* Tkallem service worker.
 *
 * Goals: the app installs and opens fast, and shows a clear offline page instead of the browser's error.
 * It NEVER caches: the API, authentication (Clerk), any non-GET request, any cross-origin request, any page.
 * Pages always come from the network (they depend on the signed-in user); only static files are cached.
 *
 * Bump VERSION to drop every old cache on the next visit.
 */
const VERSION = "v1";
const STATIC_CACHE = `tkallem-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("tkallem-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:woff2?|png|svg|ico)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return; // API, Clerk, fonts of other origins: untouched

  if (request.mode === "navigate") {
    // Pages: network only. If the network is down, the offline page.
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (isStaticAsset(url)) {
    // Static files (hashed by Next, so safe to reuse): cache first, refreshed in the background.
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const refresh = fetch(request)
          .then((response) => {
            if (response.ok && response.type === "basic") cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || refresh;
      }),
    );
  }
});
