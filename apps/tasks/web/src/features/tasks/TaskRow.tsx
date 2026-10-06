import { useState, type CSSProperties } from 'react'
import { CalendarIcon, ClockIcon, RepeatIcon } from 'lucide-react'
import { cn, dim, primeKeyboard } from '@tars/ui/lib/utils'
import type { Task } from '@/lib/types'
import { dueColor, repeatLabel, today, whenLabel, ymd } from '@tars/ui/lib/dates'
import { useTars } from '@/features/tasks/store'
import { Checkbox } from '@tars/ui/components/ui/checkbox'
import { Badge } from '@tars/ui/components/ui/badge'

type Opts = { hideProject?: boolean; hideDue?: boolean; compact?: boolean; tag?: boolean }

export function Check({ task, color, checked, onDone }: { task: Task; color: string; checked: boolean; onDone: () => void }) {
  return (
    <Checkbox
      aria-label={task.done ? 'Mark not done' : 'Complete'}
      checked={checked}
      style={{ '--pc': color } as CSSProperties}
      onClick={e => e.stopPropagation()}
      onCheckedChange={() => onDone()}
      className="mt-px size-5 rounded-full border-2 border-(--pc) bg-(--pc)/12 data-checked:border-(--pc) data-checked:bg-(--pc) data-checked:text-background [&_svg]:size-3 [&_svg]:stroke-[3]"
    />
  )
}

export function TaskRow({ task, hideProject, hideDue, compact, tag }: { task: Task } & Opts) {
  const { setOpenId, toggleDone, project } = useTars()
  const [completing, setCompleting] = useState(false)
  const p = project(task.projectId)

  async function done() {
    if (!task.done) {
      setCompleting(true)
      navigator.vibrate?.(10)
      await new Promise(r => setTimeout(r, 200))
    }
    await toggleDone(task.id)
    setCompleting(false)
  }

  return (
    <div
      data-task-row
      data-done={task.done || completing}
      className={cn('group/task hairline-b transition-opacity duration-200', completing && 'opacity-40')}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={task.title || 'Edit task'}
        className="flex cursor-pointer items-start gap-3 rounded-lg py-3"
        onClick={() => { primeKeyboard(); setOpenId(task.id) }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); primeKeyboard(); setOpenId(task.id) } }}
      >
        <Check task={task} color="var(--p4)" checked={task.done || completing} onDone={done} />
        <div className="min-w-0 flex-1">
          <div className="break-words group-data-[done=true]/task:text-muted-foreground group-data-[done=true]/task:line-through">{task.title}</div>
          {task.description && !compact && (
            <div className="line-clamp-2 text-sm whitespace-pre-wrap text-muted-foreground">{task.description}</div>
          )}
          <Meta task={task} hideDue={hideDue} project={hideProject || (compact && !tag) ? undefined : p} tag={tag} />
        </div>
      </div>
    </div>
  )
}

function Meta({ task, hideDue, project, tag }: { task: Task; hideDue?: boolean; project?: { name: string; color: string }; tag?: boolean }) {
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
  if (task.repeat && !task.done) {
    items.push(
      <span key="repeat"><RepeatIcon />{repeatLabel(task.repeat)}</span>,
    )
  }
  if (project && tag) {
    items.unshift(
      <Badge key="proj" variant="tag" style={{ color: dim(project.color) }}>{project.name}</Badge>,
    )
  } else if (project) {
    items.push(
      <span key="proj"><span className="size-2 rounded-full" style={{ background: project.color }} />{project.name}</span>,
    )
  }
  if (!items.length) return null
  return <div className="mt-1 flex gap-3 text-xs text-muted-foreground [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1 [&_svg]:size-3">{items}</div>
}
