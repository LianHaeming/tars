import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDownRightIcon, ArrowUpRightIcon, RefreshCwIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { localGet, localSet } from '@/lib/api'
import { addDays, dueLabel, hhmm, parseYmd, ymd } from '@/lib/dates'
import { Empty, PillBar, SectionHead, pill } from '@/components/common'
import { Page } from '@/components/Page'
import { BarList, BucketTable, ColumnChart, type Bucket } from './charts'
import { categoryName, day, fmt, fmt0, inWindow, spent, useMoney, windowOf, type Tx } from './data'

const PERIODS = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 89, label: '3 months' }]
const shortDay = (d: string) => parseYmd(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const longDay = (d: string) => parseYmd(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

function buckets(txs: Tx[], days: number): Bucket[] {
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

function Logo({ t }: { t: Tx }) {
  const [broken, setBroken] = useState(false)
  if (t.logo && !broken) return <img src={t.logo} alt="" loading="lazy" onError={() => setBroken(true)} className="size-8 shrink-0 rounded-full bg-secondary object-cover" />
  return <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-muted-foreground">{(t.name || '?')[0].toUpperCase()}</span>
}

function Stat({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {children && <div className="mt-1 text-xs text-muted-foreground">{children}</div>}
    </div>
  )
}

export function MoneyPage() {
  const { data, error, loading, refresh } = useMoney()
  const [days, setDays] = useState(() => Number(localGet('money-days')) || 30)
  const [table, setTable] = useState(false)
  const [more, setMore] = useState(30)
  const pick = (d: number) => { setDays(d); setMore(30); localSet('money-days', String(d)) }

  const view = useMemo(() => {
    if (!data) return null
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
  }, [data, days])

  const refreshBtn = (
    <button type="button" onClick={refresh} disabled={loading} aria-label="Refresh" className="grid size-10 place-items-center text-primary disabled:opacity-60">
      <RefreshCwIcon className={cn('size-5', loading && 'animate-spin')} />
    </button>
  )

  if (!data) {
    return (
      <Page title="Money" back="/apps" actions={refreshBtn}>
        <Empty icon={error ? '🔒' : undefined}>
          {error ? <>Couldn't reach Monzo.<br /><span className="text-sm">{error}</span></> : 'Loading your Monzo account…'}
        </Empty>
      </Page>
    )
  }

  const { balance, pots } = data
  const potTotal = pots.reduce((s, p) => s + p.balance, 0)
  const delta = view!.prev ? (view!.total - view!.prev) / view!.prev : null

  return (
    <Page title="Money" back="/apps" actions={refreshBtn}>
      <div className={cn('transition-opacity duration-200', loading && 'opacity-60')}>
        {error && <div className="mt-3 rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">Showing data from {hhmm(new Date(data.fetchedAt))}: {error}</div>}

        <section className="px-1 pt-5 pb-2">
          <div className="text-sm text-muted-foreground">Current account</div>
          <div className="text-hero font-semibold tracking-tight">{fmt(balance.balance)}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {fmt(-balance.spendToday)} spent today · updated {hhmm(new Date(data.fetchedAt))}
          </div>
        </section>

        <SectionHead title="Pots" count={pots.length} />
        <ul>
          {pots.map(p => (
            <li key={p.id} className="flex items-baseline justify-between hairline-b py-3">
              <span>{p.name}</span>
              <span className="font-semibold tabular-nums">{fmt(p.balance)}</span>
            </li>
          ))}
          <li className="flex items-baseline justify-between py-3 text-sm text-muted-foreground">
            <span>In pots</span><span className="tabular-nums">{fmt(potTotal)}</span>
          </li>
        </ul>

        <PillBar className="mt-2">
          {PERIODS.map(p => (
            <button key={p.days} type="button" data-on={days === p.days} onClick={() => pick(p.days)} className={pill}>{p.label}</button>
          ))}
        </PillBar>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <Stat label="Spent" value={fmt0(view!.total)}>
            {delta !== null && (
              <span className="inline-flex items-center gap-1">
                {delta >= 0 ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownRightIcon className="size-3" />}
                {Math.abs(Math.round(delta * 100))}% vs previous
              </span>
            )}
          </Stat>
          <Stat label="Per day" value={fmt0(view!.perDay)}>average</Stat>
          <Stat label="Payments" value={String(view!.payments)}>card & bank</Stat>
        </div>

        <div className="flex items-baseline justify-between hairline-b pt-6 pb-1 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          <span>{days > 31 ? 'Spending by week' : 'Spending by day'}</span>
          <button type="button" onClick={() => setTable(t => !t)} className="text-sm tracking-normal text-primary normal-case">{table ? 'Chart' : 'Table'}</button>
        </div>
        <div className="pt-3">
          {table ? <BucketTable buckets={view!.chart} /> : <ColumnChart buckets={view!.chart} unit={days > 31 ? 'week' : 'day'} />}
        </div>

        <SectionHead title="By category" />
        <BarList rows={view!.categories} />

        <SectionHead title="Top places" />
        <BarList rows={view!.merchants} />

        <SectionHead title="Transactions" count={view!.recent.length} />
        {view!.recent.slice(0, more).map((t, i, list) => {
          const d = day(t)
          const head = i === 0 || day(list[i - 1]) !== d
          return (
            <div key={t.id}>
              {head && <div className="pt-4 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{dueLabel(d)}</div>}
              <div className={cn('flex items-center gap-3 hairline-b py-2', t.declined && 'opacity-50')}>
                <Logo t={t} />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate', t.declined && 'line-through')}>{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {categoryName(t.category)} · {hhmm(new Date(t.created))}{t.declined ? ' · Declined' : t.pending ? ' · Pending' : ''}
                  </div>
                </div>
                <div className="font-semibold tabular-nums">{t.amount > 0 ? '+' : ''}{fmt(Math.abs(t.amount))}</div>
              </div>
            </div>
          )
        })}
        {view!.recent.length > more && (
          <button type="button" onClick={() => setMore(m => m + 30)} className="w-full py-4 text-sm font-semibold text-primary">Show more</button>
        )}
        {!view!.recent.length && <div className="py-4 text-sm text-muted-foreground">No transactions in this period.</div>}
        <div className="pt-6 text-center text-xs text-muted-foreground">Read-only from Monzo · up to 3 months of history</div>
      </div>
    </Page>
  )
}
