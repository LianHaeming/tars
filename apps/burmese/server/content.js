// The sentence pool: state/sentences.json, written by `bin/burmese build` (Claude, following phonetics.md) and only read
// here — it's reloaded whenever the file changes, so tars can add or edit sentences while the app runs.
const fs = require('fs');
const path = require('path');
const { runClaude } = require('@tars/server');
const { STATE } = require('./state');

const FILE = path.join(STATE, 'sentences.json');
const GUIDE = fs.readFileSync(path.join(__dirname, 'phonetics.md'), 'utf8');
const CLAUDE_ARGS = ['--strict-mcp-config', '--disallowedTools', 'Edit', 'Write', 'NotebookEdit', 'Bash', 'WebFetch', 'WebSearch'];

const CATEGORIES = [
  { key: 'meeting', name: 'Meeting someone' },
  { key: 'dinner', name: 'At dinner' },
  { key: 'drinks', name: 'Drinks & toasts' },
  { key: 'cooking', name: 'Cooking' },
  { key: 'compliments', name: 'Compliments' },
  { key: 'banter', name: 'Jokes & banter' },
  { key: 'thanks', name: 'Thanks & goodbyes' },
  { key: 'family', name: 'With his family' },
  { key: 'market', name: 'At the market' },
];

let cache = null;
let mtime = 0;

function pool() {
  let m = 0;
  try { m = fs.statSync(FILE).mtimeMs; } catch { return { categories: CATEGORIES, sentences: [] }; }
  if (m !== mtime) {
    try {
      const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      cache = { categories: d.categories || CATEGORIES, sentences: d.sentences || [] };
      cache.byId = new Map(cache.sentences.map(s => [s.id, s]));
      mtime = m;
    } catch (e) { console.error('sentences.json unreadable:', e.message); }
  }
  return cache || { categories: CATEGORIES, sentences: [], byId: new Map() };
}

const sentence = id => pool().byId?.get(id);

const clean = s => String(s || '').trim();
const phoneticOf = s => clean(s).toLowerCase().replace(/[^a-z\-? ]/g, '').replace(/\s+/g, ' ');

function parseJson(out, open, close) {
  const i = out.indexOf(open), j = out.lastIndexOf(close);
  if (i < 0 || j < i) throw new Error('Claude did not return JSON');
  return JSON.parse(out.slice(i, j + 1));
}

async function generate(cat, n, exclude) {
  const prompt = `You write sentences for a phrasebook and memorisation game for Lian, a man from the UK whose boyfriend is
Burmese. Lian wants to say fun, natural things to his boyfriend and his friends at dinners, drinks and get-togethers,
and to catch the odd thing they say to each other.

Write the ${n} most commonly used, most useful Burmese sentences for this situation: "${cat.name}".
Apply the 80/20 rule: the things people actually say most often in that moment, short and natural spoken Burmese,
always casual, as Lian (a man) would say them. Mix things Lian would say with things he'd often hear.
Don't repeat any of these sentences that already exist: ${JSON.stringify(exclude)}

Write every phonetic exactly by this style guide:

${GUIDE}

For each sentence give:
- "english": natural English meaning (what it means, not a word-for-word gloss)
- "burmese": Burmese script (Unicode)
- "phonetic": the respelling, per the guide
- "words": the phonetic split into its words in order, each with a short English gloss: [{"p":"chay-zu","e":"thanks"}, …]
  — the "p" values joined with spaces must equal the phonetic (without a final "?")
- "useful": 1–100, how often a learner like Lian would actually use or hear it (be honest; it orders the course)

Reply with ONLY a JSON array, most useful first, no markdown or code fence.`;
  const items = parseJson(await runClaude(['-p', prompt, '--model', 'opus', ...CLAUDE_ARGS], { timeout: 900e3 }), '[', ']');
  return items.map(x => ({
    english: clean(x.english),
    burmese: clean(x.burmese),
    phonetic: phoneticOf(x.phonetic),
    words: (Array.isArray(x.words) ? x.words : []).map(w => ({ p: phoneticOf(w.p).replace(/\?/g, ''), e: clean(w.e) })).filter(w => w.p),
    useful: Math.max(1, Math.min(100, Number(x.useful) || 50)),
  })).filter(x => x.english && x.phonetic);
}

const key = s => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

// build(keys, n) — (re)writes those categories (all by default) with n sentences each, keeping the others, and reorders
// the whole pool most-useful-first with categories interleaved. Ids are stable per category slot.
async function build(keys = CATEGORIES.map(c => c.key), n = 40, log = () => {}) {
  const current = pool();
  const keep = current.sentences.filter(s => !keys.includes(s.cat));
  const seen = new Set(keep.map(s => key(s.english)));
  const fresh = [];
  const cats = CATEGORIES.filter(c => keys.includes(c.key));
  for (let i = 0; i < cats.length; i += 3) {
    const batch = cats.slice(i, i + 3);
    const exclude = [...keep, ...fresh].map(s => s.english);
    const results = await Promise.all(batch.map(c => {
      log(`writing ${c.name}…`);
      return generate(c, n, exclude).then(items => ({ c, items }), e => { log(`${c.name} failed: ${e.message}`); return { c, items: [] }; });
    }));
    for (const { c, items } of results) {
      let k = 0;
      for (const it of items) {
        if (seen.has(key(it.english)) || k >= n) continue;
        seen.add(key(it.english));
        fresh.push({ id: `${c.key}-${++k}`, cat: c.key, slot: k, ...it });
      }
      log(`${c.name}: ${k} sentences`);
    }
  }
  const all = [...keep, ...fresh].sort((a, b) => b.useful - a.useful || a.slot - b.slot
    || CATEGORIES.findIndex(c => c.key === a.cat) - CATEGORIES.findIndex(c => c.key === b.cat));
  all.forEach((s, i) => { s.order = i + 1; });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify({ categories: CATEGORIES, sentences: all }, null, 2));
  fs.renameSync(FILE + '.tmp', FILE);
  return all.length;
}

async function translate(text) {
  const english = clean(text).slice(0, 400);
  if (!english) throw new Error('nothing to translate');
  const prompt = `Lian, a man from the UK, wants to say this to his Burmese boyfriend or friends: "${english}"

Translate it into natural, casual spoken Burmese as Lian would say it. Write the phonetic exactly by this style guide:

${GUIDE}

Reply with ONLY JSON, no markdown or code fence:
{"english":"the meaning in natural English","burmese":"Burmese script","phonetic":"respelling per the guide"}`;
  const r = parseJson(await runClaude(['-p', prompt, '--model', 'opus', ...CLAUDE_ARGS], { timeout: 120e3 }), '{', '}');
  const out = { english: clean(r.english) || english, burmese: clean(r.burmese), phonetic: phoneticOf(r.phonetic) };
  if (!out.phonetic) throw new Error('Claude did not return a translation');
  return out;
}

module.exports = { CATEGORIES, pool, sentence, build, translate };
