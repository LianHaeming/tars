import { useCallback, useEffect, useState } from 'react'
import { api } from '@tars/ui/lib/api'
import { useResource } from '@tars/ui/lib/use-resource'

export type Kind = 'read' | 'say' | 'hear'
export type Grade = 1 | 2 | 3 | 4
export type Swap = { english: string; burmese: string; phonetic: string; changed: string }
export type Card = {
  id: string; english: string; burmese: string; phonetic: string; note: string; topic: string
  audio?: boolean; hook?: string; swaps?: Swap[]
}
export type Mem = { s: number | null; d: number | null; due: string; last: string | null; reps: number; lapses: number; since: string; next: number[] }
export type Progress = { learnedOn: string; read?: Mem; say?: Mem; hear?: Mem; leech: boolean }
export type Translation = { id: string; at: number; english: string; burmese: string; phonetic: string; literal: string; note: string }
export type Settings = { newPerDay: number; maxReviews: number }
export type BurmeseState = {
  today: string; settings: Settings; newPerDay: number; deck: Card[]; progress: Record<string, Progress>
  days: Record<string, number>; reviewsToday: number; history: Translation[]
  xp: number; streak: number; owned: number; bosses: Record<string, string>; gained?: number
}
export type ReviewExtra = { ms?: number; sure?: boolean | null; ex?: string }

export const KINDS: Kind[] = ['read', 'say', 'hear']
export const OWNED = 21

let cache: BurmeseState | null = null

export function useBurmese() {
  const [data, setData] = useState(cache)
  const [error, setError] = useState<string | null>(null)
  const apply = useCallback((s: BurmeseState) => { cache = s; setData(s); return s }, [])
  const call = useCallback((method: string, path: string, body?: unknown) =>
    api<BurmeseState>(method, 'burmese' + path, body).then(apply, e => { setError((e as Error).message); return null }), [apply])

  useEffect(() => { call('GET', '') }, [call])

  return {
    data, error,
    learn: (id: string) => call('POST', '/learn', { id }),
    review: (id: string, kind: Kind, grade: Grade, extra: ReviewExtra = {}) => call('POST', '/review', { id, kind, grade, ...extra }),
    unlearn: (id: string) => call('POST', '/unlearn', { id }),
    save: (t: Translation) => call('POST', '/save', t),
    settings: (s: Partial<Settings>) => call('POST', '/settings', s),
    boss: (topic: string) => call('POST', '/boss', { topic }),
    hook: (id: string) => api<BurmeseState>('POST', 'burmese/hook', { id }).then(apply),
    clearHistory: () => call('DELETE', '/history'),
    translate: async (text: string) => {
      const item = await api<Translation>('POST', 'burmese/translate', { text })
      if (cache) apply({ ...cache, history: [item, ...cache.history] })
      return item
    },
  }
}

export type Burmese = ReturnType<typeof useBurmese>

export const isOwned = (p?: Progress) => !!p?.say?.s && p.say.s >= OWNED

export function level(xp: number) {
  const n = Math.floor(Math.sqrt(xp / 50)) + 1
  const from = 50 * (n - 1) ** 2, to = 50 * n ** 2
  return { n, into: xp - from, span: to - from }
}

export function span(days: number) {
  if (days <= 0) return 'now'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(days < 730 ? 1 : 0)}y`
}

export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export const audioUrl = (id: string) => `/api/burmese/audio/${encodeURIComponent(id)}`

export type Stats = {
  today: string; days: Record<string, number>; owned: Record<string, number>; xp: number; streak: number; total: number
  retention: number | null; retentionN: number; speed: { week: number | null; before: number | null }
  upcoming: { day: string; count: number }[]
  missed: { id: string; english: string; phonetic: string; topic: string; lapses: number }[]
  topics: { topic: string; total: number; owned: number; learned: number; boss: string | null }[]
  ownedNow: number; deckSize: number
}

const statsCache: { current: Stats | null } = { current: null }
export const useStats = () => useResource<Stats>(() => api('GET', 'burmese/stats'), { cache: statsCache })

export type Phrase = { burmese: string; phonetic: string; english: string; note: string }
export type Bank = { index: number; total: number; phrases: Phrase[] }

const bankCache: { current: Bank | null } = { current: null }

export function useBank() {
  return useResource<Bank>(() => api('GET', 'burmese/phrases'), { cache: bankCache })
}

export const revealNext = () => api('POST', 'burmese/phrase')
