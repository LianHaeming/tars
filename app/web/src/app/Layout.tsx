import { Suspense, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { useTars } from '@/features/tasks/store'
import { Dock, focusDraft, hasTaskList, showsDock } from './Dock'

export function Layout() {
  const { openId, setOpenId, addDraft, setPendingAdd } = useTars()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const editing = () => document.activeElement?.closest('input, textarea, select, [contenteditable]')
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'q' || e.key === '/') && !editing() && showsDock(pathname)) {
        e.preventDefault()
        if (hasTaskList(pathname)) { flushSync(() => { addDraft() }); focusDraft() }
        else { setPendingAdd(true); navigate('/') }
      }
      if (e.key === 'Escape' && !document.querySelector('[data-radix-popper-content-wrapper], [role=alertdialog], [role=dialog][data-state=open]')) {
        if (openId) setOpenId(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openId, pathname, setOpenId, addDraft, setPendingAdd, navigate])

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
