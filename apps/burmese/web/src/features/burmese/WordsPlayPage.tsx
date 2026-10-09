import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ArrowRightIcon, ArrowUpIcon, CheckIcon, XIcon } from 'lucide-react'
import { Button } from '@tars/ui/components/ui/button'
import { Input } from '@tars/ui/components/ui/input'
import { cn } from '@tars/ui/lib/utils'
import type { Given, WordCard } from '../../../../shared/words.ts'
import { getState, record, sync, words } from './wordsStore'
import { BottomBar, DeckTop, PillButton, Tint } from './deck'

// Endless quick-fire, silent, and offline-first (the engine runs here on the phone, see wordsStore). Multiple choice
// moves on almost at once when right; typed cards (English → phonetic, once a word is past its first steps) keep one
// input mounted from card to card so the iPhone keyboard stays up. A miss shows the answer briefly (or until Next).
const MS = { right: 250, typedRight: 450, close: 1500, wrong: 1400, typedWrong: 2000 }
const OPTION = 'glass h-auto min-h-14 w-full rounded-2xl px-4 py-3 text-lg whitespace-normal active:scale-98'

type Result = { right: boolean; close: boolean; choice?: string | null; typed?: string }

function Tally({ right, wrong }: { right: number; wrong: number }) {
  return (
    <div className="ml-auto flex items-center gap-3 text-sm font-semibold tabular-nums">
      <span className="flex items-center gap-1 text-today"><CheckIcon className="size-4" />{right}</span>
      <span className="flex items-center gap-1 text-overdue"><XIcon className="size-4" />{wrong}</span>
    </div>
  )
}

function NewWord({ card, onNext }: { card: WordCard; onNext: () => void }) {
  return (
    <>
      <div className="deck-card mt-5 flex min-h-96 flex-col rounded-3xl p-5">
        <div className="flex items-center justify-between"><Tint color="primary">New word</Tint><Tint color="foreground">{card.cat}</Tint></div>
        <div className="my-auto py-8 text-center">
          <p className="text-phonetic font-bold text-primary">{card.phonetic}</p>
          <p className="mt-3 text-2xl">{card.english}</p>
        </div>
      </div>
      <BottomBar><PillButton autoFocus onClick={onNext}>Got it</PillButton></BottomBar>
    </>
  )
}

function Prompt({ card, result }: { card: WordCard; result: Result | null }) {
  const tone = result && (!result.right ? 'bad' : result.close ? 'ok' : 'good')
  return (
    <div data-tone={tone || undefined} className="deck-card mt-5 flex min-h-56 flex-col rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <Tint color={card.stage === 'review' ? 'foreground' : 'tomorrow'}>{card.stage === 'review' ? 'Review' : 'Learning'}</Tint>
        <Tint color="foreground">{card.format === 'type' ? `Type it · ${card.cat}` : card.cat}</Tint>
      </div>
      <div className="my-auto py-6 text-center">
        {card.dir === 'read' ? <p className="text-phonetic font-bold text-primary">{card.prompt}</p> : <p className="text-2xl font-bold">{card.prompt}</p>}
        {result && card.format === 'type' && (
          <>
            <p className={cn('mt-3 text-2xl font-bold', result.right ? (result.close ? 'text-tomorrow' : 'text-today') : 'text-primary')}>{card.phonetic}</p>
            {!result.right && result.typed?.trim() && <p className="mt-1 text-sm text-muted-foreground">You wrote <span className="text-overdue">{result.typed.trim()}</span></p>}
            {result.close && <p className="mt-1 text-sm text-muted-foreground">Nearly — you wrote {result.typed?.trim()}</p>}
          </>
        )}
        {result && !result.right && card.format === 'choice' && (
          <p className="mt-3 text-base text-muted-foreground">
            <span className="font-semibold text-primary">{card.phonetic}</span> = {card.english}
          </p>
        )}
      </div>
    </div>
  )
}

function Choices({ card, result, onPick }: { card: WordCard; result: Result | null; onPick: (choice: string | null) => void }) {
  return (
    <>
      <div className="mt-4 grid gap-2">
        {card.options!.map(o => {
          const isAnswer = o.id === card.answer
          const chosen = result?.choice === o.id
          return (
            <Button key={o.id} variant="ghost" disabled={!!result} onClick={() => onPick(o.id)}
              className={cn(OPTION, card.dir === 'say' && 'font-semibold text-primary',
                result && isAnswer && 'bg-today/20 text-today disabled:opacity-100',
                chosen && !isAnswer && 'bg-overdue/20 text-overdue disabled:opacity-100')}>
              {o.text}
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

function TypeBox({ value, onChange, done, onSubmit, onDontKnow }: {
  value: string; onChange: (v: string) => void; done: boolean; onSubmit: () => void; onDontKnow: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <form className="mt-4" onSubmit={e => { e.preventDefault(); onSubmit() }}>
      <div className="flex items-center gap-2">
        <Input ref={ref} value={value} onChange={e => onChange(e.target.value)} readOnly={done} placeholder="Type the phonetic"
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

export function WordsPlayPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [card, setCard] = useState<WordCard | null>(() => words.next(getState()))
  const [result, setResult] = useState<Result | null>(null)
  const [typed, setTyped] = useState('')
  const [tally, setTally] = useState({ right: 0, wrong: 0 })
  const [n, setN] = useState(0)
  const shownAt = useRef(Date.now())
  const upcoming = useRef<WordCard | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = (c: WordCard | null) => { setCard(c); setResult(null); setTyped(''); setN(x => x + 1); shownAt.current = Date.now() }
  const advance = () => { clearTimeout(timer.current); if (upcoming.current) show(upcoming.current); upcoming.current = null }

  useEffect(() => { sync(); return () => clearTimeout(timer.current) }, [])

  const answer = (given: Given) => {
    if (!card || result) return
    const entry = words.answer(getState(), card.key, given, Date.now() - shownAt.current)
    record(entry)
    setResult({ right: entry.right, close: entry.close, ...given })
    setTally(t => entry.right ? { ...t, right: t.right + 1 } : { ...t, wrong: t.wrong + 1 })
    upcoming.current = words.next(getState(), card.key)
    const typing = 'typed' in given
    timer.current = setTimeout(advance, !entry.right ? (typing ? MS.typedWrong : MS.wrong) : entry.close ? MS.close : typing ? MS.typedRight : MS.right)
  }

  const seen = () => {
    if (!card) return
    words.seen(getState(), card.id)
    record()
    show(words.next(getState(), card.key))
  }
  const close = () => location.key !== 'default' ? navigate(-1) : navigate('/words')
  const question = card && card.stage !== 'new'

  return (
    <main className="mx-auto max-w-page px-4 pt-safe-3 pb-safe-32">
      <DeckTop i={0} total={0} onClose={close}><Tally {...tally} /></DeckTop>
      {card === null ? <p className="pt-16 text-center text-2xl font-semibold">No words yet</p>
        : card.stage === 'new' ? <NewWord key={n} card={card} onNext={seen} />
        : (
          <div key={n}>
            <Prompt card={card} result={result} />
            {card.format === 'choice' && <Choices card={card} result={result} onPick={choice => answer({ choice })} />}
            {result && !result.right && card.format === 'choice' && <BottomBar><PillButton autoFocus onClick={advance}>Next</PillButton></BottomBar>}
          </div>
        )}
      {question && card.format === 'type' && (
        <TypeBox value={typed} onChange={setTyped} done={!!result}
          onSubmit={() => result ? advance() : typed.trim() && answer({ typed })}
          onDontKnow={() => answer({ typed: '' })} />
      )}
    </main>
  )
}
