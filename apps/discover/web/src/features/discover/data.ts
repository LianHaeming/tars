import { api } from '@tars/ui/lib/api'
import { useResource } from '@tars/ui/lib/use-resource'

export type Repo = {
  fullName: string
  url: string
  description: string
  stars: number
  language: string | null
  blurb: string
  category: string
}
export type Discover = { day: string | null; at: number | null; repos: Repo[]; error: string | null }

const cache: { current: Discover | null } = { current: null }

export function useDiscover() {
  return useResource(() => api<Discover>('GET', 'discover'), { cache })
}

export const refreshDiscover = () => api<Discover>('GET', 'discover/fresh').then(d => (cache.current = d))

const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 })
export const stars = (n: number) => compact.format(n)
