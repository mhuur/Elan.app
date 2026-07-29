// Vérif ciblée : le bloc « Rappels de séance » des Réglages s'abonne, règle ses heures (jusqu'à
// 4 rappels par jour, refus des créneaux trop rapprochés), envoie un test et se désabonne — en
// parlant bien au Worker avec un agenda contenant la séance du jour.
//
// Le Worker est mocké via page.route (aucun appel réseau réel).
//
// LIMITE ASSUMÉE : un vrai `pushManager.subscribe()` est impossible en Chromium headless (il n'y
// a pas de service de push derrière). On bouchonne donc `navigator.serviceWorker` et
// `Notification` : ce test couvre l'UI et le CONTENU envoyé au Worker, pas le chiffrement.
// Le chiffrement, lui, est prouvé par `node scripts/check-rappels-worker.mjs` (qui déchiffre
// réellement), et la chaîne complète par le bouton « Envoyer une notification de test ».
//
// Prérequis : serveur en mode test (`vite --mode test --port 5190`)
// Usage : BASE_URL=http://localhost:5190 node scripts/check-rappels.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5190'
const DIR = 'screenshots'
mkdirSync(DIR, { recursive: true })

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/ENDPOINT-DE-TEST'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

// --- Bouchon : service worker + PushManager + Notification, avant tout script de la page ---
await page.addInitScript((endpoint) => {
  let current = null
  const subscription = {
    endpoint,
    unsubscribe: async () => {
      current = null
      return true
    },
    toJSON: () => ({ endpoint, keys: { p256dh: 'FAUSSE-CLE-P256DH', auth: 'FAUX-AUTH' } }),
  }
  const registration = {
    pushManager: {
      getSubscription: async () => current,
      subscribe: async () => {
        current = subscription
        return subscription
      },
    },
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registration), register: async () => registration },
  })
  window.PushManager = function PushManager() {}
  window.Notification = {
    permission: 'default',
    requestPermission: async () => {
      window.Notification.permission = 'granted'
      return 'granted'
    },
  }
}, ENDPOINT)

// --- Interception du Worker de rappels ---
const calls = []
await page.route('**elan-notif.test.workers.dev**', async (route) => {
  const req = route.request()
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' }
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })

  const path = new URL(req.url()).pathname
  calls.push({ path, auth: req.headers()['authorization'], body: req.postDataJSON() })
  const body = path === '/test' ? { ok: true, status: 201 } : { ok: true, jours: 1 }
  return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
})

const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'} ${label}${ok || !detail ? '' : `  → ${detail}`}`)
}
const last = (path) => [...calls].reverse().find((c) => c.path === path)

try {
  await page.goto(BASE)
  await page.waitForSelector('text=Routine matinale', { timeout: 20000 }) // le seed a tourné

  await page.click('[aria-label="Réglages"]')
  await page.waitForSelector('text=Rappels de séance')
  await page.screenshot({ path: `${DIR}/rappels-01-reglages.png` })

  console.log('\nActivation')
  await page.click('text=Activer les rappels')
  await page.waitForSelector('text=Rappels activés', { timeout: 6000 })

  const sub = last('/subscribe')
  check('POST /subscribe reçu', !!sub)
  check('clé partagée envoyée en Bearer', sub?.auth === 'Bearer test-key', sub?.auth)
  check('abonnement transmis', sub?.body?.subscription?.endpoint === ENDPOINT, sub?.body?.subscription?.endpoint)
  check('un seul rappel par défaut, à 07:30', JSON.stringify(sub?.body?.hours) === '["07:30"]', JSON.stringify(sub?.body?.hours))
  check('fuseau transmis', typeof sub?.body?.tz === 'string' && sub.body.tz.length > 0, sub?.body?.tz)
  check(
    'agenda : la routine matinale est due aujourd’hui',
    (sub?.body?.agenda?.[todayStr] ?? []).includes('Routine matinale'),
    JSON.stringify(sub?.body?.agenda?.[todayStr]),
  )

  console.log('\nRéglage de l’heure')
  await page.fill('[aria-label="Heure du rappel 1"]', '06:45')
  await page.waitForSelector('text=Rappel réglé sur 06:45', { timeout: 6000 })
  check('nouvelle heure poussée au Worker', JSON.stringify(last('/subscribe')?.body?.hours) === '["06:45"]', JSON.stringify(last('/subscribe')?.body?.hours))

  console.log('\nPlusieurs rappels par jour')
  await page.click('text=Ajouter un rappel')
  await page.waitForSelector('text=Rappel ajouté à 12:30', { timeout: 6000 })
  check('2e rappel suggéré à midi', JSON.stringify(last('/subscribe')?.body?.hours) === '["06:45","12:30"]', JSON.stringify(last('/subscribe')?.body?.hours))

  await page.click('text=Ajouter un rappel')
  await page.waitForSelector('text=Rappel ajouté à 19:00', { timeout: 6000 })
  check('3e rappel suggéré le soir', JSON.stringify(last('/subscribe')?.body?.hours) === '["06:45","12:30","19:00"]', JSON.stringify(last('/subscribe')?.body?.hours))
  check('libellé du 1er rappel', (await page.locator('text=Rappel du jour à').count()) === 1)
  check('libellé des relances', (await page.locator('text=Puis relance à').count()) === 2)
  await page.screenshot({ path: `${DIR}/rappels-02-actif.png` })

  console.log('\nRappels trop rapprochés : refusés')
  await page.fill('[aria-label="Heure du rappel 2"]', '06:50')
  await page.waitForSelector('text=Espace tes rappels', { timeout: 6000 })
  check('12:30 → 06:50 refusé (moins de 15 min de 06:45)', JSON.stringify(last('/subscribe')?.body?.hours) === '["06:45","12:30","19:00"]', JSON.stringify(last('/subscribe')?.body?.hours))

  console.log('\nSuppression d’un rappel')
  await page.click('[aria-label="Supprimer le rappel de 12:30"]')
  await page.waitForSelector('text=Rappel de 12:30 supprimé', { timeout: 6000 })
  check('il ne reste que matin et soir', JSON.stringify(last('/subscribe')?.body?.hours) === '["06:45","19:00"]', JSON.stringify(last('/subscribe')?.body?.hours))
  check('deux lignes de rappel', (await page.locator('[aria-label^="Heure du rappel"]').count()) === 2)

  console.log('\nNotification de test')
  await page.click('text=Envoyer une notification de test')
  await page.waitForSelector('text=Notification de test envoyée', { timeout: 6000 })
  check('POST /test avec l’endpoint', last('/test')?.body?.endpoint === ENDPOINT, last('/test')?.body?.endpoint)

  console.log('\nDésactivation')
  await page.click('text=Désactiver les rappels')
  await page.waitForSelector('text=Rappels désactivés', { timeout: 6000 })
  check('POST /unsubscribe avec l’endpoint', last('/unsubscribe')?.body?.endpoint === ENDPOINT)
  check('les sélecteurs d’heure disparaissent', (await page.locator('[aria-label^="Heure du rappel"]').count()) === 0)
  await page.screenshot({ path: `${DIR}/rappels-03-inactif.png` })

  if (errors.length) {
    console.error('\nERREURS DE PAGE :')
    for (const e of errors) console.error(' -', e)
    failures++
  }

  console.log(failures ? `\n❌ ${failures} vérification(s) en échec` : '\n✅ Le bloc « Rappels » parle bien au Worker')
  process.exitCode = failures ? 1 : 0
} catch (e) {
  await page.screenshot({ path: `${DIR}/rappels-echec.png` })
  console.error('ÉCHEC :', e.message)
  for (const er of errors) console.error(' -', er)
  process.exitCode = 1
} finally {
  await browser.close()
}
