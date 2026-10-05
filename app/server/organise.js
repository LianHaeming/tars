// Tars's "tidy up" helper: asks the claude CLI to categorise and timebox loose to-dos.
// Read-only — it never writes tasks itself; it returns suggestions the app applies one by one.
const { runClaude } = require('./claude');
const store = require('./store');

const pad2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// A loose task is an open one missing a list or a date — the two things Tars can tidy.
const isLoose = t => !t.done && (!t.projectId || !t.due);
const looseTasks = db => db.tasks.filter(isLoose);

function prompt(db, today) {
  const weekday = today.toLocaleDateString('en-GB', { weekday: 'long' });
  const lists = db.projects.map(p => ({ id: p.id, name: p.name }));
  const tasks = looseTasks(db).map(t => ({ id: t.id, title: t.title, notes: t.description || '', hasList: !!t.projectId, hasDate: !!t.due }));
  return `You are Tars, Lian's to-do assistant. Today is ${ymd(today)} (${weekday}).

Lian's lists:
${JSON.stringify(lists)}

Loose to-do items that may need a list and/or a date:
${JSON.stringify(tasks)}

For each item, suggest ONLY where you are confident and only the fields it is currently missing:
- "list": the id of the single best-fitting list from the ids above — only when hasList is false.
- "due": a sensible date in YYYY-MM-DD (today or later) to get it done — only when hasDate is false, and only if the task genuinely benefits from a deadline. Do not pile everything onto today; spread work over the coming days and weeks.
Skip an item entirely when you have no confident suggestion. Never invent lists or dates you are unsure about. Keep "reason" to a few plain words.

Reply with ONLY JSON, no markdown or code fence:
[{"id":"<task id>","list":"<list id, omit if none>","due":"<YYYY-MM-DD, omit if none>","reason":"short why"}]`;
}

async function organise() {
  const db = store.tasks.get();
  const loose = looseTasks(db);
  if (!loose.length) return { suggestions: [] };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const out = await runClaude(
    ['-p', prompt(db, today), '--disallowedTools', 'Edit', 'Write', 'NotebookEdit', 'Bash', 'WebFetch', 'WebSearch'],
    { timeout: 180e3 },
  );
  const i = out.indexOf('['), j = out.lastIndexOf(']');
  if (i < 0 || j < 0) throw new Error('no suggestions in reply');
  const raw = JSON.parse(out.slice(i, j + 1));

  const listIds = new Set(db.projects.map(p => p.id));
  const todayYmd = ymd(today);
  const suggestions = [];
  for (const s of Array.isArray(raw) ? raw : []) {
    const task = db.tasks.find(t => t.id === s?.id && isLoose(t));
    if (!task) continue;
    const change = {};
    if (!task.projectId && listIds.has(s.list)) change.projectId = s.list;
    if (!task.due && typeof s.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.due) && s.due >= todayYmd) change.due = s.due;
    if (!Object.keys(change).length) continue;
    suggestions.push({
      id: task.id,
      title: task.title,
      change,
      listName: change.projectId ? db.projects.find(p => p.id === change.projectId)?.name ?? null : null,
      reason: typeof s.reason === 'string' ? s.reason.slice(0, 80) : '',
    });
  }
  return { suggestions };
}

module.exports = { organise, looseCount: () => looseTasks(store.tasks.get()).length };
