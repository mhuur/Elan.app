// Décision pure « faut-il envoyer un rappel maintenant, et lequel ? », isolée du réseau et du
// KV pour être testable hors Worker (cf. scripts/check-rappels-worker.mjs).
//
// Tout le sel est ici : le cron tourne en UTC, l'utilisateur vit à Paris. C'est en
// convertissant vers son fuseau que le passage heure d'été/hiver se gère tout seul.

/**
 * Tolérance autour de l'heure cible, en minutes. Le cron tourne toutes les 5 min mais
 * Cloudflare ne garantit pas la ponctualité : une fenêtre plus large absorbe la gigue.
 * Aucun risque de doublon — `lastSent[heure]` verrouille chaque rappel à un par jour.
 */
export const WINDOW_MIN = 15

/**
 * Plafond de rappels quotidiens. Chrome limite les sites qui notifient beaucoup, et un
 * rappel qu'on ignore est un rappel qu'on finit par couper : 4 suffit largement.
 */
export const MAX_HOURS = 4

/** Écart minimal entre deux rappels : en deçà, leurs fenêtres de tolérance se chevauchent. */
export const MIN_GAP_MIN = WINDOW_MIN

const HOUR_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const isHour = (h) => typeof h === 'string' && HOUR_RE.test(h)

/** « 07:30 » → 450 */
export const toMinutes = (h) => {
  const [a, b] = h.split(':').map(Number)
  return a * 60 + b
}

/** Heures de rappel triées et dédoublonnées. Gère l'ancien format à heure unique (`hour`). */
export function hoursOf(entry) {
  const raw = Array.isArray(entry.hours) ? entry.hours : entry.hour ? [entry.hour] : []
  return [...new Set(raw.filter(isHour))].sort()
}

/**
 * `lastSent` normalisé en `{ '07:30': '2026-07-10' }`.
 * L'ancien format était une simple date (une seule heure de rappel existait) : on la rattache
 * à la première heure, sinon le rappel du matin serait rejoué le jour de la migration.
 */
export function lastSentOf(entry) {
  const ls = entry.lastSent
  if (typeof ls === 'string') {
    const hours = hoursOf(entry)
    return hours.length ? { [hours[0]]: ls } : {}
  }
  return ls && typeof ls === 'object' ? ls : {}
}

/** Ne garde que les heures encore configurées, pour que `lastSent` ne gonfle pas indéfiniment. */
export function pruneLastSent(lastSent, hours) {
  const out = {}
  for (const h of hours) if (lastSent[h]) out[h] = lastSent[h]
  return out
}

/** Date et minutes locales dans le fuseau `tz`. Lève si le fuseau est invalide. */
export function localNow(now, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23', // sans quoi minuit peut sortir en « 24 »
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

/**
 * Le rappel à envoyer maintenant, ou `null`.
 *
 * `{ date, names, hour, rank, alsoMark }` :
 *   - `rank` = position de l'heure dans la liste triée. 0 = premier rappel de la journée
 *     (« Séance du jour »), au-delà = relance (« Pas encore fait »).
 *   - `alsoMark` = les autres heures déjà dues et pas encore envoyées. On les marque comme
 *     envoyées SANS les pousser : si deux rappels sont trop rapprochés, on n'en tire qu'un.
 *
 * On n'envoie RIEN quand il n'y a pas de séance (jour de repos, séance déjà validée, ou agenda
 * périmé faute d'ouverture de l'app) : Chrome sanctionne les pushs qui n'affichent pas de
 * notification, jusqu'à révoquer l'abonnement.
 */
export function dueNow(entry, now) {
  let local
  try {
    local = localNow(now, entry.tz)
  } catch {
    return null // fuseau invalide → on ignore cet abonné plutôt que de tout planter
  }

  const hours = hoursOf(entry)
  if (!hours.length) return null

  const names = entry.agenda?.[local.date]
  if (!Array.isArray(names) || names.length === 0) return null

  const lastSent = lastSentOf(entry)
  const due = hours.filter((h) => {
    const target = toMinutes(h)
    return local.minutes >= target && local.minutes < target + WINDOW_MIN && lastSent[h] !== local.date
  })
  if (!due.length) return null

  const hour = due[due.length - 1] // la plus tardive des heures dues
  return { date: local.date, names, hour, rank: hours.indexOf(hour), alsoMark: due.slice(0, -1) }
}

/**
 * Titre et corps de la notification. Le premier rappel du jour annonce, les suivants relancent.
 * Un rappel unique posé le soir a donc le rang 0 : il annonce, ce qui est correct.
 */
export function notificationText(names, rank = 0) {
  const n = names.length
  const title =
    rank === 0
      ? n === 1
        ? 'Séance du jour'
        : `Séances du jour (${n})`
      : n === 1
        ? 'Pas encore fait'
        : `Pas encore fait (${n})`
  return { title, body: names.join(' · ') }
}
