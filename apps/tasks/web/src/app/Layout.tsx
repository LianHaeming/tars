import { Suspense, useEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { Toaster } from '@tars/ui/components/ui/sonner'
import { useQuickAdd, useTars } from '@/features/tasks/store'
import { TaskSheet } from '@/features/tasks/TaskSheet'
import { OrganiseProvider } from '@/features/home/organise'
import { Dock, showsDock } from './Dock'

export function Layout() {
  const { openId, setOpenId, flash } = useTars()
  const quickAdd = useQuickAdd()
  const { pathname } = useLocation()

  useEffect(() => {
    const editing = () => document.activeElement?.closest('input, textarea, select, [contenteditable]')
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'q' || e.key === '/') && !editing() && showsDock(pathname)) {
        e.preventDefault()
        quickAdd()
      }
      if (e.key === 'Escape' && !document.querySelector('[data-radix-popper-content-wrapper], [role=alertdialog]')) {
        if (openId) { (document.activeElement as HTMLElement | null)?.blur(); setOpenId(null) }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openId, pathname, setOpenId, quickAdd])

  return (
    <OrganiseProvider>
      <div aria-hidden className="island-scrim" />
      <Suspense fallback={<div className="pt-safe-16 text-center text-sm text-muted-foreground">Loading…</div>}>
        <Outlet />
      </Suspense>
      <TaskSheet />
      <Dock />
      <div role="status" aria-live="polite" className="sr-only">{flash?.label ?? ''}</div>
      <Toaster position="bottom-center" offset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }} mobileOffset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }} />
      <ScrollRestoration />
    </OrganiseProvider>
  )
}
