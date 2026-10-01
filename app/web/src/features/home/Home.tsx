import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { localGet, localSet, type Task } from '@/lib/api'
import { addDays, dayDiff, hhmm, longDate, parseYmd, today, ymd } from '@/lib/dates'
import { byPriority, byWhen, useTars } from '@/features/tasks/store'
import { TaskRow } from '@/features/tasks/TaskRow'
import { SectionHead } from '@/components/common'
import { PaymentRow, useExpected, type Expected } from '@/features/money/expected'
import { MainEvent } from './MainEvent'

type Entry = { day: string; task?: Task; pay?: Expected }
const UPCOMING_DAYS = 14

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const BIRTH = new Date(1998, 1, 10)
const QUIPS = [
  'make today count',
  'the clock’s ticking ⏳',
  'go make a memory',
  'carpe that diem',
  'you can’t bank the unused days',
  'spend it well',
]

// UK males, ONS life tables: period LE ~81, cohort (most likely) ~87,
// ~1 in 4 reach 90, ~1 in 9 reach 100. Shorter target => fuller bar.
const SCENARIOS = [
  { to: 81, label: 'Today’s rates', note: 'period life expectancy' },
  { to: 87, label: 'ONS average', note: 'cohort — most likely', main: true },
  { to: 90, label: 'Reach 90', note: '~1 in 4 men' },
  { to: 100, label: 'Reach 100', note: '~1 in 9 men' },
]

function LifeFill({ pct }: { pct: number }) {
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-secondary">
      <div className="absolute inset-y-0 left-0 overflow-hidden rounded-full" style={{ width: `${pct}%` }}>
        <div className="h-full" style={{ width: `${10000 / pct}%`, background: 'linear-gradient(90deg, var(--today), var(--tomorrow), var(--overdue))' }} />
      </div>
    </div>
  )
}

function LifeBar() {
  const age = (Date.now() - +BIRTH) / (365.25 * 864e5)
  const quip = QUIPS[Math.floor(+today() / 864e5) % QUIPS.length]
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">Life, so far — you’re {Math.floor(age)}</span>
        <span className="text-lg leading-none" title="Memento mori — make it count" aria-hidden>💀</span>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {SCENARIOS.map(s => {
          const pct = Math.min(100, (age / s.to) * 100)
          return (
            <div key={s.to}>
              <div className="flex items-baseline justify-between text-xs">
                <span className={cn('font-semibold', s.main && 'text-foreground')}>{s.label} · {s.to}</span>
                <span className="text-muted-foreground">{Math.round(s.to - age)}y left · {Math.round(pct)}%</span>
              </div>
              <div className="mt-1">
                <LifeFill pct={pct} />
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{quip}</p>
    </div>
  )
}

function dayHeading(d: string) {
  const n = dayDiff(d)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  const dt = parseYmd(d)
  if (n < 7) return dt.toLocaleDateString(undefined, { weekday: 'long' })
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function todaysEvent(dated: Task[]) {
  const t = ymd(today()), now = hhmm(new Date())
  const timed = dated.filter(x => x.due === t && x.dueTime)
  return timed.find(x => x.dueTime! >= now) ?? timed.at(-1)
}

function byDay(entries: Entry[]) {
  const t = ymd(today())
  const key = (e: Entry) => (e.day < t ? 'overdue' : e.day)
  const groups = new Map<string, Entry[]>()
  for (const e of [...entries].sort((a, b) => (key(a) === 'overdue' ? '' : a.day).localeCompare(key(b) === 'overdue' ? '' : b.day))) {
    groups.set(key(e), [...(groups.get(key(e)) ?? []), e])
  }
  return [...groups]
}

function FilterLabel({ on, color, onClick, children }: { on: boolean; color: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{ color }}
      className="inline-flex shrink-0 items-center gap-2 py-2 text-xs font-semibold tracking-wider whitespace-nowrap uppercase"
    >
      {on && <span className="size-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  )
}

function DayHead({ day, onMove }: { day: string; onMove: () => void }) {
  const overdue = day === 'overdue'
  return (
    <div className={cn('flex items-baseline justify-between pt-4 pb-1 text-xs font-semibold tracking-wider uppercase', overdue ? 'text-overdue' : 'text-muted-foreground')}>
      <span>{overdue ? 'Overdue' : dayHeading(day)}</span>
      {overdue && <button type="button" onClick={onMove} className="text-sm tracking-normal text-primary normal-case">Move to today</button>}
    </div>
  )
}

export function Home() {
  const { open, state, rescheduleOverdue } = useTars()
  const expected = useExpected()
  const [filter, setFilter] = useState(() => localGet('home-filter') || 'all')
  const active = filter === 'money' || state.projects.some(p => p.id === filter) ? filter : 'all'
  const pick = (k: string) => { setFilter(k); localSet('home-filter', k) }

  const shown = active === 'all' ? open : open.filter(x => x.projectId === active)
  const dated = shown.filter(x => x.due).sort(byWhen)
  const undated = shown.filter(x => !x.due).sort(byPriority)
  const main = todaysEvent(dated)
  const t = ymd(today())
  const tag = active === 'all'
  const until = ymd(addDays(today(), UPCOMING_DAYS - 1))
  const pays = active === 'all' || active === 'money' ? expected : []
  const all: Entry[] = [...dated.map(task => ({ day: task.due!, task })), ...pays.map(pay => ({ day: pay.date, pay }))]
  const entries = all.filter(e => e.day <= until)
  const later = all.length - entries.length

  return (
    <main className="mx-auto max-w-page px-4 pt-safe-5 pb-safe-30">
      <LifeBar />
      <header className="px-1 pt-4">
        <h1 className="text-2xl font-bold tracking-tight">{greeting()}, Lian</h1>
        <p className="mt-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{longDate(today())}</p>
      </header>

      <nav className="scrollbar-none -mx-4 mt-4 flex gap-5 overflow-x-auto px-5">
        <FilterLabel on={active === 'all'} color="var(--foreground)" onClick={() => pick('all')}>All</FilterLabel>
        {state.projects.map(p => (
          <FilterLabel key={p.id} on={active === p.id} color={p.color} onClick={() => pick(p.id)}>{p.name}</FilterLabel>
        ))}
        {expected.length > 0 && <FilterLabel on={active === 'money'} color="var(--money)" onClick={() => pick('money')}>Money</FilterLabel>}
      </nav>

      <section>
        <SectionHead title="Upcoming" link="Month" to="/month" />
        {byDay(entries).map(([day, list]) => (
          <div key={day}>
            <DayHead day={day} onMove={rescheduleOverdue} />
            {day === t && main && <MainEvent task={main} />}
            {list.map(e => e.task
              ? e.task !== main && <TaskRow key={e.task.id} task={e.task} compact tag={tag} hideDue={day !== 'overdue'} />
              : <PaymentRow key={e.pay!.id} p={e.pay!} tag={tag} />)}
          </div>
        ))}
        {!entries.length && <div className="py-4 text-sm text-muted-foreground">Nothing in the next {UPCOMING_DAYS} days.</div>}
        {later > 0 && (
          <Link to="/month" className="block py-3 text-sm text-muted-foreground">
            {later} more after {dayHeading(until)} · <span className="font-semibold text-primary">See Month</span>
          </Link>
        )}
      </section>

      {active !== 'money' && <section>
        <SectionHead title="To-do · no date" count={undated.length} link="All lists" to="/lists" />
        {undated.map(x => <TaskRow key={x.id} task={x} compact tag={tag} />)}
        {!undated.length && <div className="py-4 text-sm text-muted-foreground">All clear.</div>}
      </section>}
    </main>
  )
}
