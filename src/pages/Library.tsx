import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronRight, Repeat, SquarePen } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META } from '../types'
import { summarizeSession } from '../lib/format'
import { canonicalCycles, describeSchedule, ownerOf } from '../lib/schedule'
import { CodeTile, EmptyState, Eyebrow, Fab, PrimaryButton, iconSquare } from '../components/ui'
import { ProgramView } from '../components/CompleteSheet'

/**
 * Exercices — la liste des programmes de l'utilisateur (onglet « Exercices », ex-« Séries »,
 * refonte de sept. 2026 sur la direction « aperçu déplié » choisie sur maquette). Une carte de
 * verre par programme, la même que sur Aujourd'hui ; un tap la déplie SUR PLACE — exercices
 * en lecture seule + bouton « Modifier » vers la fiche — et un seul programme est déplié à la
 * fois. Plus de section par sport : la tuile colorée le porte déjà.
 *
 * La banque d'exercices n'est PLUS un segment de même poids (`Seg` moitié-moitié, jusqu'en
 * août 2026) : c'est un sous-écran (`/library/exercices`, `ExerciseBank`) atteint par le
 * bouton de l'en-tête, parce qu'on ne s'y rend qu'occasionnellement pour de la maintenance.
 */
export default function Library() {
  const { sessions, exercises } = useData()
  const navigate = useNavigate()
  const [openId, setOpenId] = useState<string | null>(null)
  const cycles = useMemo(() => canonicalCycles(sessions), [sessions])
  // Par sport (ordre des catégories), puis dans l'ordre du store
  const ordered = CATEGORIES.flatMap((cat) => sessions.filter((s) => s.category === cat))
  const exOf = (id: string) => exercises.find((e) => e.id === id)

  return (
    <div>
      <header className="px-5 pt-8 pb-4">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>— Mes programmes</Eyebrow>
          <button
            type="button"
            onClick={() => navigate('/library/exercices')}
            className="flex items-center gap-1.5 rounded-sm border border-hairline px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink/60 active:bg-glass"
          >
            Banque d'exercices
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
        <h1 className="mt-2.5 font-display text-[min(13vw,52px)] leading-[0.86] font-black uppercase tracking-tight text-ink">
          Exercices
        </h1>
      </header>

      {/* Deux colonnes sur desktop (`main` élargi par App.tsx) ; `items-start` pour qu'une carte
          dépliée n'étire pas sa voisine. `grid-cols-1` n'est PAS redondant : sans lui la colonne
          implicite est `auto` et les libellés `nowrap` élargissent les cartes hors de l'écran. */}
      <div className="grid grid-cols-1 gap-2 px-5 lg:grid-cols-2 lg:items-start lg:gap-3">
        {ordered.map((s) => {
          const meta = CATEGORY_META[s.category]
          const open = s.id === openId
          const when = describeSchedule(s, sessions, cycles)
          const planned = when !== 'Non planifié'
          // Jours de semaine (fixes ou rotation sur jours choisis) → calendrier ; cadence en
          // jours, alternance ou échauffement automatique → ↻
          const owner = ownerOf(s.id, sessions, cycles)
          const WhenIcon = s.days.length || owner?.repeat?.onDays?.length ? CalendarDays : Repeat
          return (
            <div
              key={s.id}
              className={
                'rounded-md border backdrop-blur-lg ' +
                (open ? 'border-hairline-strong bg-glass-raised' : 'border-hairline bg-glass')
              }
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : s.id)}
                className="flex w-full items-center gap-3.5 p-4 text-left"
              >
                <CodeTile code={meta.code} hex={meta.hex} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-2xl leading-none font-bold uppercase">{s.name}</p>
                  <p className="mt-1 truncate font-mono text-[10px] tracking-[0.12em] uppercase text-ink/65">
                    {summarizeSession(s)}
                  </p>
                  {/* Un <div>, pas un <p> : cette ligne peut citer d'autres séances (« en alternance
                      avec HIIT — Cardio express ») et les vérifs Playwright ciblent le titre d'une
                      carte par `p:has-text("…")` */}
                  <div
                    className={
                      'mt-[3px] flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase ' +
                      (planned ? 'text-sage-500' : 'text-ink/40')
                    }
                  >
                    <WhenIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{when}</span>
                  </div>
                </div>
                <span className={iconSquare + ' text-sage-500'}>
                  <ChevronRight className={'h-4 w-4 transition-transform ' + (open ? 'rotate-90' : '')} />
                </span>
              </button>
              {open && (
                <div className="border-t border-hairline px-4 pt-2.5 pb-4">
                  {/* Vélo et running n'ont pas d'exercices : le résumé de la carte suffit */}
                  {s.items.length > 0 && <ProgramView session={s} exOf={exOf} />}
                  <div className="mt-3.5">
                    <PrimaryButton onClick={() => navigate(`/session/${s.id}`)}>
                      <span className="flex items-center justify-center gap-2">
                        <SquarePen className="h-4 w-4" /> Modifier
                      </span>
                    </PrimaryButton>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {sessions.length === 0 && (
        <div className="px-5">
          <EmptyState emoji="🗂️" text="Aucun programme. Créez-en un avec le bouton ci-dessous !" />
        </div>
      )}

      <Fab label="+ Programme" onClick={() => navigate('/session/new')} />
    </div>
  )
}
