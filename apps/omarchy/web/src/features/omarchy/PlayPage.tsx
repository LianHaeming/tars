import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { ArrowRightIcon, ArrowUpIcon, CheckIcon, XIcon } from 'lucide-react'
import { Button } from '@tars/ui/components/ui/button'
import { Input } from '@tars/ui/components/ui/input'
import { BottomBar, DeckTop, PillButton, Tint } from '@tars/ui/components/deck'
import { cn } from '@tars/ui/lib/utils'
import { MODES, type Card, type Given, type Mode } from '../../../../shared/drill.ts'
import { drill, getState, record, sync } from './store'
import { Keys } from './Keys'

// Endless quick-fire, silent, and offline-first (the engine runs here on the phone, see store.ts), in the mode from
// ?mode= (recall / mixed / choice). Multiple choice moves on almost at once when right; typed cards keep one input
// mounted from card to card so the iPhone keyboard stays up. A miss shows the answer briefly (or until Next).
const MS = { right: 250, typedRight: 450, close: 1500, wrong: 1400, typedWrong: 2000 }
const OPTION = 'glass h-auto min-h-14 w-full rounded-2xl px-4 py-3 text-lg whitespace-normal active:scale-98'
const MODIFIERS = ['Super', 'Shift', 'Ctrl', 'Alt']

type Result = { right: boolean; close: boolean; choice?: string | null; typed?: string }

function Tally({ right, wrong }: { right: number; wrong: number }) {
  return (
    <div className="ml-auto flex items-center gap-3 text-sm font-semibold tabular-nums">
      <span className="flex items-center gap-1 text-today"><CheckIcon className="size-4" />{right}</span>
      <span className="flex items-center gap-1 text-overdue"><XIcon className="size-4" />{wrong}</span>
    </div>
  )
}

function NewCard({ card, onNext }: { card: Card; onNext: () => void }) {
  return (
    <>
      <div className="deck-card mt-5 flex min-h-96 flex-col rounded-3xl p-5">
        <div className="flex items-center justify-between"><Tint color="primary">New</Tint><Tint color="foreground">{card.cat}</Tint></div>
        <div className="my-auto py-8 text-center">
          <Keys kind={card.kind} text={card.q} big />
          <p className="mt-4 text-2xl">{card.does}</p>
        </div>
      </div>
      <BottomBar><PillButton autoFocus onClick={onNext}>Got it</PillButton></BottomBar>
    </>
  )
}

function Prompt({ card, result }: { card: Card; result: Result | null }) {
  const tone = result && (!result.right ? 'bad' : result.close ? 'ok' : 'good')
  return (
    <div data-tone={tone || undefined} className="deck-card mt-5 flex min-h-56 flex-col rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <Tint color={card.stage === 'review' ? 'foreground' : 'tomorrow'}>{card.stage === 'review' ? 'Review' : 'Learning'}</Tint>
        <Tint color="foreground">{card.format === 'type' ? `Type it · ${card.cat}` : card.cat}</Tint>
      </div>
      <div className="my-auto py-6 text-center">
        {card.dir === 'read' ? <Keys kind={card.kind} text={card.q} big /> : <p className="text-2xl font-bold">{card.does}</p>}
        {result && card.format === 'type' && (
          <>
            <div className="mt-4"><Keys kind={card.kind} text={card.q} big /></div>
            {!result.right && result.typed?.trim() && <p className="mt-2 text-sm text-muted-foreground">You wrote <span className="text-overdue">{result.typed.trim()}</span></p>}
            {result.close && <p className="mt-2 text-sm text-muted-foreground">Nearly — you wrote {result.typed?.trim()}</p>}
          </>
        )}
        {result && !result.right && card.format === 'choice' && (
          <div className="mt-4 text-base text-muted-foreground">
            <Keys kind={card.kind} text={card.q} /> <p className="mt-1">{card.does}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Choices({ card, result, onPick }: { card: Card; result: Result | null; onPick: (choice: string | null) => void }) {
  return (
    <>
      <div className="mt-4 grid gap-2">
        {card.options!.map(o => {
          const isAnswer = o.id === card.answer
          const chosen = result?.choice === o.id
          return (
            <Button key={o.id} variant="ghost" disabled={!!result} onClick={() => onPick(o.id)}
              className={cn(OPTION,
                result && isAnswer && 'bg-today/20 text-today disabled:opacity-100',
                chosen && !isAnswer && 'bg-overdue/20 text-overdue disabled:opacity-100')}>
              {card.dir === 'say' ? <Keys kind={card.kind} text={o.text} /> : o.text}
            </Button>
          )
        })}
      </div>
      {!result && (
        <div className="mt-3 text-center">
          <Button variant="link" size="inline" onClick={() => onPick(null)}>I don't know</Button>
        </div>
      )}
    </>
  )
}

function TypeBox({ value, onChange, done, keys, onSubmit, onDontKnow }: {
  value: string; onChange: (v: string) => void; done: boolean; keys: boolean; onSubmit: () => void; onDontKnow: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  const add = (k: string) => onChange(`${value.trim() ? value.trim() + ' ' : ''}${k.toLowerCase()} `)
  return (
    <form className="mt-4" onSubmit={e => { e.preventDefault(); onSubmit() }}>
      {keys && !done && (
        <div className="mb-3 flex justify-center gap-2">
          {MODIFIERS.map(k => (
            <Button key={k} type="button" variant="ghost" size="sm" className="glass rounded-full px-4"
              onMouseDown={e => e.preventDefault()} onClick={() => add(k)}>{k}</Button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input ref={ref} value={value} onChange={e => onChange(e.target.value)} readOnly={done}
          placeholder={keys ? 'e.g. super shift b' : 'Type the command'}
          className="h-12 min-w-0 flex-1 rounded-full px-4"
          autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="go" />
        <Button type="submit" size="icon-lg" aria-label="Check" className="size-12 rounded-full [&_svg:not([class*='size-'])]:size-5">
          {done ? <ArrowRightIcon /> : <ArrowUpIcon />}
        </Button>
      </div>
      {!done && (
        <div className="mt-3 text-center">
          <Button type="button" variant="link" size="inline" onMouseDown={e => e.preventDefault()} onClick={onDontKnow}>I don't know</Button>
        </div>
      )}
    </form>
  )
}

export function PlayPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const mode: Mode = MODES.find(m => m === params.get('mode')) ?? 'recall'
  const [card, setCard] = useState<Card | null>(() => drill.next(getState(), { mode }))
  const [result, setResult] = useState<Result | null>(null)
  const [typed, setTyped] = useState('')
  const [tally, setTally] = useState({ right: 0, wrong: 0 })
  const [n, setN] = useState(0)
  const shownAt = useRef(Date.now())
  const upcoming = useRef<Card | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = (c: Card | null) => { setCard(c); setResult(null); setTyped(''); setN(x => x + 1); shownAt.current = Date.now() }
  const advance = () => { clearTimeout(timer.current); if (upcoming.current) show(upcoming.current); upcoming.current = null }

  useEffect(() => { sync(); return () => clearTimeout(timer.current) }, [])

  const answer = (given: Given) => {
    if (!card || result) return
    const entry = drill.answer(getState(), card.key, given, Date.now() - shownAt.current)
    record(entry)
    setResult({ right: entry.right, close: entry.close, ...given })
    setTally(t => entry.right ? { ...t, right: t.right + 1 } : { ...t, wrong: t.wrong + 1 })
    upcoming.current = drill.next(getState(), { last: card.key, mode })
    const typing = 'typed' in given
    timer.current = setTimeout(advance, !entry.right ? (typing ? MS.typedWrong : MS.wrong) : entry.close ? MS.close : typing ? MS.typedRight : MS.right)
  }

  const seen = () => {
    if (!card) return
    drill.seen(getState(), card.id)
    record()
    show(drill.next(getState(), { last: card.key, mode }))
  }
  const close = () => location.key !== 'default' ? navigate(-1) : navigate('/')
  const question = card && card.stage !== 'new'

  return (
    <main className="mx-auto max-w-page px-4 pt-safe-3 pb-safe-32">
      <DeckTop i={0} total={0} onClose={close}><Tally {...tally} /></DeckTop>
      {card === null ? <p className="pt-16 text-center text-2xl font-semibold">Nothing to play</p>
        : card.stage === 'new' ? <NewCard key={n} card={card} onNext={seen} />
        : (
          <div key={n}>
            <Prompt card={card} result={result} />
            {card.format === 'choice' && <Choices card={card} result={result} onPick={choice => answer({ choice })} />}
            {result && !result.right && card.format === 'choice' && <BottomBar><PillButton autoFocus onClick={advance}>Next</PillButton></BottomBar>}
          </div>
        )}
      {question && card.format === 'type' && (
        <TypeBox value={typed} onChange={setTyped} done={!!result} keys={card.kind === 'keys'}
          onSubmit={() => result ? advance() : typed.trim() && answer({ typed })}
          onDontKnow={() => answer({ typed: '' })} />
      )}
    </main>
  )
}
