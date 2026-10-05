import { api } from '@/lib/api'
import { useResource } from '@/lib/use-resource'

export type WaMessage = {
  id: string; at: number; fromMe: boolean; author: string; body: string; type: string; hasMedia: boolean
}
export type WaChat = { id: string; name: string; isGroup: boolean; lastAt: number; last: WaMessage | null }
export type WaStatus = 'offline' | 'starting' | 'connecting' | 'needs-login' | 'authenticating' | 'ready' | 'disconnected'
export type WaList = { status: WaStatus; me: { name?: string; number?: string } | null; updatedAt: number | null; chats: WaChat[] }
export type WaThread = { id: string; name: string; isGroup: boolean; messages: WaMessage[] }

const cache: { current: WaList | null } = { current: null }

export function useWhatsapp() {
  return useResource(() => api<WaList>('GET', 'whatsapp'), { cache, reloadOnVisible: true })
}
export function useThread(id: string) {
  return useResource(() => api<WaThread>('GET', `whatsapp/${encodeURIComponent(id)}`), { reloadOnVisible: true })
}

const MEDIA: Record<string, string> = {
  image: '📷 Photo', video: '🎥 Video', ptt: '🎙 Voice message', audio: '🎙 Audio',
  document: '📄 Document', sticker: 'Sticker', location: '📍 Location', vcard: '👤 Contact',
}
export function label(m: WaMessage | null): string {
  if (!m) return ''
  if (m.body) return m.body
  return MEDIA[m.type] || (m.hasMedia ? 'Attachment' : '')
}

export function clock(at: number) {
  return new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
export function when(at: number) {
  if (!at) return ''
  const d = new Date(at), now = new Date()
  if (d.toDateString() === now.toDateString()) return clock(at)
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  if (now.getTime() - at < 7 * 86400000) return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
export function dayLabel(at: number) {
  const d = new Date(at), now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}
