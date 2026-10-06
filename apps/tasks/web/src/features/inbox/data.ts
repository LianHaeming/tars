import { useEffect, useState } from 'react'
import { api } from '@tars/ui/lib/api'
import type { Candidate, Task } from '@/lib/types'
import { useResource } from '@tars/ui/lib/use-resource'

export function useInbox() {
  const { data, error, loading, reload } = useResource(
    () => api<{ candidates: Candidate[] }>('GET', 'inbox'),
    { reloadOnVisible: true },
  )
  const [candidates, setCandidates] = useState<Candidate[]>([])
  useEffect(() => { if (data) setCandidates(data.candidates) }, [data])

  const accept = async (id: string, overrides?: Partial<Task>) => {
    await api('POST', `inbox/${id}/accept`, overrides)
    setCandidates(cs => cs.filter(c => c.id !== id))
  }
  const dismiss = async (id: string) => {
    await api('DELETE', `inbox/${id}`)
    setCandidates(cs => cs.filter(c => c.id !== id))
  }

  return { candidates, loaded: data != null, error, loading, reload, accept, dismiss }
}
