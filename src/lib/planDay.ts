import type { Log } from '../types'
import { PLAN_SEMI, seanceDateStr, type PlanSeance, type PlanWeek } from '../data/plan'
import { mondayIndex, startOfWeek, toDateStr } from './dates'

/** planRef canonique d'une séance du plan (= sa vraie date, ex. « elan-2026-06-21 ») */
export const planRefOf = (dateStr: string): string => 'elan-' + dateStr

/**
 * Un log est une « validation de séance du plan » s'il porte un `planRef`. C'est LE
 * discriminant (pas le `sessionId: ''` posé par convention à la création dans WorkoutSheet,
 * qui n'est qu'un effet de bord à ne pas tester directement — audit P2).
 */
export const isPlanLog = (l: Log): boolean => !!l.planRef

/** Semaine du plan alignée sur la semaine de `date` (même lundi), sinon undefined. */
export function planWeekFor(date: Date): { week: PlanWeek; weekIdx: number } | undefined {
  const monday = toDateStr(startOfWeek(date))
  const weekIdx = PLAN_SEMI.weeks.findIndex((w) => w.start === monday)
  return weekIdx >= 0 ? { week: PLAN_SEMI.weeks[weekIdx], weekIdx } : undefined
}

/** État d'une séance du plan vis-à-vis des logs */
export interface PlanSeanceState {
  seance: PlanSeance
  /** Date prévue YYYY-MM-DD */
  date: string
  /** Clé de validation (= planRefOf(date)) */
  planRef: string
  /** Validée (intention explicite) ou couverte par une course libre le jour prévu */
  done: boolean
  /** Jour réellement effectué si connu (peut différer du jour prévu) */
  doneDate?: string
}

/**
 * État de toutes les séances du plan d'une semaine, vis-à-vis des logs.
 *
 * « done » = validation explicite (un log porte ce `planRef`) OU une course LIBRE
 * (running sans `planRef`) le jour prévu. On EXCLUT volontairement la validation
 * d'une AUTRE séance déplacée sur ce jour : sinon une séance non faite passerait
 * « faite » à cause d'une voisine validée le même jour (cf. audit P1). C'est l'unique
 * source de vérité, partagée par Aujourd'hui et Planning.
 */
export function planWeekStates(week: PlanWeek, logs: Log[]): PlanSeanceState[] {
  return week.seances.map((s) => {
    const date = seanceDateStr(week, s)
    const planRef = planRefOf(date)
    const planLog = logs.find((l) => l.planRef === planRef)
    const freeRun = !planLog && logs.find((l) => l.category === 'running' && l.date === date && !l.planRef)
    return {
      seance: s,
      date,
      planRef,
      done: !!planLog || !!freeRun,
      doneDate: planLog?.date ?? (freeRun ? date : undefined),
    }
  })
}

/** Séances du plan dues à `date` et PAS encore faites (to-do d'Aujourd'hui). */
export function planToDoOn(date: Date, logs: Log[]): PlanSeanceState[] {
  const pw = planWeekFor(date)
  if (!pw) return []
  const dayIdx = mondayIndex(date)
  return planWeekStates(pw.week, logs).filter((st) => st.seance.day === dayIdx && !st.done)
}
