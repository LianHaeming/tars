import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { getPractise, type Card } from './data'
import { BottomBar, DeckTop, PillButton, Speak, Tint, WordRow, playClip } from './deck'

// Unscored study of the sentences already started: recall it, flip, mark Again (it comes back a few cards later) or Got it.
// "say" starts from the English (say the Burmese out loud), "hear" from the Burmese (sound + phonetic → meaning).
type Mode = 'say' | 'hear'
type Item = { card: Card; again: number }

const AGAIN_AFTER = 3

function Phonetic({ children }: { children: string }) {
  return <p className="text-phonetic font-bold text-primary">{children}</p>
}

function Flashcard({ item, mode, onDone }: { item: Item; mode: Mode; onDone: (gotIt: boolean) => void }) {
  const [shown, setShown] = useState(false)
  const { card } = item
  const flip = () => { setShown(true); if (mode === 'say') playClip(card.id) }

  return (
    <>
      <div className="deck-card mt-5 flex min-h-96 flex-col rounded-3xl p-5 animate-in duration-200 fade-in">
        <div>{item.again ? <Tint color="tomorrow">Again</Tint> : <Tint color="primary">{mode === 'say' ? 'Say it' : 'Hear it'}</Tint>}</div>
        <div className="my-auto py-8 text-center">
          {mode === 'say' ? <p className="text-2xl font-bold">{card.english}</p> : <Phonetic>{card.phonetic}</Phonetic>}
          {mode === 'hear' && <Speak id={card.id} className="mt-5" />}
          {shown ? (
            <div className="mt-6 animate-in duration-200 fade-in">
              {mode === 'say' ? <Phonetic>{card.phonetic}</Phonetic> : <p className="text-xl">{card.english}</p>}
              {mode === 'say' && <Speak id={card.id} className="mt-5" />}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              {mode === 'say' ? 'Say it out loud in Burmese, then show it.' : 'What does it mean? Then show it.'}
            </p>
          )}
        </div>
        {shown && <WordRow words={card.words} />}
      </div>
      {shown
        ? <BottomBar cols={2}>
            <PillButton quiet onClick={() => onDone(false)}>Again</PillButton>
            <PillButton autoFocus onClick={() => onDone(true)}>Got it</PillButton>
          </BottomBar>
        : <BottomBar><PillButton autoFocus onClick={flip}>Show</PillButton></BottomBar>}
    </>
  )
}

function Summary({ total, again, onMore }: { total: number; again: number; onMore: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="pt-6">
      <div className="deck-card rounded-3xl px-5 py-8 text-center">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Practice done</p>
        <p className="mt-2 text-hero font-bold tabular-nums">{total}</p>
        <p className="text-sm text-muted-foreground">
          sentence{total === 1 ? '' : 's'} gone over{again ? ` · ${again} needed another go` : ''}
        </p>
      </div>
      <BottomBar cols={2}>
        <PillButton quiet onClick={() => navigate('/')}>Done</PillButton>
        <PillButton onClick={onMore}>Next 10</PillButton>
      </BottomBar>
    </div>
  )
}

export function PractisePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const mode: Mode = params.get('from') === 'burmese' ? 'hear' : 'say'
  const [round, setRound] = useState(0)
  const [queue, setQueue] = useState<Item[] | null>(null)
  const [i, setI] = useState(0)
  const [missed, setMissed] = useState(new Set<string>())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setQueue(null); setI(0); setMissed(new Set()); setError(null)
    getPractise(round * 10).then(p => live && setQueue(p.cards.map(card => ({ card, again: 0 }))), e => live && setError((e as Error).message))
    return () => { live = false }
  }, [round])

  const close = () => location.key !== 'default' ? navigate(-1) : navigate('/')
  const done = (item: Item, gotIt: boolean) => {
    if (!gotIt) {
      setMissed(m => new Set(m).add(item.card.id))
      setQueue(q => { const copy = [...q!]; copy.splice(Math.min(i + 1 + AGAIN_AFTER, copy.length), 0, { ...item, again: item.again + 1 }); return copy })
    }
    setI(n => n + 1)
    window.scrollTo(0, 0)
  }
  const finished = queue && i >= queue.length

  return (
    <main className="mx-auto max-w-page px-4 pt-safe-3 pb-safe-32 animate-in duration-200 fade-in">
      <DeckTop i={i} total={queue && !finished ? queue.length : 0} onClose={close} />
      {error ? <p className="pt-8 text-sm text-muted-foreground">Couldn't load — {error}</p>
        : !queue ? <p className="pt-8 text-sm text-muted-foreground">Loading…</p>
        : !queue.length ? (
          <div className="pt-16 text-center">
            <p className="text-2xl font-semibold">Nothing to practise yet</p>
            <p className="mt-2 text-sm text-muted-foreground">Play a unit first — the sentences you start show up here.</p>
          </div>
        )
        : finished ? <Summary total={new Set(queue.map(q => q.card.id)).size} again={missed.size} onMore={() => setRound(r => r + 1)} />
        : <Flashcard key={i} item={queue[i]} mode={mode} onDone={gotIt => done(queue[i], gotIt)} />}
    </main>
  )
}
