import { Navigate, RouterProvider, createBrowserRouter } from 'react-router'
import { AppsPage } from '@/features/apps/AppsPage'
import { ListPage } from '@/features/food/ListPage'
import { RecipePage } from '@/features/food/RecipePage'
import { Home } from '@/features/home/Home'
import { InboxPage } from '@/features/inbox/InboxPage'
import { TarsPage } from '@/features/tars/TarsPage'
import { StoreProvider } from '@/features/tasks/store'
import { Layout } from './Layout'

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
