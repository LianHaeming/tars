import { useEffect, useState, type ReactNode } from 'react'
import { MinusIcon, PlusIcon, SwordsIcon } from 'lucide-react'
import { cn } from '@tars/ui/lib/utils'
import { SectionHead } from '@tars/ui/components/common'
import { Button } from '@tars/ui/components/ui/button'
import { Progress } from '@tars/ui/components/ui/progress'
import { level, useStats, type Burmese, type BurmeseState, type Settings, type Stats as S } from './data'

const WEEKS = 17
const DAY = 864e5
const iso = (d: Date) => d.toISOString().slice(0, 10)
const label = (day: string, o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' })

function Tile({ value, label: l, sub }: { value: ReactNode; label: string; sub?: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{l}</div>
      {sub && <div className="mt-2 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function Heatmap({ days, today }: { days: Record<string, number>; today: string }) {
  const [tap, setTap] = useState<string | null>(null)
  const end = new Date(today + 'T12:00:00Z')
  const start = new Date(end.getTime() - ((WEEKS - 1) * 7 + ((end.getUTCDay() + 6) % 7)) * DAY)
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => iso(new Date(start.getTime() + i * DAY)))
  const max = Math.max(1, ...cells.map(d => days[d] || 0))
  const shade = (n: number) => (n ? 0.25 + 0.75 * Math.min(1, n / max) : 0)
  return (
    <div className="glass mt-3 rounded-2xl p-4">
      <div className="grid grid-flow-col grid-rows-7 gap-0.5">
        {cells.map(d => {
          const n = days[d] || 0
          return (
            <Button key={d} variant="ghost" size="inline" aria-label={`${label(d)}: ${n} answers`} onClick={() => setTap(d)} disabled={d > today}
              className={cn('aspect-square rounded-sm bg-secondary', d > today && 'invisible', tap === d && 'ring-1 ring-foreground')}>
              {n > 0 && <span className="block size-full rounded-sm bg-primary" style={{ opacity: shade(n) }} />}
            </Button>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{tap ? `${label(tap)} — ${days[tap] || 0} answers` : `Last ${WEEKS} weeks · tap a day`}</p>
    </div>
  )
}

function Upcoming({ upcoming }: { upcoming: S['upcoming'] }) {
  const [tap, setTap] = useState<number | null>(null)
  const max = Math.max(1, ...upcoming.map(u => u.count))
  return (
    <div className="glass mt-3 rounded-2xl p-4">
      <div className="flex h-24 items-end gap-0.5">
        {upcoming.map((u, i) => (
          <Button key={u.day} variant="ghost" size="inline" aria-label={`${label(u.day)}: ${u.count} due`} onClick={() => setTap(i)} className="h-full flex-1 items-end">
            <span className={cn('block w-full rounded-t bg-primary', tap === i && 'bg-foreground')} style={{ height: u.count ? `${Math.max(4, (u.count / max) * 100)}%` : 0 }} />
          </Button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>Today</span><span>+13d</span></div>
      <p className="mt-2 text-xs text-muted-foreground">{tap !== null ? `${tap ? label(upcoming[tap].day) : 'Today (incl. overdue)'} — ${upcoming[tap].count} due` : 'Reviews due, next 14 days · tap a bar'}</p>
    </div>
  )
}

function Stepper({ value, label: l, step, min, max, onChange }: { value: number; label: string; step: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between hairline-b py-3">
      <span>{l}</span>
      <span className="flex items-center gap-3">
        <Button variant="secondary" size="icon-sm" aria-label="Less" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className="rounded-full"><MinusIcon /></Button>
        <span className="w-8 text-center font-semibold tabular-nums">{value}</span>
        <Button variant="secondary" size="icon-sm" aria-label="More" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className="rounded-full"><PlusIcon /></Button>
      </span>
    </div>
  )
}

const secs = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`)

export function Stats({ api }: { api: Burmese & { data: BurmeseState } }) {
  const { data: stats, error, reload } = useStats()
  const { data, settings } = api
  useEffect(() => { reload() }, [data.xp, reload])
  const set = (s: Partial<Settings>) => settings({ ...data.settings, ...s })
  if (!stats) return <p className="pt-8 text-sm text-muted-foreground">{error ? `Couldn't load stats — ${error}.` : 'Loading…'}</p>

  const lv = level(stats.xp)
  const { week, before } = stats.speed
  return (
    <section className="pb-8">
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Tile value={stats.streak} label="Day streak" sub="One missed day a week is forgiven" />
        <Tile value={`Lv ${lv.n}`} label={`${stats.xp} XP`} sub={<Progress value={(lv.into / lv.span) * 100} className="h-1.5 bg-secondary" />} />
        <Tile value={<>{stats.ownedNow}<span className="text-base font-semibold text-muted-foreground"> / {stats.deckSize}</span></>} label="Owned" sub="Say-it stable for 3+ weeks" />
        <Tile value={stats.retention == null ? '—' : `${Math.round(stats.retention * 100)}%`} label="Retention · 30d" sub={stats.retentionN ? `${stats.retentionN} due reviews · aim ≈ 90%` : 'Needs a few days of reviews'} />
        <Tile value={secs(week)} label="Answer time" sub={before != null && week != null ? `${week <= before ? 'faster' : 'slower'} than last week (${secs(before)})` : 'Median, last 7 days'} />
        <Tile value={stats.total} label="Answers ever" />
      </div>

      <SectionHead title="Activity" />
      <Heatmap days={stats.days} today={stats.today} />

      <SectionHead title="Coming up" />
      <Upcoming upcoming={stats.upcoming} />

      <SectionHead title="Topics" />
      {stats.topics.filter(t => t.learned).map(t => (
        <div key={t.topic} className="hairline-b py-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">{t.topic}{t.boss && <SwordsIcon className="ml-2 inline size-3 text-tomorrow" />}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{t.owned} owned · {t.learned}/{t.total} started</span>
          </div>
          <Progress value={(t.owned / t.total) * 100} className="mt-2 h-1.5 bg-secondary [&>[data-slot=progress-indicator]]:bg-week" />
        </div>
      ))}
      {!stats.topics.some(t => t.learned) && <p className="py-3 text-sm text-muted-foreground">Start some sentences to see topics here.</p>}

      {stats.missed.length > 0 && (
        <>
          <SectionHead title="Slipping most" />
          {stats.missed.map(m => (
            <div key={m.id} className="flex items-center gap-3 hairline-b py-3">
              <div className="min-w-0 flex-1"><div className="truncate font-semibold text-primary">{m.phonetic}</div><div className="truncate text-xs text-muted-foreground">{m.english}</div></div>
              <span className="text-xs text-overdue tabular-nums">{m.lapses}× missed</span>
            </div>
          ))}
        </>
      )}

      <SectionHead title="Daily limits" />
      <Stepper label="New sentences a day" value={data.settings.newPerDay} step={1} min={0} max={20} onChange={v => set({ newPerDay: v })} />
      <Stepper label="Max reviews a day" value={data.settings.maxReviews} step={10} min={10} max={500} onChange={v => set({ maxReviews: v })} />
    </section>
  )
}
