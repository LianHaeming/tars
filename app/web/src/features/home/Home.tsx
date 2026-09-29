import { useEffect, useRef, useState } from 'react'
import { longDate, today } from '@/lib/dates'
import { CompactBar } from './CompactBar'
import { LIST_SECTIONS, TOP_SECTIONS } from './sections'

export function Home() {
  const [collapsed, setCollapsed] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!end.current) return
    const io = new IntersectionObserver(([e]) => setCollapsed(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(end.current)
    return () => io.disconnect()
  }, [])

  return (
    <>
      <CompactBar shown={collapsed} />
      <main className="mx-auto max-w-page px-4 pt-safe-5 pb-safe-30">
        <header className="px-1 pt-2 pb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{longDate(today())}</header>
        {TOP_SECTIONS.map((S, i) => <S key={i} />)}
        <div className="relative"><div ref={end} className="above-header absolute h-px w-px" /></div>
        {LIST_SECTIONS.map((S, i) => <S key={i} />)}
      </main>
    </>
  )
}
