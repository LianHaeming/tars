import { Link, useLocation } from 'react-router'
import { PlusIcon, SparkleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTars } from '@/features/tasks/store'
import { openQuickAdd } from '@/features/tasks/QuickAdd'

export const showsDock = (path: string) => path === '/' || /^\/(lists|month|shopping)(\/|$)/.test(path)

export function Dock() {
  const { adding, setAdding } = useTars()
  const { pathname } = useLocation()
  const hidden = adding || !showsDock(pathname)
  return (
    <nav
      className={cn(
        'pointer-events-none fixed inset-x-4 bottom-safe-4 z-30 mx-auto flex max-w-page items-center justify-between transition-[translate,opacity] duration-200',
        hidden && 'translate-y-full opacity-0',
      )}
    >
      <button
        onClick={() => openQuickAdd(setAdding)}
        tabIndex={hidden ? -1 : 0}
        className={cn('dock flex h-12 items-center gap-2 rounded-full pr-5 pl-4 text-sm font-semibold active:scale-98', !hidden && 'pointer-events-auto')}
      >
        <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground"><PlusIcon className="size-4" strokeWidth={2.6} /></span>
        Add task
      </button>
      <Link
        to="/tars"
        aria-label="Tars"
        tabIndex={hidden ? -1 : 0}
        className={cn('dock dock-ai grid size-14 place-items-center rounded-full active:scale-98', !hidden && 'pointer-events-auto')}
      >
        <SparkleIcon className="size-6 fill-current text-claude" />
      </Link>
    </nav>
  )
}
