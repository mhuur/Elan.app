import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Play, Search, X } from 'lucide-react'
import { useData } from '../data/DataContext'
import { PRESET_SUBTYPES, STRETCH_SUBTYPES, bySubtype, subtypesOf, type Measure } from '../types'
import { youtubeSearch } from '../lib/format'
import { Combobox, Field, FormActions, PageHeader, Seg, TextArea, TextInput } from '../components/ui'

export default function ExerciseForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { exercises, addExercise, updateExercise, removeExercise } = useData()
  const existing = exercises.find((e) => e.id === id)

  // Préremplissage depuis les « + » de la banque (?st=…). Plus de catégorie depuis oct. 2026 :
  // le sous-type est le seul classement (Souplesse ou Mobilité = étirement, en secondes).
  const presetSubtype = params.get('st')

  const [name, setName] = useState(existing?.name ?? '')
  const [subtypes, setSubtypes] = useState<string[]>(() =>
    existing ? subtypesOf(existing) : presetSubtype ? [presetSubtype] : [],
  )
  const [subtypeQuery, setSubtypeQuery] = useState('')
  const [measure, setMeasure] = useState<Measure>(
    existing?.measure ?? (presetSubtype && STRETCH_SUBTYPES.includes(presetSubtype) ? 'sec' : 'reps'),
  )
  const [description, setDescription] = useState(existing?.description ?? '')
  const [videoUrl, setVideoUrl] = useState(existing?.videoUrl ?? '')

  // Presets et sous-types déjà utilisés dans la banque, en ordre alphabétique
  const subtypeOptions = [...new Set([...PRESET_SUBTYPES, ...exercises.flatMap((e) => subtypesOf(e))])]
    .filter((st) => !subtypes.includes(st))
    .sort(bySubtype)

  const addSubtype = (st: string) => {
    if (st && !subtypes.includes(st)) setSubtypes((p) => [...p, st])
    // Un nouvel exercice classé en étirement se tient en secondes
    if (!existing && STRETCH_SUBTYPES.includes(st)) setMeasure('sec')
    setSubtypeQuery('')
  }
  const removeSubtype = (st: string) => setSubtypes((p) => p.filter((x) => x !== st))

  const save = async () => {
    const data = {
      name: name.trim() || 'Exercice',
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
    navigate('/library/exercices', { replace: true })
  }

  return (
    <div>
      <PageHeader title={existing ? "Modifier l'exercice" : 'Nouvel exercice'} onBack={() => navigate(-1)} />

      <div className="space-y-4 px-5 pb-2">
        <Field label="Nom">
          <TextInput value={name} onChange={setName} placeholder="Ex. Pompes diamant" />
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

        <Field label="Sous-types">
          {subtypes.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {subtypes.map((st) => (
                <button
                  key={st}
                  type="button"
                  title="Retirer"
                  onClick={() => removeSubtype(st)}
                  className="flex items-center gap-1.5 rounded-full bg-sage-500 px-3 py-1.5 text-xs font-extrabold text-onaccent"
                >
                  {st} <X className="h-3 w-3 opacity-60" />
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
              <a
                href={videoUrl.trim()}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-velo/10 px-3 py-1.5 text-velo"
              >
                <Play className="h-3 w-3" /> Tester le lien
              </a>
            )}
            {!videoUrl.trim() && name.trim() && (
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1.5 text-sage-700"
                onClick={() => setVideoUrl(youtubeSearch(name.trim()))}
              >
                <Search className="h-3 w-3" /> Utiliser une recherche YouTube
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
