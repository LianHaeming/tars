// tars Burmese server: the only code that reads or writes apps/burmese/state. Serves /api/burmese* and the built
// React app (web → dist/). Run: node server  (port 8404)
const fs = require('fs');
const path = require('path');
const { send, start } = require('@tars/server');
const burmese = require('./burmese');
const phrases = require('./phrases');

const PORT = process.env.PORT || 8404;
const DIST = path.join(__dirname, '..', 'dist');

async function api(req, res, [resource, rid, sub], body) {
  if (resource !== 'burmese') return;
  if (req.method === 'GET' && !rid) return send(res, 200, burmese.state());
  if (req.method === 'GET' && rid === 'phrases') return send(res, 200, phrases.all());
  if (req.method === 'GET' && rid === 'stats') return send(res, 200, burmese.stats());
  if (req.method === 'GET' && rid === 'audio') {
    const a = burmese.audio(sub);
    if (!a) return send(res, 404, { error: 'no audio' });
    res.writeHead(200, { 'content-type': a.type, 'cache-control': 'public, max-age=3600' });
    return fs.createReadStream(a.file).pipe(res);
  }
  if (req.method === 'POST' && rid === 'phrase') return send(res, 200, phrases.advance());
  if (req.method === 'DELETE' && rid === 'history') return send(res, 200, burmese.clearHistory());
  if (req.method === 'POST') {
    try {
      if (rid === 'learn') return send(res, 200, burmese.learn(body.id));
      if (rid === 'review') return send(res, 200, burmese.review(body.id, body.kind, body.grade, body));
      if (rid === 'settings') return send(res, 200, burmese.settings(body));
      if (rid === 'boss') return send(res, 200, burmese.boss(body.topic));
      if (rid === 'hook') return send(res, 200, await burmese.hook(body.id));
      if (rid === 'unlearn') return send(res, 200, burmese.unlearn(body.id));
      if (rid === 'save') return send(res, 200, burmese.save(body));
      if (rid === 'translate') return send(res, 200, await burmese.translate(body.text));
    } catch (e) { return send(res, rid === 'translate' || rid === 'hook' ? 502 : 400, { error: e.message }); }
  }
}

start({ port: PORT, dist: DIST, api });
