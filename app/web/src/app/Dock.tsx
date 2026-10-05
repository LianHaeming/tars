import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { CircleCheckIcon, LayoutGridIcon, PlusIcon, WandSparklesIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuickAdd, useTars } from '@/features/tasks/store'
import { useOrganise } from '@/features/home/organise'

export const showsDock = (path: string) => path === '/' || /^\/(apps|food|burmese|money)(\/|$)/.test(path)

export function Dock() {
  const { flash, exitDay } = useTars()
  const quickAdd = useQuickAdd()
  const { loose, phase, start } = useOrganise()
  const { pathname } = useLocation()
  const hidden = !showsDock(pathname)

  const tab = hidden ? -1 : 0
  const onSchedule = pathname === '/'
  const showSort = onSchedule && !flash && phase === 'idle' && loose > 0
  const nav = onSchedule
    ? { to: '/apps', label: 'Apps', Icon: LayoutGridIcon }
    : { to: '/', label: 'Schedule', Icon: CircleCheckIcon }

  let center: ReactNode = null
  if (flash) {
    center = (
      <div className="dock pointer-events-auto flex items-center gap-1 rounded-full p-1 pl-3">
        <span className="text-sm font-semibold text-muted-foreground animate-in fade-in duration-200">{flash.label}</span>
        <button type="button" onClick={flash.run} className="grid h-10 place-items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background active:scale-98">Undo</button>
      </div>
    )
  } else if (onSchedule) {
    center = (
      <button
        type="button"
        onClick={quickAdd}
        tabIndex={tab}
        className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background shadow-lg transition-transform active:scale-98 animate-in fade-in duration-200 [&_svg]:size-5"
      >
        <PlusIcon />Add task
      </button>
    )
  }

  return (
    <nav
      data-dock
      className={cn(
        'pointer-events-none fixed inset-x-4 bottom-safe-2 z-30 mx-auto flex max-w-page items-center justify-between gap-2 transition-[translate,opacity] duration-200',
        hidden && 'translate-y-full opacity-0',
      )}
    >
      <div className="flex flex-1 justify-start">
        {showSort && (
          <button
            type="button"
            onClick={start}
            tabIndex={tab}
            aria-label="Sort with Tars"
            className="dock pointer-events-auto flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold text-foreground transition-transform active:scale-98 animate-in fade-in duration-200 [&_svg]:size-5"
          >
            <WandSparklesIcon />Sort
          </button>
        )}
      </div>
      <div className="flex shrink-0 justify-center">{center}</div>
      <div className="flex flex-1 justify-end">
        <Link
          to={nav.to}
          onClick={exitDay}
          aria-label={nav.label}
          tabIndex={tab}
          className={cn('dock grid size-12 place-items-center rounded-full text-foreground transition-transform active:scale-98 [&_svg]:size-5', !hidden && 'pointer-events-auto')}
        >
          <nav.Icon />
        </Link>
      </div>
    </nav>
  )
}
