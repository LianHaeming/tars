import { Link } from 'react-router'
import { ChevronRightIcon } from 'lucide-react'
import { useToday } from './data'

export function BurmeseCard() {
  const data = useToday()
  if (data && !data.total) return null
  const p = data?.phrase

  return (
    <Link to="/burmese" className="glass block rounded-2xl p-4 transition-transform active:scale-98">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">Burmese, daily</span>
        <span className="inline-flex items-center text-xs font-semibold text-primary">
          Browse<ChevronRightIcon className="size-4" />
        </span>
      </div>
      {p ? (
        <div className="mt-3">
          <p lang="my" className="text-xl leading-snug font-semibold">{p.burmese}</p>
          <p className="mt-1 text-base text-primary">{p.phonetic}</p>
          <p className="mt-1 text-sm text-muted-foreground">{p.english}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Setting up your phrases…</p>
      )}
    </Link>
  )
}
