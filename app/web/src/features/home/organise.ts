import { useState } from 'react'
import { api } from '@/lib/api'

export type Suggestion = {
  id: string
  title: string
  change: { projectId?: string; due?: string }
  listName: string | null
  reason: string
}

export function useOrganise() {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    setSuggestions(null)
    try {
      const r = await api<{ suggestions: Suggestion[] }>('GET', 'organise')
      setSuggestions(r.suggestions)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setSuggestions(null); setError(null) }
  return { suggestions, loading, error, load, reset }
}
