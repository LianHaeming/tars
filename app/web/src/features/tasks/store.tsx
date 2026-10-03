import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { api, localGet, type Project, type State, type Task } from '@/lib/api'
import { dueLabel, longDate, today, ymd } from '@/lib/dates'

const PROJECT_COLORS = ['#dc4c3e', '#eb8909', '#fad000', '#7ecc49', '#299438', '#14aaf5', '#4073ff', '#884dff', '#e05194', '#808080']

export const byPriority = (a: Task, b: Task) => a.priority - b.priority || (a.due || '9').localeCompare(b.due || '9') || a.createdAt - b.createdAt
export const byTime = (a: Task, b: Task) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99') || a.priority - b.priority || a.createdAt - b.createdAt
export const byWhen = (a: Task, b: Task) => a.due!.localeCompare(b.due!) || (a.dueTime || '').localeCompare(b.dueTime || '') || a.priority - b.priority

export type ViewInfo = { title: string; sub?: string; project?: Project; tasks: Task[]; defaults: Partial<Task> }

function useStoreValue() {
  const [state, setState] = useState<State>({ projects: [], tasks: [] })
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [calSel, setCalSel] = useState(() => ymd(today()))
  const [dayView, setDayView] = useState(false)
  const [adding, setAdding] = useState(false)
  const [pendingAdd, setPendingAdd] = useState(false)
  const [flash, setFlash] = useState<{ label: string; run: () => void } | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [, setTick] = useState(0)

  const flashUndo = useCallback((label: string, run: () => void | Promise<void>) => {
    clearTimeout(flashTimer.current)
    setFlash({ label, run: () => { clearTimeout(flashTimer.current); setFlash(null); run() } })
    flashTimer.current = setTimeout(() => setFlash(null), 6000)
  }, [])
  const clearFlash = useCallback(() => { clearTimeout(flashTimer.current); setFlash(null) }, [])
  const stateRef = useRef(state)
  stateRef.current = state
  const draftIds = useRef(new Set<string>())
  const persisted = useRef(new Set<string>())

  const load = useCallback(async () => { setState(await api<State>('GET', 'state')); setLoaded(true) }, [])

  const open = useMemo(() => state.tasks.filter(t => !t.done), [state])
  const project = useCallback((id: string | null) => state.projects.find(p => p.id === id), [state])
  const shoppingList = state.projects.find(p => p.name === 'Shopping')

  function viewInfo(): ViewInfo {
    const t = ymd(today())
    if (view === 'inbox') return { title: 'Inbox', tasks: open.filter(x => !x.projectId), defaults: {} }
    if (view === 'today') return { title: 'Today', sub: longDate(today()), tasks: open.filter(x => x.due && x.due <= t), defaults: { due: t } }
    if (view === 'calendar') return { title: 'Month', tasks: open.filter(x => x.due === calSel), defaults: { due: calSel } }
    if (view === 'completed') return { title: 'Completed', tasks: state.tasks.filter(x => x.done), defaults: {} }
    if (view?.startsWith('project:')) {
      const p = project(view.slice(8))
      if (p) return { title: p.name, project: p, tasks: open.filter(x => x.projectId === p.id), defaults: { projectId: p.id } }
    }
    return { title: 'Today', sub: longDate(today()), tasks: open.filter(x => x.due && x.due <= t), defaults: { due: t } }
  }
  const addDefaults = () => (view ? viewInfo().defaults : {})

  function inView(task: Partial<Task>) {
    if (!view) return false
    const t = ymd(today())
    if (view === 'inbox') return !task.projectId
    if (view === 'today') return !!task.due && task.due <= t
    if (view === 'calendar') return task.due === calSel
    if (view.startsWith('project:')) return task.projectId === view.slice(8)
    return false
  }

  const creatingShopping = useRef(false)
  useEffect(() => {
    if (!loaded || shoppingList || creatingShopping.current) return
    creatingShopping.current = true
    api('POST', 'projects', { name: 'Shopping', color: '#25b84c' }).then(load).finally(() => { creatingShopping.current = false })
  }, [loaded, shoppingList, load])

  async function patch(id: string, fields: Partial<Task>) {
    setState(s => ({ ...s, tasks: s.tasks.map(t => (t.id === id ? { ...t, ...fields } : t)) }))
    if (draftIds.current.has(id) && !persisted.current.has(id)) {
      persisted.current.add(id)
      const task = { ...stateRef.current.tasks.find(t => t.id === id), ...fields }
      await api('POST', 'tasks', task)
    } else {
      await api('PATCH', 'tasks/' + id, fields)
    }
  }

  function addDraft() {
    const id = crypto.randomUUID()
    const defaults = addDefaults()
    if (!view) {
      const f = localGet('home-filter')
      if (f && state.projects.some(p => p.id === f)) defaults.projectId = f
    }
    if (dayView && defaults.due == null) defaults.due = calSel
    const task: Task = { id, title: '', description: '', due: null, dueTime: null, priority: 4, projectId: null, done: false, createdAt: Date.now(), completedAt: null, ...defaults }
    draftIds.current.add(id)
    setState(s => ({ ...s, tasks: [...s.tasks, task] }))
    setOpenId(id)
    return id
  }

  function discardIfEmpty(id: string) {
    if (!draftIds.current.has(id)) return
    const t = stateRef.current.tasks.find(x => x.id === id)
    if (t && (t.title.trim() || (t.description || '').trim())) return
    draftIds.current.delete(id)
    setState(s => ({ ...s, tasks: s.tasks.filter(x => x.id !== id) }))
    if (persisted.current.has(id)) { persisted.current.delete(id); api('DELETE', 'tasks/' + id) }
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
    if (!t.done) flashUndo('Completed', async () => { await api('PATCH', 'tasks/' + id, { done: false }); await load() })
  }

  async function deleteTask(id: string) {
    const copy = { ...stateRef.current.tasks.find(x => x.id === id)! }
    setOpenId(null)
    await api('DELETE', 'tasks/' + id)
    await load()
    flashUndo('Deleted', async () => { await api('POST', 'tasks', copy); await load() })
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
    return p
  }

  async function renameProject(id: string, name: string) {
    await api('PATCH', 'projects/' + id, { name })
    await load()
  }

  async function deleteProject(id: string) {
    await api('DELETE', 'projects/' + id)
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
    loaded, state, open, project, shoppingList, load,
    view, setView, viewInfo, addDefaults, inView,
    openId, setOpenId, calSel, setCalSel: (ds: string) => { setCalSel(ds); setOpenId(null) }, pickDay: (ds: string) => setCalSel(ds),
    dayView, enterDay: (ds: string) => { setCalSel(ds); setDayView(true) }, exitDay: () => { setDayView(false); setOpenId(null) }, closeDay: () => setDayView(false),
    adding, setAdding, pendingAdd, setPendingAdd, flash, clearFlash,
    patch, addTask, addDraft, discardIfEmpty, toggleDone, deleteTask, rescheduleOverdue, whereAdded,
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

export function useListView(v: string | null) {
  const { setView, setOpenId } = useTars()
  useEffect(() => {
    setView(v)
    setOpenId(null)
    return () => setView(null)
  }, [v, setView, setOpenId])
}
