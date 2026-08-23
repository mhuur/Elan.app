import type { Goal, GoalLevel, MetricDef, MetricTarget, ObjectiveLevel, Session } from '../types'

/** Calories affichées par le home trainer (il dit « cal », il s'agit de kcal) */
export const CALORIES_METRIC: MetricDef = { key: 'calories', label: 'Calories', unit: 'kcal' }

/** Mesures par défaut des séances vélo (clés stables pour les graphiques) */
export const DEFAULT_VELO_METRICS: MetricDef[] = [
  { key: 'power', label: 'Puissance', unit: 'W' },
  { key: 'duration', label: 'Durée', unit: 'min' },
  { key: 'distance', label: 'Distance', unit: 'km' },
  { key: 'speed', label: 'Vitesse moy.', unit: 'km/h' },
  { key: 'bpm', label: 'BPM moyen', unit: 'bpm' },
  CALORIES_METRIC,
]

/**
 * Mesures effectives d'une séance : celles définies par l'utilisateur,
 * sinon les mesures vélo par défaut pour les séances vélo.
 * Vélo : la mesure Calories est garantie même sur les fiches créées avant
 * août 2026 (le formulaire de séance n'édite plus `metrics`, l'utilisateur
 * ne peut donc pas l'ajouter lui-même).
 */
export function effectiveMetrics(session: Session): MetricDef[] {
  if (session.metrics && session.metrics.length) {
    if (session.category === 'velo' && !session.metrics.some((m) => m.key === 'calories')) {
      return [...session.metrics, CALORIES_METRIC]
    }
    return session.metrics
  }
  if (session.category === 'velo') return DEFAULT_VELO_METRICS
  return []
}

export function newMetric(): MetricDef {
  return { key: crypto.randomUUID(), label: '', unit: '' }
}

/** Cibles de l'objectif d'une séance (gère l'ancien format à mesure unique) */
export function objectiveTargets(s: Session): MetricTarget[] {
  const o = s.objective
  if (!o) return []
  if (o.targets && o.targets.length) return o.targets
  if (o.metricKey && o.value != null) {
    return [{ key: o.metricKey, label: o.label ?? 'Mesure', unit: o.unit ?? '', value: o.value }]
  }
  return []
}

/** Paliers de l'objectif d'une séance (gère les anciens formats à palier unique) */
export function objectiveLevels(s: Session): ObjectiveLevel[] {
  const o = s.objective
  if (!o) return []
  if (o.levels && o.levels.length) return o.levels.filter((l) => l.targets.length)
  const targets = objectiveTargets(s)
  return targets.length ? [{ targets }] : []
}

/** Paliers d'un objectif d'exercice, triés par valeur croissante (gère l'ancien palier unique) */
export function goalLevels(g: Goal): GoalLevel[] {
  const levels = g.levels && g.levels.length ? g.levels : g.value != null ? [{ value: g.value }] : []
  return levels.slice().sort((a, b) => a.value - b.value)
}
