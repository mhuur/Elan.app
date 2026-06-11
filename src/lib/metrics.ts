import type { MetricDef, Session } from '../types'

/** Mesures par défaut des séances vélo (clés stables pour les graphiques) */
export const DEFAULT_VELO_METRICS: MetricDef[] = [
  { key: 'power', label: 'Puissance', unit: 'W' },
  { key: 'duration', label: 'Durée', unit: 'min' },
  { key: 'distance', label: 'Distance', unit: 'km' },
  { key: 'speed', label: 'Vitesse moy.', unit: 'km/h' },
  { key: 'bpm', label: 'BPM moyen', unit: 'bpm' },
]

/**
 * Mesures effectives d'une séance : celles définies par l'utilisateur,
 * sinon les mesures vélo par défaut pour les séances vélo.
 */
export function effectiveMetrics(session: Session): MetricDef[] {
  if (session.metrics && session.metrics.length) return session.metrics
  if (session.category === 'velo') return DEFAULT_VELO_METRICS
  return []
}

export function newMetric(): MetricDef {
  return { key: crypto.randomUUID(), label: '', unit: '' }
}
