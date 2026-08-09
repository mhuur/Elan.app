import { setTargetsOf, type Exercise, type Log, type Session, type SessionItem } from '../types'
import { muscuBlocks } from './blocks'
import { effectiveMetrics } from './metrics'

/**
 * Progression automatique des objectifs : la perf de la dernière séance devient la nouvelle cible.
 *
 * Règle « ne jamais reculer » : cible = max(cible d'origine, perf réalisée), série par série. Une
 * séance interrompue ou moins bonne ne fait donc jamais baisser l'objectif. Quand un exercice est
 * répété sur plusieurs tours, on retient la PLUS BASSE des valeurs réalisées : la cible doit rester
 * tenable à chaque tour (12 · 12 · 8 → 12 seulement si les trois tours l'ont fait).
 *
 * Rien n'est écrit en base : la fiche de séance garde ses valeurs d'origine, les cibles sont
 * recalculées à l'affichage (programme, minuteur, saisie) depuis le dernier log de CETTE séance.
 * La course à pied est hors sujet (aucune cible saisie dans l'app, simple coche).
 */

/** Mesures qu'on ne fait jamais progresser : y aller plus fort n'est pas un progrès */
const NO_PROGRESS_METRICS = new Set(['bpm'])

/** Un créneau du programme, dans l'ordre réel d'exécution : quel item, quelle série de cet item */
interface Slot {
  itemIdx: number
  exId: string
  setIdx: number
}

/** Créneaux prévus d'une séance muscu / étirements / HIIT, blocs et tours développés */
function plannedSlots(session: Session): Slot[] {
  const slots: Slot[] = []
  if (session.category === 'hiit') {
    for (let r = 0; r < Math.max(1, session.rounds ?? 1); r++) {
      session.items.forEach((it, i) => slots.push({ itemIdx: i, exId: it.exerciseId, setIdx: 0 }))
    }
    return slots
  }
  if (session.category !== 'muscu' && session.category !== 'etirements') return []
  const idxOf = new Map(session.items.map((it, i) => [it, i]))
  for (const b of muscuBlocks(session)) {
    for (let r = 0; r < b.rounds; r++) {
      for (const it of b.items) {
        const itemIdx = idxOf.get(it) ?? 0
        // Étirements : `sets` séries de la posture par tour (2 × 30 s = deux côtés) ; muscu : ses séries
        const sets = session.category === 'etirements' ? Math.max(1, it.sets ?? 1) : setTargetsOf(it).length
        for (let s = 0; s < sets; s++) slots.push({ itemIdx, exId: it.exerciseId, setIdx: s })
      }
    }
  }
  return slots
}

/** Dernier log de cette séance (jusqu'à `upTo` inclus) satisfaisant `has` */
function lastLogOf(session: Session, logs: Log[], upTo: string | undefined, has: (l: Log) => boolean) {
  return logs
    .filter((l) => l.sessionId === session.id && has(l) && (!upTo || l.date <= upTo))
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)))[0]
}

/**
 * Perf tenable de la dernière séance, par créneau (clé `itemIdx:setIdx`). Le log ne garde que les
 * séries PAR EXERCICE : on les redistribue sur les créneaux prévus, dans l'ordre réel d'exécution.
 */
function lastPerfBySlot(session: Session, logs: Log[], upTo?: string): Map<string, number> {
  const out = new Map<string, number>()
  const last = lastLogOf(session, logs, upTo, (l) => !!l.results?.length)
  if (!last) return out
  const left = new Map<string, number[]>()
  for (const r of last.results ?? []) left.set(r.exerciseId, [...(left.get(r.exerciseId) ?? []), ...r.sets])
  const seen = new Map<string, number[]>()
  for (const slot of plannedSlots(session)) {
    const v = left.get(slot.exId)?.shift()
    // Série jamais faite (arrêt en cours de circuit) : elle ne dit rien de la cible, on l'ignore
    if (v == null || v <= 0) continue
    const key = `${slot.itemIdx}:${slot.setIdx}`
    seen.set(key, [...(seen.get(key) ?? []), v])
  }
  for (const [key, values] of seen) out.set(key, Math.min(...values))
  return out
}

/**
 * Séance dont les cibles ont été relevées à hauteur de la dernière perf (voir la règle en tête de
 * fichier). Purement dérivée : à passer aux écrans d'exécution (programme, minuteur, saisie), jamais
 * à `updateSession`. `raised` dit si au moins une cible a bougé, pour le signaler à l'écran.
 */
export function progressedSession(
  session: Session,
  exercises: Exercise[],
  logs: Log[],
  upTo?: string,
): { session: Session; raised: boolean } {
  if (session.category === 'running') return { session, raised: false }
  let raised = false

  // --- Cibles des exercices (muscu : par série ; étirements et HIIT : la posture / l'intervalle)
  const best = lastPerfBySlot(session, logs, upTo)
  const measureOf = (id: string) => exercises.find((e) => e.id === id)?.measure ?? 'reps'
  const items: SessionItem[] = session.items.map((it, i) => {
    const at = (s: number) => best.get(`${i}:${s}`) ?? 0
    if (session.category === 'muscu') {
      const tgs = setTargetsOf(it)
      const next = tgs.map((t, s) => Math.max(t, at(s)))
      if (next.every((t, s) => t === tgs[s])) return it
      raised = true
      return { ...it, targets: next }
    }
    if (session.category === 'etirements') {
      const isReps = measureOf(it.exerciseId) === 'reps'
      const cur = isReps ? it.target ?? 10 : it.durationSec ?? 30
      // La cible est commune aux `sets` séries de la posture (2 × 30 s = deux côtés) :
      // on ne monte qu'au niveau du côté le plus faible, et seulement si tous ont été tenus
      const nSets = Math.max(1, it.sets ?? 1)
      const perfs = Array.from({ length: nSets }, (_, s) => at(s)).filter((v) => v > 0)
      const next = perfs.length === nSets ? Math.max(cur, Math.min(...perfs)) : cur
      if (next === cur) return it
      raised = true
      return isReps ? { ...it, target: next } : { ...it, durationSec: next }
    }
    if (session.category === 'hiit') {
      const cur = it.durationSec ?? session.workSec ?? 45
      const next = Math.max(cur, at(0))
      if (next === cur) return it
      raised = true
      return { ...it, durationSec: next }
    }
    return it
  })

  // --- Mesures saisies à la fin (vélo : durée, distance, puissance…) : la dernière perf fait la cible
  const lastMetrics = lastLogOf(session, logs, upTo, (l) => !!l.metrics?.length)
  const metrics = effectiveMetrics(session).map((m) => {
    if (NO_PROGRESS_METRICS.has(m.key)) return m
    const v = lastMetrics?.metrics?.find((x) => x.key === m.key)?.value
    if (v == null) return m
    const next = Math.max(m.target ?? 0, v)
    if (next === m.target) return m
    raised = true
    return { ...m, target: next }
  })

  if (!raised) return { session, raised: false }
  return { session: { ...session, items, ...(metrics.length ? { metrics } : {}) }, raised: true }
}
