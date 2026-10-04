import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { parseYmd } from '@/lib/dates'
import { fmt } from './data'

export type Expected = {
  id: string; key: string; date: string; expectedOn: string; late: boolean; name: string; amount: number
  varies: boolean; seen: number; kind: string; cadence: 'monthly' | 'weekly'; logo: string | null; category: string; group: string
}

let cache: { at: number; items: Expected[] } | null = null

export function useExpected() {
  const [items, setItems] = useState<Expected[]>(cache?.items ?? [])
  useEffect(() => {
    if (cache && Date.now() - cache.at < 10 * 60 * 1000) return
    api<Expected[]>('GET', 'expected').then(x => { cache = { at: Date.now(), items: x }; setItems(x) }, () => {})
  }, [])
  return items
}

export function Logo({ src, name, className }: { src: string | null; name: string; className?: string }) {
  const [broken, setBroken] = useState(false)
  if (src && !broken) return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className={cn('size-8 shrink-0 rounded-full bg-white object-cover', className)} />
  return <span className={cn('grid size-8 shrink-0 place-items-center rounded-full bg-money/15 text-sm font-semibold text-money', className)}>{(name || '?')[0].toUpperCase()}</span>
}

export const amountLabel = (p: { amount: number; varies: boolean }, value = p.amount) => `${value > 0 ? '+' : ''}${p.varies ? '~' : ''}${fmt(Math.abs(value))}`

export function PaymentRow({ p, tag, dated }: { p: Expected; tag?: boolean; dated?: boolean }) {
  const when = p.late
    ? `Due ${parseYmd(p.expectedOn).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · not taken yet`
    : `${dated ? parseYmd(p.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Expected'} · ${p.kind}${p.cadence === 'weekly' ? ' · weekly' : ''}`
  return (
    <Link to="/apps" className="flex items-start gap-3 hairline-b py-3">
      <Logo src={p.logo} name={p.name} className="mt-px size-5 text-micro" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{p.name}</span>
        <span className="mt-1 flex gap-3 text-xs text-muted-foreground">
          {tag && <span className="font-semibold tracking-wider text-money uppercase">Money</span>}
          <span>{when}</span>
        </span>
      </span>
      <span className="font-semibold tabular-nums">{amountLabel(p)}</span>
    </Link>
  )
}
