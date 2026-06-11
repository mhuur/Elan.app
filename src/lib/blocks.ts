import type { Session, SessionItem } from '../types'

/** Bloc d'exercices muscu : un groupe d'exercices répété `rounds` fois avant de passer au bloc suivant */
export interface MuscuBlock {
  items: SessionItem[]
  rounds: number
}

/**
 * Blocs d'une séance muscu (ex. Bloc 1 : Pompes 4×10 — Bloc 2 ×2 tours : circuit abdos).
 * Sans découpage (`blockBreak`), toute la séance forme un seul bloc dont les tours
 * viennent de l'ancien champ `Session.rounds`.
 */
export function muscuBlocks(s: Session): MuscuBlock[] {
  if (!s.items.length) return []
  const hasBreaks = s.items.some((it, i) => i > 0 && it.blockBreak)
  if (!hasBreaks) return [{ items: s.items, rounds: Math.max(1, s.rounds ?? 1) }]
  const blocks: MuscuBlock[] = []
  s.items.forEach((it, i) => {
    if (i === 0 || it.blockBreak) blocks.push({ items: [], rounds: Math.max(1, it.blockRounds ?? 1) })
    blocks[blocks.length - 1].items.push(it)
  })
  return blocks
}
