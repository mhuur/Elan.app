import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useData } from '../data/DataContext'
import { CATEGORY_META, type Log } from '../types'
import { buildTimeline, timelineFromLog, collectSets, type SetStatus } from '../lib/timeline'
import { CategoryIcon, Field, NumInput, PrimaryButton, Sheet, TextArea } from './ui'
import ResultTimeline from './ResultTimeline'

const shortFr = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

/** Fiche d'une séance terminée : consulter et corriger le réalisé, les mesures, la note ; supprimer */
export default function LogSheet({ log, onClose }: { log: Log | null; onClose: () => void }) {
  return (
    <Sheet
      open={!!log}
      onClose={onClose}
      title={
        log ? (
          <span className="flex items-center gap-2">
            <CategoryIcon category={log.category} className={`h-5 w-5 shrink-0 ${CATEGORY_META[log.category].text}`} />
            <span className="min-w-0 truncate">{log.sessionName}</span>
          </span>
        ) : undefined
      }
    >
      {log && <Inner key={log.id} log={log} onClose={onClose} />}
    </Sheet>
  )
}

function Inner({ log, onClose }: { log: Log; onClose: () => void }) {
  const { sessions, exercises, logs, updateLog, removeLog } = useData()
  const session = sessions.find((s) => s.id === log.sessionId)
  const hasTimeline = log.category === 'muscu' || log.category === 'hiit'
  const hasResults = !!log.results?.length

  // Timeline de la séance actuelle, préremplie avec le réalisé du log (valeurs réelles conservées)
  // + comparatif léger : la dernière séance plus ancienne contenant le même exercice
  const timeline = useMemo(() => {
    if (!hasTimeline) return []
    const base = session ? buildTimeline(session, exercises) : timelineFromLog(log)
    const older = logs.filter(
      (l) => l.id !== log.id && (l.date < log.date || (l.date === log.date && l.createdAt < log.createdAt)),
    )
    const occ: Record<string, number> = {}
    const compared = new Set<string>()
    return base.map((g) => ({
      header: g.header,
      rows: g.rows.map((row) => {
        const i = occ[row.exId] ?? 0
        occ[row.exId] = i + 1
        const r = log.results?.find((x) => x.exerciseId === row.exId)
        const value = r && i < r.sets.length ? r.sets[i] : row.value
        let sub: string | undefined
        if (!compared.has(row.exId)) {
          compared.add(row.exId)
          for (const ol of older) {
            const or = ol.results?.find((x) => x.exerciseId === row.exId)
            if (or?.sets.length) {
              sub = `dernière fois : ${Math.max(...or.sets)} ${row.unit} · ${shortFr(ol.date)}`
              break
            }
          }
        }
        return { ...row, value, sub }
      }),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, session, exercises, logs, hasTimeline])
  const flatRows = useMemo(() => timeline.flatMap((g) => g.rows), [timeline])

  // Statut initial : le réalisé du log (sans résultats — séance « marquée faite » — tout est ✓)
  const [status, setStatus] = useState<SetStatus[]>(() => {
    const occ: Record<string, number> = {}
    return timeline
      .flatMap((g) => g.rows)
      .map((row) => {
        if (!hasResults) return 'ok'
        const i = occ[row.exId] ?? 0
        occ[row.exId] = i + 1
        const r = log.results?.find((x) => x.exerciseId === row.exId)
        if (!r || i >= r.sets.length) return 'no'
        return r.flagged?.includes(i) ? 'flag' : 'ok'
      })
  })
  const tapRow = (gi: number) =>
    setStatus((p) =>
      p[gi] === 'no'
        ? p.map((s, i) => (i === gi ? 'ok' : i < gi && s === 'no' ? 'ok' : s))
        : p.map((s, i) => (i >= gi ? 'no' : s)),
    )
  const flagRow = (gi: number) => setStatus((p) => p.map((s, i) => (i === gi ? (s === 'flag' ? 'ok' : 'flag') : s)))

  // Mesures (vélo / champs perso) : valeurs du log, éditables en place
  const [mvals, setMvals] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries((log.metrics ?? []).map((m) => [m.key, m.value])),
  )
  const [note, setNote] = useState(log.note ?? '')

  const save = async () => {
    const patch: Partial<Log> = { note: note.trim() }
    if (log.metrics?.length) {
      patch.metrics = log.metrics.map((m) => ({ ...m, value: mvals[m.key] ?? m.value }))
    }
    if (hasTimeline && flatRows.length) {
      const seen = new Set<string>()
      patch.results = flatRows
        .filter((row) => !seen.has(row.exId) && (seen.add(row.exId), true))
        .map((row) => {
          const { sets, flags } = collectSets(flatRows, status, row.exId)
          const prev = log.results?.find((x) => x.exerciseId === row.exId)
          return {
            exerciseId: row.exId,
            name: row.name,
            measure: prev?.measure ?? (row.unit === 's' ? ('sec' as const) : ('reps' as const)),
            sets,
            ...(flags.length ? { flagged: flags } : {}),
          }
        })
        .filter((r) => r.sets.length > 0)
    }
    await updateLog(log.id, patch)
    onClose()
  }

  const del = () => {
    if (!window.confirm(`Supprimer « ${log.sessionName} » ? La séance redeviendra à faire.`)) return
    void removeLog(log.id)
    onClose()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-ink-soft">
        Faite le {shortFr(log.date)} · enregistrée à{' '}
        {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </p>

      {hasTimeline && timeline.length > 0 && (
        <>
          <p className="text-xs font-semibold text-ink-soft">
            Corrigez si besoin : tap = « je me suis arrêté ici », icône à droite = mal réalisée.
          </p>
          <ResultTimeline groups={timeline} status={status} category={log.category} onTap={tapRow} onFlag={flagRow} />
        </>
      )}

      {(log.metrics?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {(log.metrics ?? []).map((m) => (
            <Field key={m.key} label={m.label}>
              <NumInput
                value={mvals[m.key]}
                onChange={(v) => setMvals((p) => ({ ...p, [m.key]: v }))}
                suffix={m.unit || undefined}
              />
            </Field>
          ))}
        </div>
      )}

      <Field label="Note">
        <TextArea value={note} onChange={setNote} rows={2} placeholder="Ressenti, remarques…" />
      </Field>

      <PrimaryButton onClick={() => void save()}>Enregistrer</PrimaryButton>

      <button
        type="button"
        onClick={del}
        className="flex w-full items-center justify-center gap-1.5 py-1 text-sm font-bold text-hiit/70 active:text-hiit"
      >
        <Trash2 className="h-4 w-4" /> Supprimer cette séance
      </button>
    </div>
  )
}
