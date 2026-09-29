CARDS.push({
  id: 'food', label: 'Food',
  summary() {
    let picked = 0;
    try { picked = (JSON.parse(localStorage.getItem('basket') || '{}').ids || []).length; } catch {}
    const list = shoppingList();
    const left = list ? open().filter(x => x.projectId === list.id).length : 0;
    return `<div class="card-num">${left}<span>to buy</span></div>
      <div class="card-sub">${picked ? `${picked} dish${picked > 1 ? 'es' : ''} picked` : 'Pick this week’s dishes'}</div>`;
  },
  open() { openPanel('food'); },
});
