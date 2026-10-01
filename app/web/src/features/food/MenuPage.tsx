import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { SearchIcon, ShoppingBasketIcon } from 'lucide-react'
import { localGet, localSet } from '@/lib/api'
import { Page } from '@/components/Page'
import { Empty, SectionHead } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBasket, useFood, type Recipe } from './data'
import { Loading, RecipeCard } from './parts'

const CARBS = ['Pasta', 'Rice', 'Noodles', 'Potato', 'Grains', 'Bread', 'Other']
const DEFAULTS = { q: '', protein: '', cuisine: '', time: '', kcal: '', sort: 'name' }
type Filters = typeof DEFAULTS

const sorters: Record<string, (a: Recipe, b: Recipe) => number> = {
  name: (a, b) => a.n.localeCompare(b.n),
  minutes: (a, b) => (a.m || 999) - (b.m || 999) || a.n.localeCompare(b.n),
  kcal: (a, b) => (a.k ?? 1e9) - (b.k ?? 1e9),
}

function loadFilters(): Filters {
  try {
    const f = { ...DEFAULTS, ...JSON.parse(localGet('menuFilters') || '{}') }
    return sorters[f.sort] ? f : { ...f, sort: 'name' }
  } catch { return DEFAULTS }
}

const hay = (r: Recipe) => [r.n, r.h, r.cf, r.cs, r.cu, r.p, ...r.i].join(' ').toLowerCase()

function Filter({ value, onChange, any, options }: { value: string; onChange: (v: string) => void; any?: string; options: [string, string][] }) {
  return (
    <Select value={value || 'any'} onValueChange={v => onChange(v === 'any' ? '' : v)}>
      <SelectTrigger size="sm" data-on={!!value && !!any} className="shrink-0 rounded-full bg-secondary dark:bg-secondary data-[on=true]:border-primary data-[on=true]:text-primary">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {any && <SelectItem value="any">{any}</SelectItem>}
        {options.map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function MenuPage() {
  const { food, error } = useFood()
  const basket = useBasket()
  const [f, setF] = useState(loadFilters)
  const set = (k: keyof Filters) => (v: string) => setF(s => ({ ...s, [k]: v }))
  useEffect(() => { localSet('menuFilters', JSON.stringify(f)) }, [f])

  const menu = food?.menu ?? []
  const uniq = (key: 'p' | 'cu') => [...new Set(menu.map(r => r[key]))].sort().map(v => [v, v] as [string, string])
  const list = useMemo(() => {
    const words = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return menu.filter(r =>
      words.every(w => hay(r).includes(w)) &&
      (!f.protein || r.p === f.protein) &&
      (!f.cuisine || r.cu === f.cuisine) &&
      (!+f.time || (r.m && r.m <= +f.time)) &&
      (!+f.kcal || (r.k ?? 1e9) <= +f.kcal),
    ).sort(sorters[f.sort])
  }, [menu, f])
  const filtered = JSON.stringify({ ...f, sort: '' }) !== JSON.stringify({ ...DEFAULTS, sort: '' })

  return (
    <Page
      title="Food"
      back="/apps"
      wide
      actions={
        <Button asChild size="sm" className="rounded-full">
          <Link to="/food/list">
            <ShoppingBasketIcon />List
            {basket.ids.length > 0 && <Badge variant="secondary" className="h-4 min-w-4 rounded-full px-1 text-xs">{basket.ids.length}</Badge>}
          </Link>
        </Button>
      }
    >
      <div className="relative mt-3">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={f.q} onChange={e => set('q')(e.target.value)} placeholder="Search dish or ingredient" className="h-10 rounded-full pl-9" />
      </div>
      <div className="scrollbar-none -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 pb-1">
        <Filter value={f.protein} onChange={set('protein')} any="Any protein" options={uniq('p')} />
        <Filter value={f.cuisine} onChange={set('cuisine')} any="Any cuisine" options={uniq('cu')} />
        <Filter value={f.time} onChange={set('time')} any="Any time" options={[['15', '15 min or less'], ['20', '20 min or less'], ['25', '25 min or less']]} />
        <Filter value={f.kcal} onChange={set('kcal')} any="Any calories" options={[['600', '600 kcal or less'], ['750', '750 kcal or less']]} />
        <Filter value={f.sort} onChange={v => set('sort')(v || 'name')} options={[['name', 'Sort: name'], ['minutes', 'Sort: quickest'], ['kcal', 'Sort: fewest kcal']]} />
        {filtered && <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => setF(DEFAULTS)}>Reset</Button>}
      </div>

      {!food ? <Loading error={error} /> : !list.length ? <Empty icon="🍽">No dishes match these filters.</Empty> : CARBS.map(c => {
        const rs = list.filter(r => r.cf === c)
        if (!rs.length) return null
        return (
          <section key={c}>
            <SectionHead title={c} count={rs.length} />
            <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-3 lg:grid-cols-4">
              {rs.map(r => <RecipeCard key={r.id} r={r} />)}
            </div>
          </section>
        )
      })}
      {food && <p className="pt-6 text-center text-xs text-muted-foreground">{list.length} of {menu.length} dishes</p>}
    </Page>
  )
}
