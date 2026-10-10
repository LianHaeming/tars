// Burmese's API (/api/burmese*), served by the Memo server. The only code that writes state/burmese (sentences.json is
// written by bin/burmese and only read here).
const fs = require('fs');
const { send } = require('@tars/server');
const game = require('./game');
const score = require('./score');
const tts = require('./tts');
const words = require('./words');

// GET /api/burmese/audio/<sentence or word id>?speed=slow — the spoken Burmese as MP3 (made on first play, a few seconds).
async function audio(req, res, id) {
  const text = words.word(id)?.burmese || game.scriptOf(id);
  if (!text) return send(res, 404, { error: 'no Burmese for that sentence' });
  const speed = new URL(req.url, 'http://x').searchParams.get('speed') === 'slow' ? 'slow' : 'normal';
  let file;
  try { file = await tts.clip(text, speed); } catch (e) { return send(res, 503, { error: e.message }); }
  const buf = fs.readFileSync(file);
  const head = { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes', 'cache-control': 'no-cache' };
  const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');  // Safari plays media only over byte ranges
  if (!r) { res.writeHead(200, { ...head, 'content-length': buf.length }); return res.end(buf); }
  const end = r[1] === '' ? buf.length - 1 : Math.min(r[2] === '' ? buf.length - 1 : +r[2], buf.length - 1);
  const from = r[1] === '' ? Math.max(0, buf.length - +r[2]) : +r[1];
  if (from > end) { res.writeHead(416, { 'content-range': `bytes */${buf.length}` }); return res.end(); }
  res.writeHead(206, { ...head, 'content-length': end - from + 1, 'content-range': `bytes ${from}-${end}/${buf.length}` });
  res.end(buf.subarray(from, end + 1));
}

async function api(req, res, [resource, rid, ...rest], body) {
  if (resource !== 'burmese') return;
  if (req.method === 'GET') {
    if (!rid) return send(res, 200, game.status());
    if (rid === 'unit') return send(res, 200, game.unit());
    if (rid === 'stats') return send(res, 200, game.stats());
    if (rid === 'sentences') return send(res, 200, game.sentences());
    if (rid === 'asked') return send(res, 200, game.asked());
    if (rid === 'cards') return send(res, 200, game.cards());
    if (rid === 'audio') return audio(req, res, rest[0]);
    if (rid === 'words' && !rest[0]) return send(res, 200, words.state());
  }
  if (req.method === 'POST') {
    try {
      if (rid === 'answer') return send(res, 200, await game.answer(body));
      if (rid === 'ask') return send(res, 200, await game.ask(body.text));
      if (rid === 'words' && rest[0] === 'sync') return send(res, 200, words.sync(body));
    } catch (e) { return send(res, rid === 'ask' ? 502 : 400, { error: e.message }); }
  }
}

module.exports = { api, warm: score.warm };
