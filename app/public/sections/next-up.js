SECTIONS.push({
  id: 'next',
  item() {
    const t = ymd(today()), now = hhmm(new Date());
    return open().filter(x => x.due && (x.due > t || (x.due === t && (!x.dueTime || x.dueTime >= now)))).sort(byWhen)[0];
  },
  countdown(x) {
    if (x.due !== ymd(today())) return whenLabel(x);
    if (!x.dueTime) return 'Today';
    const [h, m] = x.dueTime.split(':').map(Number);
    const mins = Math.max(0, Math.round((new Date().setHours(h, m, 0, 0) - Date.now()) / 6e4));
    return `${x.dueTime} · in ${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${pad(mins % 60)} min`}`;
  },
  html() {
    const x = this.item();
    if (!x) return `<div class="glass hero"><div class="hero-when">Next up</div><div class="hero-title">Nothing scheduled</div></div>`;
    const where = x.description.split('\n')[0];
    return `<button class="glass hero" onclick="openMonth('${x.due}')">
      <div class="hero-when" style="color:${dueColor(x.due)}">${esc(this.countdown(x))} · Next up</div>
      <div class="hero-title">${esc(x.title)}</div>${where ? `<div class="hero-sub">${esc(where)}</div>` : ''}</button>`;
  },
});
