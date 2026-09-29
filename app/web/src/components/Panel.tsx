import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTars } from '@/lib/store'
import { ListsView } from './ListsView'
import { MonthView } from './MonthView'

export function Panel() {
  const { panel, closePanel, viewInfo } = useTars()
  const [shown, setShown] = useState(panel)
  const [drag, setDrag] = useState<number | null>(null)
  const from = useRef<number | null>(null)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (panel) { setShown(panel); body.current?.scrollTo({ top: 0 }); return }
    const t = setTimeout(() => setShown(null), 300)
    return () => clearTimeout(t)
  }, [panel])

  useEffect(() => {
    document.body.style.overflow = panel ? 'hidden' : ''
  }, [panel])

  const kind = panel ?? shown
  const title = kind === 'food' ? 'Food' : kind ? viewInfo().title : ''

  return (
    <>
      <div
        onClick={closePanel}
        className={cn('fixed inset-0 z-30 bg-black/50 transition-opacity duration-300', panel ? 'opacity-100' : 'pointer-events-none opacity-0')}
      />
      <section
        role="dialog"
        aria-label={title}
        style={drag !== null ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
        className={cn(
          'fixed inset-x-0 top-[calc(env(safe-area-inset-top)+10px)] bottom-0 z-[31] mx-auto flex max-w-[760px] flex-col overflow-hidden rounded-t-[22px] border border-b-0 border-border bg-sheet shadow-2xl transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]',
          panel ? 'translate-y-0' : 'translate-y-[105%]',
        )}
      >
        <header
          className="glass-strong relative flex touch-none items-center justify-between rounded-none border-x-0 border-t-0 px-[18px] pt-[18px] pb-3"
          onTouchStart={e => { from.current = e.touches[0].clientY }}
          onTouchMove={e => { if (from.current !== null) setDrag(Math.max(0, e.touches[0].clientY - from.current)) }}
          onTouchEnd={() => {
            const moved = drag ?? 0
            from.current = null
            setDrag(null)
            if (moved > 110) closePanel()
          }}
        >
          <div className="absolute top-[7px] left-1/2 h-[5px] w-[38px] -translate-x-1/2 rounded-full bg-white/25" />
          <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
          <Button variant="link" className="px-0.5 text-base font-semibold" onClick={closePanel}>Done</Button>
        </header>
        {kind === 'food' ? (
          <iframe className="block size-full flex-1 border-0 bg-white" src="/food/app/index.html" title="Food menu" />
        ) : (
          <div ref={body} className="flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-[680px] px-4 pb-[calc(120px+env(safe-area-inset-bottom))]">
              {kind === 'month' ? <MonthView /> : kind && <ListsView />}
            </div>
          </div>
        )}
      </section>
    </>
  )
}
