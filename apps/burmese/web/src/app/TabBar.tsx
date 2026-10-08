import { NavLink } from 'react-router'
import { BookOpenIcon, MessageCircleIcon, SparklesIcon } from 'lucide-react'
import { Button } from '@tars/ui/components/ui/button'

const TABS = [
  { to: '/', label: 'Exercises', icon: SparklesIcon },
  { to: '/ask', label: 'Ask Claude', icon: MessageCircleIcon },
  { to: '/sentences', label: 'Sentences', icon: BookOpenIcon },
]

export function TabBar() {
  return (
    <nav className="tabbar fixed inset-x-4 bottom-safe-3 z-30 mx-auto flex max-w-sm justify-around rounded-full p-1">
      {TABS.map(({ to, label, icon: Icon }) => (
        <Button key={to} asChild variant="ghost" size="block"
          className="flex-1 flex-col gap-1 rounded-full px-2 py-2 text-xs text-muted-foreground hover:bg-transparent aria-[current=page]:bg-secondary aria-[current=page]:text-primary [&_svg:not([class*='size-'])]:size-5">
          <NavLink to={to} end>
            <Icon />
            {label}
          </NavLink>
        </Button>
      ))}
    </nav>
  )
}
