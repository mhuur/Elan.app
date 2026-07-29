import { useMemo } from 'react'
import type { Log } from '../types'
import { addDays, mondayIndex, startOfWeek, toDateStr } from './dates'
import { planWeekFor, planWeekStates, type PlanSeanceState } from './planDay'
import { PLAN_SEMI, type PlanWeek } from '../data/plan'

export interface PlanningWeek {
  /** Lundi de la semaine affichée (minuit) */
  monday: Date
  /** Les 7 dates YYYY-MM-DD de la semaine affichée (lun → dim) */
  weekDates: string[]
  /** Colonne « aujourd'hui » (0=lun…6=dim), -1 si la semaine affichée n'est pas la courante */
  todayIdx: number
  /** Semaine du plan alignée par date sur la semaine affichée (undefined hors plan) */
  planWeek: PlanWeek | undefined
  /** Index 0-based de cette semaine du plan, -1 hors plan */
  planWeekIdx: number
  /** État (validée / faite un autre jour) de chaque séance du plan de la semaine */
  planStates: PlanSeanceState[]
  /** Lundi de la 1re semaine du plan */
  firstStart: string
  /** Décalage en semaines de la 1re semaine du plan par rapport à la semaine courante */
  planStartOffset: number
  /** Avant le départ du plan : afficher l'indice « le plan démarre … » */
  showStartHint: boolean
}

/**
 * Dérivation pure « semaine affichée » du Planning à partir de `weekOffset` :
 * dates de la semaine, alignement de la semaine du plan (par date → pas d'illusion de
 * retard), états des séances du plan, indice de démarrage. Extrait du conteneur Planning
 * (audit P2) — testable et réutilisable indépendamment du rendu.
 */
export function usePlanningWeek(weekOffset: number, logs: Log[]): PlanningWeek {
  const monday = addDays(startOfWeek(new Date()), weekOffset * 7)
  const todayIdx = weekOffset === 0 ? mondayIndex() : -1
  const weekDates = Array.from({ length: 7 }, (_, d) => toDateStr(addDays(monday, d)))

  const planInfo = planWeekFor(monday)
  const planWeek = planInfo?.week
  const planWeekIdx = planInfo?.weekIdx ?? -1
  const planStates = useMemo(() => (planWeek ? planWeekStates(planWeek, logs) : []), [planWeek, logs])

  const firstStart = PLAN_SEMI.weeks[0].start
  const planStartOffset = Math.round(
    (new Date(firstStart + 'T12:00:00').getTime() - startOfWeek(new Date()).getTime()) / (7 * 86_400_000),
  )
  const showStartHint = !planWeek && weekDates[0] < firstStart

  return { monday, weekDates, todayIdx, planWeek, planWeekIdx, planStates, firstStart, planStartOffset, showStartHint }
}
