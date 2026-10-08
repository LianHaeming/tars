import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckIcon, LightbulbIcon, SnailIcon, TurtleIcon, Volume2Icon, XIcon } from 'lucide-react'
import { cn } from '@tars/ui/lib/utils'
import { Button } from '@tars/ui/components/ui/button'
import { audioUrl, span, type Card, type Grade } from './data'
import { buildFor, gapFor, pickOptions, type Item } from './session'

export type Done = (grade: Grade, meta: { ms: number; sure?: boolean | null; ex: string }) => void

const GRADES: { g: Grade; label: string; tone: string }[] = [
  { g: 1, label: 'Again', tone: 'text-overdue' },
  { g: 2, label: 'Hard', tone: 'text-tomorrow' },
  { g: 3, label: 'Good', tone: 'text-today' },
  { g: 4, label: 'Easy', tone: 'text-primary' },
]

const PROMPT: Record<string, string> = {
  read: 'What does this mean?', say: 'Say it in Burmese — out loud', hear: 'What did you hear?', swap: 'Same pattern, one thing changed — say it',
  pick: 'Pick the meaning', build: 'Build it — tap the pieces in order', gap: 'Fill the gap',
}

let player: HTMLAudioElement | null = null
function play(id: string, rate = 1) {
  player?.pause()
  player = new Audio(audioUrl(id))
  player.playbackRate = rate
  return player.play().catch(() => {})
}

export function AudioButtons({ id, auto }: { id: string; auto?: boolean }) {
  useEffect(() => { if (auto) play(id) }, [id, auto])
  return (
    <span className="inline-flex gap-2">
      <Button variant="secondary" size="icon" aria-label="Play" onClick={() => play(id)} className="rounded-full text-primary"><Volume2Icon /></Button>
      <Button variant="secondary" size="icon" aria-label="Play slowly" onClick={() => play(id, 0.7)} className="rounded-full text-muted-foreground"><TurtleIcon /></Button>
    </span>
  )
}

export function Script({ text }: { text: string }) {
  return <p lang="my" className="mt-2 text-base text-muted-foreground">{text}</p>
}

function Top({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      <span>{left}</span><span className="shrink-0">{right}</span>
    </div>
  )
}

export function Answer({ card, english = true, hookFor }: { card: Card; english?: boolean; hookFor?: (id: string) => void }) {
  return (
    <div className="mt-4 hairline-t pt-4">
      {english && <p className="text-lg">{card.english}</p>}
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-semibold text-primary">{card.phonetic}</p>
          <Script text={card.burmese} />
        </div>
        {card.audio && <AudioButtons id={card.id} />}
      </div>
      {card.note && <p className="mt-2 text-sm text-muted-foreground">{card.note}</p>}
      {card.hook && <p className="mt-2 flex gap-2 text-sm"><LightbulbIcon className="mt-0.5 size-4 shrink-0 text-tomorrow" />{card.hook}</p>}
      {!card.hook && hookFor && (
        <Button variant="link" size="inline" onClick={() => hookFor(card.id)} className="mt-2 text-tomorrow"><SnailIcon />Keeps slipping? Give me a memory hook</Button>
      )}
    </div>
  )
}

function useClock() {
  const [t0] = useState(() => Date.now())
  return () => Date.now() - t0
}

export function GradeButtons({ next, onGrade, busy }: { next: number[]; onGrade: (g: Grade) => void; busy: boolean }) {
  return (
    <div className="mt-5 grid grid-cols-4 gap-2">
      {GRADES.map(({ g, label, tone }) => (
        <Button key={g} size="block" variant="secondary" disabled={busy} onClick={() => onGrade(g)} className={cn('flex-col gap-0 px-1', tone)}>
          <span>{label}</span>
          <span className="text-xs font-normal text-muted-foreground">{span(next[g - 1])}</span>
        </Button>
      ))}
    </div>
  )
}

type Props = { item: Item; deck: Card[]; today: string; left: ReactNode; busy: boolean; onDone: Done; hookFor?: (id: string) => void; leech?: boolean }

function Flip({ item, left, busy, onDone, hookFor, leech }: Props) {
  const { card, kind, mem, ex } = item
  const [sure, setSure] = useState<boolean | null | undefined>(undefined)
  const swap = useMemo(() => (ex === 'swap' && card.swaps?.length ? card.swaps[mem.reps % card.swaps.length] : null), [ex, card, mem.reps])
  const clock = useClock()
  const ms = useRef(0)
  const shown = sure !== undefined
  const reveal = (s: boolean | null) => { ms.current = clock(); setSure(s) }
  const grade = (g: Grade) => onDone(g, { ms: ms.current, sure, ex })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (!shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(null) }
      else if (shown && !busy && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key) as Grade)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
      <Top left={<>{leech && <SnailIcon className="mr-1 inline size-3 text-tomorrow" />}{PROMPT[swap ? 'swap' : kind]}</>} right={left} />
      {kind === 'read' && <><p className="mt-4 text-2xl font-semibold text-primary">{card.phonetic}</p><Script text={card.burmese} /></>}
      {kind === 'say' && !swap && <p className="mt-4 text-2xl font-semibold">{card.english}</p>}
      {swap && (
        <>
          <p className="mt-4 text-sm text-muted-foreground">You know: {card.english} — <span className="text-primary">{card.phonetic}</span></p>
          <p className="mt-2 text-2xl font-semibold">{swap.english}</p>
        </>
      )}
      {kind === 'hear' && <div className="mt-4"><AudioButtons id={card.id} auto /></div>}

      {shown ? (
        <>
          {swap ? (
            <div className="mt-4 hairline-t pt-4">
              <p className="text-2xl font-semibold text-primary">{swap.phonetic}</p>
              <Script text={swap.burmese} />
              <p className="mt-2 text-sm text-muted-foreground">Changed: {swap.changed}</p>
            </div>
          ) : <Answer card={card} english={kind !== 'say'} hookFor={leech ? hookFor : undefined} />}
          {sure && <p className="mt-3 text-xs text-muted-foreground">You were sure — if you missed it, it comes back once more today.</p>}
          <GradeButtons next={mem.next} onGrade={grade} busy={busy} />
        </>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button size="block" variant="secondary" onClick={() => reveal(false)} className="text-muted-foreground">Not sure · show</Button>
          <Button size="block" variant="secondary" onClick={() => reveal(true)} className="text-primary">I'm sure · show</Button>
        </div>
      )}
    </>
  )
}

function Verdict({ ok, children, busy, onNext }: { ok: boolean; children?: ReactNode; busy: boolean; onNext: () => void }) {
  return (
    <>
      <p className={cn('mt-4 flex items-center gap-2 font-semibold', ok ? 'text-today' : 'text-overdue')}>
        {ok ? <CheckIcon className="size-5" /> : <XIcon className="size-5" />}{ok ? 'Nice' : 'Not quite'}
      </p>
      {children}
      <p className="mt-3 text-xs text-muted-foreground">Say it out loud once, then carry on.</p>
      <Button size="block" disabled={busy} onClick={onNext} className="mt-4 w-full">Continue</Button>
    </>
  )
}

function Pick({ item, deck, today, left, busy, onDone }: Props) {
  const { card, kind } = item
  const options = useMemo(() => pickOptions(card, deck, today + item.key), [card, deck, today, item.key])
  const [chosen, setChosen] = useState<string | null>(null)
  const clock = useClock()
  const ms = useRef(0)
  const ok = chosen === card.english
  return (
    <>
      <Top left={PROMPT.pick} right={left} />
      {kind === 'hear' ? <div className="mt-4"><AudioButtons id={card.id} auto /></div>
        : <><p className="mt-4 text-2xl font-semibold text-primary">{card.phonetic}</p><Script text={card.burmese} /></>}
      <div className="mt-4 grid gap-2">
        {options.map(o => (
          <Button key={o} variant="secondary" size="block" disabled={!!chosen}
            onClick={() => { ms.current = clock(); setChosen(o) }}
            className={cn('justify-start text-left whitespace-normal disabled:opacity-100', chosen && o === card.english && 'text-today', chosen === o && !ok && 'text-overdue')}>
            {o}
          </Button>
        ))}
      </div>
      {chosen && (
        <Verdict ok={ok} busy={busy} onNext={() => onDone(ok ? 3 : 1, { ms: ms.current, ex: 'pick' })}>
          {kind === 'hear' && <><p className="mt-2 text-xl font-semibold text-primary">{card.phonetic}</p><Script text={card.burmese} /></>}
        </Verdict>
      )}
    </>
  )
}

function Build({ item, today, left, busy, onDone }: Props) {
  const { card } = item
  const { parts, tiles } = useMemo(() => buildFor(card, today + item.key), [card, today, item.key])
  const [placed, setPlaced] = useState<number[]>([])
  const [tries, setTries] = useState(0)
  const [result, setResult] = useState<boolean | null>(null)
  const clock = useClock()
  const ms = useRef(0)
  const full = placed.length === tiles.length
  const check = () => {
    const ok = placed.map(i => tiles[i].t).join(' ') === parts.join(' ')
    if (ok || tries >= 1) { ms.current = clock(); setResult(ok) }
    else { setTries(1); setPlaced([]) }
  }
  return (
    <>
      <Top left={PROMPT.build} right={left} />
      <p className="mt-4 text-2xl font-semibold">{card.english}</p>
      <div className="mt-4 flex min-h-12 flex-wrap gap-2 hairline-b pb-3">
        {placed.map((i, n) => (
          <Button key={n} variant="secondary" size="sm" disabled={result !== null} onClick={() => setPlaced(p => p.filter((_, k) => k !== n))} className="text-primary">{tiles[i].t}</Button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {tiles.map((x, i) => (
          <Button key={i} variant="outline" size="sm" disabled={placed.includes(i) || result !== null} onClick={() => setPlaced(p => [...p, i])}>{x.t}</Button>
        ))}
      </div>
      {tries > 0 && result === null && <p className="mt-3 text-sm text-tomorrow">Not quite — one more go.</p>}
      {result === null ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button size="block" variant="secondary" onClick={() => { ms.current = clock(); setResult(false) }} className="text-muted-foreground">Show me</Button>
          <Button size="block" disabled={!full} onClick={check}>Check</Button>
        </div>
      ) : (
        <Verdict ok={result} busy={busy} onNext={() => onDone(result ? (tries ? 2 : 3) : 1, { ms: ms.current, ex: 'build' })}>
          <Answer card={card} english={false} />
        </Verdict>
      )}
    </>
  )
}

function Gap({ item, deck, today, left, busy, onDone }: Props) {
  const { card } = item
  const { words, at, answer, options } = useMemo(() => gapFor(card, deck, today + item.key), [card, deck, today, item.key])
  const [chosen, setChosen] = useState<string | null>(null)
  const clock = useClock()
  const ms = useRef(0)
  const ok = chosen === answer
  return (
    <>
      <Top left={PROMPT.gap} right={left} />
      <p className="mt-4 text-lg">{card.english}</p>
      <p className="mt-2 text-2xl font-semibold text-primary">
        {words.map((w, i) => (i === at ? <span key={i} className={cn(chosen ? (ok ? 'text-today' : 'text-overdue') : 'text-muted-foreground')}>{chosen ? answer : '____'} </span> : w + ' '))}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {options.map(o => (
          <Button key={o} variant="secondary" size="block" disabled={!!chosen} onClick={() => { ms.current = clock(); setChosen(o) }}
            className={cn('disabled:opacity-100', chosen && o === answer && 'text-today', chosen === o && !ok && 'text-overdue')}>{o}</Button>
        ))}
      </div>
      {chosen && <Verdict ok={ok} busy={busy} onNext={() => onDone(ok ? 3 : 1, { ms: ms.current, ex: 'gap' })}><Script text={card.burmese} /></Verdict>}
    </>
  )
}

export function Exercise(props: Props) {
  const C = { flip: Flip, swap: Flip, pick: Pick, build: Build, gap: Gap }[props.item.ex]
  return <C {...props} />
}
