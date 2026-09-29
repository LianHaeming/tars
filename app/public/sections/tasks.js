SECTIONS.push({
  id: 'tasks',
  html() {
    const shop = shoppingList()?.id;
    const items = open().filter(x => !x.due && x.projectId !== shop).sort(byPriority);
    return `<div class="sec"><span>Tasks <span class="muted">${items.length}</span></span><button class="sec-link" onclick="openPanel('lists')">All lists ›</button></div>
      ${items.map(x => taskHtml(x, { compact: true })).join('') || '<div class="sec-empty">All clear.</div>'}`;
  },
});
