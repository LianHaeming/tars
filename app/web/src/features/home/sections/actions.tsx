import type { ReactNode } from 'react'
import { ShoppingCartIcon, UtensilsIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useBasket } from '@/features/food/data'
import { useTars } from '@/features/tasks/store'

function Act({ icon, title, sub, to }: { icon: ReactNode; title: string; sub: string; to: string }) {
  return (
    <Link to={to} className="glass flex items-center gap-3 rounded-2xl p-4 text-left transition-transform active:scale-98">
      <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary [&_svg]:size-5">{icon}</span>
      <span>
        <b className="block text-base font-semibold">{title}</b>
        <small className="block text-xs text-muted-foreground">{sub}</small>
      </span>
    </Link>
  )
}

export function Actions() {
  const { open, shoppingList } = useTars()
  const picked = useBasket().ids.length
  const left = shoppingList ? open.filter(x => x.projectId === shoppingList.id).length : 0
  return (
    <div className="mb-2 grid grid-cols-2 gap-3">
      <Act icon={<UtensilsIcon />} title="Food" sub={picked ? `${picked} dish${picked > 1 ? 'es' : ''} picked` : 'Pick dishes'} to="/food" />
      <Act icon={<ShoppingCartIcon />} title="Shopping" sub={`${left} to buy`} to="/shopping" />
    </div>
  )
}
