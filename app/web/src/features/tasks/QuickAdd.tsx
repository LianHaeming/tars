import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ArrowUpIcon, CalendarIcon, FlagIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/api'
import { dueColor, dueLabel, today, ymd } from '@/lib/dates'
import { parseQuickAdd } from '@/features/tasks/parse-quick-add'
import { useTars } from '@/features/tasks/store'
import { useKeyboardOffset } from '@/hooks/use-keyboard-offset'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function openQuickAdd(setAdding: (v: boolean) => void) {
  setAdding(true)
  document.getElementById('qa')?.focus()
}

export function QuickAdd() {
  const { adding, setAdding, state, addDefaults, addTask, inView, whereAdded, project } = useTars()
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const bottom = useKeyboardOffset()

  const p = parseQuickAdd(text, state.projects)
  const d = addDefaults()
  let due = p.due || (text.trim() ? d.due : undefined)
  if (p.dueTime && !due) due = ymd(today())
  const proj = project((p.projectId || d.projectId) ?? null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!p.title) return
    const task: Partial<Task> = { ...d, title: p.title }
    if (p.due) task.due = p.due
    if (p.priority) task.priority = p.priority
    if (p.projectId) task.projectId = p.projectId
    if (p.dueTime) { task.dueTime = p.dueTime; if (!task.due) task.due = ymd(today()) }
    setText('')
    input.current?.focus()
    await addTask(task)
    if (!inView(task)) toast(`Added to ${whereAdded(task)}`)
  }

  const close = () => { setAdding(false); input.current?.blur() }

  return (
    <>
      <div
        onClick={close}
        className={cn('fixed inset-0 z-60 bg-black/40 transition-opacity duration-200', adding ? 'opacity-100' : 'pointer-events-none opacity-0')}
      />
      <div
        style={{ bottom }}
        className={cn(
          'glass-strong fixed inset-x-0 z-61 mx-auto max-w-page rounded-t-2xl border-b-0 px-4 pt-4 pb-safe-3 shadow-2xl transition-transform duration-200 ease-sheet',
          adding ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <form onSubmit={submit} autoComplete="off" className="flex items-center gap-3">
          <input
            ref={input}
            id="qa"
            value={text}
            onChange={e => setText(e.target.value)}
            enterKeyHint="send"
            placeholder="Task name"
            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-lg font-semibold outline-0 placeholder:text-muted-foreground"
          />
          <Button type="submit" size="icon-lg" className="rounded-full" disabled={!p.title} aria-label="Add">
            <ArrowUpIcon className="size-5" strokeWidth={2.6} />
          </Button>
        </form>
        {(due || p.priority || (text.trim() && proj)) && (
          <div className="flex flex-wrap gap-2 pt-2 [&_svg]:size-3">
            {due && <Badge variant="secondary" style={{ color: dueColor(due) }}><CalendarIcon />{dueLabel(due)}{p.dueTime && ' · ' + p.dueTime}</Badge>}
            {p.priority && <Badge variant="secondary" style={{ color: `var(--p${p.priority})` }}><FlagIcon className="fill-current" />P{p.priority}</Badge>}
            {text.trim() && proj && <Badge variant="secondary"><span className="size-2 rounded-full" style={{ background: proj.color }} />{proj.name}</Badge>}
          </div>
        )}
      </div>
    </>
  )
}
