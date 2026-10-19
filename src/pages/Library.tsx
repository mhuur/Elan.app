import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Plus, Repeat, SquarePen } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORIES, displayCategory, type Session } from '../types'
import { summarizeSession } from '../lib/format'
import { canonicalCycles, describeSchedule, ownerOf } from '../lib/schedule'
import { CategoryRing, DisplayTitle, Eyebrow, Fab, glassCard, primaryCls, secondaryCls } from '../components/ui'
import { Picto } from '../components/icons'
import { ProgramView } from '../components/CompleteSheet'

/**
 * Exercices — la liste des programmes (charte 21KM, planche Exercices). Une carte de 88 px
 * par programme : anneau de catégorie, nom, résumé, planification. Un tap la déplie SUR
 * PLACE (exercices en lecture seule + « Modifier ») ; un seul programme déplié à la fois.
 * Sur grand écran (≥ xl), le détail s'ouvre dans une colonne de 520 px à droite.
 * La banque d'exercices est un sous-écran (`/library/exercices`) atteint par l'en-tête.
 */
export default function Library() {
  const { sessions, exercises } = useData()
  const navigate = useNavigate()
  const [openId, setOpenId] = useState<string | null>(null)
  const cycles = useMemo(() => canonicalCycles(sessions), [sessions])
  // Par sport (ordre des catégories), puis dans l'ordre du store
  const ordered = CATEGORIES.flatMap((cat) => sessions.filter((s) => displayCategory(s, exercises) === cat))
  const exOf = (id: string) => exercises.find((e) => e.id === id)
  const opened = ordered.find((s) => s.id === openId)

  const detail = (s: Session) => (
    <>
      {/* Vélo et course n'ont pas d'exercices : le résumé de la carte suffit */}
      {s.items.length > 0 && (
        <div className="border-t border-hairline">
          <ProgramView session={s} exOf={exOf} />
        </div>
      )}
      <button type="button" onClick={() => navigate(`/session/${s.id}`)} className={'w-full ' + primaryCls}>
        <SquarePen className="h-5 w-5" /> Modifier
      </button>
    </>
  )

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 lg:gap-4 lg:px-10 lg:pt-8">
      <header className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <Eyebrow>Mes programmes{sessions.length ? ` · ${sessions.length}` : ''}</Eyebrow>
          <DisplayTitle>Exercices</DisplayTitle>
        </div>
        <button type="button" onClick={() => navigate('/library/exercices')} className={secondaryCls + ' !min-h-11 shrink-0 !px-4 !text-[15px]'}>
          Banque d'exercices
        </button>
        <button type="button" onClick={() => navigate('/session/new')} className={primaryCls + ' !hidden !min-h-11 shrink-0 !pr-[18px] !pl-3.5 !text-[15px] lg:!inline-flex'}>
          <Plus className="h-5 w-5" /> Programme
        </button>
      </header>

      {/* `grid-cols-1` n'est PAS redondant : sans lui la colonne implicite est `auto` et les
          libellés `nowrap` élargissent les cartes hors de l'écran. */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 lg:items-start xl:grid-cols-1">
        {ordered.map((s) => {
          const cat = displayCategory(s, exercises)
          const open = s.id === openId
          const when = describeSchedule(s, sessions, cycles)
          const planned = when !== 'Non planifié'
          // Jours de semaine (fixes ou rotation sur jours choisis) → calendrier ; cadence en
          // jours, alternance ou échauffement automatique → ↻
          const owner = ownerOf(s.id, sessions, cycles)
          const WhenIcon = s.days.length || owner?.repeat?.onDays?.length ? CalendarDays : Repeat
          return (
            <div key={s.id} className={'flex flex-col rounded-md bg-surface ' + (open ? 'ring-2 ring-ink' : 'ring-1 ring-hairline')}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : s.id)}
                className="flex min-h-[88px] w-full items-center gap-3 py-3 pr-3.5 pl-4 text-left"
              >
                <CategoryRing category={cat} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate text-[17px] leading-[22px] font-bold">{s.name}</p>
                  <span className="truncate text-sm leading-5 text-ink-soft">{summarizeSession(s)}</span>
                  {/* Un <div>, pas un <p> : cette ligne peut citer d'autres séances (« en alternance
                      avec HIIT — Cardio express ») et les vérifs ciblent le titre par `p:has-text("…")` */}
                  <div className={'flex items-center gap-1.5 text-sm leading-5 font-semibold ' + (planned ? 'text-sage-700' : 'text-ink-mute')}>
                    <WhenIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{when}</span>
                  </div>
                </span>
              </button>
              {open && <div className="flex flex-col gap-3 px-4 pb-4 xl:hidden">{detail(s)}</div>}
            </div>
          )
        })}
      </div>

      {sessions.length === 0 && (
        <section className={`flex flex-col items-center gap-3 px-6 py-8 text-center ${glassCard}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sage-50">
            <Picto name="grille" className="h-7 w-7" />
          </span>
          <h2 className="text-[22px] leading-7 font-extrabold">Aucun programme</h2>
          <p className="max-w-80 text-base leading-6 text-ink-soft">
            Un programme regroupe des exercices et les jours où le faire. Il apparaît ensuite dans le Planning et dans Aujourd'hui.
          </p>
          <button type="button" onClick={() => navigate('/session/new')} className={primaryCls + ' mt-1'}>
            <Plus className="h-5 w-5" /> Créer un programme
          </button>
        </section>
      )}

      {/* Grand écran : détail du programme choisi en colonne de 520 px */}
      {opened && (
        <aside
          aria-label={opened.name}
          className="fixed top-0 right-0 bottom-0 hidden w-[520px] flex-col gap-5 overflow-y-auto border-l border-hairline bg-surface px-7 py-8 xl:flex"
        >
          <div className="flex items-center gap-3.5">
            <CategoryRing category={displayCategory(opened, exercises)} size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5 font-semibold text-ink-soft">{summarizeSession(opened)}</p>
              <h2 className="text-[26px] leading-8 font-extrabold">{opened.name}</h2>
            </div>
          </div>
          {describeSchedule(opened, sessions, cycles) === 'Non planifié' && (
            <div className="flex items-center gap-2 rounded-sm bg-cream px-3.5 py-3 text-[15px] leading-5 font-semibold text-ink-soft">
              <CalendarDays className="h-5 w-5 shrink-0" />
              Non planifié : absent du Planning et d'Aujourd'hui
            </div>
          )}
          {detail(opened)}
        </aside>
      )}

      <div className="lg:hidden">
        <Fab label="+ Programme" onClick={() => navigate('/session/new')} />
      </div>
    </div>
  )
}
