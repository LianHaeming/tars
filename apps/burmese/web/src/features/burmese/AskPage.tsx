import { useState } from 'react'
import { toast } from 'sonner'
import { SendIcon } from 'lucide-react'
import { SectionHead } from '@tars/ui/components/common'
import { Button } from '@tars/ui/components/ui/button'
import { Textarea } from '@tars/ui/components/ui/textarea'
import { useResource } from '@tars/ui/lib/use-resource'
import { ask, getAsked, type Asked } from './data'

const cache: { current: Asked[] | null } = { current: null }

function Answer({ a, big }: { a: Asked; big?: boolean }) {
  return big ? (
    <div className="glass mt-4 rounded-lg px-4 py-4 animate-in duration-200 fade-in">
      <p className="text-xl font-bold text-primary">{a.phonetic}</p>
      <p className="mt-1 text-base">{a.english}</p>
    </div>
  ) : (
    <div className="hairline-b py-3">
      <div className="font-semibold text-primary">{a.phonetic}</div>
      <div className="text-sm text-muted-foreground">{a.english}</div>
    </div>
  )
}

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
      <SectionHead title="How do I say…" />
      <form className="mt-3" onSubmit={e => { e.preventDefault(); go() }}>
        <Textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="e.g. can I have another beer?" enterKeyHint="send"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } }} />
        <Button type="submit" size="lg" className="mt-3 w-full" disabled={busy || !text.trim()}>
          <SendIcon />{busy ? 'Asking Claude…' : 'Ask'}
        </Button>
      </form>
      {latest && <Answer a={latest} big />}
      {error && <p className="pt-6 text-sm text-muted-foreground">Couldn't load previous answers — {error}</p>}
      {previous.length > 0 && (
        <>
          <SectionHead title="Previous" count={previous.length} />
          {previous.map(a => <Answer key={a.id} a={a} />)}
        </>
      )}
    </>
  )
}
