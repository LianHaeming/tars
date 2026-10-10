import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router'
import { AppShell } from '@tars/ui/components/AppShell'
import { HomePage } from './HomePage'

const router = createBrowserRouter([
  {
    element: <AppShell><Outlet /></AppShell>,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
