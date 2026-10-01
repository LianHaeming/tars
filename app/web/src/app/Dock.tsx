import { Link, useLocation } from 'react-router'
import { CalendarDaysIcon, LayoutGridIcon, PlusIcon, SparkleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTars } from '@/features/tasks/store'
import { openQuickAdd } from '@/features/tasks/QuickAdd'

export const showsDock = (path: string) => path === '/' || /^\/(apps|lists|month|shopping|food)(\/|$)/.test(path)

export function Dock() {
  const { adding, setAdding } = useTars()
  const { pathname } = useLocation()
  const hidden = adding || !showsDock(pathname)
  const tab = hidden ? -1 : 0
  const onSchedule = pathname === '/'
  const seg = (on: boolean) => cn('grid h-12 w-16 place-items-center rounded-full transition-colors duration-150 [&_svg]:size-5', on ? 'bg-foreground text-background' : 'text-muted-foreground')

  return (
    <nav
      className={cn(
        'pointer-events-none fixed inset-x-4 bottom-safe-4 z-30 mx-auto flex max-w-page items-center justify-between transition-[translate,opacity] duration-200',
        hidden && 'translate-y-full opacity-0',
      )}
    >
      <button
        type="button"
        onClick={() => openQuickAdd(setAdding)}
        aria-label="Add task"
        tabIndex={tab}
        className={cn('dock grid size-14 place-items-center rounded-full active:scale-98', !hidden && 'pointer-events-auto')}
      >
        <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"><PlusIcon className="size-5" strokeWidth={2.6} /></span>
      </button>
      <div className={cn('dock flex items-center gap-1 rounded-full p-1', !hidden && 'pointer-events-auto')}>
        <Link to="/" aria-label="Schedule" aria-current={onSchedule ? 'page' : undefined} tabIndex={tab} className={seg(onSchedule)}><CalendarDaysIcon /></Link>
        <Link to="/apps" aria-label="Apps" aria-current={onSchedule ? undefined : 'page'} tabIndex={tab} className={seg(!onSchedule)}><LayoutGridIcon /></Link>
      </div>
      <Link
        to="/tars"
        aria-label="Tars"
        tabIndex={tab}
        className={cn('dock dock-ai grid size-14 place-items-center rounded-full active:scale-98', !hidden && 'pointer-events-auto')}
      >
        <SparkleIcon className="size-6 fill-current text-claude" />
      </Link>
    </nav>
  )
}
