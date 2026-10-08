import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ArrowUpIcon } from 'lucide-react'
import { Button } from '@tars/ui/components/ui/button'
import { Textarea } from '@tars/ui/components/ui/textarea'
import { cn } from '@tars/ui/lib/utils'
import { getUnit, postAnswer, scoreTone, type Card, type Kind, type Result, type Unit } from './data'
import { BottomBar, DeckTop, PillButton, Tint, WordRow } from './deck'

type Step =
  | { type: 'teach'; card: Card; n: number; of: number }
  | { type: 'q'; card: Card; kind: Kind; phase: 'review' | 'new'; tries: number }
type Done = { card: Card; kind: Kind; score: number | null }

const RETRY_AFTER = 2
const MAX_TRIES = 4

function plan(u: Unit): Step[] {
  return [
    ...u.review.map(c => ({ type: 'q' as const, card: c, kind: c.kind, phase: 'review' as const, tries: 1 })),
    ...u.new.map((c, i) => ({ type: 'teach' as const, card: c, n: i + 1, of: u.new.length })),
    ...u.new.map(c => ({ type: 'q' as const, card: c, kind: 'read' as const, phase: 'new' as const, tries: 1 })),
  ]
}

const tone = (score: number | null) => score == null || score < 60 ? 'bad' : score < 85 ? 'ok' : 'good'
const toneColor = { bad: 'overdue', ok: 'tomorrow', good: 'today' } as const

function StepTag({ step }: { step: Step }) {
  if (step.type === 'teach') return <Tint color="primary">New · {step.n} of {step.of}</Tint>
  return step.phase === 'review' ? <Tint color="overdue">Last time</Tint> : <Tint color="primary">Quick check</Tint>
}

function Phonetic({ children }: { children: string }) {
  return <p className="text-phonetic font-bold text-primary">{children}</p>
}

function Teach({ step, onNext }: { step: Extract<Step, { type: 'teach' }>; onNext: () => void }) {
  return (
    <>
      <div className="deck-card mt-5 flex min-h-96 flex-col rounded-3xl p-5 animate-in duration-200 fade-in">
        <div><StepTag step={step} /></div>
        <div className="my-auto py-8 text-center">
          <Phonetic>{step.card.phonetic}</Phonetic>
          <p className="mt-3 text-xl">{step.card.english}</p>
        </div>
        <WordRow words={step.card.words} />
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">Say it out loud a couple of times.</p>
      <BottomBar><PillButton onClick={onNext}>Got it</PillButton></BottomBar>
    </>
  )
}

function Question({ step, unit, onDone }: { step: Extract<Step, { type: 'q' }>; unit: number; onDone: (r: Result, retry: boolean) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  const read = step.kind === 'read'
  const retry = step.phase === 'new' && result != null && result.grade < 3 && step.tries < MAX_TRIES

  useEffect(() => { ref.current?.focus() }, [])

  const submit = (answer: string | null) => {
    if (busy) return
    setBusy(true)
    postAnswer({ unit, id: step.card.id, kind: step.kind, answer, phase: step.phase })
      .then(setResult, e => toast(`Couldn't score that — ${(e as Error).message}`))
      .finally(() => setBusy(false))
  }

  if (result) {
    const t = tone(result.score)
    return (
      <>
        <div data-tone={t} className="deck-card mt-5 flex min-h-96 flex-col rounded-3xl p-5 animate-in duration-200 fade-in">
          <div className="flex items-center justify-between">
            <StepTag step={step} />
            <Tint color={toneColor[t]}><span className="tabular-nums">{result.score == null ? "—" : `${result.score}%`}</span></Tint>
          </div>
          <div className="my-auto py-8 text-center">
            <Phonetic>{result.phonetic}</Phonetic>
            <p className="mt-3 text-xl">{result.english}</p>
            {text.trim() && result.score != null && <p className="mt-4 text-sm text-muted-foreground">You wrote <span className="text-foreground">“{text.trim()}”</span></p>}
          </div>
          <WordRow words={result.words} />
        </div>
        {retry && <p className="mt-4 text-center text-sm text-tomorrow">This one comes back in a moment.</p>}
        <BottomBar><PillButton autoFocus onClick={() => onDone(result, retry)}>Next</PillButton></BottomBar>
      </>
    )
  }

  return (
    <>
      <div className="deck-card mt-5 flex min-h-72 flex-col rounded-3xl p-5 animate-in duration-200 fade-in">
        <div><StepTag step={step} /></div>
        <div className="my-auto py-6 text-center">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {read ? 'What does it mean?' : 'Say it out loud, then type it'}
          </p>
          <div className="mt-3">{read ? <Phonetic>{step.card.phonetic}</Phonetic> : <p className="text-2xl font-bold">{step.card.english}</p>}</div>
        </div>
        <div className="text-center">
          <Button variant="link" size="inline" disabled={busy} onClick={() => submit(null)}>I don't know</Button>
        </div>
      </div>
      <form className="mt-4 flex items-end gap-2" onSubmit={e => { e.preventDefault(); if (text.trim()) submit(text) }}>
        <Textarea ref={ref} value={text} onChange={e => setText(e.target.value)} rows={1}
          placeholder={busy ? 'Scoring…' : read ? 'Type the English' : 'Type the phonetic'}
          className="min-h-12 min-w-0 flex-1 resize-none rounded-3xl px-4 py-3"
          autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="send"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) submit(text) } }} />
        <Button type="submit" size="icon-lg" aria-label="Check" disabled={busy || !text.trim()} className="size-12 rounded-full [&_svg:not([class*='size-'])]:size-5">
          <ArrowUpIcon />
        </Button>
      </form>
      {busy && <p className="mt-3 text-center text-sm text-muted-foreground">Scoring…</p>}
    </>
  )
}

function Summary({ done, onAgain }: { done: Done[]; onAgain: () => void }) {
  const navigate = useNavigate()
  const avg = done.length ? Math.round(done.reduce((a, d) => a + (d.score ?? 0), 0) / done.length) : null
  return (
    <div className="pt-6">
      <div data-tone={tone(avg)} className="deck-card rounded-3xl px-5 py-8 text-center">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Unit done</p>
        <p className={`mt-2 text-hero font-bold tabular-nums ${scoreTone(avg)}`}>{avg == null ? '—' : `${avg}%`}</p>
        <p className="text-sm text-muted-foreground">average over {done.length} answer{done.length === 1 ? '' : 's'}</p>
      </div>
      <div className="mt-4">
        {done.map((d, i) => (
          <div key={i} className="hairline-b flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-primary">{d.card.phonetic}</div>
              <div className="truncate text-sm text-muted-foreground">{d.card.english}</div>
            </div>
            <span className="text-xs text-muted-foreground">{d.kind === 'read' ? 'meaning' : 'phonetic'}</span>
            <span className={cn('w-12 text-right font-semibold tabular-nums', scoreTone(d.score))}>{d.score == null ? '—' : `${d.score}%`}</span>
          </div>
        ))}
      </div>
      <BottomBar cols={2}>
        <PillButton quiet onClick={() => navigate('/')}>Done</PillButton>
        <PillButton onClick={onAgain}>Play another</PillButton>
      </BottomBar>
    </div>
  )
}

export function UnitPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [round, setRound] = useState(0)
  const [unit, setUnit] = useState<Unit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [i, setI] = useState(0)
  const [done, setDone] = useState<Done[]>([])

  useEffect(() => {
    let live = true
    setUnit(null); setError(null); setI(0); setDone([])
    getUnit().then(u => { if (live) { setUnit(u); setSteps(plan(u)) } }, e => live && setError((e as Error).message))
    return () => { live = false }
  }, [round])

  const step = steps[i]
  const finished = unit && i >= steps.length
  const close = () => location.key !== 'default' ? navigate(-1) : navigate('/')

  const next = () => { setI(n => n + 1); window.scrollTo(0, 0) }
  const answered = (s: Extract<Step, { type: 'q' }>, r: Result, retry: boolean) => {
    setDone(d => [...d, { card: s.card, kind: s.kind, score: r.score }])
    if (retry) setSteps(all => { const copy = [...all]; copy.splice(Math.min(i + 1 + RETRY_AFTER, copy.length), 0, { ...s, tries: s.tries + 1 }); return copy })
    next()
  }

  return (
    <main className="mx-auto max-w-page px-4 pt-safe-3 pb-safe-32 animate-in duration-200 fade-in">
      <DeckTop i={i} total={finished ? 0 : steps.length} onClose={close} />
      {error ? <p className="pt-8 text-sm text-muted-foreground">Couldn't start a unit — {error}</p>
        : !unit ? <p className="pt-8 text-sm text-muted-foreground">Loading…</p>
        : !steps.length ? (
          <div className="pt-16 text-center">
            <p className="text-2xl font-semibold">Nothing to do</p>
            <p className="mt-2 text-sm text-muted-foreground">Nothing is slipping and every sentence is started. Ask tars for more sentences.</p>
          </div>
        )
        : finished ? <Summary done={done} onAgain={() => setRound(r => r + 1)} />
        : step.type === 'teach' ? <Teach key={i} step={step} onNext={next} />
        : <Question key={i} step={step} unit={unit.unit} onDone={(r, retry) => answered(step, r, retry)} />}
    </main>
  )
}
