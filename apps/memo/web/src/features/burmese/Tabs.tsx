import { NavLink, Outlet } from 'react-router'
import { BookOpenIcon, LayersIcon, SparklesIcon, WholeWordIcon } from 'lucide-react'
import { Button } from '@tars/ui/components/ui/button'

const TABS = [
  { to: '/burmese', label: 'Learn', icon: LayersIcon },
  { to: '/burmese/words', label: 'Words', icon: WholeWordIcon },
  { to: '/burmese/sentences', label: 'Phrases', icon: BookOpenIcon },
  { to: '/burmese/ask', label: 'Ask', icon: SparklesIcon },
]

export function Tabs() {
  return (
    <main className="mx-auto max-w-page px-4 pt-safe-3 pb-safe-40">
      <Outlet />
      <nav className="dock fixed bottom-safe-2 left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-full p-1">
        {TABS.map(({ to, label, icon: Icon }) => (
          <Button key={to} asChild variant="ghost"
            className="h-auto w-19 flex-col gap-1 rounded-full pt-2 pb-1 text-muted-foreground hover:bg-transparent aria-[current=page]:bg-foreground/12 aria-[current=page]:text-foreground [&_svg:not([class*='size-'])]:size-5">
            <NavLink to={to} end><Icon /><span className="text-xxs">{label}</span></NavLink>
          </Button>
        ))}
      </nav>
    </main>
  )
}
