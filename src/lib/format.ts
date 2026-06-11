import type { Log, Session } from '../types'
import { effectiveMetrics } from './metrics'

/** « 12:05 » à partir de secondes */
export function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Lien de recherche YouTube pour la démo d'un exercice */
export function youtubeSearch(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' exercice technique')}`
}

/** Durée totale estimée d'une séance HIIT en secondes */
export function hiitTotalSec(s: Session): number {
  const work = s.workSec ?? 45
  const rest = s.restSec ?? 15
  const rounds = s.rounds ?? 1
  const n = s.items.length * rounds
  if (n === 0) return 0
  return n * work + (n - 1) * rest
}

/** Durée totale d'une routine d'étirements en secondes */
export function stretchTotalSec(s: Session): number {
  return s.items.reduce((acc, it) => acc + (it.durationSec ?? 30), 0)
}

/** Petit résumé d'un log (séance complétée) pour les listes */
export function logSummary(l: Log): string {
  if (l.metrics?.length) {
    return l.metrics
      .slice(0, 3)
      .map((m) => `${m.value}${m.unit ? ' ' + m.unit : ''}`)
      .join(' · ')
  }
  if (l.velo) {
    const parts: string[] = []
    if (l.velo.durationMin) parts.push(`${l.velo.durationMin} min`)
    if (l.velo.distanceKm) parts.push(`${l.velo.distanceKm} km`)
    if (l.velo.powerW) parts.push(`${l.velo.powerW} W`)
    if (l.velo.avgSpeedKmh) parts.push(`${l.velo.avgSpeedKmh} km/h`)
    if (l.velo.avgBpm) parts.push(`${l.velo.avgBpm} bpm`)
    if (parts.length) return parts.join(' · ')
  }
  if (l.results?.length) {
    const totalSets = l.results.reduce((a, r) => a + r.sets.length, 0)
    return `${l.results.length} exercices · ${totalSets} séries`
  }
  return l.note || 'Bien joué !'
}

/** Petit résumé d'une séance pour les cartes */
export function summarizeSession(s: Session): string {
  switch (s.category) {
    case 'running':
      return s.notes || 'À cocher une fois la sortie faite'
    case 'velo': {
      const m = effectiveMetrics(s)
      // Programme prévu affiché à l'avance (ex. « Durée 45 min · Force 10 »)
      const prog = m.filter((x) => x.target != null)
      if (prog.length) return prog.map((x) => `${x.label} ${x.target}${x.unit ? ' ' + x.unit : ''}`).join(' · ')
      if (!m.length) return 'Saisie des perfs à la fin'
      return m.slice(0, 3).map((x) => x.label).join(' · ') + (m.length > 3 ? '…' : '')
    }
    case 'muscu': {
      const rounds = s.rounds ?? 1
      return `${s.items.length} exercice${s.items.length > 1 ? 's' : ''}${rounds > 1 ? ` × ${rounds} tours` : ''}`
    }
    case 'hiit': {
      const total = Math.round(hiitTotalSec(s) / 60)
      return `${s.items.length} exos · ${s.workSec ?? 45}s / ${s.restSec ?? 15}s · ~${total} min`
    }
    case 'etirements': {
      const total = Math.max(1, Math.round(stretchTotalSec(s) / 60))
      return `${s.items.length} posture${s.items.length > 1 ? 's' : ''} · ~${total} min`
    }
  }
}
