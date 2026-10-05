import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { CalendarIcon, CheckIcon, ChevronRightIcon, ClockIcon, LayersIcon, TagIcon, Trash2Icon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/api'
import { dueLabel } from '@/lib/dates'
import { useTars } from '@/features/tasks/store'
import { Dot } from '@/components/common'
import { SubManager, TagManager } from '@/features/tasks/TagManager'
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const grow = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }

export function TaskSheet() {
  const { openId, state, setOpenId, isDraft } = useTars()
  const task = openId ? state.tasks.find(t => t.id === openId) ?? null : null
  const [kept, setKept] = useState<Task | null>(null)
  useEffect(() => { if (task) setKept(task) }, [task])
  const t = task ?? kept
  const active = !!task

  // Keep the card sized to the area above the keyboard: top stays fixed, only the
  // bottom edge follows visualViewport, so the body scrolls instead of the card moving.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv || !active) return
    const set = () => document.documentElement.style.setProperty('--vvh', vv.height + 'px')
    set()
    vv.addEventListener('resize', set)
    vv.addEventListener('scroll', set)
    return () => {
      vv.removeEventListener('resize', set)
      vv.removeEventListener('scroll', set)
      document.documentElement.style.removeProperty('--vvh')
    }
  }, [active])

  const close = () => { (document.activeElement as HTMLElement | null)?.blur(); setOpenId(null) }

  return (
    <Dialog open={!!task} onOpenChange={o => { if (!o) close() }}>
      <DialogPortal>
        <DialogOverlay className="bg-black/55" />
        <DialogPrimitive.Content
          onOpenAutoFocus={e => e.preventDefault()}
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-safe-6 z-50 flex w-[calc(100%-1.5rem)] max-w-page -translate-x-1/2 flex-col overflow-hidden rounded-3xl bg-popover text-popover-foreground ring-1 ring-foreground/10 shadow-2xl outline-none',
            'duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          )}
          style={{ height: 'calc(var(--vvh, 100dvh) - env(safe-area-inset-top) - 3rem)' }}
        >
          <DialogPrimitive.Title className="sr-only">{t && isDraft(t.id) ? 'New task' : 'Edit task'}</DialogPrimitive.Title>
          {t && <SheetBody key={t.id} task={t} onClose={close} />}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

const row = 'flex w-full items-center gap-3 px-4 py-3 text-left text-base [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground'
const bare = 'min-h-0 resize-none overflow-hidden rounded-none border-0 bg-transparent px-0 py-0 focus-visible:border-transparent focus-visible:ring-0'

function SheetBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const { patch, state, project, discardIfEmpty, subsOf, isDraft, deleteTask } = useTars()
  const [title, setTitle] = useState(task.title)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [picker, setPicker] = useState<null | 'list' | 'sub'>(null)
  const draft = isDraft(task.id)
  const p = project(task.projectId)
  const subs = subsOf(task.projectId)
  const sub = subs.find(s => s.id === task.subId)

  useEffect(() => {
    const el = titleRef.current
    el?.focus()
    el?.setSelectionRange(el.value.length, el.value.length)
    return () => {
      const t = title.trim()
      if (t && t !== task.title) patch(task.id, { title: t })
      discardIfEmpty(task.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveTitle = () => {
    const t = title.trim()
    if (t && t !== task.title) patch(task.id, { title: t })
    else if (!t) setTitle(task.title)
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 hairline-b px-2 py-2">
        {draft ? (
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-full text-base font-normal text-muted-foreground">Cancel</Button>
        ) : (
          <Button type="button" variant="ghost" size="icon" aria-label="Delete task" onClick={() => setConfirmDelete(true)} className="rounded-full text-destructive hover:bg-secondary hover:text-destructive [&_svg]:size-5">
            <Trash2Icon />
          </Button>
        )}
        <span className="flex-1 text-center text-sm font-semibold text-muted-foreground">{draft ? 'New task' : 'Edit task'}</span>
        <Button type="button" size="lg" onClick={onClose} className="rounded-full px-5">Done</Button>
      </div>

      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-5">
        <div className="mt-3 overflow-hidden rounded-2xl bg-secondary">
          <div className="px-4 pt-3 pb-2.5">
            <Textarea
              ref={el => { titleRef.current = el; grow(el) }}
              id="qa"
              value={title}
              rows={1}
              onChange={e => { setTitle(e.target.value); grow(e.currentTarget) }}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
              placeholder="Task"
              autoComplete="off"
              className={cn(bare, 'text-lg leading-6 font-semibold break-words')}
            />
          </div>
          <div className="hairline-t px-4 py-2.5">
            <Textarea
              ref={el => grow(el)}
              defaultValue={task.description}
              placeholder="Notes"
              rows={1}
              onInput={e => grow(e.currentTarget)}
              onBlur={e => { const v = e.target.value.trim(); if (v !== task.description) patch(task.id, { description: v }) }}
              className={cn(bare, 'text-field text-muted-foreground')}
            />
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl bg-secondary">
          <DateRow first icon={<CalendarIcon />} label="Date" value={task.due ? dueLabel(task.due) : null} tone="var(--today)" type="date" current={task.due || ''}
            onChange={v => patch(task.id, { due: v || null, ...(v ? {} : { dueTime: null }) })}
            onClear={task.due ? () => patch(task.id, { due: null, dueTime: null }) : undefined} />
          <DateRow icon={<ClockIcon />} label="Time" value={task.dueTime || null} tone="var(--today)" type="time" current={task.dueTime || ''}
            onChange={v => patch(task.id, { dueTime: v || null })}
            onClear={task.dueTime ? () => patch(task.id, { dueTime: null }) : undefined} />

          <Collapsible open={picker === 'list'} onOpenChange={o => setPicker(o ? 'list' : null)}>
            <CollapsibleTrigger className={cn(row, 'group hairline-t')}>
              <TagIcon /><span>List</span>
              <span className="ml-auto flex items-center gap-2 font-semibold">
                {p ? <><Dot color={p.color} />{p.name}</> : <span className="text-muted-foreground">Inbox</span>}
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground/60 transition-transform group-data-[state=open]:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent className="hairline-t bg-background/30">
              <PickRow selected={!task.projectId} onClick={() => { patch(task.id, { projectId: null, subId: null }); setPicker(null) }}>Inbox</PickRow>
              {state.projects.map(pr => (
                <PickRow key={pr.id} selected={task.projectId === pr.id} onClick={() => { patch(task.id, { projectId: pr.id, subId: null }); setPicker(null) }}>
                  <Dot color={pr.color} />{pr.name}
                </PickRow>
              ))}
              <TagManager
                onCreate={id => { patch(task.id, { projectId: id, subId: null }); setPicker(null) }}
                trigger={<Button type="button" variant="ghost" className="h-auto w-full justify-start gap-2 rounded-none px-4 py-2.5 text-base font-semibold text-primary hover:text-primary [&_svg]:size-4"><TagIcon />Edit lists…</Button>}
              />
            </CollapsibleContent>
          </Collapsible>

          {task.projectId && (
            <Collapsible open={picker === 'sub'} onOpenChange={o => setPicker(o ? 'sub' : null)}>
              <CollapsibleTrigger className={cn(row, 'group hairline-t')}>
                <LayersIcon /><span>Sub-category</span>
                <span className="ml-auto font-semibold">{sub ? sub.name : <span className="text-muted-foreground">None</span>}</span>
                <ChevronRightIcon className="size-4 text-muted-foreground/60 transition-transform group-data-[state=open]:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent className="hairline-t bg-background/30">
                <PickRow selected={!task.subId} onClick={() => { patch(task.id, { subId: null }); setPicker(null) }}>None</PickRow>
                {subs.map(s => (
                  <PickRow key={s.id} selected={task.subId === s.id} onClick={() => { patch(task.id, { subId: s.id }); setPicker(null) }}>{s.name}</PickRow>
                ))}
                <SubManager
                  projectId={task.projectId}
                  onCreate={id => { patch(task.id, { subId: id }); setPicker(null) }}
                  trigger={<Button type="button" variant="ghost" className="h-auto w-full justify-start gap-2 rounded-none px-4 py-2.5 text-base font-semibold text-primary hover:text-primary [&_svg]:size-4"><LayersIcon />{subs.length ? 'Edit…' : 'Add sub-category…'}</Button>}
                />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
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

function DateRow({ icon, label, value, tone, type, current, onChange, onClear, first }: {
  icon: ReactNode; label: string; value: string | null; tone: string
  type: 'date' | 'time'; current: string; onChange: (v: string) => void; onClear?: () => void; first?: boolean
}) {
  return (
    <label className={cn(row, 'relative', !first && 'hairline-t')}>
      {icon}<span>{label}</span>
      <span className="ml-auto font-semibold" style={{ color: value ? tone : undefined }}>
        {value ?? <span className="text-muted-foreground">None</span>}
      </span>
      {onClear ? (
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Clear ${label.toLowerCase()}`} onClick={onClear} className="relative z-10 rounded-full text-muted-foreground hover:bg-secondary [&_svg]:size-3.5">
          <XIcon />
        </Button>
      ) : (
        <ChevronRightIcon className="size-4 text-muted-foreground/60" />
      )}
      <input type={type} value={current} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0" />
    </label>
  )
}

function PickRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="ghost" onClick={onClick} className="h-auto w-full justify-start gap-2 rounded-none px-4 py-2.5 text-left text-base font-normal">
      <span className="flex flex-1 items-center gap-2">{children}</span>
      {selected && <CheckIcon className="size-4 text-primary" />}
    </Button>
  )
}
