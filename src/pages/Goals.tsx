import { useMemo, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Exercise, type GoalLevel, type ObjectiveLevel, type Session } from '../types'
import { effectiveMetrics, goalLevels, objectiveLevels } from '../lib/metrics'
import { CategoryIcon, EmptyState, Fab, Field, NumInput, PageHeader, PrimaryButton, Seg, Select, Sheet } from '../components/ui'

const inputSm =
  'w-full rounded-xl border border-sand bg-surface px-3 py-2.5 text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-soft/50 focus:border-sage-400'

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

/** Ligne d'un palier déjà atteint, avec sa récompense débloquée */
function ReachedLevel({ label, reward }: { label: string; reward?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 rounded-xl bg-sage-50 px-3 py-1.5">
      <span className="text-xs font-extrabold text-sage-600">✓ {label}</span>
      {reward && <span className="truncate text-xs font-bold text-sage-700">🎁 {reward} — débloquée !</span>}
    </div>
  )
}

/** Paliers en cours de saisie — muscu : une valeur ; séance : une valeur par mesure */
type ExDraft = { value?: number; reward: string }
type SessDraft = { values: Record<string, number | undefined>; reward: string }

const emptyExDraft = (): ExDraft => ({ value: undefined, reward: '' })
const emptySessDraft = (): SessDraft => ({ values: {}, reward: '' })

export default function Goals() {
  const { sessions, exercises, logs, updateExercise, updateSession } = useData()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  // --- Création / modification d'un objectif
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
  const [exDrafts, setExDrafts] = useState<ExDraft[]>([emptyExDraft()])
  const [sessDrafts, setSessDrafts] = useState<SessDraft[]>([emptySessDraft()])

  const isMuscuTarget = selSession?.category === 'muscu' && sessionExercises.length > 0
  const level1Keys = selMetrics.filter((m) => sessDrafts[0]?.values[m.key] != null).map((m) => m.key)
  const canCreate = isMuscuTarget ? exDrafts.some((d) => d.value != null) && !!selEx : level1Keys.length > 0

  const resetDrafts = () => {
    setExDrafts([emptyExDraft()])
    setSessDrafts([emptySessDraft()])
  }

  const openCreate = () => {
    setEditing(false)
    setSelSessionId('')
    setSelExId('')
    setExMetric('best')
    resetDrafts()
    setAddOpen(true)
  }

  /** Préremplit la feuille pour modifier l'objectif d'un exercice (paliers + récompenses) */
  const openEditExercise = (e: Exercise) => {
    const host = sessions.find((s) => s.category === 'muscu' && s.items.some((it) => it.exerciseId === e.id))
    if (!host || !e.goal) return
    setEditing(true)
    setSelSessionId(host.id)
    setSelExId(e.id)
    setExMetric(e.goal.metric)
    setExDrafts(goalLevels(e.goal).map((l) => ({ value: l.value, reward: l.reward ?? '' })))
    setSessDrafts([emptySessDraft()])
    setAddOpen(true)
  }

  /** Préremplit la feuille pour modifier l'objectif d'une séance */
  const openEditSession = (s: Session) => {
    setEditing(true)
    setSelSessionId(s.id)
    setSelExId('')
    setExDrafts([emptyExDraft()])
    setSessDrafts(
      objectiveLevels(s).map((lv) => ({
        values: Object.fromEntries(lv.targets.map((t) => [t.key, t.value])),
        reward: lv.reward ?? '',
      })),
    )
    setAddOpen(true)
  }

  const createGoal = async () => {
    if (!selSession) return
    if (isMuscuTarget && selEx) {
      const levels: GoalLevel[] = exDrafts
        .filter((d) => d.value != null)
        .map((d) => ({ value: d.value!, ...(d.reward.trim() ? { reward: d.reward.trim() } : {}) }))
        .sort((a, b) => a.value - b.value)
      if (!levels.length) return
      await updateExercise(selEx.id, { goal: { metric: exMetric, value: levels[0].value, levels } })
    } else {
      const levels: ObjectiveLevel[] = sessDrafts.flatMap((d) => {
        const targets = selMetrics
          .filter((m) => level1Keys.includes(m.key) && d.values[m.key] != null)
          .map((m) => ({ key: m.key, label: m.label, unit: m.unit, value: d.values[m.key]! }))
        if (!targets.length) return []
        return [{ targets, ...(d.reward.trim() ? { reward: d.reward.trim() } : {}) }]
      })
      if (!levels.length) return
      await updateSession(selSession.id, { objective: { targets: levels[0].targets, levels } })
    }
    resetDrafts()
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
  /** Palier de séance atteint si UNE même séance enregistrée remplit toutes ses cibles */
  const sessionLevelReached = (s: Session, lv: ObjectiveLevel): boolean =>
    logs.some(
      (l) =>
        l.sessionId === s.id &&
        lv.targets.every((t) => {
          const mv = l.metrics?.find((x) => x.key === t.key)
          return !!mv && mv.value >= t.value
        }),
    )

  const exerciseGoals = exercises.filter((e) => e.goal && goalLevels(e.goal).length > 0)
  const sessionGoals = sessions.filter((s) => objectiveLevels(s).length > 0)
  const total = exerciseGoals.length + sessionGoals.length

  const targetsLabel = (lv: ObjectiveLevel) =>
    lv.targets.map((t) => `${t.label} ${t.value}${t.unit ? ' ' + t.unit : ''}`).join(' · ')

  return (
    <div>
      <PageHeader kicker="Cap sur la progression" title="Objectifs" />

      <div className="space-y-3 px-5">
        {total === 0 && (
          <EmptyState
            emoji="🎯"
            text="Fixez un objectif par paliers (ex. Pompes : 20 puis 30 en une série) avec une récompense à la clé pour chaque palier — lunettes de soleil, resto… 🎁"
          />
        )}

        {exerciseGoals.map((e) => {
          const goal = e.goal!
          const levels = goalLevels(goal)
          const cur = bestForExercise(e)
          const unit = e.measure === 'sec' ? 's' : 'reps'
          const next = levels.find((l) => cur < l.value)
          return (
            <div key={e.id} className="rounded-3xl bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-base font-extrabold">
                    <CategoryIcon category="muscu" className="h-4 w-4 shrink-0 text-muscu" />
                    <span className="min-w-0 truncate">{e.name}</span>
                  </p>
                  <p className="text-xs font-semibold text-ink-soft">
                    {goal.metric === 'best' ? 'Meilleure série' : 'Volume sur une séance'} ·{' '}
                    {levels.length > 1 ? `${levels.length} paliers` : `objectif ${levels[0].value} ${unit}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Modifier cet objectif"
                    onClick={() => openEditExercise(e)}
                    className="px-1 text-ink-soft/50 active:text-sage-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Supprimer cet objectif"
                    onClick={() => {
                      if (window.confirm(`Supprimer l'objectif sur « ${e.name} » ?`)) void updateExercise(e.id, { goal: null })
                    }}
                    className="px-1 text-ink-soft/50 active:text-hiit"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2.5 space-y-1.5">
                {levels.filter((l) => cur >= l.value).map((l) => (
                  <ReachedLevel key={l.value} label={`${l.value} ${unit}`} reward={l.reward} />
                ))}
                {next ? (
                  <div>
                    <ProgressBar ratio={next.value ? cur / next.value : 0} reached={false} />
                    <p className="mt-1.5 text-xs font-extrabold text-ink-soft">
                      {cur} / {next.value} {unit} — encore {next.value - cur}
                      {next.reward && <span className="text-running"> · 🎁 {next.reward}</span>}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs font-extrabold text-sage-600">🎉 Tous les paliers atteints — record {cur} {unit}</p>
                )}
                {levels
                  .filter((l) => cur < l.value && l !== next)
                  .map((l) => (
                    <p key={l.value} className="text-[11px] font-semibold text-ink-soft/70">
                      Puis {l.value} {unit}
                      {l.reward ? ` · 🎁 ${l.reward}` : ''}
                    </p>
                  ))}
              </div>
            </div>
          )
        })}

        {sessionGoals.map((s) => {
          const levels = objectiveLevels(s)
          const next = levels.find((lv) => !sessionLevelReached(s, lv))
          return (
            <div key={s.id} className="rounded-3xl bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-base font-extrabold">
                    <CategoryIcon category={s.category} className={`h-4 w-4 shrink-0 ${CATEGORY_META[s.category].text}`} />
                    <span className="min-w-0 truncate">{s.name}</span>
                  </p>
                  <p className="text-[11px] font-semibold text-ink-soft">
                    {levels.length > 1 ? `${levels.length} paliers — ` : ''}
                    {(next ?? levels[0]).targets.length > 1 ? 'à réussir dans une même séance' : 'objectif de séance'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Modifier cet objectif"
                    onClick={() => openEditSession(s)}
                    className="px-1 text-ink-soft/50 active:text-sage-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Supprimer cet objectif"
                    onClick={() => {
                      if (window.confirm(`Supprimer l'objectif sur « ${s.name} » ?`)) void updateSession(s.id, { objective: null })
                    }}
                    className="px-1 text-ink-soft/50 active:text-hiit"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                {levels
                  .filter((lv) => sessionLevelReached(s, lv))
                  .map((lv, i) => (
                    <ReachedLevel key={i} label={targetsLabel(lv)} reward={lv.reward} />
                  ))}
                {next && (
                  <div className="space-y-2">
                    {next.targets.map((t) => {
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
                    {next.reward && (
                      <p className="text-xs font-extrabold text-running">🎁 À la clé : {next.reward}</p>
                    )}
                  </div>
                )}
                {levels
                  .filter((lv) => !sessionLevelReached(s, lv) && lv !== next)
                  .map((lv, i) => (
                    <p key={i} className="text-[11px] font-semibold text-ink-soft/70">
                      Puis {targetsLabel(lv)}
                      {lv.reward ? ` · 🎁 ${lv.reward}` : ''}
                    </p>
                  ))}
                {!next && <p className="text-xs font-extrabold text-sage-600">🎉 Tous les paliers atteints !</p>}
              </div>
            </div>
          )
        })}
      </div>

      <Fab label="+ Objectif" onClick={openCreate} />

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={editing ? 'Modifier l’objectif' : 'Nouvel objectif'}>
        <div className="space-y-4">
          <Field label="Séance">
            <Select
              value={selSession?.id ?? ''}
              onChange={(v) => {
                setSelSessionId(v)
                setSelExId('')
                resetDrafts()
              }}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          {isMuscuTarget && (
            <>
              <Field label="Exercice de la séance">
                <Select value={selEx?.id ?? ''} onChange={setSelExId}>
                  {sessionExercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
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
              <Field label="Paliers à atteindre">
                <div className="space-y-2">
                  {exDrafts.map((d, i) => (
                    <div key={i} className="space-y-2 rounded-2xl bg-sage-50 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
                          Palier {i + 1}
                        </p>
                        {exDrafts.length > 1 && (
                          <button
                            type="button"
                            aria-label="Retirer ce palier"
                            onClick={() => setExDrafts((p) => p.filter((_, j) => j !== i))}
                            className="px-1 text-ink-soft/50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <NumInput
                        value={d.value}
                        onChange={(v) => setExDrafts((p) => p.map((x, j) => (j === i ? { ...x, value: v } : x)))}
                        suffix={selEx?.measure === 'sec' ? 's' : 'reps'}
                        placeholder="Ex. 20"
                      />
                      <input
                        type="text"
                        value={d.reward}
                        onChange={(e) => setExDrafts((p) => p.map((x, j) => (j === i ? { ...x, reward: e.target.value } : x)))}
                        placeholder="🎁 Récompense (ex. lunettes de soleil)"
                        className={inputSm}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExDrafts((p) => [...p, emptyExDraft()])}
                    className="rounded-full bg-sage-100 px-4 py-2 text-xs font-extrabold text-sage-700 active:bg-sage-200"
                  >
                    + Ajouter un palier
                  </button>
                </div>
              </Field>
            </>
          )}

          {!isMuscuTarget && selMetrics.length > 0 && (
            <Field label="Paliers (remplissez une ou plusieurs mesures)">
              <div className="space-y-2">
                {sessDrafts.map((d, i) => {
                  const visible = i === 0 ? selMetrics : selMetrics.filter((m) => level1Keys.includes(m.key))
                  return (
                    <div key={i} className="space-y-2 rounded-2xl bg-sage-50 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
                          Palier {i + 1}
                        </p>
                        {sessDrafts.length > 1 && (
                          <button
                            type="button"
                            aria-label="Retirer ce palier"
                            onClick={() => setSessDrafts((p) => p.filter((_, j) => j !== i))}
                            className="px-1 text-ink-soft/50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {visible.length === 0 && (
                        <p className="text-xs font-semibold text-ink-soft">
                          Remplissez d'abord une mesure au palier 1.
                        </p>
                      )}
                      {visible.map((m) => (
                        <div key={m.key} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 truncate text-sm font-bold">{m.label}</span>
                          <div className="min-w-0 flex-1">
                            <NumInput
                              value={d.values[m.key]}
                              onChange={(v) =>
                                setSessDrafts((p) =>
                                  p.map((x, j) => (j === i ? { ...x, values: { ...x.values, [m.key]: v } } : x)),
                                )
                              }
                              suffix={m.unit || undefined}
                              placeholder="—"
                            />
                          </div>
                        </div>
                      ))}
                      <input
                        type="text"
                        value={d.reward}
                        onChange={(e) =>
                          setSessDrafts((p) => p.map((x, j) => (j === i ? { ...x, reward: e.target.value } : x)))
                        }
                        placeholder="🎁 Récompense (ex. lunettes de soleil)"
                        className={inputSm}
                      />
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setSessDrafts((p) => [...p, emptySessDraft()])}
                  className="rounded-full bg-sage-100 px-4 py-2 text-xs font-extrabold text-sage-700 active:bg-sage-200"
                >
                  + Ajouter un palier
                </button>
                <p className="text-xs font-semibold text-ink-soft">
                  Un palier avec plusieurs cibles est atteint quand une même séance les remplit toutes (ex. 45 min ET
                  130 bpm). Chaque palier peut avoir sa récompense 🎁.
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
            {editing ? 'Enregistrer les paliers' : "Créer l'objectif"}
          </PrimaryButton>
        </div>
      </Sheet>
    </div>
  )
}
