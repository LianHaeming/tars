import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-baseline justify-between border-b border-border pt-5 pb-1.5 text-[13px] font-bold', className)}>{children}</div>
}

export function SectionHead({ title, count, link, to }: { title: string; count?: number; link?: string; to?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border pt-[22px] pb-1 text-[13px] font-bold tracking-[.08em] text-muted-foreground uppercase">
      <span>{title}{count !== undefined && <span className="ml-1 opacity-70">{count}</span>}</span>
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
      {icon && <div className="mb-1.5 text-4xl">{icon}</div>}
      {children}
    </div>
  )
}

export const pill = 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors data-[on=true]:bg-foreground data-[on=true]:text-background'

export function PillBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <nav className={cn('scrollbar-none sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 flex gap-1.5 overflow-x-auto bg-background/95 px-4 pt-3 pb-2.5 backdrop-blur', className)}>
      {children}
    </nav>
  )
}

export const Dot = ({ color }: { color: string }) => <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
