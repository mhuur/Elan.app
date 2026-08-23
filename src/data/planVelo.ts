import type { Log } from '../types'
import { startOfWeek, toDateStr } from '../lib/dates'

/**
 * Plan vélo d'appartement — endurance de base, 12 semaines (24/08 → 15/11/2026).
 *
 * Calibré sur les vraies séances de l'utilisateur (45 min · résistance 10 · ~25,5 km/h)
 * et sur son ORGANISATION réelle : le vélo est en alternance avec le HIIT sur
 * lun/jeu/sam (cycle `repeat.onDays` de la séance « Vélo d'appartement »), ce qui donne
 * une semaine à 2 séances (lun + sam) puis une semaine à 1 séance (jeu), en boucle.
 * Les dates ci-dessous sont donc les jours VÉLO exacts de cette alternance — le plan
 * ne crée aucune séance nouvelle dans Aujourd'hui/Planning/rappels, il se superpose
 * aux séances déjà planifiées (CompleteSheet surcharge ses cibles depuis ici).
 * ⚠ Si le cycle lun/jeu/sam est modifié dans l'app, ces dates ne suivront pas :
 * recalculer et régénérer les semaines.
 *
 * Progression : la DURÉE d'abord (45 → 60 min), la résistance ensuite (10 → 11),
 * jamais les deux en même temps. FC guide en endurance ≈ 130–145 bpm (fcMax 186,
 * la FC vélo tourne ~5–10 bpm sous la FC course à effort égal). Les semaines du
 * 21/09 au 11/10 restent légères exprès : affûtage, semi de Rennes (04/10), récup.
 */

export interface VeloSeance {
  /** Date réelle YYYY-MM-DD (jour vélo de l'alternance lun/jeu/sam) */
  date: string
  title: string
  durationMin: number
  /** Niveau de résistance du vélo (le « power » des mesures de la séance) */
  resistance: number
  /** FC guide, ex. « 130–145 » */
  hr: string
  note?: string
}

export type VeloPhase = 'Adaptation' | 'Base 1' | 'Semaine du semi' | 'Récupération' | 'Base 2'

export interface VeloWeek {
  /** Lundi de la semaine, YYYY-MM-DD */
  start: string
  phase: VeloPhase
  label?: string
  seances: VeloSeance[]
}

const s = (date: string, durationMin: number, resistance: number, hr = '130–145', note?: string): VeloSeance => ({
  date,
  title: `Endurance ${durationMin} min`,
  durationMin,
  resistance,
  hr,
  note,
})

export const PLAN_VELO = {
  title: 'Vélo — endurance de base',
  weeks: [
    { start: '2026-08-24', phase: 'Adaptation', seances: [s('2026-08-24', 45, 10), s('2026-08-29', 50, 10)] },
    { start: '2026-08-31', phase: 'Adaptation', seances: [s('2026-09-03', 45, 10)] },
    { start: '2026-09-07', phase: 'Base 1', seances: [s('2026-09-07', 50, 10), s('2026-09-12', 55, 10)] },
    { start: '2026-09-14', phase: 'Base 1', seances: [s('2026-09-17', 50, 10)] },
    {
      start: '2026-09-21',
      phase: 'Base 1',
      label: 'allégée — affûtage semi',
      seances: [s('2026-09-21', 45, 10), s('2026-09-26', 40, 9, '≤ 140', 'rester très facile, le semi approche')],
    },
    {
      start: '2026-09-28',
      phase: 'Semaine du semi',
      label: 'semi de Rennes dim. 04/10',
      seances: [s('2026-10-01', 30, 8, '≤ 135', 'juste délier les jambes')],
    },
    {
      start: '2026-10-05',
      phase: 'Récupération',
      label: 'post-semi',
      seances: [s('2026-10-05', 35, 8, '≤ 135', 'récupération active'), s('2026-10-10', 40, 9, '≤ 140')],
    },
    { start: '2026-10-12', phase: 'Base 2', seances: [s('2026-10-15', 50, 10)] },
    { start: '2026-10-19', phase: 'Base 2', seances: [s('2026-10-19', 55, 10), s('2026-10-24', 60, 10)] },
    { start: '2026-10-26', phase: 'Base 2', seances: [s('2026-10-29', 55, 11)] },
    { start: '2026-11-02', phase: 'Base 2', seances: [s('2026-11-02', 60, 11), s('2026-11-07', 60, 11)] },
    {
      start: '2026-11-09',
      phase: 'Base 2',
      label: 'bilan du cycle',
      seances: [s('2026-11-12', 60, 11, '130–145', 'même effort qu’en semaine 1 : comparer distance et FC')],
    },
  ] as VeloWeek[],
}

/** planRef d'une séance du plan vélo — préfixe distinct du plan semi (`elan-{date}`) */
export const veloRefOf = (date: string): string => 'elan-velo-' + date

/** Semaine du plan vélo alignée sur la semaine de `date` (même lundi), sinon undefined */
export function veloWeekFor(date: Date): { week: VeloWeek; weekIdx: number } | undefined {
  const monday = toDateStr(startOfWeek(date))
  const weekIdx = PLAN_VELO.weeks.findIndex((w) => w.start === monday)
  return weekIdx >= 0 ? { week: PLAN_VELO.weeks[weekIdx], weekIdx } : undefined
}

/** Indice de la semaine courante, borné aux limites du plan */
export function currentVeloWeekIndex(today: string): number {
  const idx = PLAN_VELO.weeks.findIndex((w) => today >= w.start && today <= toDateStr(new Date(new Date(w.start + 'T12:00:00').getTime() + 6 * 86400000)))
  if (idx >= 0) return idx
  return today < PLAN_VELO.weeks[0].start ? 0 : PLAN_VELO.weeks.length - 1
}

/** Séance du plan vélo prévue ce jour-là (pour surcharger les cibles de CompleteSheet) */
export function veloSeanceOn(dateStr: string): VeloSeance | undefined {
  for (const w of PLAN_VELO.weeks) for (const se of w.seances) if (se.date === dateStr) return se
  return undefined
}

export interface VeloSeanceState {
  seance: VeloSeance
  planRef: string
  /** Validée explicitement (planRef) ou couverte par une séance vélo libre le jour prévu */
  done: boolean
  doneDate?: string
}

/**
 * État des séances vélo d'une semaine — même règle que le plan semi : « done » =
 * un log porte ce `planRef`, OU une séance vélo LIBRE (sans planRef) a été
 * journalisée le jour prévu (le flux normal : valider « Vélo d'appartement »
 * depuis Aujourd'hui suffit à pointer la séance du plan).
 */
export function veloWeekStates(week: VeloWeek, logs: Log[]): VeloSeanceState[] {
  return week.seances.map((se) => {
    const planRef = veloRefOf(se.date)
    const planLog = logs.find((l) => l.planRef === planRef)
    const freeRide = !planLog && logs.find((l) => l.category === 'velo' && l.date === se.date && !l.planRef)
    return {
      seance: se,
      planRef,
      done: !!planLog || !!freeRide,
      doneDate: planLog?.date ?? (freeRide ? se.date : undefined),
    }
  })
}
