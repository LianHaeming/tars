import { useState } from 'react'
import { toast } from 'sonner'
import { LightbulbIcon, SnailIcon } from 'lucide-react'
import { cn } from '@tars/ui/lib/utils'
import { localGet, localSet } from '@tars/ui/lib/api'
import { SectionHead } from '@tars/ui/components/common'
import { Button } from '@tars/ui/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@tars/ui/components/ui/toggle-group'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@tars/ui/components/ui/collapsible'
import { isOwned, KINDS, span, useBurmese, type Burmese, type BurmeseState } from './data'
import { Practice } from './Practice'
import { Stats } from './Stats'
import { PhraseOfDay } from './PhraseOfDay'
import { Translate } from './Translate'

const TABS = [
  { key: 'practice', label: 'Practice' },
  { key: 'stats', label: 'Stats' },
  { key: 'phrase', label: 'Phrase of the day' },
  { key: 'translate', label: 'Translate' },
] as const
type Tab = (typeof TABS)[number]['key']

function Learned({ api }: { api: Burmese & { data: BurmeseState } }) {
  const { data, unlearn, hook } = api
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const learned = data.deck.filter(c => data.progress[c.id]).reverse()
  if (!learned.length) return null
  const makeHook = (id: string) => { setBusy(true); hook(id).catch(e => toast(`Couldn't make a hook — ${(e as Error).message}`)).finally(() => setBusy(false)) }
  return (
    <section>
      <SectionHead title="Started" count={learned.length} />
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
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground tabular-nums">
                {p.leech && <SnailIcon className="size-3 text-tomorrow" />}
                {isOwned(p) ? <span className="text-week">Owned</span> : p.say?.s ? `${span(Math.round(p.say.s))}` : 'Learning'}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pb-3">
              <p lang="my" className="text-base">{c.burmese}</p>
              {c.note && <p className="mt-1 text-sm text-muted-foreground">{c.note}</p>}
              {c.hook && <p className="mt-2 flex gap-2 text-sm"><LightbulbIcon className="mt-0.5 size-4 shrink-0 text-tomorrow" />{c.hook}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                {KINDS.filter(k => p[k]).map(k => `${k} ${p[k]!.s ? `holds ~${span(Math.round(p[k]!.s!))}` : 'new'} · next ${p[k]!.due}`).join('  ·  ')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!c.hook && (
                  <Button variant="secondary" size="xs" disabled={busy} onClick={() => makeHook(c.id)} className="rounded-full text-tomorrow">
                    <LightbulbIcon />{busy ? 'Thinking…' : 'Memory hook'}
                  </Button>
                )}
                <Button variant="secondary" size="xs" onClick={() => { setOpen(null); unlearn(c.id) }} className="rounded-full text-overdue">
                  Start over
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </section>
  )
}

export function BurmeseSection() {
  const api = useBurmese()
  const { data, error, save, clearHistory, translate } = api
  const [tab, setTab] = useState<Tab>(() => (localGet('burmese-tab') as Tab) || 'practice')
  const pick = (t: Tab) => { setTab(t); localSet('burmese-tab', t) }
  const ready = data ? { ...api, data } : null

  return (
    <>
      <ToggleGroup type="single" value={tab} onValueChange={t => t && pick(t as Tab)} className="scrollbar-none mt-3 w-full justify-start overflow-x-auto">
        {TABS.map(t => (
          <ToggleGroupItem key={t.key} value={t.key} variant="pill" className="shrink-0 px-3 whitespace-nowrap">{t.label}</ToggleGroupItem>
        ))}
      </ToggleGroup>

      {tab === 'phrase' ? <PhraseOfDay /> : !ready ? (
        <p className="pt-8 text-sm text-muted-foreground">{error ? `Couldn't load Burmese — ${error}.` : 'Loading…'}</p>
      ) : tab === 'translate' ? (
        <Translate history={ready.data.history} deck={ready.data.deck} translate={translate} save={save} clear={clearHistory} />
      ) : tab === 'stats' ? (
        <Stats api={ready} />
      ) : (
        <>
          {ready.data.deck.length
            ? <Practice api={ready} />
            : <p className="pt-4 text-sm text-muted-foreground">No sentences yet — the deck is still being made.</p>}
          <Learned api={ready} />
        </>
      )}
    </>
  )
}
