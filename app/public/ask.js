const askLogEl = document.getElementById('askLog'), askIn = document.getElementById('askIn'), askGo = document.getElementById('askGo');
let askSession = localGet('askSession');
let askMsgs = [];
try { askMsgs = JSON.parse(localGet('askMsgs') || '[]'); } catch {}
let askBusy = false;

const md = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/`([^`\n]+)`/g, '<code>$1</code>')
  .replace(/^\s*[-*] /gm, '• ')
  .replace(/\n/g, '<br>');

function renderAsk() {
  askLogEl.innerHTML = askMsgs.length
    ? askMsgs.map(m => `<div class="msg ${m.who}">${md(m.text)}${m.status ? `<div class="msg-status">${esc(m.status)}</div>` : ''}</div>`).join('')
    : `<div class="ask-empty">Ask what's coming up, or say "add the … email to my tasks".</div>`;
  askLogEl.scrollTop = askLogEl.scrollHeight;
  askGo.disabled = askBusy || !askIn.value.trim();
}

function saveAsk() {
  localSet('askMsgs', JSON.stringify(askMsgs.slice(-40)));
  localSet('askSession', askSession || '');
}

function openAsk() { document.body.classList.add('asking'); renderAsk(); askIn.focus(); }
function closeAsk() { document.body.classList.remove('asking'); askIn.blur(); }

async function sendAsk(text) {
  askBusy = true;
  askMsgs.push({ who: 'me', text });
  const reply = { who: 'ai', text: '', status: 'Thinking…' };
  askMsgs.push(reply);
  renderAsk();
  const note = t => { reply.text += (reply.text ? '\n\n' : '') + '⚠️ ' + t; };
  try {
    const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: text, sessionId: askSession }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line) continue;
        const e = JSON.parse(line);
        if (e.type === 'text') { reply.text += e.text; reply.status = ''; }
        else if (e.type === 'status') reply.status = e.text;
        else if (e.type === 'error') note(e.text);
        else if (e.type === 'done' && e.sessionId) askSession = e.sessionId;
        renderAsk();
      }
    }
  } catch (e) { note(e.message); }
  reply.status = '';
  if (!reply.text) reply.text = '(no reply)';
  askBusy = false;
  saveAsk();
  renderAsk();
  load();
}

document.getElementById('askForm').addEventListener('submit', e => {
  e.preventDefault();
  const text = askIn.value.trim();
  if (!text || askBusy) return;
  askIn.value = '';
  autosize(askIn);
  sendAsk(text);
});
askIn.addEventListener('input', () => { autosize(askIn); askGo.disabled = askBusy || !askIn.value.trim(); });
askIn.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('askForm').requestSubmit(); } });
document.getElementById('askBtn').addEventListener('click', openAsk);
document.getElementById('askClose').addEventListener('click', closeAsk);
document.getElementById('askNew').addEventListener('click', () => {
  if (askBusy) return;
  askMsgs = [];
  askSession = null;
  saveAsk();
  renderAsk();
});
if (window.visualViewport) {
  const sheet = document.getElementById('ask');
  const place = () => { sheet.style.bottom = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop) + 'px'; };
  visualViewport.addEventListener('resize', place);
  visualViewport.addEventListener('scroll', place);
}
