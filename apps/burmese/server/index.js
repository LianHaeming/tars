// tars Burmese server: the only code that writes apps/burmese/state (sentences.json is written by bin/burmese and only
// read here). Serves /api/burmese* and the built React app (web → dist/). Run: node server  (port 8404)
const path = require('path');
const { send, start } = require('@tars/server');
const game = require('./game');
const score = require('./score');

const PORT = process.env.PORT || 8404;
const DIST = path.join(__dirname, '..', 'dist');

async function api(req, res, [resource, rid], body) {
  if (resource !== 'burmese') return;
  if (req.method === 'GET') {
    if (!rid) return send(res, 200, game.status());
    if (rid === 'unit') return send(res, 200, game.unit());
    if (rid === 'stats') return send(res, 200, game.stats());
    if (rid === 'sentences') return send(res, 200, game.sentences());
    if (rid === 'asked') return send(res, 200, game.asked());
  }
  if (req.method === 'POST') {
    try {
      if (rid === 'answer') return send(res, 200, await game.answer(body));
      if (rid === 'ask') return send(res, 200, await game.ask(body.text));
    } catch (e) { return send(res, rid === 'ask' ? 502 : 400, { error: e.message }); }
  }
}

start({ port: PORT, dist: DIST, api });
score.warm();
