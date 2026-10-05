import { useEffect, useRef, useState } from 'react'
import { CalendarIcon, ClockIcon, LayersIcon, TagIcon, Trash2Icon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/api'
import { dueLabel } from '@/lib/dates'
import { useTars } from '@/features/tasks/store'
import { Check } from '@/features/tasks/TaskRow'
import { Dot } from '@/components/common'
import { SubManager, TagManager } from '@/features/tasks/TagManager'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const tbtn = 'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors data-[on=true]:bg-secondary data-[on=true]:text-foreground [&_svg]:size-4'

const grow = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }

function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [])
  return inset
}

export function TaskSheet() {
  const { openId, state, setOpenId } = useTars()
  const task = openId ? state.tasks.find(t => t.id === openId) ?? null : null
  const [kept, setKept] = useState<Task | null>(null)
  const [open, setOpen] = useState(false)
  const inset = useKeyboardInset()

  useEffect(() => {
    if (task) { setKept(task); setOpen(true) }
    else if (open) {
      setOpen(false)
      const id = setTimeout(() => setKept(null), 320)
      return () => clearTimeout(id)
    }
  }, [task, open])

  const t = task ?? kept
  const close = () => { (document.activeElement as HTMLElement | null)?.blur(); setOpenId(null) }

  return (
    <>
      <div
        aria-hidden
        onClick={close}
        className={cn('fixed inset-0 z-40 bg-black/55 transition-opacity duration-300', open ? 'opacity-100' : 'pointer-events-none opacity-0')}
      />
      <div className="pointer-events-none fixed inset-x-0 z-50 mx-auto max-w-page" style={{ bottom: inset }}>
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            'chrome-bar hairline-t pointer-events-auto flex max-h-[86dvh] flex-col rounded-t-3xl pt-2 pb-safe-4 shadow-2xl transition-transform duration-300 ease-sheet',
            open ? 'translate-y-0' : 'translate-y-full',
          )}
        >
          <div className="mx-auto mb-1 h-1 w-9 shrink-0 rounded-full bg-white/20" />
          {t && <SheetBody key={t.id} task={t} onClose={close} />}
        </div>
      </div>
    </>
  )
}

function SheetBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const { patch, state, discardIfEmpty, subsOf, isDraft, deleteTask, toggleDone } = useTars()
  const [title, setTitle] = useState(task.title)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const subs = subsOf(task.projectId)
  const draft = isDraft(task.id)

  const saveTitle = () => {
    const t = title.trim()
    if (t && t !== task.title) patch(task.id, { title: t })
    else if (!t) setTitle(task.title)
  }

  useEffect(() => {
    if (draft) titleRef.current?.focus()
    return () => {
      const t = title.trim()
      if (t && t !== task.title) patch(task.id, { title: t })
      discardIfEmpty(task.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="group/task flex min-h-0 flex-col" data-done={task.done}>
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
        <div className="flex items-start gap-3 pt-1">
          {!draft && <Check task={task} color="var(--p4)" onDone={() => toggleDone(task.id)} />}
          <div className="min-w-0 flex-1">
            <textarea
              ref={el => { titleRef.current = el; grow(el) }}
              id="qa"
              value={title}
              rows={1}
              onChange={e => { setTitle(e.target.value); grow(e.currentTarget) }}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
              placeholder="Task"
              autoComplete="off"
              className="block w-full resize-none overflow-hidden rounded bg-transparent py-0 text-field leading-6 font-semibold break-words outline-none focus-visible:ring-2 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
            />
            <textarea
              ref={el => grow(el)}
              defaultValue={task.description}
              placeholder="Notes"
              rows={1}
              onInput={e => grow(e.currentTarget)}
              onBlur={e => { const v = e.target.value.trim(); if (v !== task.description) patch(task.id, { description: v }) }}
              className="mt-1 block w-full resize-none overflow-hidden rounded bg-transparent text-field text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="mt-3 -mx-2 flex flex-col gap-1 hairline-t px-2 pt-2">
          <div className="scrollbar-none flex gap-1 overflow-x-auto">
            <button type="button" data-on={!task.projectId} className={tbtn} onClick={() => patch(task.id, { projectId: null, subId: null })}>Inbox</button>
            {state.projects.map(pr => (
              <button key={pr.id} type="button" data-on={task.projectId === pr.id} className={tbtn} onClick={() => patch(task.id, { projectId: pr.id, subId: null })}>
                <Dot color={pr.color} />{pr.name}
              </button>
            ))}
            <TagManager
              onCreate={id => patch(task.id, { projectId: id, subId: null })}
              trigger={<button type="button" className={tbtn}><TagIcon />Tags</button>}
            />
          </div>

          {task.projectId && (
            <div className="scrollbar-none flex gap-1 overflow-x-auto">
              {subs.map(s => (
                <button key={s.id} type="button" data-on={task.subId === s.id} className={tbtn} onClick={() => patch(task.id, { subId: task.subId === s.id ? null : s.id })}>
                  {s.name}
                </button>
              ))}
              <SubManager
                projectId={task.projectId}
                onCreate={id => patch(task.id, { subId: id })}
                trigger={<button type="button" className={tbtn}><LayersIcon />{subs.length ? 'Edit' : 'Sub-categories'}</button>}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1">
            <label className={cn(tbtn, 'relative cursor-pointer')} data-on={!!task.due}>
              <CalendarIcon />{task.due ? dueLabel(task.due) : 'Add date'}
              <input type="date" value={task.due || ''} onChange={e => patch(task.id, { due: e.target.value || null, ...(e.target.value ? {} : { dueTime: null }) })} className="absolute inset-0 opacity-0" />
            </label>
            <label className={cn(tbtn, 'relative cursor-pointer')} data-on={!!task.dueTime}>
              <ClockIcon />{task.dueTime || 'Add time'}
              <input type="time" value={task.dueTime || ''} onChange={e => patch(task.id, { dueTime: e.target.value || null })} className="absolute inset-0 opacity-0" />
            </label>
            {(task.due || task.dueTime) && (
              <button type="button" className={tbtn} onClick={() => patch(task.id, { due: null, dueTime: null })}><XIcon />Clear</button>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 px-4 pt-3">
        {!draft && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="grid h-10 place-items-center rounded-full px-4 text-sm font-semibold text-destructive active:scale-98"
          >
            <span className="inline-flex items-center gap-2"><Trash2Icon className="size-4" />Delete</span>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto grid h-10 place-items-center rounded-full bg-foreground px-6 text-sm font-semibold text-background active:scale-98"
        >
          Done
        </button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {task.title.trim() || 'This task'} will be removed. You can still undo it from the bar afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteTask(task.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
