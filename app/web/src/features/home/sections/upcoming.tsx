import { TaskRow } from '@/features/tasks/TaskRow'
import { byWhen, useTars } from '@/features/tasks/store'
import { nextItem } from './next-up'
import { SectionHead } from '@/components/common'

export function Upcoming() {
  const { open } = useTars()
  const next = nextItem(open)
  const items = open.filter(x => x.due && x !== next).sort(byWhen)
  return (
    <section>
      <SectionHead title="Upcoming" link="Month" to="/month" />
      {items.map(x => <TaskRow key={x.id} task={x} compact />)}
      {!items.length && <div className="py-3.5 text-sm text-muted-foreground">Nothing else dated{next ? '' : ' coming up'}.</div>}
    </section>
  )
}
