import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DragOverlay, defaultDropAnimationSideEffects, type DropAnimation } from '@dnd-kit/core'

/** Au lâcher, la copie rejoint sa place en 200 ms pendant que l'original, en fantôme, réapparaît */
const dropAnimation: DropAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.3' } } }),
}

/**
 * Copie flottante de l'élément glissé, commune à toute l'app (oct. 2026, retour
 * utilisateur : « l'encadré est décalé par rapport à l'accroche de la souris »).
 *
 * Rendue dans `document.body` exprès : le `DragOverlay` est en `position: fixed`, et une
 * carte en verre dépoli (`backdrop-filter`) devient le repère de ses descendants fixes —
 * dans la fiche séance, la copie apparaissait ~200 px à droite de la souris. Hors de
 * toute carte, elle part du rectangle de l'élément attrapé et suit le pointeur au pixel
 * près, en gardant le point d'accroche. Aucun modificateur : ni centrage, ni axe bloqué.
 */
export default function FloatingOverlay({ children }: { children: ReactNode }) {
  return createPortal(
    <DragOverlay dropAnimation={dropAnimation} zIndex={60}>
      {children}
    </DragOverlay>,
    document.body,
  )
}

/** Habillage « soulevé » de la copie : fond opaque (la photo ne doit pas traverser), ombre portée */
export const liftedClass = 'cursor-grabbing border border-sage-500/50 bg-shoal shadow-2xl shadow-black/60'
