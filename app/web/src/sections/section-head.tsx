import { ChevronRightIcon } from 'lucide-react'

export function SectionHead({ title, count, link, onLink }: { title: string; count?: number; link: string; onLink: () => void }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border pt-[22px] pb-1 text-[13px] font-bold tracking-[.08em] text-muted-foreground uppercase">
      <span>{title}{count !== undefined && <span className="ml-1 opacity-70">{count}</span>}</span>
      <button onClick={onLink} className="inline-flex items-center text-sm font-semibold tracking-normal text-primary normal-case">
        {link}<ChevronRightIcon className="size-4" />
      </button>
    </div>
  )
}
