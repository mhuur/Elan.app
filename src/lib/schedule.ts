import type { Session } from '../types'
import { DAY_SHORT, mondayIndex, toDateStr } from './dates'

/** Nombre de jours entre deux dates YYYY-MM-DD (positif si to > from) */
export function diffDays(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + 'T12:00:00').getTime()
  const b = new Date(toStr + 'T12:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

/**
 * Étapes de rotation d'une séance propriétaire : chaque étape = les séances
 * d'un même jour. Gère les anciens formats (`alternates` / `alternateWith`),
 * où chaque séance constituait sa propre étape.
 */
export function cycleStepsOf(s: Session): string[][] {
  if (!s.repeat) return []
  if (s.repeat.steps && s.repeat.steps.length) return s.repeat.steps.map((st) => st.ids)
  const alts = s.repeat.alternates ?? (s.repeat.alternateWith ? [s.repeat.alternateWith] : [])
  return [[s.id], ...alts.map((a) => [a])]
}

/**
 * Cycles d'alternance canoniques : chaque séance n'appartient qu'à UN cycle.
 * Les anciennes données pouvaient écrire l'alternance des deux côtés (Pompes ↔ Dos),
 * créant deux propriétaires concurrents et des doublons de planification :
 * ici le premier propriétaire rencontré (ordre d'affichage) gagne, les autres
 * cycles qui revendiquent les mêmes séances sont ignorés à la lecture.
 */
export function canonicalCycles(sessions: Session[]): Map<string, string[][]> {
  const cycles = new Map<string, string[][]>()
  const claimed = new Set<string>()
  for (const s of sessions) {
    if (!s.repeat || claimed.has(s.id)) continue
    const seen = new Set<string>()
    const steps = cycleStepsOf(s)
      .map((st) =>
        st.filter((id) => {
          if (seen.has(id) || claimed.has(id) || !sessions.some((x) => x.id === id)) return false
          seen.add(id)
          return true
        }),
      )
      .filter((st) => st.length)
    if (!steps.length) continue
    cycles.set(s.id, steps)
    for (const id of seen) claimed.add(id)
  }
  return cycles
}

/** Séance propriétaire du cycle canonique dont fait partie sessionId (elle-même si propriétaire) */
export function ownerOf(sessionId: string, sessions: Session[]): Session | undefined {
  for (const [ownerId, steps] of canonicalCycles(sessions)) {
    if (steps.some((st) => st.includes(sessionId))) return sessions.find((s) => s.id === ownerId)
  }
  return undefined
}

/**
 * Séances planifiées à une date donnée : jours fixes hebdomadaires,
 * intervalles (« tous les X jours ») et cycles d'alternance (toutes les
 * séances de l'étape du jour). Les membres d'un cycle sont pilotés par la
 * rotation : leurs éventuels jours fixes résiduels sont ignorés.
 */
export function plannedSessionIdsOn(date: Date, sessions: Session[]): Set<string> {
  const ids = new Set<string>()
  const dStr = toDateStr(date)
  const dayIdx = mondayIndex(date)
  const cycles = canonicalCycles(sessions)
  const inCycle = new Set([...cycles.values()].flat(2))
  for (const [ownerId, steps] of cycles) {
    const owner = sessions.find((x) => x.id === ownerId)
    if (!owner?.repeat) continue
    const diff = diffDays(owner.repeat.startDate, dStr)
    if (diff < 0 || diff % owner.repeat.everyDays !== 0) continue
    const occurrence = diff / owner.repeat.everyDays
    for (const id of steps[occurrence % steps.length]) ids.add(id)
  }
  for (const s of sessions) {
    if (!inCycle.has(s.id) && s.days.includes(dayIdx)) ids.add(s.id)
  }
  return ids
}

/** Description courte de la planification d'une séance (y compris membre d'un cycle) */
export function describeSchedule(s: Session, all: Session[]): string {
  const nameOf = (id: string) => all.find((x) => x.id === id)?.name ?? '?'
  const owner = ownerOf(s.id, all)
  if (owner?.repeat) {
    const steps = canonicalCycles(all).get(owner.id) ?? []
    const base = owner.repeat.everyDays === 1 ? 'Tous les jours' : `Tous les ${owner.repeat.everyDays} jours`
    const myStep = steps.find((st) => st.includes(s.id)) ?? []
    const sameDay = myStep.filter((id) => id !== s.id).map(nameOf)
    const others = steps.filter((st) => st !== myStep).map((st) => st.map(nameOf).join(' + '))
    let txt = base
    if (sameDay.length) txt += `, avec ${sameDay.join(' + ')}`
    if (others.length) txt += `, en alternance avec ${others.join(', ')}`
    return txt
  }
  if (s.days.length === 7) return 'Tous les jours'
  if (s.days.length) return s.days.map((d) => DAY_SHORT[d]).join(' · ')
  return 'Non planifiée'
}
