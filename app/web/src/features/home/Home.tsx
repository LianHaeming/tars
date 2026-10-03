import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { focusDraft } from '@/app/Dock'
import { cn, dim } from '@/lib/utils'
import { localGet, localSet, type Task } from '@/lib/api'
import { dayDiff, hhmm, parseYmd, relDay, shortDate, today, ymd } from '@/lib/dates'
import { byPriority, byWhen, useTars } from '@/features/tasks/store'
import { TaskRow } from '@/features/tasks/TaskRow'
import { CalendarPanel } from '@/features/tasks/calendar'
import { Section, SectionHead } from '@/components/common'
import { PaymentRow, useExpected, type Expected } from '@/features/money/expected'
import { MainEvent } from './MainEvent'

type Entry = { day: string; task?: Task; pay?: Expected }

function todaysEvent(dated: Task[]) {
  const t = ymd(today()), now = hhmm(new Date())
  const timed = dated.filter(x => x.due === t && x.dueTime)
  return timed.find(x => x.dueTime! >= now) ?? timed.at(-1)
}

function groupByDay(entries: Entry[]) {
  const groups = new Map<string, Entry[]>()
  for (const e of [...entries].sort((a, b) => a.day.localeCompare(b.day))) {
    groups.set(e.day, [...(groups.get(e.day) ?? []), e])
  }
  return [...groups]
}

function FilterLabel({ on, color, onClick, children }: { on: boolean; color: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={on ? undefined : { color }}
      className={cn('shrink-0 rounded-full px-3 py-2 text-base font-semibold whitespace-nowrap transition-colors', on && 'bg-secondary text-foreground')}
    >
      {children}
    </button>
  )
}

function DayHead({ day, overdue }: { day: string; overdue?: boolean }) {
  const dt = parseYmd(day)
  const n = dayDiff(day)
  const label = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : dt.toLocaleDateString(undefined, { weekday: 'long' })
  return (
    <div className={cn('flex items-baseline gap-2 pt-4 pb-1 text-xs font-semibold tracking-wider uppercase', overdue ? 'text-overdue' : n === 0 ? 'text-primary' : 'text-muted-foreground')}>
      <span>{label}</span>
      <span className="opacity-60">{shortDate(dt)}</span>
    </div>
  )
}

function Completed({ tasks }: { tasks: Task[] }) {
  const done = [...tasks].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
  let last: string | null | undefined
  return (
    <section>
      <SectionHead title="Completed" count={done.length} />
      {done.map(x => {
        const day = x.completedAt ? ymd(new Date(x.completedAt)) : null
        const head = day !== last
        last = day
        const name = !day ? 'Earlier' : dayDiff(day) === 0 ? 'Today' : dayDiff(day) === -1 ? 'Yesterday' : parseYmd(day).toLocaleDateString(undefined, { weekday: 'long' })
        return (
          <div key={x.id}>
            {head && <Section><span>{name}{day && <span className="font-semibold text-muted-foreground"> · {shortDate(parseYmd(day))}</span>}</span></Section>}
            <TaskRow task={x} hideDue />
          </div>
        )
      })}
      {!done.length && <div className="py-4 text-sm text-muted-foreground">Nothing completed yet.</div>}
    </section>
  )
}

export function Home() {
  const { open, state, rescheduleOverdue, pendingAdd, setPendingAdd, addDraft, dayView, calSel, closeDay, calMonth } = useTars()
  const expected = useExpected()
  const [params, setParams] = useSearchParams()
  const urlFilter = params.get('filter')

  useEffect(() => {
    if (!pendingAdd) return
    setPendingAdd(false)
    addDraft()
    const t = setTimeout(focusDraft, 60)
    return () => clearTimeout(t)
  }, [pendingAdd, setPendingAdd, addDraft])
  const [filter, setFilter] = useState(() => localGet('home-filter') || 'all')
  const known = (k: string) => k === 'all' || k === 'money' || k === 'completed' || state.projects.some(p => p.id === k)
  const active = known(filter) ? filter : 'all'
  const pick = (k: string) => { setFilter(k); localSet('home-filter', k) }
  const [todoShut, setTodoShut] = useState(() => localGet('home-todo') === '1')
  const toggleTodo = () => setTodoShut(v => { localSet('home-todo', v ? '0' : '1'); return !v })
  const [upShut, setUpShut] = useState(() => localGet('home-up') === '1')
  const toggleUp = () => setUpShut(v => { localSet('home-up', v ? '0' : '1'); return !v })
  useEffect(() => {
    if (!urlFilter) return
    if (known(urlFilter)) { pick(urlFilter); setParams({}, { replace: true }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilter, state.projects])

  const completed = active === 'completed'
  const t = ymd(today())
  const tag = active === 'all'
  const matchTag = (x: Task) => active === 'all' || x.projectId === active
  const datedAll = (active === 'money' ? [] : state.tasks.filter(x => x.due && matchTag(x))).sort(byWhen)
  const undated = (active === 'money' ? [] : open.filter(x => !x.due && matchTag(x))).sort(byPriority)
  const pays = active === 'all' || active === 'money' ? expected : []
  const main = todaysEvent(datedAll.filter(x => !x.done))
  const overdueOpen = datedAll.filter(x => !x.done && x.due! < t)
  const allDated: Entry[] = [...datedAll.map(task => ({ day: task.due!, task })), ...pays.map(pay => ({ day: pay.date, pay }))]
  const entries = dayView
    ? allDated.filter(e => e.day === calSel)
    : allDated.filter(e => e.day.startsWith(calMonth))
  const showTodo = active !== 'money' && undated.length > 0
  const hasCalData = datedAll.length > 0 || pays.length > 0
  const showAgenda = dayView || entries.length > 0

  return (
    <main className="mx-auto max-w-page px-4 pb-safe-40">
      <nav className="bg-page scrollbar-none sticky top-0 z-30 -mx-4 flex gap-2 overflow-x-auto px-4 pt-safe-3 pb-2">
        <FilterLabel on={active === 'all'} color="var(--foreground)" onClick={() => pick('all')}>All</FilterLabel>
        {state.projects.map(p => (
          <FilterLabel key={p.id} on={active === p.id} color={dim(p.color)} onClick={() => pick(p.id)}>{p.name}</FilterLabel>
        ))}
        {expected.length > 0 && <FilterLabel on={active === 'money'} color={dim('var(--money)')} onClick={() => pick('money')}>Money</FilterLabel>}
        <FilterLabel on={completed} color="var(--muted-foreground)" onClick={() => pick('completed')}>Completed</FilterLabel>
      </nav>

      {completed ? (
        <Completed tasks={state.tasks.filter(x => x.done)} />
      ) : (
        <>
          {showTodo && (
            <section>
              <SectionHead title="To-do" sticky collapsed={todoShut} onToggle={toggleTodo} />
              {!todoShut && undated.map(x => <TaskRow key={x.id} task={x} compact tag={tag} />)}
            </section>
          )}

          {(hasCalData || dayView) && <CalendarPanel filter={active} />}

          {showAgenda && (
          <section>
            {dayView ? (
              <div className="bg-page sticky top-below-filters z-20 flex items-center justify-between pt-6 pb-1 text-lg font-semibold tracking-wider text-muted-foreground uppercase">
                <span>{relDay(calSel) || parseYmd(calSel).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                <button type="button" onClick={closeDay} className="text-sm font-semibold tracking-normal text-primary normal-case">Show all</button>
              </div>
            ) : (
              <div className="bg-page sticky top-below-filters z-20 flex items-center justify-between pt-6 pb-1 text-lg font-semibold tracking-wider text-muted-foreground uppercase">
                <button type="button" onClick={toggleUp} className="-my-1 py-1 uppercase">Upcoming</button>
                {overdueOpen.length > 0 && <button type="button" onClick={rescheduleOverdue} className="text-sm font-semibold tracking-normal text-primary normal-case">Move {overdueOpen.length} overdue</button>}
              </div>
            )}
            {(dayView || !upShut) && groupByDay(entries).map(([day, list]) => {
              const over = day < t && list.some(e => e.task && !e.task.done)
              return (
                <div key={day}>
                  <DayHead day={day} overdue={over} />
                  {day === t && main && <MainEvent task={main} />}
                  {list.map(e => e.task
                    ? e.task !== main && <TaskRow key={e.task.id} task={e.task} compact tag={tag} hideDue />
                    : <PaymentRow key={e.pay!.id} p={e.pay!} tag={tag} />)}
                </div>
              )
            })}
            {dayView && !entries.length && <div className="py-4 text-sm text-muted-foreground">Nothing on this day.</div>}
          </section>
          )}

          {!showTodo && !hasCalData && !showAgenda && (
            <p className="py-12 text-center text-sm text-muted-foreground">Nothing here yet.</p>
          )}
        </>
      )}
    </main>
  )
}
