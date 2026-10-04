import { api } from '@/lib/api'
import { useResource } from '@/lib/use-resource'

export type Recurring = {
  key: string; name: string; amount: number; perMonth: number; varies: boolean; seen: number; kind: string
  cadence: 'monthly' | 'weekly'; logo: string | null; category: string; group: string; lastOn: string
}
export type Insight = { title: string; figure?: string; body: string }
export type Summary = {
  fetchedAt: number; balance: number; potTotal: number; recurring: Recurring[]; committed: number; income: number
  insights: Insight[]; insightsAt: number | null; thinking: boolean
}

const cache: { current: Summary | null } = { current: null }

export function useSummary() {
  return useResource(() => api<Summary>('GET', 'money/summary'), { cache, reloadOnVisible: true })
}

export const refreshSummary = () => api<Summary>('GET', 'money/summary-fresh').then(s => (cache.current = s))

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
export const fmt = (pennies: number) => gbp.format(pennies / 100)
export const fmt0 = (pennies: number) => gbp0.format(pennies / 100)
