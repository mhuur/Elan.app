// Cloudflare Worker — rappels de séance d'Avel
//
// Pourquoi ce Worker existe : une PWA ne peut PAS programmer une notification locale à
// l'avance (l'API Notification Triggers a été abandonnée, jamais livrée nulle part) et un
// `setTimeout` dans un service worker ne survit pas à son éviction. Il faut donc un serveur
// qui envoie un push Web à l'heure voulue — c'est lui, réveillé par un Cron Trigger.
//
// Ce Worker NE CALCULE JAMAIS le planning. La planification d'Avel (cycles d'alternance,
// « tous les X jours », repeat.onDays, plan semi) est complexe et vit dans l'app
// (src/lib/schedule.ts, src/lib/planDay.ts). La réimplémenter ici créerait une seconde source
// de vérité vouée à diverger. L'app envoie donc un agenda pré-calculé « date → noms de
// séances » (src/lib/reminderAgenda.ts), et le Worker se contente de le lire.
//
// Secrets à poser (npx wrangler secret put …) :
//   VAPID_PRIVATE_KEY   clé privée VAPID, PKCS8 base64url (cf. scripts/generate-vapid.mjs)
//   ELAN_NOTIF_KEY      clé partagée anti-abus léger (optionnelle, non secrète : embarquée dans l'app)
// Variables (wrangler.toml, non secrètes) : VAPID_PUBLIC_KEY, ADMIN_CONTACT

import { deserializeVapidKeys, sendPushNotification } from 'web-push-browser'
import { dueNow, hoursOf, isHour, lastSentOf, MAX_HOURS, notificationText, pruneLastSent } from './due.js'

const ALLOWED_ORIGINS = [
  'https://avel.web.app',
  'https://routine-sport-ca440.web.app',
  'https://routine-sport-ca440.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5190',
]

/** Durée de vie du push : un rappel du matin ne vaut plus rien le soir. */
const TTL_SEC = 6 * 60 * 60

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const json = (data, status, origin) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })

/**
 * Clé KV d'un abonnement = SHA-256 de son endpoint.
 *
 * L'endpoint push EST la capacité : c'est une URL longue et non devinable, et c'est
 * exactement ce que l'entrée protège. On ne peut donc écraser une entrée que si on détient
 * déjà ce qu'elle protège — pas besoin d'authentifier un utilisateur. Bonus : chaque appareil
 * a son entrée (donc son rappel), et les rappels marchent même en mode local, sans compte.
 */
async function keyFor(endpoint) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return 'sub:' + hex
}

/**
 * Envoie un push. Renvoie le statut HTTP du service de push.
 *
 * `algorithm` est OBLIGATOIRE malgré ce qu'annonce la doc de la bibliothèque (« defaults to
 * AES128GCM ») : sans lui, createCEKInfo lève « Invalid algorithm ». aes128gcm = RFC 8291,
 * le schéma standard ; l'ancien `aesgcm` (draft-04) est déprécié et ignoré par Safari.
 */
async function sendReminder(env, entry, names, rank = 0) {
  const keys = await deserializeVapidKeys({
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  })
  const payload = JSON.stringify({ ...notificationText(names, rank), url: '/' })
  const res = await sendPushNotification(keys, entry.subscription, env.ADMIN_CONTACT, payload, {
    algorithm: 'aes128gcm',
    ttl: TTL_SEC,
    urgency: 'normal',
  })
  return res.status
}

/** 404/410 = l'abonnement n'existe plus côté service de push (app désinstallée, cache vidé). */
const isGone = (status) => status === 404 || status === 410

async function handleSubscribe(request, env, origin) {
  const body = await request.json()
  const { subscription, tz, agenda } = body

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return json({ error: 'abonnement invalide' }, 400, origin)
  }
  // `hours` est la forme courante ; `hour` reste accepté (anciens clients pas encore rechargés).
  const hours = hoursOf(body)
  if (!hours.length || hours.length > MAX_HOURS || !hours.every(isHour)) {
    return json({ error: 'heures invalides' }, 400, origin)
  }
  if (typeof tz !== 'string' || !tz) return json({ error: 'fuseau invalide' }, 400, origin)
  if (!agenda || typeof agenda !== 'object') return json({ error: 'agenda invalide' }, 400, origin)

  const key = await keyFor(subscription.endpoint)
  const previous = await env.REMINDERS.get(key, 'json')

  await env.REMINDERS.put(
    key,
    JSON.stringify({
      subscription,
      hours,
      tz,
      agenda,
      // On conserve `lastSent` : ré-enregistrer l'agenda ne doit pas rejouer un rappel du jour.
      // Les heures supprimées sont purgées au passage.
      lastSent: previous ? pruneLastSent(lastSentOf(previous), hours) : {},
      updatedAt: new Date().toISOString(),
    }),
  )
  return json({ ok: true, jours: Object.keys(agenda).length, rappels: hours.length }, 200, origin)
}

async function handleUnsubscribe(request, env, origin) {
  const { endpoint } = await request.json()
  if (!endpoint) return json({ error: 'endpoint manquant' }, 400, origin)
  await env.REMINDERS.delete(await keyFor(endpoint))
  return json({ ok: true }, 200, origin)
}

/** Push immédiat : le seul moyen de vérifier la chaîne complète sans attendre demain matin. */
async function handleTest(request, env, origin) {
  const { endpoint } = await request.json()
  if (!endpoint) return json({ error: 'endpoint manquant' }, 400, origin)

  const key = await keyFor(endpoint)
  const entry = await env.REMINDERS.get(key, 'json')
  if (!entry) return json({ error: 'abonnement inconnu' }, 404, origin)

  const status = await sendReminder(env, entry, ['Ceci est un test de rappel'])
  if (isGone(status)) await env.REMINDERS.delete(key)
  return json({ ok: status >= 200 && status < 300, status }, 200, origin)
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? ''
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
    if (request.method !== 'POST') return json({ error: 'méthode non gérée' }, 405, origin)

    // Anti-abus léger, à l'identique du Worker Strava : la clé est embarquée dans l'app,
    // donc publique. La vraie protection est que l'endpoint push est non devinable.
    if (env.ELAN_NOTIF_KEY && request.headers.get('Authorization') !== 'Bearer ' + env.ELAN_NOTIF_KEY) {
      return json({ error: 'non autorisé' }, 401, origin)
    }

    const { pathname } = new URL(request.url)
    try {
      if (pathname === '/subscribe') return await handleSubscribe(request, env, origin)
      if (pathname === '/unsubscribe') return await handleUnsubscribe(request, env, origin)
      if (pathname === '/test') return await handleTest(request, env, origin)
      return json({ error: 'route inconnue' }, 404, origin)
    } catch (e) {
      return json({ error: String(e?.message ?? e) }, 500, origin)
    }
  },

  /**
   * Cron toutes les 5 min. Lit chaque abonnement, envoie le rappel à ceux dont l'heure locale
   * vient d'arriver et qui ont bien une séance aujourd'hui.
   *
   * Budget du plan gratuit : 288 réveils/jour et autant de lectures KV (plafonds 100 000/jour) ;
   * on n'ÉCRIT qu'au moment de l'envoi, soit ~1 fois par jour et par appareil (plafond 1 000).
   */
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const now = new Date()
        const { keys } = await env.REMINDERS.list({ prefix: 'sub:' })

        for (const { name } of keys) {
          const entry = await env.REMINDERS.get(name, 'json')
          if (!entry) continue

          const d = dueNow(entry, now)
          if (!d) continue

          let status
          try {
            status = await sendReminder(env, entry, d.names, d.rank)
          } catch {
            continue // erreur réseau/chiffrement → on retentera au prochain réveil du cron
          }

          if (isGone(status)) {
            await env.REMINDERS.delete(name)
            continue
          }
          if (status >= 200 && status < 300) {
            const hours = hoursOf(entry)
            const lastSent = pruneLastSent(lastSentOf(entry), hours)
            // `alsoMark` : les heures dues qu'on a délibérément tues (fenêtres qui se
            // chevauchent) sont marquées envoyées, pour ne pas les rejouer au tick suivant.
            for (const h of [d.hour, ...d.alsoMark]) lastSent[h] = d.date
            await env.REMINDERS.put(name, JSON.stringify({ ...entry, hours, hour: undefined, lastSent }))
          }
        }
      })(),
    )
  },
}
