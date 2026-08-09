import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { PRESET_SUBTYPES, subtypesOf, type Category, type Exercise, type Measure } from '../types'
import { Seg } from './ui'

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Groupes de sous-types, comme la banque : un exercice multi-tags apparaît dans chacun */
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
  const rank = (k: string) => {
    if (!k) return 10000
    const i = PRESET_SUBTYPES.indexOf(k)
    return i === -1 ? 5000 : i
  }
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'fr'))
}

/**
 * Panneau de composition : la banque de la catégorie, cherchable, qui RESTE ouverte
 * — un tap ajoute l'exercice à la séance sans rien fermer (remplace la Combobox qui
 * se refermait après chaque ajout, friction n° 1 de la création de séance).
 * Affiché en volet latéral permanent sur desktop (SessionForm) et dans une Sheet
 * sur mobile. `counts` marque d'une coche les exercices déjà dans la séance
 * (re-tap = deuxième ajout, utile pour les blocs).
 * « + Créer » déplie une mini-ligne nom + sous-type + mesure : l'exercice naît
 * classé et mesuré, plus besoin de repasser par la banque pour le corriger.
 */
export default function ExercisePicker({
  exercises,
  category,
  counts,
  onAdd,
  onCreate,
}: {
  /** Exercices de la catégorie de la séance uniquement */
  exercises: Exercise[]
  category: Category
  /** Nombre d'occurrences de chaque exercice déjà dans la séance */
  counts: Map<string, number>
  onAdd: (exId: string) => void
  onCreate: (draft: { name: string; subtype: string; measure: Measure }) => void
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSubtype, setNewSubtype] = useState('')
  const [newMeasure, setNewMeasure] = useState<Measure>(category === 'etirements' ? 'sec' : 'reps')

  const q = norm(query.trim())
  const visible = q
    ? exercises.filter((e) => norm(e.name).includes(q) || subtypesOf(e).some((st) => norm(st).includes(q)))
    : exercises
  const hasExact = exercises.some((e) => norm(e.name) === q)

  // Sous-types de la catégorie d'abord (les plus pertinents), presets ensuite
  const catSubtypes = [...new Set(exercises.flatMap((e) => subtypesOf(e)))]
  const subtypeOptions = [...catSubtypes, ...PRESET_SUBTYPES.filter((st) => !catSubtypes.includes(st))]

  const startCreate = () => {
    setNewName(query.trim())
    setNewSubtype('')
    setNewMeasure(category === 'etirements' ? 'sec' : 'reps')
    setCreating(true)
  }
  const submitCreate = () => {
    if (!newName.trim()) return
    onCreate({ name: newName.trim(), subtype: newSubtype, measure: newMeasure })
    setCreating(false)
    setQuery('')
  }

  const label = category === 'etirements' ? 'posture' : 'exercice'

  return (
    <div className="flex min-h-0 flex-col">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Rechercher ou créer…`}
        aria-label="Rechercher un exercice"
        className="w-full shrink-0 rounded-sm border border-hairline bg-shoal px-4 py-3 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-ink/40 focus:border-sage-500"
      />

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
        {subtypeGroups(visible).map(([subtype, exos]) => (
          <section key={subtype || '—'}>
            <p className="mb-1 px-1 font-mono text-[9px] tracking-[0.18em] uppercase text-sage-500">
              {subtype || 'Autres'}
            </p>
            <div>
              {exos.map((e, i) => {
                const n = counts.get(e.id) ?? 0
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onAdd(e.id)}
                    className={
                      'flex w-full items-center gap-2 px-1 py-2 text-left active:bg-glass ' +
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
                    {n > 0 ? (
                      <span className="flex shrink-0 items-center gap-1 font-mono text-[9px] tracking-[0.1em] uppercase text-sage-500">
                        <Check className="h-3.5 w-3.5" />
                        {n > 1 ? `×${n}` : ''}
                      </span>
                    ) : (
                      <Plus className="h-4 w-4 shrink-0 text-ink/40" />
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
        {visible.length === 0 && !q && (
          <p className="px-1 py-2 text-sm font-semibold text-ink/50">
            Aucun {label} dans cette catégorie pour l'instant.
          </p>
        )}
        {!creating && q.length > 0 && !hasExact && (
          <button
            type="button"
            onClick={startCreate}
            className="w-full px-1 py-2.5 text-left text-sm font-extrabold text-sage-600 active:bg-glass"
          >
            + Créer « {query.trim()} »
          </button>
        )}
      </div>

      {creating && (
        <div className="mt-3 shrink-0 space-y-2 border-t border-hairline-strong pt-3">
          <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink/60">
            {category === 'etirements' ? 'Nouvelle posture' : 'Nouvel exercice'}
          </p>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitCreate()
              }
            }}
            autoFocus
            placeholder="Nom"
            className="w-full rounded-sm border border-hairline bg-shoal px-3 py-2.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-ink/40 focus:border-sage-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newSubtype}
              onChange={(e) => setNewSubtype(e.target.value)}
              aria-label="Sous-type"
              className="w-full rounded-sm border border-hairline bg-shoal px-2.5 py-2 text-sm font-bold outline-none focus:border-sage-500"
            >
              <option value="">— Sous-type —</option>
              {subtypeOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            <Seg
              options={[
                { value: 'reps' as const, label: 'Reps' },
                { value: 'sec' as const, label: 'Secondes' },
              ]}
              value={newMeasure}
              onChange={setNewMeasure}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitCreate}
              disabled={!newName.trim()}
              className="flex-1 rounded-sm bg-sage-500 px-3 py-2.5 font-mono text-[11px] font-bold tracking-[0.14em] uppercase text-onaccent disabled:opacity-40"
            >
              Créer et ajouter
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-sm border border-hairline px-3 py-2.5 font-mono text-[11px] font-bold tracking-[0.14em] uppercase text-ink/60"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
