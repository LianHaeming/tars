import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dayDiff, parseYmd, shortDate, today, ymd } from '@/lib/dates'
import { byPriority, byTime, useTars } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { NameDialog } from './NameDialog'
import { TaskRow } from './TaskRow'

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-baseline justify-between border-b border-border pt-5 pb-1.5 text-[13px] font-bold', className)}>{children}</div>
}

export function Empty({ icon, children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="px-5 py-14 text-center text-muted-foreground">
      {icon && <div className="mb-1.5 text-4xl">{icon}</div>}
      {children}
    </div>
  )
}

function Tabs() {
  const { state, open, view, setView, addProject } = useTars()
  const [adding, setAdding] = useState(false)
  const bar = useRef<HTMLDivElement>(null)
  const t = ymd(today())
  const overdue = open.some(x => x.due && x.due < t)

  useEffect(() => { bar.current?.querySelector('[data-on=true]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' }) }, [view])

  const tab = (key: string, label: ReactNode, n: number, lead?: ReactNode) => (
    <button
      key={key}
      data-on={view === key}
      onClick={() => setView(key)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors data-[on=true]:bg-foreground data-[on=true]:text-background"
    >
      {lead}{label}{n > 0 && <span className="text-xs tabular-nums opacity-60">{n}</span>}
    </button>
  )
  const dot = (c: string) => <span className="size-2 rounded-full" style={{ background: c }} />

  return (
    <>
      <nav ref={bar} className="scrollbar-none sticky top-0 z-[2] -mx-4 flex gap-1.5 overflow-x-auto bg-sheet px-4 pt-3 pb-2.5">
        {tab('today', 'Today', open.filter(x => x.due && x.due <= t).length, overdue ? dot('var(--overdue)') : undefined)}
        {tab('inbox', 'Inbox', open.filter(x => !x.projectId).length)}
        {state.projects.map(p => tab('project:' + p.id, p.name, open.filter(x => x.projectId === p.id).length, dot(p.color)))}
        {tab('completed', 'Completed', 0, <CheckIcon className="size-3.5 text-today" />)}
        <button onClick={() => setAdding(true)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground">
          <PlusIcon className="size-3.5" />List
        </button>
      </nav>
      <NameDialog open={adding} onOpenChange={setAdding} title="New list" action="Create" onSubmit={addProject} />
    </>
  )
}

function ProjectTools({ id, name }: { id: string; name: string }) {
  const { renameProject, deleteProject } = useTars()
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="ml-auto text-muted-foreground" aria-label="List options"><MoreHorizontalIcon /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenaming(true)}><PencilIcon />Rename</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}><Trash2Icon />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NameDialog open={renaming} onOpenChange={setRenaming} title="Rename list" action="Save" initial={name} onSubmit={n => renameProject(id, n)} />
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
            <AlertDialogDescription>Its tasks move to Inbox.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteProject(id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function ListsView() {
  const { panel, view, viewInfo, rescheduleOverdue } = useTars()
  const v = viewInfo()
  const t = ymd(today())
  let body: ReactNode

  if (view === 'today') {
    const overdue = v.tasks.filter(x => x.due! < t).sort(byPriority)
    const due = v.tasks.filter(x => x.due === t).sort(byTime)
    body = (
      <>
        {overdue.length > 0 && (
          <>
            <Section className="text-overdue">
              <span>Overdue · {overdue.length}</span>
              <button className="font-medium text-primary" onClick={rescheduleOverdue}>Move all to today</button>
            </Section>
            {overdue.map(x => <TaskRow key={x.id} task={x} />)}
          </>
        )}
        {overdue.length > 0 && due.length > 0 && <Section><span>Today</span></Section>}
        {due.map(x => <TaskRow key={x.id} task={x} hideDue />)}
        {!v.tasks.length && <Empty icon="🎉">All clear for today.</Empty>}
      </>
    )
  } else if (view === 'completed') {
    const done = [...v.tasks].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    let lastDay: string | null | undefined
    body = (
      <>
        {done.map(x => {
          const day = x.completedAt ? ymd(new Date(x.completedAt)) : null
          const head = day !== lastDay
          lastDay = day
          const name = !day ? 'Earlier' : dayDiff(day) === 0 ? 'Today' : dayDiff(day) === -1 ? 'Yesterday' : parseYmd(day).toLocaleDateString(undefined, { weekday: 'long' })
          return (
            <div key={x.id}>
              {head && <Section><span>{name}{day && <span className="font-medium text-muted-foreground"> · {shortDate(parseYmd(day))}</span>}</span></Section>}
              <TaskRow task={x} hideDue />
            </div>
          )
        })}
        {!done.length && <Empty icon="✓">Nothing completed yet.</Empty>}
      </>
    )
  } else {
    const tasks = [...v.tasks].sort(byPriority)
    body = (
      <>
        {tasks.map(x => <TaskRow key={x.id} task={x} hideProject={!!v.project} />)}
        {!tasks.length && <Empty icon={v.project ? '✨' : '📥'}>Nothing here. Tap Add task to add one.</Empty>}
      </>
    )
  }

  return (
    <>
      {panel === 'lists' && <Tabs />}
      {(v.sub || v.project) && (
        <div className={cn('flex items-center gap-2.5 py-1', panel !== 'lists' && 'pt-3')}>
          {v.sub && <span className="text-sm text-muted-foreground">{v.sub}</span>}
          {v.project && <ProjectTools id={v.project.id} name={v.project.name} />}
        </div>
      )}
      {body}
    </>
  )
}
