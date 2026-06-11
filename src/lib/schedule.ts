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

/** Séance propriétaire du cycle dont fait partie sessionId (elle-même si propriétaire) */
export function ownerOf(sessionId: string, sessions: Session[]): Session | undefined {
  return sessions.find((s) => s.repeat && cycleIdsOf(s).includes(sessionId))
}

/**
 * Séances planifiées à une date donnée : jours fixes hebdomadaires,
 * intervalles (« tous les X jours ») et cycles d'alternance.
 */
export function plannedSessionIdsOn(date: Date, sessions: Session[]): Set<string> {
  const ids = new Set<string>()
  const dStr = toDateStr(date)
  const dayIdx = mondayIndex(date)
  for (const s of sessions) {
    if (s.repeat) {
      const diff = diffDays(s.repeat.startDate, dStr)
      if (diff < 0 || diff % s.repeat.everyDays !== 0) continue
      const occurrence = diff / s.repeat.everyDays
      const cycle = cycleIdsOf(s).filter((id) => sessions.some((x) => x.id === id))
      if (!cycle.length) continue
      ids.add(cycle[occurrence % cycle.length])
    } else if (s.days.includes(dayIdx)) {
      ids.add(s.id)
    }
  }
  return ids
}

/** Description courte de la planification d'une séance (y compris membre d'un cycle) */
export function describeSchedule(s: Session, all: Session[]): string {
  const owner = s.repeat ? s : ownerOf(s.id, all)
  if (owner?.repeat) {
    const base = owner.repeat.everyDays === 1 ? 'Tous les jours' : `Tous les ${owner.repeat.everyDays} jours`
    const others = cycleIdsOf(owner)
      .filter((id) => id !== s.id)
      .map((id) => all.find((x) => x.id === id)?.name)
      .filter((n): n is string => !!n)
    const fixed = !s.repeat && s.days.length ? ` + ${s.days.map((d) => DAY_SHORT[d]).join(' · ')}` : ''
    return (others.length ? `${base}, en alternance avec ${others.join(', ')}` : base) + fixed
  }
  if (s.days.length === 7) return 'Tous les jours'
  if (s.days.length) return s.days.map((d) => DAY_SHORT[d]).join(' · ')
  return 'Non planifiée'
}
