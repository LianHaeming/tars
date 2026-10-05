import { useState, type FormEvent } from 'react'
import { ArrowUpIcon, CheckIcon, CopyIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Card, Translation } from './data'

type Props = {
  history: Translation[]
  deck: Card[]
  translate: (text: string) => Promise<Translation>
  save: (t: Translation) => Promise<unknown>
  clear: () => Promise<unknown>
}

export function Translate({ history, deck, translate, save, clear }: Props) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const inDeck = (t: Translation) => deck.some(c => c.english.toLowerCase() === t.english.toLowerCase())

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = text.trim()
    if (!q || pending) return
    setPending(q); setError(null); setText('')
    translate(q).catch(err => { setError((err as Error).message); setText(q) }).finally(() => setPending(null))
  }

  const copy = (t: Translation) => {
    navigator.clipboard?.writeText(t.burmese).then(() => { setCopied(t.id); setTimeout(() => setCopied(null), 1500) }, () => {})
  }

  return (
    <section>
      <form onSubmit={submit} className="flex items-center gap-2 pt-3">
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What do you want to say?"
          enterKeyHint="send"
          className="h-10 min-w-0 flex-1 rounded-full bg-secondary dark:bg-secondary"
        />
        <Button type="submit" size="icon" disabled={!text.trim() || !!pending} aria-label="Translate" className="size-10 shrink-0 rounded-full [&_svg]:size-5">
          <ArrowUpIcon />
        </Button>
      </form>
      {error && <p className="pt-2 text-sm text-overdue">{error}</p>}

      <div className="grid gap-3 pt-3">
        {pending && (
          <div className="glass rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">{pending}</p>
            <p className="mt-2 animate-pulse text-sm text-week">Translating…</p>
          </div>
        )}
        {history.map(t => (
          <div key={t.id} className="glass rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">{t.english}</p>
            <p className="mt-2 text-xl font-semibold text-primary">{t.phonetic}</p>
            <p lang="my" className="mt-1 text-base">{t.burmese}</p>
            {t.literal && <p className="mt-2 text-xs text-muted-foreground">{t.literal}</p>}
            {t.note && <p className="mt-1 text-xs text-muted-foreground">{t.note}</p>}
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="xs" onClick={() => copy(t)} className="rounded-full">
                {copied === t.id ? <CheckIcon /> : <CopyIcon />}{copied === t.id ? 'Copied' : 'Copy Burmese'}
              </Button>
              {inDeck(t) ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-muted-foreground"><CheckIcon className="size-3" />In practice</span>
              ) : (
                <Button variant="secondary" size="xs" onClick={() => save(t)} className="rounded-full text-week">
                  <PlusIcon />Learn this next
                </Button>
              )}
            </div>
          </div>
        ))}
        {history.length > 2 && (
          <Button variant="link" size="inline" onClick={clear} className="self-start font-semibold text-muted-foreground">Clear translations</Button>
        )}
      </div>
    </section>
  )
}
