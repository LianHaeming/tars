// Omarchy's API (/api/omarchy/drill*), served by the Memo server. The only code that writes state/omarchy.
const { send } = require('@tars/server');
const drill = require('./drill');

async function api(req, res, [resource, rid, ...rest], body) {
  if (resource !== 'omarchy' || rid !== 'drill') return;
  if (req.method === 'GET' && !rest[0]) return send(res, 200, drill.state());
  if (req.method === 'POST' && rest[0] === 'sync') {
    try { return send(res, 200, drill.sync(body)); } catch (e) { return send(res, 400, { error: e.message }); }
  }
}

module.exports = { api };
