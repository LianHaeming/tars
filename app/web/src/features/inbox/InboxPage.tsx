import { toast } from 'sonner'
import { CheckIcon, MailIcon, XIcon } from 'lucide-react'
import type { Candidate } from '@/lib/api'
import { dueColor, dueLabel } from '@/lib/dates'
import { Page } from '@/components/Page'
import { Empty } from '@/components/common'
import { Button } from '@/components/ui/button'
import { useTars } from '@/features/tasks/store'
import { useInbox } from './data'

function cleanSender(s: string) {
  const m = s.match(/^\s*"?([^"<]+?)"?\s*</)
  return (m ? m[1] : s.replace(/[<>]/g, '')).trim()
}

function Card({ c, onAccept, onDismiss }: { c: Candidate; onAccept: () => void; onDismiss: () => void }) {
  return (
    <li className="glass rounded-2xl p-4">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-base font-semibold">{c.title}</h2>
        {c.due && (
          <span className="shrink-0 text-sm font-semibold" style={{ color: dueColor(c.due) }}>
            {dueLabel(c.due)}{c.dueTime ? ` · ${c.dueTime}` : ''}
          </span>
        )}
      </div>
      {c.description && <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{c.description}</p>}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MailIcon className="size-3.5 shrink-0" />
        <span className="truncate">{cleanSender(c.sender)}{c.subject ? ` — ${c.subject}` : ''}</span>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onAccept} className="flex-1">
          <CheckIcon /> Add
        </Button>
        <Button size="sm" variant="secondary" onClick={onDismiss} className="flex-1">
          <XIcon /> Dismiss
        </Button>
      </div>
    </li>
  )
}

export function InboxPage() {
  const { candidates, loaded, accept, dismiss } = useInbox()
  const { load } = useTars()

  const onAccept = async (c: Candidate) => {
    await accept(c.id)
    await load()
    toast('Added to your tasks')
  }
  const onDismiss = async (c: Candidate) => {
    await dismiss(c.id)
    toast('Dismissed')
  }

  return (
    <Page title="From email" back="/apps">
      {loaded && !candidates.length ? (
        <Empty icon="📬">Nothing to review. New emails that look like tasks will show up here.</Empty>
      ) : (
        <ul className="space-y-3 pt-4">
          {candidates.map(c => (
            <Card key={c.id} c={c} onAccept={() => onAccept(c)} onDismiss={() => onDismiss(c)} />
          ))}
        </ul>
      )}
    </Page>
  )
}
