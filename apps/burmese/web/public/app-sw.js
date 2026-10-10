// Offline copy of the Burmese app, so the Words drill opens with no signal (its progress lives on the phone; see
// wordsStore.ts). Not /sw.js: that address is the shared self-unregistering tombstone for the old PWA plugin.
// Pages: network first (fresh build whenever there's signal), the saved shell when the network fails or stalls.
// Built assets (assets/*, hashed names) and icons: cache first. /api is never cached. Works at / or under a
// sub-path (the Memo app serves this app at /burmese/): everything is relative to the worker's scope.
const CACHE = 'burmese-offline-v1';
const BASE = new URL(self.registration.scope).pathname;
const SHELL = BASE;
const TIMEOUT_MS = 3000;

async function saveShell(res) {
  const cache = await caches.open(CACHE);
  const html = await res.clone().text();
  await cache.put(SHELL, res.clone());
  const assets = [...html.matchAll(new RegExp(`(?:src|href)="(${BASE}assets/[^"]+)"`, 'g'))].map(m => m[1]);
  for (const url of assets) if (!(await cache.match(url))) await cache.add(url).catch(() => {});
  for (const css of assets.filter(u => u.endsWith('.css'))) {
    const text = await (await cache.match(css))?.text() || '';
    for (const m of text.matchAll(new RegExp(`url\\((${BASE}assets/[^)]+\\.woff2)\\)`, 'g'))) if (!(await cache.match(m[1]))) await cache.add(m[1]).catch(() => {});
  }
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith(BASE + 'assets/') && /\.(js|css)$/.test(path) && !assets.includes(path)) await cache.delete(req);
  }
}

self.addEventListener('install', e => e.waitUntil((async () => {
  const res = await fetch(SHELL, { cache: 'no-store' });
  if (res.ok) await saveShell(res);
  await self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE && k.startsWith(CACHE.split('-v')[0])) await caches.delete(k);
  await self.clients.claim();
})()));

function withTimeout(p) {
  return Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await withTimeout(fetch(req, { cache: 'no-store' }));
        if (res.ok) e.waitUntil(saveShell(res.clone()));
        return res;
      } catch {
        return (await caches.match(SHELL)) || Response.error();
      }
    })());
    return;
  }
  if (url.pathname.startsWith(BASE + 'assets/') || /\.(png|webmanifest)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { const cache = await caches.open(CACHE); await cache.put(req, res.clone()); }
      return res;
    })());
  }
});
