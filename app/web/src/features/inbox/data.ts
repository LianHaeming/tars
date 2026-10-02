import { useCallback, useEffect, useState } from 'react'
import { api, type Candidate, type Task } from '@/lib/api'

export function useInbox() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    const r = await api<{ candidates: Candidate[] }>('GET', 'inbox')
    setCandidates(r.candidates)
    setLoaded(true)
  }, [])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  const accept = useCallback(async (id: string, overrides?: Partial<Task>) => {
    await api('POST', `inbox/${id}/accept`, overrides)
    setCandidates(cs => cs.filter(c => c.id !== id))
  }, [])

  const dismiss = useCallback(async (id: string) => {
    await api('DELETE', `inbox/${id}`)
    setCandidates(cs => cs.filter(c => c.id !== id))
  }, [])

  return { candidates, loaded, reload, accept, dismiss }
}
