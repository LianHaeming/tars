// A drill's progress on this device, so the game plays with no signal (the Tube). It lives in browser storage and is
// merged with the server's copy (progress.ts merge) whenever there is a connection: on open, a few seconds after
// answering, and when the app is hidden. The server's copy is what follows Lian between devices. Web only.
import { emptyState, merge, type DrillState } from './progress.ts'

const SYNC_AFTER_MS = 3000

const get = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const set = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }
const read = <T>(k: string, fallback: T): T => { try { return JSON.parse(get(k) || '') as T } catch { return fallback } }

// drillStore('burmese-words', '/api/burmese/words/sync') — the server answers POST {state, log} with {state}.
export function drillStore<L>(key: string, url: string) {
  const logKey = `${key}-log`
  let state: DrillState = read(key, emptyState())
  let pending: L[] = read(logKey, [])
  let inflight: Promise<void> | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const save = () => { set(key, JSON.stringify(state)); set(logKey, JSON.stringify(pending)) }

  // sync() — send this device's progress and new answers, adopt the merged result. Fails quietly when offline.
  function sync(): Promise<void> {
    if (inflight) return inflight
    const sent = pending.length
    inflight = fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state, log: pending.slice(0, sent) }),
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
      .then((r: { state: DrillState }) => { state = merge(r.state, state); pending = pending.slice(sent); save() })
      .catch(() => {})
      .finally(() => { inflight = null })
    return inflight
  }

  function record(entry?: L) {
    if (entry) pending.push(entry)
    save()
    clearTimeout(timer)
    timer = setTimeout(() => { sync() }, SYNC_AFTER_MS)
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') navigator.sendBeacon?.(url, JSON.stringify({ state }))
    })
  }

  return { getState: () => state, record, sync }
}
