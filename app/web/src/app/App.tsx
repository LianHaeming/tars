import { lazy } from 'react'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router'
import { Home } from '@/features/home/Home'
import { StoreProvider } from '@/features/tasks/store'
import { Layout } from './Layout'

const AppsPage = lazy(() => import('@/features/apps/AppsPage').then(m => ({ default: m.AppsPage })))
const InboxPage = lazy(() => import('@/features/inbox/InboxPage').then(m => ({ default: m.InboxPage })))
const TarsPage = lazy(() => import('@/features/tars/TarsPage').then(m => ({ default: m.TarsPage })))
const ListPage = lazy(() => import('@/features/food/ListPage').then(m => ({ default: m.ListPage })))
const RecipePage = lazy(() => import('@/features/food/RecipePage').then(m => ({ default: m.RecipePage })))

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/apps', element: <AppsPage /> },
      { path: '/inbox', element: <InboxPage /> },
      { path: '/month', element: <Navigate to="/" replace /> },
      { path: '/burmese', element: <Navigate to="/apps" replace /> },
      { path: '/money', element: <Navigate to="/apps" replace /> },
      { path: '/food', element: <Navigate to="/apps" replace /> },
      { path: '/tars', element: <TarsPage /> },
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
