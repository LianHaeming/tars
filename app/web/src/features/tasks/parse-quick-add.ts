import type { Project } from '@/lib/api'
import { addDays, nextMonday, pad, today, ymd } from '@/lib/dates'

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export type Parsed = { title: string; due?: string; dueTime?: string; priority?: 1 | 2 | 3 | 4; projectId?: string }

// Pulls dates ("tomorrow", "fri", "next week", "in 3 days", "12 oct"), times, priority (p1-p4)
// and project (#name) out of the text, the way Todoist's quick add does.
export function parseQuickAdd(text: string, projects: Project[]): Parsed {
  let title = ' ' + text + ' '
  let due: string | undefined, dueTime: string | undefined, priority: Parsed['priority'], projectId: string | undefined
  const t = today()
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => string | null) => {
    const m = title.match(re)
    if (m && due === undefined) { const v = fn(m); if (v) { due = v; title = title.replace(m[0], ' ') } }
  }

  take(/\s(today|tod)\s/i, () => ymd(t))
  take(/\s(tomorrow|tmrw|tom)\s/i, () => ymd(addDays(t, 1)))
  take(/\snext week\s/i, () => ymd(nextMonday()))
  take(/\sin (\d+) (days?|weeks?)\s/i, m => ymd(addDays(t, +m[1] * (m[2][0].toLowerCase() === 'w' ? 7 : 1))))
  take(/\s(\d{4}-\d{2}-\d{2})\s/, m => m[1])
  take(/\s(next )?(monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thu|friday|fri|saturday|sunday)\s/i, m => {
    const wd = WEEKDAYS.findIndex(w => w.startsWith(m[2].toLowerCase().slice(0, 3)))
    let n = (wd - t.getDay() + 7) % 7 || 7
    if (m[1] && n < 7) n += 7
    return ymd(addDays(t, n))
  })
  const monthDate = (day: number, mon: string) => {
    const mi = MONTHS.indexOf(mon.toLowerCase().slice(0, 3))
    if (mi < 0 || day < 1 || day > 31) return null
    let d = new Date(t.getFullYear(), mi, day)
    if (d < t) d = new Date(t.getFullYear() + 1, mi, day)
    return ymd(d)
  }
  take(/\s(\d{1,2})(?:st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s/i, m => monthDate(+m[1], m[2]))
  take(/\s(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]* (\d{1,2})(?:st|nd|rd|th)?\s/i, m => monthDate(+m[2], m[1]))

  const setTime = (hs: string, ms: string | undefined, ap: string | null | undefined) => {
    let h = +hs
    const min = ms ? +ms : 0
    if (ap) { const a = ap.toLowerCase(); if (a === 'pm' && h < 12) h += 12; if (a === 'am' && h === 12) h = 0 }
    return h > 23 || min > 59 ? null : pad(h) + ':' + pad(min)
  }
  const grabTime = (re: RegExp, fn: (m: RegExpMatchArray) => string | null) => {
    if (dueTime !== undefined) return
    const m = title.match(re)
    if (m) { const v = fn(m); if (v) { dueTime = v; title = title.replace(m[0], ' ') } }
  }
  grabTime(/\sat (\d{1,2})(?::(\d{2}))? ?(am|pm)?\s/i, m => setTime(m[1], m[2], m[3]))
  grabTime(/\s(\d{1,2}):(\d{2})\s/, m => setTime(m[1], m[2], null))
  grabTime(/\s(\d{1,2}) ?(am|pm)\s/i, m => setTime(m[1], undefined, m[2]))

  const p = title.match(/\s[pP]([1-4])\s/)
  if (p) { priority = +p[1] as Parsed['priority']; title = title.replace(p[0], ' ') }

  const h = title.match(/\s#(\S+)\s/)
  if (h) {
    const key = h[1].toLowerCase()
    const norm = (n: string) => n.toLowerCase().replace(/\s+/g, '')
    const proj = projects.find(pr => norm(pr.name) === key) || projects.find(pr => norm(pr.name).startsWith(key))
    if (proj) { projectId = proj.id; title = title.replace(h[0], ' ') }
  }
  return { title: title.replace(/\s+/g, ' ').trim(), due, dueTime, priority, projectId }
}
