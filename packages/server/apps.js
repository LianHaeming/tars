// Server-to-server calls between tars apps, over 127.0.0.1. An app's port comes from its apps/<app>/app.json
// (TARS_PORT_<APP> overrides it, for trying apps side by side on spare ports). Errors carry the owner's message.
const fs = require('fs');
const path = require('path');
const { TARS } = require('./claude');

function port(app) {
  const override = process.env['TARS_PORT_' + app.toUpperCase()];
  if (override) return override;
  return JSON.parse(fs.readFileSync(path.join(TARS, 'apps', app, 'app.json'), 'utf8')).port;
}

async function callApp(app, method, url, body, { timeout = 90e3 } = {}) {
  const r = await fetch(`http://127.0.0.1:${port(app)}/api/${url}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  }).catch(e => { throw new Error(`the ${app} app isn't answering (${e.cause?.code || e.name})`); });
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(data?.error || `${app} answered ${r.status}`), { status: r.status });
  return data;
}

module.exports = { callApp, appPort: port };
