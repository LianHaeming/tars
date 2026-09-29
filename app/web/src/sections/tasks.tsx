import { TaskRow } from '@/components/TaskRow'
import { byPriority, useTars } from '@/lib/store'
import { SectionHead } from './section-head'

export function Tasks() {
  const { open, shoppingList, openPanel } = useTars()
  const items = open.filter(x => !x.due && x.projectId !== shoppingList?.id).sort(byPriority)
  return (
    <section>
      <SectionHead title="Tasks" count={items.length} link="All lists" onLink={() => openPanel('lists')} />
      {items.map(x => <TaskRow key={x.id} task={x} compact />)}
      {!items.length && <div className="py-3.5 text-sm text-muted-foreground">All clear.</div>}
    </section>
  )
}
