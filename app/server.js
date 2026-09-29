// tars app: dashboard + tasks API, and the food menu under /food/. Run: node server.js  (listens on :8400, data in data.json)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 8400;
const DATA = process.env.DATA || path.join(__dirname, 'data.json');
const PUBLIC = path.join(__dirname, 'dist');
const TARS = path.join(__dirname, '..');
const FOOD = path.join(TARS, 'food');
const ASK_TIMEOUT = 180e3;
const ASK_PROMPT = `You are replying in the chat inside the tars app on Lian's phone. Keep replies short and plain: a few lines, no headings or tables.
Lian's tasks and upcoming items live in the tars app API at http://127.0.0.1:${PORT}: GET /api/state, POST /api/tasks {title, due, dueTime, description, projectId}, PATCH /api/tasks/<id>, DELETE /api/tasks/<id>.
Gmail is read with bin/gmail (see CLAUDE.md and the coming-up / from-gmail skills). Timezone Europe/London.
You may read files, but never edit files or code — say so if Lian asks for a code change and suggest a Remote Control session.`;

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
const newTask = fields => ({ id: id(), title: '', description: '', due: null, dueTime: null, priority: 4, projectId: null, done: false,
  ...pick(fields, TASK_FIELDS), createdAt: Date.now(), completedAt: null });

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
      const task = newTask(body);
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

  if (resource === 'shopping' && req.method === 'POST') {
    const items = (Array.isArray(body.items) ? body.items : []).filter(i => i?.title?.trim());
    let list = db.projects.find(p => p.name === 'Shopping');
    if (!list) { list = { id: id(), name: 'Shopping', color: '#25b84c' }; db.projects.push(list); }
    db.tasks = db.tasks.filter(t => t.projectId !== list.id || t.done);
    for (const i of items) db.tasks.push(newTask({ title: i.title.trim(), description: i.description || '', projectId: list.id }));
    save();
    return send(res, 200, { projectId: list.id, added: items.length });
  }

  if (resource === 'ask' && req.method === 'POST') return ask(res, body);

  send(res, 404, { error: 'not found' });
}

let asking = false;

function toolStatus(tool) {
  const cmd = tool.input?.command || '';
  if (tool.name === 'Bash' && cmd.includes('bin/gmail')) return 'Checking Gmail…';
  if (tool.name === 'Bash' && cmd.includes('/api/')) return /-X\s*(POST|PATCH|DELETE)/.test(cmd) ? 'Updating your lists…' : 'Checking your lists…';
  if (tool.name === 'Skill') return 'Using a skill…';
  return 'Working…';
}

function ask(res, body) {
  const message = String(body.message || '').trim();
  if (!message) return send(res, 400, { error: 'message required' });
  if (asking) return send(res, 409, { error: 'Claude is still answering the last message' });
  asking = true;

  const args = ['-p', message, '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--append-system-prompt', ASK_PROMPT,
    '--disallowedTools', 'Edit', 'Write', 'NotebookEdit',
    '--allowedTools', 'Bash(bin/gmail:*)', 'Bash(curl:*)', 'Read', 'Grep', 'Glob', 'Skill'];
  if (/^[\w-]{8,}$/.test(body.sessionId || '')) args.push('--resume', body.sessionId);

  res.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' });
  const emit = obj => res.writableEnded || res.write(JSON.stringify(obj) + '\n');
  const child = spawn('claude', args, { cwd: TARS, stdio: ['ignore', 'pipe', 'pipe'] });
  const timer = setTimeout(() => { emit({ type: 'error', text: 'Took too long, stopped after 3 minutes.' }); child.kill(); }, ASK_TIMEOUT);
  let buf = '', wrote = false, sessionId = body.sessionId || null, errText = '';

  child.stdout.on('data', chunk => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.session_id) sessionId = m.session_id;
      const ev = m.type === 'stream_event' ? m.event : null;
      if (ev?.type === 'message_start' && wrote) emit({ type: 'text', text: '\n\n' });
      if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta') { emit({ type: 'text', text: ev.delta.text }); wrote = true; }
      if (m.type === 'assistant') for (const c of m.message?.content || []) if (c.type === 'tool_use') emit({ type: 'status', text: toolStatus(c) });
      if (m.type === 'result' && m.is_error) emit({ type: 'error', text: String(m.result || 'Claude hit an error.') });
    }
  });
  child.stderr.on('data', c => { errText += c; });
  child.on('close', code => {
    clearTimeout(timer);
    asking = false;
    if (code && !wrote) emit({ type: 'error', text: (errText.trim().split('\n').pop() || `claude exited with ${code}`).slice(0, 300) });
    emit({ type: 'done', sessionId });
    res.end();
  });
  child.on('error', e => { emit({ type: 'error', text: e.message }); });
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    try { return await api(req, res, url.pathname.slice(5).split('/')); }
    catch (e) { return send(res, 400, { error: e.message }); }
  }
  let rel = decodeURIComponent(url.pathname);
  const base = rel.startsWith('/food/') ? FOOD : PUBLIC;
  if (base === FOOD) rel = rel.slice(5);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(base, path.normalize(rel));
  if (!file.startsWith(base + path.sep)) return send(res, 403, { error: 'forbidden' });
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: 'not found' });
    const cache = file.startsWith(path.join(PUBLIC, 'assets') + path.sep) ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': cache });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => console.log('Listening on :' + PORT));
