import { useEffect } from 'react'
import { Outlet, RouterProvider, ScrollRestoration, createBrowserRouter, useLocation } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { Dock, showsDock } from '@/components/Dock'
import { QuickAdd, openQuickAdd } from '@/components/QuickAdd'
import { ListPage } from '@/food/ListPage'
import { MenuPage } from '@/food/MenuPage'
import { RecipePage } from '@/food/RecipePage'
import { longDate, today } from '@/lib/dates'
import { StoreProvider, useTars } from '@/lib/store'
import { ListsPage, ShoppingPage } from '@/pages/ListsPage'
import { MonthPage } from '@/pages/MonthPage'
import { TarsPage } from '@/pages/TarsPage'
import { SECTIONS } from '@/sections'

function Home() {
  return (
    <main className="mx-auto max-w-[680px] px-4 pt-[calc(18px+env(safe-area-inset-top))] pb-[calc(120px+env(safe-area-inset-bottom))]">
      <header className="px-0.5 pt-2 pb-2.5 text-xs font-bold tracking-[.12em] text-[#9fb6cc] uppercase">{longDate(today())}</header>
      {SECTIONS.map((S, i) => <S key={i} />)}
    </main>
  )
}

function Layout() {
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

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/lists/:key?', element: <ListsPage /> },
      { path: '/month', element: <MonthPage /> },
      { path: '/shopping', element: <ShoppingPage /> },
      { path: '/tars', element: <TarsPage /> },
      { path: '/food', element: <MenuPage /> },
      { path: '/food/list', element: <ListPage /> },
      { path: '/food/:id', element: <RecipePage /> },
      { path: '*', element: <Home /> },
    ],
  },
])

export default function App() {
  return (
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  )
}
