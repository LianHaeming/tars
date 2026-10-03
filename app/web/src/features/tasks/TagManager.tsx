import { useState, type ReactNode } from 'react'
import { Trash2Icon } from 'lucide-react'
import { useTars } from '@/features/tasks/store'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dot } from '@/components/common'

function TagRow({ id, name, color }: { id: string; name: string; color: string }) {
  const { renameProject, deleteProject } = useTars()
  const [value, setValue] = useState(name)
  const [confirm, setConfirm] = useState(false)
  const save = () => { const v = value.trim(); if (v && v !== name) renameProject(id, v); else setValue(name) }
  return (
    <div className="flex items-center gap-2 hairline-b py-2">
      <Dot color={color} />
      <Input
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className="h-9 flex-1 text-field"
      />
      {confirm ? (
        <>
          <Button size="sm" variant="destructive" onClick={() => deleteProject(id)}>Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
        </>
      ) : (
        <Button size="icon-sm" variant="ghost" className="text-muted-foreground" aria-label={`Delete ${name}`} onClick={() => setConfirm(true)}><Trash2Icon /></Button>
      )}
    </div>
  )
}

export function TagManager({ trigger, onCreate }: { trigger: ReactNode; onCreate?: (id: string) => void }) {
  const { state, addProject } = useTars()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const add = async () => { const v = name.trim(); if (!v) return; setName(''); const p = await addProject(v); onCreate?.(p.id) }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tags</DialogTitle>
          <DialogDescription>Add a tag, rename one, or delete it — its tasks move to Inbox.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto scrollbar-none">
          {state.projects.map(p => <TagRow key={p.id} id={p.id} name={p.name} color={p.color} />)}
          {!state.projects.length && <p className="py-2 text-sm text-muted-foreground">No tags yet.</p>}
        </div>
        <form onSubmit={e => { e.preventDefault(); add() }} className="flex items-center gap-2 hairline-t pt-3">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="New tag" className="h-9 flex-1 text-field" />
          <Button type="submit" disabled={!name.trim()}>Add</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
