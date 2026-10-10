import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { CheckCheckIcon, PlayIcon } from 'lucide-react'
import { Button } from '@tars/ui/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@tars/ui/components/ui/toggle-group'
import { LargeTitle, PillButton, Tint } from '@tars/ui/components/deck'
import { localGet, localSet } from '@tars/ui/lib/api'
import { MODES, type Held, type Mode } from '../../../../shared/drill.ts'
import { drill, getState, record, sync } from './store'
import { Keys } from './Keys'

const HELD: Record<Exclude<Held, 'new'>, [string, string]> = {
  learning: ['tomorrow', 'Learning'], slipping: ['overdue', 'Slipping'], recognised: ['primary', 'Recognised'],
  recalled: ['today', 'Recalled'], solid: ['today', 'Solid'], known: ['muted-foreground', 'Known'],
}
const MODE_KEY = 'omarchy-drill-mode'
const MODE_INFO: Record<Mode, [string, string]> = {
  recall: ['Recall', 'You see what it does and type the keys or the command from memory. Slower, but this is what makes them stick.'],
  mixed: ['Mixed', 'Multiple choice to meet a shortcut, then typing it once you’ve seen it a couple of times.'],
  choice: ['Choice', 'Multiple choice only — a fast warm-up. It shows you can recognise a shortcut, not recall it.'],
}

function Tile({ n, label, className }: { n: number; label: string; className?: string }) {
  return (
    <div className="glass rounded-lg px-3 py-2">
      <div className={`text-lg font-semibold tabular-nums ${className ?? ''}`}>{n}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(() => MODES.find(m => m === localGet(MODE_KEY)) ?? 'recall')
  const choose = (m: string) => { const v = MODES.find(x => x === m); if (v) { setMode(v); localSet(MODE_KEY, v) } }
  const [data, setData] = useState(() => drill.status(getState()))
  useEffect(() => {
    const refresh = () => sync().then(() => setData(drill.status(getState())))
    refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  const seen = data.total - data.counts.new - data.counts.known
  const know = (id: string, known: boolean) => { drill.know(getState(), id, known); record(); setData(drill.status(getState())) }
  const cards = data.cards.filter(c => c.held !== 'new')

  return (
    <main className="mx-auto max-w-page px-4 pt-safe-3 pb-safe-16">
      <LargeTitle title="Omarchy" sub={`${seen} of ${data.total} seen${data.counts.known ? ` · ${data.counts.known} known` : ''}`} />

      <div className="deck-card mt-6 flex min-h-56 flex-col rounded-3xl p-5">
        <div><Tint color="foreground">Keys & commands</Tint></div>
        <ToggleGroup type="single" variant="outline" spacing={0} value={mode} onValueChange={choose} className="mt-4 w-full">
          {MODES.map(m => <ToggleGroupItem key={m} value={m} className="flex-1 data-[state=on]:bg-secondary">{MODE_INFO[m][0]}</ToggleGroupItem>)}
        </ToggleGroup>
        <p className="mt-3 text-sm text-muted-foreground">{MODE_INFO[mode][1]} Misses come back a few cards later.</p>
        <div className="mt-auto pt-6"><PillButton onClick={() => navigate(`/play?mode=${mode}`)}><PlayIcon />Play</PillButton></div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2">
        <Tile n={data.counts.learning} label="Learning" className={data.counts.learning ? 'text-tomorrow' : undefined} />
        <Tile n={data.counts.slipping} label="Slipping" className={data.counts.slipping ? 'text-overdue' : undefined} />
        <Tile n={data.counts.recognised} label="Recognised" className={data.counts.recognised ? 'text-primary' : undefined} />
        <Tile n={data.counts.recalled + data.counts.solid} label="Recalled" className="text-today" />
      </div>

      {cards.length > 0 && (
        <div className="mt-6">
          {cards.map(c => {
            const [color, label] = HELD[c.held as Exclude<Held, 'new'>]
            return (
              <div key={c.id} className="hairline-b flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Keys kind={c.kind} text={c.q} />
                  <div className="mt-1 text-sm text-muted-foreground">{c.does}</div>
                </div>
                <Tint color={color}>{label}</Tint>
                {c.held === 'known'
                  ? <Button variant="link" size="inline" onClick={() => know(c.id, false)}>Undo</Button>
                  : <Button variant="ghost" size="icon-lg" aria-label="I know this" className="glass rounded-full" onClick={() => know(c.id, true)}><CheckCheckIcon /></Button>}
              </div>
            )
          })}
          {data.counts.new > 0 && <p className="pt-3 text-center text-sm text-muted-foreground">{data.counts.new} more to come</p>}
        </div>
      )}
    </main>
  )
}
