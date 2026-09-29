const $ = s => document.querySelector(s);
const panelEl = $('#panel'), panelBody = $('#panelBody');
const editing = () => document.activeElement?.closest('input, textarea, select');

function renderDashboard() {
  $('#date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  $('#home').innerHTML = SECTIONS.map(s => `<section class="s-${s.id}">${s.html()}</section>`).join('');
  document.querySelectorAll('#home .desc-in').forEach(autosize);
}

async function openPanel(kind) {
  if (kind === 'shopping' && !shoppingList()) {
    await api('POST', 'projects', { name: 'Shopping', color: '#25b84c' });
    state = await api('GET', 'state');
  }
  panel = kind;
  openId = null;
  if (kind === 'lists') { const v = localGet('view'); view = v && isTaskView(v) ? v : 'today'; }
  if (kind === 'month') view = 'calendar';
  if (kind === 'shopping') view = 'project:' + shoppingList().id;
  document.body.classList.add('panel-open');
  document.body.classList.toggle('panel-food', kind === 'food');
  if (kind === 'food') {
    $('#panelTitle').textContent = 'Food';
    panelBody.innerHTML = '<iframe class="food" src="/food/app/index.html" title="Food menu"></iframe>';
  }
  panelBody.scrollTop = 0;
  render();
  updateChips();
}

function openMonth(ds) {
  calSel = ds;
  const d = parseYmd(ds);
  calAnchor = new Date(d.getFullYear(), d.getMonth(), 1);
  openPanel('month');
}

function closePanel() {
  panel = null;
  openId = null;
  panelEl.style.transform = '';
  document.body.classList.remove('panel-open', 'panel-food');
  setTimeout(() => { if (!panel) panelBody.innerHTML = ''; }, 300);
  updateChips();
  load();
}

$('#panelClose').addEventListener('click', closePanel);
$('#panelScrim').addEventListener('click', () => document.body.classList.contains('asking') ? closeAsk() : closePanel());

let dragFrom = null;
$('#panelHead').addEventListener('touchstart', e => { dragFrom = e.touches[0].clientY; panelEl.style.transition = 'none'; }, { passive: true });
$('#panelHead').addEventListener('touchmove', e => {
  if (dragFrom === null) return;
  panelEl.style.transform = `translateY(${Math.max(0, e.touches[0].clientY - dragFrom)}px)`;
}, { passive: true });
$('#panelHead').addEventListener('touchend', e => {
  if (dragFrom === null) return;
  const moved = e.changedTouches[0].clientY - dragFrom;
  dragFrom = null;
  panelEl.style.transition = '';
  if (moved > 110) closePanel(); else panelEl.style.transform = '';
});

document.addEventListener('keydown', e => {
  if ((e.key === 'q' || e.key === '/') && !editing() && panel !== 'food' && !document.body.classList.contains('asking')) { e.preventDefault(); openSheet(); }
  if (e.key === 'Escape') {
    if (document.body.classList.contains('adding')) closeSheet();
    else if (document.body.classList.contains('asking')) closeAsk();
    else if (openId) { openId = null; render(); }
    else if (panel) closePanel();
  }
});
// Pick up changes made on another device when you come back to the tab.
document.addEventListener('visibilitychange', () => { if (!document.hidden && !editing() && !document.activeElement.closest('.task.open')) load(); });
setInterval(() => { if (!document.hidden && !editing() && !openId) renderDashboard(); }, 60000);

load().then(updateChips);
