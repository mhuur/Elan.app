import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, Play, Search } from 'lucide-react'
import { useData } from '../data/DataContext'
import { PRESET_SUBTYPES, STRETCH_SUBTYPES, bySubtype, displayCategory, setTargetsOf, subtypesOf, type Measure } from '../types'
import { youtubeSearch } from '../lib/format'
import { CategoryRing, Combobox, Field, FormActions, PageHeader, Seg, TextArea, TextInput, glassCard } from '../components/ui'

/**
 * Fiche d'un exercice (charte 21KM, planche Formulaires, écran « exercice ») : nom, mesure,
 * sous-types en pastilles, description, vidéo de démo et la liste des programmes qui
 * l'utilisent. Retours de Romain du 19/10/2026 : bouton « Chercher sur YouTube » qui OUVRE
 * la recherche (on colle ensuite le lien d'une vidéo précise, jamais l'URL de recherche),
 * section « Utilisé dans » acceptée.
 */
export default function ExerciseForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { exercises, sessions, addExercise, updateExercise, removeExercise } = useData()
  const existing = exercises.find((e) => e.id === id)

  // Préremplissage depuis les « + » de la banque (?st=…). Le sous-type est le seul
  // classement (Souplesse ou Mobilité = étirement, en secondes).
  const presetSubtype = params.get('st')

  const [name, setName] = useState(existing?.name ?? '')
  const [subtypes, setSubtypes] = useState<string[]>(() => (existing ? subtypesOf(existing) : presetSubtype ? [presetSubtype] : []))
  const [subtypeQuery, setSubtypeQuery] = useState('')
  const [measure, setMeasure] = useState<Measure>(
    existing?.measure ?? (presetSubtype && STRETCH_SUBTYPES.includes(presetSubtype) ? 'sec' : 'reps'),
  )
  const [description, setDescription] = useState(existing?.description ?? '')
  const [videoUrl, setVideoUrl] = useState(existing?.videoUrl ?? '')

  // Presets, sous-types déjà utilisés dans la banque et ceux de l'exercice, en ordre alphabétique
  const allSubtypes = [...new Set([...PRESET_SUBTYPES, ...exercises.flatMap((e) => subtypesOf(e)), ...subtypes])].sort(bySubtype)

  const toggleSubtype = (st: string) => {
    if (subtypes.includes(st)) {
      setSubtypes((p) => p.filter((x) => x !== st))
      return
    }
    setSubtypes((p) => [...p, st])
    // Un nouvel exercice classé en étirement se tient en secondes
    if (!existing && STRETCH_SUBTYPES.includes(st)) setMeasure('sec')
  }
  const createSubtype = (st: string) => {
    if (st && !subtypes.includes(st)) toggleSubtype(st)
    setSubtypeQuery('')
  }

  // Programmes qui utilisent cet exercice
  const usedIn = existing
    ? sessions.flatMap((s) => {
        const idx = s.items.findIndex((it) => it.exerciseId === existing.id)
        if (idx < 0) return []
        const it = s.items[idx]
        const unit = existing.measure === 'sec' ? ' s' : ''
        const tgs = setTargetsOf(it)
        const presc =
          s.category === 'hiit'
            ? `${it.durationSec ?? s.workSec ?? 45} s`
            : s.category === 'etirements'
              ? `${it.durationSec ?? 30} s`
              : tgs.every((t) => t === tgs[0])
                ? `${tgs.length} × ${tgs[0]}${unit}`
                : tgs.join(' / ') + unit
        return [{ s, line: `${presc} · exercice ${idx + 1} sur ${s.items.length}` }]
      })
    : []

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
    if (!window.confirm(`Supprimer « ${existing.name} » ? Il sera retiré des programmes qui l'utilisent.`)) return
    await removeExercise(existing.id)
    navigate('/library/exercices', { replace: true })
  }

  return (
    <div>
      <PageHeader kicker="Exercice" title={existing ? "Modifier l'exercice" : 'Nouvel exercice'} onBack={() => navigate(-1)} />

      <div className="flex flex-col gap-4 px-4 pb-2 lg:px-10">
        <section aria-label="Fiche de l'exercice" className={`flex flex-col gap-4 p-4 ${glassCard}`}>
          <Field label="Nom">
            <TextInput value={name} onChange={setName} placeholder="Ex. Pompes diamant" />
          </Field>

          <Field label="Mesure">
            <Seg
              options={[
                { value: 'reps' as const, label: 'Répétitions' },
                { value: 'sec' as const, label: 'Secondes' },
              ]}
              value={measure}
              onChange={setMeasure}
            />
          </Field>

          <Field label="Sous-types">
            <div role="group" aria-label="Sous-types" className="mb-2 flex flex-wrap gap-2">
              {allSubtypes.map((st) => {
                const on = subtypes.includes(st)
                return (
                  <button
                    key={st}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSubtype(st)}
                    className={
                      'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ' +
                      (on ? 'bg-ink text-white' : 'bg-sage-50 text-ink active:bg-hairline')
                    }
                  >
                    {on && <Check className="h-4 w-4" strokeWidth={2.6} />}
                    {st}
                  </button>
                )
              })}
            </div>
            <Combobox
              small
              value={subtypeQuery}
              onChange={setSubtypeQuery}
              options={[]}
              onSelect={createSubtype}
              onCreate={createSubtype}
              placeholder="Autre sous-type…"
            />
          </Field>

          <Field label="Description">
            <TextArea value={description} onChange={setDescription} rows={3} placeholder="Consignes, posture, respiration" />
          </Field>

          <Field label="Vidéo de démo">
            <TextInput value={videoUrl} onChange={setVideoUrl} placeholder="Lien d'une vidéo YouTube" />
            <div className="mt-2 flex flex-wrap gap-2">
              {name.trim() && (
                <a
                  href={youtubeSearch(name.trim())}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cream pr-4 pl-3 text-[15px] font-bold text-ink active:bg-sage-50"
                >
                  <Search className="h-5 w-5" /> Chercher « {name.trim()} » sur YouTube
                </a>
              )}
              {videoUrl.trim() && (
                <a
                  href={videoUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cream pr-4 pl-3 text-[15px] font-bold text-sage-700 active:bg-sage-50"
                >
                  <Play className="h-5 w-5" /> Tester le lien
                </a>
              )}
            </div>
          </Field>
        </section>

        {existing && (
          <section aria-labelledby="h-used" className="flex flex-col gap-1.5">
            <h2 id="h-used" className="ml-1 text-base leading-[22px] font-bold">
              Utilisé dans
            </h2>
            {usedIn.length === 0 && <p className="ml-1 text-[15px] text-ink-soft">Aucun programme pour l'instant.</p>}
            {usedIn.map(({ s, line }) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/session/${s.id}`)}
                className={`flex min-h-16 w-full items-center gap-3 px-3.5 py-2 text-left active:bg-sage-50 ${glassCard}`}
              >
                <CategoryRing category={displayCategory(s, exercises)} size={40} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base leading-[22px] font-semibold">{s.name}</span>
                  <span className="truncate text-sm leading-5 text-ink-soft tabular-nums">{line}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-mute" />
              </button>
            ))}
          </section>
        )}
      </div>

      <FormActions onSave={() => void save()} saveDisabled={!name.trim()} onDelete={existing ? () => void del() : undefined} />
    </div>
  )
}
