import { useParams } from 'react-router'
import { Page } from '@tars/ui/components/Page'
import { Empty } from '@tars/ui/components/common'
import { useResource } from '@tars/ui/lib/use-resource'
import { getSentences } from './data'
import { sentencesCache } from './SentencesPage'

export function CategoryPage() {
  const { cat } = useParams()
  const { data, error } = useResource(getSentences, { cache: sentencesCache })
  const c = data?.find(x => x.key === cat)
  return (
    <Page title={c?.name || 'Sentences'} back="/sentences">
      {error && <p className="pt-6 text-sm text-muted-foreground">Couldn't load — {error}</p>}
      {c && !c.sentences.length && <Empty>{cat === 'custom' ? 'Anything you ask Claude shows up here.' : 'No sentences yet.'}</Empty>}
      {c?.sentences.map(s => (
        <div key={s.id} className="hairline-b py-3">
          <div className="font-semibold text-primary">{s.phonetic}</div>
          <div className="text-sm text-muted-foreground">{s.english}</div>
        </div>
      ))}
    </Page>
  )
}
