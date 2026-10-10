// The memorisation game. Each sentence has two memories, each scheduled by FSRS: read (phonetic → English) from its first
// answer, say (English → phonetic) once read has scored Good. A unit = "Last time" (up to 8 memories predicted below 90%
// recall, most at risk first) + "New" (the next 3 sentences in usefulness order, only while ≤ 15 memories are at risk).
// Progress lives in state/burmese.json; every answer is appended to state/reviews.jsonl.
const fs = require('fs');
const path = require('path');
const { burmese, STATE } = require('./state');
const content = require('./content');
const fsrs = require('./fsrs');
const score = require('./score');

const REVIEWS = 8;
const NEW = 3;
const MAX_AT_RISK = 15;
const STABLE = 21;
const DAY = 864e5;
const LOG = path.join(STATE, 'reviews.jsonl');

const doc = () => {
  const d = burmese.get();
  d.memories ||= {}; d.custom ||= []; d.units ||= 0;
  return d;
};
const mkey = (id, kind) => `${id}:${kind}`;
const recallNow = (m, now) => m.s == null ? 0 : fsrs.recall((now - m.last) / DAY, m.s);

function atRisk(now = Date.now()) {
  const { memories } = doc();
  return Object.entries(memories)
    .map(([k, m]) => { const [id, kind] = k.split(':'); return { id, kind, r: recallNow(m, now) }; })
    .filter(x => x.r < fsrs.RETENTION && content.sentence(x.id))
    .sort((a, b) => a.r - b.r);
}

function nextNew(n) {
  const { memories } = doc();
  return content.pool().sentences.filter(s => !memories[mkey(s.id, 'read')]).slice(0, n);
}

function status() {
  const risk = atRisk();
  const left = nextNew(Infinity).length;
  return {
    slipping: risk.length,
    newReady: risk.length <= MAX_AT_RISK ? Math.min(NEW, left) : 0,
    left,
    pool: content.pool().sentences.length,
  };
}

const card = s => ({ id: s.id, cat: s.cat, english: s.english, phonetic: s.phonetic, words: s.words || [] });

function unit() {
  const d = doc();
  const risk = atRisk();
  const picked = new Set();
  const review = [];
  for (const x of risk) {
    if (review.length >= REVIEWS) break;
    if (picked.has(x.id)) continue;
    picked.add(x.id);
    review.push({ ...card(content.sentence(x.id)), kind: x.kind });
  }
  const fresh = risk.length <= MAX_AT_RISK ? nextNew(NEW).map(card) : [];
  d.units += 1;
  burmese.save();
  return { unit: d.units, review, new: fresh, left: nextNew(Infinity).length };
}

async function answer({ unit: u, id, kind, answer: text, phase }) {
  const s = content.sentence(id);
  if (!s) throw new Error('unknown sentence');
  if (kind !== 'read' && kind !== 'say') throw new Error('kind must be read or say');
  const typed = String(text ?? '').trim().slice(0, 300);
  const pct = typed ? kind === 'read' ? await score.meaning(typed, s.english) : score.phonetic(typed, s.phonetic) : null;
  const g = score.grade(pct);
  const now = Date.now();
  const d = doc();
  const k = mkey(id, kind);
  const m = d.memories[k] || { s: null, d: null, reps: 0, lapses: 0, best: 0 };
  const t = m.last ? (now - m.last) / DAY : 0;
  const next = fsrs.step(m, g, t);
  d.memories[k] = {
    ...m, ...next, last: now, reps: m.reps + 1, lapses: m.lapses + (g === 1 && m.s != null ? 1 : 0),
    lastScore: pct ?? 0, best: Math.max(m.best || 0, pct ?? 0),
  };
  if (kind === 'read' && g >= 3 && !d.memories[mkey(id, 'say')]) d.memories[mkey(id, 'say')] = { s: null, d: null, reps: 0, lapses: 0, best: 0, unlocked: now };
  burmese.save();
  fs.appendFileSync(LOG, JSON.stringify({ at: now, unit: u, id, kind, phase, answer: typed || null, score: pct, grade: g }) + '\n');
  return { score: pct, grade: g, english: s.english, phonetic: s.phonetic, words: s.words || [] };
}

function log() {
  try { return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; }
}

function stats() {
  const now = Date.now();
  const { memories } = doc();
  const { sentences, categories } = content.pool();
  const mem = (id, kind) => {
    const m = memories[mkey(id, kind)];
    return m && { r: recallNow(m, now), s: m.s, d: m.d, last: m.last ?? null, lastScore: m.lastScore ?? null, best: m.best ?? 0, reps: m.reps, lapses: m.lapses };
  };
  const rows = sentences.filter(s => memories[mkey(s.id, 'read')]).map(s => {
    const read = mem(s.id, 'read'), say = mem(s.id, 'say');
    const stable = read?.s >= STABLE && say?.s >= STABLE;
    return { id: s.id, cat: s.cat, english: s.english, phonetic: s.phonetic, read, say, state: stable ? 'stable' : 'learning' };
  });
  const seen = Object.values(memories).filter(m => m.s != null);
  const byUnit = new Map();
  for (const e of log()) {
    const u = byUnit.get(e.unit) || { unit: e.unit, n: 0, sum: 0 };
    u.n += 1; u.sum += e.score ?? 0;
    byUnit.set(e.unit, u);
  }
  return {
    counts: {
      new: sentences.length - rows.length,
      learning: rows.filter(r => r.state === 'learning').length,
      stable: rows.filter(r => r.state === 'stable').length,
    },
    recall: seen.length ? seen.reduce((a, m) => a + recallNow(m, now), 0) / seen.length : null,
    atRisk: atRisk(now).length,
    answers: log().length,
    trend: [...byUnit.values()].sort((a, b) => a.unit - b.unit).slice(-30).map(u => ({ unit: u.unit, avg: Math.round(u.sum / u.n), n: u.n })),
    rows,
    categories,
  };
}

function sentences() {
  const { categories, sentences: all } = content.pool();
  const lists = categories.map(c => ({
    key: c.key, name: c.name,
    sentences: all.filter(s => s.cat === c.key).sort((a, b) => a.slot - b.slot).map(s => ({ id: s.id, english: s.english, phonetic: s.phonetic })),
  }));
  const custom = doc().custom.map(c => ({ id: c.id, english: c.english, phonetic: c.phonetic }));
  return [...lists, { key: 'custom', name: 'Custom', sentences: custom }];
}

async function ask(text) {
  const r = await content.translate(text);
  const item = { id: 'x' + Date.now(), at: Date.now(), asked: String(text).trim().slice(0, 400), ...r };
  const d = doc();
  d.custom = [item, ...d.custom];
  burmese.save();
  return item;
}

const asked = () => doc().custom;

// cards() — every sentence started so far, newest first: the full card plus how well it's held (slipping = a memory
// predicted below 90% recall, solid = both memories stable).
function cards() {
  const now = Date.now();
  const { memories } = doc();
  const first = new Map();
  for (const e of log()) if (!first.has(e.id)) first.set(e.id, e.at);
  const { sentences, categories } = content.pool();
  return sentences.filter(s => memories[mkey(s.id, 'read')]).map(s => {
    const ms = ['read', 'say'].map(k => memories[mkey(s.id, k)]).filter(m => m && m.s != null);
    const held = ms.some(m => recallNow(m, now) < fsrs.RETENTION) ? 'slipping'
      : ms.length === 2 && ms.every(m => m.s >= STABLE) ? 'solid' : 'learning';
    return { ...card(s), catName: categories.find(c => c.key === s.cat)?.name ?? s.cat, held, learned: first.get(s.id) ?? memories[mkey(s.id, 'read')].last ?? 0 };
  }).sort((a, b) => b.learned - a.learned);
}

// The Burmese script for a pool sentence or an Ask translation, for its audio.
const scriptOf = id => (content.sentence(id) || doc().custom.find(c => c.id === id))?.burmese;

module.exports = { status, unit, answer, stats, sentences, ask, asked, cards, scriptOf };
