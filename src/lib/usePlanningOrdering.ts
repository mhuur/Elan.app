import { useEffect, useState } from 'react'
import { PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { Session } from '../types'
import { PLAN_SECTION, planningSections, type LayoutSection } from './planningLayout'

export interface PlanningOrdering {
  sensors: ReturnType<typeof useSensors>
  /** Sections dans leur ordre vertical (avec injection de la section « Running » du plan) */
  sections: LayoutSection[]
  /** ids `sec-{group}` des en-têtes déplaçables (vide si < 2 sections déplaçables) */
  sectionItems: string[]
  canDragSections: boolean
  /** L'utilisateur a au moins une section nommée */
  hasGroups: boolean
  /** Afficher la grille (plan actif OU au moins une séance) */
  showGrid: boolean
  handleDragEnd: (e: DragEndEvent) => void
}

/**
 * Ordre optimiste + sections + drag & drop du Planning. Possède l'état `orderIds`
 * (réordonnancement local pendant le drag), calcule les sections via `planningSections`
 * et porte toute la machinerie dnd-kit (sensors + `handleDragEnd` sections ET séances).
 * Extrait du conteneur Planning (audit P2) : une seule responsabilité, testable à part.
 *
 * `handleDragEnd` ne modifie JAMAIS la planification — il ne touche qu'à `sortOrder`
 * (ordre d'affichage), au `group` (section d'appartenance) et à l'ancre de la section
 * « Running » du plan (`savePlanAnchor`).
 */
export function usePlanningOrdering({
  sessions,
  planActive,
  planAnchor,
  savePlanAnchor,
  updateSession,
}: {
  sessions: Session[]
  planActive: boolean
  planAnchor: string
  savePlanAnchor: (k: string) => void
  updateSession: (id: string, patch: Partial<Session>) => void | Promise<void>
}): PlanningOrdering {
  // Ordre local optimiste pendant le drag & drop, resynchronisé sur les données
  const [orderIds, setOrderIds] = useState<string[]>(() => sessions.map((s) => s.id))
  useEffect(() => {
    setOrderIds(sessions.map((s) => s.id))
  }, [sessions])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  const ordered = orderIds.map((id) => sessions.find((s) => s.id === id)).filter((s): s is Session => !!s)
  const groupOf = (s: Session) => (s.group ?? '').trim()

  const sections = planningSections(ordered, planActive, planAnchor)
  // Section « Running » synthétique (sans séance) : présente quand le plan est actif et
  // que l'utilisateur n'a pas sa propre section Running → sa position suit l'ancre.
  const showPlanSection = sections.some((s) => s.plan && s.sessions.length === 0)
  const hasGroups = ordered.some((s) => groupOf(s) !== '')
  const showGrid = planActive || sessions.length > 0
  // Sections déplaçables : celles qui portent ≥ 1 séance, plus la section « Running » du plan.
  const draggableKeys = sections.filter((s) => s.sessions.length > 0 || s.plan).map((s) => s.group)
  const canDragSections = draggableKeys.length >= 2
  const sectionItems = canDragSections ? draggableKeys.map((g) => 'sec-' + g) : []

  /** Réécrit le `sortOrder` de toutes les séances pour refléter `next` (et persiste). */
  const persistOrder = (next: string[]) => {
    setOrderIds(next)
    next.forEach((sid, i) => {
      const s = sessions.find((x) => x.id === sid)
      if (s && s.sortOrder !== i) void updateSession(sid, { sortOrder: i })
    })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const aId = String(active.id)
    const oId = String(over.id)

    // Réordonner une SECTION entière (glissée par sa poignée d'en-tête).
    // L'ordre des sections utilisateur dérive du sortOrder (réécrit par blocs) ; la
    // section « Running » du plan (sans séance) se repositionne via son ancre.
    if (aId.startsWith('sec-')) {
      const displayKeys = sections.map((s) => s.group)
      const fromKey = aId.slice(4)
      const toKey = oId.startsWith('sec-') ? oId.slice(4) : groupOf(sessions.find((s) => s.id === oId) ?? ({} as Session))
      const from = displayKeys.indexOf(fromKey)
      const to = displayKeys.indexOf(toKey)
      if (from === -1 || to === -1 || from === to) return
      const newKeys = arrayMove(displayKeys, from, to)
      const byKey = new Map(sections.map((s) => [s.group, s.sessions]))
      // Réécrit le sortOrder des séances dans le nouvel ordre de sections (le plan, sans séance, est ignoré)
      persistOrder(newKeys.flatMap((k) => (byKey.get(k) ?? []).map((s) => s.id)))
      // Réancre la section du plan juste au-dessus de la section qui la suit (ou tout en bas)
      if (showPlanSection) {
        const idx = newKeys.indexOf(PLAN_SECTION)
        if (idx >= 0) savePlanAnchor(newKeys[idx + 1] ?? '__end__')
      }
      return
    }

    // Déplacer une SÉANCE : réordonner, et la déposer sur une autre section l'y déplace.
    const oldIdx = orderIds.indexOf(aId)
    const newIdx = orderIds.indexOf(oId)
    if (oldIdx === -1 || newIdx === -1) return
    const a = sessions.find((s) => s.id === aId)
    const o = sessions.find((s) => s.id === oId)
    if (a && o && groupOf(a) !== groupOf(o)) void updateSession(a.id, { group: groupOf(o) })
    persistOrder(arrayMove(orderIds, oldIdx, newIdx))
  }

  return { sensors, sections, sectionItems, canDragSections, hasGroups, showGrid, handleDragEnd }
}
