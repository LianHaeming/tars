import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { SendIcon, XIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { useTars } from '@/features/tasks/store'
import { Page } from '@/components/Page'
import { Empty, SectionHead } from '@/components/common'
import { Button } from '@/components/ui/button'
import { shopEntry, shopPacks, totals, useBasket, useFood, useShop, type Line } from './data'
import { Loading, ShopName, ShopSwitch, Thumb } from './parts'

export function ListPage() {
  const { food, error } = useFood()
  const basket = useBasket()
  const { shop } = useShop(food?.shops ?? [])
  const { load } = useTars()
  const navigate = useNavigate()
  const [lines, setLines] = useState<Line[] | null>(null)
  const [sending, setSending] = useState(false)
  const key = basket.ids.join()

  useEffect(() => {
    let live = true
    totals(basket.ids).then(l => { if (live) setLines(l) })
    return () => { live = false }
  }, [key])

  async function send() {
    if (!lines || !food) return
    setSending(true)
    const items = lines.map(l => ({
      title: l.amount ? `${l.name} — ${l.amount}` : l.name,
      description: 'For: ' + l.dishIds.map(id => food.byId.get(id)?.n).filter(Boolean).join(', '),
    }))
    try {
      await api('POST', 'shopping', { items })
      await load()
      toast(`Sent ${items.length} items to Shopping`, { action: { label: 'Open', onClick: () => navigate('/shopping') } })
    } catch {
      toast("Couldn't send, try again")
    }
    setSending(false)
  }

  let total = 0
  const priced = shop && lines?.map(l => {
    const e = shopEntry(shop, l.name)
    const packs = e?.n ? shopPacks(e, l.units, l.dishes) : 0
    total += packs * (e?.pr || 0)
    return { l, e, packs }
  })

  return (
    <Page title="Shopping list" back="/food">
      {!food ? <Loading error={error} /> : !basket.ids.length ? (
        <Empty icon="🧺">
          No dishes added yet.
          <div className="mt-4"><Button asChild><Link to="/food">Pick dishes</Link></Button></div>
        </Empty>
      ) : (
        <>
          <SectionHead title="Dishes" count={basket.ids.length} />
          <ul>
            {basket.ids.map(id => food.byId.get(id)).filter(r => !!r).map(r => (
              <li key={r.id} className="flex items-center gap-3 border-b border-border py-3">
                <img src={r.img} alt="" className="h-10 w-13 shrink-0 rounded-md object-cover" />
                <Link to={`/food/${r.id}`} className="min-w-0 flex-1 truncate">{r.n}</Link>
                <Button variant="ghost" size="icon-sm" aria-label="Remove" className="text-muted-foreground" onClick={() => basket.toggle(r.id)}><XIcon /></Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button size="lg" className="flex-1 rounded-full" disabled={sending || !lines} onClick={send}><SendIcon />Send to Shopping list</Button>
            <Button size="lg" variant="outline" className="rounded-full" onClick={basket.clear}>Clear</Button>
          </div>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-2">
            <div className="text-sm font-bold tracking-wider text-muted-foreground uppercase">
              Ingredients <span className="font-semibold tracking-normal normal-case opacity-70">· 2 servings each</span>
            </div>
            <ShopSwitch shops={food.shops} />
          </div>
          {!lines ? <Loading /> : (
            <>
              {shop && (
                <p className="pt-3 text-sm text-muted-foreground">
                  {shop.label} products, whole packs: about <b className="text-foreground">£{total.toFixed(2)}</b> (cupboard items included — you may already have them).
                </p>
              )}
              <ul>
                {(priced ?? lines.map(l => ({ l, e: null, packs: 0 }))).map(({ l, e, packs }) => (
                  <li key={l.name} className="flex items-center gap-3 border-b border-border py-2 text-sm">
                    <Thumb src={l.img} />
                    <span className="min-w-0 flex-1">{shop ? <ShopName shop={shop} buy={l.name} fallback={l.name} price={false} /> : l.name}</span>
                    <span className="text-right whitespace-nowrap text-muted-foreground">
                      {l.amount}{packs > 0 && e && <> → {packs} × £{e.pr.toFixed(2)}</>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Page>
  )
}
