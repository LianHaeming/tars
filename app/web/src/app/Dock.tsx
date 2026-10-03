import { flushSync } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router'
import { CalendarDaysIcon, LayoutGridIcon, PlusIcon, SparkleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTars } from '@/features/tasks/store'

export const showsDock = (path: string) => path === '/' || /^\/(apps|lists|month|money|shopping|food)(\/|$)/.test(path)
export const hasTaskList = (path: string) => path === '/' || /^\/(lists|month|shopping)(\/|$)/.test(path)

export function focusDraft() {
  const el = document.getElementById('qa')
  el?.focus()
  el?.scrollIntoView({ block: 'center' })
}

export function Dock() {
  const { addDraft, setPendingAdd } = useTars()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const hidden = !showsDock(pathname)

  const add = () => {
    if (hasTaskList(pathname)) { flushSync(() => { addDraft() }); focusDraft() }
    else { setPendingAdd(true); navigate('/') }
  }
  const tab = hidden ? -1 : 0
  const onSchedule = pathname === '/'
  const seg = (on: boolean) => cn('relative z-10 grid h-12 w-16 place-items-center rounded-full transition-colors duration-200 [&_svg]:size-5', on ? 'text-background' : 'text-muted-foreground')

  return (
    <nav
      className={cn(
        'pointer-events-none fixed inset-x-4 bottom-safe-4 z-30 mx-auto flex max-w-page items-center justify-between transition-[translate,opacity] duration-200',
        hidden && 'translate-y-full opacity-0',
      )}
    >
      <button
        type="button"
        onClick={add}
        aria-label="Add task"
        tabIndex={tab}
        className={cn('dock grid size-14 place-items-center rounded-full active:scale-98', !hidden && 'pointer-events-auto')}
      >
        <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"><PlusIcon className="size-5" strokeWidth={2.6} /></span>
      </button>
      <div className={cn('dock relative flex items-center gap-1 rounded-full p-1', !hidden && 'pointer-events-auto')}>
        <span
          aria-hidden
          className="absolute left-1 top-1 h-12 w-16 rounded-full bg-foreground shadow-sm transition-transform duration-300 ease-spring"
          style={{ transform: onSchedule ? 'translateX(0)' : 'translateX(calc(100% + 0.25rem))' }}
        />
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
