// tars tasks server: the only code that reads or writes this app's state/ (tasks, inbox). Serves /api/* and the
// built React app (web → dist/). Run: node server  (port 8400)
const path = require('path');
const crypto = require('crypto');
const { callApp, send, start } = require('@tars/server');
const store = require('./state');
const { organise } = require('./organise');

const PORT = process.env.PORT || 8400;
const DIST = path.join(__dirname, '..', 'dist');
const db = store.tasks.get();

const id = () => crypto.randomBytes(6).toString('hex');
const okId = v => typeof v === 'string' && /^[\w-]{6,64}$/.test(v);
const TASK_FIELDS = ['title', 'description', 'due', 'dueTime', 'projectId', 'subId', 'done', 'repeat'];
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]));
const newTask = fields => ({ id: okId(fields.id) ? fields.id : id(),
  title: '', description: '', due: null, dueTime: null, projectId: null, subId: null, done: false,
  ...pick(fields, TASK_FIELDS), createdAt: Number(fields.createdAt) || Date.now(), completedAt: null });
const save = () => store.tasks.save();

const pad2 = n => String(n).padStart(2, '0');
const fmtYmd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

// Advance a date by one repeat step (e.g. "6m", "1y", "2w"); null for a bad code.
function stepRepeat(base, code) {
  const m = /^(\d+)([wmy])$/.exec(code || '');
  if (!m) return null;
  const n = Number(m[1]), d = new Date(base);
  if (m[2] === 'w') d.setDate(d.getDate() + 7 * n);
  else if (m[2] === 'm') d.setMonth(d.getMonth() + n);
  else d.setFullYear(d.getFullYear() + n);
  return d;
}

// When a repeating task is completed, drop in its next occurrence, rolled forward to today or later.
function spawnNext(task) {
  const start = parseYmd(fmtYmd(new Date()));
  let next = stepRepeat(task.due ? parseYmd(task.due) : start, task.repeat);
  if (!next) return;
  for (let guard = 0; next < start && guard < 240; guard++) next = stepRepeat(next, task.repeat);
  db.tasks.push(newTask({
    title: task.title, description: task.description, projectId: task.projectId,
    subId: task.subId, dueTime: task.dueTime, repeat: task.repeat, due: fmtYmd(next),
  }));
}

// A task's subId only makes sense inside its own list; drop it otherwise.
function fixSub(task) {
  if (!task.subId) return;
  const p = db.projects.find(p => p.id === task.projectId);
  if (!p || !(p.subs || []).some(s => s.id === task.subId)) task.subId = null;
}

async function api(req, res, parts, body) {
  const [resource, rid] = parts;

  if (resource === 'state' && req.method === 'GET') return send(res, 200, db);

  if (resource === 'tasks') {
    if (req.method === 'POST' && !rid) {
      const existing = body.id && db.tasks.find(t => t.id === body.id);
      if (existing) { Object.assign(existing, pick(body, TASK_FIELDS)); fixSub(existing); save(); return send(res, 200, existing); }
      const task = newTask(body); fixSub(task);
      db.tasks.push(task); save();
      return send(res, 201, task);
    }
    const task = db.tasks.find(t => t.id === rid);
    if (!task) return send(res, 404, { error: 'not found' });
    if (req.method === 'PATCH') {
      const wasDone = task.done;
      Object.assign(task, pick(body, TASK_FIELDS));
      if ('done' in body) task.completedAt = body.done ? Date.now() : null;
      fixSub(task);
      if ('done' in body && body.done && !wasDone && task.repeat) spawnNext(task);
      save(); return send(res, 200, task);
    }
    if (req.method === 'DELETE') {
      db.tasks = db.tasks.filter(t => t.id !== rid); save();
      return send(res, 204);
    }
  }

  if (resource === 'projects') {
    if (req.method === 'POST' && !rid) {
      if (!body.name?.trim()) return send(res, 400, { error: 'name required' });
      const project = { id: id(), name: body.name.trim(), color: body.color || '#808080' };
      db.projects.push(project); save();
      return send(res, 201, project);
    }
    const project = db.projects.find(p => p.id === rid);
    if (!project) return send(res, 404, { error: 'not found' });
    if (req.method === 'PATCH') {
      if (Array.isArray(body.subs)) {
        const subs = body.subs
          .filter(s => s && typeof s.name === 'string' && s.name.trim())
          .map(s => ({ id: okId(s.id) ? s.id : id(), name: s.name.trim() }));
        const keep = new Set(subs.map(s => s.id));
        db.tasks.forEach(t => { if (t.projectId === project.id && t.subId && !keep.has(t.subId)) t.subId = null; });
        project.subs = subs;
      }
      Object.assign(project, pick(body, ['name', 'color'])); save();
      return send(res, 200, project);
    }
    if (req.method === 'DELETE') {
      // Tasks in a deleted project fall back to the Inbox rather than vanishing.
      db.tasks.forEach(t => { if (t.projectId === rid) t.projectId = null; });
      db.projects = db.projects.filter(p => p.id !== rid); save();
      return send(res, 204);
    }
  }

  if (resource === 'shopping' && req.method === 'POST') {
    const items = (Array.isArray(body.items) ? body.items : []).filter(i => i?.title?.trim());
    let list = db.projects.find(p => p.name === 'Shopping');
    if (!list) { list = { id: id(), name: 'Shopping', color: '#25b84c' }; db.projects.push(list); }
    db.tasks = db.tasks.filter(t => t.projectId !== list.id || t.done);
    for (const i of items) db.tasks.push(newTask({ title: i.title.trim(), description: i.description || '', projectId: list.id }));
    save();
    return send(res, 200, { projectId: list.id, added: items.length });
  }

  if (resource === 'expected' && req.method === 'GET') {
    try { return send(res, 200, await callApp('money', 'GET', 'expected')); }
    catch (e) { return send(res, 503, { error: e.message }); }
  }

  if (resource === 'dashboard' && req.method === 'GET') {
    const [money, discover] = await Promise.allSettled([
      callApp('money', 'GET', 'money/summary', null, { timeout: 15e3 }),
      callApp('discover', 'GET', 'discover', null, { timeout: 15e3 }),
    ]);
    const m = money.value, d = discover.value;
    return send(res, 200, {
      money: m ? pick(m, ['balance', 'potTotal', 'committed', 'income', 'insights', 'thinking', 'fetchedAt']) : null,
      moneyError: money.reason?.message || null,
      discover: d ? { repos: (d.repos || []).slice(0, 3) } : null,
      discoverError: discover.reason?.message || null,
    });
  }

  if (resource === 'organise' && req.method === 'GET') {
    try { return send(res, 200, await organise()); }
    catch (e) { return send(res, 503, { error: e.message }); }
  }

  if (resource === 'inbox') {
    const inbox = store.inbox.get();
    if (req.method === 'GET') return send(res, 200, inbox);
    if (req.method === 'POST' && !rid) {
      // Called by bin/email-tasks: record the Gmail id as seen, and queue a candidate when actionable.
      if (!body.gmailId) return send(res, 400, { error: 'gmailId required' });
      if (!inbox.seen.includes(body.gmailId)) inbox.seen.push(body.gmailId);
      inbox.seen = inbox.seen.slice(-500);
      if (body.actionable && body.title?.trim()) {
        const title = body.title.trim();
        const fields = {
          gmailId: body.gmailId, title, kind: body.kind === 'reminder' ? 'reminder' : 'task',
          due: body.due || null, dueTime: body.dueTime || null, description: body.description || '',
          sender: body.sender || '', subject: body.subject || '', emailDate: body.emailDate || '',
        };
        const same = inbox.candidates.find(c => c.title.toLowerCase() === title.toLowerCase());
        if (same) Object.assign(same, fields);
        else inbox.candidates.push({ id: id(), ...fields, createdAt: Date.now() });
      }
      store.inbox.save();
      return send(res, 200, { candidates: inbox.candidates.length });
    }
    const candidate = inbox.candidates.find(c => c.id === rid);
    if (!candidate) return send(res, 404, { error: 'not found' });
    if (req.method === 'POST' && parts[2] === 'accept') {
      const task = newTask({ ...pick(candidate, TASK_FIELDS), ...pick(body, TASK_FIELDS) });
      db.tasks.push(task); save();
      inbox.candidates = inbox.candidates.filter(c => c.id !== rid); store.inbox.save();
      return send(res, 201, task);
    }
    if (req.method === 'DELETE') {
      inbox.candidates = inbox.candidates.filter(c => c.id !== rid); store.inbox.save();
      return send(res, 204);
    }
  }

  send(res, 404, { error: 'not found' });
}

start({ port: PORT, dist: DIST, api });
