import { api } from '@/lib/api'
import { useResource } from '@/lib/use-resource'

export type Phrase = { burmese: string; phonetic: string; english: string; note: string }
export type Today = { phrase: Phrase | null; index: number; total: number }
export type Bank = { index: number; total: number; phrases: Phrase[] }

const cache: { current: Bank | null } = { current: null }

export function useBank() {
  return useResource<Bank>(() => api('GET', 'burmese/all'), { cache })
}

export const revealNext = () => api<Today>('POST', 'burmese')
