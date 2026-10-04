import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useDeferredFlag } from '@/lib/use-resource'
import { addDays, parseYmd, today, ymd } from '@/lib/dates'
import type { Bucket } from './charts'

export type Tx = {
  id: string; created: string; amount: number; currency: string; category: string
  name: string; logo: string | null; spending: boolean; declined: boolean; pending: boolean
}
export type Pot = { id: string; name: string; balance: number; currency: string }
export type Money = { fetchedAt: number; balance: { balance: number; spendToday: number; currency: string }; pots: Pot[]; transactions: Tx[] }

let cache: Money | null = null

export function useMoney() {
  const [data, setData] = useState<Money | null>(cache)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (fresh = false) => {
    setLoading(true)
    try {
      cache = await api<Money>('GET', fresh ? 'money/fresh' : 'money')
      setData(cache)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  return { data, error, loading, busy: useDeferredFlag(loading), refresh: () => load(true) }
}

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
export const fmt = (pennies: number) => gbp.format(pennies / 100)
export const fmt0 = (pennies: number) => gbp0.format(pennies / 100)

export const spent = (t: Tx) => (t.spending && !t.declined && t.amount < 0 ? -t.amount : 0)
export const day = (t: Tx) => ymd(new Date(t.created))

export function categoryName(c: string) {
  if (!c || c.startsWith('category_')) return 'Other'
  const s = c.replace(/_/g, ' ')
  return s[0].toUpperCase() + s.slice(1)
}

export function windowOf(days: number, offset = 0) {
  const end = addDays(today(), -offset * days)
  return { from: ymd(addDays(end, -(days - 1))), to: ymd(end) }
}

export const inWindow = (t: Tx, w: { from: string; to: string }) => { const d = day(t); return d >= w.from && d <= w.to }

const shortDay = (d: string) => parseYmd(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const longDay = (d: string) => parseYmd(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

export function buckets(txs: Tx[], days: number): Bucket[] {
  const w = windowOf(days)
  const byDay = new Map<string, number>()
  for (const t of txs) if (inWindow(t, w)) byDay.set(day(t), (byDay.get(day(t)) ?? 0) + spent(t))
  const span = days > 31 ? 7 : 1
  const out: Bucket[] = []
  for (let start = parseYmd(w.from); ymd(start) <= w.to; start = addDays(start, span)) {
    let value = 0
    for (let i = 0; i < span; i++) value += byDay.get(ymd(addDays(start, i))) ?? 0
    const k = ymd(start)
    out.push({ key: k, label: shortDay(k), title: span === 1 ? longDay(k) : `Week of ${shortDay(k)}`, value })
  }
  return out
}

// All the spend maths for a period: totals, per-day, previous-period delta, category/merchant breakdowns
// and the chart buckets. Kept here so MoneySection is composition only.
export function summarize(data: Money, days: number) {
  const potName = (id: string) => { const p = data.pots.find(x => x.id === id); return p ? `${p.name} pot` : 'Pot transfer' }
  const txs = data.transactions.map(t => (t.name.startsWith('pot_') ? { ...t, name: potName(t.name) } : t))
  const w = windowOf(days)
  const inW = txs.filter(t => inWindow(t, w))
  const total = inW.reduce((s, t) => s + spent(t), 0)
  const prev = days * 2 <= 89 ? txs.filter(t => inWindow(t, windowOf(days, 1))).reduce((s, t) => s + spent(t), 0) : null
  const payments = inW.filter(t => spent(t) > 0).length

  const cats = new Map<string, number>()
  const merchants = new Map<string, { value: number; count: number }>()
  for (const t of inW) {
    const v = spent(t)
    if (!v) continue
    const c = categoryName(t.category)
    cats.set(c, (cats.get(c) ?? 0) + v)
    const m = merchants.get(t.name) ?? { value: 0, count: 0 }
    merchants.set(t.name, { value: m.value + v, count: m.count + 1 })
  }
  const catRows = [...cats].sort((a, b) => b[1] - a[1])
  const folded = catRows.length > 7 ? [...catRows.slice(0, 6), ['Everything else', catRows.slice(6).reduce((s, [, v]) => s + v, 0)] as [string, number]] : catRows

  return {
    total, prev, payments, perDay: total / days,
    chart: buckets(txs, days),
    categories: folded.map(([label, value]) => ({ key: label, label, value })),
    merchants: [...merchants].sort((a, b) => b[1].value - a[1].value).slice(0, 5)
      .map(([name, m]) => ({ key: name, label: name, value: m.value, sub: `${m.count} payment${m.count > 1 ? 's' : ''}` })),
    recent: [...inW].reverse(),
  }
}
