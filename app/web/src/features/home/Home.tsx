import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { cn, dim, primeKeyboard } from '@/lib/utils'
import { localGet, localSet, type Task } from '@/lib/api'
import { addDays, dayDiff, hhmm, parseYmd, shortDate, today, ymd } from '@/lib/dates'
import { byCreated, byWhen, useTars } from '@/features/tasks/store'
import { TaskRow } from '@/features/tasks/TaskRow'
import { CalendarPanel } from '@/features/tasks/calendar'
import { Empty, FilterBar, FilterLabel, Section, SectionHead } from '@/components/common'
import { PaymentRow, useExpected, type Expected } from '@/features/money/expected'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
const QUIPS = ['make today count', 'go make a memory', 'carpe that diem', 'you can’t bank the unused days', 'spend it well', 'the days don’t come back']
const DAY = 864e5
const YEAR = 365.25 * DAY

type Parent = { name: string; born: string; to: number }
const PARENTS: Parent[] = [
  { name: 'Mum', born: '1973-08-29', to: 87 },
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

function Bar({ pct, marks, endTitle }: { pct: number; marks: { at: number; label: string; main?: boolean }[]; endTitle?: string }) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className="absolute inset-y-0 left-0 overflow-hidden rounded-full" style={{ width: `${pct}%` }}>
          <div className="h-full" style={{ width: `${10000 / pct}%`, background: 'linear-gradient(90deg, var(--today), var(--tomorrow), var(--overdue))' }} />
        </div>
        {marks.map(m => (
          <div key={m.at} className={cn('absolute inset-y-0 w-px', m.main ? 'bg-primary' : 'bg-foreground/50')} style={{ left: `${(m.at / SPAN) * 100}%` }} title={`${m.at} — ${m.label}`} />
        ))}
      </div>
      <span className="text-xs font-semibold tabular-nums text-muted-foreground" title={endTitle}>{SPAN}</span>
    </div>
  )
}

function LifeStrip() {
  const [open, setOpen] = useState(false)
  const age = (Date.now() - +BIRTH) / YEAR
  const toAvg = Math.round((age / LIKELY) * 100)
  const quip = QUIPS[Math.floor(+today() / DAY) % QUIPS.length]
  const stats = quirkyStats(age)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="px-1 pt-1 pb-3">
      <CollapsibleTrigger className="w-full text-left">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Life, so far — you’re {Math.floor(age)}</span>
          <span className="text-xs text-muted-foreground">{toAvg}% to the average</span>
        </div>
        <Bar pct={(age / SPAN) * 100} marks={MARKS} endTitle="100 — about 1 in 9 men" />
        <p className="mt-2 text-xs text-muted-foreground">
          81 today’s rates · <span className="text-primary">87 likely</span> · 90 ≈ 1 in 4 · 100 ≈ 1 in 9 · {open ? quip : 'tap for more'}
        </p>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {PARENTS.map(p => {
          const pAge = (Date.now() - +new Date(p.born)) / YEAR
          return (
            <div key={p.name} className="mt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">{p.name}, so far — {Math.floor(pAge)}</span>
                <span className="text-xs text-muted-foreground">{Math.round((pAge / p.to) * 100)}% to {p.to}</span>
              </div>
              <Bar pct={(pAge / SPAN) * 100} marks={[{ at: p.to, label: 'likely', main: true }]} />
            </div>
          )
        })}
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

      {active === 'all' && !completed && <OrganiseCard />}

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
                    : <PaymentRow key={e.pay!.id} p={e.pay!} tag={tag} />)}
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
