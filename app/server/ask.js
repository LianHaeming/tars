// POST /api/ask: runs `claude -p` in the tars folder and streams the reply as NDJSON (text/status/error/done).
// The conversation (messages + Claude session id) is kept in data/state/chat.json so every device sees it.
const { spawn } = require('child_process');
const { TARS, chat } = require('./store');

const TIMEOUT = 180e3;
const KEEP = 60;
let busy = false;

const prompt = port => `You are replying in the chat inside the tars app on Lian's phone. Keep replies short and plain: a few lines, no headings or tables.
Lian's tasks and upcoming items live in the tars app API at http://127.0.0.1:${port}: GET /api/state, POST /api/tasks {title, due, dueTime, description, projectId}, PATCH /api/tasks/<id>, DELETE /api/tasks/<id>.
Gmail is read with bin/gmail (see CLAUDE.md and the coming-up / from-gmail skills). Timezone Europe/London.
You may read files, but never edit files or code — say so if Lian asks for a code change and suggest a Remote Control session.`;

function toolStatus(tool) {
  const cmd = tool.input?.command || '';
  if (tool.name === 'Bash' && cmd.includes('bin/gmail')) return 'Checking Gmail…';
  if (tool.name === 'Bash' && cmd.includes('/api/')) return /-X\s*(POST|PATCH|DELETE)/.test(cmd) ? 'Updating your lists…' : 'Checking your lists…';
  if (tool.name === 'Skill') return 'Using a skill…';
  return 'Working…';
}

const isBusy = () => busy;

function ask(res, message, port) {
  busy = true;
  const c = chat.get();
  const reply = { who: 'ai', text: '' };
  c.messages.push({ who: 'me', text: message }, reply);
  c.messages = c.messages.slice(-KEEP);
  chat.save();

  const args = ['-p', message, '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--append-system-prompt', prompt(port),
    '--disallowedTools', 'Edit', 'Write', 'NotebookEdit',
    '--allowedTools', 'Bash(bin/gmail:*)', 'Bash(curl:*)', 'Read', 'Grep', 'Glob', 'Skill'];
  if (c.sessionId) args.push('--resume', c.sessionId);

  res.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' });
  const emit = obj => res.writableEnded || res.write(JSON.stringify(obj) + '\n');
  const note = text => { reply.text += (reply.text ? '\n\n' : '') + '⚠️ ' + text; emit({ type: 'error', text }); };
  const child = spawn('claude', args, { cwd: TARS, stdio: ['ignore', 'pipe', 'pipe'] });
  const timer = setTimeout(() => { note('Took too long, stopped after 3 minutes.'); child.kill(); }, TIMEOUT);
  let buf = '', wrote = false, errText = '';

  child.stdout.on('data', chunk => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.session_id) c.sessionId = m.session_id;
      const ev = m.type === 'stream_event' ? m.event : null;
      const text = t => { reply.text += t; emit({ type: 'text', text: t }); };
      if (ev?.type === 'message_start' && wrote) text('\n\n');
      if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta') { text(ev.delta.text); wrote = true; }
      if (m.type === 'assistant') for (const x of m.message?.content || []) if (x.type === 'tool_use') emit({ type: 'status', text: toolStatus(x) });
      if (m.type === 'result' && m.is_error) note(String(m.result || 'Claude hit an error.'));
    }
  });
  child.stderr.on('data', x => { errText += x; });
  child.on('error', e => note(e.message));
  child.on('close', code => {
    clearTimeout(timer);
    if (code && !wrote) note((errText.trim().split('\n').pop() || `claude exited with ${code}`).slice(0, 300));
    if (!reply.text) reply.text = '(no reply)';
    chat.save();
    busy = false;
    emit({ type: 'done' });
    res.end();
  });
}

module.exports = { ask, isBusy };
