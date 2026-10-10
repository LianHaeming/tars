import { useEffect, useState, type MouseEvent } from 'react'
import { LoaderCircleIcon, SnailIcon, Volume2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@tars/ui/lib/utils'
import { Button } from '@tars/ui/components/ui/button'
import type { Word } from './data'

export { BottomBar, DeckTop, LargeTitle, PillButton, Tint } from '@tars/ui/components/deck'

export function WordRow({ words }: { words: Word[] }) {
  if (!words.length) return null
  return (
    <div className="hairline-t flex flex-wrap justify-around gap-x-4 gap-y-2 pt-3">
      {words.map((w, i) => (
        <div key={i} className="text-center">
          <div className="font-semibold">{w.p}</div>
          <div className="text-xs text-muted-foreground">{w.e}</div>
        </div>
      ))}
    </div>
  )
}

// One shared player, so starting a clip stops whichever was playing. Clips are made on the PC the first time they're
// played (a few seconds), then come straight back. src + play() run inside the tap, which iOS needs to allow sound.
const player = typeof Audio !== 'undefined' ? new Audio() : null
type Playing = { id: string; speed: 'normal' | 'slow'; loading: boolean } | null
let playing: Playing = null
const listeners = new Set<(p: Playing) => void>()
const set = (p: Playing) => { playing = p; listeners.forEach(l => l(p)) }
player?.addEventListener('playing', () => playing && set({ ...playing, loading: false }))
player?.addEventListener('ended', () => set(null))
player?.addEventListener('error', () => { if (playing) toast("Couldn't play the Burmese"); set(null) })

function usePlaying() {
  const [p, setP] = useState(playing)
  useEffect(() => { listeners.add(setP); return () => { listeners.delete(setP) } }, [])
  return p
}

export function playClip(id: string, speed: 'normal' | 'slow' = 'normal') {
  if (!player) return
  set({ id, speed, loading: true })
  player.src = `/api/burmese/audio/${encodeURIComponent(id)}${speed === 'slow' ? '?speed=slow' : ''}`
  player.play().catch(() => {})
}

function play(e: MouseEvent, id: string, speed: 'normal' | 'slow') {
  e.preventDefault(); e.stopPropagation()
  if (playing?.id === id && playing.speed === speed) { player?.pause(); return set(null) }
  playClip(id, speed)
}

// Listen + Slow buttons for a sentence's spoken Burmese. `compact` is the icon-only pair for list rows.
export function Speak({ id, compact, className }: { id: string; compact?: boolean; className?: string }) {
  const p = usePlaying()
  const btn = (speed: 'normal' | 'slow') => {
    const on = p?.id === id && p.speed === speed
    const Icon = on && p.loading ? LoaderCircleIcon : speed === 'slow' ? SnailIcon : Volume2Icon
    return (
      <Button key={speed} type="button" variant="ghost" size={compact ? 'icon-lg' : 'lg'} aria-label={speed === 'slow' ? 'Play slowly' : 'Play'}
        onClick={e => play(e, id, speed)}
        className={cn('glass rounded-full', on && 'text-primary', !compact && 'px-4')}>
        <Icon className={cn(on && p.loading && 'animate-spin')} />
        {!compact && (speed === 'slow' ? 'Slow' : 'Listen')}
      </Button>
    )
  }
  return <div className={cn('flex shrink-0 items-center justify-center gap-2', className)}>{btn('normal')}{btn('slow')}</div>
}
