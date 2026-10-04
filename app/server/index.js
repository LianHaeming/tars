// tars server: the only code that reads or writes data/. Serves /api/*, the food content under /data/food/,
// and the built React app (web → dist/; any other page path gets index.html). Run: node server  (port 8400)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');
const { ask, isBusy } = require('./ask');
const { money, expected, summary } = require('./money');
const burmese = require('./burmese');
const phrases = require('./phrases');

const PORT = process.env.PORT || 8400;
const DIST = path.join(__dirname, '..', 'dist');
const FOOD = path.join(store.DATA, 'food');
const db = store.tasks.get();

const id = () => crypto.randomBytes(6).toString('hex');
const okId = v => typeof v === 'string' && /^[\w-]{6,64}$/.test(v);
const TASK_FIELDS = ['title', 'description', 'due', 'dueTime', 'projectId', 'subId', 'done'];
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]));
const newTask = fields => ({ id: okId(fields.id) ? fields.id : id(),
  title: '', description: '', due: null, dueTime: null, projectId: null, subId: null, done: false,
  ...pick(fields, TASK_FIELDS), createdAt: Number(fields.createdAt) || Date.now(), completedAt: null });
const save = () => store.tasks.save();

// A task's subId only makes sense inside its own list; drop it otherwise.
function fixSub(task) {
  if (!task.subId) return;
  const p = db.projects.find(p => p.id === task.projectId);
  if (!p || !(p.subs || []).some(s => s.id === task.subId)) task.subId = null;
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

class BadRequest extends Error {}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 1e6) { req.destroy(); reject(new BadRequest('body too large')); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new BadRequest('invalid JSON body')); } });
    req.on('error', reject);
  });
}

async function api(req, res, parts) {
  const [resource, rid] = parts;
  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};

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
      Object.assign(task, pick(body, TASK_FIELDS));
      if ('done' in body) task.completedAt = body.done ? Date.now() : null;
      fixSub(task);
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

  if (resource === 'food') {
    const food = store.food.get();
    if (req.method === 'GET') return send(res, 200, food);
    if (req.method === 'PATCH') {
      if (Array.isArray(body.basket)) food.basket = [...new Set(body.basket.filter(x => typeof x === 'string'))];
      if (typeof body.shop === 'string') food.shop = body.shop;
      store.food.save();
      return send(res, 200, food);
    }
  }

  if (resource === 'chat') {
    const chat = store.chat.get();
    if (req.method === 'GET') return send(res, 200, { ...chat, busy: isBusy() });
    if (req.method === 'DELETE') {
      if (isBusy()) return send(res, 409, { error: 'Claude is still answering' });
      chat.messages = []; chat.sessionId = null; store.chat.save();
      return send(res, 204);
    }
  }

  if (resource === 'money' && req.method === 'GET') {
    try { return send(res, 200, rid === 'summary' ? await summary(false) : rid === 'summary-fresh' ? await summary(true) : await money(rid === 'fresh')); }
    catch (e) { return send(res, 503, { error: e.message }); }
  }

  if (resource === 'expected' && req.method === 'GET') {
    try { return send(res, 200, await expected()); }
    catch (e) { return send(res, 503, { error: e.message }); }
  }

  if (resource === 'burmese') {
    if (req.method === 'GET' && !rid) return send(res, 200, burmese.state());
    if (req.method === 'GET' && rid === 'phrases') return send(res, 200, phrases.all());
    if (req.method === 'POST' && rid === 'phrase') return send(res, 200, phrases.advance());
    if (req.method === 'DELETE' && rid === 'history') return send(res, 200, burmese.clearHistory());
    if (req.method === 'POST') {
      try {
        if (rid === 'learn') return send(res, 200, burmese.learn(body.id));
        if (rid === 'review') return send(res, 200, burmese.review(body.id, body.dir, !!body.ok));
        if (rid === 'unlearn') return send(res, 200, burmese.unlearn(body.id));
        if (rid === 'save') return send(res, 200, burmese.save(body));
        if (rid === 'translate') return send(res, 200, await burmese.translate(body.text));
      } catch (e) { return send(res, rid === 'translate' ? 502 : 400, { error: e.message }); }
    }
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
        inbox.candidates.push({
          id: id(), gmailId: body.gmailId, title: body.title.trim(),
          due: body.due || null, dueTime: body.dueTime || null, description: body.description || '',
          sender: body.sender || '', subject: body.subject || '', emailDate: body.emailDate || '',
          createdAt: Date.now(),
        });
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

  if (resource === 'ask' && req.method === 'POST') {
    const message = String(body.message || '').trim();
    if (!message) return send(res, 400, { error: 'message required' });
    if (isBusy()) return send(res, 409, { error: 'Claude is still answering the last message' });
    return ask(res, message, PORT);
  }

  send(res, 404, { error: 'not found' });
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

function serve(res, file, cache) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': cache });
    res.end(buf);
  });
}

function inside(base, rel) {
  const file = path.join(base, path.normalize(rel));
  return file.startsWith(base + path.sep) ? file : null;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const rel = decodeURIComponent(url.pathname);
  if (rel.startsWith('/api/')) {
    try { return await api(req, res, rel.slice(5).split('/')); }
    catch (e) {
      if (res.headersSent || res.writableEnded) return res.end();
      if (e instanceof BadRequest) return send(res, 400, { error: e.message });
      console.error('API error', req.method, rel, e);
      return send(res, 500, { error: 'server error' });
    }
  }
  if (rel.startsWith('/data/food/')) {
    const file = inside(FOOD, rel.slice('/data/food'.length));
    return file ? serve(res, file, 'public, max-age=3600') : send(res, 403, { error: 'forbidden' });
  }
  const file = inside(DIST, rel);
  if (file && path.extname(rel)) return serve(res, file, rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
  serve(res, path.join(DIST, 'index.html'), 'no-cache');
}).listen(PORT, '127.0.0.1', () => console.log('Listening on :' + PORT));
