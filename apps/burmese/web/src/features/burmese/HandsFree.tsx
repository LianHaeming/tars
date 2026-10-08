import { useEffect, useRef, useState } from 'react'
import { PauseIcon, PlayIcon } from 'lucide-react'
import { Button } from '@tars/ui/components/ui/button'
import { audioUrl, hash, type BurmeseState, type Card } from './data'
import { AudioButtons, Script } from './exercises'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

function playToEnd(id: string, stop: { current: boolean }) {
  return new Promise<void>(resolve => {
    const a = new Audio(audioUrl(id))
    const tick = setInterval(() => { if (stop.current) { a.pause(); clearInterval(tick); resolve() } }, 200)
    const end = () => { clearInterval(tick); resolve() }
    a.onended = end; a.onerror = end
    a.play().catch(end)
  })
}

function speak(text: string) {
  return new Promise<void>(resolve => {
    if (!('speechSynthesis' in window)) return resolve()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-GB'
    u.onend = () => resolve(); u.onerror = () => resolve()
    speechSynthesis.speak(u)
  })
}

function Frame({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="glass mt-3 rounded-2xl p-5">
      <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        <span>{title}</span>
        <Button variant="link" size="inline" onClick={onClose} className="font-semibold text-muted-foreground">Done</Button>
      </div>
      {children}
    </div>
  )
}

export function Shadow({ cards, onClose }: { cards: Card[]; onClose: () => void }) {
  const [i, setI] = useState(0)
  const card = cards[i]
  if (!card) return null
  return (
    <Frame title={`Shadow · ${i + 1} of ${cards.length}`} onClose={onClose}>
      <p className="mt-4 text-lg">{card.english}</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-2xl font-semibold text-primary">{card.phonetic}</p><Script text={card.burmese} /></div>
        <AudioButtons key={card.id} id={card.id} auto />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Play it and speak along at the same time, a beat behind — copy the rhythm and the tones, not just the words. Three or four times.</p>
      <Button size="block" onClick={() => (i + 1 < cards.length ? setI(i + 1) : onClose())} className="mt-4 w-full">{i + 1 < cards.length ? 'Next' : 'Finish'}</Button>
    </Frame>
  )
}

export function HandsFree({ data, onClose }: { data: BurmeseState; onClose: () => void }) {
  const { deck, progress, today } = data
  const [queue] = useState(() => deck.filter(c => c.audio && progress[c.id]?.say)
    .sort((a, b) => progress[a.id].say!.due.localeCompare(progress[b.id].say!.due) || hash(today + a.id) - hash(today + b.id)))
  const [i, setI] = useState(0)
  const [on, setOn] = useState(false)
  const [phase, setPhase] = useState<'en' | 'pause' | 'my'>('en')
  const stop = useRef(false)

  useEffect(() => {
    if (!on || !queue.length) return
    stop.current = false
    let k = i
    ;(async () => {
      while (!stop.current) {
        const c = queue[k % queue.length]
        setI(k % queue.length)
        setPhase('en'); await speak(c.english)
        if (stop.current) break
        setPhase('pause'); await wait(3500)
        if (stop.current) break
        setPhase('my'); await playToEnd(c.id, stop); await wait(1200)
        if (stop.current) break
        await playToEnd(c.id, stop); await wait(1800)
        k++
      }
    })()
    return () => { stop.current = true; window.speechSynthesis?.cancel() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on])

  const c = queue[i]
  return (
    <Frame title={`Hands-free · ${queue.length} sentences`} onClose={() => { stop.current = true; onClose() }}>
      {c ? (
        <>
          <p className="mt-4 text-2xl font-semibold">{c.english}</p>
          {phase === 'pause' && <p className="mt-2 text-sm text-today">Say it now…</p>}
          {phase === 'my' && <p className="mt-2 text-2xl font-semibold text-primary">{c.phonetic}</p>}
          <p className="mt-4 text-xs text-muted-foreground">English, a pause for you to say it, then the Burmese twice. Phone in pocket, keep walking.</p>
          <Button size="block" onClick={() => setOn(!on)} className="mt-4 w-full">{on ? <><PauseIcon />Pause</> : <><PlayIcon />Start</>}</Button>
        </>
      ) : <p className="mt-4 text-sm text-muted-foreground">No sentences with audio yet.</p>}
    </Frame>
  )
}
