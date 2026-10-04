import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { bySubtype, subtypesOf, type Exercise } from '../types'
import { Play, Plus } from 'lucide-react'
import { EmptyState, Fab, PageHeader, glassCard } from '../components/ui'

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Groupes de sous-types (un exercice multi-tags apparaît dans chacun) : ordre alphabétique, « sans » à la fin */
function subtypeGroups(list: Exercise[]): [string, Exercise[]][] {
  const map = new Map<string, Exercise[]>()
  for (const e of list) {
    const sts = subtypesOf(e)
    for (const k of sts.length ? sts : ['']) {
      const arr = map.get(k)
      if (arr) arr.push(e)
      else map.set(k, [e])
    }
  }
  // Ordre alphabétique, « Autres » (sans sous-type) à la fin
  return [...map.entries()].sort((a, b) => (!a[0] ? 1 : !b[0] ? -1 : bySubtype(a[0], b[0])))
}

/**
 * Banque d'exercices — SOUS-ÉCRAN de « Mes séances » (`/library`), atteint par le lien
 * de son en-tête. Elle ne partage plus un `Seg` moitié-moitié avec les séances : on n'y
 * vient qu'occasionnellement, pour corriger un nom, un sous-type, une mesure sec/reps ou
 * une URL de démo — la CRÉATION d'exercice, elle, passe par la combobox « + Créer » de
 * la fiche séance (demande utilisateur, août 2026). Depuis oct. 2026 la liste est rangée
 * par sous-type seulement : les exercices n'ont plus de catégorie.
 */
export default function ExerciseBank() {
  const { exercises } = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const visibleExercises = exercises.filter(
    (e) =>
      !query.trim() ||
      norm(e.name).includes(norm(query)) ||
      subtypesOf(e).some((st) => norm(st).includes(norm(query))),
  )

  return (
    <div>
      <PageHeader kicker="Bibliothèque de bord" title="Banque d'exercices" onBack={() => navigate('/library')} />
      <div className="space-y-4 px-5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un exercice ou un sous-type…"
          className="w-full rounded-sm border border-hairline bg-glass-sunken px-4 py-3 text-sm font-semibold outline-none backdrop-blur-lg placeholder:font-normal placeholder:text-ink/40 focus:border-sage-500"
        />
        <div className="space-y-2.5">
          {subtypeGroups(visibleExercises).map(([subtype, exos]) => (
            <div key={subtype || '—'}>
              <div className="mb-1 flex items-center justify-between px-1">
                <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink/50">{subtype || 'Autres'}</p>
                {subtype && (
                  <button
                    type="button"
                    aria-label={`Nouvel exercice ${subtype}`}
                    onClick={() => navigate(`/exercise/new?st=${encodeURIComponent(subtype)}`)}
                    className="flex h-5 w-5 items-center justify-center rounded-xs border border-hairline text-ink/60 active:bg-glass"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className={'overflow-hidden ' + glassCard}>
                {exos.map((e, i) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => navigate(`/exercise/${e.id}`)}
                    className={
                      'flex w-full items-center gap-2 px-3.5 py-2.5 text-left active:bg-glass-raised ' +
                      (i > 0 ? 'border-t border-hairline' : '')
                    }
                  >
                    <span className="min-w-0 flex-1 truncate font-display text-lg leading-none font-bold uppercase">
                      {e.name}
                    </span>
                    {e.measure === 'sec' && (
                      <span className="shrink-0 rounded-full border border-hairline px-2 py-[3px] font-mono text-[8px] tracking-[0.1em] uppercase text-ink/60">
                        sec
                      </span>
                    )}
                    {e.videoUrl && (
                      <a
                        href={e.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(ev) => ev.stopPropagation()}
                        className="flex shrink-0 items-center gap-1 rounded-full border border-velo/40 px-2 py-[3px] font-mono text-[8px] tracking-[0.1em] uppercase text-velo"
                      >
                        <Play className="h-2.5 w-2.5" /> démo
                      </a>
                    )}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-sage-500">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {exercises.length === 0 && <EmptyState emoji="💪" text="Aucun exercice. Créez-en un avec le bouton ci-dessous !" />}
        {exercises.length > 0 && visibleExercises.length === 0 && (
          <EmptyState emoji="🔍" text={`Aucun exercice ne correspond à « ${query} ».`} />
        )}
      </div>

      <Fab label="+ Exercice" onClick={() => navigate('/exercise/new')} />
    </div>
  )
}
