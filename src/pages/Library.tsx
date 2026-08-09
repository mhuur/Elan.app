import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META } from '../types'
import { summarizeSession } from '../lib/format'
import { describeSchedule } from '../lib/schedule'
import { CategoryIcon, EmptyState, Fab, PageHeader } from '../components/ui'

/**
 * Mes séances — l'écran de l'onglet. La banque d'exercices n'est PLUS un segment de
 * même poids (`Seg` moitié-moitié, jusqu'en août 2026) : c'est un sous-écran
 * (`/library/exercices`, `ExerciseBank`) atteint par le lien de l'en-tête, parce qu'on
 * ne s'y rend qu'occasionnellement pour de la maintenance.
 */
export default function Library() {
  const { sessions } = useData()
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader kicker="Bibliothèque de bord" title="Séries" />
      <div className="flex justify-end px-5 pb-3">
        <button
          type="button"
          onClick={() => navigate('/library/exercices')}
          className="flex items-center gap-1.5 rounded-sm border border-hairline px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-ink/60 active:bg-glass"
        >
          Banque d'exercices
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="space-y-4 px-5">
        {CATEGORIES.map((cat) => {
          const list = sessions.filter((s) => s.category === cat)
          if (!list.length) return null
          const meta = CATEGORY_META[cat]
          return (
            <section key={cat}>
              <h2 className={`mb-1.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase ${meta.text}`}>
                <CategoryIcon category={cat} className="h-3.5 w-3.5" /> — {meta.label}
              </h2>
              {/* Lignes séparées par un filet, sans carte : la maquette laisse la photo
                  respirer entre les sections plutôt que d'empiler des pavés. */}
              <div>
                {list.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => navigate(`/session/${s.id}`)}
                    className={
                      'flex w-full items-center gap-2.5 py-2.5 text-left ' +
                      (i < list.length - 1 ? 'border-b border-hairline' : '')
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[21px] leading-none font-bold uppercase">{s.name}</p>
                      <p className="mt-1 truncate font-mono text-[9px] tracking-[0.1em] uppercase text-ink/60">
                        {summarizeSession(s)}
                      </p>
                    </div>
                    <span className="max-w-36 shrink-0 truncate rounded-full border border-hairline-strong px-2.5 py-[3px] font-mono text-[9px] tracking-[0.1em] uppercase text-ink/70">
                      {describeSchedule(s, sessions)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
        {sessions.length === 0 && <EmptyState emoji="🗂️" text="Aucune séance. Créez-en une avec le bouton ci-dessous !" />}
      </div>

      <Fab label="+ Séance" onClick={() => navigate('/session/new')} />
    </div>
  )
}
