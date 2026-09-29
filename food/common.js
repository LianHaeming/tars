const R = window.RECIPES || [];
const BY_ID = new Map(R.map(r => [r.id, r]));
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const tagline = r => [r.cf === "Other" ? "" : r.cs || r.cf, r.cu === "Other" ? "" : r.cu, r.p].filter(Boolean).map(esc).join(" · ");
const meta = r => [r.m ? `${r.m} min` : "", r.k ? `${r.k} kcal` : ""].filter(Boolean).join(" · ");

// ---------- recipe details: one small script per recipe, loaded on demand (works from file://) ----------
const details = {}, waiting = {};
window.__recipe = d => { waiting[d.id]?.(d); delete waiting[d.id]; };
function loadDetail(id) {
  return details[id] ??= new Promise((resolve, reject) => {
    waiting[id] = resolve;
    const s = document.createElement("script");
    s.src = `data/r/${id}.js`;
    s.onerror = () => { delete details[id]; reject(); };
    s.onload = () => s.remove();
    document.head.appendChild(s);
  });
}

// ---------- shop views: the product matched to each ingredient (sainsburys.json, ocado.json) ----------
const byName = o => o && Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));
const SHOPS = [
  { id: "sainsburys", label: "Sainsbury's", data: byName(window.SAINSBURYS), link: e => `https://www.sainsburys.co.uk/gol-ui/product/${e.slug}` },
  { id: "ocado", label: "Ocado", data: byName(window.OCADO), link: e => e.url },
].filter(s => s.data);
let shop = null;
try {
  const saved = localStorage.getItem("shop") ?? (localStorage.getItem("sainsburys") === "1" ? "sainsburys" : "");
  shop = SHOPS.find(s => s.id === saved) || null;
} catch {}
function setShop(id) {
  shop = SHOPS.find(s => s.id === id) || null;
  try { localStorage.setItem("shop", shop?.id || ""); localStorage.removeItem("sainsburys"); } catch {}
}
const shopEntry = buy => buy && shop?.data[buy.toLowerCase()];
const shopSwitch = () => SHOPS.length ? `<div class="seg" role="group" aria-label="Ingredient names">
  <button data-shop="" class="${shop ? "" : "on"}">Recipe</button>${SHOPS.map(s =>
    `<button data-shop="${s.id}" class="${shop === s ? "on" : ""}">${esc(s.label)}</button>`).join("")}</div>` : "";
function shopName(buy, fallback, price = true) {
  const e = shopEntry(buy);
  if (!e) return esc(fallback);
  const note = e.swap ? `<span class="sb-note">⇄ ${esc(e.note)}</span>` : "";
  if (!e.n) return `<span><s>${esc(fallback)}</s>${note}</span>`;
  return `<span><a href="${esc(shop.link(e))}" target="_blank" rel="noopener">${esc(e.n)}</a>
    ${price ? `<span class="muted">£${e.pr.toFixed(2)}</span>` : ""}${note}</span>`;
}
function shopPacks(e, units, dishes) {
  if (e.perDish) return Math.ceil(dishes / (e.ea || 1));
  let g = 0, n = 0, p = 0;
  for (const [u, q] of units) {
    if (u === "g" || u === "ml") g += q;
    else if (u === "tbsp") g += q * 15;
    else if (u === "tsp") g += q * 5;
    else if (["", "nest", "pot"].includes(u)) n += q;
    else if (["carton", "bunch"].includes(u)) p += Math.ceil(q);
    else p = Math.max(p, 1);
  }
  if (g && e.g) p = Math.max(p, Math.ceil(g / e.g));
  if (n) p = Math.max(p, Math.ceil(n / (e.ea || 1)));
  return Math.max(p, 1);
}

// Times and temperatures in the method, e.g. "5-6 mins", "30 secs", "200°C"
const timings = html => html.replace(/\b\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+)?\s?(?:mins?|minutes|secs?|seconds|hrs?|hours)\b|\b\d+\s?°[CF]/gi,
  m => `<span class="time">${m}</span>`);

// Step text is pre-cleaned by the build; keep only safe formatting tags anyway.
function safeHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const ok = new Set(["STRONG", "EM"]);
  (function walk(node) {
    for (const el of [...node.children]) {
      walk(el);
      if (!ok.has(el.tagName)) el.replaceWith(...el.childNodes);
      else [...el.attributes].forEach(a => el.removeAttribute(a.name));
    }
  })(doc.body);
  return doc.body.innerHTML;
}

// ---------- recipe popup: ingredients for 2; the method only when asked for ----------
const dlg = document.createElement("dialog");
document.body.appendChild(dlg);
dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest(".close")) dlg.close(); });

// UK reference intakes for an adult (the "RI" on food labels)
const RI = { "Energy (kcal)": 2000, "Protein": 50, "Carbohydrate": 260, "of which sugars": 90, "Fat": 70,
  "of which saturates": 20, "Dietary Fibre": 30, "Salt": 6 };
const NUTRIENT_TILES = [["Energy (kcal)", "Energy"], ["Protein", "Protein"], ["Carbohydrate", "Carbs", "of which sugars", "sugars"],
  ["Fat", "Fat", "of which saturates", "saturates"], ["Dietary Fibre", "Fibre"], ["Salt", "Salt"]];
function nutrition(rows) {
  const n = Object.fromEntries(rows.map(([name, amount, unit]) => [name, { amount, unit }]));
  const pct = name => n[name] && RI[name] ? Math.round(100 * n[name].amount / RI[name]) : null;
  const tiles = NUTRIENT_TILES.filter(([key]) => n[key]).map(([key, label, subKey, subLabel]) => {
    const p = pct(key), sub = subKey && n[subKey];
    return `<div class="nt">
      <div class="nt-label">${label}</div>
      <div class="nt-val">${esc(n[key].amount)}<span>${esc(n[key].unit)}</span></div>
      ${p != null ? `<div class="nt-bar"><i style="width:${Math.min(100, p)}%"></i></div><div class="nt-sub">${p}% RI</div>` : ""}
      ${sub ? `<div class="nt-sub">${subLabel} ${esc(sub.amount)} ${esc(sub.unit)}${pct(subKey) != null ? ` · ${pct(subKey)}% RI` : ""}</div>` : ""}
    </div>`;
  });
  return tiles.length ? `<div class="nt-grid">${tiles.join("")}</div>
    <p class="muted nt-foot">Per serving. RI = an adult's daily reference intake.</p>`
    : `<p class="muted">No nutrition information for this dish.</p>`;
}

// `list` (optional): { has: () => bool, toggle: () => void } for the shopping-list button
async function openRecipe(r, list) {
  let d;
  try { d = await loadDetail(r.id); } catch { return; }
  const panels = {
    Ingredients: () => `<div class="panelhead"><span class="muted">For 2 servings</span>${shopSwitch()}</div>
      <ul class="ing">${d.ingredients.map(i => `<li>
        ${i.img ? `<img loading="lazy" src="${esc(i.img)}" alt="">` : `<span class="noimg"></span>`}
        <span class="amt">${esc(i.amount)}</span><span class="nm">${shop ? shopName(i.buy, i.name) : esc(i.name)}</span></li>`).join("")}</ul>`,
    Method: () => `<ol class="steps">${d.steps.map((s, i) => `
      <li>${s.image ? `<img loading="lazy" src="${esc(s.image)}" alt="">` : "<div></div>"}
        <div>
          <div class="step-title"><span class="step-n">${i + 1}</span>${esc(s.title)}</div>
          <ul class="points">${s.points.map(p => `<li>${timings(safeHtml(p))}</li>`).join("")}</ul>
          ${s.notes.map(n => `<div class="note ${n.kind}"><b>${n.kind === "tip" ? "Tip" : "Important"}</b>${timings(safeHtml(n.text))}</div>`).join("")}
        </div></li>`).join("")}</ol>`,
    Nutrition: () => nutrition(d.nutrition),
  };
  let panel = "Ingredients";
  const listButton = () => {
    if (!list) return "";
    const on = list.has();
    return `<button class="listbtn${on ? " on" : ""}" id="listToggle" aria-pressed="${on}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8h13l-1.2 12.5H6.7L5.5 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>
        ${on ? `<path d="M9.3 14.3l1.9 1.9 3.6-3.9"/>` : `<path d="M12 11.5v5.5M9.25 14.25h5.5"/>`}</svg>
      <span class="lb-text">${on ? "On your list" : "Add to list"}</span>${on ? `<span class="lb-hover">Remove</span>` : ""}</button>`;
  };
  dlg.innerHTML = `
    <div class="hero"><img src="${esc(d.photo)}" alt="" onerror="this.onerror=null; this.src='${esc(r.img)}'"><button class="close" aria-label="Close">×</button></div>
    <div class="detail">
      <div class="titlerow">
        <div class="grow">
          <div class="tagline">${tagline(r)}</div>
          <h2>${esc(r.n)}</h2>
          <div class="sub">${esc(r.h)}</div>
          <div class="muted" style="margin-top:6px">${meta(r)}</div>
        </div>
        <span id="listSlot">${listButton()}</span>
      </div>
      <nav class="tabs" role="tablist">${Object.keys(panels).map(p =>
        `<button role="tab" class="${p === panel ? "on" : ""}" data-panel="${p}">${p}</button>`).join("")}</nav>
      <div id="panel">${panels[panel]()}</div>
    </div>`;
  const render = () => { dlg.querySelector("#panel").innerHTML = panels[panel](); };
  dlg.querySelector(".tabs").onclick = e => {
    const b = e.target.closest("[data-panel]");
    if (!b) return;
    panel = b.dataset.panel;
    dlg.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b));
    render();
  };
  dlg.querySelector("#panel").onclick = e => {
    const b = e.target.closest("[data-shop]");
    if (b) { setShop(b.dataset.shop); render(); }
  };
  dlg.querySelector("#listSlot").onclick = e => {
    if (!e.target.closest("#listToggle")) return;
    list.toggle();
    dlg.querySelector("#listSlot").innerHTML = listButton();
    dlg.querySelector("#listToggle").classList.add("pop");
  };
  dlg.showModal();
  dlg.scrollTop = 0;
}
