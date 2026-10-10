import { lazy, useEffect } from 'react'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router'
import { appUrl, type AppName } from '@tars/ui/lib/apps'
import { Home } from '@/features/home/Home'
import { StoreProvider } from '@/features/tasks/store'
import { Layout } from './Layout'

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const MoneyPage = lazy(() => import('@/features/money/MoneyPage').then(m => ({ default: m.MoneyPage })))
const DiscoverPage = lazy(() => import('@/features/discover/DiscoverPage').then(m => ({ default: m.DiscoverPage })))
const InboxPage = lazy(() => import('@/features/inbox/InboxPage').then(m => ({ default: m.InboxPage })))

function ToApp({ app, path }: { app: AppName; path?: string }) {
  useEffect(() => location.replace(appUrl(app, path)), [app, path])
  return null
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/apps', element: <Navigate to="/" replace /> },
      { path: '/burmese', element: <ToApp app="memo" path="/burmese" /> },
      { path: '/money', element: <MoneyPage /> },
      { path: '/discover', element: <DiscoverPage /> },
      { path: '/food/*', element: <ToApp app="food" /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/inbox', element: <InboxPage /> },
      { path: '/month', element: <Navigate to="/" replace /> },
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
