import { useState } from 'react'
import { ChevronDown, Play, Plus, Trash2 } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META, PRESET_SUBTYPES, subtypesOf, type Category, type Exercise, type Measure } from '../types'
import { Seg, Sheet } from './ui'

/* ── Fiche d'exercice, UNE seule partout (oct. 2026, canvas « Créer simple ») ─────────
 * La banque (/exercise/new, /exercise/:id) et le programme (« + Créer » du sélecteur,
 * « Modifier l'exercice » de la feuille d'un exercice) montrent les mêmes champs :
 * nom, « Se compte en » (répétitions / durée), muscle travaillé en pastilles triées par
 * ordre alphabétique (décision utilisateur), et des détails repliés (consignes, vidéo,
 * famille). Avant, le sélecteur avait sa propre mini-ligne (nom + sous-type + mesure,
 * sans vidéo) et la banque un formulaire à cinq champs avec un <select> natif.
 */

export interface ExercisePreset {
  name?: string
  category?: Category
  subtype?: string
}

export interface ExerciseDraft {
  name: string
  setName: (v: string) => void
  category: Category
  setCategory: (v: Category) => void
  measure: Measure
  setMeasure: (v: Measure) => void
  subtypes: string[]
  toggleSubtype: (st: string) => void
  description: string
  setDescription: (v: string) => void
  videoUrl: string
  setVideoUrl: (v: string) => void
  /** Pastilles proposées : presets + sous-types déjà utilisés dans la banque, ordre alphabétique */
  subtypeOptions: string[]
  /** Enregistre (création ou mise à jour) et renvoie l'id et la mesure */
  save: () => Promise<{ id: string; measure: Measure; category: Category }>
}

export function useExerciseDraft(existing: Exercise | undefined, preset: ExercisePreset = {}): ExerciseDraft {
  const { exercises, addExercise, updateExercise } = useData()
  const [name, setName] = useState(existing?.name ?? preset.name ?? '')
  const [category, setCategory] = useState<Category>(existing?.category ?? preset.category ?? 'muscu')
  const [measure, setMeasure] = useState<Measure>(
    existing?.measure ?? ((preset.category ?? 'muscu') === 'etirements' ? 'sec' : 'reps'),
  )
  const [subtypes, setSubtypes] = useState<string[]>(() =>
    existing ? subtypesOf(existing) : preset.subtype ? [preset.subtype] : [],
  )
  const [description, setDescription] = useState(existing?.description ?? '')
  const [videoUrl, setVideoUrl] = useState(existing?.videoUrl ?? '')

  const subtypeOptions = [...new Set([...PRESET_SUBTYPES, ...exercises.flatMap((e) => subtypesOf(e)), ...subtypes])].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  )
  const toggleSubtype = (st: string) => setSubtypes((p) => (p.includes(st) ? p.filter((x) => x !== st) : [...p, st]))

  const save = async () => {
    const data = {
      name: name.trim() || 'Exercice',
      category,
      subtypes,
      subtype: '',
      measure,
      description: description.trim(),
      videoUrl: videoUrl.trim(),
      createdAt: existing?.createdAt ?? Date.now(),
    }
    if (existing) {
      await updateExercise(existing.id, data)
      return { id: existing.id, measure, category }
    }
    return { id: await addExercise(data), measure, category }
  }

  return {
    name, setName, category, setCategory, measure, setMeasure, subtypes, toggleSubtype,
    description, setDescription, videoUrl, setVideoUrl, subtypeOptions, save,
  }
}

const label = 'font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft'
const field =
  'w-full rounded-sm border border-hairline bg-shoal px-3.5 text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink/40 focus:border-sage-500'
const pill = (on: boolean) =>
  'h-9 rounded-full border px-3.5 text-[13px] font-bold transition-colors ' +
  (on ? 'border-sage-500 bg-sage-500 text-onaccent' : 'border-hairline-strong text-ink active:bg-glass')

/** Les champs de la fiche — sans en-tête ni bouton d'enregistrement (page ou feuille les portent) */
export function ExerciseFields({ draft, detailsInitiallyOpen = false }: { draft: ExerciseDraft; detailsInitiallyOpen?: boolean }) {
  const [detailsOpen, setDetailsOpen] = useState(detailsInitiallyOpen)
  const [adding, setAdding] = useState(false)
  const [newSubtype, setNewSubtype] = useState('')
  const addSubtype = () => {
    const st = newSubtype.trim()
    if (st && !draft.subtypes.includes(st)) draft.toggleSubtype(st)
    setNewSubtype('')
    setAdding(false)
  }
  const detailsSummary = [
    CATEGORY_META[draft.category].label,
    draft.description.trim() ? 'consignes' : '',
    draft.videoUrl.trim() ? 'vidéo' : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-5">
      <input
        type="text"
        aria-label="Nom de l'exercice"
        value={draft.name}
        onChange={(e) => draft.setName(e.target.value)}
        placeholder="Ex. Pompes diamant"
        className={field + ' h-14 text-lg font-bold'}
      />

      <div className="space-y-2">
        <p className={label}>Se compte en</p>
        <Seg
          options={[
            { value: 'reps' as const, label: 'Répétitions' },
            { value: 'sec' as const, label: 'Durée' },
          ]}
          value={draft.measure}
          onChange={draft.setMeasure}
        />
      </div>

      <div className="space-y-2">
        <p className={label}>Muscle travaillé</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Muscle travaillé">
          {draft.subtypeOptions.map((st) => (
            <button key={st} type="button" aria-pressed={draft.subtypes.includes(st)} onClick={() => draft.toggleSubtype(st)} className={pill(draft.subtypes.includes(st))}>
              {st}
            </button>
          ))}
          {adding ? (
            <span className="flex items-center gap-1.5">
              <input
                type="text"
                autoFocus
                aria-label="Autre muscle"
                value={newSubtype}
                onChange={(e) => setNewSubtype(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSubtype()
                  }
                  if (e.key === 'Escape') setAdding(false)
                }}
                onBlur={addSubtype}
                placeholder="Ex. Triceps"
                className={field + ' h-9 w-32 rounded-full'}
              />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-9 items-center gap-1 rounded-full border border-dashed border-sage-500/60 px-3.5 text-[13px] font-bold text-sage-500"
            >
              <Plus className="h-3.5 w-3.5" /> Autre
            </button>
          )}
        </div>
      </div>

      <div className="rounded-sm border border-hairline bg-glass-sunken">
        <button
          type="button"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((o) => !o)}
          className="flex min-h-12 w-full items-center gap-3 px-3.5 text-left"
        >
          <span className={label}>Détails</span>
          {!detailsOpen && <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-soft">{detailsSummary}</span>}
          <ChevronDown className={'ml-auto h-4 w-4 shrink-0 text-ink-soft/60 transition-transform ' + (detailsOpen ? 'rotate-180' : '')} />
        </button>
        {detailsOpen && (
          <div className="space-y-4 border-t border-hairline px-3.5 pt-3.5 pb-4">
            <label className="block space-y-2">
              <span className={label}>Consignes</span>
              <textarea
                rows={2}
                value={draft.description}
                onChange={(e) => draft.setDescription(e.target.value)}
                placeholder="Posture, respiration…"
                className={field + ' py-2.5'}
              />
            </label>
            <div className="space-y-2">
              <span className={label}>Vidéo de démo</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  aria-label="Vidéo de démo"
                  value={draft.videoUrl}
                  onChange={(e) => draft.setVideoUrl(e.target.value)}
                  placeholder="Lien YouTube"
                  className={field + ' h-11 min-w-0 flex-1'}
                />
                {draft.videoUrl.trim() && (
                  <a
                    href={draft.videoUrl.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 shrink-0 items-center gap-1.5 rounded-sm border border-sage-500/50 px-3 font-mono text-[10px] font-bold tracking-[0.12em] uppercase text-sage-500"
                  >
                    <Play className="h-3 w-3" /> Voir
                  </a>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <span className={label}>Famille · filtre de la banque</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Famille">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" aria-pressed={draft.category === c} onClick={() => draft.setCategory(c)} className={pill(draft.category === c)}>
                    {CATEGORY_META[c].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Contenu de la feuille, monté à l'ouverture : l'état repart de zéro à chaque fois */
function SheetBody({
  existing,
  preset,
  submitLabel,
  onSaved,
  onClose,
}: {
  existing?: Exercise
  preset?: ExercisePreset
  submitLabel: string
  onSaved?: (r: { id: string; measure: Measure; category: Category }) => void
  onClose: () => void
}) {
  const { removeExercise } = useData()
  const draft = useExerciseDraft(existing, preset)
  const submit = async () => {
    if (!draft.name.trim()) return
    const r = await draft.save()
    onSaved?.(r)
    onClose()
  }
  const del = async () => {
    if (!existing) return
    if (!window.confirm(`Supprimer « ${existing.name} » ? Il sera retiré des programmes qui l'utilisent.`)) return
    await removeExercise(existing.id)
    onClose()
  }
  return (
    <>
      <ExerciseFields draft={draft} detailsInitiallyOpen={!!existing} />
      <div className="mt-6 flex gap-2">
        {existing && (
          <button
            type="button"
            aria-label="Supprimer l'exercice"
            onClick={() => void del()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-hiit/40 text-hiit active:bg-hiit/10"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          disabled={!draft.name.trim()}
          onClick={() => void submit()}
          className="h-12 flex-1 rounded-sm bg-sage-500 font-mono text-[11px] font-bold tracking-[0.14em] uppercase text-onaccent disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </>
  )
}

/** La fiche en feuille, ouverte depuis le programme (création ou modification) */
export function ExerciseSheet({
  open,
  onClose,
  existing,
  preset,
  submitLabel,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  existing?: Exercise
  preset?: ExercisePreset
  submitLabel?: string
  onSaved?: (r: { id: string; measure: Measure; category: Category }) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={existing ? "Modifier l'exercice" : 'Nouvel exercice'}>
      <SheetBody
        existing={existing}
        preset={preset}
        submitLabel={submitLabel ?? 'Enregistrer'}
        onSaved={onSaved}
        onClose={onClose}
      />
    </Sheet>
  )
}
