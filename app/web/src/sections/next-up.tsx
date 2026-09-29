import type { Task } from '@/lib/api'
import { dueColor, hhmm, pad, today, whenLabel, ymd } from '@/lib/dates'
import { byWhen, useTars } from '@/lib/store'

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
  const { open, openMonth } = useTars()
  const x = nextItem(open)
  const box = 'glass mb-2.5 block w-full rounded-[20px] px-4 py-[15px] text-left'
  if (!x) {
    return (
      <div className={box}>
        <div className="text-[13px] font-bold text-muted-foreground">Next up</div>
        <div className="mt-0.5 text-[21px] leading-tight font-extrabold tracking-tight">Nothing scheduled</div>
      </div>
    )
  }
  const where = x.description.split('\n')[0]
  return (
    <button className={`${box} transition-transform active:scale-[.98]`} onClick={() => openMonth(x.due!)}>
      <div className="text-[13px] font-bold" style={{ color: dueColor(x.due!) }}>{countdown(x)} · Next up</div>
      <div className="mt-0.5 text-[21px] leading-tight font-extrabold tracking-tight">{x.title}</div>
      {where && <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{where}</div>}
    </button>
  )
}
