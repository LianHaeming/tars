SECTIONS.push({
  id: 'actions',
  html() {
    let picked = 0;
    try { picked = (JSON.parse(localStorage.getItem('basket') || '{}').ids || []).length; } catch {}
    const list = shoppingList();
    const left = list ? open().filter(x => x.projectId === list.id).length : 0;
    return `<div class="acts">
      <button class="glass act" onclick="openPanel('food')"><span class="ic">🍽</span><span><b>Food</b><small>${picked ? `${picked} dish${picked > 1 ? 'es' : ''} picked` : 'Pick dishes'}</small></span></button>
      <button class="glass act" onclick="openPanel('shopping')"><span class="ic">🛒</span><span><b>Shopping</b><small>${left} to buy</small></span></button>
    </div>`;
  },
});
