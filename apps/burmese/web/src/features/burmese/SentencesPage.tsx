import { Link } from 'react-router'
import { ChevronRightIcon } from 'lucide-react'
import { Page } from '@tars/ui/components/Page'
import { Button } from '@tars/ui/components/ui/button'
import { useResource } from '@tars/ui/lib/use-resource'
import { getSentences, type Category } from './data'

export const sentencesCache: { current: Category[] | null } = { current: null }

export function SentencesPage() {
  const { data, error } = useResource(getSentences, { cache: sentencesCache, reloadOnVisible: true })
  return (
    <Page title="Sentences" back={false}>
      {error && <p className="pt-6 text-sm text-muted-foreground">Couldn't load — {error}</p>}
      <div className="mt-2">
        {data?.map(c => (
          <Button key={c.key} asChild variant="ghost" size="block" className="hairline-b w-full justify-between rounded-none px-0 py-4 text-lg hover:bg-transparent">
            <Link to={`/sentences/${c.key}`}>
              <span className="font-display font-semibold">{c.name}</span>
              <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">{c.sentences.length}<ChevronRightIcon /></span>
            </Link>
          </Button>
        ))}
      </div>
    </Page>
  )
}
