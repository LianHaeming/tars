import { lazy } from 'react'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router'
import { Home } from '@/features/home/Home'
import { StoreProvider } from '@/features/tasks/store'
import { Layout } from './Layout'

const AppsPage = lazy(() => import('@/features/apps/AppsPage').then(m => ({ default: m.AppsPage })))
const BurmesePage = lazy(() => import('@/features/burmese/BurmesePage').then(m => ({ default: m.BurmesePage })))
const MoneyPage = lazy(() => import('@/features/money/MoneyPage').then(m => ({ default: m.MoneyPage })))
const FoodPage = lazy(() => import('@/features/food/FoodPage').then(m => ({ default: m.FoodPage })))
const InboxPage = lazy(() => import('@/features/inbox/InboxPage').then(m => ({ default: m.InboxPage })))
const ListPage = lazy(() => import('@/features/food/ListPage').then(m => ({ default: m.ListPage })))
const RecipePage = lazy(() => import('@/features/food/RecipePage').then(m => ({ default: m.RecipePage })))

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/apps', element: <AppsPage /> },
      { path: '/burmese', element: <BurmesePage /> },
      { path: '/money', element: <MoneyPage /> },
      { path: '/food', element: <FoodPage /> },
      { path: '/inbox', element: <InboxPage /> },
      { path: '/month', element: <Navigate to="/" replace /> },
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
