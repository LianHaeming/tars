import { useState, type ComponentProps } from 'react'
import type { DayButton } from 'react-day-picker'
import type { Task } from '@/lib/api'
import { parseYmd, relDay, longDate, today, ymd } from '@/lib/dates'
import { byTime, useTars } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { Empty, Section } from './ListsView'
import { TaskRow } from './TaskRow'

export function MonthView() {
  const { open, calSel, setCalSel } = useTars()
  const [month, setMonth] = useState(() => { const d = parseYmd(calSel); return new Date(d.getFullYear(), d.getMonth(), 1) })

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
        className="aspect-auto h-full justify-start gap-1 pt-1.5 data-[selected-single=true]:bg-muted data-[selected-single=true]:text-foreground [&>span]:opacity-100"
      >
        <span className={props.modifiers.today ? 'grid size-6 place-items-center rounded-full bg-primary font-bold text-white' : 'grid size-6 place-items-center'}>
          {props.children}
        </span>
        <span className="flex h-[5px] gap-[3px]">
          {dots.map(x => <i key={x.id} className="block size-[5px] rounded-full" style={{ background: `var(--p${x.priority})` }} />)}
        </span>
      </CalendarDayButton>
    )
  }

  return (
    <>
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
            caption_label: 'text-[19px] font-bold tracking-tight',
            nav: 'absolute top-0 right-12 flex items-center gap-1.5',
            day: 'group/day relative h-[54px] w-full p-0 text-center select-none',
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
        <span>{rel || full}{rel && <span className="font-medium text-muted-foreground"> · {full}</span>}</span>
      </Section>
      {list.map(x => <TaskRow key={x.id} task={x} hideDue />)}
      {!list.length && <Empty>Nothing on this day. Tap Add task to add one.</Empty>}
    </>
  )
}
