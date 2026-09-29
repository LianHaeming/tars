import { TaskRow } from '@/features/tasks/TaskRow'
import { byPriority, useTars } from '@/features/tasks/store'
import { SectionHead } from '@/components/common'

export function Tasks() {
  const { open, shoppingList } = useTars()
  const items = open.filter(x => !x.due && x.projectId !== shoppingList?.id).sort(byPriority)
  return (
    <section>
      <SectionHead title="Tasks" count={items.length} link="All lists" to="/lists" />
      {items.map(x => <TaskRow key={x.id} task={x} compact />)}
      {!items.length && <div className="py-4 text-sm text-muted-foreground">All clear.</div>}
    </section>
  )
}
