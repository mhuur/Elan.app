import { NavLink } from 'react-router-dom'
import { Logo, Picto, type PictoName } from './icons'

const items: { to: string; label: string; icon: PictoName }[] = [
  { to: '/', label: "Aujourd'hui", icon: 'soleil' },
  { to: '/planning', label: 'Planning', icon: 'planning' },
  { to: '/plan', label: 'Plan', icon: 'drapeau' },
  { to: '/library', label: 'Exercices', icon: 'grille' },
  // Onglet « Objectifs » masqué (route /goals conservée) ; « Progrès » supprimé (août 2026)
]

/**
 * Navigation principale (planche Composants, « Barre de navigation ») : barre du bas sur
 * téléphone — onglet choisi = pilule Volt de 56 × 32 autour de l'icône, libellé gras —,
 * barre latérale de 232 px sur bureau (≥ lg), avec le logo en tête.
 */
export default function BottomNav({ sideOnly }: { sideOnly?: boolean }) {
  return (
    <>
      {!sideOnly && (
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface px-2 pt-1.5 pb-[max(14px,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="mx-auto flex max-w-lg">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === '/'}
              className={({ isActive }) =>
                'group flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[13px] leading-[18px] ' +
                (isActive ? 'font-bold text-ink' : 'font-medium text-ink-mute')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={
                      'flex h-8 w-14 items-center justify-center rounded-full ' +
                      (isActive ? 'bg-sage-500' : 'group-active:bg-sage-50')
                    }
                  >
                    <Picto name={it.icon} />
                  </span>
                  {it.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      )}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col gap-1.5 border-r border-hairline bg-surface px-4 py-7 lg:flex"
      >
        <div className="flex items-center gap-2.5 px-2 pb-7">
          <Logo size={36} label={false} />
          <span className="text-[26px] font-extrabold">21KM</span>
        </div>
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={({ isActive }) =>
              'flex h-12 items-center gap-3 rounded-full px-3.5 text-base ' +
              (isActive ? 'bg-sage-500 font-bold text-ink' : 'font-medium text-ink-soft hover:bg-sage-50')
            }
          >
            <Picto name={it.icon} />
            {it.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
