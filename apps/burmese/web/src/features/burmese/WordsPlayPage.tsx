import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { CheckIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@tars/ui/components/ui/button'
import { cn } from '@tars/ui/lib/utils'
import { answerWord, seenWord, startWords, type WordCard } from './data'
import { BottomBar, DeckTop, PillButton, Tint } from './deck'

// Endless quick-fire, silent: a right answer moves on almost at once, a miss shows the answer briefly (or until Next). The server picks every card (words.js), so misses come back a few cards later.
const RIGHT_MS = 250
const WRONG_MS = 1200
const OPTION = 'glass h-auto min-h-14 w-full rounded-2xl px-4 py-3 text-lg whitespace-normal active:scale-98'

type Picked = { choice: string | null; right: boolean }

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

function Question({ card, picked, onPick, onNext }: { card: WordCard; picked: Picked | null; onPick: (choice: string | null) => void; onNext: () => void }) {
  const read = card.dir === 'read'
  const tone = picked && (picked.right ? 'good' : 'bad')
  return (
    <>
      <div data-tone={tone || undefined} className="deck-card mt-5 flex min-h-56 flex-col rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <Tint color={card.stage === 'review' ? 'foreground' : 'tomorrow'}>{card.stage === 'review' ? 'Review' : 'Learning'}</Tint>
          <Tint color="foreground">{card.cat}</Tint>
        </div>
        <div className="my-auto py-6 text-center">
          {read ? <p className="text-phonetic font-bold text-primary">{card.prompt}</p> : <p className="text-2xl font-bold">{card.prompt}</p>}
          {picked && !picked.right && (
            <p className="mt-3 text-base text-muted-foreground">
              <span className="font-semibold text-primary">{card.phonetic}</span> = {card.english}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {card.options!.map(o => {
          const isAnswer = o.id === card.answer
          const chosen = picked?.choice === o.id
          return (
            <Button key={o.id} variant="ghost" disabled={!!picked} onClick={() => onPick(o.id)}
              className={cn(OPTION, !read && 'font-semibold text-primary',
                picked && isAnswer && 'bg-today/20 text-today disabled:opacity-100',
                chosen && !isAnswer && 'bg-overdue/20 text-overdue disabled:opacity-100')}>
              {o.text}
            </Button>
          )
        })}
      </div>
      {!picked && (
        <div className="mt-3 text-center">
          <Button variant="link" size="inline" onClick={() => onPick(null)}>I don't know</Button>
        </div>
      )}
      {picked && !picked.right && <BottomBar><PillButton autoFocus onClick={onNext}>Next</PillButton></BottomBar>}
    </>
  )
}

export function WordsPlayPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [card, setCard] = useState<WordCard | null | undefined>(undefined)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [tally, setTally] = useState({ right: 0, wrong: 0 })
  const [error, setError] = useState<string | null>(null)
  const [n, setN] = useState(0)
  const shownAt = useRef(Date.now())
  const pending = useRef<Promise<WordCard | null> | null>(null)

  const show = (c: WordCard | null) => { setCard(c); setPicked(null); setN(x => x + 1); shownAt.current = Date.now() }
  const fail = (e: unknown) => toast(`Couldn't reach the app — ${(e as Error).message}`)

  useEffect(() => { startWords().then(r => show(r.next), e => setError((e as Error).message)) }, [])

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const advance = () => { clearTimeout(timer.current); const p = pending.current; pending.current = null; p?.then(show, fail) }
  useEffect(() => () => clearTimeout(timer.current), [])

  const pick = (choice: string | null) => {
    if (!card || picked) return
    const right = choice === card.answer
    setPicked({ choice, right })
    setTally(t => right ? { ...t, right: t.right + 1 } : { ...t, wrong: t.wrong + 1 })
    pending.current = answerWord(card.key, choice, Date.now() - shownAt.current).then(r => r.next)
    timer.current = setTimeout(advance, right ? RIGHT_MS : WRONG_MS)
  }

  const seen = () => { if (card) seenWord(card.id).then(r => show(r.next), fail) }
  const close = () => location.key !== 'default' ? navigate(-1) : navigate('/words')

  return (
    <main className="mx-auto max-w-page px-4 pt-safe-3 pb-safe-32">
      <DeckTop i={0} total={0} onClose={close}><Tally {...tally} /></DeckTop>
      {error ? <p className="pt-8 text-sm text-muted-foreground">Couldn't start — {error}</p>
        : card === undefined ? <p className="pt-8 text-sm text-muted-foreground">Loading…</p>
        : card === null ? <p className="pt-16 text-center text-2xl font-semibold">No words yet</p>
        : card.stage === 'new' ? <NewWord key={n} card={card} onNext={seen} />
        : <Question key={n} card={card} picked={picked} onPick={pick} onNext={advance} />}
    </main>
  )
}
