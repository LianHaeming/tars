import type { ReactNode } from 'react'
import { ShoppingCartIcon, UtensilsIcon } from 'lucide-react'
import { localGet } from '@/lib/api'
import { useTars } from '@/lib/store'

function Act({ icon, title, sub, onClick }: { icon: ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="glass flex items-center gap-3 rounded-[20px] px-3.5 py-3 text-left transition-transform active:scale-[.98]">
      <span className="grid size-9 place-items-center rounded-full bg-white/8 [&_svg]:size-[18px]">{icon}</span>
      <span>
        <b className="block text-[15px]">{title}</b>
        <small className="block text-xs text-muted-foreground">{sub}</small>
      </span>
    </button>
  )
}

export function Actions() {
  const { open, shoppingList, openPanel } = useTars()
  let picked = 0
  try { picked = (JSON.parse(localGet('basket') || '{}').ids || []).length } catch { /* bad json */ }
  const left = shoppingList ? open.filter(x => x.projectId === shoppingList.id).length : 0
  return (
    <div className="mb-1.5 grid grid-cols-2 gap-2.5">
      <Act icon={<UtensilsIcon className="text-tomorrow" />} title="Food" sub={picked ? `${picked} dish${picked > 1 ? 'es' : ''} picked` : 'Pick dishes'} onClick={() => openPanel('food')} />
      <Act icon={<ShoppingCartIcon className="text-today" />} title="Shopping" sub={`${left} to buy`} onClick={() => openPanel('shopping')} />
    </div>
  )
}
