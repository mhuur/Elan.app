import { NavLink } from 'react-router-dom'
import { CalendarDays, Dumbbell, Sun, Target, TrendingUp } from 'lucide-react'

const items = [
  { to: '/', label: "Aujourd'hui", icon: Sun },
  { to: '/planning', label: 'Planning', icon: CalendarDays },
  { to: '/library', label: 'Exercices', icon: Dumbbell },
  { to: '/goals', label: 'Objectifs', icon: Target },
  { to: '/progress', label: 'Progrès', icon: TrendingUp },
]

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sand bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-lg">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition-colors ' +
              (isActive ? 'text-sage-600' : 'text-ink-soft/70')
            }
          >
            <it.icon className="h-6 w-6" strokeWidth={2} />
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
