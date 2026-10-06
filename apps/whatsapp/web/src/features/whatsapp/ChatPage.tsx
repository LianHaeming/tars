import { Fragment } from 'react'
import { useParams } from 'react-router'
import { Page } from '@tars/ui/components/Page'
import { Empty } from '@tars/ui/components/common'
import { cn } from '@tars/ui/lib/utils'
import { useThread, label, clock, dayLabel, type WaMessage } from './data'

function DayDivider({ at }: { at: number }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">{dayLabel(at)}</span>
    </div>
  )
}

function Bubble({ m, group }: { m: WaMessage; group: boolean }) {
  return (
    <div className={cn('flex', m.fromMe ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3 py-2 text-base',
          m.fromMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
        )}
      >
        {group && !m.fromMe && m.author && <div className="mb-0.5 text-xs font-semibold text-primary">{m.author}</div>}
        <div className="break-words whitespace-pre-wrap">{label(m)}</div>
        <div className={cn('mt-0.5 text-right text-xs tabular-nums', m.fromMe ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {clock(m.at)}
        </div>
      </div>
    </div>
  )
}

export function ChatPage() {
  const { id = '' } = useParams()
  const { data, error, loading } = useThread(id)

  return (
    <Page title={data?.name || 'Chat'} back="/">
      {error ? (
        <Empty>{error}</Empty>
      ) : !data && loading ? (
        <Empty>Loading…</Empty>
      ) : !data || !data.messages.length ? (
        <Empty icon="💬">No messages here yet.</Empty>
      ) : (
        <div className="flex flex-col gap-1.5 pt-3">
          {data.messages.map((m, i) => {
            const prev = data.messages[i - 1]
            const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString()
            return (
              <Fragment key={m.id}>
                {newDay && <DayDivider at={m.at} />}
                <Bubble m={m} group={data.isGroup} />
              </Fragment>
            )
          })}
        </div>
      )}
    </Page>
  )
}
