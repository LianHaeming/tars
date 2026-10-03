import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CalendarIcon, CheckIcon, ClockIcon, TagIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/api'
import { dueColor, dueLabel, today, whenLabel, ymd } from '@/lib/dates'
import { useTars } from '@/features/tasks/store'
import { Dot, pill } from '@/components/common'
import { TagManager } from '@/features/tasks/TagManager'

type Opts = { hideProject?: boolean; hideDue?: boolean; compact?: boolean; tag?: boolean; forceEditor?: boolean }

function Check({ task, color, onDone }: { task: Task; color: string; onDone: () => void }) {
  return (
    <button
      type="button"
      aria-label={task.done ? 'Mark not done' : 'Complete'}
      style={{ '--pc': color } as CSSProperties}
      onClick={e => { e.stopPropagation(); onDone() }}
      className={cn(
        'group/check mt-px grid size-5 shrink-0 place-items-center rounded-full border-2 border-(--pc) bg-(--pc)/12 transition-colors',
        'group-data-[done=true]/task:bg-(--pc)',
      )}
    >
      <CheckIcon strokeWidth={3} className="size-3 text-(--pc) opacity-0 transition-opacity group-data-[done=true]/task:text-background group-data-[done=true]/task:opacity-100 [@media(hover:hover)]:group-hover/check:opacity-100" />
    </button>
  )
}

const checkColor = (_color?: string) => 'var(--p4)'

export function TaskRow({ task, hideProject, hideDue, compact, tag, forceEditor }: { task: Task } & Opts) {
  const { openId, setOpenId, toggleDone, project, dayView } = useTars()
  const [completing, setCompleting] = useState(false)
  const p = project(task.projectId)

  async function done() {
    if (!task.done) {
      setCompleting(true)
      navigator.vibrate?.(10)
      await new Promise(r => setTimeout(r, 200))
    }
    await toggleDone(task.id)
    setCompleting(false)
  }

  if (openId === task.id && (forceEditor || !dayView)) return <TaskEditor task={task} onDone={done} />

  return (
    <div
      data-task-row
      data-done={task.done || completing}
      className={cn('group/task hairline-b transition-opacity duration-200', completing && 'opacity-40')}
    >
      <div className="flex cursor-pointer items-start gap-3 py-3" onClick={() => setOpenId(task.id)}>
        <Check task={task} color={checkColor(p?.color)} onDone={done} />
        <div className="min-w-0 flex-1">
          <div className="break-words group-data-[done=true]/task:text-muted-foreground group-data-[done=true]/task:line-through">{task.title}</div>
          {task.description && !compact && (
            <div className="line-clamp-2 text-sm whitespace-pre-wrap text-muted-foreground">{task.description}</div>
          )}
          <Meta task={task} hideDue={hideDue} project={hideProject || (compact && !tag) ? undefined : p} tag={tag} />
        </div>
      </div>
    </div>
  )
}

function Meta({ task, hideDue, project, tag }: { task: Task; hideDue?: boolean; project?: { name: string; color: string }; tag?: boolean }) {
  const items = []
  if (task.due && !hideDue) {
    items.push(
      <span key="due" style={{ color: task.done ? undefined : dueColor(task.due) }}>
        <CalendarIcon />{whenLabel(task)}
      </span>,
    )
  } else if (task.dueTime) {
    items.push(
      <span key="time" style={{ color: task.done ? undefined : dueColor(task.due || ymd(today())) }}>
        <ClockIcon />{task.dueTime}
      </span>,
    )
  }
  if (project && tag) {
    items.unshift(<span key="proj" className="font-semibold tracking-wider uppercase" style={{ color: project.color }}>{project.name}</span>)
  } else if (project) {
    items.push(
      <span key="proj"><span className="size-2 rounded-full" style={{ background: project.color }} />{project.name}</span>,
    )
  }
  if (!items.length) return null
  return <div className="mt-1 flex gap-3 text-xs text-muted-foreground [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1 [&_svg]:size-3">{items}</div>
}

const chip = cn(pill, 'px-3 py-2 [&_svg]:size-4')

const grow = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }

function TaskEditor({ task, onDone }: { task: Task; onDone: () => void }) {
  const { patch, state, setOpenId, discardIfEmpty } = useTars()
  const [title, setTitle] = useState(task.title)
  const ref = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const p = state.projects.find(x => x.id === task.projectId)

  useEffect(() => {
    // new draft: focus the title and let the browser scroll it above the keyboard.
    // existing task: no keyboard, so bring the whole card into view ourselves.
    if (!task.title) {
      titleRef.current?.focus()
    } else {
      const id = requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
      return () => { cancelAnimationFrame(id); discardIfEmpty(task.id) }
    }
    return () => discardIfEmpty(task.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const away = (e: MouseEvent) => {
      const el = e.target as Element
      if (!el.isConnected || ref.current?.contains(el) || el.closest('[data-radix-popper-content-wrapper], [data-sonner-toaster], [data-task-row], [data-dock]')) return
      const dialog = el.closest('[role=dialog], [role=alertdialog]')
      if (dialog && !dialog.contains(ref.current)) return
      finish()
    }
    const t = setTimeout(() => document.addEventListener('click', away), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', away) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  const saveTitle = () => {
    const t = title.trim()
    if (t && t !== task.title) patch(task.id, { title: t })
    else if (!t) setTitle(task.title)
  }
  const finish = () => { saveTitle(); setOpenId(null) }

  return (
    <div ref={ref} data-editor data-done={task.done} className="group/task -mx-3 my-2 scroll-mb-dock rounded-xl bg-muted px-3 pb-3">
      <div className="flex items-start gap-3 pt-3">
        <Check task={task} color={checkColor(p?.color)} onDone={onDone} />
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
            className="block w-full resize-none overflow-hidden bg-transparent py-0 text-field leading-6 font-semibold break-words outline-none placeholder:text-muted-foreground"
          />
          <textarea
            ref={el => grow(el)}
            defaultValue={task.description}
            placeholder="Notes"
            rows={1}
            onInput={e => grow(e.currentTarget)}
            onBlur={e => { const v = e.target.value.trim(); if (v !== task.description) patch(task.id, { description: v }) }}
            className="mt-2 block w-full resize-none overflow-hidden rounded-lg bg-background/60 px-3 py-2 text-field text-muted-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="scrollbar-none mt-3 ml-8 flex gap-2 overflow-x-auto">
        <button type="button" data-on={!task.projectId} className={chip} onClick={() => patch(task.id, { projectId: null })}>Inbox</button>
        {state.projects.map(pr => (
          <button key={pr.id} type="button" data-on={task.projectId === pr.id} className={chip} onClick={() => patch(task.id, { projectId: pr.id })}>
            <Dot color={pr.color} />{pr.name}
          </button>
        ))}
        <TagManager
          onCreate={id => patch(task.id, { projectId: id })}
          trigger={<button type="button" className={cn(chip, 'text-muted-foreground')}><TagIcon />Tags</button>}
        />
      </div>

      <div className="mt-2 ml-8 flex flex-wrap items-center gap-2">
        <label className={cn(chip, 'relative cursor-pointer')} data-on={!!task.due}>
          <CalendarIcon />{task.due ? dueLabel(task.due) : 'Add date'}
          <input type="date" value={task.due || ''} onChange={e => patch(task.id, { due: e.target.value || null, ...(e.target.value ? {} : { dueTime: null }) })} className="absolute inset-0 opacity-0" />
        </label>
        <label className={cn(chip, 'relative cursor-pointer')} data-on={!!task.dueTime}>
          <ClockIcon />{task.dueTime || 'Add time'}
          <input type="time" value={task.dueTime || ''} onChange={e => patch(task.id, { dueTime: e.target.value || null })} className="absolute inset-0 opacity-0" />
        </label>
        {(task.due || task.dueTime) && (
          <button type="button" className={cn(chip, 'text-muted-foreground')} onClick={() => patch(task.id, { due: null, dueTime: null })}><XIcon />Clear</button>
        )}
      </div>
    </div>
  )
}
