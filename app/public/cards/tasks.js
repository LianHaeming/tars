CARDS.push({
  id: 'tasks', label: 'Tasks', wide: true,
  summary() {
    const t = ymd(today()), shop = shoppingList()?.id;
    const due = open().filter(x => x.due && x.due <= t).sort((a, b) => byWhen(a, b));
    const rest = open().filter(x => !x.due && x.projectId !== shop).sort(byPriority);
    const rows = [...due, ...rest].slice(0, 5).map(x => `<div class="task mini" data-id="${x.id}">${checkHtml(x)}<span class="mini-title">${esc(x.title)}</span>${x.due ? `<span class="mini-when" style="color:${dueColor(x.due)}">${esc(x.due < t ? 'Overdue' : x.dueTime || 'Today')}</span>` : ''}</div>`).join('');
    return `<div class="card-num">${due.length}<span>due today</span></div>${rows || '<div class="card-sub">All clear.</div>'}`;
  },
  open() { openPanel('tasks'); },
});
