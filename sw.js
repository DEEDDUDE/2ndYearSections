// Offline shell. Files are cached on install and refreshed network-first, so
// a deploy (or a data fix) shows on the next open; offline falls back to cache. Bump VERSION when shipping code changes so old caches are dropped.
const VERSION = "v8";
const CACHE = `section-picker-${VERSION}`;
const SHELL = [
  "./", "index.html", "app.js", "builder.js", "styles.css", "schedule-data.js",
  "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts: cache what we see so Arabic text survives offline
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  // app code + data: network-first so a deploy shows on the very next open;
  // the cache is the offline fallback
  e.respondWith(caches.open(CACHE).then(async (c) => {
    try {
      const r = await fetch(req, { cache: "no-cache" });
      if (r.ok) c.put(req, r.clone());
      return r;
    } catch {
      return (await c.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? c.match("index.html") : Response.error());
    }
  }));
});
