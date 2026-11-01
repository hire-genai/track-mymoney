// Track-MyMoney service worker.
// SECURITY: this is a financial app. We only ever cache public, non-sensitive
// static assets. We never store API responses, dashboard HTML, or anything a
// signed-in user would see — because another user on the same device could
// then read it from the cache. Everything else is network-only.

const VERSION = 'tmm-v1';
const SHELL_CACHE = `${VERSION}-shell`;

// Only these resources are allowed in the cache.
const SHELL_ASSETS = [
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
  '/apple-touch-icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  // Activate the new SW immediately on next load; combined with the client-side
  // controllerchange listener this delivers updates without stale windows.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept cross-origin requests.
  if (url.origin !== self.location.origin) return;

  // HARD DENY-LIST: anything that could carry user data.
  // These are network-only, no cache touched at all.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/login') ||
    url.pathname === '/'
  ) {
    return; // let the browser handle it directly
  }

  // Static Next build assets: cache-first (immutable hashed filenames).
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Known public shell files: cache-first with background refresh.
  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Everything else: network-only. We deliberately do NOT cache unknown
  // resources — refusing by default is the safest posture for a finance app.
});

async function cacheFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') {
    cache.put(req, res.clone()).catch(() => {});
  }
  return res;
}
