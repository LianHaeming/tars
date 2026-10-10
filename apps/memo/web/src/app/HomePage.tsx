import type { ComponentType } from 'react'
import { ChevronRightIcon, CommandIcon, LanguagesIcon } from 'lucide-react'
import { LargeTitle } from '@tars/ui/components/deck'

const DECKS: { href: string; title: string; about: string; Icon: ComponentType }[] = [
  { href: '/burmese/', title: 'Burmese', about: 'Sentences, words, phrases and Ask', Icon: LanguagesIcon },
  { href: '/omarchy/', title: 'Omarchy', about: 'Keybindings and commands', Icon: CommandIcon },
]

export function HomePage() {
  return (
    <main className="mx-auto max-w-page px-4 pt-safe-3 pb-safe-16">
      <LargeTitle title="Memo" />
      <div className="mt-6 grid gap-3">
        {DECKS.map(({ href, title, about, Icon }) => (
          <a key={href} href={href} className="deck-card flex items-center gap-4 rounded-3xl p-5 active:scale-98 [&_svg]:size-6">
            <Icon />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold">{title}</div>
              <div className="text-sm text-muted-foreground">{about}</div>
            </div>
            <ChevronRightIcon className="text-muted-foreground" />
          </a>
        ))}
      </div>
    </main>
  )
}
