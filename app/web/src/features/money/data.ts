import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { addDays, today, ymd } from '@/lib/dates'

export type Tx = {
  id: string; created: string; amount: number; currency: string; category: string
  name: string; logo: string | null; spending: boolean; declined: boolean; pending: boolean
}
export type Pot = { id: string; name: string; balance: number; currency: string }
export type Money = { fetchedAt: number; balance: { balance: number; spendToday: number; currency: string }; pots: Pot[]; transactions: Tx[] }

let cache: Money | null = null

export function useMoney() {
  const [data, setData] = useState<Money | null>(cache)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (fresh = false) => {
    setLoading(true)
    try {
      cache = await api<Money>('GET', fresh ? 'money/fresh' : 'money')
      setData(cache)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  return { data, error, loading, refresh: () => load(true) }
}

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
export const fmt = (pennies: number) => gbp.format(pennies / 100)
export const fmt0 = (pennies: number) => gbp0.format(pennies / 100)

export const spent = (t: Tx) => (t.spending && !t.declined && t.amount < 0 ? -t.amount : 0)
export const day = (t: Tx) => ymd(new Date(t.created))

export function categoryName(c: string) {
  if (!c || c.startsWith('category_')) return 'Other'
  const s = c.replace(/_/g, ' ')
  return s[0].toUpperCase() + s.slice(1)
}

export function windowOf(days: number, offset = 0) {
  const end = addDays(today(), -offset * days)
  return { from: ymd(addDays(end, -(days - 1))), to: ymd(end) }
}

export const inWindow = (t: Tx, w: { from: string; to: string }) => { const d = day(t); return d >= w.from && d <= w.to }
