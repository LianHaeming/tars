// tars Memo server: one home for the memorisation apps. Serves the landing page (web → dist/), the Burmese and Omarchy
// apps built under /burmese/ and /omarchy/ (build.sh), and passes their /api calls to the burmese and omarchy servers,
// which still own all their data. Run: node server  (port 8410)
const path = require('path');
const { appPort, send, start } = require('@tars/server');

const PORT = process.env.PORT || 8410;
const DIST = path.join(__dirname, '..', 'dist');
const APPS = ['burmese', 'omarchy'];
const PASS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];

async function api(req, res, [resource], body) {
  if (!APPS.includes(resource)) return;
  const headers = {};
  if (req.headers.range) headers.range = req.headers.range;
  const hasBody = ['POST', 'PATCH', 'PUT'].includes(req.method);
  if (hasBody) headers['content-type'] = 'application/json';
  let r;
  try {
    r = await fetch(`http://127.0.0.1:${appPort(resource)}${req.url}`, {
      method: req.method, headers, body: hasBody ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(120e3),
    });
  } catch (e) {
    return send(res, 502, { error: `the ${resource} app isn't answering (${e.cause?.code || e.name})` });
  }
  res.writeHead(r.status, Object.fromEntries(PASS.filter(h => r.headers.has(h)).map(h => [h, r.headers.get(h)])));
  res.end(Buffer.from(await r.arrayBuffer()));
}

start({ port: PORT, dist: DIST, api, statics: APPS.map(a => ({ prefix: `/${a}/`, dir: path.join(DIST, a), spa: true })) });
