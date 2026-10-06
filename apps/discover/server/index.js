// tars Discover server: the only code that reads or writes apps/discover/state. Serves /api/discover[/fresh] and the
// built React app (web → dist/). Run: node server  (port 8405)
const path = require('path');
const { send, start } = require('@tars/server');
const { discover } = require('./discover');

const PORT = process.env.PORT || 8405;
const DIST = path.join(__dirname, '..', 'dist');

async function api(req, res, [resource, rid]) {
  if (resource !== 'discover' || req.method !== 'GET') return;
  try { return send(res, 200, await discover(rid === 'fresh')); }
  catch (e) { return send(res, 503, { error: e.message }); }
}

start({ port: PORT, dist: DIST, api });
