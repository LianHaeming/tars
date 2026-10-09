// The Words drill: fast multiple choice over the 100 words in words.json, separate from the sentence game. Progress lives
// in state/words.json, every answer is appended to state/words-log.jsonl.
//
// Each word has two memories: read (phonetic → English) from its first showing, say (English → phonetic) once read has
// graduated (it skips the first step: the word is known by then). A memory starts in Anki-style learning steps counted in cards, not minutes: it comes back STEPS[0] cards
// later, then STEPS[1], then STEPS[2]; a miss or "don't know" puts it back to the first step. After the last step it
// graduates to FSRS (the same scheduler as the sentences), which brings it back once predicted recall drops below 90%.
// Every answer also updates FSRS: miss = Again, slow = Hard, else Good. The queue never runs dry: learning cards that
// are due, then slipping reviews, then a new word (while fewer than MAX_LEARNING words are in steps), then the weakest
// words anyway.
const fs = require('fs');
const path = require('path');
const { words: doc, STATE } = require('./state');
const fsrs = require('./fsrs');

const { categories: CATEGORIES, words: WORDS } = JSON.parse(fs.readFileSync(path.join(__dirname, 'words.json'), 'utf8'));
const BY_ID = new Map(WORDS.map(w => [w.id, w]));
const CAT = new Map(CATEGORIES.map(c => [c.key, c.name]));
const LOG = path.join(STATE, 'words-log.jsonl');
const STEPS = [2, 5, 12];
const MAX_LEARNING = 6;
const SLOW_MS = 5000;
const STABLE = 21;
const DAY = 864e5;

const word = id => BY_ID.get(id);
const get = () => {
  const d = doc.get();
  d.seq ||= 0; d.mem ||= {};
  return d;
};
const recallNow = (m, now) => m.s == null ? 0 : fsrs.recall((now - m.last) / DAY, m.s);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function options(w, dir) {
  const text = x => dir === 'read' ? x.english : x.phonetic;
  const clash = x => x.id === w.id || x.phonetic === w.phonetic || x.english === w.english;
  const others = WORDS.filter(x => !clash(x));
  const same = shuffle(others.filter(x => x.cat === w.cat)).slice(0, 2);
  const rest = shuffle(others.filter(x => !same.includes(x))).slice(0, 3 - same.length);
  return shuffle([w, ...same, ...rest]).map(x => ({ id: x.id, text: text(x) }));
}

function card(id, dir, stage) {
  const w = word(id);
  const base = { key: `${id}:${dir}`, id, dir, stage, cat: CAT.get(w.cat) || w.cat };
  if (stage === 'new') return { ...base, phonetic: w.phonetic, english: w.english };
  return { ...base, prompt: dir === 'read' ? w.phonetic : w.english, options: options(w, dir), answer: id, phonetic: w.phonetic, english: w.english };
}

function next(last) {
  const d = get();
  const now = Date.now();
  const all = Object.entries(d.mem).filter(([k]) => word(k.split(':')[0]) && k !== last);
  const learning = all.filter(([, m]) => m.step != null).sort((a, b) => a[1].due - b[1].due);
  const pick = ([k], stage) => { const [id, dir] = k.split(':'); return card(id, dir, stage); };

  const dueStep = learning.find(([, m]) => m.due <= d.seq);
  if (dueStep) return pick(dueStep, 'learning');
  const slipping = all.filter(([, m]) => m.step == null).map(e => [e, recallNow(e[1], now)])
    .filter(([, r]) => r < fsrs.RETENTION).sort((a, b) => a[1] - b[1]);
  if (slipping.length) return pick(slipping[0][0], 'review');
  const fresh = WORDS.find(w => !d.mem[`${w.id}:read`]);
  const inSteps = new Set(Object.entries(d.mem).filter(([, m]) => m.step != null).map(([k]) => k.split(':')[0])).size;
  if (fresh && inSteps < MAX_LEARNING) return card(fresh.id, 'read', 'new');
  if (learning.length) return pick(learning[0], 'learning');
  const weakest = all.map(e => [e, recallNow(e[1], now)]).sort((a, b) => a[1] - b[1]);
  if (weakest.length) return pick(weakest[Math.floor(Math.random() * Math.min(5, weakest.length))][0], 'review');
  return fresh ? card(fresh.id, 'read', 'new') : null;
}

function log(e) { fs.appendFileSync(LOG, JSON.stringify(e) + '\n'); }

// seen(id) — the new-word card was shown: start its read memory at the first learning step.
function seen(id) {
  if (!word(id)) throw new Error('unknown word');
  const d = get();
  const k = `${id}:read`;
  if (!d.mem[k]) d.mem[k] = { s: null, d: null, reps: 0, lapses: 0, step: 0, due: d.seq + STEPS[0], last: null, introduced: Date.now() };
  doc.save();
  return { next: next(k) };
}

// answer({ key, choice: word id | null, ms }) — score a multiple-choice answer and return the next card.
function answer({ key, choice, ms }) {
  const [id, dir] = String(key).split(':');
  if (!word(id) || (dir !== 'read' && dir !== 'say')) throw new Error('unknown card');
  const d = get();
  const now = Date.now();
  const right = choice === id;
  const grade = !right ? 1 : Number(ms) > SLOW_MS ? 2 : 3;
  d.seq += 1;
  const m = d.mem[key] || { s: null, d: null, reps: 0, lapses: 0, step: 0, due: d.seq, last: null };
  const t = m.last ? (now - m.last) / DAY : 0;
  Object.assign(m, fsrs.step(m, grade, t), { last: now, reps: m.reps + 1 });
  if (!right) {
    if (m.step == null) m.lapses += 1;
    m.step = 0; m.due = d.seq + STEPS[0];
  } else if (m.step != null) {
    m.step += 1;
    if (m.step >= STEPS.length) { m.step = null; delete m.due; } else m.due = d.seq + STEPS[m.step];
  }
  d.mem[key] = m;
  const sayKey = `${id}:say`;
  if (dir === 'read' && m.step == null && !d.mem[sayKey]) d.mem[sayKey] = { s: null, d: null, reps: 0, lapses: 0, step: 1, due: d.seq + STEPS[0], last: null };
  doc.save();
  log({ at: now, key, choice: choice ?? null, right, ms: Number(ms) || null, grade });
  return { right, next: next(key) };
}

// status() — counts for the Words tab, and every word with how well it's held.
function status() {
  const d = get();
  const now = Date.now();
  const held = w => {
    const ms = ['read', 'say'].map(k => d.mem[`${w.id}:${k}`]).filter(Boolean);
    if (!ms.length) return 'new';
    if (ms.some(m => m.step != null)) return 'learning';
    if (ms.some(m => recallNow(m, now) < fsrs.RETENTION)) return 'slipping';
    return ms.length === 2 && ms.every(m => m.s >= STABLE) ? 'solid' : 'known';
  };
  const list = WORDS.map(w => ({ id: w.id, cat: CAT.get(w.cat) || w.cat, phonetic: w.phonetic, english: w.english, held: held(w) }));
  const count = h => list.filter(w => w.held === h).length;
  return {
    total: WORDS.length,
    counts: { new: count('new'), learning: count('learning'), slipping: count('slipping'), known: count('known'), solid: count('solid') },
    answers: d.seq,
    words: list,
  };
}

const start = () => ({ next: next() });

module.exports = { start, seen, answer, status, word };
