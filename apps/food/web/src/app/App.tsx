import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router'
import { AppShell } from '@tars/ui/components/AppShell'
import { FoodPage } from '@/features/food/FoodPage'
import { ListPage } from '@/features/food/ListPage'
import { RecipePage } from '@/features/food/RecipePage'

const router = createBrowserRouter([
  {
    element: <AppShell><Outlet /></AppShell>,
    children: [
      { path: '/', element: <FoodPage /> },
      { path: '/list', element: <ListPage /> },
      { path: '/recipe/:id', element: <RecipePage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
