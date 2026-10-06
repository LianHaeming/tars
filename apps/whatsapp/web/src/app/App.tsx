import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router'
import { AppShell } from '@tars/ui/components/AppShell'
import { WhatsappPage } from '@/features/whatsapp/WhatsappPage'
import { ChatPage } from '@/features/whatsapp/ChatPage'

const router = createBrowserRouter([
  {
    element: <AppShell><Outlet /></AppShell>,
    children: [
      { path: '/', element: <WhatsappPage /> },
      { path: '/chat/:id', element: <ChatPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
