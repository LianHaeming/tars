import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { useQuickLinks } from './quick-links'

export function CompactBar({ shown }: { shown: boolean }) {
  const links = useQuickLinks()
  return (
    <div
      aria-hidden={!shown}
      className={cn(
        'chrome-bar hairline-b fixed inset-x-0 top-0 z-20 pt-safe-0 transition-[translate,opacity] duration-200 ease-sheet',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
      )}
    >
      <nav className="mx-auto flex h-14 max-w-page items-center gap-2 px-4">
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            tabIndex={shown ? 0 : -1}
            className="flex h-9 items-center gap-2 rounded-full bg-white/8 px-3 text-sm font-semibold transition-transform active:scale-98 [&_svg]:size-4 [&_svg]:text-primary"
          >
            {l.icon}{l.label}
            {l.count > 0 && <span className="text-xs text-muted-foreground tabular-nums">{l.count}</span>}
          </Link>
        ))}
      </nav>
    </div>
  )
}
