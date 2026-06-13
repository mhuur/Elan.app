import { addDays, toDateStr } from '../lib/dates'

/** Types d'effort d'une séance du plan */
export type PlanType = 'ef' | 'vma' | 'seuil' | 'as' | 'sl' | 'course'

// ----- Modèle de séance structurée (façon COROS Campus : échauffement, blocs répétés, récup) -----

export type StepKind = 'warmup' | 'work' | 'recovery' | 'cooldown' | 'steady'

/** Allure cible en /km : fixe (`from` seul) ou fourchette (`from`–`to`) */
export interface Pace {
  from: string
  to?: string
}

export interface WorkoutStep {
  kind: StepKind
  /** EF, VMA, Tempo, Seuil, Allure semi, Récup… */
  label: string
  /** Cible : durée (s) OU distance (m) — l'un des deux */
  durationSec?: number
  distanceM?: number
  pace?: Pace
  /** Fréquence cardiaque cible, ex. « 138–153 » */
  hr?: string
  note?: string
}

/** Bloc répété N fois (intervalles) */
export interface RepeatBlock {
  repeat: number
  steps: WorkoutStep[]
}

export type WorkoutPart = WorkoutStep | RepeatBlock

export function isRepeat(p: WorkoutPart): p is RepeatBlock {
  return (p as RepeatBlock).repeat !== undefined
}

export interface Workout {
  /** Terrain conseillé (tag affiché) */
  surface?: 'route' | 'piste'
  parts: WorkoutPart[]
}

export interface PlanSeance {
  /** 0 = lundi … 6 = dimanche */
  day: number
  type: PlanType
  title: string
  /** Résumé court affiché sur la ligne repliée */
  detail?: string
  /** Séance détaillée structurée (consultable + exportable) */
  workout: Workout
}

export type PlanPhase = 'Fondation' | 'Développement' | 'Spécifique' | 'Affûtage'

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

/**
 * Repères physio déterminés sur les données COROS (tout l'historique pour la FC max, forme
 * récente pour le reste). FC max = réglage COROS, à confirmer par un test à bloc.
 * Mis à jour à chaque re-analyse COROS (l'app ne lit pas COROS en direct — CORS).
 */
export const PLAN_METRICS = {
  vo2max: 49,
  fcMax: 186,
  fcRest: 52,
}

/** Zones d'entraînement (méthode Réserve FC / Karvonen, comme la montre) : allure + FC */
export interface PlanZone {
  label: string
  pace: string
  hr: string
  hex: string
}
// Zones contiguës (méthode Réserve FC) : les bornes se touchent, toute allure a sa zone.
export const PLAN_ZONES: PlanZone[] = [
  { label: 'Endurance fondamentale', pace: '5:45–6:05', hr: '140–152', hex: '#5f8862' },
  { label: 'Endurance active', pace: '5:25–5:45', hr: '152–162', hex: '#5b89ad' },
  { label: 'Seuil', pace: '5:13–5:25', hr: '162–170', hex: '#c2773e' },
  { label: 'Allure semi (cible)', pace: '5:08–5:13', hr: '170–173', hex: '#d4541c' },
  { label: 'VMA', pace: '4:35–5:08', hr: '173–186', hex: '#cf6151' },
]

// ----- Allures & FC de référence -----
const EF: Pace = { from: '5:45', to: '6:05' }
const EA: Pace = { from: '5:30', to: '5:40' }
const HR = { ef: '140–150', ea: '152–162', seuil: '165–170', as: '163–170', vma: '175–186' }
const p = (s: string): Pace => ({ from: s })

// ----- Briques de construction des séances -----
const wu = (min = 20): WorkoutStep => ({ kind: 'warmup', label: 'Échauffement', durationSec: min * 60, pace: EF, hr: HR.ef })
const cd = (min = 10): WorkoutStep => ({ kind: 'cooldown', label: 'Retour au calme', durationSec: min * 60, pace: EF })
const rec = (sec: number): WorkoutStep => ({ kind: 'recovery', label: 'Récup', durationSec: sec })
const rep = (n: number, steps: WorkoutStep[]): RepeatBlock => ({ repeat: n, steps })

/** Footing tranquille (distance) */
const footing = (km: number, lignes?: number): Workout => ({
  surface: 'route',
  parts: [{ kind: 'steady', label: 'EF', distanceM: km * 1000, pace: EF, hr: HR.ef, note: lignes ? `finir par ${lignes} lignes droites` : undefined }],
})

/** Sortie longue continue (distance) */
const longRun = (km: number, note?: string): Workout => ({
  surface: 'route',
  parts: [{ kind: 'steady', label: 'Sortie longue', distanceM: km * 1000, pace: EF, hr: HR.ef, note }],
})

/** Sortie longue EF + portion d'endurance active en fin */
const longRunEA = (efKm: number, eaKm: number): Workout => ({
  surface: 'route',
  parts: [
    { kind: 'steady', label: 'EF', distanceM: efKm * 1000, pace: EF, hr: HR.ef },
    { kind: 'work', label: 'Endurance active', distanceM: eaKm * 1000, pace: EA, hr: HR.ea },
  ],
})

/** VMA : reps de distance à allure fixe, récup en temps */
const vma = (reps: number, distM: number, pace: string, recSec: number, wuMin = 20): Workout => ({
  surface: 'piste',
  parts: [wu(wuMin), rep(reps, [{ kind: 'work', label: 'VMA', distanceM: distM, pace: p(pace), hr: HR.vma }, rec(recSec)]), cd(10)],
})

/** Seuil continu (temps) */
const seuilContinu = (min: number, pace: string): Workout => ({
  surface: 'route',
  parts: [wu(), { kind: 'work', label: 'Seuil', durationSec: min * 60, pace: p(pace), hr: HR.seuil }, cd()],
})

/** Seuil / tempo en intervalles (temps) */
const seuilInt = (reps: number, workMin: number, pace: string, recSec: number, label = 'Seuil'): Workout => ({
  surface: 'route',
  parts: [wu(), rep(reps, [{ kind: 'work', label, durationSec: workMin * 60, pace: p(pace), hr: HR.seuil }, rec(recSec)]), cd()],
})

/** Allure spécifique semi en intervalles (distance) */
const asInt = (reps: number, distM: number, pace: string, recSec: number): Workout => ({
  surface: 'route',
  parts: [wu(), rep(reps, [{ kind: 'work', label: 'Allure semi', distanceM: distM, pace: p(pace), hr: HR.as }, rec(recSec)]), cd()],
})

const mk = (day: number, type: PlanType, title: string, detail: string, workout: Workout): PlanSeance => ({ day, type, title, detail, workout })

/** Libellé long d'un type d'effort */
export const TYPE_LABEL: Record<PlanType, string> = {
  ef: 'Endurance fondamentale',
  vma: 'VMA',
  seuil: 'Seuil',
  as: 'Allure spécifique',
  sl: 'Sortie longue',
  course: 'Course',
}

/** Difficulté ressentie 1–5 (éclairs affichés sur la carte) */
export const TYPE_DIFFICULTY: Record<PlanType, number> = { ef: 1, sl: 2, seuil: 3, as: 4, vma: 4, course: 5 }

/** Identité visuelle courte d'un type d'effort (libellé + couleur) pour différencier les séances dans le planning */
export interface PlanTypeMeta {
  short: string
  hex: string
}
export const TYPE_META: Record<PlanType, PlanTypeMeta> = {
  ef: { short: 'Footing', hex: '#5f8862' }, // endurance — vert sauge
  sl: { short: 'Sortie longue', hex: '#5b89ad' }, // long & régulier — bleu
  seuil: { short: 'Seuil', hex: '#c2773e' }, // tempo — ambre
  as: { short: 'Allure semi', hex: '#d4541c' }, // spécifique — orange
  vma: { short: 'Fractionné', hex: '#cf6151' }, // intervalles — corail
  course: { short: 'Course', hex: '#8d6ba0' }, // jour J — violet
}

/** Allure « m:ss » → secondes par km */
export function paceToSec(mmss: string): number {
  const [m, s] = mmss.split(':').map(Number)
  return m * 60 + s
}

/** Durée estimée d'une étape, en secondes (distance convertie via l'allure) */
export function stepSeconds(s: WorkoutStep): number {
  if (s.durationSec) return s.durationSec
  if (s.distanceM) return (s.distanceM / 1000) * (s.pace ? paceToSec(s.pace.from) : 330)
  return 60
}

/** Durée (s) et distance (m) totales estimées d'une séance, répétitions développées */
export function workoutStats(w: Workout): { sec: number; distM: number } {
  let sec = 0
  let distM = 0
  const visit = (s: WorkoutStep, times: number) => {
    const t = stepSeconds(s)
    sec += t * times
    if (s.distanceM) distM += s.distanceM * times
    else if (s.pace) distM += (t / paceToSec(s.pace.from)) * 1000 * times
  }
  for (const part of w.parts) {
    if (isRepeat(part)) part.steps.forEach((s) => visit(s, part.repeat))
    else visit(part, 1)
  }
  return { sec, distM }
}

// Jours : Mardi = 1, Mercredi = 2, Vendredi = 4, Dimanche = 6
export const PLAN_SEMI = {
  name: 'Plan semi — sub 1h50',
  race: 'Tout Rennes Court',
  raceDate: '2026-10-04',
  goal: '1h50 · 5:13/km',
  weeks: [
    { start: '2026-06-08', phase: 'Fondation', label: 'reprise', km: 8, seances: [
      mk(6, 'sl', 'Sortie longue 8 km', '8 km en EF · reprise en douceur', longRun(8, 'démarrage du plan, tout en aisance')),
    ] },
    { start: '2026-06-15', phase: 'Fondation', km: 26, seances: [
      mk(1, 'ef', 'Footing 6 km', '6 km en EF · 5 lignes droites', footing(6, 5)),
      mk(2, 'ef', 'Footing 5 km', '5 km en EF', footing(5)),
      mk(4, 'ef', 'Footing 6 km', '6 km en EF · 5 lignes droites', footing(6, 5)),
      mk(6, 'sl', 'Sortie longue 9 km', '9 km en EF', longRun(9)),
    ] },
    { start: '2026-06-22', phase: 'Fondation', km: 29, seances: [
      mk(1, 'vma', 'Fartlek 8×1 min', '20 min EF + 8×(1 min vif / 1 min EF) + 5 min calme', {
        surface: 'route',
        parts: [
          { kind: 'steady', label: 'EF', durationSec: 20 * 60, pace: EF, hr: HR.ef },
          rep(8, [{ kind: 'work', label: 'Vif', durationSec: 60, pace: p('4:55'), hr: HR.vma }, { kind: 'recovery', label: 'EF', durationSec: 60, pace: EF }]),
          { kind: 'cooldown', label: 'Retour au calme', durationSec: 5 * 60, pace: EF },
        ],
      }),
      mk(2, 'ef', 'Footing 6 km', '6 km en EF', footing(6)),
      mk(4, 'ef', 'Footing 6 km', '6 km en EF · 5 lignes droites', footing(6, 5)),
      mk(6, 'sl', 'Sortie longue 10 km', '10 km en EF', longRun(10)),
    ] },
    { start: '2026-06-29', phase: 'Fondation', km: 32, seances: [
      mk(1, 'vma', 'VMA 10×30/30', 'éch. + 10×(30 s vif / 30 s lent) + calme', {
        surface: 'piste',
        parts: [wu(15), rep(10, [{ kind: 'work', label: 'VMA', durationSec: 30, pace: p('4:30'), hr: HR.vma }, { kind: 'recovery', label: 'Lent', durationSec: 30 }]), cd(10)],
      }),
      mk(2, 'ef', 'Footing 7 km', '7 km en EF', footing(7)),
      mk(4, 'ef', 'Footing 6 km', '6 km en EF · 5 lignes droites', footing(6, 5)),
      mk(6, 'sl', 'Sortie longue 12 km', '12 km en EF', longRun(12)),
    ] },
    { start: '2026-07-06', phase: 'Fondation', label: 'allégée', km: 27, seances: [
      mk(1, 'ef', 'Footing 6 km', '6 km en EF · 6 lignes droites', footing(6, 6)),
      mk(2, 'ef', 'Footing 5 km', '5 km en EF', footing(5)),
      mk(4, 'seuil', 'Tempo 2×8 min', '2×8 min à 5:20, récup 2 min', seuilInt(2, 8, '5:20', 120, 'Tempo')),
      mk(6, 'sl', 'Sortie longue 9 km', '9 km en EF', longRun(9)),
    ] },
    { start: '2026-07-13', phase: 'Développement', km: 37, seances: [
      mk(1, 'vma', 'VMA 8×400 m', '8×400 m à 4:40, récup 1:00', vma(8, 400, '4:40', 60)),
      mk(2, 'ef', 'Footing 6 km', '6 km en EF', footing(6)),
      mk(4, 'seuil', 'Seuil 20 min', '20 min continu à 5:18', seuilContinu(20, '5:18')),
      mk(6, 'sl', 'Sortie longue 13 km', '13 km en EF', longRun(13)),
    ] },
    { start: '2026-07-20', phase: 'Développement', km: 39, seances: [
      mk(1, 'vma', 'VMA 10×400 m', '10×400 m à 4:38, récup 1:00', vma(10, 400, '4:38', 60)),
      mk(2, 'ef', 'Footing 7 km', '7 km en EF', footing(7)),
      mk(4, 'seuil', 'Seuil 2×10 min', '2×10 min à 5:15, récup 2 min', seuilInt(2, 10, '5:15', 120)),
      mk(6, 'sl', 'Sortie longue 14 km', '12 km EF + 2 km EA', longRunEA(12, 2)),
    ] },
    { start: '2026-07-27', phase: 'Développement', km: 42, seances: [
      mk(1, 'vma', 'VMA 6×600 m', '6×600 m à 4:40, récup 1:15', vma(6, 600, '4:40', 75)),
      mk(2, 'ef', 'Footing 8 km', '8 km en EF', footing(8)),
      mk(4, 'seuil', 'Seuil 3×8 min', '3×8 min à 5:12, récup 2 min', seuilInt(3, 8, '5:12', 120)),
      mk(6, 'sl', 'Sortie longue 15 km', '15 km en EF', longRun(15)),
    ] },
    { start: '2026-08-03', phase: 'Développement', label: 'allégée', km: 35, seances: [
      mk(1, 'vma', 'VMA 8×300 m', '8×300 m à 4:35, récup 1:00', vma(8, 300, '4:35', 60)),
      mk(2, 'ef', 'Footing 6 km', '6 km en EF', footing(6)),
      mk(4, 'seuil', 'Seuil 20 min', '20 min continu à 5:12', seuilContinu(20, '5:12')),
      mk(6, 'sl', 'Sortie longue 13 km', '13 km en EF', longRun(13)),
    ] },
    { start: '2026-08-10', phase: 'Développement', km: 44, seances: [
      mk(1, 'vma', 'VMA 5×800 m', '5×800 m à 4:45, récup 1:30', vma(5, 800, '4:45', 90)),
      mk(2, 'ef', 'Footing 8 km', '8 km en EF', footing(8)),
      mk(4, 'seuil', 'Seuil 2×12 min', '2×12 min à 5:10, récup 2:30', seuilInt(2, 12, '5:10', 150)),
      mk(6, 'sl', 'Sortie longue 16 km', '13 km EF + 3 km EA', longRunEA(13, 3)),
    ] },
    { start: '2026-08-17', phase: 'Développement', km: 45, seances: [
      mk(1, 'vma', 'VMA 6×800 m', '6×800 m à 4:42, récup 1:30', vma(6, 800, '4:42', 90)),
      mk(2, 'ef', 'Footing 8 km', '8 km en EF', footing(8)),
      mk(4, 'seuil', 'Seuil 25 min', '25 min continu à 5:10', seuilContinu(25, '5:10')),
      mk(6, 'sl', 'Sortie longue 17 km', '17 km en EF', longRun(17)),
    ] },
    { start: '2026-08-24', phase: 'Spécifique', km: 47, seances: [
      mk(1, 'vma', 'VMA 5×1000 m', '5×1000 m à 4:48, récup 1:30', vma(5, 1000, '4:48', 90)),
      mk(2, 'ef', 'Footing 8 km', '8 km en EF', footing(8)),
      mk(4, 'as', 'Allure semi 3×2 km', '3×2 km à 5:10, récup 2 min', asInt(3, 2000, '5:10', 120)),
      mk(6, 'sl', 'Sortie longue 16 km', '16 km dont 2×4 km à allure semi', {
        surface: 'route',
        parts: [
          { kind: 'steady', label: 'EF', distanceM: 4000, pace: EF, hr: HR.ef },
          { kind: 'work', label: 'Allure semi', distanceM: 4000, pace: p('5:10'), hr: HR.as },
          { kind: 'recovery', label: 'EF', distanceM: 2000, pace: EF, hr: HR.ef },
          { kind: 'work', label: 'Allure semi', distanceM: 4000, pace: p('5:10'), hr: HR.as },
          { kind: 'steady', label: 'EF', distanceM: 2000, pace: EF, hr: HR.ef },
        ],
      }),
    ] },
    { start: '2026-08-31', phase: 'Spécifique', label: 'allégée', km: 42, seances: [
      mk(1, 'vma', 'VMA 4×1000 m', '4×1000 m à 4:46, récup 1:30', vma(4, 1000, '4:46', 90)),
      mk(2, 'ef', 'Footing 7 km', '7 km en EF', footing(7)),
      mk(4, 'as', 'Allure semi 4×1500 m', '4×1500 m à 5:08, récup 2 min', asInt(4, 1500, '5:08', 120)),
      mk(6, 'sl', 'Sortie longue 14 km', '14 km en EF', longRun(14)),
    ] },
    { start: '2026-09-07', phase: 'Spécifique', label: 'pic de volume', km: 49, seances: [
      mk(1, 'vma', 'VMA 4×1200 m', '4×1200 m à 4:48, récup 2 min', vma(4, 1200, '4:48', 120)),
      mk(2, 'ef', 'Footing 8 km', '8 km en EF', footing(8)),
      mk(4, 'seuil', 'Seuil 2×15 min', '2×15 min à 5:08, récup 3 min', seuilInt(2, 15, '5:08', 180)),
      mk(6, 'sl', 'Répétition générale 18 km', '18 km dont 6 km à allure semi', {
        surface: 'route',
        parts: [
          { kind: 'steady', label: 'EF', distanceM: 8000, pace: EF, hr: HR.ef },
          { kind: 'work', label: 'Allure semi', distanceM: 6000, pace: p('5:10'), hr: HR.as, note: 'teste ravito, allure et tenue du jour J' },
          { kind: 'steady', label: 'EF', distanceM: 4000, pace: EF, hr: HR.ef },
        ],
      }),
    ] },
    { start: '2026-09-14', phase: 'Spécifique', km: 46, seances: [
      mk(1, 'vma', 'VMA 5×800 m', '5×800 m à 4:42, récup 1:30', vma(5, 800, '4:42', 90)),
      mk(2, 'ef', 'Footing 7 km', '7 km en EF', footing(7)),
      mk(4, 'as', 'Allure semi 3×3 km', '3×3 km à 5:08, récup 2:30', asInt(3, 3000, '5:08', 150)),
      mk(6, 'sl', 'Sortie longue 16 km', '16 km dont 2×5 km à allure semi', {
        surface: 'route',
        parts: [
          { kind: 'steady', label: 'EF', distanceM: 3000, pace: EF, hr: HR.ef },
          { kind: 'work', label: 'Allure semi', distanceM: 5000, pace: p('5:10'), hr: HR.as },
          { kind: 'recovery', label: 'EF', distanceM: 1000, pace: EF, hr: HR.ef },
          { kind: 'work', label: 'Allure semi', distanceM: 5000, pace: p('5:10'), hr: HR.as },
          { kind: 'steady', label: 'EF', distanceM: 2000, pace: EF, hr: HR.ef },
        ],
      }),
    ] },
    { start: '2026-09-21', phase: 'Affûtage', km: 36, seances: [
      mk(1, 'vma', 'VMA 6×400 m', '6×400 m à 4:40, récup 1:00', vma(6, 400, '4:40', 60)),
      mk(2, 'ef', 'Footing 6 km', '6 km en EF', footing(6)),
      mk(4, 'as', 'Allure semi 2×2 km', '2×2 km à 5:08, récup 2 min', asInt(2, 2000, '5:08', 120)),
      mk(6, 'sl', 'Sortie longue 13 km', '13 km en EF', longRun(13)),
    ] },
    { start: '2026-09-28', phase: 'Affûtage', label: 'semaine de course', km: 37, seances: [
      mk(1, 'ef', 'Footing 6 km', '6 km en EF · 4 lignes droites', footing(6, 4)),
      mk(2, 'ef', 'Footing court 4 km', '4 km en EF, ou repos complet', {
        surface: 'route',
        parts: [{ kind: 'steady', label: 'EF', distanceM: 4000, pace: EF, hr: HR.ef, note: 'ou repos complet selon la forme' }],
      }),
      mk(4, 'ef', 'Déverrouillage', '15 min EF + 3×1 min allure semi', {
        surface: 'route',
        parts: [
          { kind: 'steady', label: 'EF', durationSec: 15 * 60, pace: EF, hr: HR.ef },
          rep(3, [{ kind: 'work', label: 'Allure semi', durationSec: 60, pace: p('5:08'), hr: HR.as }, { kind: 'recovery', label: 'Lent', durationSec: 60 }]),
          { kind: 'cooldown', label: 'Retour au calme', durationSec: 5 * 60, pace: EF },
        ],
      }),
      mk(6, 'course', 'Semi-marathon — 21,1 km', 'Tout Rennes Court · objectif 1h50', {
        surface: 'route',
        parts: [{ kind: 'work', label: 'Semi-marathon', distanceM: 21100, pace: p('5:10'), hr: '163–172', note: 'partir à 5:12–5:13, accélérer sur la fin (négatif split)' }],
      }),
    ] },
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
