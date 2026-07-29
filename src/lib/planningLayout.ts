import type { Session } from '../types'

/** Nom de la section qui accueille les séances de course du plan semi */
export const PLAN_SECTION = 'Running'

export interface LayoutSection {
  /** Groupe (Session.group) ; '' = section par défaut */
  group: string
  /** Séances de la section, dans l'ordre reçu (sortOrder) */
  sessions: Session[]
  /** Les séances de course du plan s'injectent en tête de cette section */
  plan: boolean
}

/**
 * Ordre vertical des séances tel qu'affiché dans le Planning, partagé avec
 * Aujourd'hui pour garantir le MÊME ordre des deux côtés.
 *
 * Sections dans leur ordre d'apparition (puis la section par défaut '' en dernier),
 * séances de chaque section dans l'ordre reçu. Quand le plan est actif et que
 * l'utilisateur n'a pas déjà sa propre section « Running », une section « Running »
 * synthétique (sans séance) est insérée à sa position d'ancrage `planAnchor`
 * ('__start__' = en tête, '__end__' = en bas, sinon juste au-dessus de cette section).
 */
export function planningSections(ordered: Session[], planActive: boolean, planAnchor: string): LayoutSection[] {
  const groupOf = (s: Session) => (s.group ?? '').trim()
  const groupNames: string[] = []
  for (const s of ordered) {
    const g = groupOf(s)
    if (g && !groupNames.includes(g)) groupNames.push(g)
  }
  const hasGroups = groupNames.length > 0
  const grouped: LayoutSection[] = hasGroups
    ? [
        ...groupNames.map(
          (g): LayoutSection => ({ group: g, sessions: ordered.filter((s) => groupOf(s) === g), plan: planActive && g === PLAN_SECTION }),
        ),
        ...(ordered.some((s) => !groupOf(s))
          ? [{ group: '', sessions: ordered.filter((s) => !groupOf(s)), plan: false } as LayoutSection]
          : []),
      ]
    : [{ group: '', sessions: ordered, plan: false }]

  const hasRunningGroup = groupNames.includes(PLAN_SECTION)
  if (planActive && !hasRunningGroup) {
    const at =
      planAnchor === '__end__'
        ? grouped.length
        : (() => {
            const i = grouped.findIndex((s) => s.group === planAnchor)
            return i === -1 ? 0 : i // ancre absente (section supprimée) → tout en haut
          })()
    return [...grouped.slice(0, at), { group: PLAN_SECTION, sessions: [], plan: true }, ...grouped.slice(at)]
  }
  return grouped
}
