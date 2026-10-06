import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CheckIcon, PlusIcon, ShoppingBasketIcon } from 'lucide-react'
import { cn } from '@tars/ui/lib/utils'
import { Button } from '@tars/ui/components/ui/button'
import { Card } from '@tars/ui/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@tars/ui/components/ui/toggle-group'
import { meta, shopEntry, tagline, useBasket, useShop, type Recipe, type Shop } from './data'

export function ShopSwitch({ shops }: { shops: Shop[] }) {
  const { shop, setShop } = useShop(shops)
  if (!shops.length) return null
  return (
    <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={shop?.id ?? 'recipe'} onValueChange={v => v && setShop(v === 'recipe' ? '' : v)}>
      <ToggleGroupItem value="recipe" className="px-3 data-[state=on]:bg-secondary">Recipe</ToggleGroupItem>
      {shops.map(s => <ToggleGroupItem key={s.id} value={s.id} className="px-3 data-[state=on]:bg-secondary">{s.label}</ToggleGroupItem>)}
    </ToggleGroup>
  )
}

export function ShopName({ shop, buy, fallback, price = true }: { shop: Shop | null; buy: string | null; fallback: string; price?: boolean }) {
  const e = shopEntry(shop, buy)
  if (!e) return <>{fallback}</>
  const note = e.swap && <span className="block text-xs text-muted-foreground">Swap: {e.note}</span>
  if (!e.n) return <span><s className="text-muted-foreground">{fallback}</s>{note}</span>
  return (
    <span>
      <a href={shop!.link(e)} target="_blank" rel="noopener" className="underline decoration-primary underline-offset-3">{e.n}</a>
      {price && <span className="ml-1 text-xs text-muted-foreground">£{e.pr.toFixed(2)}</span>}
      {note}
    </span>
  )
}

export function Thumb({ src, className }: { src: string | null; className?: string }) {
  return src
    ? <img loading="lazy" src={src} alt="" className={cn('size-8 shrink-0 rounded-full bg-white object-contain p-1', className)} />
    : <span className={cn('size-8 shrink-0 rounded-full bg-secondary', className)} />
}

export function BasketButton({ id, size = 'default' }: { id: string; size?: 'default' | 'xs' }) {
  const basket = useBasket()
  const on = basket.has(id)
  if (size === 'xs') {
    return (
      <Button
        size="xs"
        variant={on ? 'default' : 'secondary'}
        onClick={e => { e.preventDefault(); e.stopPropagation(); basket.toggle(id) }}
        className={cn('rounded-full', !on && 'bg-black/60 text-white hover:bg-black/70')}
      >
        {on ? <CheckIcon /> : <PlusIcon />}{on ? 'Added' : 'Add'}
      </Button>
    )
  }
  return (
    <Button size="lg" variant={on ? 'secondary' : 'default'} onClick={() => basket.toggle(id)} className="rounded-full px-4">
      <ShoppingBasketIcon />{on ? 'On your list' : 'Add to list'}
    </Button>
  )
}

export function RecipeTile({ r }: { r: Recipe }) {
  return (
    <Link to={`/recipe/${r.id}`} className="group block w-60 shrink-0 snap-start">
      <Card className="h-full gap-0 overflow-hidden py-0 transition-transform group-active:scale-98">
        <div className="relative aspect-4/3 bg-secondary">
          <img loading="lazy" src={r.img} alt="" className="size-full object-cover" />
          <div className="absolute top-2 right-2"><BasketButton id={r.id} size="xs" /></div>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <div className="text-xs font-semibold text-primary">{tagline(r)}</div>
          <div className="line-clamp-2 text-base leading-snug font-semibold">{r.n}</div>
          <div className="mt-auto pt-2 text-sm text-muted-foreground">{meta(r)}</div>
        </div>
      </Card>
    </Link>
  )
}

export function Loading({ error, children }: { error?: boolean; children?: ReactNode }) {
  return <div className="py-16 text-center text-muted-foreground">{error ? "Couldn't load the menu." : children ?? 'Loading…'}</div>
}
