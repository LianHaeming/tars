import { useState } from 'react'
import { CheckIcon, Loader2Icon, WandSparklesIcon, XIcon } from 'lucide-react'
import { dueLabel } from '@/lib/dates'
import { useTars } from '@/features/tasks/store'
import { Button } from '@/components/ui/button'
import { Dot } from '@/components/common'
import { useOrganise, type Suggestion } from './organise'

const changeLine = (s: Suggestion) => {
  const parts: string[] = []
  if (s.change.projectId) parts.push(`move to ${s.listName}`)
  if (s.change.due) parts.push(`do ${dueLabel(s.change.due).toLowerCase()}`)
  return parts.join(' · ')
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="glass mb-3 rounded-2xl px-4 py-3">{children}</div>
}

export function OrganiseCard() {
  const { state, patch, project } = useTars()
  const { suggestions, loading, error, load, reset } = useOrganise()
  const [idx, setIdx] = useState(0)
  const [applied, setApplied] = useState(0)

  const loose = state.tasks.filter(t => !t.done && (!t.projectId || !t.due)).length
  const active = loading || error || suggestions !== null
  if (!loose && !active) return null

  const start = () => { setIdx(0); setApplied(0); load() }
  const stop = () => { reset(); setIdx(0); setApplied(0) }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Tars is sorting your list…
        </div>
      </Shell>
    )
  }

  if (error) {
    return (
      <Shell>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Couldn’t reach Tars — {error}</span>
          <Button size="sm" variant="secondary" onClick={start}>Retry</Button>
        </div>
      </Shell>
    )
  }

  if (!active) {
    return (
      <Shell>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Tidy up</div>
            <div className="text-xs text-muted-foreground">{loose} without a list or date</div>
          </div>
          <Button size="sm" onClick={start} className="shrink-0 gap-1.5 [&_svg]:size-4"><WandSparklesIcon />Sort with Tars</Button>
        </div>
      </Shell>
    )
  }

  const list = suggestions ?? []
  if (idx >= list.length) {
    return (
      <Shell>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {list.length === 0 ? 'Nothing to tidy — your list is in good shape.' : `Sorted ${applied} of ${list.length}.`}
          </span>
          <Button size="sm" variant="secondary" onClick={stop}>Done</Button>
        </div>
      </Shell>
    )
  }

  const s = list[idx]
  const p = s.change.projectId ? project(s.change.projectId) : null
  const accept = async () => { setIdx(i => i + 1); setApplied(a => a + 1); await patch(s.id, s.change) }
  const skip = () => setIdx(i => i + 1)

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Tars suggests</span>
        <span className="text-xs tabular-nums text-muted-foreground">{idx + 1} / {list.length}</span>
      </div>
      <div className="mt-2 text-base font-semibold break-words">{s.title}</div>
      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        {p && <Dot color={p.color} />}
        <span>{changeLine(s)}</span>
      </div>
      {s.reason && <div className="mt-0.5 text-xs text-muted-foreground/80">{s.reason}</div>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" onClick={skip} className="flex-1 gap-1.5 [&_svg]:size-4"><XIcon />Skip</Button>
        <Button size="sm" onClick={accept} className="flex-1 gap-1.5 [&_svg]:size-4"><CheckIcon />Apply</Button>
      </div>
    </Shell>
  )
}
