import { useMemo, useState } from 'react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Exercise, type Session } from '../types'
import { effectiveMetrics, objectiveTargets } from '../lib/metrics'
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
  const [targetValue, setTargetValue] = useState<number | undefined>(undefined)
  // Multi-mesures : une valeur cible par mesure (vide = ignorée)
  const [mtargets, setMtargets] = useState<Record<string, number | undefined>>({})

  const isMuscuTarget = selSession?.category === 'muscu' && sessionExercises.length > 0
  const filledTargets = selMetrics.filter((m) => mtargets[m.key] != null)
  const canCreate = isMuscuTarget ? !!targetValue && !!selEx : filledTargets.length > 0

  const createGoal = async () => {
    if (!selSession) return
    if (isMuscuTarget && selEx && targetValue) {
      await updateExercise(selEx.id, { goal: { metric: exMetric, value: targetValue } })
    } else if (filledTargets.length) {
      await updateSession(selSession.id, {
        objective: {
          targets: filledTargets.map((m) => ({ key: m.key, label: m.label, unit: m.unit, value: mtargets[m.key]! })),
        },
      })
    }
    setTargetValue(undefined)
    setMtargets({})
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
  const bestMetric = (s: Session, key: string): number => {
    let best = 0
    for (const l of logs) {
      if (l.sessionId !== s.id) continue
      const mv = l.metrics?.find((x) => x.key === key)
      if (mv && mv.value > best) best = mv.value
    }
    return best
  }

  const exerciseGoals = exercises.filter((e) => e.goal)
  const sessionGoals = sessions.filter((s) => objectiveTargets(s).length > 0)
  const total = exerciseGoals.length + sessionGoals.length

  return (
    <div>
      <PageHeader kicker="Cap sur la progression" title="Objectifs" />

      <div className="space-y-3 px-5">
        {total === 0 && (
          <EmptyState emoji="🎯" text="Fixez un objectif sur une séance (ex. Pompes : 20 en une série, ou Vélo : 45 min à 130 bpm) et suivez votre progression ici." />
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
          const targets = objectiveTargets(s)
          // Atteint si une même séance remplit toutes les cibles
          const reachedAll = logs.some(
            (l) =>
              l.sessionId === s.id &&
              targets.every((t) => {
                const mv = l.metrics?.find((x) => x.key === t.key)
                return !!mv && mv.value >= t.value
              }),
          )
          return (
            <div key={s.id} className="rounded-3xl bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">
                    {CATEGORY_META[s.category].emoji} {s.name}
                  </p>
                  {targets.length > 1 && (
                    <p className="text-[11px] font-semibold text-ink-soft">À réussir dans une même séance :</p>
                  )}
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
              <div className="mt-2 space-y-2">
                {targets.map((t) => {
                  const cur = bestMetric(s, t.key)
                  const ok = cur >= t.value
                  return (
                    <div key={t.key}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-xs font-bold text-ink-soft">{t.label}</span>
                        <span className={'text-xs font-extrabold ' + (ok ? 'text-sage-600' : 'text-ink-soft')}>
                          {cur} / {t.value} {t.unit} {ok && '✓'}
                        </span>
                      </div>
                      <ProgressBar ratio={t.value ? cur / t.value : 0} reached={ok} />
                    </div>
                  )
                })}
                <p className="text-xs font-extrabold">
                  {reachedAll ? (
                    <span className="text-sage-600">🎉 Objectif complet atteint !</span>
                  ) : (
                    <span className="text-ink-soft">En cours…</span>
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
                setMtargets({})
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
            <Field label="Cibles (remplissez une ou plusieurs mesures)">
              <div className="space-y-2">
                {selMetrics.map((m) => (
                  <div key={m.key} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm font-bold">{m.label}</span>
                    <div className="min-w-0 flex-1">
                      <NumInput
                        value={mtargets[m.key]}
                        onChange={(v) => setMtargets((p) => ({ ...p, [m.key]: v }))}
                        suffix={m.unit || undefined}
                        placeholder="—"
                      />
                    </div>
                  </div>
                ))}
                <p className="text-xs font-semibold text-ink-soft">
                  Avec plusieurs cibles, l'objectif est atteint quand une même séance les remplit toutes (ex. 45 min ET
                  130 bpm ET 15 W).
                </p>
              </div>
            </Field>
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
