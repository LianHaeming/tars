// Learning Burmese with Lian's boyfriend in mind: a deck of everyday sentences (built once by `claude -p`, bin/burmese),
// scheduled with FSRS like Anki. Each sentence has up to three memories, each with its own schedule: read (phonetic →
// meaning), say (English → Burmese out loud) and hear (audio → meaning, once state/audio/<card id>.<ext> exists).
// Progress lives in state/burmese.json; every answer is also appended to state/reviews.jsonl for the stats.
const fs = require('fs');
const path = require('path');
const { burmese, STATE } = require('./state');
const { runClaude } = require('@tars/server');
const fsrs = require('./fsrs');

const OLD_INTERVALS = [1, 2, 4, 7, 14, 30];
const KINDS = ['read', 'say', 'hear'];
const HISTORY = 40;
const OWNED = 21;
const LEECH = 4;
const SETTINGS = { newPerDay: 3, maxReviews: 60 };
const LOG = path.join(STATE, 'reviews.jsonl');
const AUDIO = path.join(STATE, 'audio');
const AUDIO_TYPES = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };

const VOICE = `Lian is a man from the UK learning Burmese to talk with his Burmese boyfriend. Use natural, everyday spoken Burmese
(not formal or written style) as a man would say it to his partner: casual and warm, e.g. ငါ (nga) for "I" and မင်း (min) for "you"
between partners (နင် is what women use), unless the sentence is clearly for elders or his partner's family, where you use polite
male forms (ကျွန်တော်, ခင်ဗျာ). Phonetic: a simple, consistent respelling an English speaker can read aloud, syllables joined by
hyphens and words separated by spaces, no IPA and no tone marks (e.g. "min-ga-la-ba", "tha-min sa-pyi-bi-la").`;

const londonDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const addDays = (day, n) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
const clean = s => String(s || '').trim();
const newMem = today => ({ s: null, d: null, due: today, last: null, reps: 0, lapses: 0, since: today });

function migrate(d) {
  let changed = false;
  for (const p of Object.values(d.progress)) {
    if (!p.my && !p.en) continue;
    for (const [from, to] of [['my', 'read'], ['en', 'say']]) {
      const b = p[from];
      if (!b) continue;
      const s = OLD_INTERVALS[b.box - 1];
      p[to] = s ? { s, d: 5, due: b.due, last: addDays(b.due, -s), reps: b.box, lapses: 0, since: p.learnedOn }
        : { ...newMem(b.due), since: p.learnedOn };
      delete p[from];
    }
    changed = true;
  }
  return changed;
}

function doc() {
  const d = burmese.get();
  d.deck ||= []; d.progress ||= {}; d.days ||= {}; d.history ||= [];
  d.reviewDays ||= {}; d.owned ||= {}; d.settings = { ...SETTINGS, ...d.settings }; d.xp ||= 0; d.bosses ||= {};
  if (migrate(d)) burmese.save();
  return d;
}

const audioFile = id => {
  try { return fs.readdirSync(AUDIO).find(f => path.parse(f).name === id && AUDIO_TYPES[path.extname(f).toLowerCase()]); } catch { return null; }
};

function audioIds() {
  try { return new Set(fs.readdirSync(AUDIO).filter(f => AUDIO_TYPES[path.extname(f).toLowerCase()]).map(f => path.parse(f).name)); }
  catch { return new Set(); }
}

function audio(id) {
  const f = audioFile(String(id));
  return f ? { file: path.join(AUDIO, f), type: AUDIO_TYPES[path.extname(f).toLowerCase()] } : null;
}

function preview(mem, today) {
  const t = mem.last ? Math.max(0, daysBetween(mem.last, today)) : 0;
  return [1, 2, 3, 4].map(g => fsrs.step(mem, g, t).days);
}

const isOwned = p => !!p?.say && p.say.s != null && p.say.s >= OWNED;

function streak(days, today) {
  const step = day => addDays(day, -1);
  let day = days[today] ? today : step(today), n = 0, i = 0, lastFreeze = -Infinity;
  for (;;) {
    if (days[day]) n++;
    else if (i - lastFreeze >= 7 && days[step(day)]) lastFreeze = i;
    else break;
    day = step(day); i++;
  }
  return n;
}

function state() {
  const d = doc();
  const today = londonDay();
  const withAudio = audioIds();
  let changed = false;
  for (const [id, p] of Object.entries(d.progress)) {
    if (withAudio.has(id) && !p.hear && p.read?.reps) { p.hear = { ...newMem(today), since: p.learnedOn }; changed = true; }
  }
  if (changed) burmese.save();
  const progress = Object.fromEntries(Object.entries(d.progress).map(([id, p]) => [id, {
    ...p,
    ...Object.fromEntries(KINDS.filter(k => p[k]).map(k => [k, { ...p[k], next: preview(p[k], today) }])),
    leech: KINDS.reduce((n, k) => n + (p[k]?.lapses || 0), 0) >= LEECH,
  }]));
  return {
    today, settings: d.settings, newPerDay: d.settings.newPerDay,
    deck: d.deck.map(c => ({ ...c, audio: withAudio.has(c.id) })),
    progress, days: d.days, reviewsToday: d.reviewDays[today] || 0, history: d.history,
    xp: d.xp, streak: streak(d.days, today), owned: Object.values(d.progress).filter(isOwned).length, bosses: d.bosses,
  };
}

function learn(id) {
  const d = doc();
  if (!d.deck.some(c => c.id === id)) throw new Error('unknown card');
  const today = londonDay();
  if (!d.progress[id]) {
    d.progress[id] = { learnedOn: today, read: newMem(today) };
    burmese.save();
  }
  return state();
}

function xpFor(g, t, wasReview) {
  if (g === 1) return 2;
  const base = { 2: 8, 3: 10, 4: 12 }[g];
  return base + (wasReview ? Math.round(5 * Math.log2(1 + t)) : 0);
}

function review(id, kind, grade, { ms, sure, ex } = {}) {
  const d = doc();
  const p = d.progress[id];
  const g = Number(grade);
  if (!p || !KINDS.includes(kind) || !p[kind] || ![1, 2, 3, 4].includes(g)) throw new Error('unknown card');
  const today = londonDay();
  const mem = p[kind];
  const t = mem.last ? Math.max(0, daysBetween(mem.last, today)) : 0;
  const before = { s: mem.s, d: mem.d, due: mem.due };
  const next = fsrs.step(mem, g, t);
  const wasReview = mem.s != null && t > 0;
  Object.assign(mem, { s: next.s, d: next.d, due: addDays(today, next.days), last: today, reps: mem.reps + 1, lapses: mem.lapses + (g === 1 && wasReview ? 1 : 0) });
  if (kind === 'read' && g > 1 && !p.say) p.say = newMem(today);
  const gained = xpFor(g, t, wasReview);
  d.xp += gained;
  d.days[today] = (d.days[today] || 0) + 1;
  if (mem.since !== today) d.reviewDays[today] = (d.reviewDays[today] || 0) + 1;
  d.owned[today] = Object.values(d.progress).filter(isOwned).length;
  burmese.save();
  const line = { at: Date.now(), day: today, id, kind, grade: g, t, ms: Number(ms) || null, sure: sure ?? null, ex: ex || 'flip', xp: gained,
    before, after: { s: mem.s, d: mem.d, due: mem.due } };
  fs.appendFileSync(LOG, JSON.stringify(line) + '\n');
  if (kind === 'say' && mem.s >= 7) fillSwaps().catch(e => console.error('swaps', e.message));
  return { ...state(), gained };
}

function settings(body) {
  const d = doc();
  const int = (v, lo, hi, dflt) => Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : dflt;
  d.settings = { newPerDay: int(body.newPerDay, 0, 20, d.settings.newPerDay), maxReviews: int(body.maxReviews, 10, 500, d.settings.maxReviews) };
  burmese.save();
  return state();
}

function boss(topic) {
  const d = doc();
  if (!d.deck.some(c => c.topic === topic)) throw new Error('unknown topic');
  d.bosses[topic] = londonDay();
  burmese.save();
  return state();
}

function readLog() {
  try { return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; }
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function stats() {
  const d = doc();
  const today = londonDay();
  const log = readLog();
  const since = n => addDays(today, -n);
  const reviews30 = log.filter(r => r.day > since(30) && r.before.s != null && r.t > 0);
  const speed = (from, to) => median(log.filter(r => r.day > from && r.day <= to && r.ms && r.ms < 120e3).map(r => r.ms));
  const mems = Object.values(d.progress).flatMap(p => KINDS.filter(k => p[k]).map(k => p[k]));
  const upcoming = Array.from({ length: 14 }, (_, i) => addDays(today, i))
    .map((day, i) => ({ day, count: mems.filter(m => (i === 0 ? m.due <= day : m.due === day)).length }));
  const byCard = d.deck.filter(c => d.progress[c.id]).map(c => {
    const p = d.progress[c.id];
    return { id: c.id, english: c.english, phonetic: c.phonetic, topic: c.topic, lapses: KINDS.reduce((n, k) => n + (p[k]?.lapses || 0), 0) };
  });
  const topics = [...new Set(d.deck.map(c => c.topic))].map(topic => {
    const cards = d.deck.filter(c => c.topic === topic);
    return { topic, total: cards.length, owned: cards.filter(c => isOwned(d.progress[c.id])).length,
      learned: cards.filter(c => d.progress[c.id]).length, boss: d.bosses[topic] || null };
  });
  return {
    today, days: d.days, owned: d.owned, xp: d.xp, streak: streak(d.days, today), total: log.length,
    retention: reviews30.length ? reviews30.filter(r => r.grade > 1).length / reviews30.length : null, retentionN: reviews30.length,
    speed: { week: speed(since(7), today), before: speed(since(14), since(7)) },
    upcoming, missed: byCard.filter(c => c.lapses).sort((a, b) => b.lapses - a.lapses).slice(0, 5), topics,
    ownedNow: Object.values(d.progress).filter(isOwned).length, deckSize: d.deck.length,
  };
}

function parseJson(out, open, close) {
  const i = out.indexOf(open), j = out.lastIndexOf(close);
  if (i < 0 || j < i) throw new Error('Claude did not return a translation');
  return JSON.parse(out.slice(i, j + 1));
}

const CLAUDE_ARGS = ['--strict-mcp-config', '--disallowedTools', 'Edit', 'Write', 'NotebookEdit', 'Bash', 'WebFetch', 'WebSearch'];

async function translate(text) {
  const english = clean(text).slice(0, 400);
  if (!english) throw new Error('nothing to translate');
  const prompt = `${VOICE}

Translate what Lian wants to say into Burmese: "${english}"

Reply with ONLY JSON, no markdown or code fence:
{"burmese":"Burmese script","phonetic":"respelling","literal":"short word-by-word gloss","note":"one short, useful tip about usage or pronunciation, or empty"}`;
  const r = parseJson(await runClaude(['-p', prompt, '--model', 'opus', ...CLAUDE_ARGS], { timeout: 90e3 }), '{', '}');
  const item = { id: 't' + Date.now(), at: Date.now(), english, burmese: clean(r.burmese), phonetic: clean(r.phonetic), literal: clean(r.literal), note: clean(r.note) };
  if (!item.burmese || !item.phonetic) throw new Error('Claude did not return a translation');
  const d = doc();
  d.history = [item, ...d.history].slice(0, HISTORY);
  burmese.save();
  return item;
}

function save(card) {
  const d = doc();
  const c = { id: 'u' + Date.now(), english: clean(card.english), burmese: clean(card.burmese), phonetic: clean(card.phonetic), note: clean(card.note), topic: 'Mine' };
  if (!c.english || !c.burmese || !c.phonetic) throw new Error('card needs english, burmese and phonetic');
  if (d.deck.some(x => x.english.toLowerCase() === c.english.toLowerCase())) return state();
  const learned = d.deck.findIndex(x => !d.progress[x.id]);
  d.deck.splice(learned < 0 ? d.deck.length : learned, 0, c);
  burmese.save();
  return state();
}

function unlearn(id) {
  const d = doc();
  delete d.progress[id];
  const c = d.deck.find(x => x.id === id);
  if (c) delete c.hook;
  burmese.save();
  return state();
}

function clearHistory() {
  doc().history = [];
  burmese.save();
  return state();
}

async function build(size = 100, log = () => {}) {
  const prompt = `${VOICE}

Write the ${size} most useful, very common sentences for Lian to learn first, ordered from most to least useful, so the first
20 alone already get him through a day with his boyfriend. Short (mostly 2 to 6 English words), things people genuinely say
every day: greetings and check-ins ("Have you eaten?"), affection, missing each other, food, plans and time, how he feels,
simple questions and answers, sorry/thank you/no worries, a little teasing, goodnight and good morning, and around 10 polite
phrases for meeting his boyfriend's family and friends. No textbook or tourist sentences, no duplicates.

Reply with ONLY a JSON array, no markdown or code fence, each item exactly:
{"english":"...","burmese":"Burmese script","phonetic":"respelling","note":"one short line: literal meaning, when to use it, or a pronunciation tip","topic":"one or two words"}`;
  const items = parseJson(await runClaude(['-p', prompt, '--model', 'opus', ...CLAUDE_ARGS], { timeout: 600e3 }), '[', ']')
    .map(o => ({ english: clean(o.english), burmese: clean(o.burmese), phonetic: clean(o.phonetic), note: clean(o.note), topic: clean(o.topic) }))
    .filter(o => o.english && o.burmese && o.phonetic);
  const d = doc();
  const mine = d.deck.filter(c => c.id.startsWith('u'));
  d.deck = [...items.slice(0, size).map((o, i) => ({ id: 'c' + (i + 1), ...o })), ...mine];
  for (const id of Object.keys(d.progress)) if (id.startsWith('c')) delete d.progress[id];
  burmese.save();
  log(`deck now ${d.deck.length} sentences`);
  return d.deck.length;
}

async function hook(id) {
  const d = doc();
  const c = d.deck.find(x => x.id === id);
  if (!c) throw new Error('unknown card');
  const prompt = `Lian keeps forgetting this Burmese sentence: "${c.phonetic}" (${c.burmese}) = "${c.english}".
Write ONE memory hook for an English speaker: link the sound of the hardest part of the phonetic to an English sound-alike
in a vivid, silly, slightly absurd mental image that also carries the meaning. Max 2 short sentences, no preamble.
Reply with ONLY JSON, no markdown or code fence: {"hook":"..."}`;
  const r = parseJson(await runClaude(['-p', prompt, '--model', 'opus', ...CLAUDE_ARGS], { timeout: 90e3 }), '{', '}');
  const text = clean(r.hook);
  if (!text) throw new Error('Claude did not return a hook');
  doc().deck.find(x => x.id === id).hook = text;
  burmese.save();
  return state();
}

let swapping = false;

async function fillSwaps() {
  if (swapping) return;
  const d = doc();
  const want = d.deck.filter(c => !c.swaps && d.progress[c.id]?.say?.s >= 7).slice(0, 8);
  if (!want.length) return;
  swapping = true;
  try {
    const list = want.map(c => `${c.id}: "${c.english}" = ${c.burmese} (${c.phonetic})`).join('\n');
    const prompt = `${VOICE}

For each sentence below, write 3 variations that change exactly ONE slot (a noun, verb, time, person or adjective) so Lian
practises the same pattern with one new thing. Keep the rest of the sentence identical, natural and everyday.

${list}

Reply with ONLY JSON, no markdown or code fence: {"<id>":[{"english":"...","burmese":"...","phonetic":"...","changed":"the new English word(s)"}], ...}`;
    const r = parseJson(await runClaude(['-p', prompt, '--model', 'opus', ...CLAUDE_ARGS], { timeout: 240e3 }), '{', '}');
    const fresh = doc();
    for (const c of want) {
      const v = (Array.isArray(r[c.id]) ? r[c.id] : [])
        .map(o => ({ english: clean(o.english), burmese: clean(o.burmese), phonetic: clean(o.phonetic), changed: clean(o.changed) }))
        .filter(o => o.english && o.burmese && o.phonetic);
      const card = fresh.deck.find(x => x.id === c.id);
      if (card && v.length) card.swaps = v.slice(0, 3);
    }
    burmese.save();
  } finally { swapping = false; }
}

module.exports = { state, learn, review, unlearn, translate, save, clearHistory, build, settings, boss, stats, hook, audio, fillSwaps };
