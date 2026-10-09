import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { PlayIcon } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@tars/ui/components/ui/toggle-group'
import { localGet, localSet } from '@tars/ui/lib/api'
import { MODES, type Held, type Mode } from '../../../../shared/words.ts'
import { getState, sync, words as engine } from './wordsStore'
import { LargeTitle, PillButton, Speak, Tint } from './deck'

const HELD: Record<Exclude<Held, 'new'>, [string, string]> = {
  learning: ['tomorrow', 'Learning'], slipping: ['overdue', 'Slipping'], recognised: ['primary', 'Recognised'],
  recalled: ['today', 'Recalled'], solid: ['today', 'Solid'],
}
const MODE_KEY = 'burmese-words-mode'
const MODE_INFO: Record<Mode, [string, string]> = {
  recall: ['Recall', 'Every card typed from memory — the Burmese for the English, the English for the Burmese. Slower, but this is what makes words stick.'],
  mixed: ['Mixed', 'Multiple choice to meet a word, then typing the Burmese once you’ve seen it a couple of times.'],
  choice: ['Choice', 'Multiple choice only — a fast warm-up. It shows you can recognise a word, not recall it.'],
}

function Tile({ n, label, className }: { n: number; label: string; className?: string }) {
  return (
    <div className="glass rounded-lg px-3 py-2">
      <div className={`text-lg font-semibold tabular-nums ${className ?? ''}`}>{n}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

export function WordsPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(() => MODES.find(m => m === localGet(MODE_KEY)) ?? 'recall')
  const choose = (m: string) => { const v = MODES.find(x => x === m); if (v) { setMode(v); localSet(MODE_KEY, v) } }
  const [data, setData] = useState(() => engine.status(getState()))
  useEffect(() => {
    const refresh = () => sync().then(() => setData(engine.status(getState())))
    refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  const seen = data ? data.total - data.counts.new : 0
  const words = data?.words.filter(w => w.held !== 'new') ?? []

  return (
    <>
      <LargeTitle title="Words" sub={data && `${seen} of ${data.total} seen`} />

      <div className="deck-card mt-6 flex min-h-56 flex-col rounded-3xl p-5">
        <div><Tint color="foreground">Quick fire</Tint></div>
        <ToggleGroup type="single" variant="outline" spacing={0} value={mode} onValueChange={choose} className="mt-4 w-full">
          {MODES.map(m => <ToggleGroupItem key={m} value={m} className="flex-1 data-[state=on]:bg-secondary">{MODE_INFO[m][0]}</ToggleGroupItem>)}
        </ToggleGroup>
        <p className="mt-3 text-sm text-muted-foreground">{MODE_INFO[mode][1]} Misses come back a few cards later.</p>
        <div className="mt-auto pt-6"><PillButton onClick={() => navigate(`/words/play?mode=${mode}`)}><PlayIcon />Play</PillButton></div>
      </div>

      {data && (
        <div className="mt-6 grid grid-cols-4 gap-2">
          <Tile n={data.counts.learning} label="Learning" className={data.counts.learning ? 'text-tomorrow' : undefined} />
          <Tile n={data.counts.slipping} label="Slipping" className={data.counts.slipping ? 'text-overdue' : undefined} />
          <Tile n={data.counts.recognised} label="Recognised" className={data.counts.recognised ? 'text-primary' : undefined} />
          <Tile n={data.counts.recalled + data.counts.solid} label="Recalled" className="text-today" />
        </div>
      )}

      {words.length > 0 && (
        <div className="mt-6">
          {words.map(w => {
            const [color, label] = HELD[w.held as Exclude<Held, 'new'>]
            return (
              <div key={w.id} className="hairline-b flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-primary">{w.phonetic}</div>
                  <div className="text-sm text-muted-foreground">{w.english}</div>
                </div>
                <Tint color={color}>{label}</Tint>
                <Speak id={w.id} compact />
              </div>
            )
          })}
          {data && data.counts.new > 0 && <p className="pt-3 text-center text-sm text-muted-foreground">{data.counts.new} more to come</p>}
        </div>
      )}
    </>
  )
}
