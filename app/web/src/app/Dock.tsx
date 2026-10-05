import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { CircleCheckIcon, LayoutGridIcon, PlusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuickAdd, useTars } from '@/features/tasks/store'

export const showsDock = (path: string) => path === '/' || /^\/(apps|food|burmese|money)(\/|$)/.test(path)

export function Dock() {
  const { flash, exitDay } = useTars()
  const quickAdd = useQuickAdd()
  const { pathname } = useLocation()
  const hidden = !showsDock(pathname)

  const tab = hidden ? -1 : 0
  const onSchedule = pathname === '/'
  const seg = (on: boolean) => cn('relative z-10 grid h-10 w-14 place-items-center rounded-full transition-colors duration-200 before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-[""] [&_svg]:size-5', on ? 'text-background' : 'text-muted-foreground')

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
      <div aria-hidden className="h-12 flex-1" />
      <div className="flex shrink-0 justify-center">{center}</div>
      <div className="flex flex-1 justify-end">
        <div className={cn('dock relative flex items-center gap-1 rounded-full p-1', !hidden && 'pointer-events-auto')}>
          <span
            aria-hidden
            className="absolute left-1 top-1 h-10 w-14 rounded-full bg-foreground shadow-sm transition-transform duration-300 ease-spring"
            style={{ transform: onSchedule ? 'translateX(0)' : 'translateX(calc(100% + 0.25rem))' }}
          />
          <Link to="/" onClick={exitDay} aria-label="Schedule" aria-current={onSchedule ? 'page' : undefined} tabIndex={tab} className={seg(onSchedule)}><CircleCheckIcon /></Link>
          <Link to="/apps" onClick={exitDay} aria-label="Apps" aria-current={onSchedule ? undefined : 'page'} tabIndex={tab} className={seg(!onSchedule)}><LayoutGridIcon /></Link>
        </div>
      </div>
    </nav>
  )
}
