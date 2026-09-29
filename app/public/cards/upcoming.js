CARDS.push({
  id: 'upcoming', label: 'Upcoming',
  summary() {
    const t = ymd(today()), week = ymd(addDays(today(), 7));
    const dated = open().filter(x => x.due && x.due >= t).sort(byWhen);
    const overdue = open().filter(x => x.due && x.due < t).length;
    const rows = dated.slice(0, 3).map(x => `<div class="mini"><span class="mini-when" style="color:${dueColor(x.due)}">${esc(dayDiff(x.due) === 0 ? 'Today' : dayDiff(x.due) === 1 ? 'Tmrw' : dayDiff(x.due) < 7 ? dueLabel(x.due).slice(0, 3) : shortDate(parseYmd(x.due)))}</span><span class="mini-title">${esc(x.title)}</span></div>`).join('');
    return `<div class="card-num">${dated.filter(x => x.due < week).length}<span>this week</span></div>
      ${overdue ? `<div class="card-sub" style="color:var(--overdue)">${overdue} overdue</div>` : ''}${rows}`;
  },
  open() { openPanel('upcoming'); },
});
