// Learning Burmese with Lian's boyfriend in mind: a deck of 100 everyday sentences (built once by `claude -p`, bin/burmese),
// practised daily in both directions with simple spaced repetition (Leitner boxes), plus a quick English → Burmese translator.
// Everything lives in data/state/burmese.json so progress follows Lian between devices.
const { burmese } = require('./store');
const { runClaude } = require('./claude');

const NEW_PER_DAY = 3;
const INTERVALS = [1, 2, 4, 7, 14, 30];
const DIRS = ['my', 'en'];
const HISTORY = 40;

const VOICE = `Lian is a man from the UK learning Burmese to talk with his Burmese boyfriend. Use natural, everyday spoken Burmese
(not formal or written style) as a man would say it to his partner: casual and warm, e.g. ငါ (nga) for "I" and မင်း (min) for "you"
between partners (နင် is what women use), unless the sentence is clearly for elders or his partner's family, where you use polite
male forms (ကျွန်တော်, ခင်ဗျာ). Phonetic: a simple, consistent respelling an English speaker can read aloud, syllables joined by
hyphens and words separated by spaces, no IPA and no tone marks (e.g. "min-ga-la-ba", "tha-min sa-pyi-bi-la").`;

const londonDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const addDays = (day, n) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const clean = s => String(s || '').trim();

function doc() {
  const d = burmese.get();
  d.deck ||= []; d.progress ||= {}; d.days ||= {}; d.history ||= [];
  return d;
}

function state() {
  const d = doc();
  return { today: londonDay(), newPerDay: NEW_PER_DAY, deck: d.deck, progress: d.progress, days: d.days, history: d.history };
}

function learn(id) {
  const d = doc();
  if (!d.deck.some(c => c.id === id)) throw new Error('unknown card');
  const today = londonDay();
  if (!d.progress[id]) {
    d.progress[id] = { learnedOn: today, ...Object.fromEntries(DIRS.map(k => [k, { box: 0, due: today }])) };
    burmese.save();
  }
  return state();
}

function review(id, dir, ok) {
  const d = doc();
  const p = d.progress[id];
  if (!p || !DIRS.includes(dir)) throw new Error('unknown card');
  const today = londonDay();
  const box = ok ? Math.min(p[dir].box + 1, INTERVALS.length) : 0;
  p[dir] = { box, due: ok ? addDays(today, INTERVALS[box - 1] ?? 1) : today };
  d.days[today] = (d.days[today] || 0) + 1;
  burmese.save();
  return state();
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
  delete doc().progress[id];
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

module.exports = { state, learn, review, unlearn, translate, save, clearHistory, build };
