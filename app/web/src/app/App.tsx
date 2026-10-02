import { RouterProvider, createBrowserRouter } from 'react-router'
import { AppsPage } from '@/features/apps/AppsPage'
import { BurmesePage } from '@/features/burmese/BurmesePage'
import { ListPage } from '@/features/food/ListPage'
import { MenuPage } from '@/features/food/MenuPage'
import { RecipePage } from '@/features/food/RecipePage'
import { Home } from '@/features/home/Home'
import { InboxPage } from '@/features/inbox/InboxPage'
import { MoneyPage } from '@/features/money/MoneyPage'
import { TarsPage } from '@/features/tars/TarsPage'
import { ListsPage, ShoppingPage } from '@/features/tasks/ListsPage'
import { MonthPage } from '@/features/tasks/MonthPage'
import { StoreProvider } from '@/features/tasks/store'
import { Layout } from './Layout'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/apps', element: <AppsPage /> },
      { path: '/inbox', element: <InboxPage /> },
      { path: '/burmese', element: <BurmesePage /> },
      { path: '/lists/:key?', element: <ListsPage /> },
      { path: '/month', element: <MonthPage /> },
      { path: '/money', element: <MoneyPage /> },
      { path: '/shopping', element: <ShoppingPage /> },
      { path: '/tars', element: <TarsPage /> },
      { path: '/food', element: <MenuPage /> },
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
