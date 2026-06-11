import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META, PRESET_SUBTYPES, subtypesOf, type Category, type Measure } from '../types'
import { youtubeSearch } from '../lib/format'
import { Chip, Field, GhostButton, PrimaryButton, Seg, TextArea, TextInput } from '../components/ui'

export default function ExerciseForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { exercises, addExercise, updateExercise, removeExercise } = useData()
  const existing = exercises.find((e) => e.id === id)

  // Préremplissage depuis les « + » de la banque (?cat=…&st=…)
  const presetCat = params.get('cat') as Category | null
  const presetSubtype = params.get('st')

  const [name, setName] = useState(existing?.name ?? '')
  const [category, setCategory] = useState<Category>(
    existing?.category ?? (presetCat && CATEGORIES.includes(presetCat) ? presetCat : 'muscu'),
  )
  const [subtypes, setSubtypes] = useState<string[]>(() =>
    existing ? subtypesOf(existing) : presetSubtype ? [presetSubtype] : [],
  )
  const [customInput, setCustomInput] = useState('')
  const [measure, setMeasure] = useState<Measure>(existing?.measure ?? 'reps')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [videoUrl, setVideoUrl] = useState(existing?.videoUrl ?? '')

  // Sous-types déjà utilisés dans la banque (et sélectionnés ici), en plus des presets
  const customSubtypes = [
    ...new Set(
      [...exercises.flatMap((e) => subtypesOf(e)), ...subtypes].filter((s) => !PRESET_SUBTYPES.includes(s)),
    ),
  ].sort((a, b) => a.localeCompare(b, 'fr'))
  const subtypeOptions = [...PRESET_SUBTYPES, ...customSubtypes]

  const toggleSubtype = (st: string) =>
    setSubtypes((p) => (p.includes(st) ? p.filter((x) => x !== st) : [...p, st]))

  const addCustomSubtype = () => {
    const st = customInput.trim()
    if (st && !subtypes.includes(st)) setSubtypes((p) => [...p, st])
    setCustomInput('')
  }

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
    if (existing) await updateExercise(existing.id, data)
    else await addExercise(data)
    navigate(-1)
  }

  const del = async () => {
    if (!existing) return
    if (!window.confirm(`Supprimer « ${existing.name} » ? Il sera retiré des séances qui l'utilisent.`)) return
    await removeExercise(existing.id)
    navigate('/library?tab=exos', { replace: true })
  }

  return (
    <div>
      <header className="flex items-center gap-3 px-5 pt-8 pb-4">
        <button type="button" aria-label="Retour" onClick={() => navigate(-1)} className="rounded-full bg-surface p-2.5 shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-xl font-extrabold">{existing ? "Modifier l'exercice" : 'Nouvel exercice'}</h1>
      </header>

      <div className="space-y-4 px-5">
        <Field label="Nom">
          <TextInput value={name} onChange={setName} placeholder="Ex. Pompes diamant" />
        </Field>

        <Field label="Catégorie">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Sous-types (plusieurs possibles)">
          <div className="flex flex-wrap gap-1.5">
            {subtypeOptions.map((st) => (
              <Chip key={st} active={subtypes.includes(st)} onClick={() => toggleSubtype(st)}>
                {st}
              </Chip>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <TextInput value={customInput} onChange={setCustomInput} placeholder="Autre sous-type (ex. Triceps)…" />
            </div>
            {customInput.trim() && (
              <button
                type="button"
                onClick={addCustomSubtype}
                className="shrink-0 rounded-full bg-sage-500 px-4 py-2.5 text-sm font-extrabold text-white"
              >
                + Ajouter
              </button>
            )}
          </div>
        </Field>

        <Field label="Mesure de l'effort">
          <Seg
            options={[
              { value: 'reps' as const, label: 'Répétitions' },
              { value: 'sec' as const, label: 'Secondes (statique)' },
            ]}
            value={measure}
            onChange={setMeasure}
          />
        </Field>

        <Field label="Description (optionnel)">
          <TextArea value={description} onChange={setDescription} placeholder="Consignes, posture, respiration…" />
        </Field>

        <Field label="Vidéo de démo (optionnel)">
          <TextInput value={videoUrl} onChange={setVideoUrl} placeholder="Lien YouTube ou autre" />
        </Field>
        <div className="flex gap-2 text-xs font-bold">
          {videoUrl.trim() && (
            <a href={videoUrl.trim()} target="_blank" rel="noreferrer" className="rounded-full bg-velo/10 px-3 py-1.5 text-velo">
              ▶ Tester le lien
            </a>
          )}
          {!videoUrl.trim() && name.trim() && (
            <button
              type="button"
              className="rounded-full bg-sage-100 px-3 py-1.5 text-sage-700"
              onClick={() => setVideoUrl(youtubeSearch(name.trim()))}
            >
              🔍 Utiliser une recherche YouTube
            </button>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <PrimaryButton onClick={() => void save()} disabled={!name.trim()}>
            Enregistrer
          </PrimaryButton>
          {existing && (
            <GhostButton danger onClick={() => void del()}>
              Supprimer l'exercice
            </GhostButton>
          )}
        </div>
      </div>
    </div>
  )
}
