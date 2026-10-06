import { useState } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { cn, primeKeyboard } from '@tars/ui/lib/utils'
import type { Task } from '@/lib/types'
import { useTars } from '@/features/tasks/store'
import { Button } from '@tars/ui/components/ui/button'
import { Card } from '@tars/ui/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@tars/ui/components/ui/collapsible'

export function MainEvent({ task }: { task: Task }) {
  const { setOpenId, toggleDone } = useTars()
  const [expanded, setExpanded] = useState(false)

  const notes = task.description.trim()
  return (
    <Card size="sm" className="my-2 gap-0 border border-primary/40 bg-primary/10 py-0 ring-0">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left">
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
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          {notes && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{notes}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => toggleDone(task.id)}>Mark done</Button>
            <Button size="sm" variant="secondary" onClick={() => { primeKeyboard(); setOpenId(task.id) }}>Edit</Button>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setExpanded(false)}>Close</Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
