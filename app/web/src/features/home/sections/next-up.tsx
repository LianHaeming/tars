import { Link } from 'react-router'
import type { Task } from '@/lib/api'
import { dueColor, hhmm, pad, today, whenLabel, ymd } from '@/lib/dates'
import { byWhen, useTars } from '@/features/tasks/store'

export function nextItem(open: Task[]) {
  const t = ymd(today()), now = hhmm(new Date())
  return open.filter(x => x.due && (x.due > t || (x.due === t && (!x.dueTime || x.dueTime >= now)))).sort(byWhen)[0]
}

function countdown(x: Task) {
  if (x.due !== ymd(today())) return whenLabel(x)
  if (!x.dueTime) return 'Today'
  const [h, m] = x.dueTime.split(':').map(Number)
  const mins = Math.max(0, Math.round((new Date().setHours(h, m, 0, 0) - Date.now()) / 6e4))
  return `${x.dueTime} · in ${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${pad(mins % 60)} min`}`
}

export function NextUp() {
  const { open } = useTars()
  const x = nextItem(open)
  const box = 'glass mb-3 block w-full rounded-2xl px-4 py-4 text-left'
  if (!x) {
    return (
      <div className={box}>
        <div className="text-sm font-semibold text-muted-foreground">Next up</div>
        <div className="mt-1 text-xl leading-tight font-bold tracking-tight">Nothing scheduled</div>
      </div>
    )
  }
  const where = x.description.split('\n')[0]
  return (
    <Link className={`${box} transition-transform active:scale-98`} to={`/month?d=${x.due}`}>
      <div className="text-sm font-semibold" style={{ color: dueColor(x.due!) }}>{countdown(x)} · Next up</div>
      <div className="mt-1 text-xl leading-tight font-bold tracking-tight">{x.title}</div>
      {where && <div className="mt-1 truncate text-sm text-muted-foreground">{where}</div>}
    </Link>
  )
}
