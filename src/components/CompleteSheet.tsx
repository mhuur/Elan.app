import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Log, type MetricValue, type Session, type SessionItem } from '../types'
import { todayStr } from '../lib/dates'
import { mmss } from '../lib/format'
import { effectiveMetrics } from '../lib/metrics'
import { tone } from '../lib/audio'
import { Field, GhostButton, NumInput, PrimaryButton, Sheet, Stepper, TextArea } from './ui'

/** Compte à rebours de repos entre les séries, avec bip à la fin */
function RestTimer({ sec }: { sec: number }) {
  const [left, setLeft] = useState<number | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const endAtRef = useRef(0)

  useEffect(() => {
    return () => {
      if (audioRef.current && audioRef.current.state !== 'closed') void audioRef.current.close()
    }
  }, [])

  useEffect(() => {
    if (left == null) return
    const iv = window.setInterval(() => {
      const ms = endAtRef.current - Date.now()
      if (ms <= 0) {
        if (audioRef.current) tone(audioRef.current, 880, 0.5)
        navigator.vibrate?.([150, 80, 150])
        setLeft(null)
      } else {
        setLeft(Math.ceil(ms / 1000))
      }
    }, 200)
    return () => window.clearInterval(iv)
  }, [left])

  const start = () => {
    audioRef.current = audioRef.current ?? new AudioContext()
    void audioRef.current.resume()
    endAtRef.current = Date.now() + sec * 1000
    setLeft(sec)
  }

  return left == null ? (
    <button type="button" onClick={start} className="rounded-full bg-velo/10 px-3 py-1.5 text-xs font-extrabold text-velo">
      ⏱ Repos {sec} s
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setLeft(null)}
      className="rounded-full bg-velo px-3 py-1.5 text-xs font-extrabold tabular-nums text-white"
    >
      {mmss(left)} · stop
    </button>
  )
}

/** Groupes d'exercices : les items liés (superset) sont regroupés */
function buildGroups(items: SessionItem[]): SessionItem[][] {
  const groups: SessionItem[][] = []
  let current: SessionItem[] = []
  items.forEach((it, i) => {
    current.push(it)
    if (!(it.linkNext && i < items.length - 1)) {
      groups.push(current)
      current = []
    }
  })
  return groups
}

/** Feuille de complétion d'une séance : formulaire adapté à chaque sport */
export default function CompleteSheet({
  session,
  onClose,
  date,
}: {
  session: Session | null
  onClose: () => void
  /** Date du log (YYYY-MM-DD), aujourd'hui par défaut — permet la saisie rétroactive */
  date?: string
}) {
  return (
    <Sheet
      open={!!session}
      onClose={onClose}
      title={session ? `${CATEGORY_META[session.category].emoji} ${session.name}` : undefined}
    >
      {session && <Inner key={session.id} session={session} onClose={onClose} date={date} />}
    </Sheet>
  )
}

function Inner({ session, onClose, date }: { session: Session; onClose: () => void; date?: string }) {
  const { addLog, logs, exercises } = useData()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [celebrate, setCelebrate] = useState<string[] | null>(null)
  const logDate = date ?? todayStr()

  const metrics = useMemo(() => effectiveMetrics(session), [session])
  const links = session.links ?? []
  const isMuscu = session.category === 'muscu'
  // Le minuteur guidé n'a de sens que pour la journée en cours
  const hasTimer =
    (session.category === 'hiit' || session.category === 'etirements') &&
    session.items.length > 0 &&
    logDate === todayStr()
  const hasForm = metrics.length > 0 || (isMuscu && session.items.length > 0)

  // Dernière séance identique, pour préremplir (logs triés du plus récent au plus ancien)
  const lastLog = useMemo(() => logs.find((l) => l.sessionId === session.id), [logs, session.id])

  // Valeurs des mesures personnalisées
  const [mvals, setMvals] = useState<Record<string, number | undefined>>(() => {
    const m: Record<string, number | undefined> = {}
    for (const def of metrics) m[def.key] = lastLog?.metrics?.find((x) => x.key === def.key)?.value
    return m
  })

  // Muscu : répétitions réalisées par série (tours du circuit inclus)
  const exOf = (id: string) => exercises.find((e) => e.id === id)
  const roundsMul = isMuscu ? (session.rounds ?? 1) : 1
  const [values, setValues] = useState<Record<string, number[]>>(() => {
    const m: Record<string, number[]> = {}
    for (const it of session.items) {
      const prev = lastLog?.results?.find((r) => r.exerciseId === it.exerciseId)
      m[it.exerciseId] = prev
        ? [...prev.sets]
        : Array.from({ length: (it.sets ?? 3) * roundsMul }, () => it.target ?? 10)
    }
    return m
  })
  const setRep = (exId: string, setIdx: number, v: number) =>
    setValues((p) => ({ ...p, [exId]: p[exId].map((r, i) => (i === setIdx ? v : r)) }))
  const addSet = (exId: string) => setValues((p) => ({ ...p, [exId]: [...p[exId], p[exId].at(-1) ?? 10] }))
  const removeSet = (exId: string) => setValues((p) => ({ ...p, [exId]: p[exId].slice(0, -1) }))

  const buildMetricValues = (): MetricValue[] => {
    const vals = { ...mvals }
    // Vitesse moyenne déduite si absente (mesures vélo par défaut)
    if (vals.speed == null && vals.distance && vals.duration) {
      vals.speed = Math.round((vals.distance / (vals.duration / 60)) * 10) / 10
    }
    return metrics.flatMap((d) => {
      const v = vals[d.key]
      return v == null ? [] : [{ key: d.key, label: d.label, unit: d.unit, value: v }]
    })
  }

  const save = async () => {
    const extra: Partial<Omit<Log, 'id'>> = {}
    const mv = buildMetricValues()
    if (mv.length) extra.metrics = mv
    const achieved: string[] = []
    // Objectif de séance (sur une mesure) atteint ?
    if (session.objective) {
      const o = session.objective
      const got = mv.find((x) => x.key === o.metricKey)
      if (got && got.value >= o.value) {
        achieved.push(`${o.label} : ${got.value}${o.unit ? ' ' + o.unit : ''} (objectif ${o.value})`)
      }
    }
    if (isMuscu && session.items.length) {
      extra.results = session.items.map((it) => {
        const ex = exOf(it.exerciseId)
        const sets = values[it.exerciseId] ?? []
        // Objectif atteint ?
        if (ex?.goal && sets.length) {
          const v = ex.goal.metric === 'best' ? Math.max(...sets) : sets.reduce((a, b) => a + b, 0)
          if (v >= ex.goal.value) {
            const unit = ex.measure === 'sec' ? 's' : 'reps'
            achieved.push(`${ex.name} : ${v} ${unit} (objectif ${ex.goal.value})`)
          }
        }
        return {
          exerciseId: it.exerciseId,
          name: ex?.name ?? 'Exercice',
          measure: ex?.measure ?? ('reps' as const),
          sets,
        }
      })
    }
    await addLog({
      date: logDate,
      sessionId: session.id,
      sessionName: session.name,
      category: session.category,
      createdAt: Date.now(),
      note: note.trim(),
      ...extra,
    })
    if (achieved.length) setCelebrate(achieved)
    else onClose()
  }

  if (celebrate) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="text-6xl">🎉</div>
        <h3 className="text-xl font-extrabold">Objectif atteint, bravo !</h3>
        <div className="space-y-1">
          {celebrate.map((a, i) => (
            <p key={i} className="text-sm font-bold text-sage-700">
              🎯 {a}
            </p>
          ))}
        </div>
        <div className="w-full">
          <PrimaryButton onClick={onClose}>Continuer</PrimaryButton>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {session.notes && <p className="text-sm font-semibold text-ink-soft">{session.notes}</p>}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l, i) => (
            <a
              key={i}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-velo/10 px-3.5 py-2 text-xs font-extrabold text-velo active:bg-velo/20"
            >
              ▶ {l.label}
            </a>
          ))}
        </div>
      )}

      {session.category === 'running' && !hasForm && (
        <p className="text-sm text-ink-soft">
          Vos perfs running restent sur votre app de course — ici, on coche simplement la sortie.
        </p>
      )}

      {hasTimer && <PrimaryButton onClick={() => navigate(`/player/${session.id}`)}>▶ Lancer le minuteur guidé</PrimaryButton>}

      {(hasForm || isMuscu) && lastLog && (
        <p className="text-xs font-semibold text-ink-soft">Prérempli avec votre dernière séance — ajustez en deux taps.</p>
      )}

      {isMuscu && roundsMul > 1 && (
        <p className="rounded-2xl bg-muscu/10 px-4 py-2.5 text-xs font-bold text-muscu">
          🔁 Circuit × {roundsMul} tours : faites tous les exercices, puis recommencez. Les séries des tours sont déjà
          comptées ci-dessous.
        </p>
      )}

      {isMuscu &&
        buildGroups(session.items).map((group, gi) => {
          const renderItem = (it: SessionItem, showRest: boolean) => {
            const ex = exOf(it.exerciseId)
            const suffix = ex?.measure === 'sec' ? 's' : ''
            return (
              <div key={it.exerciseId} className="rounded-2xl bg-sage-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-extrabold">{ex?.name ?? 'Exercice'}</p>
                  {ex?.videoUrl && (
                    <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-velo">
                      ▶ démo
                    </a>
                  )}
                </div>
                {it.comment && <p className="mt-0.5 text-xs font-semibold text-ink-soft">💡 {it.comment}</p>}
                <div className="mt-2 space-y-1.5">
                  {(values[it.exerciseId] ?? []).map((rep, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink-soft">Série {i + 1}</span>
                      <Stepper value={rep} onChange={(v) => setRep(it.exerciseId, i, v)} suffix={suffix} step={ex?.measure === 'sec' ? 5 : 1} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex gap-3 text-xs font-bold">
                    <button type="button" className="text-sage-600" onClick={() => addSet(it.exerciseId)}>
                      + Ajouter une série
                    </button>
                    {(values[it.exerciseId]?.length ?? 0) > 1 && (
                      <button type="button" className="text-ink-soft" onClick={() => removeSet(it.exerciseId)}>
                        − Retirer
                      </button>
                    )}
                  </div>
                  {showRest && (it.restSec ?? 60) > 0 && <RestTimer sec={it.restSec ?? 60} />}
                </div>
              </div>
            )
          }

          if (group.length === 1) return <div key={gi}>{renderItem(group[0], true)}</div>
          return (
            <div key={gi} className="rounded-3xl border-2 border-muscu/30 p-1.5">
              <p className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muscu">
                🔗 Superset — enchaîner sans repos
              </p>
              <div className="space-y-1.5">{group.map((it) => renderItem(it, false))}</div>
              {(group[0].restSec ?? 60) > 0 && (
                <div className="flex items-center justify-between px-2 py-2">
                  <span className="text-xs font-bold text-ink-soft">Repos après le superset</span>
                  <RestTimer sec={group[0].restSec ?? 60} />
                </div>
              )}
            </div>
          )
        })}

      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((d) => (
            <Field key={d.key} label={d.label}>
              <NumInput
                value={mvals[d.key]}
                onChange={(v) => setMvals((p) => ({ ...p, [d.key]: v }))}
                suffix={d.unit || undefined}
                placeholder={d.key === 'speed' ? 'auto' : undefined}
              />
            </Field>
          ))}
        </div>
      )}

      {hasForm && (
        <Field label="Note (optionnel)">
          <TextArea value={note} onChange={setNote} rows={2} placeholder="Ressenti, remarques…" />
        </Field>
      )}

      {hasTimer ? (
        <GhostButton onClick={() => void save()}>Marquer comme faite ✓ (sans minuteur)</GhostButton>
      ) : (
        <PrimaryButton onClick={() => void save()}>{hasForm ? 'Enregistrer ✓' : 'Marquer comme faite ✓'}</PrimaryButton>
      )}
    </div>
  )
}
