import { Outlet, useLocation, useNavigate } from 'react-router'
import { FilterBar, FilterLabel } from '@tars/ui/components/common'

const TABS = [
  { to: '/', label: 'Exercises' },
  { to: '/ask', label: 'Ask Claude' },
  { to: '/sentences', label: 'Sentences' },
]

export function Tabs() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <main className="mx-auto max-w-page px-4 pt-safe-3 pb-safe-40">
      <FilterBar value={pathname} onValueChange={to => navigate(to)}>
        {TABS.map(t => <FilterLabel key={t.to} value={t.to}>{t.label}</FilterLabel>)}
      </FilterBar>
      <Outlet />
    </main>
  )
}
