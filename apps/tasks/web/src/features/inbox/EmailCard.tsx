import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRightIcon } from 'lucide-react'
import { useInbox } from './data'

function LinkCard({ to, title, children }: { to: string; title: string; children: ReactNode }) {
  return (
    <Link to={to} className="glass block rounded-2xl p-4 transition-opacity active:opacity-80">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <span className="inline-flex items-center text-xs font-semibold text-primary">Open<ChevronRightIcon className="size-4" /></span>
      </div>
      <div className="mt-3">{children}</div>
    </Link>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

export function EmailCard() {
  const { candidates } = useInbox()
  if (!candidates.length) return null
  return (
    <div className="pt-3">
      <LinkCard to="/inbox" title="Email">
        <Stat value={String(candidates.length)} label={`new ${candidates.length === 1 ? 'email' : 'emails'} to review`} />
        <ul className="mt-3 space-y-1">
          {candidates.slice(0, 3).map(c => <li key={c.id} className="truncate text-sm text-muted-foreground">{c.title}</li>)}
        </ul>
      </LinkCard>
    </div>
  )
}
