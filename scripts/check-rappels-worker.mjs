// Vérif du Worker de rappels (worker/notif/) — sans navigateur, sans réseau, sans KV réel.
//
// Deux volets :
//   1. LOGIQUE HORAIRE (worker/notif/due.js). Ce qu'on protège surtout, c'est le passage
//      heure d'été / hiver : le cron Cloudflare tourne en UTC, l'utilisateur veut son rappel
//      à 7h30 heure de Paris toute l'année. Un bug là-dessus est invisible six mois, puis
//      décale tous les rappels d'une heure.
//   2. SURFACE HTTP + CRON du Worker lui-même, avec un KV factice et `fetch` bouchonné :
//      on observe ce que le Worker AURAIT envoyé, aucun paquet ne quitte la machine.
//
// Les clés VAPID sont générées à la volée : ce script ne lit pas le .env et n'a besoin
// d'aucun secret.
//
// Prérequis : cd worker/notif && npm install
// Usage     : node scripts/check-rappels-worker.mjs
import { webcrypto } from 'node:crypto'
import worker from '../worker/notif/notif-elan.js'
import { dueNow, hoursOf, lastSentOf, localNow, notificationText, pruneLastSent, WINDOW_MIN } from '../worker/notif/due.js'

let failures = 0
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'} ${label}${ok ? '' : `\n         attendu ${e}\n         obtenu  ${a}`}`)
}

// =====================================================================================
//  1. Logique horaire
// =====================================================================================

const PARIS = 'Europe/Paris'
const AGENDA_ETE = { '2026-07-10': ['Fractionné 6×800m', 'Gainage'] }
const AGENDA_HIVER = { '2026-01-15': ['Footing 45 min'] }
const abonne = (over = {}) => ({ hours: ['07:30'], tz: PARIS, agenda: AGENDA_ETE, lastSent: {}, ...over })
const due = (entry, iso) => dueNow(entry, new Date(iso))

console.log('\nHeure d’été — Paris est à UTC+2, 7h30 locale = 5h30 UTC')
check('5h30 UTC → envoi', !!due(abonne(), '2026-07-10T05:30:00Z'), true)
check('5h25 UTC → trop tôt', due(abonne(), '2026-07-10T05:25:00Z'), null)
check('6h30 UTC (= 8h30 locale) → hors fenêtre', due(abonne(), '2026-07-10T06:30:00Z'), null)
check('noms remontés', due(abonne(), '2026-07-10T05:30:00Z').names, ['Fractionné 6×800m', 'Gainage'])
check('date locale', due(abonne(), '2026-07-10T05:30:00Z').date, '2026-07-10')

console.log('\nHeure d’hiver — Paris est à UTC+1, 7h30 locale = 6h30 UTC')
const hiver = abonne({ agenda: AGENDA_HIVER })
check('6h30 UTC → envoi', !!due(hiver, '2026-01-15T06:30:00Z'), true)
check('5h30 UTC (= 6h30 locale) → trop tôt', due(hiver, '2026-01-15T05:30:00Z'), null)

console.log(`\nFenêtre de tolérance à la gigue du cron (${WINDOW_MIN} min)`)
check('7h44 locale → encore dans la fenêtre', !!due(abonne(), '2026-07-10T05:44:00Z'), true)
check('7h45 locale → fenêtre fermée', due(abonne(), '2026-07-10T05:45:00Z'), null)

console.log('\nAnti-doublon : un rappel par heure et par jour')
check('déjà envoyé aujourd’hui → rien', due(abonne({ lastSent: { '07:30': '2026-07-10' } }), '2026-07-10T05:30:00Z'), null)
check('envoyé hier → on envoie', !!due(abonne({ lastSent: { '07:30': '2026-07-09' } }), '2026-07-10T05:30:00Z'), true)

// Chrome sanctionne les pushs qui n'affichent pas de notification, jusqu'à révoquer l'abonnement.
console.log('\nJours sans séance : aucun push')
check('jour de repos (pas d’entrée)', due(abonne({ agenda: {} }), '2026-07-10T05:30:00Z'), null)
check('séance déjà validée (liste vide)', due(abonne({ agenda: { '2026-07-10': [] } }), '2026-07-10T05:30:00Z'), null)
check('agenda périmé', due(abonne({ agenda: AGENDA_HIVER }), '2026-07-10T05:30:00Z'), null)

console.log('\nPlusieurs rappels par jour — matin, midi, soir')
{
  const trois = abonne({ hours: ['07:30', '12:30', '19:00'] })

  const matin = due(trois, '2026-07-10T05:30:00Z') // 7h30 locale
  check('7h30 → rang 0 (annonce)', [matin.hour, matin.rank], ['07:30', 0])

  const midi = due({ ...trois, lastSent: { '07:30': '2026-07-10' } }, '2026-07-10T10:30:00Z') // 12h30
  check('12h30 → rang 1 (relance)', [midi.hour, midi.rank], ['12:30', 1])

  const soir = due({ ...trois, lastSent: { '07:30': '2026-07-10', '12:30': '2026-07-10' } }, '2026-07-10T17:00:00Z')
  check('19h00 → rang 2 (relance)', [soir.hour, soir.rank], ['19:00', 2])

  const tousEnvoyes = { '07:30': '2026-07-10', '12:30': '2026-07-10', '19:00': '2026-07-10' }
  check('tous envoyés → rien', due({ ...trois, lastSent: tousEnvoyes }, '2026-07-10T17:00:00Z'), null)

  // Le matin verrouillé n'empêche PAS le rappel de midi : c'est tout l'intérêt du lastSent par heure
  check('midi part même si le matin est déjà parti', !!midi, true)

  // Séance validée entre 7h30 et 12h30 → l'app réécrit l'agenda, le jour disparaît, midi se tait
  check('séance validée à 10h → midi se tait', due({ ...trois, agenda: {} }, '2026-07-10T10:30:00Z'), null)

  // Un rappel unique le soir garde le rang 0 : il annonce, il ne relance pas
  const seulSoir = abonne({ hours: ['19:00'] })
  check('rappel unique à 19h → rang 0', due(seulSoir, '2026-07-10T17:00:00Z').rank, 0)
}

console.log('\nRappels trop rapprochés : une seule notification, pas une rafale')
{
  // 07:30 et 07:35 : leurs fenêtres de 15 min se chevauchent.
  const serres = abonne({ hours: ['07:30', '07:35'] })
  const d = due(serres, '2026-07-10T05:36:00Z') // 7h36 locale : les deux sont dues
  check('on retient la plus tardive', d.hour, '07:35')
  check('l’autre est marquée sans être poussée', d.alsoMark, ['07:30'])
}

console.log('\nMigration de l’ancien format (heure unique)')
{
  const ancien = { hour: '07:30', tz: PARIS, agenda: AGENDA_ETE, lastSent: '2026-07-09' }
  check('hour → hours', hoursOf(ancien), ['07:30'])
  check('lastSent (date) → objet rattaché à la 1re heure', lastSentOf(ancien), { '07:30': '2026-07-09' })
  check('envoyé hier → on envoie aujourd’hui', !!due(ancien, '2026-07-10T05:30:00Z'), true)
  const dejaFait = { ...ancien, lastSent: '2026-07-10' }
  check('envoyé aujourd’hui → pas de rejeu à la migration', due(dejaFait, '2026-07-10T05:30:00Z'), null)
  check('heures triées et dédoublonnées', hoursOf({ hours: ['19:00', '07:30', '19:00'] }), ['07:30', '19:00'])
}

console.log('\nPurge de lastSent quand une heure est supprimée')
check('les heures disparues sont oubliées', pruneLastSent({ '07:30': 'd1', '12:30': 'd2' }, ['07:30']), { '07:30': 'd1' })

console.log('\nRobustesse')
check('fuseau invalide → ignoré, pas de crash', dueNow(abonne({ tz: 'Pas/Un/Fuseau' }), new Date()), null)
check('aucune heure configurée → rien', dueNow(abonne({ hours: [] }), new Date()), null)
check('minuit ne sort pas en « 24 »', localNow(new Date('2026-07-09T22:00:00Z'), PARIS).minutes, 0)
check('minuit → date du lendemain', localNow(new Date('2026-07-09T22:00:00Z'), PARIS).date, '2026-07-10')
check('rappel à minuit', !!due(abonne({ hours: ['00:00'] }), '2026-07-09T22:00:00Z'), true)

console.log('\nTexte de la notification')
check('rang 0, une séance', notificationText(['Gainage'], 0), { title: 'Séance du jour', body: 'Gainage' })
check('rang 0, deux séances', notificationText(['Fractionné 6×800m', 'Gainage'], 0), {
  title: 'Séances du jour (2)',
  body: 'Fractionné 6×800m · Gainage',
})
check('rang 1, une séance', notificationText(['Gainage'], 1), { title: 'Pas encore fait', body: 'Gainage' })
check('rang 2, deux séances', notificationText(['Fractionné 6×800m', 'Gainage'], 2), {
  title: 'Pas encore fait (2)',
  body: 'Fractionné 6×800m · Gainage',
})

// =====================================================================================
//  2. Surface HTTP + cron, avec KV factice et fetch bouchonné
// =====================================================================================

const b64url = (b) => Buffer.from(b).toString('base64url')

// Clés VAPID éphémères, aux formats attendus par web-push-browser (raw + pkcs8)
const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const env = {
  VAPID_PUBLIC_KEY: b64url(await webcrypto.subtle.exportKey('raw', pair.publicKey)),
  VAPID_PRIVATE_KEY: b64url(await webcrypto.subtle.exportKey('pkcs8', pair.privateKey)),
  ADMIN_CONTACT: 'mailto:test@example.com',
  ELAN_NOTIF_KEY: 'test-key',
  REMINDERS: null, // posé juste après
}

const store = new Map()
env.REMINDERS = {
  async get(k, type) {
    const v = store.get(k)
    return v === undefined ? null : type === 'json' ? JSON.parse(v) : v
  },
  async put(k, v) {
    store.set(k, v)
  },
  async delete(k) {
    store.delete(k)
  },
  async list({ prefix }) {
    return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }
  },
}

// Faux abonné : de vraies clés P-256, comme celles que produit un navigateur
const ua = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/ABONNE-TEST',
  keys: {
    p256dh: b64url(await webcrypto.subtle.exportKey('raw', ua.publicKey)),
    auth: b64url(webcrypto.getRandomValues(new Uint8Array(16))),
  },
}

let sent = []
let nextStatus = 201
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(String(input), init)
  sent.push({ url: req.url, encoding: req.headers.get('content-encoding'), ttl: req.headers.get('ttl') })
  return new Response(null, { status: nextStatus })
}

const ORIGIN = 'https://routine-sport-ca440.web.app'
const post = (path, body, auth = 'Bearer test-key') =>
  worker.fetch(
    new Request('https://elan-notif.workers.dev' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify(body),
    }),
    env,
  )

// Le Worker travaille dans ctx.waitUntil(...) sans l'attendre : on retient la promesse et on
// l'attend nous-mêmes, sinon les assertions passeraient avant l'envoi.
const runCron = async () => {
  const pending = []
  await worker.scheduled(null, env, { waitUntil: (p) => pending.push(p) })
  await Promise.all(pending)
}

const AGENDA = { '2026-07-10': ['Fractionné 6×800m'] }

console.log('\nAuthentification & CORS')
check('sans clé → 401', (await post('/subscribe', {}, null)).status, 401)
check('mauvaise clé → 401', (await post('/subscribe', {}, 'Bearer mauvaise-cle')).status, 401)
{
  const r = await worker.fetch(new Request('https://x/subscribe', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env)
  check('préflight OPTIONS → 204', r.status, 204)
  check('CORS renvoie l’origine autorisée', r.headers.get('access-control-allow-origin'), ORIGIN)
}
check('GET → 405', (await worker.fetch(new Request('https://x/subscribe', { method: 'GET' }), env)).status, 405)

console.log('\nValidation de /subscribe')
check('abonnement absent → 400', (await post('/subscribe', { hours: ['07:30'], tz: PARIS, agenda: {} })).status, 400)
check('heure « 7h30 » → 400', (await post('/subscribe', { subscription, hours: ['7h30'], tz: PARIS, agenda: {} })).status, 400)
check('heure « 25:00 » → 400', (await post('/subscribe', { subscription, hours: ['25:00'], tz: PARIS, agenda: {} })).status, 400)
check('liste vide → 400', (await post('/subscribe', { subscription, hours: [], tz: PARIS, agenda: {} })).status, 400)
check(
  'plus de 4 rappels → 400',
  (await post('/subscribe', { subscription, hours: ['06:00', '09:00', '12:00', '15:00', '18:00'], tz: PARIS, agenda: {} })).status,
  400,
)
check('fuseau vide → 400', (await post('/subscribe', { subscription, hours: ['07:30'], tz: '', agenda: {} })).status, 400)
check('agenda absent → 400', (await post('/subscribe', { subscription, hours: ['07:30'], tz: PARIS })).status, 400)
check('route inconnue → 404', (await post('/nimporte', {})).status, 404)

console.log('\nAbonnement nominal')
{
  const r = await post('/subscribe', { subscription, hours: ['19:00', '07:30'], tz: PARIS, agenda: AGENDA })
  check('→ 200', r.status, 200)
  check('corps', await r.json(), { ok: true, jours: 1, rappels: 2 })
  check('une entrée en KV', store.size, 1)
  check('clé = SHA-256 de l’endpoint', /^sub:[0-9a-f]{64}$/.test([...store.keys()][0]), true)
  check('heures triées à l’écriture', JSON.parse([...store.values()][0]).hours, ['07:30', '19:00'])
}

console.log('\nUn ancien client (champ `hour`) reste accepté')
{
  store.clear()
  const r = await post('/subscribe', { subscription, hour: '07:30', tz: PARIS, agenda: AGENDA })
  check('→ 200', r.status, 200)
  check('normalisé en hours[]', JSON.parse([...store.values()][0]).hours, ['07:30'])
}

console.log('\nSupprimer une heure purge son lastSent')
{
  store.clear()
  await post('/subscribe', { subscription, hours: ['07:30', '19:00'], tz: PARIS, agenda: AGENDA })
  const k = [...store.keys()][0]
  store.set(k, JSON.stringify({ ...JSON.parse(store.get(k)), lastSent: { '07:30': 'd1', '19:00': 'd2' } }))
  await post('/subscribe', { subscription, hours: ['07:30'], tz: PARIS, agenda: AGENDA })
  check('lastSent ne garde que 07:30', JSON.parse(store.get(k)).lastSent, { '07:30': 'd1' })
}

console.log('\nCron : envoi au bon moment, une seule fois')
{
  // Le cron lit l'heure réelle : on règle l'abonné sur l'heure locale COURANTE.
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: PARIS, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  )
  const today = `${p.year}-${p.month}-${p.day}`
  const maintenant = `${p.hour}:${p.minute}`

  store.clear()
  await post('/subscribe', { subscription, hours: [maintenant], tz: PARIS, agenda: { [today]: ['Gainage'] } })

  sent = []
  await runCron()
  check('un push envoyé', sent.length, 1)
  check('chiffré en aes128gcm (RFC 8291)', sent[0]?.encoding, 'aes128gcm')
  check('ttl de 6 h', sent[0]?.ttl, '21600')
  check('vers le bon endpoint', sent[0]?.url, subscription.endpoint)
  check('lastSent posé sur cette heure', JSON.parse([...store.values()][0]).lastSent, { [maintenant]: today })

  sent = []
  await runCron()
  check('second réveil du cron → pas de doublon', sent.length, 0)

  console.log('\nDeux rappels le même jour : le second part quand même')
  {
    // Un rappel « déjà envoyé » plus tôt + un rappel dû maintenant → le cron doit pousser
    // le second. C'est précisément ce que le lastSent PAR HEURE rend possible.
    //
    // L'autre heure est prise à 12 h de l'heure courante : jamais dans sa fenêtre de
    // tolérance, quelle que soit l'heure à laquelle ce test tourne.
    const m = (Number(p.hour) * 60 + Number(p.minute) + 720) % 1440
    const autre = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

    const k = [...store.keys()][0]
    const e = JSON.parse(store.get(k))
    store.set(k, JSON.stringify({ ...e, hours: [autre, maintenant].sort(), lastSent: { [autre]: today } }))
    sent = []
    await runCron()
    check('le rappel de l’heure courante part', sent.length, 1)
    check('les deux heures sont marquées', JSON.parse(store.get(k)).lastSent, { [autre]: today, [maintenant]: today })
  }

  console.log('\nAbonnement mort (410) → purge du KV')
  const entry = JSON.parse([...store.values()][0])
  entry.hours = [maintenant]
  delete entry.lastSent
  store.set([...store.keys()][0], JSON.stringify(entry))
  nextStatus = 410
  sent = []
  await runCron()
  check('push tenté', sent.length, 1)
  check('entrée purgée', store.size, 0)
  nextStatus = 201
}

console.log('\n/unsubscribe')
{
  store.clear()
  await post('/subscribe', { subscription, hours: ['07:30'], tz: PARIS, agenda: AGENDA })
  check('entrée créée', store.size, 1)
  check('→ 200', (await post('/unsubscribe', { endpoint: subscription.endpoint })).status, 200)
  check('entrée supprimée', store.size, 0)
}

console.log('\n/test — push immédiat')
{
  store.clear()
  check('endpoint inconnu → 404', (await post('/test', { endpoint: 'https://inconnu' })).status, 404)
  await post('/subscribe', { subscription, hours: ['07:30'], tz: PARIS, agenda: AGENDA })
  sent = []
  const r = await post('/test', { endpoint: subscription.endpoint })
  check('→ 200', r.status, 200)
  check('corps', await r.json(), { ok: true, status: 201 })
  check('un push part immédiatement, même hors créneau', sent.length, 1)
}

console.log(failures ? `\n❌ ${failures} vérification(s) en échec` : '\n✅ Worker de rappels conforme')
process.exit(failures ? 1 : 0)
