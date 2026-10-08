import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CheckIcon, FlameIcon, HeadphonesIcon, MicIcon, RepeatIcon, SparklesIcon, SwordsIcon, ZapIcon } from 'lucide-react'
import { Button } from '@tars/ui/components/ui/button'
import { Progress } from '@tars/ui/components/ui/progress'
import { hash, isOwned, level, type Burmese, type BurmeseState, type Card, type Grade } from './data'
import { afterAnswer, candidates, emptySession, pickNext, tokens, type Item } from './session'
import { AudioButtons, Exercise, Script, type Done } from './exercises'
import { HandsFree, Shadow } from './HandsFree'

type Free = { title: string; items: Item[]; right: number; topic?: string }
type Extra = 'shadow' | 'handsfree' | null

function NewCard({ card, label, busy, onLearn }: { card: Card; label: string; busy: boolean; onLearn: () => void }) {
  const [shown, setShown] = useState(false)
  return (
    <>
      <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        <span className="text-week">{label}</span>
        <span>{card.topic}</span>
      </div>
      <p className="mt-4 text-2xl font-semibold">{card.english}</p>
      {shown ? (
        <>
          <div className="mt-4 flex items-start justify-between gap-3 hairline-t pt-4">
            <div className="min-w-0">
              <p className="text-2xl font-semibold text-primary">{card.phonetic}</p>
              <Script text={card.burmese} />
            </div>
            {card.audio && <AudioButtons id={card.id} auto />}
          </div>
          {card.note && <p className="mt-3 text-sm text-muted-foreground">{card.note}</p>}
          <p className="mt-4 flex gap-2 text-xs text-muted-foreground"><MicIcon className="size-4 shrink-0" />Say it out loud three times. You'll get it back a few times today until it sticks.</p>
          <Button size="block" disabled={busy} onClick={onLearn} className="mt-4 w-full">Got it</Button>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted-foreground">How do you think you'd say it? Have a guess out loud first — even a wrong guess helps it stick.</p>
          <Button size="block" variant="secondary" onClick={() => setShown(true)} className="mt-5 w-full text-primary">Show me</Button>
        </>
      )}
    </>
  )
}

function FreeCard({ item, left, onDone }: { item: Item; left: string; onDone: (ok: boolean) => void }) {
  const [shown, setShown] = useState(false)
  return (
    <>
      <div className="flex justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase"><span>Say it in Burmese</span><span>{left}</span></div>
      <p className="mt-4 text-2xl font-semibold">{item.card.english}</p>
      {shown ? (
        <>
          <div className="mt-4 hairline-t pt-4"><p className="text-2xl font-semibold text-primary">{item.card.phonetic}</p><Script text={item.card.burmese} /></div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button size="block" variant="secondary" onClick={() => onDone(false)} className="text-overdue">Missed it</Button>
            <Button size="block" variant="secondary" onClick={() => onDone(true)} className="text-today">Got it</Button>
          </div>
        </>
      ) : <Button size="block" variant="secondary" onClick={() => setShown(true)} className="mt-5 w-full text-primary">Show answer</Button>}
    </>
  )
}

export function Practice({ api }: { api: Burmese & { data: BurmeseState } }) {
  const { data, learn, review, unlearn, boss, hook } = api
  const [session, setSession] = useState(emptySession)
  const [moreNew, setMoreNew] = useState(0)
  const [busy, setBusy] = useState(false)
  const [combo, setCombo] = useState(0)
  const [best, setBest] = useState(0)
  const [gained, setGained] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [free, setFree] = useState<Free | null>(null)
  const [extra, setExtra] = useState<Extra>(null)

  const { today, deck, progress, settings, xp, streak, owned } = data
  const learned = deck.filter(c => progress[c.id])
  const learnedToday = learned.filter(c => progress[c.id].learnedOn === today).length
  const next = deck.find(c => !progress[c.id])
  const items = useMemo(() => candidates(data, session), [data, session])
  const { old, fresh, waiting, learning } = pickNext(items, session, today)
  const canLearn = !!next && learnedToday < settings.newPerDay + moreNew && learning < 4
  const current: Item | 'new' | undefined = old ?? (canLearn ? 'new' : fresh ?? waiting)
  const left = items.length + (canLearn ? settings.newPerDay + moreNew - learnedToday : 0)
  const lv = level(xp)

  const withAudio = learned.filter(c => c.audio)
  const newToday = learned.filter(c => progress[c.id].learnedOn === today && c.audio)
  const bossTopics = [...new Set(deck.map(c => c.topic))].filter(t => {
    const cards = deck.filter(c => c.topic === t)
    return cards.length >= 3 && cards.every(c => (progress[c.id]?.say?.s ?? 0) >= 7) && data.bosses[t] !== today
  })

  const run = <T,>(fn: () => Promise<T>) => { setBusy(true); return fn().finally(() => setBusy(false)) }

  const done: Done = (grade: Grade, meta) => {
    if (!current || current === 'new') return
    const it = current
    setSession(s => afterAnswer(s, it.key, grade, meta.sure, it.isNew))
    setAnswered(n => n + 1)
    const c = grade > 1 ? combo + 1 : 0
    setCombo(c); setBest(b => Math.max(b, c))
    if (c > 0 && c % 10 === 0) toast(`${c} in a row`, { icon: <FlameIcon className="size-4 text-tomorrow" /> })
    run(() => review(it.card.id, it.kind, grade, meta)).then(s => {
      if (!s?.gained) return
      setGained(g => g + s.gained!)
      if (s.owned > owned) toast('New sentence owned — stable for 3+ weeks', { icon: <SparklesIcon className="size-4 text-week" /> })
    })
  }

  const startFree = (title: string, cards: Card[], topic?: string) => {
    const seed = String(Date.now())
    const its: Item[] = cards.map(card => ({ card, kind: 'say', key: card.id, mem: progress[card.id].say ?? progress[card.id].read!,
      ex: topic && tokens(card.phonetic).length >= 3 ? 'build' : 'flip', isNew: false }))
    setFree({ title, items: its.sort((a, b) => hash(seed + a.key) - hash(seed + b.key)), right: 0, topic })
  }
  const freeDone = (ok: boolean) => setFree(f => {
    if (!f) return f
    const rest = f.items.slice(1)
    const right = f.right + (ok ? 1 : 0)
    if (!rest.length && f.topic) {
      const total = deck.filter(c => c.topic === f.topic).length
      if (right / total >= 0.8) boss(f.topic).then(() => toast(`Boss beaten: ${f.topic}`, { icon: <SwordsIcon className="size-4 text-week" /> }))
      else toast(`${right} of ${total} — the boss needs 80%. Try again tomorrow.`)
    }
    return { ...f, items: rest, right }
  })

  if (extra === 'shadow') return <Shadow cards={newToday} onClose={() => setExtra(null)} />
  if (extra === 'handsfree') return <HandsFree data={data} onClose={() => setExtra(null)} />

  return (
    <>
      <div className="px-1 pt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span><span className="font-semibold">{owned}</span> <span className="text-muted-foreground">of {deck.length} owned · {learned.length} started</span></span>
          <span className="text-xs text-muted-foreground">Level {lv.n} · {streak ? `${streak}-day streak` : 'start a streak today'}</span>
        </div>
        <Progress value={deck.length ? (owned / deck.length) * 100 : 0} className="mt-2 h-2 bg-secondary [&>[data-slot=progress-indicator]]:bg-week" />
        {answered > 0 && (
          <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span className="flex items-center gap-1"><FlameIcon className="size-3 text-tomorrow" />{combo} in a row{best > combo ? ` · best ${best}` : ''}</span>
            <span className="flex items-center gap-1"><ZapIcon className="size-3 text-primary" />+{gained} XP</span>
          </div>
        )}
      </div>

      <div className="glass mt-3 rounded-2xl p-5">
        {free ? (
          free.items.length ? (
            free.items[0].ex === 'build'
              ? <Exercise key={free.items[0].key + free.items.length} item={free.items[0]} deck={deck} today={today} busy={false}
                  left={`${free.title} · ${free.items.length} left`} onDone={g => freeDone(g > 1)} />
              : <FreeCard key={free.items[0].key + free.items.length} item={free.items[0]} left={`${free.title} · ${free.items.length} left`} onDone={freeDone} />
          ) : (
            <div className="py-2 text-center">
              <CheckIcon className="mx-auto size-8 text-today" />
              <p className="mt-2 text-lg font-semibold">{free.title} done · {free.right} right</p>
              <Button variant="secondary" onClick={() => setFree(null)} className="mt-4 rounded-full">Back</Button>
            </div>
          )
        ) : current === 'new' ? (
          <NewCard key={next!.id} card={next!} label={`New · ${learnedToday + 1} of ${settings.newPerDay + moreNew}`} busy={busy} onLearn={() => run(() => learn(next!.id))} />
        ) : current ? (
          <Exercise key={current.key + session.turn} item={current} deck={deck} today={today} busy={busy} onDone={done}
            left={`${current.isNew ? 'Learning · ' : ''}${left} left`} leech={progress[current.card.id]?.leech}
            hookFor={id => run(() => hook(id)).catch(e => toast(`Couldn't make a hook — ${(e as Error).message}`))} />
        ) : (
          <div className="py-2 text-center">
            <CheckIcon className="mx-auto size-8 text-today" />
            <p className="mt-2 text-lg font-semibold">{!next && learned.length === deck.length ? `All ${deck.length} started` : 'Done for today'}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {answered ? `${answered} answers · +${gained} XP${best > 2 ? ` · best run ${best}` : ''}` : 'Come back tomorrow — what you know gets spaced further apart.'}
            </p>
            {data.reviewsToday >= settings.maxReviews && <p className="mt-1 text-xs text-muted-foreground">Daily review cap reached ({settings.maxReviews}) — change it in Stats.</p>}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {newToday.length > 0 && <Button variant="secondary" onClick={() => setExtra('shadow')} className="rounded-full text-today"><MicIcon />Shadow today's {newToday.length}</Button>}
              {next && <Button variant="secondary" onClick={() => setMoreNew(x => x + 1)} className="rounded-full text-week"><SparklesIcon />Learn one more</Button>}
              {learned.length > 0 && <Button variant="secondary" onClick={() => startFree('Practice round', learned)} className="rounded-full text-primary"><RepeatIcon />Practise all {learned.length}</Button>}
              {bossTopics.map(t => (
                <Button key={t} variant="secondary" onClick={() => startFree(`Boss · ${t}`, deck.filter(c => c.topic === t), t)} className="rounded-full text-tomorrow"><SwordsIcon />Boss: {t}</Button>
              ))}
              {withAudio.length > 0 && <Button variant="secondary" onClick={() => setExtra('handsfree')} className="rounded-full text-muted-foreground"><HeadphonesIcon />Hands-free</Button>}
            </div>
          </div>
        )}
      </div>

      {!free && current && current !== 'new' && (
        <div className="mt-3 flex justify-between px-1 text-xs">
          <Button variant="link" size="inline" disabled={busy} onClick={() => run(() => unlearn(current.card.id))} className="font-semibold text-muted-foreground">Forgot completely · start over</Button>
          {isOwned(progress[current.card.id]) && <span className="text-week">Owned</span>}
        </div>
      )}
    </>
  )
}

