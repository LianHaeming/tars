import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { today } from '@/lib/dates'
import { useBasket } from '@/features/food/data'
import { useInbox } from '@/features/inbox/data'
import { useMoney, fmt } from '@/features/money/data'
import { BurmeseCard } from '@/features/burmese/BurmeseCard'

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

function Stat({ value, label, align }: { value: string; label: string; align?: 'right' }) {
  return (
    <div className={cn(align === 'right' && 'text-right')}>
      <div className={cn('font-bold tabular-nums', align === 'right' ? 'text-lg' : 'text-2xl')}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function MoneyCard() {
  const { data, error } = useMoney()
  return (
    <AppCard to="/money" title="Money">
      {error ? (
        <p className="text-sm text-muted-foreground">Sign in to Monzo to see your balance.</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Loading your balance…</p>
      ) : (
        <div className="flex items-end justify-between">
          <Stat value={fmt(data.balance.balance)} label="Balance" />
          <Stat value={fmt(Math.abs(data.balance.spendToday))} label="Spent today" align="right" />
        </div>
      )}
    </AppCard>
  )
}

function FoodCard() {
  const picked = useBasket().ids.length
  return (
    <AppCard
      to="/food"
      title="Food"
      action={<Link to="/food/list" className="rounded-full bg-secondary px-3 py-2 text-xs font-semibold">Shopping list</Link>}
    >
      <Stat value={String(picked)} label={picked ? 'dishes in your basket' : 'no dishes picked yet'} />
    </AppCard>
  )
}

function EmailCard() {
  const { candidates } = useInbox()
  if (!candidates.length) return null
  return (
    <AppCard to="/inbox" title="Email">
      <Stat value={String(candidates.length)} label={`new ${candidates.length === 1 ? 'email' : 'emails'} to review`} />
      <ul className="mt-3 space-y-1">
        {candidates.slice(0, 3).map(c => <li key={c.id} className="truncate text-sm text-muted-foreground">{c.title}</li>)}
      </ul>
    </AppCard>
  )
}

const BIRTH = new Date(1998, 1, 10)
const SPAN = 100
const MARKS = [
  { at: 81, label: 'today’s rates' },
  { at: 87, label: 'likely', main: true },
  { at: 90, label: '≈1 in 4' },
]
const QUIPS = ['make today count', 'go make a memory', 'carpe that diem', 'you can’t bank the unused days', 'spend it well', 'the days don’t come back']

function LifeCard() {
  const age = (Date.now() - +BIRTH) / (365.25 * 864e5)
  const pct = (age / SPAN) * 100
  const toAvg = Math.round((age / 87) * 100)
  const quip = QUIPS[Math.floor(+today() / 864e5) % QUIPS.length]
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">Life, so far — you’re {Math.floor(age)}</span>
        <span className="text-xs text-muted-foreground">{toAvg}% to the average</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
          <div className="absolute inset-y-0 left-0 overflow-hidden rounded-full" style={{ width: `${pct}%` }}>
            <div className="h-full" style={{ width: `${10000 / pct}%`, background: 'linear-gradient(90deg, var(--today), var(--tomorrow), var(--overdue))' }} />
          </div>
          {MARKS.map(m => (
            <div key={m.at} className={cn('absolute inset-y-0 w-px', m.main ? 'bg-primary' : 'bg-foreground/50')} style={{ left: `${(m.at / SPAN) * 100}%` }} title={`${m.at} — ${m.label}`} />
          ))}
        </div>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground" title="100 — about 1 in 9 men">100</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        81 today’s rates · <span className="text-primary">87 likely</span> · 90 ≈ 1 in 4 · 100 ≈ 1 in 9 · {quip}
      </p>
    </div>
  )
}

export function AppsPage() {
  return (
    <main className="mx-auto max-w-page px-4 pt-safe-5 pb-safe-40">
      <h1 className="px-1 pt-2 pb-4 text-2xl font-bold tracking-tight">Apps</h1>
      <div className="space-y-3">
        <MoneyCard />
        <FoodCard />
        <EmailCard />
        <BurmeseCard />
        <LifeCard />
      </div>
    </main>
  )
}
