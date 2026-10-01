import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PoundSterlingIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { parseYmd } from '@/lib/dates'
import { fmt } from './data'

export type Expected = {
  id: string; date: string; expectedOn: string; late: boolean; name: string; amount: number
  varies: boolean; seen: number; kind: string; cadence: 'monthly' | 'weekly'; logo: string | null; category: string
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

export function PaymentRow({ p, tag }: { p: Expected; tag?: boolean }) {
  const when = p.late
    ? `Due ${parseYmd(p.expectedOn).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · not taken yet`
    : `Expected · ${p.kind}${p.cadence === 'weekly' ? ' · weekly' : ''}`
  return (
    <Link to="/money" className="flex items-start gap-3 hairline-b py-3">
      <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-money/15 text-money">
        <PoundSterlingIcon className="size-3" strokeWidth={2.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{p.name}</span>
        <span className="mt-1 flex gap-3 text-xs text-muted-foreground">
          {tag && <span className="font-semibold tracking-wider text-money uppercase">Money</span>}
          <span>{when}</span>
        </span>
      </span>
      <span className="font-semibold tabular-nums">{p.amount > 0 ? '+' : ''}{p.varies ? '~' : ''}{fmt(Math.abs(p.amount))}</span>
    </Link>
  )
}
