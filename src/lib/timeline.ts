import { setTargetsOf, type Exercise, type Log, type Session } from '../types'
import { muscuBlocks } from './blocks'

/** État d'une série dans une timeline de saisie : faite / mal réalisée (compte quand même) / non faite */
export type SetStatus = 'ok' | 'flag' | 'no'

/** Une série de la timeline, dans l'ordre réel d'exécution */
export interface SetRow {
  exId: string
  name: string
  setLabel: string
  value: number
  unit: string
  /** Ligne secondaire optionnelle (ex. comparatif « dernière fois : 6 reps ») */
  sub?: string
}

export interface SetGroup {
  header: string
  rows: SetRow[]
}

/** Timeline des séries d'une séance muscu/HIIT, groupée par bloc/tour (vide pour les autres catégories) */
export function buildTimeline(session: Session, exercises: Exercise[]): SetGroup[] {
  const exOf = (id: string) => exercises.find((e) => e.id === id)
  const groups: SetGroup[] = []
  if (session.category === 'muscu') {
    const blocks = muscuBlocks(session)
    blocks.forEach((b, bi) => {
      for (let r = 0; r < b.rounds; r++) {
        const header = [blocks.length > 1 ? `Bloc ${bi + 1}` : '', b.rounds > 1 ? `Tour ${r + 1}/${b.rounds}` : '']
          .filter(Boolean)
          .join(' · ')
        const rows: SetRow[] = []
        b.items.forEach((it) => {
          const ex = exOf(it.exerciseId)
          setTargetsOf(it).forEach((v, s) =>
            rows.push({
              exId: it.exerciseId,
              name: ex?.name ?? 'Exercice',
              setLabel: `Série ${s + 1}`,
              value: v,
              unit: ex?.measure === 'sec' ? 's' : 'reps',
            }),
          )
        })
        groups.push({ header, rows })
      }
    })
  } else if (session.category === 'hiit') {
    const rounds = session.rounds ?? 1
    for (let r = 0; r < rounds; r++) {
      groups.push({
        header: rounds > 1 ? `Tour ${r + 1}/${rounds}` : '',
        rows: session.items.map((it) => ({
          exId: it.exerciseId,
          name: exOf(it.exerciseId)?.name ?? 'Exercice',
          setLabel: '',
          value: it.durationSec ?? session.workSec ?? 45,
          unit: 's',
        })),
      })
    }
  }
  return groups
}

/** Timeline de secours reconstruite depuis un log (séance supprimée entre-temps) */
export function timelineFromLog(log: Log): SetGroup[] {
  const rows: SetRow[] = (log.results ?? []).flatMap((r) =>
    r.sets.map((v, s) => ({
      exId: r.exerciseId,
      name: r.name,
      setLabel: r.sets.length > 1 ? `Série ${s + 1}` : '',
      value: v,
      unit: r.measure === 'sec' ? 's' : 'reps',
    })),
  )
  return rows.length ? [{ header: '', rows }] : []
}

/** Point d'arrêt d'une séance journalisée : la dernière série réellement faite, située dans le circuit */
export interface StopPoint {
  /** En-tête du groupe : « Bloc 2 · Tour 1/2 » (vide si un seul bloc et un seul tour) */
  where: string
  /** Nom de l'exercice de la dernière série faite */
  name: string
  /** « Série 2 » en muscu, vide en HIIT */
  setLabel: string
  /** Séries faites / prévues */
  done: number
  total: number
  /** Toutes les séries prévues ont été faites */
  complete: boolean
}

/**
 * Où s'est arrêtée une séance journalisée. Le log ne garde que le compte de séries PAR EXERCICE :
 * on rejoue donc la timeline prévue en consommant ces séries dans l'ordre réel d'exécution, et on
 * retient la DERNIÈRE consommée. Prendre la dernière (plutôt que le premier manque) reste juste
 * quand une série a été sautée en cours de route — le Player n'enregistre pas les séries passées.
 * Renvoie null si la séance n'a pas de timeline (autre catégorie) ou si aucune série ne correspond
 * (séance modifiée depuis le log) : l'appelant retombe alors sur le détail par exercice.
 */
export function stopPoint(log: Log, session: Session, exercises: Exercise[]): StopPoint | null {
  const groups = buildTimeline(session, exercises)
  const total = groups.reduce((a, g) => a + g.rows.length, 0)
  if (!total) return null
  const left = new Map<string, number>()
  for (const r of log.results ?? []) left.set(r.exerciseId, (left.get(r.exerciseId) ?? 0) + r.sets.length)
  let done = 0
  let last: { group: SetGroup; row: SetRow } | null = null
  for (const group of groups) {
    for (const row of group.rows) {
      const n = left.get(row.exId) ?? 0
      if (n <= 0) continue
      left.set(row.exId, n - 1)
      done++
      last = { group, row }
    }
  }
  if (!last) return null
  return {
    where: last.group.header,
    name: last.row.name,
    setLabel: last.row.setLabel,
    done,
    total,
    complete: done >= total,
  }
}

/** Séries retenues (et indices ⚠ dans `sets`) pour un exercice, depuis la timeline à plat */
export function collectSets(
  flatRows: SetRow[],
  status: SetStatus[],
  exId: string,
): { sets: number[]; flags: number[] } {
  const sets: number[] = []
  const flags: number[] = []
  flatRows.forEach((row, gi) => {
    if (row.exId !== exId || status[gi] === 'no') return
    if (status[gi] === 'flag') flags.push(sets.length)
    sets.push(row.value)
  })
  return { sets, flags }
}
