// The Words drill's progress on this device, so the game plays with no signal (the Tube). It lives in browser storage
// and is merged with the server's copy (shared/words.ts merge) whenever there is a connection: on open, a few seconds
// after answering, and when the app is hidden. The server's copy is what follows Lian between devices.
import { localGet, localSet } from '@tars/ui/lib/api'
import data from '../../../../shared/words.json'
import { emptyState, engine, merge, type LogEntry, type WordsState } from '../../../../shared/words.ts'

const KEY = 'burmese-words'
const LOG_KEY = 'burmese-words-log'
const SYNC_AFTER_MS = 3000

export const words = engine(data)

const read = <T>(k: string, fallback: T): T => { try { return JSON.parse(localGet(k) || '') as T } catch { return fallback } }
let state: WordsState = read(KEY, emptyState())
let pending: LogEntry[] = read(LOG_KEY, [])
let inflight: Promise<void> | null = null
let timer: ReturnType<typeof setTimeout> | undefined

const save = () => { localSet(KEY, JSON.stringify(state)); localSet(LOG_KEY, JSON.stringify(pending)) }

export const getState = () => state

export function record(entry?: LogEntry) {
  if (entry) pending.push(entry)
  save()
  clearTimeout(timer)
  timer = setTimeout(() => { sync() }, SYNC_AFTER_MS)
}

// sync() — send this device's progress and new answers, adopt the merged result. Fails quietly when offline.
export function sync(): Promise<void> {
  if (inflight) return inflight
  const sent = pending.length
  inflight = fetch('/api/burmese/words/sync', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ state, log: pending.slice(0, sent) }),
  })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
    .then((r: { state: WordsState }) => { state = merge(r.state, state); pending = pending.slice(sent); save() })
    .catch(() => {})
    .finally(() => { inflight = null })
  return inflight
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') navigator.sendBeacon?.('/api/burmese/words/sync', JSON.stringify({ state }))
  })
}
