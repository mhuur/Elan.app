import { addDays, toDateStr } from '../lib/dates'

/** Types d'effort d'une séance du plan */
export type PlanType = 'ef' | 'vma' | 'seuil' | 'as' | 'sl' | 'course'

export interface PlanSeance {
  /** 0 = lundi … 6 = dimanche */
  day: number
  type: PlanType
  title: string
  detail?: string
}

export type PlanPhase = 'Base' | 'Développement' | 'Spécifique' | 'Affûtage'

export interface PlanWeek {
  /** Lundi de la semaine, YYYY-MM-DD */
  start: string
  phase: PlanPhase
  /** « allégée », « pic de volume », « semaine de course »… */
  label?: string
  /** Volume estimé de la semaine, en km */
  km: number
  seances: PlanSeance[]
}

export interface PlanAllure {
  label: string
  value: string
}

/** Allures repères calibrées sur l'objectif (à affiner avec les données COROS) */
export const PLAN_ALLURES: PlanAllure[] = [
  { label: 'Endurance fondamentale', value: '6:10 – 6:40 /km' },
  { label: 'Sortie longue', value: '6:00 – 6:30 /km' },
  { label: 'Allure semi', value: '5:13 /km' },
  { label: 'Seuil · 10 km', value: '4:55 – 5:05 /km' },
  { label: 'VMA (400 – 800 m)', value: '4:25 – 4:40 /km' },
]

const ef = (min: number, lignes?: number): PlanSeance => ({
  day: 0,
  type: 'ef',
  title: `Footing ${min} min`,
  detail: lignes ? `6:10 – 6:40/km · finir par ${lignes} lignes droites` : '6:10 – 6:40/km, aisance respiratoire',
})

const sl = (dur: string, detail?: string): PlanSeance => ({
  day: 6,
  type: 'sl',
  title: `Sortie longue ${dur}`,
  detail: detail ?? '6:00 – 6:30/km, négliger l’allure, tenir la durée',
})

const q = (type: PlanType, title: string, detail: string): PlanSeance => ({ day: 4, type, title, detail })

const at = (s: PlanSeance, day: number): PlanSeance => ({ ...s, day })

export const PLAN_SEMI = {
  name: 'Plan semi — sub 1h50',
  race: 'Tout Rennes Court',
  raceDate: '2026-10-11',
  goal: '1h50 · 5:13/km',
  weeks: [
    {
      start: '2026-06-22',
      phase: 'Base',
      km: 31,
      seances: [
        ef(40),
        at(ef(45, 6), 2),
        q('vma', '2 × (8 × 30/30)', '30 s vite / 30 s trot, récup 3 min entre blocs · éch. 20 min'),
        sl('1h05'),
      ],
    },
    {
      start: '2026-06-29',
      phase: 'Base',
      km: 32,
      seances: [
        ef(40),
        at(ef(45, 8), 2),
        q('vma', '10 côtes de 30 s', 'effort franc en montée, récup en redescendant · éch. 20 min'),
        sl('1h10'),
      ],
    },
    {
      start: '2026-07-06',
      phase: 'Base',
      km: 35,
      seances: [
        ef(45),
        at(ef(45, 8), 2),
        q('vma', '8 × 400 m', 'à 4:30/km (≈ 1 min 48 le 400 m), récup 1’15 trot · éch. 20 min'),
        sl('1h15'),
      ],
    },
    {
      start: '2026-07-13',
      phase: 'Base',
      label: 'allégée',
      km: 29,
      seances: [
        ef(35),
        at(ef(40, 6), 2),
        q('vma', '6 × 400 m', 'à allure 10 km (4:55/km), récup 1’15 · éch. 20 min'),
        sl('1h00'),
      ],
    },
    {
      start: '2026-07-20',
      phase: 'Développement',
      km: 37,
      seances: [
        ef(45),
        at(ef(50, 8), 2),
        q('vma', '2 × (5 × 400 m)', 'à 4:30/km, récup 1’15 / 3 min entre blocs · éch. 20 min'),
        sl('1h20'),
      ],
    },
    {
      start: '2026-07-27',
      phase: 'Développement',
      km: 38,
      seances: [
        ef(45),
        at(ef(50), 2),
        q('seuil', '3 × 8 min seuil', 'à 5:00/km, récup 2 min trot · éch. 20 min'),
        sl('1h25'),
      ],
    },
    {
      start: '2026-08-03',
      phase: 'Développement',
      km: 40,
      seances: [
        ef(45),
        at(ef(50, 8), 2),
        q('vma', '6 × 800 m', 'à 4:35/km (≈ 3 min 40 le 800 m), récup 1’45 · éch. 20 min'),
        sl('1h30'),
      ],
    },
    {
      start: '2026-08-10',
      phase: 'Développement',
      label: 'allégée',
      km: 30,
      seances: [
        ef(35),
        at(ef(45), 2),
        q('vma', '6 × 300 m', 'vite mais relâché, récup 1’30 · éch. 20 min'),
        sl('1h05'),
      ],
    },
    {
      start: '2026-08-17',
      phase: 'Spécifique',
      km: 40,
      seances: [
        ef(45),
        at(ef(50, 8), 2),
        q('as', '2 × 3 km allure semi', 'à 5:13/km, récup 3 min trot · éch. 20 min'),
        sl('1h30', 'dont 2 × 10 min à 5:30/km en seconde moitié'),
      ],
    },
    {
      start: '2026-08-24',
      phase: 'Spécifique',
      km: 42,
      seances: [
        ef(45),
        at(ef(55), 2),
        q('seuil', '4 × 6 min seuil', 'à 4:55 – 5:00/km, récup 1’30 · éch. 20 min'),
        sl('1h35'),
      ],
    },
    {
      start: '2026-08-31',
      phase: 'Spécifique',
      km: 44,
      seances: [
        ef(50),
        at(ef(55, 8), 2),
        q('as', '3 × 2 km allure semi', 'à 5:10/km, récup 2 min trot · éch. 20 min'),
        sl('1h40', 'dont 20 min à 5:30/km en seconde moitié'),
      ],
    },
    {
      start: '2026-09-07',
      phase: 'Spécifique',
      label: 'allégée',
      km: 33,
      seances: [
        ef(40),
        at(ef(45), 2),
        q('vma', '8 × 400 m', 'à allure 10 km (4:55/km), récup 1’15 · éch. 20 min'),
        sl('1h10', 'option : course de prépa 10 km ce week-end'),
      ],
    },
    {
      start: '2026-09-14',
      phase: 'Spécifique',
      label: 'pic de volume',
      km: 45,
      seances: [
        ef(50),
        at(ef(55, 8), 2),
        q('as', '6 km continu allure semi', 'à 5:13/km, sans interruption · éch. 15 min, calme 10 min'),
        sl('1h45', 'dont 30 min à 5:30/km en seconde moitié'),
      ],
    },
    {
      start: '2026-09-21',
      phase: 'Spécifique',
      km: 40,
      seances: [
        ef(45),
        at(ef(50), 2),
        q('vma', '5 × 1000 m', 'à allure 10 km (4:55/km), récup 1’30 · éch. 20 min'),
        sl('1h30', 'dont 2 × 10 min à allure semi (5:13/km)'),
      ],
    },
    {
      start: '2026-09-28',
      phase: 'Affûtage',
      km: 30,
      seances: [
        ef(40),
        at(ef(40, 6), 2),
        q('as', '3 × 1 km allure semi', 'à 5:10/km, récup 2 min · éch. 20 min'),
        sl('1h00', 'toute en aisance, on lève le pied'),
      ],
    },
    {
      start: '2026-10-05',
      phase: 'Affûtage',
      label: 'semaine de course',
      km: 13,
      seances: [
        ef(35),
        {
          day: 2,
          type: 'ef',
          title: 'Footing 30 min',
          detail: 'avec 4 × 1 min à allure semi pour garder le rythme',
        },
        {
          day: 4,
          type: 'ef',
          title: 'Déblocage 20 min',
          detail: 'footing très léger + 3 lignes droites, puis repos samedi',
        },
        {
          day: 6,
          type: 'course',
          title: 'Semi-marathon — 21,1 km',
          detail: 'Tout Rennes Court · objectif 1h50, partir à 5:15/km',
        },
      ],
    },
  ] satisfies PlanWeek[],
}

/** Date YYYY-MM-DD d'une séance du plan */
export function seanceDateStr(week: PlanWeek, s: PlanSeance): string {
  return toDateStr(addDays(new Date(week.start + 'T12:00:00'), s.day))
}

/**
 * Index de la semaine en cours dans le plan.
 * -1 avant le début, `weeks.length` une fois la course passée.
 */
export function currentWeekIndex(today: string): number {
  const weeks = PLAN_SEMI.weeks
  if (today < weeks[0].start) return -1
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (today >= weeks[i].start) return today > toDateStr(addDays(new Date(weeks[i].start + 'T12:00:00'), 6)) ? weeks.length : i
  }
  return -1
}

/** Jours restants avant la course (0 le jour J, négatif après) */
export function daysToRace(today: string): number {
  const ms = new Date(PLAN_SEMI.raceDate + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()
  return Math.round(ms / 86_400_000)
}
