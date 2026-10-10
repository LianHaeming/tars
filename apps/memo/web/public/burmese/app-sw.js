// Tombstone for the worker of the short-lived two-build Memo (2026-10-10), which served burmese from its own build at
// /burmese/: it clears its cache, unregisters and reloads the page, so the one Memo worker at /app-sw.js takes over.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) c.navigate(c.url);
  } catch (err) {}
})()));
