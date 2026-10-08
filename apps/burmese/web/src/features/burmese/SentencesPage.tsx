import { Link } from 'react-router'
import { useResource } from '@tars/ui/lib/use-resource'
import { getSentences, type Category } from './data'
import { LargeTitle } from './deck'

export const sentencesCache: { current: Category[] | null } = { current: null }

export function SentencesPage() {
  const { data, error } = useResource(getSentences, { cache: sentencesCache, reloadOnVisible: true })
  const total = data?.reduce((n, c) => n + c.sentences.length, 0)
  return (
    <>
      <LargeTitle title="Phrases" sub={data && `${total} sentences · ${data.length} categories`} />
      {error && <p className="pt-3 text-sm text-muted-foreground">Couldn't load — {error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {data?.map(c => (
          <Link key={c.key} to={`/sentences/${c.key}`} className="glass flex min-h-24 flex-col rounded-2xl p-4 active:scale-98">
            <span className="font-semibold">{c.name}</span>
            <span className="mt-auto pt-2 text-xs text-muted-foreground tabular-nums">{c.sentences.length} sentence{c.sentences.length === 1 ? '' : 's'}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
