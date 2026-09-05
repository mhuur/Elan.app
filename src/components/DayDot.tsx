/**
 * Le rond d'un jour de la grille du Planning. Trois états, et c'est TOUTE la sémantique
 * de la grille : anneau = prévu, plein = fait, point = rien ce jour-là. Le remplissage
 * « marée » n'est pas décoratif — il signale que le plein vient d'apparaître après un tap.
 * Partagé entre le Planning et l'aperçu de la fiche séance (sept. 2026), qui montre la
 * même grille pour caler un programme en fonction de ce qui est déjà posé.
 */
export function DayDot({ state, hex }: { state: 'done' | 'planned' | 'none'; hex: string }) {
  if (state === 'none') return <span className="h-1.5 w-1.5 rounded-full bg-ink/25" />
  if (state === 'planned')
    return <span className="h-[15px] w-[15px] rounded-full border-2" style={{ borderColor: hex }} />
  return (
    <span className="relative h-[15px] w-[15px] overflow-hidden rounded-full border" style={{ borderColor: hex }}>
      <span className="absolute inset-0 animate-[tide_1.1s_cubic-bezier(.22,1,.36,1)_both]" style={{ backgroundColor: hex }} />
    </span>
  )
}

/** Cellule d'un jour : la colonne du jour courant se signale par un fond, pas par le rond */
export const dayCell = (isToday: boolean) =>
  'flex h-[30px] items-center justify-center ' + (isToday ? 'rounded-sm bg-sage-500/15' : '')
