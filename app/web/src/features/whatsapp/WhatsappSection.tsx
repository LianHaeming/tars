import { Link } from 'react-router'
import { ChevronRightIcon, UsersIcon } from 'lucide-react'
import { Empty } from '@/components/common'
import { useWhatsapp, label, when, type WaChat, type WaStatus } from './data'

const NEEDS_LOGIN: Partial<Record<WaStatus, string>> = {
  offline: 'WhatsApp capture isn’t running yet. On the PC: bin/whatsapp login, then bin/whatsapp install.',
  'needs-login': 'WhatsApp needs linking again. On the PC run: bin/whatsapp login',
  disconnected: 'WhatsApp disconnected — it should reconnect on its own in a moment.',
  authenticating: 'Linking… this page will fill in once your messages sync.',
  connecting: 'Connecting to WhatsApp…',
  starting: 'Starting up…',
}

function Banner({ children }: { children: string }) {
  return <div className="glass mt-3 rounded-2xl p-4 text-sm text-muted-foreground">{children}</div>
}

function Avatar({ chat }: { chat: WaChat }) {
  const initial = (chat.name || '?').trim().charAt(0).toUpperCase()
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-base font-semibold text-muted-foreground">
      {chat.isGroup ? <UsersIcon className="size-5" /> : initial}
    </span>
  )
}

function ChatRow({ chat }: { chat: WaChat }) {
  const preview = label(chat.last)
  const mine = chat.last?.fromMe
  return (
    <Link to={`/whatsapp/${encodeURIComponent(chat.id)}`} className="hairline-b flex items-center gap-3 px-1 py-3 transition-opacity active:opacity-70">
      <Avatar chat={chat} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">{chat.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{when(chat.lastAt)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
          {mine && <span className="shrink-0 opacity-70">You:</span>}
          <span className="truncate">{preview || '—'}</span>
        </span>
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

export function WhatsappSection() {
  const { data, error, loading } = useWhatsapp()
  if (error) return <Banner>{error}</Banner>
  if (!data && loading) return <Banner>Loading…</Banner>
  if (!data) return null

  const note = NEEDS_LOGIN[data.status]
  return (
    <div>
      {note && <Banner>{note}</Banner>}
      {data.status === 'ready' && !data.chats.length ? (
        <Empty icon="💬">No messages captured yet.</Empty>
      ) : (
        <ul className="mt-2">
          {data.chats.map(c => <li key={c.id}><ChatRow chat={c} /></li>)}
        </ul>
      )}
    </div>
  )
}
