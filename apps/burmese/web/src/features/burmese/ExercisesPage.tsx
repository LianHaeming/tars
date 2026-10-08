import { Link, useNavigate } from 'react-router'
import { ChartColumnIcon, PlayIcon } from 'lucide-react'
import { Page } from '@tars/ui/components/Page'
import { Button } from '@tars/ui/components/ui/button'
import { useResource } from '@tars/ui/lib/use-resource'
import { getStatus } from './data'

function statusLine(slipping: number, fresh: number, left: number, pool: number) {
  if (!pool) return 'The sentences are still being written — check back soon.'
  const parts = [slipping ? `${slipping} slipping` : 'Nothing slipping', fresh ? `${fresh} new ready` : left ? 'no new until the slipping ones are back' : 'all sentences started']
  return parts.join(' · ')
}

export function ExercisesPage() {
  const navigate = useNavigate()
  const { data, error } = useResource(getStatus, { reloadOnVisible: true })
  const empty = data && !data.slipping && !data.newReady

  return (
    <Page title="Burmese" back={false} actions={
      <Button asChild variant="ghost" size="icon-lg" aria-label="Stats" className="text-primary">
        <Link to="/stats"><ChartColumnIcon className="size-5" /></Link>
      </Button>
    }>
      <div className="flex flex-col items-center pt-16 text-center">
        <Button variant="ghost" size="inline" aria-label="Play a unit" disabled={data?.pool === 0} onClick={() => navigate('/unit')}
          className="rounded-full hover:bg-transparent">
          <span className="play-orb flex size-play flex-col items-center justify-center gap-2 rounded-full text-primary-foreground">
            <PlayIcon className="size-12 fill-current" />
            <span className="font-display text-play font-semibold">Play</span>
          </span>
        </Button>
        <p className="mt-12 text-lg font-semibold">{empty ? 'All caught up' : 'Play a unit'}</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {error ? `Couldn't load — ${error}` : data ? statusLine(data.slipping, data.newReady, data.left, data.pool) : 'Loading…'}
        </p>
        {data && data.pool > 0 && (
          <p className="mt-6 text-xs text-muted-foreground">{data.pool - data.left} of {data.pool} sentences started</p>
        )}
      </div>
    </Page>
  )
}
