import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Log, type MetricValue, type Session } from '../types'
import { todayStr } from '../lib/dates'
import { effectiveMetrics } from '../lib/metrics'
import { Field, GhostButton, NumInput, PrimaryButton, Sheet, Stepper, TextArea } from './ui'

/** Feuille de complétion d'une séance : formulaire adapté à chaque sport */
export default function CompleteSheet({ session, onClose }: { session: Session | null; onClose: () => void }) {
  return (
    <Sheet
      open={!!session}
      onClose={onClose}
      title={session ? `${CATEGORY_META[session.category].emoji} ${session.name}` : undefined}
    >
      {session && <Inner key={session.id} session={session} onClose={onClose} />}
    </Sheet>
  )
}

function Inner({ session, onClose }: { session: Session; onClose: () => void }) {
  const { addLog, logs, exercises } = useData()
  const navigate = useNavigate()
  const [note, setNote] = useState('')

  const metrics = useMemo(() => effectiveMetrics(session), [session])
  const links = session.links ?? []
  const isMuscu = session.category === 'muscu'
  const hasTimer = (session.category === 'hiit' || session.category === 'etirements') && session.items.length > 0
  const hasForm = metrics.length > 0 || (isMuscu && session.items.length > 0)

  // Dernière séance identique, pour préremplir (logs triés du plus récent au plus ancien)
  const lastLog = useMemo(() => logs.find((l) => l.sessionId === session.id), [logs, session.id])

  // Valeurs des mesures personnalisées
  const [mvals, setMvals] = useState<Record<string, number | undefined>>(() => {
    const m: Record<string, number | undefined> = {}
    for (const def of metrics) m[def.key] = lastLog?.metrics?.find((x) => x.key === def.key)?.value
    return m
  })

  // Muscu : répétitions réalisées par série
  const exOf = (id: string) => exercises.find((e) => e.id === id)
  const [values, setValues] = useState<Record<string, number[]>>(() => {
    const m: Record<string, number[]> = {}
    for (const it of session.items) {
      const prev = lastLog?.results?.find((r) => r.exerciseId === it.exerciseId)
      m[it.exerciseId] = prev ? [...prev.sets] : Array.from({ length: it.sets ?? 3 }, () => it.target ?? 10)
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
    if (isMuscu && session.items.length) {
      extra.results = session.items.map((it) => {
        const ex = exOf(it.exerciseId)
        return {
          exerciseId: it.exerciseId,
          name: ex?.name ?? 'Exercice',
          measure: ex?.measure ?? ('reps' as const),
          sets: values[it.exerciseId] ?? [],
        }
      })
    }
    await addLog({
      date: todayStr(),
      sessionId: session.id,
      sessionName: session.name,
      category: session.category,
      createdAt: Date.now(),
      note: note.trim(),
      ...extra,
    })
    onClose()
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

      {isMuscu &&
        session.items.map((it) => {
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
              <div className="mt-2 flex gap-3 text-xs font-bold">
                <button type="button" className="text-sage-600" onClick={() => addSet(it.exerciseId)}>
                  + Ajouter une série
                </button>
                {(values[it.exerciseId]?.length ?? 0) > 1 && (
                  <button type="button" className="text-ink-soft" onClick={() => removeSet(it.exerciseId)}>
                    − Retirer
                  </button>
                )}
              </div>
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
