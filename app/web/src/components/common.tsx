import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRightIcon, TagIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-baseline justify-between hairline-b pt-5 pb-2 text-sm font-semibold', className)}>{children}</div>
}

export function SectionHead({ title, count, link, to, lg }: { title: string; count?: number; link?: string; to?: string; lg?: boolean }) {
  const label = <span>{title}{count !== undefined && <span className="ml-1 opacity-70">{count}</span>}</span>
  return (
    <div className={cn('flex items-center justify-between pt-6 pb-1 font-semibold tracking-wider text-muted-foreground uppercase', lg ? 'text-lg' : 'hairline-b text-sm')}>
      {label}
      {link && to && (
        <Button asChild variant="link" size="inline" className="text-sm tracking-normal normal-case">
          <Link to={to}>{link}<ChevronRightIcon className="size-4" /></Link>
        </Button>
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

export function FilterBar({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={v => v && onValueChange(v)}
      spacing={1}
      className="dock scrollbar-none sticky top-safe-2 z-30 w-full justify-start overflow-x-auto rounded-full p-1"
    >
      {children}
    </ToggleGroup>
  )
}

export function FilterLabel({ value, color, children }: { value: string; color?: string; children: ReactNode }) {
  return (
    <ToggleGroupItem
      value={value}
      className="h-auto shrink-0 gap-1.5 rounded-full px-3 py-2.5 text-base font-semibold whitespace-nowrap text-muted-foreground hover:bg-transparent data-[state=on]:bg-foreground data-[state=on]:text-background [&_svg]:size-4"
    >
      {color && <TagIcon style={{ color }} />}
      {children}
    </ToggleGroupItem>
  )
}

export const Dot = ({ color }: { color: string }) => <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
