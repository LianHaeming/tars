import { Link } from 'react-router'
import { CalendarDaysIcon, LanguagesIcon, ListChecksIcon, MailIcon, ShoppingCartIcon, UtensilsIcon, WalletIcon } from 'lucide-react'
import { today, ymd } from '@/lib/dates'
import { useBasket } from '@/features/food/data'
import { useInbox } from '@/features/inbox/data'
import { useTars } from '@/features/tasks/store'

function useApps() {
  const { open, shoppingList } = useTars()
  const picked = useBasket().ids.length
  const review = useInbox().candidates.length
  const t = ymd(today())
  const toBuy = open.filter(x => x.projectId === shoppingList?.id).length
  const coming = open.filter(x => x.due && x.due >= t).length
  const tasks = open.filter(x => x.projectId !== shoppingList?.id).length
  return [
    { to: '/food', label: 'Food', sub: picked ? `${picked} picked` : 'Pick dishes', icon: <UtensilsIcon /> },
    { to: '/shopping', label: 'Shopping', sub: `${toBuy} to buy`, icon: <ShoppingCartIcon /> },
    { to: '/month', label: 'Calendar', sub: `${coming} coming up`, icon: <CalendarDaysIcon /> },
    { to: '/lists', label: 'Lists', sub: `${tasks} tasks`, icon: <ListChecksIcon /> },
    { to: '/money', label: 'Money', sub: 'Monzo', icon: <WalletIcon /> },
    { to: '/inbox', label: 'Email', sub: review ? `${review} to review` : 'From Gmail', icon: <MailIcon />, dot: review > 0 },
    { to: '/burmese', label: 'Burmese', sub: 'Daily phrase', icon: <LanguagesIcon /> },
  ]
}

export function AppsPage() {
  const apps = useApps()
  return (
    <main className="mx-auto max-w-page px-4 pt-safe-5 pb-safe-30">
      <header className="px-1 pt-2 pb-5">
        <h1 className="text-2xl font-bold tracking-tight">Apps</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything else tars does.</p>
      </header>
      <div className="grid grid-cols-3 gap-3">
        {apps.map(a => (
          <Link
            key={a.to}
            to={a.to}
            className="glass relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center transition-transform active:scale-98"
          >
            {a.dot && <span className="absolute top-3 right-3 size-2.5 rounded-full bg-primary" />}
            <span className="grid size-10 place-items-center rounded-full bg-primary/15 text-primary [&_svg]:size-5">{a.icon}</span>
            <span className="w-full">
              <b className="block text-sm font-semibold">{a.label}</b>
              <small className="block truncate text-xs text-muted-foreground">{a.sub}</small>
            </span>
          </Link>
        ))}
      </div>
    </main>
  )
}
