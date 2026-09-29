// ---------- State ----------
let state = { projects: [], tasks: [] };
let view = localGet('view') || 'today';
let panel = null;            // full-screen panel over the home screen: 'lists' | 'month' | 'shopping' | 'food'
let openId = null;           // task currently expanded for editing
let calAnchor = null;        // first-of-month Date shown in the calendar
let calSel = null;           // selected day (ymd) in the calendar
const SECTIONS = [];
const LIST_PANELS = ['lists', 'month', 'shopping'];
const PROJECT_COLORS = ['#dc4c3e', '#eb8909', '#fad000', '#7ecc49', '#299438', '#14aaf5', '#4073ff', '#884dff', '#e05194', '#808080'];

function localGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

async function api(method, url, body) {
  const r = await fetch('/api/' + url, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.status === 204 ? null : r.json();
}
async function load() { state = await api('GET', 'state'); render(); }

// ---------- Dates ----------
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dayDiff = s => Math.round((parseYmd(s) - today()) / 864e5);
const nextMonday = () => { const t = today(); return addDays(t, ((8 - t.getDay()) % 7) || 7); };
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const shortDate = d => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function dueLabel(s) {
  const n = dayDiff(s), d = parseYmd(s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  const opts = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== today().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}
function dueColor(s) {
  const n = dayDiff(s);
  return n < 0 ? 'var(--overdue)' : n === 0 ? 'var(--today)' : n === 1 ? 'var(--tomorrow)' : n < 7 ? 'var(--week)' : 'var(--mute)';
}
const whenLabel = t => `${dueLabel(t.due)}${t.dueTime ? ' · ' + t.dueTime : ''}`;

// ---------- Quick-add parsing ----------
// Pulls dates ("tomorrow", "fri", "next week", "in 3 days", "12 oct"), priority (p1-p4)
// and project (#name) out of the text, the way Todoist's quick add does.
function parseQuickAdd(text) {
  let title = ' ' + text + ' ', due, priority, projectId;
  const take = (re, fn) => { const m = title.match(re); if (m && due === undefined) { const v = fn(m); if (v) { due = v; title = title.replace(m[0], ' '); } } };
  const t = today();

  take(/\s(today|tod)\s/i, () => ymd(t));
  take(/\s(tomorrow|tmrw|tom)\s/i, () => ymd(addDays(t, 1)));
  take(/\snext week\s/i, () => ymd(nextMonday()));
  take(/\sin (\d+) (days?|weeks?)\s/i, m => ymd(addDays(t, +m[1] * (m[2][0].toLowerCase() === 'w' ? 7 : 1))));
  take(/\s(\d{4}-\d{2}-\d{2})\s/, m => m[1]);
  take(/\s(next )?(monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thu|friday|fri|saturday|sunday)\s/i, m => {
    const wd = WEEKDAYS.findIndex(w => w.startsWith(m[2].toLowerCase().slice(0, 3)));
    let n = (wd - t.getDay() + 7) % 7 || 7;
    if (m[1] && n < 7) n += 7;
    return ymd(addDays(t, n));
  });
  const monthDate = (day, mon) => {
    const mi = MONTHS.indexOf(mon.toLowerCase().slice(0, 3));
    if (mi < 0 || day < 1 || day > 31) return null;
    let d = new Date(t.getFullYear(), mi, day);
    if (d < t) d = new Date(t.getFullYear() + 1, mi, day);
    return ymd(d);
  };
  take(/\s(\d{1,2})(?:st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s/i, m => monthDate(+m[1], m[2]));
  take(/\s(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]* (\d{1,2})(?:st|nd|rd|th)?\s/i, m => monthDate(+m[2], m[1]));

  let dueTime;
  const setTime = (h, min, ap) => {
    h = +h; min = min ? +min : 0;
    if (ap) { ap = ap.toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; }
    return (h > 23 || min > 59) ? null : pad(h) + ':' + pad(min);
  };
  const grabTime = (re, fn) => { if (dueTime !== undefined) return; const m = title.match(re); if (m) { const v = fn(m); if (v) { dueTime = v; title = title.replace(m[0], ' '); } } };
  grabTime(/\sat (\d{1,2})(?::(\d{2}))? ?(am|pm)?\s/i, m => setTime(m[1], m[2], m[3]));
  grabTime(/\s(\d{1,2}):(\d{2})\s/, m => setTime(m[1], m[2], null));
  grabTime(/\s(\d{1,2}) ?(am|pm)\s/i, m => setTime(m[1], null, m[2]));

  const p = title.match(/\s[pP]([1-4])\s/);
  if (p) { priority = +p[1]; title = title.replace(p[0], ' '); }

  const h = title.match(/\s#(\S+)\s/);
  if (h) {
    const key = h[1].toLowerCase();
    const proj = state.projects.find(pr => pr.name.toLowerCase().replace(/\s+/g, '') === key)
      || state.projects.find(pr => pr.name.toLowerCase().replace(/\s+/g, '').startsWith(key));
    if (proj) { projectId = proj.id; title = title.replace(h[0], ' '); }
  }
  return { title: title.replace(/\s+/g, ' ').trim(), due, dueTime, priority, projectId };
}

// ---------- Views ----------
const open = () => state.tasks.filter(t => !t.done);
const byPriority = (a, b) => a.priority - b.priority || (a.due || '9').localeCompare(b.due || '9') || a.createdAt - b.createdAt;
const byTime = (a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99') || a.priority - b.priority || a.createdAt - b.createdAt;
const byWhen = (a, b) => a.due.localeCompare(b.due) || (a.dueTime || '').localeCompare(b.dueTime || '') || a.priority - b.priority;
const project = id => state.projects.find(p => p.id === id);
const shoppingList = () => state.projects.find(p => p.name === 'Shopping');
const isTaskView = v => ['today', 'inbox', 'completed'].includes(v) || v.startsWith('project:');

function viewInfo() {
  const t = ymd(today());
  if (view === 'inbox') return { title: 'Inbox', tasks: open().filter(x => !x.projectId), defaults: {} };
  if (view === 'today') return { title: 'Today', sub: today().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), tasks: open().filter(x => x.due && x.due <= t), defaults: { due: t } };
  if (view === 'calendar') { const sel = calSel || ymd(today()); return { title: 'Calendar', calendar: true, tasks: open().filter(x => x.due === sel), defaults: { due: sel } }; }
  if (view === 'completed') return { title: 'Completed', tasks: state.tasks.filter(x => x.done), defaults: {} };
  if (view.startsWith('project:')) {
    const p = project(view.slice(8));
    if (p) return { title: p.name, project: p, tasks: open().filter(x => x.projectId === p.id), defaults: { projectId: p.id } };
  }
  view = 'today'; return viewInfo();
}
const addDefaults = () => LIST_PANELS.includes(panel) ? viewInfo().defaults : {};

function setView(v) { view = v; if (panel === 'lists') localSet('view', v); openId = null; render(); updateChips(); document.getElementById('panelBody').scrollTop = 0; }

// ---------- Rendering ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ICONS = {
  cal: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12"/></svg>',
  tick: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-4.9"/></svg>',
  flag: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h1v12H3zM5 2.5h7.5l-2 3.5 2 3.5H5z"/></svg>',
  clock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function renderTabs() {
  const t = ymd(today());
  const tab = (key, label, n, lead = '') => `<button class="tab ${view === key ? 'on' : ''}" onclick="setView('${key}')">${lead}${label}${n ? `<span class="n">${n}</span>` : ''}</button>`;
  if (panel !== 'lists') return '';
  const overdue = open().some(x => x.due && x.due < t);
  return tab('today', 'Today', open().filter(x => x.due && x.due <= t).length, overdue ? '<span class="dot" style="background:var(--overdue)"></span>' : '') +
    tab('inbox', 'Inbox', open().filter(x => !x.projectId).length) +
    state.projects.map(p => tab('project:' + p.id, esc(p.name), open().filter(x => x.projectId === p.id).length, `<span class="dot" style="background:${esc(p.color)}"></span>`)).join('') +
    tab('completed', 'Completed', 0, '<span style="color:var(--today)">✓</span>') +
    `<button class="tab add" onclick="addProject()">+ List</button>`;
}

const checkHtml = t => `<button class="check" style="--pc:var(--p${t.priority})" onclick="event.stopPropagation(); toggleDone('${t.id}', this)" aria-label="Complete">${ICONS.tick}</button>`;

function taskHtml(t, { hideProject, hideDue, compact } = {}) {
  const p = project(t.projectId);
  const check = checkHtml(t);

  if (t.id === openId) {
    const td = ymd(today()), tm = ymd(addDays(today(), 1)), nw = ymd(nextMonday());
    const custom = t.due && ![td, tm, nw].includes(t.due);
    const dateBtn = (d, label) => `<button class="pill ${t.due === d ? 'on' : ''}" onclick="patch('${t.id}', { due: ${d ? `'${d}'` : 'null'} })">${label}</button>`;
    return `<div class="task open" data-id="${t.id}">
      <div class="row">${check}<div class="body">
        <input class="title-in" value="${esc(t.title)}" onchange="saveTitle('${t.id}', this)" onkeydown="if(event.key==='Enter') this.blur()">
        <textarea class="desc-in" rows="1" placeholder="Add a note" oninput="autosize(this)" onchange="patch('${t.id}', { description: this.value.trim() }, false)">${esc(t.description)}</textarea>
      </div></div>
      <div class="ctl">
        ${dateBtn(td, `<span style="color:var(--today)">${ICONS.cal}</span>Today`)}${dateBtn(tm, 'Tomorrow')}${dateBtn(nw, 'Next week')}
        <label class="pill date ${custom ? 'on' : ''}">${custom ? dueLabel(t.due) : 'Pick date…'}<input type="date" value="${t.due || ''}" onchange="patch('${t.id}', { due: this.value || null })"></label>
        ${t.due ? `<label class="pill time ${t.dueTime ? 'on' : ''}">${ICONS.clock}${t.dueTime || 'Time'}<input type="time" value="${t.dueTime || ''}" onchange="patch('${t.id}', { dueTime: this.value || null })"></label>` : ''}
        ${t.due ? `<button class="pill" onclick="patch('${t.id}', { due: null, dueTime: null })">No date</button>` : ''}
      </div>
      <div class="ctl">
        ${[1, 2, 3, 4].map(n => `<button class="pill ${t.priority === n ? 'on' : ''}" style="--pc:var(--p${n})" onclick="patch('${t.id}', { priority: ${n} })">${ICONS.flag}P${n}</button>`).join('')}
        <select class="pill" onchange="patch('${t.id}', { projectId: this.value || null })"><option value="">📥 Inbox</option>${state.projects.map(pr => `<option value="${pr.id}" ${pr.id === t.projectId ? 'selected' : ''}>● ${esc(pr.name)}</option>`).join('')}</select>
        <button class="pill del" onclick="deleteTask('${t.id}')">Delete</button>
      </div>
    </div>`;
  }

  const meta = [];
  if (t.due && !hideDue) meta.push(`<span style="color:${t.done ? 'var(--mute)' : dueColor(t.due)}">${ICONS.cal}${whenLabel(t)}</span>`);
  else if (t.dueTime) meta.push(`<span style="color:${t.done ? 'var(--mute)' : dueColor(t.due || ymd(today()))}">${ICONS.clock}${t.dueTime}</span>`);
  if (!hideProject && p) meta.push(`<span><span class="dot" style="background:${esc(p.color)};width:7px;height:7px"></span>${esc(p.name)}</span>`);
  return `<div class="task ${t.done ? 'done' : ''}" data-id="${t.id}">
    <div class="row" onclick="toggleOpen('${t.id}')">${check}
      <div class="body"><div class="title">${esc(t.title)}</div>${t.description && !compact ? `<div class="desc">${esc(t.description)}</div>` : ''}${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}</div>
    </div>
  </div>`;
}

function render() {
  renderDashboard();
  if (!LIST_PANELS.includes(panel)) return;
  const v = viewInfo();
  const t = ymd(today());
  let body = '';

  const overdueBlock = list => list.length ? `<div class="section overdue"><span>Overdue · ${list.length}</span><button onclick="rescheduleOverdue()">Move all to today</button></div>` + list.map(x => taskHtml(x)).join('') : '';

  if (view === 'today') {
    const overdue = v.tasks.filter(x => x.due < t).sort(byPriority);
    const due = v.tasks.filter(x => x.due === t).sort(byTime);
    body += overdueBlock(overdue);
    if (overdue.length && due.length) body += `<div class="section"><span>Today</span></div>`;
    body += due.map(x => taskHtml(x, { hideDue: true })).join('');
    if (!v.tasks.length) body += `<div class="empty"><div class="big">🎉</div>All clear for today.</div>`;
  } else if (view === 'calendar') {
    body += renderCalendar();
  } else if (view === 'completed') {
    const done = v.tasks.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    let lastDay = null;
    for (const x of done) {
      const day = x.completedAt ? ymd(new Date(x.completedAt)) : null;
      if (day !== lastDay) {
        const name = !day ? 'Earlier' : dayDiff(day) === 0 ? 'Today' : dayDiff(day) === -1 ? 'Yesterday' : parseYmd(day).toLocaleDateString(undefined, { weekday: 'long' });
        body += `<div class="section"><span>${name}${day ? ` <span class="muted">· ${shortDate(parseYmd(day))}</span>` : ''}</span></div>`;
        lastDay = day;
      }
      body += taskHtml(x, { hideDue: true });
    }
    if (!done.length) body += `<div class="empty"><div class="big">✓</div>Nothing completed yet.</div>`;
  } else {
    body += v.tasks.sort(byPriority).map(x => taskHtml(x, { hideProject: !!v.project })).join('');
    if (!v.tasks.length) body += `<div class="empty"><div class="big">${v.project ? '✨' : '📥'}</div>Nothing here. Tap Add task to add one.</div>`;
  }

  const tools = v.project ? `<div class="tools"><button onclick="renameProject('${v.project.id}')">Rename</button><button onclick="deleteProject('${v.project.id}')">Delete</button></div>` : '';
  document.getElementById('panelTitle').textContent = v.title;
  document.getElementById('panelBody').innerHTML = `<div class="wrap">${panel === 'lists' ? `<nav class="tabs">${renderTabs()}</nav>` : ''}${v.sub || tools ? `<div class="head">${v.sub ? `<span class="sub">${v.sub}</span>` : ''}${tools}</div>` : ''}${body}</div>`;
  document.querySelector('#panelBody .tab.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  document.querySelectorAll('.desc-in').forEach(autosize);
}

function autosize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

// ---------- Calendar ----------
const CHEV = dir => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${dir < 0 ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'}"/></svg>`;
const WDS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function renderCalendar() {
  if (!calAnchor) calAnchor = new Date(today().getFullYear(), today().getMonth(), 1);
  if (!calSel) calSel = ymd(today());
  const y = calAnchor.getFullYear(), m = calAnchor.getMonth();
  const monthName = calAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const startDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const gridStart = addDays(new Date(y, m, 1), -startDow);

  const byDay = {};
  open().forEach(x => { if (x.due) (byDay[x.due] ||= []).push(x); });
  const tds = ymd(today());

  let cells = WDS.map(w => `<div class="cal-wd">${w}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i), ds = ymd(d);
    const cls = [d.getMonth() !== m ? 'dim' : '', ds === tds ? 'today' : '', ds === calSel ? 'sel' : ''].join(' ');
    const dots = (byDay[ds] || []).slice(0, 3).map(x => `<i style="background:var(--p${x.priority})"></i>`).join('');
    cells += `<button class="cal-day ${cls}" onclick="selectDay('${ds}')"><span class="dnum">${d.getDate()}</span><span class="dots">${dots}</span></button>`;
  }

  const n = dayDiff(calSel), sd = parseYmd(calSel);
  const rel = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : '';
  const full = sd.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const list = (byDay[calSel] || []).sort(byTime);
  const dayList = `<div class="section"><span>${rel || full}${rel ? ` <span class="muted">· ${full}</span>` : ''}</span></div>`
    + (list.length ? list.map(x => taskHtml(x, { hideDue: true })).join('') : `<div class="empty">Nothing on this day. Tap Add task to add one.</div>`);

  return `<div class="calbar"><h2>${monthName}</h2><div class="nav">
      <button onclick="calMove(-1)" aria-label="Previous month">${CHEV(-1)}</button>
      <button class="todaybtn" onclick="calToday()">Today</button>
      <button onclick="calMove(1)" aria-label="Next month">${CHEV(1)}</button>
    </div></div>
    <div class="cal-grid">${cells}</div>${dayList}`;
}

function selectDay(ds) { calSel = ds; openId = null; render(); updateChips(); }
function calMove(n) { calAnchor = new Date(calAnchor.getFullYear(), calAnchor.getMonth() + n, 1); render(); }
function calToday() { calAnchor = new Date(today().getFullYear(), today().getMonth(), 1); calSel = ymd(today()); openId = null; render(); updateChips(); }

// ---------- Quick add ----------
const qa = document.getElementById('qa');
function updateChips() {
  const p = parseQuickAdd(qa.value);
  const d = addDefaults();
  let due = p.due || (qa.value.trim() && d.due);
  if (p.dueTime && !due) due = ymd(today());
  const proj = p.projectId || d.projectId;
  const chips = [];
  if (due) chips.push(`<span class="chip" style="color:${dueColor(due)}">${ICONS.cal}${dueLabel(due)}${p.dueTime ? ' · ' + p.dueTime : ''}</span>`);
  if (p.priority) chips.push(`<span class="chip" style="color:var(--p${p.priority})">${ICONS.flag}P${p.priority}</span>`);
  if (qa.value.trim() && proj) { const pr = project(proj); chips.push(`<span class="chip"><span class="dot" style="background:${esc(pr.color)}"></span>${esc(pr.name)}</span>`); }
  document.getElementById('chips').innerHTML = chips.join('');
  document.getElementById('qaGo').disabled = !p.title;
}
qa.addEventListener('input', updateChips);

function openSheet() {
  document.body.classList.add('adding');
  qa.focus();   // must happen inside the tap for iOS to raise the keyboard
  updateChips();
}
function closeSheet() {
  document.body.classList.remove('adding');
  qa.blur();
}
document.getElementById('addBtn').addEventListener('click', openSheet);
document.getElementById('scrim').addEventListener('click', closeSheet);
// Keep the sheet sitting on top of the on-screen keyboard.
if (window.visualViewport) {
  const sheet = document.getElementById('sheet');
  const place = () => { sheet.style.bottom = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop) + 'px'; };
  visualViewport.addEventListener('resize', place);
  visualViewport.addEventListener('scroll', place);
}
document.getElementById('qaForm').addEventListener('submit', async e => {
  e.preventDefault();
  const p = parseQuickAdd(qa.value);
  if (!p.title) return;
  const task = { ...addDefaults(), title: p.title };
  if (p.due) task.due = p.due;
  if (p.priority) task.priority = p.priority;
  if (p.projectId) task.projectId = p.projectId;
  if (p.dueTime) { task.dueTime = p.dueTime; if (!task.due) task.due = ymd(today()); }
  qa.value = ''; updateChips(); qa.focus();
  await api('POST', 'tasks', task);
  await load();
  // Say where it went if it landed outside the current view.
  const visible = LIST_PANELS.includes(panel) && viewInfo().tasks.some(x => x.title === task.title);
  if (!visible) toast(`Added to ${task.projectId ? project(task.projectId).name : task.due ? dueLabel(task.due) : 'Inbox'}`);
});

// ---------- Task actions ----------
let toastTimer;
function toast(msg, undo) {
  document.getElementById('toastMsg').textContent = msg;
  const el = document.getElementById('toast'), btn = document.getElementById('toastUndo');
  btn.style.display = undo ? '' : 'none';
  btn.onclick = async () => { el.classList.remove('show'); await undo(); };
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

function saveTitle(id, el) {
  const title = el.value.trim();
  if (title) patch(id, { title }, false); else el.value = state.tasks.find(x => x.id === id).title;
}

function toggleOpen(id) { openId = openId === id ? null : id; render(); }

async function patch(id, fields, rerender = true) {
  const t = state.tasks.find(x => x.id === id);
  Object.assign(t, fields);
  if (rerender) render();
  await api('PATCH', 'tasks/' + id, fields);
}

async function toggleDone(id, btn) {
  const t = state.tasks.find(x => x.id === id);
  if (!t.done) {
    btn.closest('.task').classList.add('completing');
    if (navigator.vibrate) navigator.vibrate(10);
    await new Promise(r => setTimeout(r, 300));
  }
  if (openId === id) openId = null;
  await api('PATCH', 'tasks/' + id, { done: !t.done });
  await load();
  if (!t.done) toast('Completed', async () => { await api('PATCH', 'tasks/' + id, { done: false }); await load(); });
}

async function deleteTask(id) {
  const copy = { ...state.tasks.find(x => x.id === id) };
  openId = null;
  await api('DELETE', 'tasks/' + id); await load();
  toast('Deleted', async () => { await api('POST', 'tasks', copy); await load(); });
}

async function rescheduleOverdue() {
  const t = ymd(today());
  const overdue = open().filter(x => x.due && x.due < t);
  await Promise.all(overdue.map(x => api('PATCH', 'tasks/' + x.id, { due: t })));
  await load();
  toast(`Moved ${overdue.length} to today`);
}

// ---------- Projects ----------
async function addProject() {
  const name = prompt('New list name');
  if (!name?.trim()) return;
  const p = await api('POST', 'projects', { name, color: PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length] });
  await load(); setView('project:' + p.id);
}
async function renameProject(id) {
  const name = prompt('Rename list', project(id).name);
  if (!name?.trim()) return;
  await api('PATCH', 'projects/' + id, { name: name.trim() }); await load();
}
async function deleteProject(id) {
  if (!confirm(`Delete "${project(id).name}"? Its tasks move to Inbox.`)) return;
  await api('DELETE', 'projects/' + id); setView('inbox'); await load();
}
