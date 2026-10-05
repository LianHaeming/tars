import { useState } from 'react'
import { cn } from '@/lib/utils'
import { localGet, localSet } from '@/lib/api'
import { SectionHead } from '@/components/common'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { isMastered, useBurmese, type BurmeseState } from './data'
import { Practice } from './Practice'
import { PhraseOfDay } from './PhraseOfDay'
import { Translate } from './Translate'

const TABS = [
  { key: 'practice', label: 'Practice' },
  { key: 'phrase', label: 'Phrase of the day' },
  { key: 'translate', label: 'Translate' },
] as const
type Tab = (typeof TABS)[number]['key']

function Learned({ data, unlearn }: { data: BurmeseState; unlearn: (id: string) => Promise<unknown> }) {
  const [open, setOpen] = useState<string | null>(null)
  const learned = data.deck.filter(c => data.progress[c.id]).reverse()
  if (!learned.length) return null
  return (
    <section>
      <SectionHead title="Learned" count={learned.length} />
      {learned.map(c => {
        const p = data.progress[c.id]
        const on = open === c.id
        return (
          <Collapsible key={c.id} open={on} onOpenChange={o => setOpen(o ? c.id : null)} className="hairline-b">
            <CollapsibleTrigger className="flex w-full items-center gap-3 py-3 text-left">
              <div className="min-w-0 flex-1">
                <div className={cn('font-semibold text-primary', !on && 'truncate')}>{c.phonetic}</div>
                <div className={cn('text-xs text-muted-foreground', !on && 'truncate')}>{c.english}</div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {isMastered(p) ? <span className="text-today">Solid</span> : `${p.my.box + p.en.box}/12`}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pb-3">
              <p lang="my" className="text-base">{c.burmese}</p>
              {c.note && <p className="mt-1 text-sm text-muted-foreground">{c.note}</p>}
              <Button variant="secondary" size="xs" onClick={() => { setOpen(null); unlearn(c.id) }} className="mt-3 rounded-full text-overdue">
                Unlearn — teach me this again
              </Button>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </section>
  )
}

export function BurmeseSection() {
  const { data, error, learn, review, unlearn, save, clearHistory, translate } = useBurmese()
  const [tab, setTab] = useState<Tab>(() => (localGet('burmese-tab') as Tab) || 'practice')
  const pick = (t: Tab) => { setTab(t); localSet('burmese-tab', t) }

  return (
    <>
      <ToggleGroup type="single" value={tab} onValueChange={t => t && pick(t as Tab)} className="scrollbar-none mt-3 w-full justify-start overflow-x-auto">
        {TABS.map(t => (
          <ToggleGroupItem key={t.key} value={t.key} variant="pill" className="shrink-0 px-3 whitespace-nowrap">{t.label}</ToggleGroupItem>
        ))}
      </ToggleGroup>

      {tab === 'phrase' ? <PhraseOfDay /> : !data ? (
        <p className="pt-8 text-sm text-muted-foreground">{error ? `Couldn't load Burmese — ${error}.` : 'Loading…'}</p>
      ) : tab === 'translate' ? (
        <Translate history={data.history} deck={data.deck} translate={translate} save={save} clear={clearHistory} />
      ) : (
        <>
          {data.deck.length
            ? <Practice data={data} learn={learn} review={review} unlearn={unlearn} />
            : <p className="pt-4 text-sm text-muted-foreground">No sentences yet — the deck is still being made.</p>}
          <Learned data={data} unlearn={unlearn} />
        </>
      )}
    </>
  )
}
