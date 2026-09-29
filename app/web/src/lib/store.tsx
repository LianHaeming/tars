import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { api, localGet, localSet, type Project, type State, type Task } from './api'
import { dueLabel, longDate, today, ymd } from './dates'

export type Panel = 'lists' | 'month' | 'shopping' | 'food'
export const LIST_PANELS: Panel[] = ['lists', 'month', 'shopping']
const PROJECT_COLORS = ['#dc4c3e', '#eb8909', '#fad000', '#7ecc49', '#299438', '#14aaf5', '#4073ff', '#884dff', '#e05194', '#808080']

export const isTaskView = (v: string) => ['today', 'inbox', 'completed'].includes(v) || v.startsWith('project:')

export const byPriority = (a: Task, b: Task) => a.priority - b.priority || (a.due || '9').localeCompare(b.due || '9') || a.createdAt - b.createdAt
export const byTime = (a: Task, b: Task) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99') || a.priority - b.priority || a.createdAt - b.createdAt
export const byWhen = (a: Task, b: Task) => a.due!.localeCompare(b.due!) || (a.dueTime || '').localeCompare(b.dueTime || '') || a.priority - b.priority

export type ViewInfo = { title: string; sub?: string; project?: Project; tasks: Task[]; defaults: Partial<Task> }

function useStoreValue() {
  const [state, setState] = useState<State>({ projects: [], tasks: [] })
  const [panel, setPanel] = useState<Panel | null>(null)
  const [view, setViewRaw] = useState(() => { const v = localGet('view'); return v && isTaskView(v) ? v : 'today' })
  const [openId, setOpenId] = useState<string | null>(null)
  const [calSel, setCalSel] = useState(() => ymd(today()))
  const [adding, setAdding] = useState(false)
  const [asking, setAsking] = useState(false)
  const [, setTick] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state

  const load = useCallback(async () => { setState(await api<State>('GET', 'state')) }, [])

  const open = useMemo(() => state.tasks.filter(t => !t.done), [state])
  const project = useCallback((id: string | null) => state.projects.find(p => p.id === id), [state])
  const shoppingList = state.projects.find(p => p.name === 'Shopping')

  function viewInfo(): ViewInfo {
    const t = ymd(today())
    if (view === 'inbox') return { title: 'Inbox', tasks: open.filter(x => !x.projectId), defaults: {} }
    if (view === 'today') return { title: 'Today', sub: longDate(today()), tasks: open.filter(x => x.due && x.due <= t), defaults: { due: t } }
    if (view === 'calendar') return { title: 'Month', tasks: open.filter(x => x.due === calSel), defaults: { due: calSel } }
    if (view === 'completed') return { title: 'Completed', tasks: state.tasks.filter(x => x.done), defaults: {} }
    if (view.startsWith('project:')) {
      const p = project(view.slice(8))
      if (p) return { title: p.name, project: p, tasks: open.filter(x => x.projectId === p.id), defaults: { projectId: p.id } }
    }
    return { title: 'Today', sub: longDate(today()), tasks: open.filter(x => x.due && x.due <= t), defaults: { due: t } }
  }
  const addDefaults = () => (panel && LIST_PANELS.includes(panel) ? viewInfo().defaults : {})

  function inView(task: Partial<Task>) {
    if (!panel || !LIST_PANELS.includes(panel)) return false
    const t = ymd(today())
    if (view === 'inbox') return !task.projectId
    if (view === 'today') return !!task.due && task.due <= t
    if (view === 'calendar') return task.due === calSel
    if (view.startsWith('project:')) return task.projectId === view.slice(8)
    return false
  }

  function setView(v: string) {
    setViewRaw(v)
    if (panel === 'lists') localSet('view', v)
    setOpenId(null)
  }

  async function openPanel(kind: Panel) {
    let list = shoppingList
    if (kind === 'shopping' && !list) {
      list = await api<Project>('POST', 'projects', { name: 'Shopping', color: '#25b84c' })
      await load()
    }
    setOpenId(null)
    if (kind === 'lists') { const v = localGet('view'); setViewRaw(v && isTaskView(v) ? v : 'today') }
    if (kind === 'month') setViewRaw('calendar')
    if (kind === 'shopping') setViewRaw('project:' + list!.id)
    setPanel(kind)
  }

  function openMonth(ds: string) {
    setCalSel(ds)
    openPanel('month')
  }

  function closePanel() {
    setPanel(null)
    setOpenId(null)
    load()
  }

  async function patch(id: string, fields: Partial<Task>) {
    setState(s => ({ ...s, tasks: s.tasks.map(t => (t.id === id ? { ...t, ...fields } : t)) }))
    await api('PATCH', 'tasks/' + id, fields)
  }

  async function addTask(task: Partial<Task>) {
    await api('POST', 'tasks', task)
    await load()
  }

  async function toggleDone(id: string) {
    const t = stateRef.current.tasks.find(x => x.id === id)!
    if (openId === id) setOpenId(null)
    await api('PATCH', 'tasks/' + id, { done: !t.done })
    await load()
    if (!t.done) toast('Completed', { action: { label: 'Undo', onClick: async () => { await api('PATCH', 'tasks/' + id, { done: false }); await load() } } })
  }

  async function deleteTask(id: string) {
    const copy = { ...stateRef.current.tasks.find(x => x.id === id)! }
    setOpenId(null)
    await api('DELETE', 'tasks/' + id)
    await load()
    toast('Deleted', { action: { label: 'Undo', onClick: async () => { await api('POST', 'tasks', copy); await load() } } })
  }

  async function rescheduleOverdue() {
    const t = ymd(today())
    const overdue = open.filter(x => x.due && x.due < t)
    await Promise.all(overdue.map(x => api('PATCH', 'tasks/' + x.id, { due: t })))
    await load()
    toast(`Moved ${overdue.length} to today`)
  }

  async function addProject(name: string) {
    const p = await api<Project>('POST', 'projects', { name, color: PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length] })
    await load()
    setView('project:' + p.id)
  }

  async function renameProject(id: string, name: string) {
    await api('PATCH', 'projects/' + id, { name })
    await load()
  }

  async function deleteProject(id: string) {
    await api('DELETE', 'projects/' + id)
    setView('inbox')
    await load()
  }

  const whereAdded = (task: Partial<Task>) =>
    task.projectId ? project(task.projectId)?.name ?? 'list' : task.due ? dueLabel(task.due) : 'Inbox'

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const editing = () => document.activeElement?.closest('input, textarea, select')
    const onVisible = () => { if (!document.hidden && !editing() && !openId) load() }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => { if (!document.hidden && !editing()) setTick(n => n + 1) }, 60000)
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(timer) }
  }, [load, openId])

  return {
    state, open, project, shoppingList, load,
    panel, openPanel, openMonth, closePanel,
    view, setView, viewInfo, addDefaults, inView,
    openId, setOpenId, calSel, setCalSel: (ds: string) => { setCalSel(ds); setOpenId(null) },
    adding, setAdding, asking, setAsking,
    patch, addTask, toggleDone, deleteTask, rescheduleOverdue, whereAdded,
    addProject, renameProject, deleteProject,
  }
}

export type Store = ReturnType<typeof useStoreValue>
const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={useStoreValue()}>{children}</Ctx.Provider>
}

export function useTars() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useTars outside StoreProvider')
  return s
}
