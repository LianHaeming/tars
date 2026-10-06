import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRightIcon, CompassIcon, LanguagesIcon, MessageCircleIcon, UtensilsCrossedIcon, WalletIcon } from 'lucide-react'
import { appUrl } from '@tars/ui/lib/apps'
import { useInbox } from '@/features/inbox/data'

function AppCard({ to, title, children }: { to: string; title: string; children: ReactNode }) {
  return (
    <Link to={to} className="glass block rounded-2xl p-4 transition-opacity active:opacity-80">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <span className="inline-flex items-center text-xs font-semibold text-primary">Open<ChevronRightIcon className="size-4" /></span>
      </div>
      <div className="mt-3">{children}</div>
    </Link>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function EmailCard() {
  const { candidates } = useInbox()
  if (!candidates.length) return null
  return (
    <div className="pt-3">
      <AppCard to="/inbox" title="Email">
        <Stat value={String(candidates.length)} label={`new ${candidates.length === 1 ? 'email' : 'emails'} to review`} />
        <ul className="mt-3 space-y-1">
          {candidates.slice(0, 3).map(c => <li key={c.id} className="truncate text-sm text-muted-foreground">{c.title}</li>)}
        </ul>
      </AppCard>
    </div>
  )
}

const APPS: { to: string; title: string; subtitle: string; Icon: ComponentType<{ className?: string }>; color: string }[] = [
  { to: appUrl('burmese'), title: 'Burmese', subtitle: 'Practice · phrase of the day · translate', Icon: LanguagesIcon, color: 'var(--week)' },
  { to: '/money', title: 'Money', subtitle: 'Balance · spending · what’s coming', Icon: WalletIcon, color: 'var(--money)' },
  { to: '/food', title: 'Food', subtitle: 'Menu · recipes · shopping list', Icon: UtensilsCrossedIcon, color: 'var(--today)' },
  { to: appUrl('discover'), title: 'Discover', subtitle: 'Cool GitHub repos, picked daily', Icon: CompassIcon, color: 'var(--chart-2)' },
  { to: appUrl('whatsapp'), title: 'WhatsApp', subtitle: 'Your messages, captured', Icon: MessageCircleIcon, color: 'var(--chat)' },
]

function AppTile({ to, title, subtitle, Icon, color }: (typeof APPS)[number]) {
  return (
    <Link to={to} className="glass flex items-center gap-4 rounded-2xl p-4 transition-transform active:scale-98">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>
        <Icon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}

export function AppsPage() {
  return (
    <main className="mx-auto max-w-page px-4 pt-safe-2 pb-safe-40">
      <h1 className="pt-3 pb-1 text-2xl font-bold tracking-tight">Apps</h1>
      <EmailCard />
      <div className="mt-3 grid gap-3">
        {APPS.map(a => <AppTile key={a.to} {...a} />)}
      </div>
    </main>
  )
}
