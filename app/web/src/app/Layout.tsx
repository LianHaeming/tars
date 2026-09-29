import { useEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { QuickAdd, openQuickAdd } from '@/features/tasks/QuickAdd'
import { useTars } from '@/features/tasks/store'
import { Dock, showsDock } from './Dock'

export function Layout() {
  const { adding, setAdding, openId, setOpenId } = useTars()
  const { pathname } = useLocation()

  useEffect(() => {
    const editing = () => document.activeElement?.closest('input, textarea, select, [contenteditable]')
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'q' || e.key === '/') && !editing() && showsDock(pathname)) { e.preventDefault(); openQuickAdd(setAdding) }
      if (e.key === 'Escape' && !document.querySelector('[data-radix-popper-content-wrapper], [role=alertdialog], [role=dialog][data-state=open]')) {
        if (adding) setAdding(false)
        else if (openId) setOpenId(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [adding, openId, pathname, setAdding, setOpenId])

  useEffect(() => { setAdding(false) }, [pathname, setAdding])

  return (
    <>
      <Outlet />
      <Dock />
      <QuickAdd />
      <Toaster position="bottom-center" offset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }} mobileOffset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }} />
      <ScrollRestoration />
    </>
  )
}
