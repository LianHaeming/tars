// Daily "cool GitHub repos" feed: pulls real repositories from the GitHub search API, then lets the
// claude CLI curate a handful and write why each is interesting. Picks are always real repos (claude
// only chooses from the fetched pool), refreshed once a London day and cached in data/state/discover.json.
const { runClaude } = require('./claude');
const store = require('./store');

const londonDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const UA = 'tars-discover';
const TOPICS = ['self-hosted', 'productivity', 'local-first', 'personal-dashboard', 'typescript', 'react', 'cli', 'llm', 'automation', 'pwa'];

async function ghSearch(q, perPage = 40) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${perPage}`;
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(`github ${r.status}`);
  const j = await r.json();
  return (j.items || []).map(it => ({
    full_name: it.full_name, html_url: it.html_url, description: it.description,
    stars: it.stargazers_count, language: it.language, topics: it.topics || [],
  }));
}

async function pool() {
  const since = new Date(Date.now() - 150 * 864e5).toISOString().slice(0, 10);
  const topic = TOPICS[Math.floor(Date.now() / 864e5) % TOPICS.length];
  const [recent, byTopic] = await Promise.all([
    ghSearch(`created:>${since} stars:>150 language:TypeScript`),
    ghSearch(`topic:${topic} stars:>500 pushed:>${since}`),
  ]);
  const map = new Map();
  for (const it of [...recent, ...byTopic]) if (it.description) map.set(it.full_name, it);
  return [...map.values()];
}

function prompt(cands) {
  const slim = cands.map(c => ({ repo: c.full_name, stars: c.stars, language: c.language, topics: c.topics.slice(0, 5), description: c.description }));
  return `You are Tars, curating a daily GitHub feed for Lian — but only repos that could realistically fit into Tars itself, Lian's self-hosted personal-assistant app. Today is ${londonDay()}.

Tars is a dependency-free Node server plus a React + TypeScript + Vite + Tailwind + shadcn PWA, self-hosted on a Tailscale tailnet. Its modules: a tasks/calendar schedule, food recipes + shopping list, a Burmese spaced-repetition learner, a Monzo money dashboard, read-only Gmail and WhatsApp capture, and AI features that shell out to the \`claude\` CLI. It favours small, local-first, no-heavy-infra tools.

From the real repositories below, choose the 8 that Lian could most plausibly USE IN or BUILD INTO Tars: a library it could adopt, a self-hostable tool it could run alongside, or a project that sparks a concrete new Tars feature. Favour things compatible with the stack (JS/TS, Node, React, small, self-hostable, local-first, LLM-adjacent, personal-productivity, home-dashboard). Avoid big frameworks, infra platforms, and anything that couldn't slot into a one-person self-hosted app.

For each pick, write one sentence on HOW it could fit into Tars — name the module it would slot into or the feature it would enable. Give a short category label naming the Tars area or tech (e.g. "Tasks", "Money", "Burmese", "UI", "Infra", "AI"). No emoji. Choose only from the repos listed, using the exact "repo" value.

Repositories:
${JSON.stringify(slim)}

Reply with ONLY JSON, no markdown or code fence:
[{"repo":"owner/name","blurb":"one sentence","category":"label"}]`;
}

async function compute() {
  const cands = await pool();
  if (!cands.length) throw new Error('no repos from github');
  const out = await runClaude(
    ['-p', prompt(cands), '--disallowedTools', 'Edit', 'Write', 'NotebookEdit', 'Bash', 'WebFetch', 'WebSearch'],
    { timeout: 180e3 },
  );
  const i = out.indexOf('['), j = out.lastIndexOf(']');
  if (i < 0 || j < 0) throw new Error('no picks in reply');
  const raw = JSON.parse(out.slice(i, j + 1));
  const map = new Map(cands.map(c => [c.full_name, c]));
  const repos = [];
  for (const p of Array.isArray(raw) ? raw : []) {
    const c = map.get(p?.repo);
    if (!c || repos.some(r => r.fullName === c.full_name)) continue;
    repos.push({
      fullName: c.full_name, url: c.html_url, description: c.description, stars: c.stars, language: c.language,
      blurb: typeof p.blurb === 'string' ? p.blurb.slice(0, 220) : '',
      category: typeof p.category === 'string' ? p.category.slice(0, 24) : '',
    });
    if (repos.length >= 8) break;
  }
  if (!repos.length) throw new Error('no valid picks');
  return repos;
}

let running = null;

function discover(force) {
  const doc = store.discover.get();
  if (!force && doc.day === londonDay() && doc.repos && doc.repos.length) return Promise.resolve(doc);
  if (!running) {
    running = (async () => {
      try {
        const repos = await compute();
        Object.assign(doc, { day: londonDay(), at: Date.now(), repos, error: null });
      } catch (e) {
        doc.error = e.message;
      } finally {
        store.discover.save();
        running = null;
      }
      return doc;
    })();
  }
  return running;
}

module.exports = { discover };
