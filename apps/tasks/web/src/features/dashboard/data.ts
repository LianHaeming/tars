import { api } from '@tars/ui/lib/api'
import { useResource } from '@tars/ui/lib/use-resource'

export type Insight = { title: string; figure?: string; body: string }
export type Repo = { fullName: string; url: string; stars: number; blurb: string; category: string }
export type Dashboard = {
  money: { balance: number; potTotal: number; committed: number; income: number; insights: Insight[]; thinking: boolean; fetchedAt: number } | null
  moneyError: string | null
  discover: { repos: Repo[] } | null
  discoverError: string | null
}

const cache: { current: Dashboard | null } = { current: null }

export function useDashboard() {
  return useResource(() => api<Dashboard>('GET', 'dashboard'), { cache, reloadOnVisible: true })
}
