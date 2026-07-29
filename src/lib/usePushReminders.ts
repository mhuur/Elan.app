import { useCallback, useEffect, useRef, useState } from 'react'
import { useData } from '../data/DataContext'
import { agendaFingerprint, buildAgenda } from './reminderAgenda'

const NOTIF_URL = import.meta.env.VITE_NOTIF_URL as string | undefined
const NOTIF_KEY = import.meta.env.VITE_NOTIF_KEY as string | undefined
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

const HOURS_KEY = 'elan-rappel-heures'
/** Ancien réglage à heure unique, migré au premier chargement */
const LEGACY_HOUR_KEY = 'elan-rappel-heure'
const FP_KEY = 'elan-rappel-agenda-fp'
const DEFAULT_HOUR = '07:30'

/**
 * Plafond de rappels quotidiens (miroir de MAX_HOURS côté Worker). Chrome limite les sites qui
 * notifient beaucoup, et un rappel qu'on ignore est un rappel qu'on finit par couper.
 */
export const MAX_HOURS = 4

/**
 * Écart minimal entre deux rappels, en minutes (miroir de WINDOW_MIN côté Worker). En deçà,
 * leurs fenêtres de tolérance se chevauchent : le Worker n'en enverrait qu'un.
 */
export const MIN_GAP_MIN = 15

/** Créneaux proposés à l'ajout d'un rappel, dans l'ordre. */
const SUGGESTIONS = ['07:30', '12:30', '19:00', '21:00']

/** Le service worker n'est enregistré qu'en build (pas en `vite dev`) : on n'attend pas indéfiniment. */
const READY_TIMEOUT_MS = 5_000

const read = (k: string, fallback = '') => {
  try {
    return localStorage.getItem(k) ?? fallback
  } catch {
    return fallback
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* stockage indisponible */
  }
}

const isHour = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)
const toMinutes = (h: string) => {
  const [a, b] = h.split(':').map(Number)
  return a * 60 + b
}

/** Heures triées, dédoublonnées, valides. Migre l'ancien réglage à heure unique. */
function readHours(): string[] {
  const raw = read(HOURS_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        const clean = [...new Set(parsed.filter((h): h is string => typeof h === 'string' && isHour(h)))].sort()
        if (clean.length) return clean.slice(0, MAX_HOURS)
      }
    } catch {
      /* réglage illisible → on repart du défaut */
    }
  }
  const legacy = read(LEGACY_HOUR_KEY)
  return legacy && isHour(legacy) ? [legacy] : [DEFAULT_HOUR]
}

/**
 * Créneau proposé à l'ajout d'un rappel.
 *
 * On cherche d'abord un créneau franchement espacé (90 min) : proposer 07:30 à quelqu'un qui a
 * déjà un rappel à 06:45 serait valide mais absurde. À défaut, on retombe sur le simple écart
 * minimal, puis sur un balayage de la journée.
 */
function suggestHour(hours: string[]): string | null {
  const apart = (h: string, gap: number) => hours.every((x) => Math.abs(toMinutes(x) - toMinutes(h)) >= gap)
  const spaced = SUGGESTIONS.find((h) => apart(h, 90))
  if (spaced) return spaced
  const close = SUGGESTIONS.find((h) => apart(h, MIN_GAP_MIN))
  if (close) return close
  for (let m = 0; m < 24 * 60; m += 30) {
    const h = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    if (apart(h, MIN_GAP_MIN)) return h
  }
  return null
}

/** `navigator.serviceWorker.ready` borné dans le temps (sinon la promesse ne résout jamais en dev). */
async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sw-indisponible')), READY_TIMEOUT_MS)),
  ])
}

/** base64url → Uint8Array, format attendu par `applicationServerKey`. */
function urlB64ToBytes(b64: string): Uint8Array {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function callWorker(path: string, body: unknown): Promise<Response> {
  const res = await fetch(`${NOTIF_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(NOTIF_KEY ? { Authorization: 'Bearer ' + NOTIF_KEY } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`notif ${res.status}`)
  return res
}

/**
 * Rappels de séance par notification push, un à plusieurs par jour.
 *
 * Une PWA ne peut PAS programmer une notification locale à l'avance (l'API Notification
 * Triggers a été abandonnée par Chrome, jamais livrée ailleurs). Un `setTimeout` dans le
 * service worker ne survit pas à son éviction. Le seul mécanisme fiable est donc un push
 * envoyé par un serveur à l'heure voulue — ici le Worker Cloudflare `elan-notif`, réveillé
 * par un Cron Trigger.
 *
 * L'app lui confie un agenda pré-calculé (cf. reminderAgenda.ts) ; lui ne fait que pousser.
 * Un rappel de midi ou du soir se tait donc de lui-même si la séance a été validée entre-temps :
 * l'agenda est réécrit à la validation, et le jour disparaît.
 */
export function usePushReminders() {
  const { sessions, logs } = useData()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [hours, setHoursState] = useState<string[]>(readHours)

  const supported =
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  const configured = !!NOTIF_URL && !!VAPID_PUBLIC

  // Un abonnement existe-t-il déjà sur cet appareil ?
  useEffect(() => {
    if (!supported || !configured) return
    let alive = true
    void (async () => {
      try {
        const reg = await readyRegistration()
        const sub = await reg.pushManager.getSubscription()
        if (alive) setEnabled(!!sub && Notification.permission === 'granted')
      } catch {
        /* pas de service worker (dev) → rappels indisponibles, l'UI le dira */
      }
    })()
    return () => {
      alive = false
    }
  }, [supported, configured])

  /** Envoie agenda + heures au Worker, uniquement si quelque chose a changé. */
  const pushAgenda = useCallback(
    async (force = false, hoursOverride?: string[]) => {
      const reg = await readyRegistration()
      const sub = await reg.pushManager.getSubscription()
      if (!sub) return

      const list = hoursOverride ?? readHours()
      const agenda = buildAgenda(sessions, logs)
      const fp = `${list.join(',')}\n${agendaFingerprint(agenda)}`
      if (!force && fp === read(FP_KEY)) return

      await callWorker('/subscribe', {
        subscription: sub.toJSON(),
        hours: list,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        agenda,
      })
      write(FP_KEY, fp)
    },
    [sessions, logs],
  )

  // Resynchronise quand le planning ou les séances validées bougent. L'empreinte évite les
  // écritures inutiles : le plan gratuit Cloudflare KV plafonne à 1 000 écritures/jour.
  const pushAgendaRef = useRef(pushAgenda)
  pushAgendaRef.current = pushAgenda
  useEffect(() => {
    if (!enabled || !supported || !configured) return
    const t = setTimeout(() => void pushAgendaRef.current().catch(() => {}), 1_500)
    return () => clearTimeout(t)
  }, [enabled, supported, configured, sessions, logs])

  const enable = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setMessage(
          permission === 'denied'
            ? 'Notifications bloquées — autorise-les dans les réglages du navigateur.'
            : 'Autorisation refusée.',
        )
        return
      }
      const reg = await readyRegistration()
      if (!(await reg.pushManager.getSubscription())) {
        await reg.pushManager.subscribe({
          // Chrome l'impose, et exige qu'un push affiche toujours une notification (cf. sw.ts)
          userVisibleOnly: true,
          applicationServerKey: urlB64ToBytes(VAPID_PUBLIC!) as BufferSource,
        })
      }
      setEnabled(true)
      await pushAgenda(true)
      setMessage('Rappels activés ✓')
    } catch (e) {
      setEnabled(false)
      setMessage(
        (e as Error).message === 'sw-indisponible'
          ? 'Indisponible ici — les rappels marchent sur l’app installée.'
          : 'Activation impossible — réessaie.',
      )
    } finally {
      setBusy(false)
    }
  }, [pushAgenda])

  const disable = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const reg = await readyRegistration()
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await callWorker('/unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
        await sub.unsubscribe()
      }
      write(FP_KEY, '')
      setEnabled(false)
      setMessage('Rappels désactivés')
    } catch {
      setMessage('Désactivation impossible — réessaie.')
    } finally {
      setBusy(false)
    }
  }, [])

  /** Enregistre la nouvelle liste d'heures et la pousse au Worker. */
  const commitHours = useCallback(
    async (next: string[], confirmation: string) => {
      const sorted = [...new Set(next)].sort()
      setHoursState(sorted)
      write(HOURS_KEY, JSON.stringify(sorted))
      if (!enabled) {
        setMessage(confirmation)
        return
      }
      setBusy(true)
      try {
        await pushAgenda(true, sorted)
        setMessage(confirmation)
      } catch {
        setMessage('Enregistrement impossible — réessaie.')
      } finally {
        setBusy(false)
      }
    },
    [enabled, pushAgenda],
  )

  /** Déplace le rappel `index` vers `next`. Refuse un chevauchement avec un autre rappel. */
  const setHour = useCallback(
    async (index: number, next: string) => {
      if (!isHour(next) || hours[index] === next) return
      const others = hours.filter((_, i) => i !== index)
      if (others.includes(next)) return setMessage('Ce rappel existe déjà.')
      if (others.some((h) => Math.abs(toMinutes(h) - toMinutes(next)) < MIN_GAP_MIN)) {
        return setMessage(`Espace tes rappels d’au moins ${MIN_GAP_MIN} minutes.`)
      }
      await commitHours([...others, next], `Rappel réglé sur ${next}`)
    },
    [hours, commitHours],
  )

  const addHour = useCallback(async () => {
    if (hours.length >= MAX_HOURS) return setMessage(`${MAX_HOURS} rappels par jour au maximum.`)
    const suggested = suggestHour(hours)
    if (!suggested) return setMessage('Plus de créneau libre.')
    await commitHours([...hours, suggested], `Rappel ajouté à ${suggested}`)
  }, [hours, commitHours])

  const removeHour = useCallback(
    async (index: number) => {
      if (hours.length <= 1) return setMessage('Garde au moins un rappel, ou désactive-les.')
      await commitHours(
        hours.filter((_, i) => i !== index),
        `Rappel de ${hours[index]} supprimé`,
      )
    },
    [hours, commitHours],
  )

  /** Push immédiat : le seul moyen de vérifier la chaîne complète sans attendre demain matin. */
  const sendTest = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const reg = await readyRegistration()
      const sub = await reg.pushManager.getSubscription()
      if (!sub) throw new Error('pas-d-abonnement')
      await callWorker('/test', { endpoint: sub.endpoint })
      setMessage('Notification de test envoyée')
    } catch {
      setMessage('Test impossible — réessaie.')
    } finally {
      setBusy(false)
    }
  }, [])

  return {
    enabled,
    busy,
    message,
    hours,
    canAdd: hours.length < MAX_HOURS,
    supported,
    configured,
    enable,
    disable,
    setHour,
    addHour,
    removeHour,
    sendTest,
  }
}
