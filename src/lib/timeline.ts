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
