const { execFile } = require('child_process');
const path = require('path');

const MONZO = path.join(__dirname, '..', '..', 'bin', 'monzo');
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

function predict(data, horizonDays = 90) {
  const groups = new Map();
  for (const t of data.transactions) {
    if (t.declined || t.scheme === 'uk_retail_pot' || !t.amount || !t.name) continue;
    const key = `${t.amount < 0 ? 'out' : 'in'}:${t.name.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const today = startOfDay(Date.now());
  const end = new Date(+today + horizonDays * DAY);
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

  const series = [];
  for (const [key, ts] of groups) {
    ts.sort((a, b) => a.created.localeCompare(b.created));
    const whole = pattern(ts);
    if (whole) { series.push([key, whole]); continue; }
    const clusters = [];
    for (const t of ts) (clusters.find(c => near(t.amount, c[0].amount)) ?? clusters[clusters.push([]) - 1]).push(t);
    for (const c of clusters) { const p = pattern(c, ts.length); if (p) series.push([`${key}:${c[0].amount}`, p]); }
  }

  const out = [];
  for (const [key, { days, monthly, same, last, period, ts }] of series) {
    if (today - days.at(-1) > period * 1.5 * DAY) continue;

    const step = d => (monthly ? nextMonth(d) : new Date(+d + 7 * DAY));
    let first = true;
    for (let d = step(days.at(-1)); d <= end; d = step(d), first = false) {
      const late = d < today;
      if (late && !(first && today - d <= period * 0.5 * DAY)) continue;
      out.push({
        id: `${key}|${ymd(d)}`, date: ymd(late ? today : d), expectedOn: ymd(d), late,
        name: last.name, amount: last.amount, varies: !same, seen: ts.length,
        kind: last.amount > 0 ? 'Income' : KIND[last.scheme] || 'Payment',
        cadence: monthly ? 'monthly' : 'weekly', logo: last.logo, category: last.category,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

async function expected() {
  return predict(await money(false, 60 * 60 * 1000));
}

module.exports = { money, expected };
