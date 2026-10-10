import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRightIcon, SparklesIcon } from 'lucide-react'
import { Page } from '@tars/ui/components/Page'
import { fmt0 } from '@tars/ui/lib/money'
import { useInbox } from '@/features/inbox/data'
import { useDashboard } from './data'

function Tile({ title, to, children }: { title: string; to: string; children: ReactNode }) {
  const head = (
    <div className="flex items-baseline justify-between">
      <span className="text-sm font-semibold">{title}</span>
      <span className="inline-flex items-center text-xs font-semibold text-primary">Open<ChevronRightIcon className="size-4" /></span>
    </div>
  )
  const cls = 'glass block rounded-2xl p-4 transition-opacity active:opacity-80'
  return <Link to={to} className={cls}>{head}<div className="mt-3">{children}</div></Link>
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

const Quiet = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>

function EmailTile() {
  const { candidates, loaded } = useInbox()
  const reminders = candidates.filter(c => c.kind === 'reminder').length
  return (
    <Tile title="Email" to="/inbox">
      {!loaded ? <Quiet>Loading…</Quiet> : !candidates.length ? <Quiet>Nothing to review — Tars checks Gmail every 30 minutes.</Quiet> : (
        <>
          <Stat
            value={String(candidates.length)}
            label={`to review${reminders ? ` · ${reminders} ${reminders === 1 ? 'is a reminder' : 'are reminders'}` : ''}`}
          />
          <ul className="mt-3 space-y-1">
            {candidates.slice(0, 3).map(c => <li key={c.id} className="truncate text-sm text-muted-foreground">{c.title}</li>)}
          </ul>
        </>
      )}
    </Tile>
  )
}

function MoneyTile() {
  const { data, error } = useDashboard()
  const m = data?.money
  return (
    <Tile title="Money" to="/money">
      {!m ? <Quiet>{data?.moneyError || error || 'Loading…'}</Quiet> : (
        <>
          <div className="flex items-end justify-between gap-3">
            <Stat value={fmt0(m.balance)} label="in current account" />
            <div className="text-right">
              <div className="text-base font-semibold tabular-nums">{fmt0(m.committed)}</div>
              <div className="mt-1 text-xs text-muted-foreground">goes out every month</div>
            </div>
          </div>
          {m.insights.length > 0 ? (
            <ul className="mt-3 space-y-2 hairline-t pt-3">
              {m.insights.slice(0, 2).map(x => (
                <li key={x.title} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{x.title}</span>
                    {x.figure && <span className="shrink-0 font-semibold text-money tabular-nums">{x.figure}</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{x.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <SparklesIcon className="size-4" />{m.thinking ? 'Tars is looking through your spending…' : 'No insights yet.'}
            </p>
          )}
        </>
      )}
    </Tile>
  )
}

function DiscoverTile() {
  const { data, error } = useDashboard()
  const repos = data?.discover?.repos
  return (
    <Tile title="Discover" to="/discover">
      {!repos ? <Quiet>{data?.discoverError || error || 'Loading…'}</Quiet> : !repos.length ? <Quiet>No picks yet today.</Quiet> : (
        <ul className="space-y-2">
          {repos.map(r => (
            <li key={r.fullName} className="text-sm">
              <div className="truncate font-semibold">{r.fullName}</div>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{r.blurb}</p>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  )
}

export function DashboardPage() {
  return (
    <Page title="Dashboard" back={false}>
      <div className="grid gap-3 pt-4">
        <EmailTile />
        <MoneyTile />
        <DiscoverTile />
      </div>
    </Page>
  )
}
