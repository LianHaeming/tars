import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { api, localGet } from '@tars/ui/lib/api'
import type { Project, State, Task } from '@/lib/types'
import { primeKeyboard } from '@tars/ui/lib/utils'
import { today, ymd } from '@tars/ui/lib/dates'

const PROJECT_COLORS = ['#3fa9f5', '#ff7a59', '#c77dff', '#fad000', '#ff5fa2', '#4cc38a', '#7f8cff', '#eb8909', '#808080']

export const byCreated = (a: Task, b: Task) => (a.due || '9').localeCompare(b.due || '9') || a.createdAt - b.createdAt
export const byTime = (a: Task, b: Task) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99') || a.createdAt - b.createdAt
export const byWhen = (a: Task, b: Task) => a.due!.localeCompare(b.due!) || (a.dueTime || '').localeCompare(b.dueTime || '') || a.createdAt - b.createdAt

function useStoreValue() {
  const [state, setState] = useState<State>({ projects: [], tasks: [] })
  const [loaded, setLoaded] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [calSel, setCalSel] = useState(() => ymd(today()))
  const [calMonth, setCalMonth] = useState(() => ymd(today()).slice(0, 7))
  const [dayView, setDayView] = useState(false)
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
  const creating = useRef(new Map<string, Promise<unknown>>())

  const load = useCallback(async () => { setState(await api<State>('GET', 'state')); setLoaded(true) }, [])

  const open = useMemo(() => state.tasks.filter(t => !t.done), [state])
  const project = useCallback((id: string | null) => state.projects.find(p => p.id === id), [state])
  const shoppingList = state.projects.find(p => p.name === 'Shopping')

  const creatingShopping = useRef(false)
  useEffect(() => {
    if (!loaded || shoppingList || creatingShopping.current) return
    creatingShopping.current = true
    api('POST', 'projects', { name: 'Shopping', color: '#ff7a59' }).then(load).finally(() => { creatingShopping.current = false })
  }, [loaded, shoppingList, load])

  async function patch(id: string, fields: Partial<Task>) {
    setState(s => ({ ...s, tasks: s.tasks.map(t => (t.id === id ? { ...t, ...fields } : t)) }))
    if (draftIds.current.has(id) && !persisted.current.has(id)) {
      persisted.current.add(id)
      const task = { ...stateRef.current.tasks.find(t => t.id === id), ...fields }
      const p = api('POST', 'tasks', task)
      creating.current.set(id, p)
      try { await p } finally { creating.current.delete(id) }
    } else {
      const pending = creating.current.get(id)
      if (pending) await pending
      await api('PATCH', 'tasks/' + id, fields)
    }
  }

  function addDraft() {
    const id = crypto.randomUUID()
    const defaults: Partial<Task> = {}
    const f = localGet('home-filter')
    if (f && state.projects.some(p => p.id === f)) defaults.projectId = f
    if (dayView && defaults.due == null) defaults.due = calSel
    const task: Task = { id, title: '', description: '', due: null, dueTime: null, projectId: null, subId: null, done: false, createdAt: Date.now(), completedAt: null, ...defaults }
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

  const subsOf = (projectId: string | null) => (projectId ? project(projectId)?.subs ?? [] : [])

  async function saveSubs(projectId: string, subs: { id: string; name: string }[]) {
    await api('PATCH', 'projects/' + projectId, { subs })
    await load()
  }

  async function addSub(projectId: string, name: string) {
    const sub = { id: crypto.randomUUID(), name }
    await saveSubs(projectId, [...subsOf(projectId), sub])
    return sub
  }

  const renameSub = (projectId: string, subId: string, name: string) =>
    saveSubs(projectId, subsOf(projectId).map(s => (s.id === subId ? { ...s, name } : s)))

  const deleteSub = (projectId: string, subId: string) =>
    saveSubs(projectId, subsOf(projectId).filter(s => s.id !== subId))

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
    openId, setOpenId, calSel, setCalSel: (ds: string) => { setCalSel(ds); setOpenId(null) }, pickDay: (ds: string) => setCalSel(ds),
    dayView, enterDay: (ds: string) => { setCalSel(ds); setDayView(true) }, exitDay: () => { setDayView(false); setOpenId(null) }, closeDay: () => setDayView(false),
    calMonth, setCalMonth,
    pendingAdd, setPendingAdd, flash, clearFlash,
    patch, addDraft, discardIfEmpty, toggleDone, deleteTask, rescheduleOverdue,
    isDraft: (id: string | null) => !!id && draftIds.current.has(id),
    addProject, renameProject, deleteProject,
    subsOf, addSub, renameSub, deleteSub,
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

export function useQuickAdd() {
  const { addDraft } = useTars()
  return useCallback(() => { primeKeyboard(); addDraft() }, [addDraft])
}
