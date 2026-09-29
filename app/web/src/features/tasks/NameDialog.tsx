import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type Props = {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  action: string
  initial?: string
  onSubmit: (name: string) => void
}

export function NameDialog({ open, onOpenChange, title, action, initial = '', onSubmit }: Props) {
  const [name, setName] = useState(initial)
  useEffect(() => { if (open) setName(initial) }, [open, initial])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form
          className="grid gap-4"
          onSubmit={e => {
            e.preventDefault()
            if (!name.trim()) return
            onSubmit(name.trim())
            onOpenChange(false)
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">{title}</DialogDescription>
          </DialogHeader>
          <Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="List name" />
          <DialogFooter>
            <Button type="submit" disabled={!name.trim()}>{action}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
