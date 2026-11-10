/* Pocket Studio service worker: app shell cached for offline start, API always network-first. */
const VERSION = 'studio-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Live-sync stream, API, previews and published sites are never served from the cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/preview/') || url.pathname.startsWith('/sites/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then((res) => cachePut(req, res)).catch(() => caches.match('/')));
    return;
  }
  // Hashed build assets: cache-first. Everything else: network-first with cache fallback.
  const hashed = /\/assets\/.*-[A-Za-z0-9_-]{8}\.(js|css)$/.test(url.pathname);
  event.respondWith(
    hashed
      ? caches.match(req).then((hit) => hit || fetch(req).then((res) => cachePut(req, res)))
      : fetch(req).then((res) => cachePut(req, res)).catch(() => caches.match(req)),
  );
});

function cachePut(req, res) {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copy));
  }
  return res;
}
