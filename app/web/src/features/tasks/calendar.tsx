import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import type { Task } from '@/lib/api'
import { localGet, localSet } from '@/lib/api'
import { parseYmd, relDay, longDate, today, ymd } from '@/lib/dates'
import { byTime, useTars } from '@/features/tasks/store'
import { Button } from '@/components/ui/button'
import { TaskRow } from '@/features/tasks/TaskRow'
import { PaymentRow, useExpected, type Expected } from '@/features/money/expected'
import { cn } from '@/lib/utils'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const firstOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

function buildCells(month: Date) {
  const first = firstOf(month)
  const lead = (first.getDay() + 6) % 7 // Mon = 0
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - lead)
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

export function CalendarPanel({ filter = 'all' }: { filter?: string }) {
  const { state, calSel, pickDay, project, dayView, enterDay, closeDay } = useTars()
  const expected = useExpected()
  const [month, setMonth] = useState(() => firstOf(parseYmd(calSel)))
  const [shut, setShut] = useState(() => localGet('home-cal') === '0')
  const panelRef = useRef<HTMLElement>(null)

  // click outside the panel closes the open day
  useEffect(() => {
    if (!dayView) return
    const onDoc = (e: MouseEvent) => {
      const el = e.target as Element
      if (!el.isConnected || panelRef.current?.contains(el)) return
      if (el.closest('[data-dock], [data-radix-popper-content-wrapper], [data-sonner-toaster], [role=dialog], [role=alertdialog]')) return
      closeDay()
    }
    const t = setTimeout(() => document.addEventListener('click', onDoc), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', onDoc) }
  }, [dayView, closeDay])

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

  const goMonth = (delta: number) => { const m = new Date(month.getFullYear(), month.getMonth() + delta, 1); setMonth(m); pickDay(ymd(m)) }
  const goToday = () => { const t = today(); setMonth(firstOf(t)); if (dayView) enterDay(ymd(t)); else pickDay(ymd(t)) }
  const toggleShut = () => { setShut(v => { localSet('home-cal', v ? '1' : '0'); if (!v) closeDay(); return !v }) }
  const clickDay = (d: string) => { if (dayView && d === calSel) closeDay(); else enterDay(d) }

  const dayTasks = (tasksByDay[calSel] || []).slice().sort(byTime)
  const dayPays = paysByDay[calSel] || []
  const nav = 'grid size-8 place-items-center rounded-full text-muted-foreground active:bg-muted [&_svg]:size-5'

  return (
    <section ref={panelRef} data-cal-panel>
      <div className="flex items-center justify-between pt-6 pb-1">
        <div className="flex items-center gap-1">
          {!shut && <button type="button" aria-label="Previous month" onClick={() => goMonth(-1)} className={nav}><ChevronLeftIcon /></button>}
          <button type="button" onClick={toggleShut} className="inline-flex items-center gap-1 text-xl font-bold tracking-tight tabular-nums">
            {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            <ChevronDownIcon className={cn('size-5 text-muted-foreground transition-transform', shut && '-rotate-90')} />
          </button>
          {!shut && <button type="button" aria-label="Next month" onClick={() => goMonth(1)} className={nav}><ChevronRightIcon /></button>}
        </div>
        {!shut && <Button variant="secondary" size="sm" onClick={goToday}>Today</Button>}
      </div>

      {!shut && (
        <>
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
        </>
      )}

      {dayView && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-baseline gap-2 pt-4 pb-1">
            <h3 className="text-lg font-bold tracking-tight">{relDay(calSel) || longDate(parseYmd(calSel))}</h3>
            {relDay(calSel) && <span className="text-xs text-muted-foreground">{longDate(parseYmd(calSel))}</span>}
            <button type="button" aria-label="Close day" onClick={closeDay} className="ml-auto grid size-7 place-items-center rounded-full text-muted-foreground active:bg-muted"><XIcon className="size-4" /></button>
          </div>
          {dayTasks.map(x => <TaskRow key={x.id} task={x} compact tag hideDue />)}
          {dayPays.map(p => <PaymentRow key={p.id} p={p} tag />)}
          {!dayTasks.length && !dayPays.length && <p className="py-4 text-sm text-muted-foreground">Nothing on this day. Tap Add task to add one.</p>}
        </div>
      )}
    </section>
  )
}

function Chip({ color, label, done }: { color: string; label: string; done?: boolean }) {
  return (
    <span
      className={cn('truncate rounded-mark border-l-2 px-1 text-micro font-medium', done && 'line-through opacity-50')}
      style={{ borderColor: color, color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}
    >
      {label || 'Untitled'}
    </span>
  )
}
