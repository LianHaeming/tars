import { useNavigate } from 'react-router'
import { PlayIcon } from 'lucide-react'
import { SectionHead } from '@tars/ui/components/common'
import { Button } from '@tars/ui/components/ui/button'
import { useResource } from '@tars/ui/lib/use-resource'
import { getStatus, type Status } from './data'

const cache: { current: Status | null } = { current: null }

function Tile({ n, label }: { n: string | number; label: string }) {
  return (
    <div className="glass rounded-lg px-3 py-2">
      <div className="text-lg font-semibold tabular-nums">{n}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function line(s: Status) {
  if (!s.pool) return 'The sentences are still being written — check back soon.'
  if (!s.slipping && !s.newReady) return 'Nothing to do — every sentence is started and nothing is slipping. Ask tars for more sentences.'
  const parts = []
  if (s.slipping) parts.push(`${Math.min(s.slipping, 8)} from last time`)
  if (s.newReady) parts.push(`${s.newReady} new sentence${s.newReady === 1 ? '' : 's'}`)
  else if (s.left) parts.push('no new ones until the slipping ones are back')
  return `Next unit: ${parts.join(' · ')}.`
}

export function ExercisesPage() {
  const navigate = useNavigate()
  const { data, error } = useResource(getStatus, { cache, reloadOnVisible: true })

  return (
    <>
      <SectionHead title="Memorisation" link="Stats" to="/stats" />
      {error && <p className="pt-3 text-sm text-muted-foreground">Couldn't load — {error}</p>}
      {data && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Tile n={data.slipping} label="Slipping" />
            <Tile n={data.newReady} label="New ready" />
            <Tile n={data.pool - data.left} label={`of ${data.pool} started`} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{line(data)}</p>
        </>
      )}

      <nav className="pointer-events-none fixed inset-x-4 bottom-safe-2 z-30 mx-auto flex max-w-page justify-center">
        <Button onClick={() => navigate('/unit')} disabled={data?.pool === 0}
          className="pointer-events-auto h-12 gap-2 rounded-full bg-foreground px-6 text-background shadow-lg hover:bg-foreground/90 active:scale-98 [&_svg:not([class*='size-'])]:size-5">
          <PlayIcon />Play a unit
        </Button>
      </nav>
    </>
  )
}
