import { Suspense, useEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { useQuickAdd, useTars } from '@/features/tasks/store'
import { Dock, hasTaskList, showsDock } from './Dock'

export function Layout() {
  const { openId, setOpenId } = useTars()
  const quickAdd = useQuickAdd()
  const { pathname } = useLocation()

  useEffect(() => {
    const editing = () => document.activeElement?.closest('input, textarea, select, [contenteditable]')
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'q' || e.key === '/') && !editing() && showsDock(pathname)) {
        e.preventDefault()
        quickAdd(hasTaskList(pathname))
      }
      if (e.key === 'Escape' && !document.querySelector('[data-radix-popper-content-wrapper], [role=alertdialog], [role=dialog][data-state=open]')) {
        if (openId) setOpenId(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openId, pathname, setOpenId, quickAdd])

  return (
    <>
      <Suspense fallback={<div className="pt-safe-16 text-center text-sm text-muted-foreground">Loading…</div>}>
        <Outlet />
      </Suspense>
      <Dock />
      <Toaster position="bottom-center" offset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }} mobileOffset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }} />
      <ScrollRestoration />
    </>
  )
}
