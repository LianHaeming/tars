import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useResource } from '@tars/ui/lib/use-resource'
import { getCards, type LearnedCard } from './data'
import { BottomBar, DeckTop, PillButton, Speak, Tint, WordRow } from './deck'

const cache: { current: LearnedCard[] | null } = { current: null }
const HELD = { slipping: ['overdue', 'Slipping'], learning: ['primary', 'Learning'], solid: ['today', 'Solid'] } as const

function FullCard({ card }: { card: LearnedCard }) {
  const [color, label] = HELD[card.held]
  return (
    <div className="deck-card flex min-h-96 w-full shrink-0 snap-center flex-col rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <Tint color="foreground">{card.catName}</Tint>
        <Tint color={color}>{label}</Tint>
      </div>
      <div className="my-auto py-8 text-center">
        <p className="text-phonetic font-bold text-primary">
          {card.phonetic.split(' ').map((w, n) => <span key={n}>{n > 0 && ' '}<span className="whitespace-nowrap">{w}</span></span>)}
        </p>
        <p className="mt-3 text-xl">{card.english}</p>
        <Speak id={card.id} className="mt-5" />
      </div>
      <WordRow words={card.words} />
    </div>
  )
}

export function CardsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data, error } = useResource(getCards, { cache })
  const rail = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(0)
  const total = data?.length ?? 0

  const step = () => {
    const el = rail.current, first = el?.firstElementChild as HTMLElement | null
    return el && first ? first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0') : 0
  }
  const go = (n: number) => rail.current?.scrollTo({ left: n * step(), behavior: 'smooth' })
  const onScroll = () => { const w = step(); if (w) setI(Math.round(rail.current!.scrollLeft / w)) }
  const close = () => location.key !== 'default' ? navigate(-1) : navigate('/')

  return (
    <main className="mx-auto max-w-page px-4 pt-safe-3 pb-safe-32 animate-in duration-200 fade-in">
      <DeckTop i={i} total={total} onClose={close} />
      {error ? <p className="pt-8 text-sm text-muted-foreground">Couldn't load — {error}</p>
        : !data ? <p className="pt-8 text-sm text-muted-foreground">Loading…</p>
        : !data.length ? (
          <div className="pt-16 text-center">
            <p className="text-2xl font-semibold">No cards yet</p>
            <p className="mt-2 text-sm text-muted-foreground">Play a unit — every sentence you learn is kept here.</p>
          </div>
        ) : (
          <>
            <div ref={rail} onScroll={onScroll} className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto">
              {data.map(c => <FullCard key={c.id} card={c} />)}
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">Newest first · swipe to go through them</p>
            <BottomBar cols={2}>
              <PillButton quiet disabled={i <= 0} onClick={() => go(i - 1)}><ChevronLeftIcon />Previous</PillButton>
              <PillButton disabled={i >= total - 1} onClick={() => go(i + 1)}>Next<ChevronRightIcon /></PillButton>
            </BottomBar>
          </>
        )}
    </main>
  )
}
