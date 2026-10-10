import { lazy, useEffect } from 'react'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router'
import { appUrl, type AppName } from '@tars/ui/lib/apps'
import { Home } from '@/features/home/Home'
import { StoreProvider } from '@/features/tasks/store'
import { Layout } from './Layout'

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const InboxPage = lazy(() => import('@/features/inbox/InboxPage').then(m => ({ default: m.InboxPage })))

function ToApp({ app }: { app: AppName }) {
  useEffect(() => location.replace(appUrl(app)), [app])
  return null
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/apps', element: <Navigate to="/" replace /> },
      { path: '/burmese', element: <ToApp app="burmese" /> },
      { path: '/money', element: <ToApp app="money" /> },
      { path: '/discover', element: <ToApp app="discover" /> },
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
