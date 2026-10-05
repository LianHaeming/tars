import { createContext, useContext, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { useTars } from '@/features/tasks/store'

export type Suggestion = {
  id: string
  title: string
  change: { projectId?: string; due?: string }
  listName: string | null
  reason: string
}

type Phase = 'idle' | 'loading' | 'error' | 'review' | 'done'

type Ctx = {
  loose: number
  phase: Phase
  error: string | null
  total: number
  idx: number
  applied: number
  current: Suggestion | null
  start: () => void
  accept: () => void
  skip: () => void
  stop: () => void
}

const OrganiseContext = createContext<Ctx | null>(null)

export function useOrganise() {
  const c = useContext(OrganiseContext)
  if (!c) throw new Error('useOrganise must be used within OrganiseProvider')
  return c
}

export function OrganiseProvider({ children }: { children: ReactNode }) {
  const { state, patch } = useTars()
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [applied, setApplied] = useState(0)

  const loose = state.tasks.filter(t => !t.done && (!t.projectId || !t.due)).length

  const start = async () => {
    setLoading(true); setError(null); setSuggestions(null); setIdx(0); setApplied(0)
    try {
      const r = await api<{ suggestions: Suggestion[] }>('GET', 'organise')
      setSuggestions(r.suggestions)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  const stop = () => { setSuggestions(null); setError(null); setIdx(0); setApplied(0) }
  const accept = () => { const s = suggestions?.[idx]; if (!s) return; setIdx(i => i + 1); setApplied(a => a + 1); patch(s.id, s.change) }
  const skip = () => setIdx(i => i + 1)

  const phase: Phase = loading ? 'loading'
    : error && !suggestions ? 'error'
    : suggestions == null ? 'idle'
    : idx >= suggestions.length ? 'done'
    : 'review'

  const value: Ctx = {
    loose, phase, error, total: suggestions?.length ?? 0, idx, applied,
    current: phase === 'review' ? suggestions![idx] : null,
    start, accept, skip, stop,
  }
  return <OrganiseContext.Provider value={value}>{children}</OrganiseContext.Provider>
}
