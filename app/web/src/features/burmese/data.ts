import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useResource } from '@/lib/use-resource'

export type Dir = 'my' | 'en'
export type Card = { id: string; english: string; burmese: string; phonetic: string; note: string; topic: string }
export type Box = { box: number; due: string }
export type Progress = { learnedOn: string; my: Box; en: Box }
export type Translation = { id: string; at: number; english: string; burmese: string; phonetic: string; literal: string; note: string }
export type BurmeseState = {
  today: string; newPerDay: number; deck: Card[]; progress: Record<string, Progress>
  days: Record<string, number>; history: Translation[]
}

let cache: BurmeseState | null = null

export function useBurmese() {
  const [data, setData] = useState(cache)
  const [error, setError] = useState<string | null>(null)
  const apply = useCallback((s: BurmeseState) => { cache = s; setData(s) }, [])
  const call = useCallback((method: string, path: string, body?: unknown) =>
    api<BurmeseState>(method, 'burmese' + path, body).then(apply, e => setError((e as Error).message)), [apply])

  useEffect(() => { call('GET', '') }, [call])

  return {
    data, error,
    learn: (id: string) => call('POST', '/learn', { id }),
    review: (id: string, dir: Dir, ok: boolean) => call('POST', '/review', { id, dir, ok }),
    unlearn: (id: string) => call('POST', '/unlearn', { id }),
    save: (t: Translation) => call('POST', '/save', t),
    clearHistory: () => call('DELETE', '/history'),
    translate: async (text: string) => {
      const item = await api<Translation>('POST', 'burmese/translate', { text })
      if (cache) apply({ ...cache, history: [item, ...cache.history] })
      return item
    },
  }
}

export const MASTERED = 4
export const isMastered = (p?: Progress) => !!p && p.my.box >= MASTERED && p.en.box >= MASTERED

export function streak(days: Record<string, number>, today: string) {
  const step = (d: string) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10) }
  let d = days[today] ? today : step(today), n = 0
  while (days[d]) { n++; d = step(d) }
  return n
}

export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export type Phrase = { burmese: string; phonetic: string; english: string; note: string }
export type Bank = { index: number; total: number; phrases: Phrase[] }

const bankCache: { current: Bank | null } = { current: null }

export function useBank() {
  return useResource<Bank>(() => api('GET', 'burmese/phrases'), { cache: bankCache })
}

export const revealNext = () => api('POST', 'burmese/phrase')
