// tars WhatsApp server: a read-only view over apps/whatsapp/state/whatsapp.json, which the bridge (apps/whatsapp/bridge,
// the tars-whatsapp service) owns and writes. Serves /api/whatsapp[/:id] and the built React app. Run: node server  (port 8406)
const path = require('path');
const { send, start } = require('@tars/server');
const whatsapp = require('./whatsapp');

const PORT = process.env.PORT || 8406;
const DIST = path.join(__dirname, '..', 'dist');

async function api(req, res, [resource, rid]) {
  if (resource !== 'whatsapp' || req.method !== 'GET') return;
  if (!rid) return send(res, 200, whatsapp.list());
  const t = whatsapp.thread(rid);
  return t ? send(res, 200, t) : send(res, 404, { error: 'not found' });
}

start({ port: PORT, dist: DIST, api });
