import { SectionHead } from '@/components/common'
import { isMastered, useBurmese } from './data'
import { Practice } from './Practice'
import { Translate } from './Translate'

export function BurmeseSection() {
  const { data, error, learn, review, save, clearHistory, translate } = useBurmese()

  if (!data) return <p className="pt-8 text-sm text-muted-foreground">{error ? `Couldn't load Burmese — ${error}.` : 'Loading…'}</p>

  const learned = data.deck.filter(c => data.progress[c.id]).reverse()

  return (
    <>
      {data.deck.length
        ? <Practice data={data} learn={learn} review={review} />
        : <p className="pt-4 text-sm text-muted-foreground">No sentences yet — the deck is still being made.</p>}

      <Translate history={data.history} deck={data.deck} translate={translate} save={save} clear={clearHistory} />

      {learned.length > 0 && (
        <section>
          <SectionHead title="Learned" count={learned.length} />
          {learned.map(c => {
            const p = data.progress[c.id]
            return (
              <div key={c.id} className="flex items-center gap-3 hairline-b py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-primary">{c.phonetic}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.english}</div>
                </div>
                <span className="text-xs font-semibold text-muted-foreground tabular-nums" title="Strength each way">
                  {isMastered(p) ? <span className="text-today">Solid</span> : `${p.my.box + p.en.box}/12`}
                </span>
              </div>
            )
          })}
        </section>
      )}
    </>
  )
}
