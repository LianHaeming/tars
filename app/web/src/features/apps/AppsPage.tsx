import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronRightIcon } from 'lucide-react'
import { localGet, localSet } from '@/lib/api'
import { useInbox } from '@/features/inbox/data'
import { FilterBar, FilterLabel, SectionHead } from '@/components/common'
import { MoneySection } from '@/features/money/MoneySection'
import { FoodSection } from '@/features/food/FoodSection'
import { BurmeseSection } from '@/features/burmese/BurmeseSection'

function AppCard({ to, title, action, children }: { to: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <Link to={to} className="block transition-opacity active:opacity-80">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">{title}</span>
          <span className="inline-flex items-center text-xs font-semibold text-primary">Open<ChevronRightIcon className="size-4" /></span>
        </div>
        <div className="mt-3">{children}</div>
      </Link>
      {action && <div className="mt-3 flex gap-2">{action}</div>}
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function EmailCard() {
  const { candidates } = useInbox()
  if (!candidates.length) return null
  return (
    <div className="pt-3">
      <AppCard to="/inbox" title="Email">
        <Stat value={String(candidates.length)} label={`new ${candidates.length === 1 ? 'email' : 'emails'} to review`} />
        <ul className="mt-3 space-y-1">
          {candidates.slice(0, 3).map(c => <li key={c.id} className="truncate text-sm text-muted-foreground">{c.title}</li>)}
        </ul>
      </AppCard>
    </div>
  )
}

const TABS = [
  { key: 'all', label: 'All', color: 'var(--foreground)' },
  { key: 'food', label: 'Food', color: 'var(--today)' },
  { key: 'burmese', label: 'Burmese', color: 'var(--week)' },
  { key: 'money', label: 'Money', color: 'var(--money)' },
]

export function AppsPage() {
  const [filter, setFilter] = useState(() => localGet('apps-filter') || 'all')
  const active = TABS.some(t => t.key === filter) ? filter : 'all'
  const pick = (k: string) => { setFilter(k); localSet('apps-filter', k) }
  const show = (k: string) => active === 'all' || active === k

  return (
    <main className="mx-auto max-w-page px-4 pt-safe-2 pb-safe-40">
      <FilterBar>
        {TABS.map(t => (
          <FilterLabel key={t.key} on={active === t.key} color={t.color} onClick={() => pick(t.key)}>{t.label}</FilterLabel>
        ))}
      </FilterBar>

      {active === 'all' && <EmailCard />}

      {show('food') && (
        <section>
          <SectionHead title="Food" lg link="Shopping list" to="/food/list" />
          <FoodSection />
        </section>
      )}

      {show('burmese') && (
        <section>
          <SectionHead title="Burmese" lg />
          <BurmeseSection />
        </section>
      )}

      {show('money') && (
        <section>
          <SectionHead title="Money" lg />
          <MoneySection />
        </section>
      )}
    </main>
  )
}
