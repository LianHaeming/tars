import { Link } from 'react-router'
import { ChevronRightIcon } from 'lucide-react'
import { SectionHead } from '@tars/ui/components/common'
import { useResource } from '@tars/ui/lib/use-resource'
import { getSentences, type Category } from './data'

export const sentencesCache: { current: Category[] | null } = { current: null }

export function SentencesPage() {
  const { data, error } = useResource(getSentences, { cache: sentencesCache, reloadOnVisible: true })
  return (
    <>
      <SectionHead title="Categories" count={data?.length} />
      {error && <p className="pt-3 text-sm text-muted-foreground">Couldn't load — {error}</p>}
      {data?.map(c => (
        <Link key={c.key} to={`/sentences/${c.key}`} className="hairline-b flex items-center gap-3 py-3">
          <span className="min-w-0 flex-1 font-semibold">{c.name}</span>
          <span className="text-sm text-muted-foreground tabular-nums">{c.sentences.length}</span>
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </Link>
      ))}
    </>
  )
}
