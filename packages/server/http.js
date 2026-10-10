// The HTTP plumbing every tars app shares: JSON replies and bodies, the built React app (any page path gets
// index.html), extra static folders, and the /sw.js tombstone. An app supplies only its api(req, res, parts).
const http = require('http');
const fs = require('fs');
const path = require('path');

class BadRequest extends Error {}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 1e6) { req.destroy(); reject(new BadRequest('body too large')); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new BadRequest('invalid JSON body')); } });
    req.on('error', reject);
  });
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

const KILL_SW = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) c.navigate(c.url);
  } catch (err) {}
})()));
`;

function serve(res, file, cache) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': cache });
    res.end(buf);
  });
}

function inside(base, rel) {
  const file = path.join(base, path.normalize(rel));
  return file.startsWith(base + path.sep) ? file : null;
}

// start({ port, dist, api, statics: [{ prefix: '/data/food/', dir, cache }, { prefix: '/burmese/', dir, spa: true }] })
// (spa: a built React app under a sub-path — page paths get its index.html) — listens on 127.0.0.1 only; Tailscale serves it.
function start({ port, dist, api, statics = [] }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const rel = decodeURIComponent(url.pathname);
    if (rel.startsWith('/api/')) {
      try {
        const parts = rel.slice(5).split('/');
        const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};
        await api(req, res, parts, body);
        if (!res.headersSent) send(res, 404, { error: 'not found' });
        return;
      } catch (e) {
        if (res.headersSent || res.writableEnded) return res.end();
        if (e instanceof BadRequest) return send(res, 400, { error: e.message });
        console.error('API error', req.method, rel, e);
        return send(res, 500, { error: 'server error' });
      }
    }
    for (const s of statics) {
      if (!rel.startsWith(s.prefix)) continue;
      const sub = rel.slice(s.prefix.length - 1);
      const file = inside(s.dir, sub);
      if (!file) return send(res, 403, { error: 'forbidden' });
      if (!s.spa) return serve(res, file, s.cache || 'public, max-age=3600');
      if (!path.extname(sub)) return serve(res, path.join(s.dir, 'index.html'), 'no-cache');
      return serve(res, file, sub.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    }
    if (rel === '/sw.js') {
      res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-cache', 'service-worker-allowed': '/' });
      return res.end(KILL_SW);
    }
    const file = inside(dist, rel);
    if (file && path.extname(rel)) return serve(res, file, rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    serve(res, path.join(dist, 'index.html'), 'no-cache');
  }).listen(port, '127.0.0.1', () => console.log('Listening on :' + port));
}

module.exports = { BadRequest, send, start };
