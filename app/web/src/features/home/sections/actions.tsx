import type { ReactNode } from 'react'
import { ShoppingCartIcon, UtensilsIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useBasket } from '@/features/food/data'
import { useTars } from '@/features/tasks/store'

function Act({ icon, title, sub, to }: { icon: ReactNode; title: string; sub: string; to: string }) {
  return (
    <Link to={to} className="glass flex items-center gap-3 rounded-[20px] px-3.5 py-3 text-left transition-transform active:scale-[.98]">
      <span className="grid size-9 place-items-center rounded-full bg-white/8 [&_svg]:size-[18px]">{icon}</span>
      <span>
        <b className="block text-[15px]">{title}</b>
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
    <div className="mb-1.5 grid grid-cols-2 gap-2.5">
      <Act icon={<UtensilsIcon className="text-tomorrow" />} title="Food" sub={picked ? `${picked} dish${picked > 1 ? 'es' : ''} picked` : 'Pick dishes'} to="/food" />
      <Act icon={<ShoppingCartIcon className="text-today" />} title="Shopping" sub={`${left} to buy`} to="/shopping" />
    </div>
  )
}
