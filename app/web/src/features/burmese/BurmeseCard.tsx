import { useEffect, useRef, useState } from 'react'
import { RefreshCwIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

type Phrase = { burmese: string; phonetic: string; english: string; note: string; date: string | null; stale: boolean; generating: boolean }

let cache: Phrase | null = null

export function BurmeseCard() {
  const [p, setP] = useState<Phrase | null>(cache)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const started = useRef(false)

  const refresh = () => {
    setBusy(true); setError('')
    api<Phrase>('POST', 'burmese').then(x => { cache = x; setP(x); }, e => setError(e.message)).finally(() => setBusy(false))
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    api<Phrase>('GET', 'burmese').then(x => {
      cache = x; setP(x)
      if (!x.burmese || x.stale) refresh()
    }, () => {})
  }, [])

  const generating = busy || p?.generating
  const show = p && p.burmese

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">Burmese, daily 🇲🇲</span>
        <button
          type="button"
          onClick={refresh}
          disabled={generating}
          aria-label="New phrase"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-50"
        >
          <RefreshCwIcon className={cn('size-3.5', generating && 'animate-spin')} />
          New
        </button>
      </div>

      {show ? (
        <div className="mt-3">
          <p lang="my" className="text-xl leading-snug font-semibold">{p!.burmese}</p>
          <p className="mt-1 text-base text-primary">{p!.phonetic}</p>
          <p className="mt-2 text-sm">{p!.english}</p>
          {p!.note && <p className="mt-1 text-xs text-muted-foreground">{p!.note}</p>}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {error ? `Couldn’t get a phrase — ${error}` : 'Learning today’s phrase…'}
        </p>
      )}
    </div>
  )
}
