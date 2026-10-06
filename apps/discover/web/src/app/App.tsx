import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router'
import { AppShell } from '@tars/ui/components/AppShell'
import { DiscoverPage } from '@/features/discover/DiscoverPage'

const router = createBrowserRouter([
  {
    element: <AppShell><Outlet /></AppShell>,
    children: [
      { path: '/', element: <DiscoverPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
