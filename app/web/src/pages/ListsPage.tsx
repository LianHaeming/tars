import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { CheckIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { localGet, localSet } from '@/lib/api'
import { dayDiff, parseYmd, shortDate, today, ymd } from '@/lib/dates'
import { byPriority, byTime, useListView, useTars } from '@/lib/store'
import { Dot, Empty, PillBar, Section, pill } from '@/components/common'
import { NameDialog } from '@/components/NameDialog'
import { Page } from '@/components/Page'
import { TaskRow } from '@/components/TaskRow'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

const BUILT_IN = ['today', 'inbox', 'completed']
const toView = (key: string) => (BUILT_IN.includes(key) ? key : 'project:' + key)

function ListTabs({ current }: { current: string }) {
  const { state, open, addProject } = useTars()
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()
  const t = ymd(today())
  const overdue = open.some(x => x.due && x.due < t)

  useEffect(() => { document.querySelector('[data-tab-on=true]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' }) }, [current])

  const tab = (key: string, label: ReactNode, n: number, lead?: ReactNode) => (
    <Link key={key} to={`/lists/${key}`} replace data-on={current === key} data-tab-on={current === key} className={pill}>
      {lead}{label}{n > 0 && <span className="text-xs tabular-nums opacity-60">{n}</span>}
    </Link>
  )

  return (
    <>
      <PillBar>
        {tab('today', 'Today', open.filter(x => x.due && x.due <= t).length, overdue ? <Dot color="var(--overdue)" /> : undefined)}
        {tab('inbox', 'Inbox', open.filter(x => !x.projectId).length)}
        {state.projects.map(p => tab(p.id, p.name, open.filter(x => x.projectId === p.id).length, <Dot color={p.color} />))}
        {tab('completed', 'Completed', 0, <CheckIcon className="size-3.5 text-today" />)}
        <button onClick={() => setAdding(true)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground">
          <PlusIcon className="size-3.5" />List
        </button>
      </PillBar>
      <NameDialog open={adding} onOpenChange={setAdding} title="New list" action="Create"
        onSubmit={async n => { const p = await addProject(n); navigate(`/lists/${p.id}`, { replace: true }) }} />
    </>
  )
}

export function ProjectTools({ id, name, after }: { id: string; name: string; after?: () => void }) {
  const { renameProject, deleteProject } = useTars()
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="List options"><MoreHorizontalIcon /></Button>
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
            <AlertDialogAction variant="destructive" onClick={async () => { await deleteProject(id); after?.() }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function ListBody() {
  const { view, viewInfo, rescheduleOverdue } = useTars()
  const v = viewInfo()
  const t = ymd(today())

  if (view === 'today') {
    const overdue = v.tasks.filter(x => x.due! < t).sort(byPriority)
    const due = v.tasks.filter(x => x.due === t).sort(byTime)
    return (
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
  }
  if (view === 'completed') {
    const done = [...v.tasks].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    let lastDay: string | null | undefined
    return (
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
  }
  const tasks = [...v.tasks].sort(byPriority)
  return (
    <>
      {tasks.map(x => <TaskRow key={x.id} task={x} hideProject={!!v.project} />)}
      {!tasks.length && <Empty icon={v.project ? '✨' : '📥'}>Nothing here. Tap Add task to add one.</Empty>}
    </>
  )
}

export function ListsPage() {
  const { key } = useParams()
  const { loaded, state, viewInfo } = useTars()
  const navigate = useNavigate()
  const current = key ?? ''
  const valid = BUILT_IN.includes(current) || state.projects.some(p => p.id === current)
  useListView(valid ? toView(current) : null)
  useEffect(() => { if (valid) localSet('view', current) }, [valid, current])

  if (!key) {
    const saved = localGet('view') || 'today'
    return <Navigate to={`/lists/${saved.replace(/^project:/, '')}`} replace />
  }
  if (!valid && loaded) return <Navigate to="/lists/today" replace />

  const v = viewInfo()
  return (
    <Page
      title="All lists"
      actions={v.project && <ProjectTools id={v.project.id} name={v.project.name} after={() => navigate('/lists/inbox', { replace: true })} />}
    >
      <ListTabs current={current} />
      {v.sub && <div className="py-1 text-sm text-muted-foreground">{v.sub}</div>}
      {valid && <ListBody />}
    </Page>
  )
}

export function ShoppingPage() {
  const { shoppingList } = useTars()
  useListView(shoppingList ? 'project:' + shoppingList.id : null)
  return (
    <Page title="Shopping" actions={<Button asChild variant="ghost" size="sm" className="text-primary"><Link to="/food/list">From Food</Link></Button>}>
      <div className="pt-2">{shoppingList && <ListBody />}</div>
    </Page>
  )
}
