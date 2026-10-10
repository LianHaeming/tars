// tars Omarchy server: the only code that writes apps/omarchy/state. Serves /api/omarchy* and the built React app
// (web → dist/). Run: node server  (port 8409)
const path = require('path');
const { send, start } = require('@tars/server');
const drill = require('./drill');

const PORT = process.env.PORT || 8409;
const DIST = path.join(__dirname, '..', 'dist');

async function api(req, res, [resource, rid, ...rest], body) {
  if (resource !== 'omarchy' || rid !== 'drill') return;
  if (req.method === 'GET' && !rest[0]) return send(res, 200, drill.state());
  if (req.method === 'POST' && rest[0] === 'sync') {
    try { return send(res, 200, drill.sync(body)); } catch (e) { return send(res, 400, { error: e.message }); }
  }
}

start({ port: PORT, dist: DIST, api });
