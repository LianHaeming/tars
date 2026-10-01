// A bank of short Burmese phrases to learn — common, useful and funny ones. Built once (bin/burmese) by `claude -p`
// in batches and stored in data/state/burmese.json, so day-to-day there is no Claude call: an index steps one phrase
// forward each London day (or on demand), and everything up to it is the "seen" history.
const { spawn } = require('child_process');
const { TARS, burmese } = require('./store');

const BATCH_TIMEOUT = 180e3;
const THEMES = [
  'everyday greetings and politeness', 'small talk and things you say daily', 'questions you actually ask people',
  'funny one-liners and jokes that make people laugh', 'playful teasing and cheeky comebacks', 'reactions and exclamations',
  'food, eating and ordering', 'friendly compliments', 'casual slang and how friends really talk', 'getting around and directions',
  'encouragement and good wishes', 'being dramatic about small things (funny)', 'flirty and sweet lines', 'numbers, time and money basics',
];

const londonDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());

function touch() {
  const doc = burmese.get();
  if (!doc.phrases?.length) return doc;
  const t = londonDay();
  if (doc.lastDay == null) { doc.lastDay = t; if (doc.index == null) doc.index = 0; burmese.save(); }
  else if (doc.lastDay !== t) { doc.index = Math.min(doc.phrases.length - 1, (doc.index || 0) + 1); doc.lastDay = t; burmese.save(); }
  return doc;
}

function current() {
  const doc = touch();
  const p = doc.phrases?.[doc.index] || null;
  return { phrase: p, index: doc.index || 0, total: doc.phrases?.length || 0 };
}

function all() {
  const doc = touch();
  const total = doc.phrases?.length || 0;
  return { index: doc.index || 0, total, phrases: (doc.phrases || []).slice(0, (doc.index || 0) + 1) };
}

function advance() {
  const doc = touch();
  if (doc.phrases?.length) {
    doc.index = Math.min(doc.phrases.length - 1, (doc.index || 0) + 1);
    doc.lastDay = londonDay();
    burmese.save();
  }
  return current();
}

function prompt(n, theme, avoid) {
  const dont = avoid.length ? `\nDon't reuse any of these phrases already collected: ${avoid.join(' | ')}.` : '';
  return `Give me ${n} short Burmese phrases for an English speaker to learn and use. Keep them mostly common, everyday and genuinely useful, with plenty of funny, cheeky or silly ones that would make people laugh — natural things real people actually say, not textbook sentences. Lean into this theme for this batch: ${theme}.
Reply with ONLY a JSON array, no markdown and no code fence, each item exactly:
{"burmese":"the phrase in Burmese script","phonetic":"how an English speaker pronounces it, syllable by syllable with simple respelling (not IPA), e.g. nay-kaung-la","english":"what it means","note":"one short line: a literal gloss, when to use it, or why it's funny"}${dont}`;
}

function parseArray(out) {
  const i = out.indexOf('['), j = out.lastIndexOf(']');
  if (i < 0 || j < i) throw new Error('no array in reply');
  const arr = JSON.parse(out.slice(i, j + 1));
  return arr.filter(o => o && String(o.burmese || '').trim() && String(o.phonetic || '').trim() && String(o.english || '').trim())
    .map(o => ({ burmese: o.burmese.trim(), phonetic: o.phonetic.trim(), english: o.english.trim(), note: String(o.note || '').trim() }));
}

function batch(n, theme, avoid) {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt(n, theme, avoid), '--disallowedTools', 'Edit', 'Write', 'NotebookEdit', 'Bash'];
    const child = spawn('claude', args, { cwd: TARS, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { child.kill(); reject(new Error('batch timed out')); }, BATCH_TIMEOUT);
    let out = '', err = '';
    child.stdout.on('data', c => { out += c; });
    child.stderr.on('data', c => { err += c; });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code) return reject(new Error((err.trim().split('\n').pop() || `claude exited ${code}`).slice(0, 200)));
      try { resolve(parseArray(out)); } catch (e) { reject(e); }
    });
  });
}

// Tops up the bank toward `target` phrases, saving after every batch so it is safe to stop and resume.
async function build(target = 365, size = 40, log = () => {}) {
  const doc = burmese.get();
  if (!Array.isArray(doc.phrases)) doc.phrases = [];
  const seen = new Set(doc.phrases.map(p => p.english.toLowerCase()));
  const seenMy = new Set(doc.phrases.map(p => p.burmese));
  let round = 0;
  while (doc.phrases.length < target) {
    const theme = THEMES[round % THEMES.length];
    const want = Math.min(size, target - doc.phrases.length);
    const avoid = doc.phrases.slice(-60).map(p => p.english);
    let got = [];
    try { got = await batch(want + 6, theme, avoid); }
    catch (e) { log(`batch failed (${theme}): ${e.message}`); round++; if (round > THEMES.length * 4) throw new Error('too many failed batches'); continue; }
    let added = 0;
    for (const p of got) {
      const key = p.english.toLowerCase();
      if (seen.has(key) || seenMy.has(p.burmese)) continue;
      seen.add(key); seenMy.add(p.burmese); doc.phrases.push(p); added++;
      if (doc.phrases.length >= target) break;
    }
    if (doc.index == null) doc.index = 0;
    burmese.save();
    log(`${theme}: +${added} → ${doc.phrases.length}/${target}`);
    round++;
  }
  log(`done: ${doc.phrases.length} phrases`);
  return doc.phrases.length;
}

module.exports = { current, all, advance, build };
