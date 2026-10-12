/* Sleeve or Slab service worker.
 * - Static assets (/_next/static, /icons, fonts, images): cache-first (they're content-hashed or versioned).
 * - App shell pages (navigations): stale-while-revalidate, falling back to the cached /scan shell offline.
 * - /api/*: network-first, cached copy only as an offline fallback (GET only).
 * - Never caches non-GET requests (POST waitlist, predictions, outcomes) or cross-origin requests.
 * Bump VERSION to drop old caches.
 */
const VERSION = "v1";
const SHELL = `sos-shell-${VERSION}`;
const STATIC = `sos-static-${VERSION}`;
const API = `sos-api-${VERSION}`;
const SHELL_URLS = ["/", "/scan", "/binder", "/manifest.webmanifest", "/icon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // Add individually so one missing route doesn't fail the whole install.
      Promise.all(SHELL_URLS.map((u) => cache.add(new Request(u, { cache: "reload" })).catch(() => undefined))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("sos-") && ![SHELL, STATIC, API].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cacheable(res) {
  return res && res.ok && res.type === "basic";
}

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (cacheable(res)) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (cacheable(res)) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function shell(req, event) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req, { ignoreSearch: true });
  const update = fetch(req)
    .then((res) => {
      if (cacheable(res)) cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  const res = await update;
  if (res) return res;
  return (await cache.match("/scan")) || (await cache.match("/")) || new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch POST/PUT/DELETE
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/webpack-hmr") || url.pathname.startsWith("/__nextjs")) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req, API));
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:woff2?|ttf|png|jpg|jpeg|webp|avif|svg|ico)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(shell(req, event));
  }
});
