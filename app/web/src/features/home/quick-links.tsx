import type { ReactNode } from 'react'
import { ShoppingCartIcon, UtensilsIcon } from 'lucide-react'
import { useBasket } from '@/features/food/data'
import { useTars } from '@/features/tasks/store'

export type QuickLink = { to: string; label: string; sub: string; count: number; icon: ReactNode }

export function useQuickLinks(): QuickLink[] {
  const { open, shoppingList } = useTars()
  const picked = useBasket().ids.length
  const left = shoppingList ? open.filter(x => x.projectId === shoppingList.id).length : 0
  return [
    { to: '/food', label: 'Food', sub: picked ? `${picked} dish${picked > 1 ? 'es' : ''} picked` : 'Pick dishes', count: picked, icon: <UtensilsIcon /> },
    { to: '/shopping', label: 'Shopping', sub: `${left} to buy`, count: left, icon: <ShoppingCartIcon /> },
  ]
}
