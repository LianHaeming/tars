import { useEffect, useState } from 'react'
import { RefreshCwIcon, SparklesIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addDays, hhmm, parseYmd, shortDate, today, ymd } from '@/lib/dates'
import { Empty, SectionHead } from '@/components/common'
import { Logo, PaymentRow, amountLabel, useExpected } from './expected'
import { fmt0, refreshSummary, useSummary, type Recurring } from './data'

const GROUP_COLOR: Record<string, string> = {
  'Home & bills': 'var(--chart-1)', Subscriptions: 'var(--chart-2)', Insurance: 'var(--chart-3)',
  Transport: 'var(--chart-4)', Food: 'var(--chart-5)', People: 'var(--money)', Other: 'var(--muted-foreground)',
}

function groupsOf(outs: Recurring[]) {
  const m = new Map<string, Recurring[]>()
  for (const r of outs) m.set(r.group, [...(m.get(r.group) ?? []), r])
  return [...m].map(([name, items]) => ({ name, items, total: -items.reduce((s, r) => s + r.perMonth, 0) })).sort((a, b) => b.total - a.total)
}

export function MoneySection() {
  const { data, error, loading, reload } = useSummary()
  const expected = useExpected()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!data?.thinking) return
    const t = setTimeout(reload, 8000)
    return () => clearTimeout(t)
  }, [data, reload])

  const refresh = () => { setBusy(true); refreshSummary().then(reload, () => {}).finally(() => setBusy(false)) }
  const refreshBtn = (
    <button type="button" onClick={refresh} disabled={busy} aria-label="Refresh Monzo" className="grid size-10 shrink-0 place-items-center text-primary disabled:opacity-60">
      <RefreshCwIcon className={cn('size-5', (busy || loading) && 'animate-spin')} />
    </button>
  )

  if (!data) {
    return (
      <div className="flex items-start justify-between gap-2">
        <Empty>{error ? <>Couldn't reach Monzo.<br /><span className="text-sm">{error}</span></> : 'Loading your Monzo account…'}</Empty>
        {refreshBtn}
      </div>
    )
  }

  const outs = data.recurring.filter(r => r.amount < 0)
  const groups = groupsOf(outs)
  const share = data.income ? Math.round((data.committed / data.income) * 100) : null
  const end = ymd(addDays(today(), 30))
  const soon = expected.filter(p => p.date < end)
  const payday = soon.find(p => p.amount > 0)
  const beforePay = -soon.filter(p => p.amount < 0 && (!payday || p.date < payday.date)).reduce((s, p) => s + p.amount, 0)

  return (
    <div>
      {error && <div className="mt-3 rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">Showing data from {hhmm(new Date(data.fetchedAt))}: {error}</div>}

      <div className="flex items-center justify-between gap-2 px-1 pt-3">
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{fmt0(data.balance)}</span> in current account · {fmt0(data.potTotal)} in pots
        </span>
        {refreshBtn}
      </div>

      <div className="glass mt-2 rounded-2xl p-4">
        <div className="text-sm text-muted-foreground">Goes out automatically every month</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-hero font-semibold tracking-tight">{fmt0(data.committed)}</span>
          {share !== null && <span className="text-sm text-muted-foreground">{share}% of your {fmt0(data.income)} pay</span>}
        </div>
        <div className="mt-4 flex h-2 gap-1 overflow-hidden rounded-full">
          {groups.map(g => <div key={g.name} style={{ flexGrow: g.total, background: GROUP_COLOR[g.name] ?? 'var(--muted-foreground)' }} />)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {groups.map(g => (
            <div key={g.name} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: GROUP_COLOR[g.name] ?? 'var(--muted-foreground)' }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{g.name}</span>
              <span className="font-semibold tabular-nums">{fmt0(g.total)}</span>
            </div>
          ))}
        </div>
        {payday && (
          <div className="mt-4 hairline-t pt-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{fmt0(beforePay)}</span> still to go out before payday on {shortDate(parseYmd(payday.date))}
          </div>
        )}
      </div>

      <SectionHead title="Tars noticed" />
      {data.insights.length ? (
        <div className="grid gap-3 pt-3">
          {data.insights.map(x => (
            <div key={x.title} className="glass rounded-2xl p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">{x.title}</span>
                {x.figure && <span className="shrink-0 font-semibold text-money tabular-nums">{x.figure}</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{x.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <SparklesIcon className={cn('size-4', data.thinking && 'animate-pulse')} />
          {data.thinking ? 'Tars is looking through your spending…' : 'Nothing yet — check back tomorrow.'}
        </div>
      )}

      {groups.map(g => (
        <section key={g.name}>
          <SectionHead title={g.name} count={g.items.length} />
          {g.items.map(r => (
            <div key={r.key} className="flex items-center gap-3 hairline-b py-2">
              <Logo src={r.logo} name={r.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.cadence === 'weekly' ? 'Weekly' : 'Monthly'} · {r.kind} · last {shortDate(parseYmd(r.lastOn))}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold tabular-nums">{amountLabel(r, r.perMonth)}</div>
                {r.cadence === 'weekly' && <div className="text-xs text-muted-foreground">a month</div>}
              </div>
            </div>
          ))}
        </section>
      ))}

      {soon.length > 0 && (
        <section>
          <SectionHead title="Next 30 days" count={soon.length} />
          {soon.map(p => <PaymentRow key={p.id} p={p} dated />)}
        </section>
      )}

      <div className="pt-6 text-center text-xs text-muted-foreground">
        Read-only from Monzo · updated {hhmm(new Date(data.fetchedAt))}{data.insightsAt ? ` · insights from ${shortDate(new Date(data.insightsAt))}` : ''}
      </div>
    </div>
  )
}
