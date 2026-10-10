export type Task = {
  id: string
  title: string
  description: string
  due: string | null
  dueTime: string | null
  projectId: string | null
  subId: string | null
  done: boolean
  repeat?: string | null
  createdAt: number
  completedAt: number | null
}

export type Sub = { id: string; name: string }
export type Project = { id: string; name: string; color: string; subs?: Sub[] }

export type State = { projects: Project[]; tasks: Task[] }

export type Candidate = {
  id: string
  title: string
  due: string | null
  dueTime: string | null
  description: string
  sender: string
  subject: string
  emailDate: string
  kind?: 'task' | 'reminder'
  createdAt: number
}
