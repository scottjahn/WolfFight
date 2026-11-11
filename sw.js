// Wolf Fight service worker: precaches everything the game needs so it runs fully offline.
// Bump VERSION whenever a cached file changes so installed copies pick up the update.
const VERSION = 'v1';
const CACHE = 'wolf-fight-' + VERSION;
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  THREE_URL,
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('wolf-fight-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  return (await cache.match(request, { ignoreSearch: true })) || (request.mode === 'navigate' ? cache.match('./') : undefined);
}

// Our own files: try the network briefly so updates arrive, fall back to the cache when offline or slow.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3500);
    const res = await fetch(request, { signal: ctl.signal });
    clearTimeout(timer);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    return (await fromCache(request)) || Response.error();
  }
}

// Versioned third-party files never change: serve from cache, fetch only if missing.
async function cacheFirst(request) {
  const hit = await fromCache(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) (await caches.open(CACHE)).put(request, res.clone());
  return res;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(req));
  else if (url.href === THREE_URL) event.respondWith(cacheFirst(req));
});
