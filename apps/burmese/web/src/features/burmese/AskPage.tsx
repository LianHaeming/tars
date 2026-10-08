import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowUpIcon } from 'lucide-react'
import { Button } from '@tars/ui/components/ui/button'
import { Textarea } from '@tars/ui/components/ui/textarea'
import { useResource } from '@tars/ui/lib/use-resource'
import { ask, getAsked, type Asked } from './data'
import { LargeTitle, Speak } from './deck'

const cache: { current: Asked[] | null } = { current: null }

export function AskPage() {
  const { data, error, reload } = useResource(getAsked, { cache })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [latest, setLatest] = useState<Asked | null>(null)

  const go = () => {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    ask(t).then(a => { setLatest(a); setText(''); reload() }, e => toast(`Claude couldn't answer — ${(e as Error).message}`)).finally(() => setBusy(false))
  }
  const previous = (data || []).filter(a => a.id !== latest?.id)

  return (
    <>
      <LargeTitle title="Ask" sub="How do I say…" />
      {busy && <div className="glass mt-5 animate-pulse rounded-3xl p-5 text-sm text-muted-foreground">Asking Claude…</div>}
      {latest && (
        <div className="glass mt-5 rounded-3xl border-claude/40 p-5 animate-in duration-200 fade-in">
          <p className="text-sm text-muted-foreground">“{latest.asked}”</p>
          <p className="mt-2 text-2xl font-bold text-primary">{latest.phonetic}</p>
          <p className="mt-1">{latest.english}</p>
          <Speak id={latest.id} className="mt-4 justify-start" />
        </div>
      )}
      {error && <p className="pt-6 text-sm text-muted-foreground">Couldn't load previous answers — {error}</p>}
      {previous.length > 0 && (
        <>
          <p className="px-1 pt-6 pb-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">Earlier</p>
          <div className="space-y-2">
            {previous.map(a => (
              <div key={a.id} className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-primary">{a.phonetic}</div>
                  <div className="text-sm text-muted-foreground">{a.english}</div>
                </div>
                <Speak id={a.id} compact />
              </div>
            ))}
          </div>
        </>
      )}

      <form className="fixed inset-x-3 bottom-safe-20 z-30 mx-auto flex max-w-page items-end gap-2" onSubmit={e => { e.preventDefault(); go() }}>
        <Textarea value={text} onChange={e => setText(e.target.value)} rows={1} placeholder="e.g. can I have another beer?" enterKeyHint="send"
          className="dock min-h-12 min-w-0 flex-1 resize-none rounded-3xl px-4 py-3"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } }} />
        <Button type="submit" size="icon-lg" aria-label="Ask" disabled={busy || !text.trim()} className="size-12 rounded-full shadow-lg [&_svg:not([class*='size-'])]:size-5">
          <ArrowUpIcon />
        </Button>
      </form>
    </>
  )
}
