import { longDate, today } from '@/lib/dates'
import { SECTIONS } from './sections'

export function Home() {
  return (
    <main className="mx-auto max-w-[680px] px-4 pt-[calc(18px+env(safe-area-inset-top))] pb-[calc(120px+env(safe-area-inset-bottom))]">
      <header className="px-0.5 pt-2 pb-2.5 text-xs font-bold tracking-[.12em] text-[#9fb6cc] uppercase">{longDate(today())}</header>
      {SECTIONS.map((S, i) => <S key={i} />)}
    </main>
  )
}
