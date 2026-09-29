import { PlusIcon, SparkleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTars } from '@/lib/store'
import { openAsk } from './Ask'
import { openQuickAdd } from './QuickAdd'

export function Dock() {
  const { adding, asking, panel, setAdding, setAsking } = useTars()
  const hidden = adding || asking || panel === 'food'
  return (
    <nav
      className={cn(
        'fixed bottom-[calc(16px+env(safe-area-inset-bottom))] left-1/2 z-[55] flex w-[min(420px,calc(100%-32px))] -translate-x-1/2 gap-2 rounded-[30px] border border-white/16 bg-[rgb(38_42_50/55%)] p-[7px] shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_10px_30px_rgb(0_0_0/55%)] backdrop-blur-[22px] backdrop-saturate-[1.8] transition-[translate,opacity] duration-250',
        hidden && 'pointer-events-none translate-y-[140%] opacity-0',
      )}
    >
      <button
        onClick={() => openQuickAdd(setAdding)}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-3xl bg-primary/60 px-2 py-3 text-[15px] font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/30%)] active:scale-[.98]"
      >
        <PlusIcon className="size-[18px]" strokeWidth={2.6} />Add task
      </button>
      <button
        onClick={() => openAsk(setAsking)}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-3xl bg-white/8 px-2 py-3 text-[15px] font-bold active:scale-[.98]"
      >
        <SparkleIcon className="size-4 fill-current text-claude" />Tars
      </button>
    </nav>
  )
}
