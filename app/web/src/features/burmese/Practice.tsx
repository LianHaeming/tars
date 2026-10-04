import { useMemo, useState } from 'react'
import { CheckIcon, RotateCcwIcon, SparklesIcon } from 'lucide-react'
import { localGet, localSet } from '@/lib/api'
import { hash, isMastered, streak, type BurmeseState, type Card, type Dir } from './data'

type Mode = 'mix' | Dir
const MODES: { key: Mode; label: string }[] = [
  { key: 'mix', label: 'Both ways' },
  { key: 'my', label: 'To English' },
  { key: 'en', label: 'To Burmese' },
]
const GOAL = 100

type Props = {
  data: BurmeseState
  learn: (id: string) => Promise<unknown>
  review: (id: string, dir: Dir, ok: boolean) => Promise<unknown>
}

function Script({ text }: { text: string }) {
  return <p lang="my" className="mt-2 text-base text-muted-foreground">{text}</p>
}

export function Practice({ data, learn, review }: Props) {
  const [mode, setMode] = useState<Mode>(() => (localGet('burmese-mode') as Mode) || 'mix')
  const [extra, setExtra] = useState(0)
  const [shown, setShown] = useState(false)
  const [missed, setMissed] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const pickMode = (m: Mode) => { setMode(m); localSet('burmese-mode', m) }

  const { today, deck, progress, newPerDay, days } = data
  const learned = deck.filter(c => progress[c.id])
  const learnedToday = learned.filter(c => progress[c.id].learnedOn === today).length
  const next = deck.find(c => !progress[c.id])
  const showNew = !!next && learnedToday < newPerDay + extra

  const dirs: Dir[] = mode === 'mix' ? ['my', 'en'] : [mode]
  const due = useMemo(() => learned
    .flatMap(c => dirs.filter(d => progress[c.id][d].due <= today).map(dir => ({ card: c, dir, key: `${c.id}:${dir}` })))
    .sort((a, b) => Number(missed.includes(a.key)) - Number(missed.includes(b.key)) || hash(today + a.key) - hash(today + b.key)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [data, mode, missed])
  const dueAll = learned.reduce((n, c) => n + (['my', 'en'] as Dir[]).filter(d => progress[c.id][d].due <= today).length, 0)

  const mastered = learned.filter(c => isMastered(progress[c.id])).length
  const days_ = streak(days, today)
  const goal = Math.max(GOAL, learned.length)

  const act = (fn: () => Promise<unknown>) => { setBusy(true); fn().finally(() => { setBusy(false); setShown(false) }) }
  const grade = (ok: boolean) => {
    const q = due[0]
    if (!ok) setMissed(m => [...m.filter(k => k !== q.key), q.key])
    act(() => review(q.card.id, q.dir, ok))
  }

  return (
    <>
      <div className="px-1 pt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span><span className="font-semibold">{learned.length}</span> <span className="text-muted-foreground">of {goal} sentences</span></span>
          <span className="text-xs text-muted-foreground">{mastered} solid · {days_ ? `${days_}-day streak` : 'start a streak today'}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-week" style={{ width: `${Math.min(100, (learned.length / goal) * 100)}%` }} />
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none">
        {MODES.map(m => (
          <button key={m.key} type="button" data-on={mode === m.key} onClick={() => pickMode(m.key)}
            className="shrink-0 rounded-full bg-secondary px-3 py-2 text-sm font-semibold whitespace-nowrap data-[on=true]:bg-foreground data-[on=true]:text-background">
            {m.label}
          </button>
        ))}
      </div>

      <div className="glass mt-3 rounded-2xl p-5">
        {showNew && next ? (
          <NewCard card={next} n={learnedToday + 1} of={newPerDay + extra} busy={busy} onLearn={() => act(() => learn(next.id))} />
        ) : due.length ? (
          <ReviewCard key={due[0].key} card={due[0].card} dir={due[0].dir} left={due.length} shown={shown} busy={busy} onShow={() => setShown(true)} onGrade={grade} />
        ) : (
          <div className="py-2 text-center">
            <CheckIcon className="mx-auto size-8 text-today" />
            <p className="mt-2 text-lg font-semibold">{learned.length >= goal && !next ? `All ${learned.length} learned` : 'Done for today'}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode !== 'mix' && dueAll ? `${dueAll} still due in the other direction.` : 'Come back tomorrow — the ones you know get spaced further apart.'}
            </p>
            {next && (
              <button type="button" onClick={() => setExtra(x => x + 1)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-primary">
                <SparklesIcon className="size-4" />Learn one more
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function NewCard({ card, n, of, busy, onLearn }: { card: Card; n: number; of: number; busy: boolean; onLearn: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        <span className="text-week">New · {n} of {of}</span>
        <span>{card.topic}</span>
      </div>
      <p className="mt-4 text-lg">{card.english}</p>
      <p className="mt-3 text-2xl font-semibold text-primary">{card.phonetic}</p>
      <Script text={card.burmese} />
      {card.note && <p className="mt-3 text-sm text-muted-foreground">{card.note}</p>}
      <p className="mt-4 text-xs text-muted-foreground">Say it out loud three times, then you'll be tested on it both ways.</p>
      <button type="button" disabled={busy} onClick={onLearn} className="mt-4 w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        Got it
      </button>
    </>
  )
}

function ReviewCard({ card, dir, left, shown, busy, onShow, onGrade }: {
  card: Card; dir: Dir; left: number; shown: boolean; busy: boolean; onShow: () => void; onGrade: (ok: boolean) => void
}) {
  const toEnglish = dir === 'my'
  return (
    <>
      <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        <span>{toEnglish ? 'What does this mean?' : 'Say it in Burmese'}</span>
        <span>{left} left</span>
      </div>
      {toEnglish ? (
        <>
          <p className="mt-4 text-2xl font-semibold text-primary">{card.phonetic}</p>
          <Script text={card.burmese} />
        </>
      ) : (
        <p className="mt-4 text-2xl font-semibold">{card.english}</p>
      )}

      {shown ? (
        <>
          <div className="mt-4 hairline-t pt-4">
            {toEnglish ? (
              <p className="text-lg">{card.english}</p>
            ) : (
              <>
                <p className="text-2xl font-semibold text-primary">{card.phonetic}</p>
                <Script text={card.burmese} />
              </>
            )}
            {card.note && <p className="mt-2 text-sm text-muted-foreground">{card.note}</p>}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" disabled={busy} onClick={() => onGrade(false)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-sm font-semibold text-overdue disabled:opacity-50">
              <RotateCcwIcon className="size-4" />Missed it
            </button>
            <button type="button" disabled={busy} onClick={() => onGrade(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-today/15 py-3 text-sm font-semibold text-today disabled:opacity-50">
              <CheckIcon className="size-4" />Got it
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={onShow} className="mt-5 w-full rounded-2xl bg-secondary py-3 text-sm font-semibold text-primary">
          Show answer
        </button>
      )}
    </>
  )
}
