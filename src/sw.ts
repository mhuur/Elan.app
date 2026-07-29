/// <reference lib="webworker" />
//
// Service worker d'Avel. Deux rôles :
//   1. le pré-cache hors ligne (ce que `vite-plugin-pwa` générait tout seul avant) ;
//   2. la réception des rappels de séance envoyés par le Worker Cloudflare `notif-elan`.
//
// Le passage en stratégie `injectManifest` (cf. vite.config.ts) nous rend ce fichier :
// à nous de reproduire le comportement `registerType: 'autoUpdate'`, d'où skipWaiting()
// et clientsClaim().

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

/** Contenu du push envoyé par le Worker (cf. worker/notif/notif-elan.js) */
interface ReminderPayload {
  title: string
  body: string
  url?: string
}

// --- Pré-cache : mise à jour immédiate, sans attendre la fermeture des onglets ---

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.skipWaiting()
clientsClaim()

// --- Rappels de séance ---

const FALLBACK: ReminderPayload = {
  title: 'Avel',
  body: 'Ta séance du jour t’attend.',
}

/**
 * Chrome n'accepte l'abonnement qu'avec `userVisibleOnly: true` et exige qu'un push
 * affiche TOUJOURS une notification : un push muet lui fait afficher « Ce site a été mis
 * à jour en arrière-plan », puis révoquer l'abonnement. On affiche donc un message de
 * repli même quand la charge utile est absente ou illisible.
 */
self.addEventListener('push', (event) => {
  let payload = FALLBACK
  try {
    if (event.data) payload = { ...FALLBACK, ...(event.data.json() as ReminderPayload) }
  } catch {
    /* charge utile illisible → on garde le repli */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      lang: 'fr',
      tag: 'elan-seance-du-jour',
      renotify: true,
      data: { url: payload.url ?? '/' },
    } as NotificationOptions),
  )
})

/** Au clic : on ramène l'onglet Avel existant au premier plan, sinon on en ouvre un. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus()
          if ('navigate' in client) await client.navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
