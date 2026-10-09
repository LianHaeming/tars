import { useEffect, useState, type ComponentProps, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { LoaderCircleIcon, SnailIcon, Volume2Icon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@tars/ui/lib/utils'
import { Badge } from '@tars/ui/components/ui/badge'
import { Button } from '@tars/ui/components/ui/button'
import { Progress } from '@tars/ui/components/ui/progress'
import type { Word } from './data'

export function LargeTitle({ sub, title, action }: { sub?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 px-1 pt-2">
      <div className="min-w-0">
        <div className="h-5 text-sm font-semibold text-muted-foreground">{sub}</div>
        <h1 className="text-title font-extrabold tracking-tight">{title}</h1>
      </div>
      {action}
    </div>
  )
}

export function Tint({ color, children }: { color: string; children: ReactNode }) {
  return <Badge variant="soft" style={{ '--tint': `var(--${color})` } as CSSProperties}>{children}</Badge>
}

export function DeckTop({ i, total, onClose, children }: { i: number; total: number; onClose: () => void; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <Button variant="ghost" size="icon-lg" onClick={onClose} aria-label="Close" className="glass rounded-full">
        <XIcon />
      </Button>
      {total > 0 && (total <= 20 ? (
        <div className="flex flex-1 justify-center gap-1" aria-hidden>
          {Array.from({ length: total }, (_, n) => (
            <span key={n} className={cn('h-2 rounded-full', n === i ? 'w-5 bg-foreground' : n < i ? 'w-2 bg-primary' : 'w-2 bg-foreground/20')} />
          ))}
        </div>
      ) : <Progress value={(i / total) * 100} className="flex-1" />)}
      {total > 0 && <span className="text-sm font-semibold text-muted-foreground tabular-nums">{Math.min(i + 1, total)}/{total}</span>}
      {children}
    </div>
  )
}

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

export function BottomBar({ children, cols = 1 }: { children: ReactNode; cols?: 1 | 2 }) {
  return (
    <nav className={cn('pointer-events-none fixed inset-x-4 bottom-safe-2 z-30 mx-auto grid max-w-page gap-3 *:pointer-events-auto', cols === 2 && 'grid-cols-2')}>
      {children}
    </nav>
  )
}

export function PillButton({ className, quiet, ...props }: ComponentProps<typeof Button> & { quiet?: boolean }) {
  return (
    <Button {...props}
      className={cn('h-12 w-full rounded-full text-base shadow-lg active:scale-98 [&_svg:not([class*=\'size-\'])]:size-5',
        quiet ? 'dock text-foreground' : 'bg-foreground text-background hover:bg-foreground/90', className)} />
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
