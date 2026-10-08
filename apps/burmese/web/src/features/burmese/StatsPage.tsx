import { useState } from 'react'
import { Page } from '@tars/ui/components/Page'
import { SectionHead } from '@tars/ui/components/common'
import { Button } from '@tars/ui/components/ui/button'
import { useResource } from '@tars/ui/lib/use-resource'
import { cn } from '@tars/ui/lib/utils'
import { getStats, scoreTone, type Mem, type Stats } from './data'

const pct = (x: number | null | undefined) => x == null ? '—' : `${Math.round(x * 100)}%`

function ago(ms: number | null) {
  if (!ms) return 'never'
  const m = (Date.now() - ms) / 6e4
  if (m < 60) return `${Math.max(1, Math.round(m))}m ago`
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

const days = (s: number | null) => s == null ? '—' : s < 1 ? `${Math.round(s * 24)}h` : `${s < 10 ? s.toFixed(1) : Math.round(s)}d`

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="glass rounded-2xl px-3 py-3">
      <div className="font-display text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

function Trend({ trend }: { trend: Stats['trend'] }) {
  const [sel, setSel] = useState<number | null>(null)
  const shown = trend.find(t => t.unit === sel) ?? trend[trend.length - 1]
  if (!trend.length) return <p className="py-4 text-sm text-muted-foreground">Play a unit to see your scores here.</p>
  return (
    <div className="pt-3">
      <p className="text-sm text-muted-foreground">
        Unit {shown.unit} · <span className={cn('font-semibold', scoreTone(shown.avg))}>{shown.avg}%</span> average · {shown.n} answer{shown.n === 1 ? '' : 's'}
      </p>
      <div className="mt-3 flex h-24 items-end gap-1" role="img" aria-label="Average score per unit">
        {trend.map(t => (
          <Button key={t.unit} variant="ghost" size="inline" aria-label={`Unit ${t.unit}: ${t.avg}%`}
            onClick={() => setSel(t.unit)} className="h-full min-w-0 flex-1 items-end rounded-none p-0 hover:bg-transparent">
            <span className={cn('block w-full rounded-t-mark bg-gold', shown.unit !== t.unit && 'opacity-50')} style={{ height: `${Math.max(3, t.avg)}%` }} />
          </Button>
        ))}
      </div>
      <div className="hairline-t flex justify-between pt-1 text-xs text-muted-foreground">
        <span>unit {trend[0].unit}</span><span>unit {trend[trend.length - 1].unit}</span>
      </div>
    </div>
  )
}

function MemLine({ name, m }: { name: string; m: Mem | null }) {
  if (!m) return <div className="text-xs text-muted-foreground">{name}: locked until the meaning scores 85%+</div>
  if (m.s == null) return <div className="text-xs text-muted-foreground">{name}: unlocked, not asked yet</div>
  return (
    <div className="text-xs text-muted-foreground tabular-nums">
      {name}: recall now <span className="font-semibold text-foreground">{pct(m.r)}</span> · holds {days(m.s)} · difficulty {m.d?.toFixed(1)}
      {' '}· last <span className={scoreTone(m.lastScore)}>{m.lastScore}%</span> · best {m.best}% · {ago(m.last)}
    </div>
  )
}

export function StatsPage() {
  const { data, error } = useResource(getStats)
  const rows = data ? [...data.rows].sort((a, b) => Math.min(a.read?.r ?? 1, a.say?.s == null ? 1 : a.say.r) - Math.min(b.read?.r ?? 1, b.say?.s == null ? 1 : b.say.r)) : []
  const cat = (k: string) => data?.categories.find(c => c.key === k)?.name ?? k

  return (
    <Page title="Stats" back="/">
      {error && <p className="pt-6 text-sm text-muted-foreground">Couldn't load stats — {error}</p>}
      {!data ? !error && <p className="pt-6 text-sm text-muted-foreground">Loading…</p> : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Tile label="New" value={data.counts.new} />
            <Tile label="Learning" value={data.counts.learning} />
            <Tile label="Stable" value={data.counts.stable} hint="3+ weeks" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Tile label="Predicted recall now" value={pct(data.recall)} hint="average over everything seen" />
            <Tile label="At risk" value={data.atRisk} hint="below 90% recall" />
          </div>

          <SectionHead title="Score by unit" />
          <Trend trend={data.trend} />

          <SectionHead title="Sentences" count={rows.length} />
          {!rows.length && <p className="py-4 text-sm text-muted-foreground">Nothing started yet.</p>}
          {rows.map(r => (
            <div key={r.id} className="hairline-b py-3">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 font-display font-semibold text-primary">{r.phonetic}</span>
                <span className={cn('text-xs font-semibold', r.state === 'stable' ? 'text-good' : 'text-muted-foreground')}>{r.state}</span>
              </div>
              <div className="text-sm">{r.english} <span className="text-xs text-muted-foreground">· {cat(r.cat)}</span></div>
              <div className="mt-1 space-y-1">
                <MemLine name="Meaning" m={r.read} />
                <MemLine name="Phonetic" m={r.say} />
              </div>
            </div>
          ))}
          <p className="pt-6 text-center text-xs text-muted-foreground">{data.answers} answers logged</p>
        </>
      )}
    </Page>
  )
}
