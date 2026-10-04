import { type TouchEvent, useMemo, useRef } from 'react'
import type { Task } from '@/lib/api'
import { parseYmd, today, ymd } from '@/lib/dates'
import { byTime, useTars } from '@/features/tasks/store'
import { useExpected, type Expected } from '@/features/money/expected'
import { SectionHead } from '@/components/common'
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

export function CalendarPanel({ filter = 'all' }: { filter?: string }) {
  const { state, calSel, pickDay, project, dayView, enterDay, closeDay, calMonth, setCalMonth } = useTars()
  const expected = useExpected()
  const month = useMemo(() => parseYmd(calMonth + '-01'), [calMonth])
  const touch = useRef<{ x: number; y: number } | null>(null)

  const cells = useMemo(() => buildCells(month), [month])
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
  const calLabel = monthKey(month) === monthKey(today())
    ? today().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const clickDay = (d: string) => { if (dayView && d === calSel) closeDay(); else enterDay(d) }

  const onTouchStart = (e: TouchEvent) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY } }
  const onTouchEnd = (e: TouchEvent) => {
    const s = touch.current; touch.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x, dy = t.clientY - s.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) goMonth(dx < 0 ? 1 : -1)
  }

  return (
    <section data-cal-panel>
      <SectionHead title="Calendar" lg />

      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="pt-1 pb-1">
            <span className="text-sm font-semibold tracking-wider text-muted-foreground uppercase tabular-nums">{calLabel}</span>
          </div>
          <div className="mt-2 grid grid-cols-7 px-1">
            {DOW.map(d => <span key={d} className="pb-1 text-center text-micro font-semibold tracking-wide text-muted-foreground">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map(dt => {
              const d = ymd(dt)
              const other = dt.getMonth() !== month.getMonth()
              const ts = gridTasks(d).slice().sort(byTime)
              const pays = showMoney ? (paysByDay[d] || []) : []
              const shown = ts.slice(0, 2)
              const extra = ts.length - shown.length
              const sel = dayView && d === calSel
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => clickDay(d)}
                  className={cn('flex min-h-16 flex-col gap-1 rounded-lg border p-1 text-left active:bg-muted', sel ? 'border-primary/50 bg-primary/10' : 'border-transparent', other && 'opacity-40')}
                >
                  <span className={cn('ml-1 text-xs font-semibold tabular-nums', d === ymd(today()) && 'text-primary')}>{dt.getDate()}</span>
                  {shown.map(x => <Chip key={x.id} color={project(x.projectId)?.color || 'var(--primary)'} done={x.done} label={x.title} />)}
                  {pays.length > 0 && <Chip color="var(--money)" label={pays[0].name} />}
                  {extra > 0 && <span className="pl-1 text-micro font-semibold text-muted-foreground">+{extra}</span>}
                </button>
              )
            })}
          </div>
      </div>
    </section>
  )
}

function Chip({ color, label, done }: { color: string; label: string; done?: boolean }) {
  const c = dim(color)
  return (
    <span
      className={cn('truncate rounded-mark border-l-2 px-1 text-micro font-medium', done && 'line-through opacity-50')}
      style={{ borderColor: c, color: c, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {label || 'Untitled'}
    </span>
  )
}
