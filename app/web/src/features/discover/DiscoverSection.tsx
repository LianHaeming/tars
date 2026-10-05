import { useState } from 'react'
import { Loader2Icon, RefreshCwIcon, StarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Empty } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { refreshDiscover, stars, useDiscover, type Repo } from './data'

function RepoCard({ r }: { r: Repo }) {
  return (
    <a href={r.url} target="_blank" rel="noreferrer" className="glass block rounded-2xl p-4 transition-transform active:scale-98">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold">{r.fullName}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground [&_svg]:size-3.5">
          <StarIcon />{stars(r.stars)}
        </span>
      </div>
      <p className="mt-2 text-field">{r.blurb}</p>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        {r.category && <Badge variant="tag">{r.category}</Badge>}
        {r.language && <span>{r.language}</span>}
      </div>
    </a>
  )
}

export function DiscoverSection() {
  const { data, error, loading, reload } = useDiscover()
  const [busy, setBusy] = useState(false)
  const refresh = () => { setBusy(true); refreshDiscover().then(reload, () => {}).finally(() => setBusy(false)) }

  if (loading && !data?.repos.length) {
    return (
      <div className="flex items-center justify-center gap-2 px-5 py-20 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Tars is scouting GitHub…
      </div>
    )
  }
  if (error && !data?.repos.length) return <Empty>Couldn’t load today’s picks — {error}</Empty>
  if (!data?.repos.length) return <Empty>No picks yet. Pull to let Tars go hunting.</Empty>

  return (
    <div className="pt-3">
      <div className="flex items-center justify-between pb-1">
        <span className="text-sm text-muted-foreground">Cool repos Tars found today</span>
        <Button variant="ghost" size="icon" onClick={refresh} disabled={busy} aria-label="Find new repos" className="size-9 shrink-0 text-primary hover:text-primary">
          <RefreshCwIcon className={cn('size-5', (busy || loading) && 'animate-spin')} />
        </Button>
      </div>
      <div className="grid gap-3">
        {data.repos.map(r => <RepoCard key={r.fullName} r={r} />)}
      </div>
    </div>
  )
}
