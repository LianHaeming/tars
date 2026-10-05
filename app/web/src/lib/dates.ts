import type { Task } from './api'

export const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
export const dayDiff = (s: string) => Math.round((+parseYmd(s) - +today()) / 864e5)
export const nextMonday = () => { const t = today(); return addDays(t, ((8 - t.getDay()) % 7) || 7) }
export const shortDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
export const longDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

export function dueLabel(s: string) {
  const n = dayDiff(s), d = parseYmd(s)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  if (n > 1 && n < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (d.getFullYear() !== today().getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString(undefined, opts)
}

export function dueColor(s: string) {
  const n = dayDiff(s)
  return n < 0 ? 'var(--overdue)' : n === 0 ? 'var(--today)' : n === 1 ? 'var(--tomorrow)' : n < 7 ? 'var(--week)' : 'var(--muted-foreground)'
}

export const whenLabel = (t: Task) => `${dueLabel(t.due!)}${t.dueTime ? ' · ' + t.dueTime : ''}`

export function relDay(s: string) {
  const n = dayDiff(s)
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : ''
}

export const REPEATS: { code: string | null; label: string }[] = [
  { code: null, label: 'Never' },
  { code: '1w', label: 'Weekly' },
  { code: '2w', label: 'Fortnightly' },
  { code: '1m', label: 'Monthly' },
  { code: '3m', label: 'Every 3 months' },
  { code: '6m', label: 'Every 6 months' },
  { code: '1y', label: 'Yearly' },
]
export const repeatLabel = (code?: string | null) => REPEATS.find(r => r.code === code)?.label ?? null
