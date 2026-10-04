import { useCallback, useEffect, useRef, useState } from 'react'

type Opts<T> = { cache?: { current: T | null }; reloadOnVisible?: boolean }

// One contract for read-mostly server/static data: { data, error, loading, reload }. Pass a module-level
// cache ref to keep a value across mounts (no loading flash on navigation); reloadOnVisible refetches when
// the tab comes back to the foreground. Errors surface as a message instead of being swallowed.
export function useResource<T>(fetcher: () => Promise<T>, { cache, reloadOnVisible }: Opts<T> = {}) {
  const [data, setData] = useState<T | null>(cache?.current ?? null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(cache?.current == null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const reload = useCallback(() => {
    setLoading(true)
    return fetcherRef.current().then(
      v => { if (cache) cache.current = v; setData(v); setError(null) },
      e => setError((e as Error).message || 'Something went wrong'),
    ).finally(() => setLoading(false))
  }, [cache])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (!reloadOnVisible) return
    const onVisible = () => { if (!document.hidden) reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload, reloadOnVisible])

  return { data, error, loading, reload }
}
