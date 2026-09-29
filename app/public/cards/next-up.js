CARDS.push({
  id: 'next', label: 'Next up', wide: true,
  item() {
    const t = ymd(today()), now = hhmm(new Date());
    return open().filter(x => x.due && (x.due > t || (x.due === t && (!x.dueTime || x.dueTime >= now)))).sort(byWhen)[0];
  },
  countdown(x) {
    if (x.due !== ymd(today())) return whenLabel(x);
    if (!x.dueTime) return 'Today';
    const [h, m] = x.dueTime.split(':').map(Number);
    const mins = Math.max(0, Math.round((new Date().setHours(h, m, 0, 0) - Date.now()) / 6e4));
    return mins < 60 ? `in ${mins} min` : `in ${Math.floor(mins / 60)} h ${pad(mins % 60)} min`;
  },
  summary() {
    const x = this.item();
    if (!x) return `<div class="card-big">Nothing scheduled</div><div class="card-sub">Dated tasks show up here.</div>`;
    const where = x.description.split('\n')[0];
    return `<div class="card-when" style="color:${dueColor(x.due)}">${esc(this.countdown(x))}${x.due === ymd(today()) && x.dueTime ? ` · ${x.dueTime}` : ''}</div>
      <div class="card-big">${esc(x.title)}</div>${where ? `<div class="card-sub">${esc(where)}</div>` : ''}`;
  },
  open() { openPanel('upcoming'); },
});
