import { Link } from 'react-router'
import { useQuickLinks } from '../quick-links'

export function Actions() {
  return (
    <div className="mb-2 grid grid-cols-2 gap-3">
      {useQuickLinks().map(l => (
        <Link key={l.to} to={l.to} className="glass flex items-center gap-3 rounded-2xl p-4 text-left transition-transform active:scale-98">
          <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary [&_svg]:size-5">{l.icon}</span>
          <span>
            <b className="block text-base font-semibold">{l.label}</b>
            <small className="block text-xs text-muted-foreground">{l.sub}</small>
          </span>
        </Link>
      ))}
    </div>
  )
}
