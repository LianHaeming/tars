import { useState } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/api'
import { useTars } from '@/features/tasks/store'
import { TaskRow } from '@/features/tasks/TaskRow'
import { Button } from '@/components/ui/button'

export function MainEvent({ task }: { task: Task }) {
  const { openId, setOpenId, toggleDone } = useTars()
  const [expanded, setExpanded] = useState(false)

  if (openId === task.id) return <TaskRow task={task} />

  const notes = task.description.trim()
  return (
    <div className="my-2 rounded-2xl border border-primary/40 bg-primary/10">
      <button type="button" onClick={() => setExpanded(e => !e)} aria-expanded={expanded} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate font-semibold">{task.title}</b>
          {notes && !expanded && <span className="block truncate text-sm text-muted-foreground">{notes.split('\n')[0]}</span>}
        </span>
        <span className="text-sm font-semibold tabular-nums">{task.dueTime}</span>
        <ChevronRightIcon className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-150', expanded && 'rotate-90')} />
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {notes && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{notes}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => toggleDone(task.id)}>Mark done</Button>
            <Button size="sm" variant="secondary" onClick={() => setOpenId(task.id)}>Edit</Button>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setExpanded(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  )
}
