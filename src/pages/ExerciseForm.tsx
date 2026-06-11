import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CATEGORIES, CATEGORY_META, PRESET_SUBTYPES, subtypesOf, type Category, type Measure } from '../types'
import { youtubeSearch } from '../lib/format'
import { Combobox, Field, FormActions, PageHeader, Seg, Select, TextArea, TextInput } from '../components/ui'

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
  const [subtypeQuery, setSubtypeQuery] = useState('')
  const [measure, setMeasure] = useState<Measure>(existing?.measure ?? 'reps')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [videoUrl, setVideoUrl] = useState(existing?.videoUrl ?? '')

  // Sous-types déjà utilisés dans la banque (et sélectionnés ici), en plus des presets
  const customSubtypes = [
    ...new Set(
      [...exercises.flatMap((e) => subtypesOf(e)), ...subtypes].filter((s) => !PRESET_SUBTYPES.includes(s)),
    ),
  ].sort((a, b) => a.localeCompare(b, 'fr'))
  const subtypeOptions = [...PRESET_SUBTYPES, ...customSubtypes].filter((st) => !subtypes.includes(st))

  const addSubtype = (st: string) => {
    if (st && !subtypes.includes(st)) setSubtypes((p) => [...p, st])
    setSubtypeQuery('')
  }
  const removeSubtype = (st: string) => setSubtypes((p) => p.filter((x) => x !== st))

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
      <PageHeader title={existing ? "Modifier l'exercice" : 'Nouvel exercice'} onBack={() => navigate(-1)} />

      <div className="space-y-4 px-5 pb-2">
        <Field label="Nom">
          <TextInput value={name} onChange={setName} placeholder="Ex. Pompes diamant" />
        </Field>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Catégorie">
            <Select value={category} onChange={(v) => setCategory(v as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mesure">
            <Seg
              options={[
                { value: 'reps' as const, label: 'Reps' },
                { value: 'sec' as const, label: 'Secondes' },
              ]}
              value={measure}
              onChange={setMeasure}
            />
          </Field>
        </div>

        <Field label="Sous-types">
          {subtypes.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {subtypes.map((st) => (
                <button
                  key={st}
                  type="button"
                  title="Retirer"
                  onClick={() => removeSubtype(st)}
                  className="flex items-center gap-1.5 rounded-full bg-sage-500 px-3 py-1.5 text-xs font-extrabold text-white"
                >
                  {st} <span className="opacity-60">✕</span>
                </button>
              ))}
            </div>
          )}
          <Combobox
            small
            value={subtypeQuery}
            onChange={setSubtypeQuery}
            options={subtypeOptions.map((st) => ({ id: st, label: st }))}
            onSelect={addSubtype}
            onCreate={addSubtype}
            placeholder="Ajouter un sous-type (ex. Jambes, Triceps)…"
          />
        </Field>

        <Field label="Description (optionnel)">
          <TextArea value={description} onChange={setDescription} rows={2} placeholder="Consignes, posture, respiration…" />
        </Field>

        <Field label="Vidéo de démo (optionnel)">
          <TextInput value={videoUrl} onChange={setVideoUrl} placeholder="Lien YouTube ou autre" />
          <div className="mt-2 flex gap-2 text-xs font-bold empty:hidden">
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
        </Field>
      </div>

      <FormActions
        onSave={() => void save()}
        saveDisabled={!name.trim()}
        onDelete={existing ? () => void del() : undefined}
      />
    </div>
  )
}
