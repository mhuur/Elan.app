import type { Session } from '../types'
import { DAY_SHORT, mondayIndex, toDateStr } from './dates'

/** Nombre de jours entre deux dates YYYY-MM-DD (positif si to > from) */
export function diffDays(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + 'T12:00:00').getTime()
  const b = new Date(toStr + 'T12:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

/** Cycle d'alternance d'une séance propriétaire : elle-même puis ses alternances */
export function cycleIdsOf(s: Session): string[] {
  if (!s.repeat) return []
  const alts = s.repeat.alternates ?? (s.repeat.alternateWith ? [s.repeat.alternateWith] : [])
  return [s.id, ...alts]
}

/**
 * Cycles d'alternance canoniques : chaque séance n'appartient qu'à UN cycle.
 * Les anciennes données pouvaient écrire l'alternance des deux côtés (Pompes ↔ Dos),
 * créant deux propriétaires concurrents et des doublons de planification :
 * ici le premier propriétaire rencontré (ordre d'affichage) gagne, les autres
 * cycles qui revendiquent les mêmes séances sont ignorés à la lecture.
 */
export function canonicalCycles(sessions: Session[]): Map<string, string[]> {
  const cycles = new Map<string, string[]>()
  const claimed = new Set<string>()
  for (const s of sessions) {
    if (!s.repeat || claimed.has(s.id)) continue
    const cycle = cycleIdsOf(s).filter(
      (id, i, arr) => arr.indexOf(id) === i && !claimed.has(id) && sessions.some((x) => x.id === id),
    )
    if (!cycle.length) continue
    cycles.set(s.id, cycle)
    for (const id of cycle) claimed.add(id)
  }
  return cycles
}

/** Séance propriétaire du cycle canonique dont fait partie sessionId (elle-même si propriétaire) */
export function ownerOf(sessionId: string, sessions: Session[]): Session | undefined {
  for (const [ownerId, cycle] of canonicalCycles(sessions)) {
    if (cycle.includes(sessionId)) return sessions.find((s) => s.id === ownerId)
  }
  return undefined
}

/**
 * Séances planifiées à une date donnée : jours fixes hebdomadaires,
 * intervalles (« tous les X jours ») et cycles d'alternance.
 * Les membres d'un cycle sont pilotés par la rotation : leurs éventuels
 * jours fixes résiduels sont ignorés.
 */
export function plannedSessionIdsOn(date: Date, sessions: Session[]): Set<string> {
  const ids = new Set<string>()
  const dStr = toDateStr(date)
  const dayIdx = mondayIndex(date)
  const cycles = canonicalCycles(sessions)
  const inCycle = new Set([...cycles.values()].flat())
  for (const [ownerId, cycle] of cycles) {
    const owner = sessions.find((x) => x.id === ownerId)
    if (!owner?.repeat) continue
    const diff = diffDays(owner.repeat.startDate, dStr)
    if (diff < 0 || diff % owner.repeat.everyDays !== 0) continue
    const occurrence = diff / owner.repeat.everyDays
    ids.add(cycle[occurrence % cycle.length])
  }
  for (const s of sessions) {
    if (!inCycle.has(s.id) && s.days.includes(dayIdx)) ids.add(s.id)
  }
  return ids
}

/** Description courte de la planification d'une séance (y compris membre d'un cycle) */
export function describeSchedule(s: Session, all: Session[]): string {
  const owner = ownerOf(s.id, all)
  if (owner?.repeat) {
    const base = owner.repeat.everyDays === 1 ? 'Tous les jours' : `Tous les ${owner.repeat.everyDays} jours`
    const others = (canonicalCycles(all).get(owner.id) ?? [])
      .filter((id) => id !== s.id)
      .map((id) => all.find((x) => x.id === id)?.name)
      .filter((n): n is string => !!n)
    return others.length ? `${base}, en alternance avec ${others.join(', ')}` : base
  }
  if (s.days.length === 7) return 'Tous les jours'
  if (s.days.length) return s.days.map((d) => DAY_SHORT[d]).join(' · ')
  return 'Non planifiée'
}
