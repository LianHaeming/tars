const { execFile } = require('child_process');
const path = require('path');
const store = require('./state');
const { runClaude } = require('@tars/server');

const MONZO = path.join(__dirname, '..', '..', '..', '..', 'bin', 'monzo');
const FRESH_MS = 2 * 60 * 1000;
const DAY = 864e5;
let cached = null;
let inflight = null;

function load() {
  return inflight ??= new Promise((resolve, reject) => {
    execFile(MONZO, ['json'], { timeout: 60000, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      inflight = null;
      if (err) return reject(new Error((stderr || err.message).trim()));
      try { cached = JSON.parse(stdout); resolve(cached); } catch (e) { reject(e); }
    });
  });
}

async function money(force, maxAge = FRESH_MS) {
  if (!force && cached && Date.now() - cached.fetchedAt < maxAge) return cached;
  return load();
}

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; };
const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const KIND = { bacs: 'Direct debit', mastercard: 'Card', '3dsecure': 'Card', payport_faster_payments: 'Transfer', p2p_payment: 'Transfer', monzo_paid: 'Monzo' };

function nextMonth(d) {
  const day = d.getDate();
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  n.setDate(Math.min(day, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()));
  return n;
}

function series(data) {
  const groups = new Map();
  for (const t of data.transactions) {
    if (t.declined || t.scheme === 'uk_retail_pot' || !t.amount || !t.name) continue;
    const key = `${t.amount < 0 ? 'out' : 'in'}:${t.name.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const today = startOfDay(Date.now());
  const near = (a, b) => Math.abs(a - b) <= Math.abs(b) * 0.05;

  function pattern(ts, crowd = ts.length) {
    if (ts.length < 2) return null;
    const days = ts.map(t => startOfDay(t.created));
    const gaps = days.slice(1).map((d, i) => Math.round((d - days[i]) / DAY));
    const monthly = gaps.every(g => g >= 25 && g <= 35);
    const weekly = ts.length >= 3 && gaps.every(g => g >= 6 && g <= 8);
    if (!monthly && !weekly) return null;
    const last = ts.at(-1);
    const same = ts.every(t => near(t.amount, last.amount));
    if (ts.length === 2 && last.scheme !== 'bacs' && (!same || crowd > 6)) return null;
    return { ts, days, monthly, same, last, period: monthly ? median(gaps) : 7 };
  }

  const found = [];
  for (const [key, ts] of groups) {
    ts.sort((a, b) => a.created.localeCompare(b.created));
    const whole = pattern(ts);
    if (whole) { found.push([key, whole]); continue; }
    const clusters = [];
    for (const t of ts) (clusters.find(c => near(t.amount, c[0].amount)) ?? clusters[clusters.push([]) - 1]).push(t);
    for (const c of clusters) { const p = pattern(c, ts.length); if (p) found.push([`${key}:${c[0].amount}`, p]); }
  }

  return found
    .filter(([, p]) => today - p.days.at(-1) <= p.period * 1.5 * DAY)
    .map(([key, { days, monthly, same, last, period, ts }]) => {
      const typical = median(ts.map(t => t.amount));
      return {
        key, days, period, name: last.name, amount: last.amount, varies: !same, seen: ts.length,
        kind: last.amount > 0 ? 'Income' : KIND[last.scheme] || 'Payment',
        cadence: monthly ? 'monthly' : 'weekly', logo: last.logo, category: last.category,
        perMonth: Math.round(monthly ? typical : typical * 52 / 12), lastOn: ymd(days.at(-1)),
      };
    });
}

function predict(list, horizonDays = 90) {
  const today = startOfDay(Date.now());
  const end = new Date(+today + horizonDays * DAY);
  const out = [];
  for (const { key, days, period, ...r } of list) {
    const step = d => (r.cadence === 'monthly' ? nextMonth(d) : new Date(+d + 7 * DAY));
    let first = true;
    for (let d = step(days.at(-1)); d <= end; d = step(d), first = false) {
      const late = d < today;
      if (late && !(first && today - d <= period * 0.5 * DAY)) continue;
      out.push({
        id: `${key}|${ymd(d)}`, key, date: ymd(late ? today : d), expectedOn: ymd(d), late,
        name: r.name, amount: r.amount, varies: r.varies, seen: r.seen, kind: r.kind,
        cadence: r.cadence, logo: r.logo, category: r.category, group: r.group,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

const londonDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const favicon = domain => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
const GROUPS = ['Home & bills', 'Subscriptions', 'Insurance', 'Transport', 'Food', 'People', 'Other', 'Income'];

function habits(data, recurringKeys) {
  const months = 89 / 30.4;
  const by = new Map();
  for (const t of data.transactions) {
    if (t.declined || !t.spending || t.amount >= 0 || t.name.startsWith('pot_')) continue;
    const k = t.name.trim().toLowerCase();
    if (recurringKeys.has(`out:${k}`)) continue;
    const m = by.get(k) ?? { name: t.name, category: t.category, count: 0, total: 0, last: '' };
    m.count++; m.total -= t.amount; m.last = t.created.slice(0, 10);
    by.set(k, m);
  }
  const cats = new Map();
  for (const t of data.transactions) if (!t.declined && t.spending && t.amount < 0) cats.set(t.category, (cats.get(t.category) ?? 0) - t.amount);
  return {
    places: [...by.values()].sort((a, b) => b.total - a.total).slice(0, 25)
      .map(m => ({ ...m, perMonth: Math.round(m.total / months) })),
    categoriesPerMonth: Object.fromEntries([...cats].sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, Math.round(v / months)])),
  };
}

function prompt(list, h) {
  const rec = list.map(r => ({ key: r.key, name: r.name, amountPennies: r.amount, perMonthPennies: r.perMonth, cadence: r.cadence, kind: r.kind, monzoCategory: r.category, timesSeen: r.seen }));
  return `You are looking at 89 days of Lian's Monzo current account (UK, amounts in pennies, negative = money out). Today is ${londonDay()}.

Repeating payments detected:
${JSON.stringify(rec)}

Other spending, by place (not repeating), with monthly average:
${JSON.stringify(h.places)}

Monthly spend by Monzo category:
${JSON.stringify(h.categoriesPerMonth)}

1. For EVERY repeating payment, give a clean display name (e.g. "Max" from Monzo is "Monzo Max", "Transcriptapi" is "TranscriptAPI"), a group, and the company's main website domain so a logo can be shown (null for a person or if unsure).
Groups: ${GROUPS.join(', ')}. Rent, energy, water, council tax, broadband, phone go in "Home & bills". Software, streaming, AI tools, memberships go in "Subscriptions". Salary goes in "Income".
2. Write 3 to 5 insights that are genuinely useful and that Lian could NOT easily see in the Monzo app: habits that quietly add up (e.g. a monthly cost of a frequent habit), subscriptions that overlap or look forgotten, a bill that changed price, how much of income is already committed before spending anything. Be specific with £ figures, no generic advice, no lecturing. Each insight: a short title (max 5 words), a headline figure (e.g. "£283/mo"), and one plain sentence.

Reply with ONLY JSON, no markdown or code fence:
{"labels":{"<key>":{"name":"...","group":"...","domain":"example.com or null"}},"insights":[{"title":"...","figure":"...","body":"..."}]}`;
}

let thinking = null;

function think(list, h) {
  return thinking ??= (async () => {
    try {
      const out = await runClaude(['-p', prompt(list, h), '--disallowedTools', 'Edit', 'Write', 'NotebookEdit', 'Bash', 'WebFetch', 'WebSearch'], { timeout: 240e3 });
      const i = out.indexOf('{'), j = out.lastIndexOf('}');
      const parsed = JSON.parse(out.slice(i, j + 1));
      const doc = store.money.get();
      doc.labels = { ...doc.labels, ...(parsed.labels || {}) };
      doc.insights = (parsed.insights || []).filter(x => x && x.title && x.body).slice(0, 5);
      doc.day = londonDay();
      doc.at = Date.now();
      doc.error = null;
      store.money.save();
    } catch (e) {
      const doc = store.money.get();
      doc.error = e.message; doc.day = londonDay();
      store.money.save();
    } finally {
      thinking = null;
    }
  })();
}

function labelled(data) {
  const { labels = {} } = store.money.get();
  return series(data).map(r => {
    const l = labels[r.key] || {};
    const group = GROUPS.includes(l.group) ? l.group : r.amount > 0 ? 'Income' : 'Other';
    return { ...r, name: l.name || r.name, group, logo: r.logo || (l.domain ? favicon(l.domain) : null) };
  });
}

async function summary(force) {
  const data = await money(force, force ? 0 : 10 * 60 * 1000);
  const list = labelled(data);
  const doc = store.money.get();
  const unlabelled = list.some(r => !(doc.labels || {})[r.key]);
  if (!thinking && (doc.day !== londonDay() || (unlabelled && !doc.error))) think(list, habits(data, new Set(list.map(r => r.key.split(':').slice(0, 2).join(':')))));
  const outs = list.filter(r => r.amount < 0);
  const ins = list.filter(r => r.amount > 0);
  return {
    fetchedAt: data.fetchedAt,
    balance: data.balance.balance,
    potTotal: data.pots.reduce((s, p) => s + p.balance, 0),
    recurring: list.map(({ days, period, ...r }) => r).sort((a, b) => a.perMonth - b.perMonth),
    committed: -outs.reduce((s, r) => s + r.perMonth, 0),
    income: ins.reduce((s, r) => s + r.perMonth, 0),
    insights: doc.insights || [],
    insightsAt: doc.at || null,
    thinking: !!thinking,
  };
}

async function expected() {
  return predict(labelled(await money(false, 60 * 60 * 1000)));
}

module.exports = { money, expected, summary };
