import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router'
import { AppShell } from '@tars/ui/components/AppShell'
import { BurmesePage } from '@/features/burmese/BurmesePage'

const router = createBrowserRouter([
  {
    element: <AppShell><Outlet /></AppShell>,
    children: [
      { path: '/', element: <BurmesePage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
