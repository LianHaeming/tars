import { useCallback, useEffect, useRef, useState } from 'react'

// Debounce a boolean "busy" flag so a loader never flashes on fast responses: it only turns on
// after showDelay, and once on it stays on for at least minVisible so it can't strobe.
export function useDeferredFlag(active: boolean, showDelay = 200, minVisible = 400) {
  const [shown, setShown] = useState(false)
  const shownAt = useRef(0)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    if (active && !shown) {
      t = setTimeout(() => { shownAt.current = Date.now(); setShown(true) }, showDelay)
    } else if (!active && shown) {
      t = setTimeout(() => setShown(false), Math.max(0, minVisible - (Date.now() - shownAt.current)))
    }
    return () => clearTimeout(t)
  }, [active, shown, showDelay, minVisible])
  return shown
}

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

  return { data, error, loading: useDeferredFlag(loading), reload }
}
