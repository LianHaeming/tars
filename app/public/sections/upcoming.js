SECTIONS.push({
  id: 'upcoming',
  html() {
    const t = ymd(today()), next = SECTIONS.find(s => s.id === 'next').item();
    const items = open().filter(x => x.due && x !== next).sort(byWhen);
    return `<div class="sec"><span>Upcoming</span><button class="sec-link" onclick="openPanel('month')">Month ›</button></div>
      ${items.map(x => taskHtml(x, { compact: true })).join('') || `<div class="sec-empty">Nothing else dated${next ? '' : ' coming up'}.</div>`}`;
  },
});
