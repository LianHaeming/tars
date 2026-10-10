import { Link, useNavigate } from 'react-router'
import { ChartColumnIcon, ChevronRightIcon, PlayIcon } from 'lucide-react'
import { Button } from '@tars/ui/components/ui/button'
import { useResource } from '@tars/ui/lib/use-resource'
import { cn } from '@tars/ui/lib/utils'
import { getStatus, type Status } from './data'
import { LargeTitle, PillButton, Tint } from './deck'
import { HOME } from '@/app/home'

const cache: { current: Status | null } = { current: null }

function Tile({ n, label, className }: { n: string | number; label: string; className?: string }) {
  return (
    <div className="glass rounded-lg px-3 py-2">
      <div className={cn('text-lg font-semibold tabular-nums', className)}>{n}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function line(s: Status) {
  if (!s.pool) return 'The sentences are still being written — check back soon.'
  if (!s.slipping && !s.newReady) return 'Nothing to do — every sentence is started and nothing is slipping. Ask tars for more sentences.'
  const parts = []
  if (s.slipping) parts.push(<span key="s"><b className="font-semibold text-overdue">{Math.min(s.slipping, 8)} back</b> from last time</span>)
  if (s.newReady) parts.push(<span key="n"><b className="font-semibold text-primary">{s.newReady} new</b> sentence{s.newReady === 1 ? '' : 's'}</span>)
  else if (s.left) parts.push(<span key="l">no new ones until the slipping ones are back</span>)
  return parts.flatMap((p, i) => i ? [' · ', p] : [p])
}

function Stack({ s }: { s: Status }) {
  const back = Math.min(s.slipping, 8)
  const fresh = Math.min(s.newReady, 8)
  if (!back && !fresh) return null
  return (
    <div className="mt-5 flex flex-wrap gap-2" aria-hidden>
      {Array.from({ length: back }, (_, i) => <span key={`b${i}`} className="h-8 w-6 rounded-sm bg-overdue/30" />)}
      {Array.from({ length: fresh }, (_, i) => <span key={`n${i}`} className="h-8 w-6 rounded-sm bg-primary/35" />)}
    </div>
  )
}

function PlayButton(props: { disabled: boolean; onClick: () => void }) {
  return <div className="mt-auto pt-6"><PillButton {...props}><PlayIcon />Play</PillButton></div>
}

export function ExercisesPage() {
  const navigate = useNavigate()
  const { data, error } = useResource(getStatus, { cache, reloadOnVisible: true })

  return (
    <>
      <LargeTitle back={HOME} title="Learn" sub={data && data.pool > 0 && `${data.pool - data.left} of ${data.pool} started`}
        action={
          <Button asChild variant="ghost" size="icon-lg" className="glass rounded-full" aria-label="Stats">
            <Link to="/burmese/stats"><ChartColumnIcon /></Link>
          </Button>
        } />
      {error && <p className="pt-3 text-sm text-muted-foreground">Couldn't load — {error}</p>}

      <div className="relative mx-2 mt-8">
        <div aria-hidden className="glass absolute inset-0 -translate-y-6 scale-88 rounded-3xl opacity-30" />
        <div aria-hidden className="glass absolute inset-0 -translate-y-3 scale-94 rounded-3xl opacity-55" />
        <div className="deck-card relative flex min-h-72 flex-col rounded-3xl p-5">
          <div><Tint color="foreground">Next unit</Tint></div>
          {data && <Stack s={data} />}
          <p className="mt-3 text-sm text-muted-foreground">{data ? line(data) : 'Loading…'}</p>
          <PlayButton disabled={!data || data.pool === 0} onClick={() => navigate('/burmese/unit')} />
        </div>
      </div>

      {data && (
        <div className="mt-6 grid grid-cols-3 gap-2">
          <Tile n={data.slipping} label="Slipping" className={data.slipping ? 'text-overdue' : undefined} />
          <Tile n={data.newReady} label="New ready" />
          <Tile n={data.pool - data.left} label={`of ${data.pool} started`} />
        </div>
      )}

      {data && data.pool - data.left > 0 && (
        <Link to="/burmese/cards" className="glass mt-6 flex items-center gap-4 rounded-3xl p-5 active:scale-98">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Your cards</p>
            <p className="mt-1 text-sm text-muted-foreground">
              All {data.pool - data.left} sentence{data.pool - data.left === 1 ? '' : 's'} you've learned, to look back over and listen to.
            </p>
          </div>
          <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      )}
    </>
  )
}
