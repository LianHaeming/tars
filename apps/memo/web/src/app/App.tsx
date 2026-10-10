import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router'
import { AppShell } from '@tars/ui/components/AppShell'
import { HomePage } from './HomePage'
import { Tabs } from '@/features/burmese/Tabs'
import { ExercisesPage } from '@/features/burmese/ExercisesPage'
import { UnitPage } from '@/features/burmese/UnitPage'
import { CardsPage } from '@/features/burmese/CardsPage'
import { WordsPage } from '@/features/burmese/WordsPage'
import { WordsPlayPage } from '@/features/burmese/WordsPlayPage'
import { StatsPage } from '@/features/burmese/StatsPage'
import { AskPage } from '@/features/burmese/AskPage'
import { SentencesPage } from '@/features/burmese/SentencesPage'
import { CategoryPage } from '@/features/burmese/CategoryPage'
import { HomePage as OmarchyPage } from '@/features/omarchy/HomePage'
import { PlayPage as OmarchyPlayPage } from '@/features/omarchy/PlayPage'

const router = createBrowserRouter([
  {
    element: <AppShell><Outlet /></AppShell>,
    children: [
      { path: '/', element: <HomePage /> },
      {
        element: <Tabs />,
        children: [
          { path: '/burmese', element: <ExercisesPage /> },
          { path: '/burmese/words', element: <WordsPage /> },
          { path: '/burmese/ask', element: <AskPage /> },
          { path: '/burmese/sentences', element: <SentencesPage /> },
        ],
      },
      { path: '/burmese/sentences/:cat', element: <CategoryPage /> },
      { path: '/burmese/unit', element: <UnitPage /> },
      { path: '/burmese/cards', element: <CardsPage /> },
      { path: '/burmese/words/play', element: <WordsPlayPage /> },
      { path: '/burmese/stats', element: <StatsPage /> },
      { path: '/burmese/*', element: <Navigate to="/burmese" replace /> },
      { path: '/omarchy', element: <OmarchyPage /> },
      { path: '/omarchy/play', element: <OmarchyPlayPage /> },
      { path: '/omarchy/*', element: <Navigate to="/omarchy" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
