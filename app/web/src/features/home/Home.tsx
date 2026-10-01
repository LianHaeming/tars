import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { localGet, localSet, type Task } from '@/lib/api'
import { dayDiff, hhmm, longDate, parseYmd, today, ymd } from '@/lib/dates'
import { byPriority, byWhen, useTars } from '@/features/tasks/store'
import { TaskRow } from '@/features/tasks/TaskRow'
import { SectionHead } from '@/components/common'
import { MainEvent } from './MainEvent'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
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

function byDay(dated: Task[]) {
  const t = ymd(today())
  const groups = new Map<string, Task[]>()
  for (const x of dated) {
    const k = x.due! < t ? 'overdue' : x.due!
    groups.set(k, [...(groups.get(k) ?? []), x])
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
  const [filter, setFilter] = useState(() => localGet('home-filter') || 'all')
  const active = state.projects.some(p => p.id === filter) ? filter : 'all'
  const pick = (k: string) => { setFilter(k); localSet('home-filter', k) }

  const shown = active === 'all' ? open : open.filter(x => x.projectId === active)
  const dated = shown.filter(x => x.due).sort(byWhen)
  const undated = shown.filter(x => !x.due).sort(byPriority)
  const main = todaysEvent(dated)
  const t = ymd(today())
  const tag = active === 'all'

  return (
    <main className="mx-auto max-w-page px-4 pt-safe-5 pb-safe-30">
      <header className="px-1 pt-2">
        <h1 className="text-2xl font-bold tracking-tight">{greeting()}, Lian</h1>
        <p className="mt-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{longDate(today())}</p>
      </header>

      <nav className="scrollbar-none -mx-4 mt-4 flex gap-5 overflow-x-auto px-5">
        <FilterLabel on={active === 'all'} color="var(--foreground)" onClick={() => pick('all')}>All</FilterLabel>
        {state.projects.map(p => (
          <FilterLabel key={p.id} on={active === p.id} color={p.color} onClick={() => pick(p.id)}>{p.name}</FilterLabel>
        ))}
      </nav>

      <section>
        <SectionHead title="Upcoming" link="Month" to="/month" />
        {byDay(dated).map(([day, list]) => (
          <div key={day}>
            <DayHead day={day} onMove={rescheduleOverdue} />
            {day === t && main && <MainEvent task={main} />}
            {list.filter(x => x !== main).map(x => <TaskRow key={x.id} task={x} compact tag={tag} hideDue={day !== 'overdue'} />)}
          </div>
        ))}
        {!dated.length && <div className="py-4 text-sm text-muted-foreground">Nothing coming up.</div>}
      </section>

      <section>
        <SectionHead title="To-do · no date" count={undated.length} link="All lists" to="/lists" />
        {undated.map(x => <TaskRow key={x.id} task={x} compact tag={tag} />)}
        {!undated.length && <div className="py-4 text-sm text-muted-foreground">All clear.</div>}
      </section>
    </main>
  )
}
