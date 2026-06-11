import { useMemo, useState } from 'react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Exercise, type Session } from '../types'
import { effectiveMetrics } from '../lib/metrics'
import { EmptyState, Fab, Field, NumInput, PageHeader, PrimaryButton, Seg, Sheet } from '../components/ui'

function ProgressBar({ ratio, reached }: { ratio: number; reached: boolean }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-sand">
      <div
        className={'h-full rounded-full transition-all ' + (reached ? 'bg-sage-500' : 'bg-running')}
        style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
      />
    </div>
  )
}

export default function Goals() {
  const { sessions, exercises, logs, updateExercise, updateSession } = useData()
  const [addOpen, setAddOpen] = useState(false)

  // --- Création d'un objectif
  const [selSessionId, setSelSessionId] = useState('')
  const selSession = sessions.find((s) => s.id === selSessionId) ?? sessions[0]
  const selMetrics = selSession ? effectiveMetrics(selSession) : []
  const sessionExercises = useMemo(() => {
    if (!selSession || selSession.category !== 'muscu') return []
    return selSession.items
      .map((it) => exercises.find((e) => e.id === it.exerciseId))
      .filter((e): e is Exercise => !!e)
  }, [selSession, exercises])
  const [selExId, setSelExId] = useState('')
  const selEx = sessionExercises.find((e) => e.id === selExId) ?? sessionExercises[0]
  const [exMetric, setExMetric] = useState<'best' | 'volume'>('best')
  const [selMetricKey, setSelMetricKey] = useState('')
  const selMetric = selMetrics.find((m) => m.key === selMetricKey) ?? selMetrics[0]
  const [targetValue, setTargetValue] = useState<number | undefined>(undefined)

  const isMuscuTarget = selSession?.category === 'muscu' && sessionExercises.length > 0
  const canCreate = !!targetValue && (isMuscuTarget ? !!selEx : !!selMetric)

  const createGoal = async () => {
    if (!targetValue || !selSession) return
    if (isMuscuTarget && selEx) {
      await updateExercise(selEx.id, { goal: { metric: exMetric, value: targetValue } })
    } else if (selMetric) {
      await updateSession(selSession.id, {
        objective: { metricKey: selMetric.key, label: selMetric.label, unit: selMetric.unit, value: targetValue },
      })
    }
    setTargetValue(undefined)
    setAddOpen(false)
  }

  // --- Progression actuelle
  const bestForExercise = (e: Exercise): number => {
    let best = 0
    for (const l of logs) {
      const r = l.results?.find((x) => x.exerciseId === e.id)
      if (!r || !r.sets.length) continue
      const v = e.goal?.metric === 'volume' ? r.sets.reduce((a, b) => a + b, 0) : Math.max(...r.sets)
      if (v > best) best = v
    }
    return best
  }
  const bestForSession = (s: Session): number => {
    let best = 0
    for (const l of logs) {
      if (l.sessionId !== s.id) continue
      const mv = l.metrics?.find((x) => x.key === s.objective?.metricKey)
      if (mv && mv.value > best) best = mv.value
    }
    return best
  }

  const exerciseGoals = exercises.filter((e) => e.goal)
  const sessionGoals = sessions.filter((s) => s.objective)
  const total = exerciseGoals.length + sessionGoals.length

  return (
    <div>
      <PageHeader kicker="Cap sur la progression" title="Objectifs" />

      <div className="space-y-3 px-5">
        {total === 0 && (
          <EmptyState emoji="🎯" text="Fixez un objectif sur une séance (ex. Pompes : 20 en une série, ou Vélo : 15 km) et suivez votre progression ici." />
        )}

        {exerciseGoals.map((e) => {
          const cur = bestForExercise(e)
          const goal = e.goal!
          const reached = cur >= goal.value
          const unit = e.measure === 'sec' ? 's' : 'reps'
          return (
            <div key={e.id} className="rounded-3xl bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">💪 {e.name}</p>
                  <p className="text-xs font-semibold text-ink-soft">
                    {goal.metric === 'best' ? 'Meilleure série' : 'Volume sur une séance'} ≥ {goal.value} {unit}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Supprimer cet objectif"
                  onClick={() => {
                    if (window.confirm(`Supprimer l'objectif sur « ${e.name} » ?`)) void updateExercise(e.id, { goal: null })
                  }}
                  className="shrink-0 px-1 text-ink-soft/50 active:text-hiit"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2.5">
                <ProgressBar ratio={goal.value ? cur / goal.value : 0} reached={reached} />
                <p className="mt-1.5 text-xs font-extrabold">
                  {reached ? (
                    <span className="text-sage-600">🎉 Atteint — record {cur} {unit}</span>
                  ) : (
                    <span className="text-ink-soft">
                      {cur} / {goal.value} {unit} — encore {goal.value - cur}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )
        })}

        {sessionGoals.map((s) => {
          const o = s.objective!
          const cur = bestForSession(s)
          const reached = cur >= o.value
          return (
            <div key={s.id} className="rounded-3xl bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">
                    {CATEGORY_META[s.category].emoji} {s.name}
                  </p>
                  <p className="text-xs font-semibold text-ink-soft">
                    {o.label} ≥ {o.value} {o.unit}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Supprimer cet objectif"
                  onClick={() => {
                    if (window.confirm(`Supprimer l'objectif sur « ${s.name} » ?`)) void updateSession(s.id, { objective: null })
                  }}
                  className="shrink-0 px-1 text-ink-soft/50 active:text-hiit"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2.5">
                <ProgressBar ratio={o.value ? cur / o.value : 0} reached={reached} />
                <p className="mt-1.5 text-xs font-extrabold">
                  {reached ? (
                    <span className="text-sage-600">🎉 Atteint — record {cur} {o.unit}</span>
                  ) : (
                    <span className="text-ink-soft">
                      {cur} / {o.value} {o.unit} — encore {Math.round((o.value - cur) * 10) / 10}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <Fab label="+ Objectif" onClick={() => setAddOpen(true)} />

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="🎯 Nouvel objectif">
        <div className="space-y-4">
          <Field label="Séance">
            <select
              value={selSession?.id ?? ''}
              onChange={(e) => {
                setSelSessionId(e.target.value)
                setSelExId('')
                setSelMetricKey('')
              }}
              className="w-full rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-bold outline-none focus:border-sage-400"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {CATEGORY_META[s.category].emoji} {s.name}
                </option>
              ))}
            </select>
          </Field>

          {isMuscuTarget && (
            <>
              <Field label="Exercice de la séance">
                <select
                  value={selEx?.id ?? ''}
                  onChange={(e) => setSelExId(e.target.value)}
                  className="w-full rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-bold outline-none focus:border-sage-400"
                >
                  {sessionExercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type d'objectif">
                <Seg
                  options={[
                    { value: 'best' as const, label: 'Meilleure série' },
                    { value: 'volume' as const, label: 'Volume total' },
                  ]}
                  value={exMetric}
                  onChange={setExMetric}
                />
              </Field>
              <Field label="Valeur à atteindre">
                <NumInput value={targetValue} onChange={setTargetValue} suffix={selEx?.measure === 'sec' ? 's' : 'reps'} placeholder="Ex. 20" />
              </Field>
            </>
          )}

          {!isMuscuTarget && selMetrics.length > 0 && (
            <>
              <Field label="Mesure">
                <select
                  value={selMetric?.key ?? ''}
                  onChange={(e) => setSelMetricKey(e.target.value)}
                  className="w-full rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-bold outline-none focus:border-sage-400"
                >
                  {selMetrics.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valeur à atteindre">
                <NumInput value={targetValue} onChange={setTargetValue} suffix={selMetric?.unit || undefined} placeholder="Ex. 15" />
              </Field>
            </>
          )}

          {!isMuscuTarget && selMetrics.length === 0 && (
            <p className="rounded-2xl bg-sand/60 px-4 py-3 text-xs font-semibold text-ink-soft">
              Cette séance n'a ni exercices suivis ni mesures. Ajoutez-lui d'abord une mesure (modifier la séance →
              « Mesures à saisir en fin de séance »).
            </p>
          )}

          <PrimaryButton onClick={() => void createGoal()} disabled={!canCreate}>
            Créer l'objectif
          </PrimaryButton>
        </div>
      </Sheet>
    </div>
  )
}
