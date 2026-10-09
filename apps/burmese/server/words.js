// The Words drill, server side. The game itself runs on the phone (shared/words.ts, so it works offline on the Tube);
// the server keeps the merged progress in state/words.json, appends every answer the phone sends to
// state/words-log.jsonl, and serves the words' audio by id.
const fs = require('fs');
const path = require('path');
const { words: doc, STATE } = require('./state');
const { engine, merge } = require('../shared/words.ts');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '../shared/words.json'), 'utf8'));
const eng = engine(DATA);
const LOG = path.join(STATE, 'words-log.jsonl');

const get = () => {
  const d = doc.get();
  d.seq ||= 0; d.mem ||= {};
  return d;
};

// sync({ state, log }) — merge the phone's progress in, keep its new answers, and hand back the merged progress.
function sync({ state, log } = {}) {
  const d = get();
  if (state && typeof state === 'object' && state.mem && typeof state.mem === 'object') {
    const m = merge(d, state);
    d.seq = m.seq; d.mem = m.mem;
    doc.save();
  }
  const entries = Array.isArray(log) ? log.filter(e => e && typeof e.key === 'string').slice(0, 5000) : [];
  if (entries.length) fs.appendFileSync(LOG, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
  return { state: { seq: d.seq, mem: d.mem } };
}

const state = () => ({ state: { seq: get().seq, mem: get().mem } });

module.exports = { sync, state, status: () => eng.status(get()), word: eng.word };
