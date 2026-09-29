import { longDate, today } from '@/lib/dates'
import { SECTIONS } from './sections'

export function Home() {
  return (
    <main className="mx-auto max-w-page px-4 pt-safe-5 pb-safe-30">
      <header className="px-1 pt-2 pb-3 text-xs font-bold tracking-widest text-muted-foreground uppercase">{longDate(today())}</header>
      {SECTIONS.map((S, i) => <S key={i} />)}
    </main>
  )
}
