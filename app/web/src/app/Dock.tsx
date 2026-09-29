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
        'dock fixed inset-x-4 bottom-safe-4 z-30 mx-auto flex max-w-105 gap-2 rounded-full p-2 transition-[translate,opacity] duration-200',
        hidden && 'pointer-events-none translate-y-full opacity-0',
      )}
    >
      <button
        onClick={() => openQuickAdd(setAdding)}
        className="flex flex-1 items-center justify-center gap-2 rounded-full px-2 py-3 text-base font-bold dock-primary active:scale-98"
      >
        <PlusIcon className="size-5" strokeWidth={2.6} />Add task
      </button>
      <Link
        to="/tars"
        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/8 px-2 py-3 text-base font-bold active:scale-98"
      >
        <SparkleIcon className="size-4 fill-current text-claude" />Tars
      </Link>
    </nav>
  )
}
