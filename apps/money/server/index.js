// tars Money server: read-only Monzo (via bin/monzo) plus the only code that reads or writes apps/money/state.
// Serves /api/money[/fresh|summary|summary-fresh], /api/expected (also used by the tasks app) and the built React app.
// Run: node server  (port 8407)
const path = require('path');
const { send, start } = require('@tars/server');
const { money, expected, summary } = require('./money');

const PORT = process.env.PORT || 8407;
const DIST = path.join(__dirname, '..', 'dist');

async function api(req, res, [resource, rid]) {
  if (req.method !== 'GET') return;
  if (resource === 'money') {
    try { return send(res, 200, rid === 'summary' ? await summary(false) : rid === 'summary-fresh' ? await summary(true) : await money(rid === 'fresh')); }
    catch (e) { return send(res, 503, { error: e.message }); }
  }
  if (resource === 'expected') {
    try { return send(res, 200, await expected()); }
    catch (e) { return send(res, 503, { error: e.message }); }
  }
}

start({ port: PORT, dist: DIST, api });
