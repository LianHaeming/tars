// Answer scoring, 0–100, local and instant. Meaning (phonetic → English): cosine similarity of bge-small-en-v1.5 sentence
// embeddings, stretched so unrelated answers land near 0. Phonetic (English → phonetic): edit-distance closeness,
// ignoring case, spaces, hyphens and punctuation.
const os = require('os');
const path = require('path');

const MODEL = 'Xenova/bge-small-en-v1.5';
const LO = 0.5;
const HI = 0.95;

const normEnglish = s => String(s || '').toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
const { normPhonetic, distance } = require('../shared/phonetic.ts');

let embedder = null;
function model() {
  embedder ||= import('@huggingface/transformers').then(({ pipeline, env }) => {
    env.cacheDir = process.env.TARS_MODELS || path.join(os.homedir(), '.cache', 'tars', 'models');
    return pipeline('feature-extraction', MODEL, { dtype: 'q8' });
  }).catch(e => { embedder = null; throw e; });
  return embedder;
}

const vectors = new Map();
async function embed(texts) {
  const todo = [...new Set(texts.filter(t => !vectors.has(t)))];
  if (todo.length) {
    const f = await model();
    const out = (await f(todo, { pooling: 'mean', normalize: true })).tolist();
    todo.forEach((t, i) => vectors.set(t, out[i]));
  }
  return texts.map(t => vectors.get(t));
}

async function meaning(answer, english) {
  const a = normEnglish(answer), b = normEnglish(english);
  if (!a) return 0;
  if (a === b) return 100;
  const [x, y] = await embed([a, b]);
  const cos = x.reduce((s, v, i) => s + v * y[i], 0);
  return Math.round(Math.max(0, Math.min(1, (cos - LO) / (HI - LO))) * 100);
}

function phonetic(answer, target) {
  const a = normPhonetic(answer), b = normPhonetic(target);
  if (!a || !b) return 0;
  return Math.round(Math.max(0, 1 - distance(a, b) / Math.max(a.length, b.length)) * 100);
}

const grade = score => score == null || score < 60 ? 1 : score < 85 ? 2 : score < 95 ? 3 : 4;

module.exports = { meaning, phonetic, grade, warm: () => model().then(() => embed(['hello']), e => console.error('embedding model:', e.message)) };
