import type { Category } from '../types'
import { CategoryRing } from './ui'

export type DayState = 'done' | 'planned' | 'missed' | 'none'

/**
 * Le rond d'un jour de la grille du Planning (charte 21KM, planche Planning) : l'anneau de
 * la catégorie. Plein = faite, anneau clair = prévue, pointillés gris = jour passé prévu
 * mais non fait, petit point = rien ce jour-là. Partagé entre le Planning et l'aperçu de
 * la fiche séance, qui montre la même grille.
 */
export function DayDot({ state, category = 'muscu', hex, small }: { state: DayState; category?: Category; hex?: string; small?: boolean }) {
  if (state === 'none') return <span className="h-1.5 w-1.5 rounded-full bg-hairline-strong" />
  return (
    <CategoryRing
      category={category}
      hex={hex}
      done={state === 'done'}
      missed={state === 'missed'}
      className={small ? 'h-6 w-6' : 'h-[30px] w-[30px] lg:h-10 lg:w-10'}
    />
  )
}

/** Cellule d'un jour : la colonne du jour courant se signale par un fond Teinte, pas par le rond */
export const dayCell = (isToday: boolean) =>
  'flex h-11 items-center justify-center rounded-[10px] lg:h-[52px] ' + (isToday ? 'bg-sage-100' : '')
