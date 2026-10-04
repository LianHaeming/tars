import { useEffect, useState, useSyncExternalStore } from 'react'
import { api, localGet } from '@/lib/api'

export type Recipe = {
  id: string; n: string; h: string; m: number | null; k: number | null
  i: string[]; img: string; cf: string; cs?: string; cu: string; p: string
}
export type Ingredient = { name: string; amount: string; buy: string | null; q: number | null; u: string | null; img: string | null }
export type Step = { points: string[]; notes: { kind: 'tip' | 'important'; text: string }[]; image: string | null; title: string }
export type Detail = { id: string; photo: string; nutrition: [string, number, string][]; ingredients: Ingredient[]; steps: Step[] }
export type ShopEntry = { n?: string; pr: number; slug?: string; url?: string; g?: number; ea?: number; perDish?: boolean; swap?: boolean; note?: string }
export type Shop = { id: string; label: string; data: Record<string, ShopEntry>; link: (e: ShopEntry) => string }
export type Food = { menu: Recipe[]; byId: Map<string, Recipe>; shops: Shop[] }

const DATA = '/data/food/'
const get = <T,>(f: string): Promise<T> => fetch(DATA + f).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
const lower = (o: Record<string, ShopEntry>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]))

let foodP: Promise<Food> | null = null
export function loadFood() {
  return foodP ??= Promise.all([
    get<Recipe[]>('menu.json'),
    get<Record<string, ShopEntry>>('sainsburys.json').catch(() => null),
    get<Record<string, ShopEntry>>('ocado.json').catch(() => null),
  ]).then(([menu, sb, oc]) => {
    const byId = new Map(menu.map(r => [r.id, r]))
    const shops: Shop[] = []
    if (sb) shops.push({ id: 'sainsburys', label: "Sainsbury's", data: lower(sb), link: e => `https://www.sainsburys.co.uk/gol-ui/product/${e.slug}` })
    if (oc) shops.push({ id: 'ocado', label: 'Ocado', data: lower(oc), link: e => e.url! })
    return { byId, shops, menu }
  }).catch(e => { foodP = null; throw e })
}

const details = new Map<string, Promise<Detail>>()
export function loadDetail(id: string) {
  if (!details.has(id)) details.set(id, get<Detail>(`r/${id}.json`).catch(e => { details.delete(id); throw e }))
  return details.get(id)!
}

export function useFood() {
  const [food, setFood] = useState<Food | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => { loadFood().then(setFood, () => setError(true)) }, [])
  return { food, error }
}

export function useDetail(id: string | undefined) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    setDetail(null)
    setError(false)
    if (id) loadDetail(id).then(setDetail, () => setError(true))
  }, [id])
  return { detail, error }
}

type Prefs = { basket: string[]; shop: string }

const prefs = (() => {
  let value: Prefs = { basket: [], shop: '' }
  const subs = new Set<() => void>()
  const emit = () => subs.forEach(f => f())
  async function load() {
    value = await api<Prefs>('GET', 'food')
    const oldBasket = localGet('basket'), oldShop = localGet('shop')
    if (oldBasket !== null || oldShop !== null) {
      let ids: string[] = []
      try { ids = JSON.parse(oldBasket || '{}').ids || [] } catch { /* ignore */ }
      if (!value.basket.length && ids.length) value = await api<Prefs>('PATCH', 'food', { basket: ids })
      if (!value.shop && oldShop) value = await api<Prefs>('PATCH', 'food', { shop: oldShop })
      try { localStorage.removeItem('basket'); localStorage.removeItem('shop') } catch { /* ignore */ }
    }
    emit()
  }
  load().catch(() => {})
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load().catch(() => {}) })
  return {
    get: () => value,
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f) } },
    set(patch: Partial<Prefs>) {
      value = { ...value, ...patch }
      emit()
      api<Prefs>('PATCH', 'food', patch).catch(() => load().catch(() => {}))
    },
  }
})()

export function useBasket() {
  const ids = useSyncExternalStore(prefs.subscribe, prefs.get).basket
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => prefs.set({ basket: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] }),
    clear: () => prefs.set({ basket: [] }),
  }
}

export function useShop(shops: Shop[]) {
  const id = useSyncExternalStore(prefs.subscribe, prefs.get).shop
  return { shop: shops.find(s => s.id === id) || null, setShop: (v: string) => prefs.set({ shop: v }) }
}

export const shopEntry = (shop: Shop | null, buy: string | null) => (buy && shop?.data[buy.toLowerCase()]) || null

export const tagline = (r: Recipe) => [r.cf === 'Other' ? '' : r.cs || r.cf, r.cu === 'Other' ? '' : r.cu, r.p].filter(Boolean).join(' · ')
export const meta = (r: Recipe) => [r.m ? `${r.m} min` : '', r.k ? `${r.k} kcal` : ''].filter(Boolean).join(' · ')

export function shopPacks(e: ShopEntry, units: [string, number][], dishes: number) {
  if (e.perDish) return Math.ceil(dishes / (e.ea || 1))
  let g = 0, n = 0, p = 0
  for (const [u, q] of units) {
    if (u === 'g' || u === 'ml') g += q
    else if (u === 'tbsp') g += q * 15
    else if (u === 'tsp') g += q * 5
    else if (['', 'nest', 'pot'].includes(u)) n += q
    else if (['carton', 'bunch'].includes(u)) p += Math.ceil(q)
    else p = Math.max(p, 1)
  }
  if (g && e.g) p = Math.max(p, Math.ceil(g / e.g))
  if (n) p = Math.max(p, Math.ceil(n / (e.ea || 1)))
  return Math.max(p, 1)
}

function fmtQ(q: number, u: string) {
  const n = Math.round(q * 100) / 100
  if (!u) return `${n}`
  if (['g', 'ml', 'kg', 'l'].includes(u)) return `${n}${u}`
  if (['tsp', 'tbsp'].includes(u)) return `${n} ${u}`
  return `${n} ${u}${n > 1 ? (/(ch|sh|s)$/.test(u) ? 'es' : 's') : ''}`
}

export type Line = { name: string; img: string | null; amount: string; units: [string, number][]; dishes: number; dishIds: string[] }

export async function totals(ids: string[]): Promise<Line[]> {
  const ds = await Promise.all(ids.map(id => loadDetail(id).catch(() => null)))
  const lines = new Map<string, { name: string; img: string | null; byUnit: Map<string, number>; other: string[]; dishes: Set<string> }>()
  for (const d of ds) {
    for (const i of d?.ingredients || []) {
      if (!i.buy) continue
      const key = i.buy.toLowerCase()
      if (!lines.has(key)) lines.set(key, { name: i.buy, img: i.img, byUnit: new Map(), other: [], dishes: new Set() })
      const L = lines.get(key)!
      L.dishes.add(d!.id)
      if (i.q == null) { if (i.amount) L.other.push(i.amount); continue }
      L.byUnit.set(i.u || '', (L.byUnit.get(i.u || '') || 0) + i.q)
    }
  }
  return [...lines.values()].map(L => ({
    name: L.name, img: L.img,
    amount: [...[...L.byUnit].map(([u, q]) => fmtQ(q, u)), ...L.other].join(' + '),
    units: L.other.length ? [...L.byUnit, ['?', 1] as [string, number]] : [...L.byUnit],
    dishes: L.dishes.size, dishIds: [...L.dishes],
  })).sort((a, b) => a.name.localeCompare(b.name))
}

export const RI: Record<string, number> = {
  'Energy (kcal)': 2000, Protein: 50, Carbohydrate: 260, 'of which sugars': 90, Fat: 70,
  'of which saturates': 20, 'Dietary Fibre': 30, Salt: 6,
}
export const NUTRIENT_TILES: [string, string, string?, string?][] = [
  ['Energy (kcal)', 'Energy'], ['Protein', 'Protein'], ['Carbohydrate', 'Carbs', 'of which sugars', 'sugars'],
  ['Fat', 'Fat', 'of which saturates', 'saturates'], ['Dietary Fibre', 'Fibre'], ['Salt', 'Salt'],
]
