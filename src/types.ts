export type Category = 'running' | 'velo' | 'muscu' | 'hiit' | 'etirements'
export type Measure = 'reps' | 'sec'
export type ColName = 'exercises' | 'sessions' | 'logs' | 'ideas'

/** Note libre « bug ou idée d'amélioration » saisie depuis les Réglages */
export interface Idea {
  id: string
  text: string
  /** Traitée / réglée */
  done?: boolean
  createdAt: number
}

/** Palier d'objectif : valeur à atteindre et récompense promise (ex. lunettes de soleil 😎) */
export interface GoalLevel {
  value: number
  reward?: string
}

/** Objectif sur un exercice : meilleure série ou volume total à atteindre */
export interface Goal {
  metric: 'best' | 'volume'
  /** Hérité : palier unique (les nouvelles données passent par `levels`) */
  value?: number
  /** Paliers successifs (croissants), chacun avec sa récompense éventuelle */
  levels?: GoalLevel[]
}

export interface Exercise {
  id: string
  name: string
  category: Category
  /** Sous-types : groupes musculaires ou familles (Abdominaux, Jambes, Cardio…) */
  subtypes?: string[]
  /** Hérité : ancien sous-type unique */
  subtype?: string
  /** Unité de mesure : répétitions ou secondes (ex. gainage) */
  measure: Measure
  /** Objectif à atteindre (null = aucun) */
  goal?: Goal | null
  description?: string
  videoUrl?: string
  createdAt: number
}

/** Sous-types d'un exercice (gère l'ancien champ unique) */
export function subtypesOf(e: Exercise): string[] {
  if (e.subtypes && e.subtypes.length) return e.subtypes
  return e.subtype ? [e.subtype] : []
}

/** Sous-types proposés à la création d'un exercice (saisie libre possible) */
export const PRESET_SUBTYPES = [
  'Abdominaux',
  'Pectoraux',
  'Dos',
  'Bras',
  'Épaules',
  'Jambes',
  'Fessiers',
  'Full body',
  'Cardio',
  'Endurance',
  'Mobilité',
  'Souplesse',
]

export interface SessionItem {
  exerciseId: string
  /** Muscu : nombre de séries */
  sets?: number
  /** Muscu : objectif par série (reps ou secondes selon l'exercice) */
  target?: number
  /** Étirements : durée de la posture en secondes */
  durationSec?: number
  /** Muscu : repos entre les séries, en secondes */
  restSec?: number
  /** Muscu : superset — enchaîner avec l'exercice suivant sans repos */
  linkNext?: boolean
  /** Consigne libre affichée pendant la séance (tempo, posture…) */
  comment?: string
}

/** Planification par intervalle : « tous les X jours » depuis une date */
export interface Repeat {
  everyDays: number
  /** Date de départ YYYY-MM-DD */
  startDate: string
  /**
   * Rotation par jours : chaque étape regroupe les séances faites le même jour
   * (ex. [[Pompes, Abdos], [Jambes, Dos]] = jour A puis jour B, et on recommence).
   * Pas de tableaux imbriqués dans Firestore → tableau d'objets `{ ids }`.
   */
  steps?: { ids: string[] }[]
  /** Hérité : alternance simple, une séance par occurrence */
  alternates?: string[]
  /** Hérité : ancienne alternance à deux */
  alternateWith?: string
}

/** Cible sur une mesure d'une séance */
export interface MetricTarget {
  key: string
  label: string
  unit: string
  value: number
}

/** Palier d'objectif de séance : toutes les cibles à remplir dans une même séance */
export interface ObjectiveLevel {
  targets: MetricTarget[]
  /** Récompense promise quand le palier est atteint */
  reward?: string
}

/** Objectif sur une séance : un ou plusieurs paliers, chacun multi-mesures */
export interface SessionObjective {
  /** Paliers successifs, chacun avec sa récompense éventuelle */
  levels?: ObjectiveLevel[]
  /** Hérité : palier unique multi-mesures */
  targets?: MetricTarget[]
  /** Hérité : ancien objectif à mesure unique */
  metricKey?: string
  label?: string
  unit?: string
  value?: number
}

/** Mesure personnalisée définie sur une séance, saisie à la complétion */
export interface MetricDef {
  key: string
  label: string
  unit: string
  /** Programme prévu, affiché à l'avance (ex. Durée 45 min, Force 10) */
  target?: number
}

/** Lien utile attaché à une séance (YouTube ou autre) */
export interface LinkDef {
  label: string
  url: string
}

/** Valeur de mesure enregistrée dans un log (dénormalisée) */
export interface MetricValue {
  key: string
  label: string
  unit: string
  value: number
}

export interface Session {
  id: string
  name: string
  category: Category
  /** Jours de la semaine type : 0 = lundi … 6 = dimanche */
  days: number[]
  /** Planification par intervalle (remplace les jours fixes si défini, null = désactivé) */
  repeat?: Repeat | null
  items: SessionItem[]
  /** HIIT : secondes d'effort */
  workSec?: number
  /** HIIT : secondes de repos */
  restSec?: number
  /** HIIT : nombre de tours · Muscu : tours du circuit */
  rounds?: number
  /** Mesures saisies à la fin de la séance (vélo par défaut, personnalisable partout) */
  metrics?: MetricDef[]
  /** Liens utiles à ouvrir (vidéos, programmes…) */
  links?: LinkDef[]
  /** Ordre d'affichage dans le planning et la journée */
  sortOrder?: number
  /** Section du planning (regroupement libre : Matinale, Cardio…) */
  group?: string
  /** Objectif à atteindre sur une mesure (null = aucun) */
  objective?: SessionObjective | null
  /** Vélo (hérité) : puissance cible en watts */
  targetPowerW?: number
  /** Vélo (hérité) : durée cible en minutes */
  targetDurationMin?: number
  notes?: string
  createdAt: number
}

export interface ExerciseResult {
  exerciseId: string
  name: string
  measure: Measure
  /** Réalisé par série (reps ou secondes) */
  sets: number[]
}

/** Hérité (anciens logs vélo) : conservé pour l'affichage */
export interface VeloData {
  powerW?: number
  durationMin?: number
  distanceKm?: number
  avgSpeedKmh?: number
  avgBpm?: number
}

export interface Log {
  id: string
  /** Date locale YYYY-MM-DD */
  date: string
  sessionId: string
  sessionName: string
  category: Category
  /** Mesures saisies (vélo et champs personnalisés) */
  metrics?: MetricValue[]
  /** Hérité : anciens logs vélo */
  velo?: VeloData
  results?: ExerciseResult[]
  note?: string
  createdAt: number
}

export const CATEGORIES: Category[] = ['running', 'velo', 'muscu', 'hiit', 'etirements']

export interface CategoryMeta {
  label: string
  emoji: string
  text: string
  bg: string
  soft: string
  hex: string
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  running: { label: 'Running', emoji: '🏃', text: 'text-running', bg: 'bg-running', soft: 'bg-running/10', hex: '#c2773e' },
  velo: { label: 'Vélo', emoji: '🚴', text: 'text-velo', bg: 'bg-velo', soft: 'bg-velo/10', hex: '#5b89ad' },
  muscu: { label: 'Muscu', emoji: '💪', text: 'text-muscu', bg: 'bg-muscu', soft: 'bg-muscu/10', hex: '#8d6ba0' },
  hiit: { label: 'HIIT', emoji: '🔥', text: 'text-hiit', bg: 'bg-hiit', soft: 'bg-hiit/10', hex: '#cf6151' },
  etirements: { label: 'Étirements', emoji: '🧘', text: 'text-etirements', bg: 'bg-etirements', soft: 'bg-etirements/10', hex: '#5f8862' },
}
