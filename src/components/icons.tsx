import type { Category } from '../types'

/**
 * Pictogrammes de la charte 21KM (planche Main, « Icônes — trait 2 px, grille 24 px,
 * bouts arrondis »). Dessinés pour 21KM : Lucide reste pour les icônes d'interface
 * courantes, mais les catégories et les onglets viennent d'ici.
 */
const c = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

export const PICTO = {
  course: c(15, 4, 2) + 'M13.5 8 11 14M8 10.5l3-2.5 3 .5 2.5 3 2.5.5M11 14l3 3v4M11 14l-2.5 3.5H5',
  velo: c(6, 16, 3.5) + c(18, 16, 3.5) + 'M6 16l3.5-7h5l3.5 7M9.5 9l3 7H6M14.5 9 13 6h-2.5',
  muscu: 'M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11',
  hiit: 'M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8z',
  etir: c(12, 4.5, 2) + 'M4 8.5c2.7 1.3 5.3 2 8 2s5.3-.7 8-2M12 10.5v5M12 15.5l-4.5 5M12 15.5l4.5 5',
  soleil: c(12, 12, 4) + 'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  planning: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  drapeau: 'M5 21V4M5 4h11l-2 4 2 4H5',
  grille: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  reglages: 'M4 7h10M18 7h2M4 17h4M12 17h8' + c(16, 7, 2) + c(10, 17, 2),
  flamme: 'M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.5-5.3 3.8-8.3.5 1.8 1.6 2.9 2.7 3.4.3-2.6 1.2-5.1 3-6.9.6 3.2 3.5 5.6 3.5 10 0 4.6-2.6 8-6.5 8z',
  lune: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  video: c(12, 12, 9) + 'M10 8.5v7l5.5-3.5z',
  poignee: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
} as const

export type PictoName = keyof typeof PICTO

export const CATEGORY_PICTO: Record<Category, PictoName> = {
  running: 'course',
  velo: 'velo',
  muscu: 'muscu',
  hiit: 'hiit',
  etirements: 'etir',
}

export function Picto({ name, className, strokeWidth = 2 }: { name: PictoName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? 'h-[22px] w-[22px]'}
    >
      <path d={PICTO[name]} />
    </svg>
  )
}

/** Logo 21KM : anneau Volt aux trois quarts autour de « 21 », sur carré encre (`plate`)
 *  ou sur fond sombre. */
export function Logo({ size = 36, plate = true, label = true }: { size?: number; plate?: boolean; label?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role={label ? 'img' : undefined} aria-label={label ? 'Logo 21KM' : undefined} aria-hidden={label ? undefined : true}>
      {plate && <rect width="36" height="36" rx="10" fill="#0E1116" />}
      <circle cx="18" cy="18" r="11" fill="none" stroke="#C5F23A" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="52 69.1" transform="rotate(-90 18 18)" />
      <text x="18" y="22" textAnchor="middle" fontFamily="Archivo, sans-serif" fontSize="11" fontWeight="800" fill="#FFFFFF">
        21
      </text>
    </svg>
  )
}
