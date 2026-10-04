import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { BotIcon, CircleCheckIcon, LayoutGridIcon, MenuIcon, PlusIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuickAdd, useTars } from '@/features/tasks/store'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export const showsDock = (path: string) => path === '/' || /^\/(apps|food)(\/|$)/.test(path)
export const hasTaskList = (path: string) => path === '/'

export function focusDraft() {
  document.getElementById('qa')?.focus()
}

export function Dock() {
  const { openId, setOpenId, deleteTask, flash, state, exitDay } = useTars()
  const quickAdd = useQuickAdd()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const hidden = !showsDock(pathname)
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => { if (hidden) setOpen(false) }, [hidden])

  const add = () => quickAdd(hasTaskList(pathname))
  const tab = hidden ? -1 : 0
  const onSchedule = pathname === '/'
  const seg = (on: boolean) => cn('relative z-10 grid h-10 w-14 place-items-center rounded-full transition-colors duration-200 [&_svg]:size-5', on ? 'text-background' : 'text-muted-foreground')

  const editing = !hidden && !!openId
  const showUndo = !editing && !!flash
  const doneEditing = () => { (document.activeElement as HTMLElement | null)?.blur(); setOpenId(null) }
  const barPrimary = 'grid h-10 place-items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background active:scale-98 animate-in fade-in duration-200'
  const barGhost = 'grid h-10 place-items-center rounded-full px-4 text-sm font-semibold text-destructive active:scale-98 animate-in fade-in duration-200'

  const actions = [
    { key: 'tars', label: 'Tars', Icon: BotIcon, run: () => navigate('/tars') },
    { key: 'add', label: 'Add task', Icon: PlusIcon, run: add },
  ]

  return (
    <nav
      data-dock
      className={cn(
        'pointer-events-none fixed inset-x-4 bottom-safe-2 z-30 mx-auto flex max-w-page items-center justify-between transition-[translate,opacity] duration-200',
        hidden && 'translate-y-full opacity-0',
      )}
    >
      <div aria-hidden className="size-12 shrink-0" />
      <div className={cn('dock relative flex items-center gap-1 rounded-full p-1', !hidden && 'pointer-events-auto')}>
        {editing ? (
          <>
            <button type="button" onClick={doneEditing} className={barPrimary}>Done</button>
            <button type="button" onClick={() => setConfirmDelete(true)} className={barGhost}>Delete</button>
          </>
        ) : showUndo ? (
          <>
            <span className="grid h-10 place-items-center px-3 text-sm font-semibold text-muted-foreground animate-in fade-in duration-200">{flash!.label}</span>
            <button type="button" onClick={flash!.run} className={barPrimary}>Undo</button>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className="absolute left-1 top-1 h-10 w-14 rounded-full bg-foreground shadow-sm transition-transform duration-300 ease-spring"
              style={{ transform: onSchedule ? 'translateX(0)' : 'translateX(calc(100% + 0.25rem))' }}
            />
            <Link to="/" onClick={exitDay} aria-label="Schedule" aria-current={onSchedule ? 'page' : undefined} tabIndex={tab} className={seg(onSchedule)}><CircleCheckIcon /></Link>
            <Link to="/apps" onClick={exitDay} aria-label="Apps" aria-current={onSchedule ? undefined : 'page'} tabIndex={tab} className={seg(!onSchedule)}><LayoutGridIcon /></Link>
          </>
        )}
      </div>
      <div className={cn('relative shrink-0', !hidden && 'pointer-events-auto')}>
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className={cn('fixed inset-0 -z-10 transition-opacity duration-200', open ? 'opacity-100' : 'pointer-events-none opacity-0')}
        />
        <div className="absolute bottom-full right-0 mb-3 flex flex-col items-end gap-3">
          {actions.map((a, i) => (
            <button
              key={a.key}
              type="button"
              tabIndex={open ? tab : -1}
              aria-label={a.label}
              onClick={() => { setOpen(false); a.run() }}
              className={cn(
                'dock grid size-12 place-items-center rounded-full text-foreground transition-[transform,opacity] duration-200 ease-sheet active:scale-98 [&_svg]:size-5',
                open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
              )}
              style={{ transitionDelay: open ? `${i * 40}ms` : '0ms' }}
            >
              <a.Icon />
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label={open ? 'Close actions' : 'Open actions'}
          aria-expanded={open}
          tabIndex={tab}
          onClick={() => setOpen(v => !v)}
          className="dock grid size-12 place-items-center rounded-full text-foreground transition-colors active:scale-98 [&_svg]:size-5"
        >
          {open ? <XIcon /> : <MenuIcon />}
        </button>
      </div>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {state.tasks.find(t => t.id === openId)?.title?.trim() || 'This task'} will be removed. You can still undo it from the bar afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { if (openId) deleteTask(openId) }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  )
}
