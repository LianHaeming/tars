import { useEffect, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Page } from '@/components/Page'
import { SectionHead } from '@/components/common'
import type { Bank, Today } from './data'

export function BurmesePage() {
  const [bank, setBank] = useState<Bank | null>(null)
  const [sel, setSel] = useState(0)
  const [busy, setBusy] = useState(false)

  const load = (focusLatest = true) =>
    api<Bank>('GET', 'burmese/all').then(b => { setBank(b); if (focusLatest) setSel(b.index) }, () => {})

  useEffect(() => { load() }, [])

  const reveal = () => {
    setBusy(true)
    api<Today>('POST', 'burmese').then(() => load(true)).finally(() => setBusy(false))
  }

  if (!bank) return <Page title="Burmese"><p className="pt-8 text-sm text-muted-foreground">Loading…</p></Page>
  if (!bank.total) return <Page title="Burmese"><p className="pt-8 text-sm text-muted-foreground">No phrases yet — the bank is still being set up.</p></Page>

  const p = bank.phrases[sel]
  const isToday = sel === bank.index
  const more = bank.index < bank.total - 1
  const seen = bank.index + 1

  return (
    <Page title="Burmese 🇲🇲">
      <div className="glass rounded-2xl p-5 pt-safe-2">
        <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          <span>{isToday ? "Today's phrase" : `Phrase ${sel + 1}`}</span>
          <span>{sel + 1} / {seen}</span>
        </div>
        <p lang="my" className="mt-4 text-2xl leading-snug font-semibold">{p.burmese}</p>
        <p className="mt-2 text-lg text-primary">{p.phonetic}</p>
        <p className="mt-3 text-base">{p.english}</p>
        {p.note && <p className="mt-2 text-sm text-muted-foreground">{p.note}</p>}

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSel(s => Math.max(0, s - 1))}
            disabled={sel === 0}
            aria-label="Older phrase"
            className="inline-flex size-9 items-center justify-center rounded-full bg-secondary disabled:opacity-40"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <span className="text-xs text-muted-foreground">swipe through what you've seen</span>
          <button
            type="button"
            onClick={() => setSel(s => Math.min(bank.index, s + 1))}
            disabled={sel >= bank.index}
            aria-label="Newer phrase"
            className="inline-flex size-9 items-center justify-center rounded-full bg-secondary disabled:opacity-40"
          >
            <ChevronRightIcon className="size-5" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={reveal}
        disabled={busy || !more}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        <SparklesIcon className="size-4" />
        {more ? (busy ? 'Revealing…' : 'Reveal another now') : "That's all for now"}
      </button>

      <SectionHead title="Seen so far" count={seen} />
      <ul>
        {bank.phrases.map((_, i) => bank.phrases.length - 1 - i).map(i => {
          const ph = bank.phrases[i]
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setSel(i)}
                className={cn('flex w-full items-baseline gap-3 hairline-b py-3 text-left', i === sel && 'opacity-100', i !== sel && 'opacity-80')}
              >
                <span className="w-6 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span lang="my" className="block truncate font-semibold">{ph.burmese}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{ph.phonetic} · {ph.english}</span>
                </span>
                {i === bank.index && <span className="shrink-0 text-xs font-semibold tracking-wider text-primary uppercase">Today</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </Page>
  )
}
