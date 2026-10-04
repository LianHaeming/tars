import { useParams } from 'react-router'
import { Page } from '@/components/Page'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { NUTRIENT_TILES, RI, meta, tagline, useDetail, useFood, useShop, type Detail, type Shop } from './data'
import { BasketButton, Loading, ShopName, ShopSwitch } from './parts'

const TIMING = /\b\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+)?\s?(?:mins?|minutes|secs?|seconds|hrs?|hours)\b|\b\d+\s?°[CF]/gi

function richText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (node: Element) => {
    for (const el of [...node.children]) {
      walk(el)
      if (!['STRONG', 'EM'].includes(el.tagName)) el.replaceWith(...el.childNodes)
      else [...el.attributes].forEach(a => el.removeAttribute(a.name))
    }
  }
  walk(doc.body)
  const texts: Text[] = []
  const tw = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  while (tw.nextNode()) texts.push(tw.currentNode as Text)
  for (const t of texts) {
    const s = t.data
    if (!TIMING.test(s)) continue
    TIMING.lastIndex = 0
    const frag = doc.createDocumentFragment()
    let last = 0
    for (const m of s.matchAll(TIMING)) {
      frag.append(s.slice(last, m.index))
      const span = doc.createElement('span')
      span.className = 'font-semibold whitespace-nowrap text-primary'
      span.textContent = m[0]
      frag.append(span)
      last = m.index! + m[0].length
    }
    frag.append(s.slice(last))
    t.replaceWith(frag)
  }
  return { __html: doc.body.innerHTML }
}

function Ingredients({ d, shops }: { d: Detail; shops: Shop[] }) {
  const { shop } = useShop(shops)
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">For 2 servings</span>
        <ShopSwitch shops={shops} />
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {d.ingredients.map((i, n) => (
          <li key={n} className="flex flex-col items-center gap-1 rounded-xl bg-card px-2 py-3 text-center text-sm leading-tight ring-1 ring-foreground/10">
            {i.img
              ? <img loading="lazy" src={i.img} alt="" className="size-14 rounded-full bg-white object-contain p-2" />
              : <span className="size-14 rounded-full bg-secondary" />}
            <span className="font-semibold">{i.amount}</span>
            <span>{shop ? <ShopName shop={shop} buy={i.buy} fallback={i.name} /> : i.name}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function Method({ d }: { d: Detail }) {
  return (
    <ol className="flex flex-col gap-5">
      {d.steps.map((s, i) => (
        <li key={i} className="grid gap-3 sm:grid-cols-3">
          {s.image ? <img loading="lazy" src={s.image} alt="" className="aspect-4/3 w-full rounded-xl bg-secondary object-cover" /> : <div />}
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center gap-3 text-base font-bold">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-sm text-primary">{i + 1}</span>
              {s.title}
            </div>
            <ul className="flex flex-col gap-2">
              {s.points.map((p, j) => (
                <li key={j} className="flex gap-3"><span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" /><span dangerouslySetInnerHTML={richText(p)} /></li>
              ))}
            </ul>
            {s.notes.map((n, j) => (
              <div key={j} className={cn('mt-3 rounded-lg px-3 py-2 text-sm leading-relaxed', n.kind === 'tip' ? 'bg-primary/10' : 'rounded-l-none border-l-3 border-tomorrow')}>
                <b className={cn('block text-xs tracking-wider uppercase', n.kind === 'tip' ? 'text-primary' : 'text-tomorrow')}>{n.kind === 'tip' ? 'Tip' : 'Important'}</b>
                <span dangerouslySetInnerHTML={richText(n.text)} />
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Nutrition({ d }: { d: Detail }) {
  const n = Object.fromEntries(d.nutrition.map(([name, amount, unit]) => [name, { amount, unit }]))
  const pct = (k: string) => (n[k] && RI[k] ? Math.round((100 * n[k].amount) / RI[k]) : null)
  const tiles = NUTRIENT_TILES.filter(([k]) => n[k])
  if (!tiles.length) return <p className="text-sm text-muted-foreground">No nutrition information for this dish.</p>
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([k, label, subK, subLabel]) => {
          const p = pct(k), sub = subK && n[subK]
          return (
            <Card key={k} className="gap-0 px-4 py-4">
              <div className="text-sm font-semibold text-muted-foreground">{label}</div>
              <div className="mt-1 mb-3 text-2xl leading-tight font-bold">
                {n[k].amount}<span className="ml-1 text-base font-semibold text-muted-foreground">{n[k].unit}</span>
              </div>
              {p != null && <><Progress value={Math.min(100, p)} className="mb-2 h-2" /><div className="text-xs text-muted-foreground">{p}% RI</div></>}
              {sub && <div className="text-xs text-muted-foreground">{subLabel} {sub.amount} {sub.unit}{pct(subK!) != null && ` · ${pct(subK!)}% RI`}</div>}
            </Card>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Per serving. RI = an adult's daily reference intake.</p>
    </>
  )
}

export function RecipePage() {
  const { id } = useParams()
  const { food, error } = useFood()
  const { detail: d, error: detailError } = useDetail(id)
  const r = food?.byId.get(id!)

  return (
    <Page title={r?.n ?? 'Recipe'} back="/apps">
      {!r || !d ? <Loading error={error || detailError || (!!food && !r)} /> : (
        <>
          <img src={d.photo} onError={e => { e.currentTarget.src = r.img }} alt="" className="mt-3 aspect-video w-full rounded-2xl bg-secondary object-cover" />
          <div className="mt-4 flex flex-wrap items-start gap-4">
            <div className="min-w-60 flex-1">
              <div className="text-xs font-semibold text-primary">{tagline(r)}</div>
              <h2 className="mt-1 text-2xl leading-tight font-bold tracking-tight">{r.n}</h2>
              <div className="text-muted-foreground">{r.h}</div>
              <div className="mt-2 text-sm text-muted-foreground">{meta(r)}</div>
            </div>
            <BasketButton id={r.id} />
          </div>
          <Tabs defaultValue="ingredients" className="mt-5">
            <TabsList variant="line" className="sticky top-below-header z-10 -mx-4 flex w-auto justify-start gap-4 hairline-b bg-chrome px-4">
              <TabsTrigger value="ingredients" className="flex-none">Ingredients</TabsTrigger>
              <TabsTrigger value="method" className="flex-none">Method</TabsTrigger>
              <TabsTrigger value="nutrition" className="flex-none">Nutrition</TabsTrigger>
            </TabsList>
            <TabsContent value="ingredients" className="pt-3"><Ingredients d={d} shops={food!.shops} /></TabsContent>
            <TabsContent value="method" className="pt-3"><Method d={d} /></TabsContent>
            <TabsContent value="nutrition" className="pt-3"><Nutrition d={d} /></TabsContent>
          </Tabs>
        </>
      )}
    </Page>
  )
}
