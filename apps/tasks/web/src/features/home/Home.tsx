import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { cn, dim, primeKeyboard } from '@tars/ui/lib/utils'
import { localGet, localSet } from '@tars/ui/lib/api'
import type { Task } from '@/lib/types'
import { addDays, dayDiff, hhmm, parseYmd, shortDate, today, ymd } from '@tars/ui/lib/dates'
import { byCreated, byWhen, useTars } from '@/features/tasks/store'
import { TaskRow } from '@/features/tasks/TaskRow'
import { CalendarPanel } from '@/features/tasks/calendar'
import { Empty, FilterBar, FilterLabel, Section, SectionHead } from '@tars/ui/components/common'
import { appUrl } from '@tars/ui/lib/apps'
import { PaymentRow, useExpected, type Expected } from '@tars/ui/components/payments'
import { Button } from '@tars/ui/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@tars/ui/components/ui/collapsible'
import { MainEvent } from './MainEvent'
import { OrganiseCard } from './OrganiseCard'

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

const BIRTH = new Date(1998, 1, 10)
const SPAN = 100
const LIKELY = 87
const MARKS = [
  { at: 81, label: 'today’s rates' },
  { at: 87, label: 'likely', main: true },
  { at: 90, label: '≈1 in 4' },
]
const DAY = 864e5
const YEAR = 365.25 * DAY

type Parent = { name: string; born: string; to: number; marks?: { at: number; label: string }[] }
const PARENTS: Parent[] = [
  { name: 'Mum', born: '1973-08-29', to: 87, marks: [{ at: 66, label: 'her mum' }] },
]

const num = (n: number) => n.toLocaleString()

function quirkyStats(age: number) {
  const now = Date.now()
  const left = Math.max(0, LIKELY - age)
  const daysLived = Math.floor((now - +BIRTH) / DAY)
  const halfway = new Date(+BIRTH + (LIKELY / 2) * YEAR)
  const halfwayPassed = now >= +halfway
  const ageAt = (year: number) => year - BIRTH.getFullYear()
  const stats: { n: string; l: string }[] = [
    { n: num(daysLived), l: 'days lived' },
    { n: num(Math.round(left)), l: 'summers left' },
    { n: num(Math.round(left * 52)), l: 'weekends left' },
    { n: num(Math.round(left * 12.368)), l: 'full moons left' },
    { n: halfwayPassed ? 'passed' : shortDate(halfway), l: halfwayPassed ? 'past halfway (43½)' : 'you hit halfway (43½)' },
    { n: String(ageAt(2045)), l: 'your age at the singularity, 2045' },
    { n: String(ageAt(2029)), l: 'your age when AGI’s tipped to land' },
  ]
  for (const p of PARENTS) {
    const pAge = (now - +new Date(p.born)) / YEAR
    stats.push({ n: num(Math.max(0, Math.round((p.to - pAge) * 52))), l: `weekends with ${p.name} left` })
  }
  return stats
}

function LifeRow({ age, marks }: { age: number; marks: { at: number; label: string; main?: boolean }[] }) {
  return (
    <div className="relative h-1 overflow-hidden rounded-full bg-secondary">
      <div className="absolute inset-y-0 left-0 overflow-hidden rounded-full" style={{ width: `${(age / SPAN) * 100}%` }}>
        <div className="h-full" style={{ width: `${(SPAN / age) * 100}%`, background: 'linear-gradient(90deg, var(--today), var(--tomorrow), var(--overdue))' }} />
      </div>
      {marks.map(m => (
        <div key={m.at} className={cn('absolute inset-y-0 w-px', m.main ? 'bg-primary' : 'bg-foreground/50')} style={{ left: `${(m.at / SPAN) * 100}%` }} title={`${m.at} — ${m.label}`} />
      ))}
    </div>
  )
}

function LifeStrip() {
  const [open, setOpen] = useState(false)
  const age = (Date.now() - +BIRTH) / YEAR
  const stats = quirkyStats(age)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="px-1 pt-1 pb-3">
      <CollapsibleTrigger className="w-full space-y-2 py-2 text-left">
        <LifeRow age={age} marks={MARKS} />
        {PARENTS.map(p => (
          <LifeRow key={p.name} age={(Date.now() - +new Date(p.born)) / YEAR} marks={[{ at: p.to, label: 'likely', main: true }, ...(p.marks ?? [])]} />
        ))}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {stats.map(s => (
            <div key={s.l} className="glass rounded-lg px-3 py-2">
              <div className="text-lg font-semibold tabular-nums">{s.n}</div>
              <div className="text-xs text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function AgendaHead({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between pt-6 pb-1 text-lg font-semibold tracking-wider text-muted-foreground uppercase">
      <span>{label}</span>
      {action}
    </div>
  )
}

function SubHead({ name, color, count }: { name: string; color: string; count: number }) {
  return (
    <div className="flex items-center gap-2 pt-5 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      <span>{name}</span>
      <span className="opacity-60">{count}</span>
    </div>
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
  const { open, state, rescheduleOverdue, addDraft, dayView } = useTars()
  const expected = useExpected()
  const [params, setParams] = useSearchParams()
  const urlFilter = params.get('filter')

  const [filter, setFilter] = useState(() => localGet('home-filter') || 'all')
  const known = (k: string) => k === 'all' || k === 'completed' || state.projects.some(p => p.id === k)
  const active = known(filter) ? filter : 'all'
  const pick = (k: string) => { setFilter(k); localSet('home-filter', k) }
  useEffect(() => {
    if (!urlFilter) return
    if (known(urlFilter)) { pick(urlFilter); setParams({}, { replace: true }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilter, state.projects])

  const completed = active === 'completed'
  const t = ymd(today())
  const tag = active === 'all'
  const matchTag = (x: Task) => active === 'all' || x.projectId === active
  const datedAll = state.tasks.filter(x => x.due && matchTag(x)).sort(byWhen)
  const undated = open.filter(x => !x.due && matchTag(x)).sort(byCreated)
  const pays = active === 'all' ? expected : []
  const main = todaysEvent(datedAll.filter(x => !x.done))
  const overdueOpen = datedAll.filter(x => !x.done && x.due! < t)
  const allDated: Entry[] = [...datedAll.map(task => ({ day: task.due!, task })), ...pays.map(pay => ({ day: pay.date, pay }))]
  const horizon = ymd(addDays(today(), 14))
  const entries = allDated.filter(e => e.day < horizon && (e.task ? !e.task.done : e.day >= t))
  const activeProject = state.projects.find(p => p.id === active)
  const subs = activeProject?.subs ?? []
  const grouped = subs.length > 0 && undated.some(x => x.subId)
  const noSub = undated.filter(x => !x.subId || !subs.some(s => s.id === x.subId))
  const showTodo = undated.length > 0
  const hasCalData = datedAll.length > 0 || pays.length > 0
  const showAgenda = entries.length > 0

  return (
    <main className="mx-auto max-w-page px-4 pt-safe-3 pb-safe-40">
      <LifeStrip />
      <FilterBar value={active} onValueChange={pick}>
        <FilterLabel value="all">All</FilterLabel>
        {state.projects.map(p => (
          <FilterLabel key={p.id} value={p.id} color={dim(p.color)}>{p.name}</FilterLabel>
        ))}
        <FilterLabel value="completed">Completed</FilterLabel>
      </FilterBar>

      <OrganiseCard />

      {completed ? (
        <Completed tasks={state.tasks.filter(x => x.done)} />
      ) : (
        <>
          {showAgenda && (
          <section>
            <AgendaHead
              label="Upcoming"
              action={overdueOpen.length > 0 ? <Button variant="link" size="inline" onClick={rescheduleOverdue} className="tracking-normal normal-case">Move {overdueOpen.length} overdue</Button> : undefined}
            />
            {groupByDay(entries).map(([day, list]) => {
              const over = day < t && list.some(e => e.task && !e.task.done)
              return (
                <div key={day}>
                  <DayHead day={day} overdue={over} />
                  {day === t && main && <MainEvent task={main} />}
                  {list.map(e => e.task
                    ? e.task !== main && <TaskRow key={e.task.id} task={e.task} compact tag={tag} hideDue />
                    : <PaymentRow key={e.pay!.id} p={e.pay!} tag={tag} href={appUrl('money')} />)}
                </div>
              )
            })}
          </section>
          )}

          {(hasCalData || dayView) && <CalendarPanel filter={active} />}

          {showTodo && (
            <section>
              <SectionHead title="To-do" lg />
              {grouped ? (
                <>
                  {subs.map(s => {
                    const items = undated.filter(x => x.subId === s.id)
                    if (!items.length) return null
                    return (
                      <div key={s.id}>
                        <SubHead name={s.name} color={activeProject!.color} count={items.length} />
                        {items.map(x => <TaskRow key={x.id} task={x} compact tag={tag} />)}
                      </div>
                    )
                  })}
                  {noSub.length > 0 && (
                    <div>
                      <SubHead name="Other" color="var(--muted-foreground)" count={noSub.length} />
                      {noSub.map(x => <TaskRow key={x.id} task={x} compact tag={tag} />)}
                    </div>
                  )}
                </>
              ) : (
                undated.map(x => <TaskRow key={x.id} task={x} compact tag={tag} />)
              )}
            </section>
          )}

          {!showTodo && !hasCalData && !showAgenda && (
            <Empty icon="🗓">
              {active === 'all'
                ? <>No tasks scheduled yet.<br /><Button variant="link" size="inline" onClick={() => { primeKeyboard(); addDraft() }} className="mt-3">Add your first task</Button></>
                : <>Nothing in <span className="text-foreground">{activeProject?.name ?? 'this list'}</span> yet.<br /><Button variant="link" size="inline" onClick={() => { primeKeyboard(); addDraft() }} className="mt-3">Add a task</Button></>}
            </Empty>
          )}
        </>
      )}
    </main>
  )
}
