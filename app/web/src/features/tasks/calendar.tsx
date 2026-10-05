import { type TouchEvent, useMemo, useRef } from 'react'
import type { Task } from '@/lib/api'
import { addDays, parseYmd, relDay, today, ymd } from '@/lib/dates'
import { byTime, useTars } from '@/features/tasks/store'
import { TaskRow } from '@/features/tasks/TaskRow'
import { PaymentRow, useExpected, type Expected } from '@/features/money/expected'
import { SectionHead } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, dim } from '@/lib/utils'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const firstOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const monthKey = (d: Date) => ymd(d).slice(0, 7)

function buildCells(month: Date) {
  const first = firstOf(month)
  const lead = (first.getDay() + 6) % 7 // Mon = 0
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - lead)
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

function weekOf(day: string) {
  const d = parseYmd(day)
  const start = addDays(d, -((d.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function CalendarPanel({ filter = 'all' }: { filter?: string }) {
  const { state, calSel, pickDay, project, dayView, enterDay, closeDay, calMonth, setCalMonth } = useTars()
  const expected = useExpected()
  const month = useMemo(() => parseYmd(calMonth + '-01'), [calMonth])
  const touch = useRef<{ x: number; y: number } | null>(null)

  const cells = useMemo(() => (dayView ? weekOf(calSel) : buildCells(month)), [dayView, calSel, month])
  const tasksByDay = useMemo(() => {
    const m: Record<string, Task[]> = {}
    state.tasks.forEach(x => { if (x.due) (m[x.due] ||= []).push(x) })
    return m
  }, [state.tasks])
  const paysByDay = useMemo(() => {
    const m: Record<string, Expected[]> = {}
    expected.forEach(p => (m[p.date] ||= []).push(p))
    return m
  }, [expected])

  const activeTag = filter !== 'all' && filter !== 'money' ? filter : null
  const showMoney = filter === 'all' || filter === 'money'
  const showTasks = filter !== 'money'
  const gridTasks = (d: string) => (showTasks ? (tasksByDay[d] || []).filter(x => !activeTag || x.projectId === activeTag) : [])

  const goMonth = (delta: number) => { const m = new Date(month.getFullYear(), month.getMonth() + delta, 1); setCalMonth(monthKey(m)); pickDay(ymd(m)) }
  const goWeek = (delta: number) => { const d = addDays(parseYmd(calSel), delta * 7); setCalMonth(monthKey(d)); enterDay(ymd(d)) }
  const calLabel = dayView
    ? parseYmd(calSel).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : monthKey(month) === monthKey(today())
      ? today().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
      : month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const clickDay = (d: string) => {
    if (dayView && d === calSel) { closeDay(); return }
    setCalMonth(d.slice(0, 7))
    enterDay(d)
  }
  const dayTasks = gridTasks(calSel).slice().sort(byTime)
  const dayPays = showMoney ? (paysByDay[calSel] || []) : []
  const dayLabel = relDay(calSel) || parseYmd(calSel).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })

  const onTouchStart = (e: TouchEvent) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY } }
  const onTouchEnd = (e: TouchEvent) => {
    const s = touch.current; touch.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x, dy = t.clientY - s.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dayView ? goWeek : goMonth)(dx < 0 ? 1 : -1)
  }

  return (
    <section data-cal-panel>
      <SectionHead title="Calendar" lg />

      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="flex items-center justify-between pt-1 pb-1">
            <span className="text-sm font-semibold tracking-wider text-muted-foreground uppercase tabular-nums">{calLabel}</span>
            {dayView && <Button variant="link" size="inline" className="text-sm" onClick={closeDay}>Month</Button>}
          </div>
          <div className="mt-2 grid grid-cols-7 px-1">
            {DOW.map(d => <span key={d} className="pb-1 text-center text-micro font-semibold tracking-wide text-muted-foreground">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map(dt => {
              const d = ymd(dt)
              const other = !dayView && dt.getMonth() !== month.getMonth()
              const ts = gridTasks(d).slice().sort(byTime)
              const pays = showMoney ? (paysByDay[d] || []) : []
              const shown = ts.slice(0, 2)
              const extra = ts.length - shown.length
              const sel = dayView && d === calSel
              if (dayView) return (
                <Button
                  key={d}
                  variant="ghost"
                  onClick={() => clickDay(d)}
                  className={cn('h-auto flex-col gap-1 rounded-lg border py-2', sel ? 'border-primary/50 bg-primary/10' : 'border-transparent')}
                >
                  <span className={cn('text-sm font-semibold tabular-nums', d === ymd(today()) && 'text-primary')}>{dt.getDate()}</span>
                  <span className="flex h-3 items-center gap-1">
                    {ts.slice(0, 3).map(x => <span key={x.id} className="size-1 rounded-full" style={{ background: dim(project(x.projectId)?.color || 'var(--primary)') }} />)}
                    {pays.length > 0 && (pays[0].logo ? <img src={pays[0].logo} alt="" className="size-3 rounded-full bg-white object-cover" /> : <span className="size-1 rounded-full bg-money" />)}
                  </span>
                </Button>
              )
              return (
                <Button
                  key={d}
                  variant="ghost"
                  onClick={() => clickDay(d)}
                  className={cn('h-auto min-h-16 flex-col items-stretch justify-start gap-1 rounded-lg border p-1 text-left', sel ? 'border-primary/50 bg-primary/10' : 'border-transparent', other && 'opacity-40')}
                >
                  <span className={cn('ml-1 text-xs font-semibold tabular-nums', d === ymd(today()) && 'text-primary')}>{dt.getDate()}</span>
                  {shown.map(x => <Chip key={x.id} color={project(x.projectId)?.color || 'var(--primary)'} done={x.done} label={x.title} />)}
                  {pays.length > 0 && <Chip color="var(--money)" label={pays[0].name} logo={pays[0].logo} />}
                  {extra > 0 && <span className="pl-1 text-micro font-semibold text-muted-foreground">+{extra}</span>}
                </Button>
              )
            })}
          </div>
      </div>

      {dayView && (
        <div className="pt-2">
          <div className="hairline-b pt-2 pb-1 text-xs font-semibold tracking-wider text-primary uppercase">{dayLabel}</div>
          {dayTasks.map(x => <TaskRow key={x.id} task={x} compact tag={!activeTag} hideDue />)}
          {dayPays.map(p => <PaymentRow key={p.id} p={p} tag={!activeTag} />)}
          {!dayTasks.length && !dayPays.length && <div className="py-4 text-sm text-muted-foreground">Nothing on this day.</div>}
        </div>
      )}
    </section>
  )
}

function Chip({ color, label, done, logo }: { color: string; label: string; done?: boolean; logo?: string | null }) {
  const c = dim(color)
  return (
    <Badge
      variant="outline"
      className={cn('h-auto w-full justify-start gap-1 truncate rounded-mark border-y-0 border-r-0 border-l-2 px-1 text-micro font-medium', done && 'line-through opacity-50')}
      style={{ borderColor: c, color: c, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {logo && <img src={logo} alt="" loading="lazy" className="size-3 shrink-0 rounded-full bg-white object-cover" />}
      <span className="truncate">{label || 'Untitled'}</span>
    </Badge>
  )
}
