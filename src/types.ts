export type Category = 'running' | 'velo' | 'muscu' | 'hiit' | 'etirements'
export type Measure = 'reps' | 'sec'
export type ColName = 'exercises' | 'sessions' | 'logs'

export interface Exercise {
  id: string
  name: string
  category: Category
  /** Unité de mesure : répétitions ou secondes (ex. gainage) */
  measure: Measure
  description?: string
  videoUrl?: string
  createdAt: number
}

export interface SessionItem {
  exerciseId: string
  /** Muscu : nombre de séries */
  sets?: number
  /** Muscu : objectif par série (reps ou secondes selon l'exercice) */
  target?: number
  /** Étirements : durée de la posture en secondes */
  durationSec?: number
}

export interface Session {
  id: string
  name: string
  category: Category
  /** Jours de la semaine type : 0 = lundi … 6 = dimanche */
  days: number[]
  items: SessionItem[]
  /** HIIT : secondes d'effort */
  workSec?: number
  /** HIIT : secondes de repos */
  restSec?: number
  /** HIIT : nombre de tours */
  rounds?: number
  /** Vélo : puissance cible en watts */
  targetPowerW?: number
  /** Vélo : durée cible en minutes */
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
