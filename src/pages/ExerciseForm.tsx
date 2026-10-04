import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CATEGORIES, type Category } from '../types'
import { ExerciseFields, useExerciseDraft } from '../components/ExerciseEditor'
import { FormActions, PageHeader } from '../components/ui'

/** Fiche d'exercice en page (banque) — mêmes champs que la feuille du programme (`ExerciseEditor`) */
export default function ExerciseForm() {
  const { id } = useParams()
  if (id) return <Loaded key={id} id={id} />
  return <Editor />
}

/** Attend que l'exercice soit livré par le store avant d'initialiser l'état du formulaire */
function Loaded({ id }: { id: string }) {
  const { exercises } = useData()
  const existing = exercises.find((e) => e.id === id)
  if (!existing) return null
  return <Editor existingId={id} />
}

function Editor({ existingId }: { existingId?: string }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { exercises, removeExercise } = useData()
  const existing = exercises.find((e) => e.id === existingId)

  // Préremplissage depuis les « + » de la banque (?cat=…&st=…)
  const presetCat = params.get('cat') as Category | null
  const draft = useExerciseDraft(existing, {
    category: presetCat && CATEGORIES.includes(presetCat) ? presetCat : undefined,
    subtype: params.get('st') ?? undefined,
  })

  const save = async () => {
    await draft.save()
    navigate(-1)
  }

  const del = async () => {
    if (!existing) return
    if (!window.confirm(`Supprimer « ${existing.name} » ? Il sera retiré des programmes qui l'utilisent.`)) return
    await removeExercise(existing.id)
    navigate('/library/exercices', { replace: true })
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title={existing ? "Modifier l'exercice" : 'Nouvel exercice'} onBack={() => navigate(-1)} />
      <div className="px-5 pb-28">
        <ExerciseFields draft={draft} detailsInitiallyOpen={!!existing} />
      </div>
      <FormActions onSave={() => void save()} saveDisabled={!draft.name.trim()} onDelete={existing ? () => void del() : undefined} />
    </div>
  )
}
