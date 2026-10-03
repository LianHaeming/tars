import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-baseline justify-between hairline-b pt-5 pb-2 text-sm font-semibold', className)}>{children}</div>
}

export function SectionHead({ title, count, link, to, sticky, onToggle }: { title: string; count?: number; link?: string; to?: string; sticky?: boolean; collapsed?: boolean; onToggle?: () => void }) {
  const label = <span>{title}{count !== undefined && <span className="ml-1 opacity-70">{count}</span>}</span>
  return (
    <div className={cn('flex items-center justify-between pt-6 pb-1 font-semibold tracking-wider text-muted-foreground uppercase', sticky ? 'bg-page sticky top-below-filters z-20 text-lg' : 'hairline-b text-sm')}>
      {onToggle
        ? <button type="button" onClick={onToggle} className="-my-1 py-1 uppercase">{label}</button>
        : label}
      {link && to && (
        <Link to={to} className="inline-flex items-center text-sm font-semibold tracking-normal text-primary normal-case">
          {link}<ChevronRightIcon className="size-4" />
        </Link>
      )}
    </div>
  )
}

export function Empty({ icon, children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="px-5 py-14 text-center text-muted-foreground">
      {icon && <div className="mb-2 text-4xl">{icon}</div>}
      {children}
    </div>
  )
}

export const pill = 'inline-flex shrink-0 items-center gap-2 rounded-full bg-secondary px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors data-[on=true]:bg-foreground data-[on=true]:text-background'

export function PillBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <nav className={cn('scrollbar-none sticky top-below-header z-10 -mx-4 flex gap-2 overflow-x-auto bg-chrome px-4 pt-3 pb-3', className)}>
      {children}
    </nav>
  )
}

export const Dot = ({ color }: { color: string }) => <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
