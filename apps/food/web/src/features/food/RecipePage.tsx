import { useState } from 'react'
import { useParams } from 'react-router'
import { SparklesIcon } from 'lucide-react'
import { Page } from '@tars/ui/components/Page'
import { Button } from '@tars/ui/components/ui/button'
import { Card } from '@tars/ui/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@tars/ui/components/ui/dialog'
import { Progress } from '@tars/ui/components/ui/progress'
import { Slider } from '@tars/ui/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@tars/ui/components/ui/tabs'
import { Textarea } from '@tars/ui/components/ui/textarea'
import { cn } from '@tars/ui/lib/utils'
import { BASE_SERVINGS, NUTRIENT_TILES, RI, meta, packFits, scaledAmount, shopEntry, shopPacks, spare, suggestSwaps, tagline, useDetail, useFood, useServings, useShop, type Detail, type Recipe, type Shop, type Suggestion } from './data'
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

function Servings({ d, shop }: { d: Detail; shop: Shop | null }) {
  const servings = useServings()
  const n = servings.of(d.id)
  const fits = packFits(d, shop, n)
  return (
    <div className="glass mb-4 rounded-2xl p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Servings</span>
        <span className="flex items-baseline gap-3">
          {n !== BASE_SERVINGS && <Button variant="link" size="inline" onClick={() => servings.set(d.id, BASE_SERVINGS)} className="text-xs">Reset</Button>}
          <span className="text-2xl font-semibold tabular-nums">{n.toFixed(1)}</span>
        </span>
      </div>
      <Slider className="mt-4" min={1} max={8} step={0.1} value={[n]} onValueChange={([v]) => servings.set(d.id, v)} aria-label="Servings" />
      {fits.length > 0 && (
        <>
          <p className="mt-4 text-xs text-muted-foreground">Use whole packs, nothing left over:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {fits.map(f => (
              <Button key={f.name + f.packs} variant="secondary" size="xs" onClick={() => servings.set(d.id, f.servings)} className="rounded-full">
                {f.name} · {f.packs} pack{f.packs > 1 ? 's' : ''} <span className="text-primary">→ {f.servings.toFixed(1)}</span>
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Ingredients({ d, shops }: { d: Detail; shops: Shop[] }) {
  const { shop } = useShop(shops)
  const n = useServings().of(d.id)
  const f = n / BASE_SERVINGS
  const packShop = shop ?? shops[0] ?? null
  return (
    <>
      <Servings d={d} shop={packShop} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">For {n.toFixed(1).replace(/\.0$/, '')} servings</span>
        <ShopSwitch shops={shops} />
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {d.ingredients.map((i, k) => {
          const e = shopEntry(packShop, i.buy)
          const units: [string, number][] = i.q == null ? [] : [[i.u || '', i.q * f]]
          const left = e && units.length ? spare(e, units, shopPacks(e, units, 1)) : null
          return (
            <li key={k} className="flex flex-col items-center gap-1 rounded-xl bg-card px-2 py-3 text-center text-sm leading-tight ring-1 ring-foreground/10">
              {i.img
                ? <img loading="lazy" src={i.img} alt="" className="size-14 rounded-full bg-white object-contain p-2" />
                : <span className="size-14 rounded-full bg-secondary" />}
              <span className="font-semibold tabular-nums">{scaledAmount(i, f)}</span>
              <span>{shop ? <ShopName shop={shop} buy={i.buy} fallback={i.name} /> : i.name}</span>
              {left && <span className="text-xs text-muted-foreground">{left}</span>}
            </li>
          )
        })}
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

function DislikeDialog({ r, d }: { r: Recipe; d: Detail }) {
  const [open, setOpen] = useState(false)
  const [dislike, setDislike] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Suggestion | null>(null)
  const [error, setError] = useState('')

  const ask = async () => {
    if (!dislike.trim() || loading) return
    setLoading(true); setError(''); setResult(null)
    try { setResult(await suggestSwaps(r.id, dislike)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Tars could not help just now') }
    finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setDislike(''); setResult(null); setError('') } }}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5"><SparklesIcon className="size-4" />Not keen on something?</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Not keen on something?</DialogTitle>
          <DialogDescription>Tell Tars what you'd rather not eat and it'll suggest swaps for this dish.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {d.ingredients.map((i, k) => (
            <Button key={k} variant="secondary" size="xs" className="rounded-full" onClick={() => setDislike(i.name)}>{i.name}</Button>
          ))}
        </div>
        <Textarea value={dislike} onChange={e => setDislike(e.target.value)} placeholder="e.g. I don't like courgettes" rows={2} />
        <Button onClick={ask} disabled={!dislike.trim() || loading}>{loading ? 'Asking Tars…' : 'Ask Tars'}</Button>
        {error && <p className="text-sm text-tomorrow">{error}</p>}
        {result && (
          <div className="flex flex-col gap-3">
            {result.swaps.map((s, k) => (
              <div key={k} className="glass rounded-xl p-3 text-sm">
                <div><span className="text-muted-foreground">{s.for || 'Swap'}</span> → <span className="font-semibold">{s.use}</span></div>
                {s.how && <div className="mt-1 text-xs text-muted-foreground">{s.how}</div>}
              </div>
            ))}
            {result.note && <p className="text-sm text-muted-foreground">{result.note}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function RecipePage() {
  const { id } = useParams()
  const { food, error } = useFood()
  const { detail: d, error: detailError } = useDetail(id)
  const r = food?.byId.get(id!)

  return (
    <Page title={r?.n ?? 'Recipe'} back="/">
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
          <div className="mt-4"><DislikeDialog r={r} d={d} /></div>
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
