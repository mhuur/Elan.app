import { NavLink } from 'react-router-dom'
import { CalendarDays, Dumbbell, Route, Sun, TrendingUp } from 'lucide-react'

const items = [
  { to: '/', label: "Aujourd'hui", icon: Sun },
  { to: '/planning', label: 'Planning', icon: CalendarDays },
  { to: '/plan', label: '21K', icon: Route },
  { to: '/library', label: 'Séries', icon: Dumbbell },
  // Onglet « Objectifs » masqué pour l'instant (route /goals conservée) — non utilisé
  { to: '/progress', label: 'Progrès', icon: TrendingUp },
]

export default function BottomNav() {
  return (
    // Charte bord de mer : verre dépoli sur la photo, libellés en mono capitales, et
    // l'onglet actif se marque par un filet HAUT de 2 px (pas par un fond).
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-cream/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              'flex flex-1 flex-col items-center gap-1.5 border-t-2 pt-3 pb-3.5 font-mono text-[9px] tracking-[0.14em] uppercase transition-colors ' +
              (isActive ? 'border-t-sage-500 text-sage-500' : 'border-t-transparent text-ink/55')
            }
          >
            <it.icon className="h-5 w-5" strokeWidth={1.5} />
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
