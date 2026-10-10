import type { Kind } from '../../../../shared/omarchy/drill.ts'

// A card's answer as it's pressed or typed: keys as keycaps ("Super + Shift + B"), commands in mono.
const CAP = 'glass rounded-md px-2 py-1 font-sans font-semibold'

export function Keys({ kind, text, big }: { kind: Kind; text: string; big?: boolean }) {
  if (kind === 'cmd') return <code className={big ? 'text-2xl font-bold text-primary' : 'font-semibold text-primary'}>{text}</code>
  return (
    <span className={big ? 'inline-flex flex-wrap items-center justify-center gap-2 text-xl text-primary' : 'inline-flex flex-wrap items-center gap-1 text-sm text-primary'}>
      {text.split(' + ').map((k, i) => <kbd key={i} className={CAP}>{k}</kbd>)}
    </span>
  )
}
