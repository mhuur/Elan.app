import type { Log, Session } from '../types'
import { addDays, toDateStr } from './dates'
import { canonicalCycles, plannedSessionIdsOn } from './schedule'
import { isPlanLog, planToDoOn } from './planDay'

/** Agenda des rappels : date YYYY-MM-DD → noms des séances à faire ce jour-là. */
export type Agenda = Record<string, string[]>

/** Horizon par défaut, en jours. Voir la note sur la péremption ci-dessous. */
export const AGENDA_DAYS = 30

/**
 * Construit l'agenda des `days` prochains jours (aujourd'hui inclus), pour l'envoyer au
 * Worker `elan-notif` qui poussera les rappels.
 *
 * POURQUOI ICI, ET PAS DANS LE WORKER — la planification d'Avel est tout sauf triviale
 * (cycles d'alternance, « tous les X jours », `repeat.onDays`, plan semi aligné au lundi).
 * La réimplémenter côté serveur créerait une seconde source de vérité, vouée à diverger de
 * `plannedSessionIdsOn` / `planToDoOn`. On calcule donc ici, avec les mêmes fonctions que les
 * pages Aujourd'hui et Planning, et le Worker se contente de lire « date → noms ».
 *
 * Conséquence assumée : l'agenda périme. Si l'app n'est pas ouverte pendant plus de `days`
 * jours, les rappels s'arrêtent — et repartent tout seuls à la réouverture.
 *
 * Les jours sans séance sont OMIS : pas d'entrée, donc pas de push le jour de repos. C'est
 * important, Chrome sanctionne les pushs qui n'affichent rien (cf. src/sw.ts).
 */
export function buildAgenda(sessions: Session[], logs: Log[], days = AGENDA_DAYS, from: Date = new Date()): Agenda {
  const agenda: Agenda = {}
  const cycles = canonicalCycles(sessions)

  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    const dStr = toDateStr(date)

    // Séances utilisateur prévues ce jour-là, moins celles déjà validées. Même règle que la
    // to-do d'Aujourd'hui (Today.tsx) : les logs du plan (`planRef`) ne valident pas une
    // séance utilisateur, d'où le filtre `!isPlanLog`.
    const doneIds = new Set(logs.filter((l) => l.date === dStr && !isPlanLog(l)).map((l) => l.sessionId))
    const plannedIds = plannedSessionIdsOn(date, sessions, cycles)
    const names = sessions.filter((s) => plannedIds.has(s.id) && !doneIds.has(s.id)).map((s) => s.name)

    // Séances de course du plan semi dues ce jour-là et pas encore faites
    for (const st of planToDoOn(date, logs)) names.push(st.seance.title)

    if (names.length) agenda[dStr] = names
  }

  return agenda
}

/**
 * Empreinte stable d'un agenda, pour n'écrire dans le Worker que s'il a vraiment changé.
 * Le plan gratuit Cloudflare KV plafonne à 1 000 écritures/jour : sans ce garde-fou, chaque
 * validation de séance déclencherait un aller-retour réseau et une écriture.
 */
export function agendaFingerprint(agenda: Agenda): string {
  return Object.keys(agenda)
    .sort()
    .map((d) => `${d}:${agenda[d].join('|')}`)
    .join('\n')
}
