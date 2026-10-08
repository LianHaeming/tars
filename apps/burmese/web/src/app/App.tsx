import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router'
import { AppShell } from '@tars/ui/components/AppShell'
import { TabBar } from './TabBar'
import { ExercisesPage } from '@/features/burmese/ExercisesPage'
import { UnitPage } from '@/features/burmese/UnitPage'
import { StatsPage } from '@/features/burmese/StatsPage'
import { AskPage } from '@/features/burmese/AskPage'
import { SentencesPage } from '@/features/burmese/SentencesPage'
import { CategoryPage } from '@/features/burmese/CategoryPage'

function Tabs() {
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <AppShell><Outlet /></AppShell>,
    children: [
      {
        element: <Tabs />,
        children: [
          { path: '/', element: <ExercisesPage /> },
          { path: '/ask', element: <AskPage /> },
          { path: '/sentences', element: <SentencesPage /> },
        ],
      },
      { path: '/sentences/:cat', element: <CategoryPage /> },
      { path: '/unit', element: <UnitPage /> },
      { path: '/stats', element: <StatsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
