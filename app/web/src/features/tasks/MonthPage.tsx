import { useEffect, useState, type ComponentProps } from 'react'
import { useSearchParams } from 'react-router'
import type { DayButton } from 'react-day-picker'
import type { Task } from '@/lib/api'
import { parseYmd, relDay, longDate, today, ymd } from '@/lib/dates'
import { byTime, useListView, useTars } from '@/features/tasks/store'
import { Button } from '@/components/ui/button'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { Empty, Section } from '@/components/common'
import { Page } from '@/components/Page'
import { TaskRow } from '@/features/tasks/TaskRow'

export function MonthPage() {
  const { open, calSel, setCalSel } = useTars()
  const [params] = useSearchParams()
  const start = params.get('d') || calSel
  const [month, setMonth] = useState(() => { const d = parseYmd(start); return new Date(d.getFullYear(), d.getMonth(), 1) })
  useListView('calendar')
  useEffect(() => { if (/^\d{4}-\d{2}-\d{2}$/.test(start)) setCalSel(start) }, [start])

  const byDay: Record<string, Task[]> = {}
  open.forEach(x => { if (x.due) (byDay[x.due] ||= []).push(x) })

  const rel = relDay(calSel)
  const full = longDate(parseYmd(calSel))
  const list = (byDay[calSel] || []).sort(byTime)

  function Day(props: ComponentProps<typeof DayButton>) {
    const dots = (byDay[ymd(props.day.date)] || []).slice(0, 3)
    return (
      <CalendarDayButton
        {...props}
        className="aspect-auto h-full justify-start gap-1 pt-2 data-[selected-single=true]:bg-muted data-[selected-single=true]:text-foreground [&>span]:opacity-100"
      >
        <span className={props.modifiers.today ? 'grid size-6 place-items-center rounded-full bg-primary font-bold text-white' : 'grid size-6 place-items-center'}>
          {props.children}
        </span>
        <span className="flex h-1 gap-1">
          {dots.map(x => <i key={x.id} className="block size-1 rounded-full" style={{ background: `var(--p${x.priority})` }} />)}
        </span>
      </CalendarDayButton>
    )
  }

  return (
    <Page title="Month" back="/apps">
      <div className="relative">
        <Calendar
          mode="single"
          required
          weekStartsOn={1}
          month={month}
          onMonthChange={setMonth}
          selected={parseYmd(calSel)}
          onSelect={d => d && setCalSel(ymd(d))}
          components={{ DayButton: Day }}
          className="w-full bg-transparent px-0 pt-3 [--cell-size:--spacing(11)]"
          classNames={{
            root: 'w-full',
            month_caption: 'flex h-(--cell-size) items-center justify-start px-0',
            caption_label: 'text-xl font-bold tracking-tight',
            nav: 'absolute top-0 right-12 flex items-center gap-2',
            day: 'group/day relative h-14 w-full p-0 text-center select-none',
            today: '',
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-5 right-0"
          onClick={() => { const t = today(); setMonth(new Date(t.getFullYear(), t.getMonth(), 1)); setCalSel(ymd(t)) }}
        >
          Today
        </Button>
      </div>
      <Section>
        <span>{rel || full}{rel && <span className="font-semibold text-muted-foreground"> · {full}</span>}</span>
      </Section>
      {list.map(x => <TaskRow key={x.id} task={x} hideDue />)}
      {!list.length && <Empty>Nothing on this day. Tap Add task to add one.</Empty>}
    </Page>
  )
}
