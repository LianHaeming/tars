const $ = s => document.querySelector(s);
const panelEl = $('#panel'), panelBody = $('#panelBody');

function renderDashboard() {
  const h = new Date().getHours();
  $('#hello').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('#date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  $('#cards').innerHTML = CARDS.map(c => `<article class="card ${c.wide ? 'wide' : ''}" onclick="openCard('${c.id}')">
    <header class="card-head"><span class="card-label">${c.label}</span><span class="card-go">›</span></header>${c.summary()}</article>`).join('');
}

function openCard(id) { CARDS.find(c => c.id === id).open(); }

function openPanel(kind) {
  panel = kind;
  openId = null;
  if (kind === 'tasks' && !isTaskView(view)) view = 'today';
  if (kind === 'upcoming' && !isUpcomingView(view)) view = 'upcoming';
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
$('#panelScrim').addEventListener('click', closePanel);

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
  const typing = e.target.closest('input, textarea, select');
  if ((e.key === 'q' || e.key === '/') && !typing && panel !== 'food') { e.preventDefault(); openSheet(); }
  if (e.key === 'Escape') {
    if (document.body.classList.contains('adding')) closeSheet();
    else if (openId) { openId = null; render(); }
    else if (panel) closePanel();
  }
});
// Pick up changes made on another device when you come back to the tab.
document.addEventListener('visibilitychange', () => { if (!document.hidden && !document.activeElement.closest('.task.open, .sheet')) load(); });
setInterval(() => { if (!panel && !document.hidden) renderDashboard(); }, 60000);

load().then(updateChips);
