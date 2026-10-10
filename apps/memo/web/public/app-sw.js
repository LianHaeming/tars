// Offline copy of Memo's landing page, so it opens with no signal (Burmese and Omarchy have their own workers, scoped
// to /burmese/ and /omarchy/). Only the landing page itself is handled here. Not /sw.js: that address is the shared
// self-unregistering tombstone for the old PWA plugin.
const CACHE = 'memo-offline-v1';
const SHELL = '/';
const TIMEOUT_MS = 3000;

async function saveShell(res) {
  const cache = await caches.open(CACHE);
  const html = await res.clone().text();
  await cache.put(SHELL, res.clone());
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
  for (const url of assets) if (!(await cache.match(url))) await cache.add(url).catch(() => {});
  for (const css of assets.filter(u => u.endsWith('.css'))) {
    const text = await (await cache.match(css))?.text() || '';
    for (const m of text.matchAll(/url\((\/assets\/[^)]+\.woff2)\)/g)) if (!(await cache.match(m[1]))) await cache.add(m[1]).catch(() => {});
  }
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (/^\/assets\/.+\.(js|css)$/.test(path) && !assets.includes(path)) await cache.delete(req);
  }
}

self.addEventListener('install', e => e.waitUntil((async () => {
  const res = await fetch(SHELL, { cache: 'no-store' });
  if (res.ok) await saveShell(res);
  await self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('memo-offline')) await caches.delete(k);
  await self.clients.claim();
})()));

function withTimeout(p) {
  return Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    if (url.pathname !== '/') return;
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
  if (url.pathname.startsWith('/assets/') || /^\/[^/]+\.(png|webmanifest)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { const cache = await caches.open(CACHE); await cache.put(req, res.clone()); }
      return res;
    })());
  }
});
