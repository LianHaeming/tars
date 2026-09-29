import { useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Ask } from '@/components/Ask'
import { Dock } from '@/components/Dock'
import { Panel } from '@/components/Panel'
import { QuickAdd, openQuickAdd } from '@/components/QuickAdd'
import { longDate, today } from '@/lib/dates'
import { StoreProvider, useTars } from '@/lib/store'
import { SECTIONS } from '@/sections'

function Home() {
  const { adding, setAdding, asking, setAsking, openId, setOpenId, panel, closePanel } = useTars()

  useEffect(() => {
    const editing = () => document.activeElement?.closest('input, textarea, select, [contenteditable]')
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'q' || e.key === '/') && !editing() && panel !== 'food' && !asking) { e.preventDefault(); openQuickAdd(setAdding) }
      if (e.key === 'Escape' && !document.querySelector('[data-radix-popper-content-wrapper], [role=alertdialog], [role=dialog][data-state=open]')) {
        if (adding) setAdding(false)
        else if (asking) setAsking(false)
        else if (openId) setOpenId(null)
        else if (panel) closePanel()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [adding, asking, openId, panel, setAdding, setAsking, setOpenId, closePanel])

  return (
    <>
      <main className="mx-auto max-w-[680px] px-4 pt-[calc(18px+env(safe-area-inset-top))] pb-[calc(120px+env(safe-area-inset-bottom))]">
        <header className="px-0.5 pt-2 pb-2.5 text-xs font-bold tracking-[.12em] text-[#9fb6cc] uppercase">{longDate(today())}</header>
        {SECTIONS.map((S, i) => <S key={i} />)}
      </main>
      <Panel />
      <Dock />
      <Ask />
      <QuickAdd />
      <Toaster position="bottom-center" offset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }} mobileOffset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }} />
    </>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Home />
    </StoreProvider>
  )
}
