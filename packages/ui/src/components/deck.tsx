import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { ChevronLeftIcon, XIcon } from 'lucide-react'
import { cn } from '@tars/ui/lib/utils'
import { Badge } from '@tars/ui/components/ui/badge'
import { Button } from '@tars/ui/components/ui/button'
import { Progress } from '@tars/ui/components/ui/progress'

// The "deck" look shared by the drill apps (Burmese, Omarchy): large titles, tinted labels, the close/progress row on
// top of a game, and the pinned pill buttons at the bottom.
const inMemo = import.meta.env.BASE_URL !== '/'

export function LargeTitle({ sub, title, action }: { sub?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <>
      {inMemo && (
        <Button asChild variant="link" size="inline" className="px-1 pt-2">
          <a href="/"><ChevronLeftIcon />Memo</a>
        </Button>
      )}
      <div className="flex items-end justify-between gap-3 px-1 pt-2">
        <div className="min-w-0">
          <div className="h-5 text-sm font-semibold text-muted-foreground">{sub}</div>
          <h1 className="text-title font-extrabold tracking-tight">{title}</h1>
        </div>
        {action}
      </div>
    </>
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
