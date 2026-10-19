import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { useData } from '../data/DataContext'
import { bySubtype, subtypesOf, type Exercise } from '../types'
import { DisplayTitle, EmptyState, Eyebrow, Fab, iconSquare, primaryCls } from '../components/ui'
import { Picto } from '../components/icons'

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
  return [...map.entries()].sort((a, b) => (!a[0] ? 1 : !b[0] ? -1 : bySubtype(a[0], b[0])))
}

/**
 * Banque d'exercices — sous-écran de « Exercices » (`/library`), pour la maintenance : nom,
 * sous-type, mesure, vidéo. Charte 21KM (planche Exercices, état « banque ») : recherche,
 * filtre de sous-type en MENU DÉROULANT (les pastilles ont été refusées le 19/10/2026,
 * « pour ne pas surcharger »), groupes par sous-type, lignes de 52 px à colonnes fixes
 * (pastille « secondes » et icône vidéo gardent leur place même absentes).
 */
export default function ExerciseBank() {
  const { exercises } = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [subtype, setSubtype] = useState('')

  const allSubtypes = [...new Set(exercises.flatMap(subtypesOf))].sort(bySubtype)
  const visibleExercises = exercises.filter(
    (e) =>
      (!subtype || subtypesOf(e).includes(subtype)) &&
      (!query.trim() || norm(e.name).includes(norm(query)) || subtypesOf(e).some((st) => norm(st).includes(norm(query)))),
  )
  const groups = subtypeGroups(visibleExercises).filter(([st]) => !subtype || st === subtype)

  return (
    <div className="flex flex-col gap-3 px-4 pt-4 lg:gap-4 lg:px-10 lg:pt-8">
      <header className="flex items-center gap-3">
        <button type="button" aria-label="Retour" onClick={() => navigate('/library')} className={iconSquare}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <Eyebrow>
            {exercises.length} exercices · {allSubtypes.length} sous-types
          </Eyebrow>
          <DisplayTitle className="truncate text-2xl leading-[1.2] lg:text-[30px]">Banque d'exercices</DisplayTitle>
        </div>
        <button type="button" onClick={() => navigate('/exercise/new')} className={primaryCls + ' !hidden !min-h-11 shrink-0 !pr-[18px] !pl-3.5 !text-[15px] lg:!inline-flex'}>
          <Plus className="h-5 w-5" /> Exercice
        </button>
      </header>

      <label className="flex h-12 items-center gap-2.5 rounded-sm border border-hairline-strong bg-surface px-3.5 focus-within:border-ink focus-within:ring-4 focus-within:ring-sage-100">
        <Search className="h-5 w-5 shrink-0 text-ink-soft" />
        <input
          type="search"
          aria-label="Rechercher un exercice"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un exercice"
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-mute"
        />
      </label>
      <label className="flex items-center gap-2.5">
        <span className="shrink-0 text-sm font-semibold text-ink-soft">Sous-type</span>
        <span className="relative flex max-w-80 min-w-0 flex-1">
          <select
            aria-label="Filtrer par sous-type"
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
            className="h-11 min-w-0 flex-1 appearance-none rounded-sm border border-hairline-strong bg-surface pr-10 pl-3.5 text-base font-semibold text-ink outline-none focus:border-ink"
          >
            <option value="">Tous les sous-types</option>
            {allSubtypes.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2" />
        </span>
      </label>

      <div className="flex flex-col gap-3.5">
        {groups.map(([st, exos]) => (
          <section key={st || '—'} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base leading-[22px] font-bold">
                {st || 'Autres'} <span className="font-medium text-ink-soft">· {exos.length}</span>
              </h2>
              {st && (
                <button
                  type="button"
                  aria-label={`Nouvel exercice ${st}`}
                  onClick={() => navigate(`/exercise/new?st=${encodeURIComponent(st)}`)}
                  className="flex h-9 w-9 items-center justify-center rounded-full active:bg-sage-50"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>
            <ul className="overflow-hidden rounded-md border border-hairline bg-surface">
              {exos.map((e, i) => (
                <li key={e.id} className={i > 0 ? 'border-t border-hairline' : ''}>
                  <button
                    type="button"
                    onClick={() => navigate(`/exercise/${e.id}`)}
                    className="flex min-h-[52px] w-full items-center gap-2.5 pr-3 pl-4 text-left active:bg-sage-50"
                  >
                    <span className="min-w-0 flex-1 text-base leading-[22px] font-semibold">{e.name}</span>
                    <span className="flex w-[78px] shrink-0 justify-end">
                      {e.measure === 'sec' && (
                        <span className="inline-flex h-6 items-center rounded-full bg-sage-50 px-2.5 text-[13px] font-semibold text-ink-soft">secondes</span>
                      )}
                    </span>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-label={e.videoUrl ? 'Vidéo disponible' : undefined}>
                      {e.videoUrl && <Picto name="video" className="h-5 w-5 text-sage-700" />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {exercises.length === 0 && <EmptyState emoji="💪" text="Aucun exercice. Créez-en un avec le bouton « + Exercice »." />}
      {exercises.length > 0 && visibleExercises.length === 0 && (
        <EmptyState emoji="🔍" text={`Aucun exercice ne correspond à « ${query || subtype} ».`} />
      )}

      <div className="lg:hidden">
        <Fab label="+ Exercice" onClick={() => navigate('/exercise/new')} />
      </div>
    </div>
  )
}
