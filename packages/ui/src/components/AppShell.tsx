import { Suspense, type ReactNode } from 'react'
import { ScrollRestoration } from 'react-router'
import { Toaster } from '@tars/ui/components/ui/sonner'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="island-scrim" />
      <Suspense fallback={<div className="pt-safe-16 text-center text-sm text-muted-foreground">Loading…</div>}>
        {children}
      </Suspense>
      <Toaster position="bottom-center" offset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }} mobileOffset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }} />
      <ScrollRestoration />
    </>
  )
}
