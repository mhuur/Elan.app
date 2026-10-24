import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DragOverlay, defaultDropAnimationSideEffects, type DropAnimation, type Modifiers } from '@dnd-kit/core'

/**
 * Au lâcher, la copie rejoint sa place en 150 ms (réglage de MyTodo) ; l'original reste
 * invisible jusqu'au bout : aucune copie pâle à l'arrivée (retour de Romain, 24/10/2026).
 */
const dropAnimation: DropAnimation = {
  duration: 150,
  easing: 'ease',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0' } } }),
}

/**
 * Copie flottante de l'élément glissé, commune à toute l'app (oct. 2026, retour
 * utilisateur : « l'encadré est décalé par rapport à l'accroche de la souris »).
 *
 * Rendue dans `document.body` exprès : le `DragOverlay` est en `position: fixed`, et une
 * carte en verre dépoli (`backdrop-filter`) devient le repère de ses descendants fixes —
 * dans la fiche séance, la copie apparaissait ~200 px à droite de la souris. Hors de
 * toute carte, elle part du rectangle de l'élément attrapé et suit le pointeur au pixel
 * près, en gardant le point d'accroche. `modifiers` : le Planning bloque l'axe vertical.
 */
export default function FloatingOverlay({ children, modifiers }: { children: ReactNode; modifiers?: Modifiers }) {
  return createPortal(
    <DragOverlay dropAnimation={dropAnimation} modifiers={modifiers} zIndex={60}>
      {children}
    </DragOverlay>,
    document.body,
  )
}

/** Habillage « saisie au glisser », repris de MyTodo (`.ek-dragclone`) : agrandie de 2 %, ombre portée, sans inclinaison */
export const liftedClass =
  'cursor-grabbing border border-hairline bg-surface scale-[1.02] shadow-[0_12px_28px_rgba(15,63,147,0.22),0_2px_6px_rgba(15,63,147,0.12)]'
