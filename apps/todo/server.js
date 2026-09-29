// Self-hosted to-do app. Run: node server.js  (listens on :8788, data in data.json)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8788;
const DATA = path.join(__dirname, 'data.json');
const PUBLIC = path.join(__dirname, 'public');

let db = { projects: [], tasks: [] };
try { db = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch {}

function save() {
  const tmp = DATA + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA);
}

const id = () => crypto.randomBytes(6).toString('hex');
const TASK_FIELDS = ['title', 'description', 'due', 'dueTime', 'priority', 'projectId', 'done'];
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]));

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
  });
}

async function api(req, res, parts) {
  const [resource, rid] = parts;
  const body = ['POST', 'PATCH'].includes(req.method) ? await readBody(req) : {};

  if (resource === 'state' && req.method === 'GET') return send(res, 200, db);

  if (resource === 'tasks') {
    if (req.method === 'POST' && !rid) {
      if (!body.title?.trim()) return send(res, 400, { error: 'title required' });
      const task = { id: id(), title: '', description: '', due: null, dueTime: null, priority: 4, projectId: null, done: false,
        ...pick(body, TASK_FIELDS), createdAt: Date.now(), completedAt: null };
      db.tasks.push(task); save();
      return send(res, 201, task);
    }
    const task = db.tasks.find(t => t.id === rid);
    if (!task) return send(res, 404, { error: 'not found' });
    if (req.method === 'PATCH') {
      Object.assign(task, pick(body, TASK_FIELDS));
      if ('done' in body) task.completedAt = body.done ? Date.now() : null;
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

  send(res, 404, { error: 'not found' });
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    try { return await api(req, res, url.pathname.slice(5).split('/')); }
    catch (e) { return send(res, 400, { error: e.message }); }
  }
  const file = path.join(PUBLIC, path.normalize(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(PUBLIC)) return send(res, 403, { error: 'forbidden' });
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => console.log('Listening on :' + PORT));
