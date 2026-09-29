import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CalendarIcon, CheckIcon, ClockIcon, FlagIcon, InboxIcon, Trash2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/api'
import { addDays, dueColor, dueLabel, nextMonday, parseYmd, today, whenLabel, ymd } from '@/lib/dates'
import { useTars } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type Opts = { hideProject?: boolean; hideDue?: boolean; compact?: boolean }

const pc = (p: number) => ({ '--pc': `var(--p${p})` }) as CSSProperties

function Check({ task, onDone }: { task: Task; onDone: () => void }) {
  return (
    <button
      type="button"
      aria-label={task.done ? 'Mark not done' : 'Complete'}
      style={pc(task.priority)}
      onClick={e => { e.stopPropagation(); onDone() }}
      className={cn(
        'group/check mt-px grid size-[22px] shrink-0 place-items-center rounded-full border-2 border-(--pc) bg-[color-mix(in_srgb,var(--pc)_12%,transparent)] transition-colors',
        'group-data-[done=true]/task:bg-(--pc)',
      )}
    >
      <CheckIcon strokeWidth={3} className="size-3 text-(--pc) opacity-0 transition-opacity group-data-[done=true]/task:text-background group-data-[done=true]/task:opacity-100 [@media(hover:hover)]:group-hover/check:opacity-100" />
    </button>
  )
}

export function TaskRow({ task, hideProject, hideDue, compact }: { task: Task } & Opts) {
  const { openId, setOpenId, toggleDone, project } = useTars()
  const [completing, setCompleting] = useState(false)
  const p = project(task.projectId)

  async function done() {
    if (!task.done) {
      setCompleting(true)
      navigator.vibrate?.(10)
      await new Promise(r => setTimeout(r, 300))
    }
    await toggleDone(task.id)
    setCompleting(false)
  }

  if (openId === task.id) return <TaskEditor task={task} onDone={done} />

  return (
    <div
      data-task-row
      data-done={task.done || completing}
      className={cn('group/task border-b border-border transition-opacity duration-300', completing && 'opacity-40')}
    >
      <div className="flex cursor-pointer items-start gap-3 py-3" onClick={() => setOpenId(task.id)}>
        <Check task={task} onDone={done} />
        <div className="min-w-0 flex-1">
          <div className="break-words group-data-[done=true]/task:text-muted-foreground group-data-[done=true]/task:line-through">{task.title}</div>
          {task.description && !compact && (
            <div className="line-clamp-2 text-[13px] whitespace-pre-wrap text-muted-foreground">{task.description}</div>
          )}
          <Meta task={task} hideDue={hideDue} project={hideProject ? undefined : p} />
        </div>
      </div>
    </div>
  )
}

function Meta({ task, hideDue, project }: { task: Task; hideDue?: boolean; project?: { name: string; color: string } }) {
  const items = []
  if (task.due && !hideDue) {
    items.push(
      <span key="due" style={{ color: task.done ? undefined : dueColor(task.due) }}>
        <CalendarIcon />{whenLabel(task)}
      </span>,
    )
  } else if (task.dueTime) {
    items.push(
      <span key="time" style={{ color: task.done ? undefined : dueColor(task.due || ymd(today())) }}>
        <ClockIcon />{task.dueTime}
      </span>,
    )
  }
  if (project) {
    items.push(
      <span key="proj"><span className="size-[7px] rounded-full" style={{ background: project.color }} />{project.name}</span>,
    )
  }
  if (!items.length) return null
  return <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1 [&_svg]:size-3">{items}</div>
}

const pill = 'h-8 rounded-lg border-transparent bg-background px-2.5 text-[13px] font-normal data-[on=true]:border-(--pc,var(--foreground)) dark:bg-background dark:hover:bg-accent'

function TaskEditor({ task, onDone }: { task: Task; onDone: () => void }) {
  const { patch, deleteTask, state, setOpenId } = useTars()
  const [title, setTitle] = useState(task.title)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const away = (e: MouseEvent) => {
      const el = e.target as Element
      if (!el.isConnected || ref.current?.contains(el) || el.closest('[data-radix-popper-content-wrapper], [data-sonner-toaster], [data-task-row]')) return
      const dialog = el.closest('[role=dialog], [role=alertdialog]')
      if (dialog && !dialog.contains(ref.current)) return
      setOpenId(null)
    }
    document.addEventListener('click', away)
    return () => document.removeEventListener('click', away)
  }, [setOpenId])
  const [calOpen, setCalOpen] = useState(false)
  const td = ymd(today()), tm = ymd(addDays(today(), 1)), nw = ymd(nextMonday())
  const custom = !!task.due && ![td, tm, nw].includes(task.due)

  const saveTitle = () => {
    const t = title.trim()
    if (t && t !== task.title) patch(task.id, { title: t })
    else setTitle(task.title)
  }
  const dateBtn = (d: string, label: ReactNode) => (
    <Button variant="outline" size="sm" data-on={task.due === d} className={pill} onClick={() => patch(task.id, { due: d })}>{label}</Button>
  )

  return (
    <div ref={ref} data-done={task.done} className="group/task -mx-3 my-1.5 rounded-xl bg-muted px-3 pb-3">
      <div className="flex items-start gap-3 py-3">
        <Check task={task} onDone={onDone} />
        <div className="min-w-0 flex-1">
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className="h-auto rounded-none border-0 bg-transparent p-0 font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Textarea
            defaultValue={task.description}
            placeholder="Add a note"
            rows={1}
            onBlur={e => { const v = e.target.value.trim(); if (v !== task.description) patch(task.id, { description: v }) }}
            className="mt-0.5 min-h-0 resize-none rounded-none border-0 bg-transparent p-0 text-[13px] text-muted-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
      </div>

      <div className="ml-[34px] flex flex-wrap gap-1.5">
        {dateBtn(td, <><CalendarIcon className="text-today" />Today</>)}
        {dateBtn(tm, 'Tomorrow')}
        {dateBtn(nw, 'Next week')}
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-on={custom} className={pill}>{custom ? dueLabel(task.due!) : 'Pick date…'}</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              weekStartsOn={1}
              selected={task.due ? parseYmd(task.due) : undefined}
              defaultMonth={task.due ? parseYmd(task.due) : undefined}
              onSelect={d => { if (d) { patch(task.id, { due: ymd(d) }); setCalOpen(false) } }}
            />
          </PopoverContent>
        </Popover>
        {task.due && (
          <label className={cn(pill, 'relative inline-flex cursor-pointer items-center gap-1 border [&_svg]:size-3.5')} data-on={!!task.dueTime}>
            <ClockIcon />{task.dueTime || 'Time'}
            <input
              type="time"
              value={task.dueTime || ''}
              onChange={e => patch(task.id, { dueTime: e.target.value || null })}
              className="absolute inset-0 opacity-0"
            />
          </label>
        )}
        {task.due && (
          <Button variant="outline" size="sm" className={pill} onClick={() => patch(task.id, { due: null, dueTime: null })}>No date</Button>
        )}
      </div>

      <div className="mt-2 ml-[34px] flex flex-wrap items-center gap-1.5">
        <ToggleGroup
          type="single"
          spacing={1}
          value={String(task.priority)}
          onValueChange={v => v && patch(task.id, { priority: +v as Task['priority'] })}
        >
          {[1, 2, 3, 4].map(n => (
            <ToggleGroupItem key={n} value={String(n)} size="sm" style={pc(n)}
              className={cn(pill, 'border data-[state=on]:border-(--pc) data-[state=on]:bg-background [&_svg]:text-(--pc)')}>
              <FlagIcon className="fill-current" />P{n}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select value={task.projectId ?? 'inbox'} onValueChange={v => patch(task.id, { projectId: v === 'inbox' ? null : v })}>
          <SelectTrigger size="sm" className="h-8 border-transparent bg-background text-[13px] dark:bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inbox"><InboxIcon />Inbox</SelectItem>
            {state.projects.map(pr => (
              <SelectItem key={pr.id} value={pr.id}>
                <span className="size-2 rounded-full" style={{ background: pr.color }} />{pr.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="destructive" size="sm" className="ml-auto h-8" onClick={() => deleteTask(task.id)}>
          <Trash2Icon />Delete
        </Button>
      </div>
    </div>
  )
}
