// On-demand "I don't like X" helper: sends one recipe to the claude CLI and gets back ingredient swaps
// so Lian can enjoy a dish they'd otherwise skip. Reads the static food content directly (menu.json for
// the name, r/<id>.json for ingredients + method); nothing is cached — it's a per-tap call like burmese.translate.
const fs = require('fs');
const path = require('path');
const { TARS, runClaude } = require('@tars/server');

const FOOD = path.join(TARS, 'data', 'food');
const okId = id => typeof id === 'string' && /^[\w-]{6,64}$/.test(id);
const clean = s => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
const readJson = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

const CLAUDE_ARGS = ['--strict-mcp-config', '--disallowedTools', 'Edit', 'Write', 'NotebookEdit', 'Bash', 'WebFetch', 'WebSearch'];

function prompt(recipe, detail, dislike) {
  const ingredients = detail.ingredients.map(i => clean(i.name)).filter(Boolean);
  const method = detail.steps.map((s, i) => `${i + 1}. ${(s.points || []).map(clean).join(' ')}`).join('\n').slice(0, 1800);
  return `You are Tars, Lian's practical cooking helper. Lian doesn't like something in a recipe and wants to still enjoy it.

Recipe: ${clean(recipe.n)}${recipe.h ? ` — ${clean(recipe.h)}` : ''}
Ingredients: ${ingredients.join(', ')}

Method:
${method}

What Lian doesn't like: "${clean(dislike).slice(0, 200)}"

Suggest 1–3 simple, realistic swaps so Lian would enjoy this dish. For each: the ingredient to replace ("for"), what to use instead ("use", name a common supermarket item), and one short line on any cooking change ("how", keep it brief, or empty if nothing changes). If what they dislike isn't really in this recipe, say so kindly in "note" and still give the best nearby tweak. Add one optional overall "note" (or empty). No emoji.

Reply with ONLY JSON, no markdown or code fence:
{"swaps":[{"for":"ingredient","use":"replacement","how":"short cooking note or empty"}],"note":"one short line or empty"}`;
}

async function suggest(id, dislike) {
  if (!okId(id)) throw new Error('bad recipe id');
  if (!clean(dislike)) throw new Error('tell me what you do not like');
  const recipe = (readJson(path.join(FOOD, 'menu.json')) || []).find(r => r.id === id);
  const detail = readJson(path.join(FOOD, 'r', id + '.json'));
  if (!recipe || !detail) throw new Error('recipe not found');

  const out = await runClaude(['-p', prompt(recipe, detail, dislike), '--model', 'opus', ...CLAUDE_ARGS], { timeout: 120e3 });
  const i = out.indexOf('{'), j = out.lastIndexOf('}');
  if (i < 0 || j < i) throw new Error('no suggestions in reply');
  const raw = JSON.parse(out.slice(i, j + 1));
  const swaps = (Array.isArray(raw.swaps) ? raw.swaps : [])
    .map(s => ({ for: clean(s?.for).slice(0, 80), use: clean(s?.use).slice(0, 160), how: clean(s?.how).slice(0, 200) }))
    .filter(s => s.use)
    .slice(0, 3);
  const note = clean(raw.note).slice(0, 300);
  if (!swaps.length && !note) throw new Error('no suggestions in reply');
  return { swaps, note };
}

module.exports = { suggest };
