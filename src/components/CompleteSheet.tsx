import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Log, type Session, type VeloData } from '../types'
import { todayStr } from '../lib/dates'
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
  const { addLog, logs } = useData()
  const navigate = useNavigate()
  const [note, setNote] = useState('')

  // Dernière séance identique, pour préremplir (logs triés du plus récent au plus ancien)
  const lastLog = useMemo(() => logs.find((l) => l.sessionId === session.id), [logs, session.id])

  const save = async (extra: Partial<Omit<Log, 'id'>>) => {
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

  if (session.category === 'running') {
    return (
      <div className="space-y-4">
        {session.notes && <p className="text-sm font-semibold text-ink-soft">{session.notes}</p>}
        <p className="text-sm text-ink-soft">Vos perfs running restent sur votre app de course — ici, on coche simplement la sortie.</p>
        <PrimaryButton onClick={() => void save({})}>Marquer comme faite ✓</PrimaryButton>
      </div>
    )
  }

  if (session.category === 'velo') {
    return <VeloForm session={session} lastVelo={lastLog?.velo} note={note} setNote={setNote} save={save} />
  }

  if (session.category === 'muscu') {
    return <MuscuForm session={session} lastLog={lastLog} note={note} setNote={setNote} save={save} />
  }

  // HIIT et étirements : minuteur guidé ou simple validation
  const hasTimer = session.items.length > 0
  return (
    <div className="space-y-3">
      {session.notes && <p className="text-sm font-semibold text-ink-soft">{session.notes}</p>}
      {hasTimer && (
        <PrimaryButton onClick={() => navigate(`/player/${session.id}`)}>
          ▶ Lancer le minuteur guidé
        </PrimaryButton>
      )}
      <GhostButton onClick={() => void save({})}>Marquer comme faite ✓ (sans minuteur)</GhostButton>
    </div>
  )
}

// ------------------------------------------------------------------- Vélo

function VeloForm({
  session,
  lastVelo,
  note,
  setNote,
  save,
}: {
  session: Session
  lastVelo: VeloData | undefined
  note: string
  setNote: (v: string) => void
  save: (extra: Partial<Omit<Log, 'id'>>) => Promise<void>
}) {
  const [velo, setVelo] = useState<VeloData>({
    powerW: lastVelo?.powerW ?? session.targetPowerW,
    durationMin: lastVelo?.durationMin ?? session.targetDurationMin,
    distanceKm: lastVelo?.distanceKm,
    avgSpeedKmh: lastVelo?.avgSpeedKmh,
    avgBpm: lastVelo?.avgBpm,
  })
  const set = (k: keyof VeloData) => (v: number | undefined) => setVelo((p) => ({ ...p, [k]: v }))

  const submit = () => {
    const v = { ...velo }
    // Vitesse moyenne déduite si absente
    if (!v.avgSpeedKmh && v.distanceKm && v.durationMin) {
      v.avgSpeedKmh = Math.round((v.distanceKm / (v.durationMin / 60)) * 10) / 10
    }
    void save({ velo: v })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-ink-soft">Prérempli avec votre dernière séance — ajustez en deux taps.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Puissance">
          <NumInput value={velo.powerW} onChange={set('powerW')} suffix="W" placeholder="120" />
        </Field>
        <Field label="Durée">
          <NumInput value={velo.durationMin} onChange={set('durationMin')} suffix="min" placeholder="30" />
        </Field>
        <Field label="Distance">
          <NumInput value={velo.distanceKm} onChange={set('distanceKm')} suffix="km" placeholder="12" />
        </Field>
        <Field label="Vitesse moy.">
          <NumInput value={velo.avgSpeedKmh} onChange={set('avgSpeedKmh')} suffix="km/h" placeholder="auto" />
        </Field>
        <Field label="BPM moyen">
          <NumInput value={velo.avgBpm} onChange={set('avgBpm')} suffix="bpm" placeholder="130" />
        </Field>
      </div>
      <Field label="Note (optionnel)">
        <TextArea value={note} onChange={setNote} rows={2} placeholder="Ressenti, remarques…" />
      </Field>
      <PrimaryButton onClick={submit}>Enregistrer ✓</PrimaryButton>
    </div>
  )
}

// ------------------------------------------------------------------- Muscu

function MuscuForm({
  session,
  lastLog,
  note,
  setNote,
  save,
}: {
  session: Session
  lastLog: Log | undefined
  note: string
  setNote: (v: string) => void
  save: (extra: Partial<Omit<Log, 'id'>>) => Promise<void>
}) {
  const { exercises } = useData()
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

  const submit = () => {
    const results = session.items.map((it) => {
      const ex = exOf(it.exerciseId)
      return {
        exerciseId: it.exerciseId,
        name: ex?.name ?? 'Exercice',
        measure: ex?.measure ?? ('reps' as const),
        sets: values[it.exerciseId] ?? [],
      }
    })
    void save({ results })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-ink-soft">Prérempli avec votre dernière séance — ajustez en deux taps.</p>
      {session.items.map((it) => {
        const ex = exOf(it.exerciseId)
        const suffix = ex?.measure === 'sec' ? 's' : ''
        return (
          <div key={it.exerciseId} className="rounded-2xl bg-sage-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold">{ex?.name ?? 'Exercice'}</p>
              {ex?.videoUrl && (
                <a
                  href={ex.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-velo"
                >
                  ▶ démo
                </a>
              )}
            </div>
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
      <Field label="Note (optionnel)">
        <TextArea value={note} onChange={setNote} rows={2} placeholder="Ressenti, remarques…" />
      </Field>
      <PrimaryButton onClick={submit}>Enregistrer ✓</PrimaryButton>
    </div>
  )
}
