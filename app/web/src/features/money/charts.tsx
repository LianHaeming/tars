import { useState } from 'react'
import { cn } from '@/lib/utils'
import { fmt, fmt0 } from './data'

export type Bucket = { key: string; label: string; title: string; value: number }

function niceMax(v: number) {
  if (v <= 0) return 100
  const pounds = v / 100
  const mag = 10 ** Math.floor(Math.log10(pounds))
  const step = [1, 2, 2.5, 5, 10].find(s => s * mag * 2 >= pounds)! * mag
  return step * 2 * 100
}

export function ColumnChart({ buckets, unit }: { buckets: Bucket[]; unit: string }) {
  const [sel, setSel] = useState<number | null>(null)
  const max = niceMax(Math.max(...buckets.map(b => b.value)))
  const top = buckets.reduce((a, b, i) => (b.value > buckets[a].value ? i : a), 0)
  const shown = sel ?? top
  const ticks = [max, max / 2, 0]
  const labelAt = new Set([0, Math.floor((buckets.length - 1) / 2), buckets.length - 1])

  return (
    <figure>
      <figcaption className="flex items-baseline gap-2 pb-3" aria-live="polite">
        <b className="text-lg font-semibold">{fmt(buckets[shown]?.value ?? 0)}</b>
        <span className="text-sm text-muted-foreground">{sel === null ? `highest ${unit} · ` : ''}{buckets[shown]?.title}</span>
      </figcaption>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {ticks.map(t => <div key={t} className="hairline-t" />)}
          </div>
          <div className="relative flex h-40 items-end gap-0.5" onPointerLeave={() => setSel(null)}>
            {buckets.map((b, i) => (
              <button
                key={b.key}
                type="button"
                aria-label={`${b.title}: ${fmt(b.value)}`}
                onPointerEnter={e => { if (e.pointerType === 'mouse') setSel(i) }}
                onFocus={() => setSel(i)}
                onBlur={() => setSel(null)}
                onClick={() => setSel(s => (s === i ? null : i))}
                className="flex h-full flex-1 items-end justify-center outline-none"
              >
                <span
                  className={cn('w-full max-w-6 rounded-t-mark bg-primary transition-opacity duration-150', sel !== null && sel !== i && 'opacity-40')}
                  style={{ height: `${(b.value / max) * 100}%` }}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="flex h-40 w-12 shrink-0 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums">
          {ticks.map(t => <span key={t} className="-my-2">{fmt0(t)}</span>)}
        </div>
      </div>
      <div className="relative mt-2 mr-14 h-4 text-xs text-muted-foreground">
        {[...labelAt].map(i => (
          <span
            key={i}
            className={cn('absolute whitespace-nowrap', i !== 0 && i !== buckets.length - 1 && '-translate-x-1/2')}
            style={i === 0 ? { left: 0 } : i === buckets.length - 1 ? { right: 0 } : { left: `${((i + 0.5) / buckets.length) * 100}%` }}
          >
            {buckets[i].label}
          </span>
        ))}
      </div>
    </figure>
  )
}

export function BucketTable({ buckets }: { buckets: Bucket[] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {[...buckets].reverse().map(b => (
          <tr key={b.key} className="hairline-b">
            <td className="py-2 text-muted-foreground">{b.title}</td>
            <td className="py-2 text-right tabular-nums">{fmt(b.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function BarList({ rows }: { rows: { key: string; label: string; value: number; sub?: string }[] }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <ul>
      {rows.map(r => (
        <li key={r.key} className="flex items-center gap-3 py-2">
          <span className="w-28 shrink-0">
            <span className="block truncate text-sm">{r.label}</span>
            {r.sub && <span className="block text-xs text-muted-foreground">{r.sub}</span>}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="h-3 shrink-0 rounded-r-mark bg-primary" style={{ width: `${Math.max(1, (r.value / max) * 72)}%` }} />
            <span className="text-sm font-semibold whitespace-nowrap tabular-nums">{fmt0(r.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
