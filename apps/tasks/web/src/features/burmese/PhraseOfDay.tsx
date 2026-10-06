import { useEffect, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from 'lucide-react'
import { cn } from '@tars/ui/lib/utils'
import { SectionHead } from '@tars/ui/components/common'
import { Button } from '@tars/ui/components/ui/button'
import { revealNext, useBank } from './data'

export function PhraseOfDay() {
  const { data: bank, error, reload } = useBank()
  const [sel, setSel] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (bank) setSel(bank.index) }, [bank])

  const reveal = () => {
    setBusy(true)
    revealNext().then(() => reload()).finally(() => setBusy(false))
  }

  if (error) return <p className="pt-8 text-sm text-muted-foreground">Couldn't load phrases — {error}.</p>
  if (!bank) return <p className="pt-8 text-sm text-muted-foreground">Loading…</p>
  if (!bank.total) return <p className="pt-8 text-sm text-muted-foreground">No phrases yet — the bank is still being set up.</p>

  const p = bank.phrases[sel]
  const isToday = sel === bank.index
  const more = bank.index < bank.total - 1
  const seen = bank.index + 1

  return (
    <>
      <div className="glass mt-3 rounded-2xl p-5">
        <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          <span>{isToday ? "Today's phrase" : `Phrase ${sel + 1}`}</span>
          <span>{sel + 1} / {seen}</span>
        </div>
        <p lang="my" className="mt-4 text-2xl leading-snug font-semibold">{p.burmese}</p>
        <p className="mt-2 text-lg text-primary">{p.phonetic}</p>
        <p className="mt-3 text-base">{p.english}</p>
        {p.note && <p className="mt-2 text-sm text-muted-foreground">{p.note}</p>}

        <div className="mt-5 flex items-center justify-between">
          <Button variant="secondary" size="icon" onClick={() => setSel(s => Math.max(0, s - 1))} disabled={sel === 0} aria-label="Older phrase" className="size-9 rounded-full [&_svg]:size-5">
            <ChevronLeftIcon />
          </Button>
          <span className="text-xs text-muted-foreground">swipe through what you've seen</span>
          <Button variant="secondary" size="icon" onClick={() => setSel(s => Math.min(bank.index, s + 1))} disabled={sel >= bank.index} aria-label="Newer phrase" className="size-9 rounded-full [&_svg]:size-5">
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      <Button size="block" onClick={reveal} disabled={busy || !more} className="mt-3 w-full">
        <SparklesIcon />
        {more ? (busy ? 'Revealing…' : 'Reveal another now') : "That's all for now"}
      </Button>

      <SectionHead title="Seen so far" count={seen} />
      <ul>
        {bank.phrases.map((_, i) => bank.phrases.length - 1 - i).map(i => {
          const ph = bank.phrases[i]
          return (
            <li key={i}>
              <Button variant="ghost" onClick={() => setSel(i)} className={cn('h-auto w-full items-baseline justify-start gap-3 rounded-none hairline-b py-3 text-left font-normal', i === sel ? 'opacity-100' : 'opacity-80')}>
                <span className="w-6 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span lang="my" className="block truncate font-semibold">{ph.burmese}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{ph.phonetic} · {ph.english}</span>
                </span>
                {i === bank.index && <span className="shrink-0 text-xs font-semibold tracking-wider text-primary uppercase">Today</span>}
              </Button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
