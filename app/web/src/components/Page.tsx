import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ChevronLeftIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type Props = {
  title: ReactNode
  back?: string
  actions?: ReactNode
  wide?: boolean
  bare?: boolean
  className?: string
  children: ReactNode
}

export const pageWidth = (wide?: boolean) => (wide ? 'max-w-5xl' : 'max-w-page')

export function Page({ title, back = '/', actions, wide, bare, className, children }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(back))

  return (
    <div className="min-h-dvh animate-in duration-200 fade-in slide-in-from-right-3">
      <header className="chrome-bar sticky top-0 z-20 border-x-0 border-t-0 pt-safe-0">
        <div className={cn('mx-auto flex h-14 items-center gap-1 px-2', pageWidth(wide))}>
          <Button variant="ghost" size="icon-lg" onClick={goBack} aria-label="Back" className="text-primary">
            <ChevronLeftIcon className="size-6" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight">{title}</h1>
          {actions && <div className="flex items-center gap-1 pr-2">{actions}</div>}
        </div>
      </header>
      {bare ? children : (
        <main className={cn('mx-auto px-4 pb-safe-30', pageWidth(wide), className)}>
          {children}
        </main>
      )}
    </div>
  )
}
