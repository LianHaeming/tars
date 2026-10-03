import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowUpIcon, SparkleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useTars } from '@/features/tasks/store'
import { useKeyboardOffset } from '@/hooks/use-keyboard-offset'
import { Page, pageWidth } from '@/components/Page'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Msg = { who: 'me' | 'ai'; text: string; status?: string }

function inline(line: string) {
  return line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b>
      : part.startsWith('`') && part.endsWith('`') ? <code key={i} className="rounded bg-white/10 px-1 text-sm">{part.slice(1, -1)}</code>
        : part,
  )
}

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return lines.map((l, i): ReactNode => (
    <Fragment key={i}>{inline(l.replace(/^\s*[-*] /, '• '))}{i < lines.length - 1 && <br />}</Fragment>
  ))
}

type Chat = { messages: Msg[]; busy: boolean }

export function TarsPage() {
  const { load } = useTars()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const bottom = useKeyboardOffset()
  const streaming = useRef(false)

  const refresh = useCallback(async () => {
    if (streaming.current) return
    const c = await api<Chat>('GET', 'chat')
    const last = c.messages.at(-1)
    setMsgs(c.busy && last?.who === 'ai' ? [...c.messages.slice(0, -1), { ...last, status: 'Answering…' }] : c.messages)
    setBusy(c.busy)
  }, [])

  useEffect(() => { refresh().catch(() => {}) }, [refresh])
  useEffect(() => {
    if (!busy || streaming.current) return
    const t = setInterval(() => refresh().catch(() => {}), 2000)
    return () => clearInterval(t)
  }, [busy, refresh])
  useEffect(() => {
    try { localStorage.removeItem('askMsgs'); localStorage.removeItem('askSession') } catch { /* ignore */ }
  }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs])

  async function send(message: string) {
    streaming.current = true
    setBusy(true)
    let reply: Msg = { who: 'ai', text: '', status: 'Thinking…' }
    let all = [...msgs, { who: 'me', text: message } as Msg, reply]
    const update = (r: Partial<Msg>) => { reply = { ...reply, ...r }; all = [...all.slice(0, -1), reply]; setMsgs(all) }
    const note = (t: string) => update({ text: reply.text + (reply.text ? '\n\n' : '') + t })
    setMsgs(all)
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText)
      const reader = r.body!.getReader(), dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let nl
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1)
          if (!line) continue
          const e = JSON.parse(line)
          if (e.type === 'text') update({ text: reply.text + e.text, status: '' })
          else if (e.type === 'status') update({ status: e.text })
          else if (e.type === 'error') note(e.text)
        }
      }
    } catch (e) { note((e as Error).message) }
    streaming.current = false
    await refresh().catch(() => update({ status: '' }))
    setBusy(false)
    load()
  }

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setText('')
    send(t)
  }

  async function newChat() {
    if (busy) return
    await api('DELETE', 'chat')
    setMsgs([])
  }

  return (
    <Page
      title={<span className="inline-flex items-center gap-2"><SparkleIcon className="size-4 fill-current text-claude" />Tars</span>}
      actions={<Button variant="ghost" size="sm" className="text-muted-foreground" onClick={newChat} disabled={busy}>New chat</Button>}
      className="pb-safe-24"
    >
      <div className="pt-3" style={{ paddingBottom: bottom }}>
        {msgs.length === 0 && <div className="px-5 py-16 text-center text-muted-foreground">Ask what's coming up, or say "add the … email to my tasks".</div>}
        {msgs.map((m, i) => (
          <div key={i} className={cn(
            'mb-2 max-w-5/6 rounded-2xl px-4 py-3 text-base leading-snug break-words',
            m.who === 'me' ? 'ml-auto rounded-br-md bg-primary/60' : 'rounded-bl-md bg-secondary',
          )}>
            <Markdown text={m.text} />
            {m.status && <div className="text-sm text-muted-foreground italic">{m.status}</div>}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        onSubmit={submit}
        autoComplete="off"
        style={{ bottom }}
        className="chrome-bar hairline-t fixed inset-x-0 z-20 px-3 pt-3 pb-safe-3"
      >
        <div className={cn('mx-auto flex items-end gap-2', pageWidth())}>
          <Textarea
            autoFocus
            rows={1}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            enterKeyHint="send"
            placeholder="Ask anything…"
            className="max-h-36 min-h-0 flex-1 resize-none rounded-2xl bg-secondary px-4 py-2 text-field dark:bg-secondary"
          />
          <Button type="submit" size="icon-lg" className="size-10 rounded-full" disabled={busy || !text.trim()} aria-label="Send">
            <ArrowUpIcon className="size-5" strokeWidth={2.6} />
          </Button>
        </div>
      </form>
    </Page>
  )
}
