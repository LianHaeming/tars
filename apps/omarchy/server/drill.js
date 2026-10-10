// The Omarchy drill, server side. The game itself runs on the phone (shared/drill.ts, so it works offline); the server
// keeps the merged progress in state/drill.json and appends every answer the phone sends to state/drill-log.jsonl.
const fs = require('fs');
const path = require('path');
const { drill: doc, STATE } = require('./state');
const { merge } = require('../shared/drill.ts');

const LOG = path.join(STATE, 'drill-log.jsonl');

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

module.exports = { sync, state: () => ({ state: { seq: get().seq, mem: get().mem } }) };
