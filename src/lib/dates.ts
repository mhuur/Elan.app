export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
export const DAY_LETTER = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Date locale au format YYYY-MM-DD */
export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr(): string {
  return toDateStr(new Date())
}

/** Index du jour avec lundi = 0 … dimanche = 6 */
export function mondayIndex(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Lundi de la semaine de la date donnée, à minuit */
export function startOfWeek(d: Date = new Date()): Date {
  const r = addDays(d, -mondayIndex(d))
  r.setHours(0, 0, 0, 0)
  return r
}

/** « mardi 10 juin » */
export function formatLongFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** « 10 juin » à partir d'une date YYYY-MM-DD */
export function formatShortFr(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** « 10/06 » à partir d'une Date */
export function formatDayMonth(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}
