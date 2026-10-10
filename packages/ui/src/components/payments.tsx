import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@tars/ui/lib/utils'
import { api } from '@tars/ui/lib/api'
import { parseYmd } from '@tars/ui/lib/dates'
import { Avatar, AvatarFallback, AvatarImage } from '@tars/ui/components/ui/avatar'
import { Badge } from '@tars/ui/components/ui/badge'
import { fmt } from '@tars/ui/lib/money'

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
  return (
    <Avatar className={cn('size-8 bg-white', className)}>
      {src && <AvatarImage src={src} alt="" loading="lazy" />}
      <AvatarFallback className={cn('bg-money/15 text-sm font-semibold text-money', className)}>{(name || '?')[0].toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

export const amountLabel = (p: { amount: number; varies: boolean }, value = p.amount) => `${value > 0 ? '+' : ''}${p.varies ? '~' : ''}${fmt(Math.abs(value))}`

export function PaymentRow({ p, tag, dated, to }: { p: Expected; tag?: boolean; dated?: boolean; to?: string }) {
  const when = p.late
    ? `Due ${parseYmd(p.expectedOn).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · not taken yet`
    : `${dated ? parseYmd(p.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Expected'} · ${p.kind}${p.cadence === 'weekly' ? ' · weekly' : ''}`
  const body = (
    <>
      <Logo src={p.logo} name={p.name} className="mt-px size-5 text-micro" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{p.name}</span>
        <span className="mt-1 flex gap-3 text-xs text-muted-foreground">
          {tag && <Badge variant="tag" className="tracking-wider text-money uppercase">Money</Badge>}
          <span>{when}</span>
        </span>
      </span>
      <span className="font-semibold tabular-nums">{amountLabel(p)}</span>
    </>
  )
  const cls = 'flex items-start gap-3 hairline-b py-3'
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}
