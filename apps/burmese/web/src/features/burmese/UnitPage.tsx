import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Page } from '@tars/ui/components/Page'
import { Button } from '@tars/ui/components/ui/button'
import { Progress } from '@tars/ui/components/ui/progress'
import { Textarea } from '@tars/ui/components/ui/textarea'
import { cn } from '@tars/ui/lib/utils'
import { getUnit, postAnswer, scoreTone, type Card, type Kind, type Result, type Unit, type Word } from './data'

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

const label = (s: Step) => s.type === 'teach' ? 'New' : s.phase === 'review' ? 'Last time' : 'Quick check'

function Phonetic({ children, small, className = '' }: { children: string; small?: boolean; className?: string }) {
  return <p className={`font-bold text-primary ${small ? 'text-xl' : 'text-2xl'} ${className}`}>{children}</p>
}

function Words({ words }: { words: Word[] }) {
  if (!words.length) return null
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      {words.map((w, i) => (
        <div key={i} className="glass rounded-lg px-3 py-2 text-center">
          <div className="text-base font-semibold">{w.p}</div>
          <div className="text-xs text-muted-foreground">{w.e}</div>
        </div>
      ))}
    </div>
  )
}

function Teach({ step, onNext }: { step: Extract<Step, { type: 'teach' }>; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">New sentence {step.n} of {step.of}</p>
      <Phonetic className="mt-6">{step.card.phonetic}</Phonetic>
      <p className="mt-3 text-xl">{step.card.english}</p>
      <Words words={step.card.words} />
      <p className="mt-8 text-sm text-muted-foreground">Say it out loud a couple of times.</p>
      <Button size="lg" className="mt-8 w-full" onClick={onNext}>Next</Button>
    </div>
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

  return (
    <div className="flex flex-col items-center pt-8 text-center">
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {read ? 'What does it mean?' : 'Say it out loud, then type it'}
      </p>
      {read ? <Phonetic className="mt-5">{step.card.phonetic}</Phonetic> : <p className="mt-5 text-2xl font-bold">{step.card.english}</p>}

      {!result ? (
        <form className="mt-8 w-full" onSubmit={e => { e.preventDefault(); if (text.trim()) submit(text) }}>
          <Textarea ref={ref} value={text} onChange={e => setText(e.target.value)} rows={2}
            placeholder={read ? 'Type the English' : 'Type the phonetic'}
            autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="done"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) submit(text) } }} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" size="lg" disabled={busy} onClick={() => submit(null)}>Don't know</Button>
            <Button type="submit" size="lg" disabled={busy || !text.trim()}>{busy ? 'Scoring…' : 'Submit'}</Button>
          </div>
        </form>
      ) : (
        <div className="mt-8 w-full animate-in duration-200 fade-in">
          <p className={`text-hero font-bold tabular-nums ${scoreTone(result.score)}`}>
            {result.score == null ? '—' : `${result.score}%`}
          </p>
          {text.trim() && result.score != null && <p className="mt-2 text-sm text-muted-foreground">You wrote: {text.trim()}</p>}
          <div className="glass mt-6 rounded-lg px-4 py-5">
            <Phonetic small>{result.phonetic}</Phonetic>
            <p className="mt-2 text-lg">{result.english}</p>
          </div>
          {retry && <p className="mt-4 text-sm text-tomorrow">This one comes back in a moment.</p>}
          <Button size="lg" className="mt-6 w-full" autoFocus onClick={() => onDone(result, retry)}>Next</Button>
        </div>
      )}
    </div>
  )
}

function Summary({ done, onAgain }: { done: Done[]; onAgain: () => void }) {
  const navigate = useNavigate()
  const avg = done.length ? Math.round(done.reduce((a, d) => a + (d.score ?? 0), 0) / done.length) : null
  return (
    <div className="pt-8">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Unit done</p>
        <p className={`mt-2 text-hero font-bold tabular-nums ${scoreTone(avg)}`}>{avg == null ? '—' : `${avg}%`}</p>
        <p className="text-sm text-muted-foreground">average over {done.length} answer{done.length === 1 ? '' : 's'}</p>
      </div>
      <div className="mt-6">
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
      <div className="mt-8 grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" onClick={() => navigate('/')}>Done</Button>
        <Button size="lg" onClick={onAgain}>Play another</Button>
      </div>
    </div>
  )
}

export function UnitPage() {
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

  const next = () => { setI(n => n + 1); window.scrollTo(0, 0) }
  const answered = (s: Extract<Step, { type: 'q' }>, r: Result, retry: boolean) => {
    setDone(d => [...d, { card: s.card, kind: s.kind, score: r.score }])
    if (retry) setSteps(all => { const copy = [...all]; copy.splice(Math.min(i + 1 + RETRY_AFTER, copy.length), 0, { ...s, tries: s.tries + 1 }); return copy })
    next()
  }

  return (
    <Page title={finished ? 'Summary' : step ? label(step) : 'Unit'} back="/"
      actions={step && <span className="text-sm font-semibold text-muted-foreground tabular-nums">{i + 1}/{steps.length}</span>}>
      {step && <Progress value={(i / steps.length) * 100} className="mt-3" />}
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
    </Page>
  )
}
