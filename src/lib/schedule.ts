import type { Session } from '../types'
import { DAY_SHORT, mondayIndex, toDateStr } from './dates'

/** Nombre de jours entre deux dates YYYY-MM-DD (positif si to > from) */
export function diffDays(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + 'T12:00:00').getTime()
  const b = new Date(toStr + 'T12:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

/**
 * Séances planifiées à une date donnée : jours fixes hebdomadaires,
 * intervalles (« tous les X jours ») et alternances (une occurrence sur deux).
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
      const partner = s.repeat.alternateWith ? sessions.find((x) => x.id === s.repeat!.alternateWith) : undefined
      if (partner && occurrence % 2 === 1) ids.add(partner.id)
      else ids.add(s.id)
    } else if (s.days.includes(dayIdx)) {
      ids.add(s.id)
    }
  }
  return ids
}

/** Description courte de la planification d'une séance */
export function describeSchedule(s: Session, all: Session[]): string {
  if (s.repeat) {
    const base = s.repeat.everyDays === 1 ? 'Tous les jours' : `Tous les ${s.repeat.everyDays} jours`
    const partner = s.repeat.alternateWith ? all.find((x) => x.id === s.repeat!.alternateWith) : undefined
    return partner ? `${base}, alterné avec ${partner.name}` : base
  }
  if (s.days.length === 7) return 'Tous les jours'
  if (s.days.length) return s.days.map((d) => DAY_SHORT[d]).join(' · ')
  return 'Non planifiée'
}
